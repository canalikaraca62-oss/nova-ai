-- =========================================================
-- SYRAVEN — Semantic ranking RPC and ANN index
--
-- Phase 10.3 blocker resolution (see PRODUCTION_RELIABILITY.md).
--
--
-- PROBLEM
--
-- PostgREST cannot express `order by embedding <=> $1`: the `<=>`
-- operator has no REST filter form. True k-nearest-neighbour ordering
-- must therefore run inside Postgres, as a function.
--
-- Without it, lib/search/semantic.ts runs in a degraded but SAFE mode:
-- correctly authorization-scoped, ordered by chunk_index, reporting
-- `degraded: true` and `distance: null`. It deliberately does NOT fall
-- back to fetching a broad corpus and ranking in application code —
-- that is the post-filtering hazard the module exists to prevent.
--
-- This migration supplies the missing database capability. It matches
-- the contract already declared in lib/search/semantic.ts:
--
--   RETRIEVAL_CONTRACT = {
--     rpcName:          "match_knowledge_chunks",
--     rpcSecurity:      "INVOKER",
--     distanceOperator: "<=>",
--   }
--
--
-- WHY SECURITY INVOKER IS NOT NEGOTIABLE
--
-- `ai_knowledge_chunks` carries no tenant column. Its ONLY authorization
-- boundary is the RLS policy, which resolves ownership through three
-- foreign keys and terminates in `auth.uid()`:
--
--   chunk -> document -> source -> knowledge_base.owner_id = auth.uid()
--
-- A SECURITY DEFINER function runs as its owner, which changes what
-- `auth.uid()` returns and disables that policy entirely. Over a vector
-- index, the result would not merely be "wrong rows" — it would be the
-- rows most semantically similar to the caller's question, drawn from
-- every tenant in the system. That is a full-corpus disclosure
-- primitive and must never exist.
--
-- SECURITY INVOKER is the PostgreSQL default; it is stated explicitly
-- here so a reviewer sees the decision rather than inferring it.
--
--
-- WHY NO IDENTITY PARAMETER
--
-- The function accepts no user, organization, or tenant argument.
-- Identity is taken solely from `auth.uid()` inside the RLS policies.
-- There is consequently nothing for a caller to forge: passing a
-- different tenant's id is not possible because no such parameter
-- exists.
--
-- `knowledge_base` is a NARROWING filter only. It is applied ALONGSIDE
-- RLS, never instead of it, so naming another tenant's knowledge base
-- yields zero rows rather than access to it.
--
--
-- SAFETY
--
--   Additive        One index, one function. No table is altered.
--   Idempotent      `create index if not exists` and
--                   `create or replace function`.
--   Data loss       None. No DDL against data, no DML.
--   RLS             Unchanged. No policy is created, altered or dropped.
--   Transactional   No CONCURRENTLY, so all statements run inside the
--                   migration transaction and roll back together.
-- =========================================================


-- =========================================================
-- 1. HNSW INDEX
--
-- HNSW rather than IVFFlat, for three reasons:
--
--   1. IVFFlat cannot be built usefully on an empty table — it computes
--      cluster centroids from existing data, so building on zero rows
--      produces a degenerate index that must be rebuilt after
--      ingestion. `ai_knowledge_chunks` is currently empty. HNSW builds
--      incrementally and is correct from the first insert.
--   2. Better recall/latency at these scales, with no `lists` parameter
--      to re-tune as the corpus grows.
--   3. pgvector 0.8.2 is installed; HNSW requires >= 0.5.0.
--
-- `vector_cosine_ops` matches the `<=>` operator used below, which
-- matches EMBEDDING_MODEL_CONTRACT.distance = "cosine" in
-- lib/search/vector.ts. An index whose opclass disagreed with the query
-- operator would simply never be used.
--
-- m = 16 and ef_construction = 64 are the pgvector defaults, appropriate
-- to roughly a million vectors.
--
-- NOTE: `hnsw.ef_search` is deliberately NOT set here. It trades query
-- cost for recall and should be tuned against real data, not guessed at
-- while the table is empty. See the RLS interaction note in section 2.
-- =========================================================

create index if not exists ai_knowledge_chunks_embedding_hnsw
  on public.ai_knowledge_chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);


-- =========================================================
-- 2. SIMILARITY SEARCH FUNCTION
--
-- BOUNDED PARAMETERS
--
-- Both bounds are enforced in SQL, so they hold regardless of what the
-- application sends:
--
--   match_threshold  least(greatest(x, 0.0), 1.0)
--                    Cosine similarity for these embeddings never
--                    exceeds 1.0, so an unbounded threshold such as 99
--                    would produce an unsatisfiable predicate — a scan
--                    that does the work and returns nothing. Clamping
--                    makes the worst case "exact matches only".
--
--   match_count      least(greatest(x, 1), 50)
--                    A caller cannot request ten thousand rows.
--
-- EMBEDDINGS ARE NEVER RETURNED
--
-- The RETURNS TABLE lists five columns and `embedding` is not among
-- them; a caller receives only a `similarity` scalar. Returning raw
-- vectors would let a caller reconstruct corpus geometry, and they are
-- useless to a UI.
--
-- RLS AND THE ANN INDEX
--
-- These coexist safely but not efficiently. Postgres applies the RLS
-- predicate to rows the index returns, so with HNSW the planner fetches
-- roughly `ef_search` candidates and THEN filters by ownership. If most
-- candidates belong to other owners, the caller may receive fewer than
-- `match_count` rows even though more authorized matches exist.
--
-- Security is unaffected — no unauthorized row is ever returned — but
-- results can be silently incomplete. Mitigate by raising
-- `hnsw.ef_search` per session, or by passing `knowledge_base` to
-- narrow before ranking. This is a recall consideration, not a
-- correctness one.
-- =========================================================

create or replace function public.match_knowledge_chunks(
  query_embedding  vector(1536),
  match_threshold  double precision default 0.75,
  match_count      integer          default 10,
  knowledge_base   uuid             default null
)
returns table (
  id                    uuid,
  knowledge_document_id uuid,
  content               text,
  chunk_index           integer,
  similarity            double precision
)
language sql
stable
security invoker            -- explicit; the default, stated for reviewers
parallel safe
set search_path = public    -- pin name resolution
as $$
  select
    c.id,
    c.knowledge_document_id,
    c.content,
    c.chunk_index,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.ai_knowledge_chunks c
  where c.embedding is not null
    and 1 - (c.embedding <=> query_embedding)
          >= least(greatest(match_threshold, 0.0), 1.0)
    and (
      knowledge_base is null
      or exists (
        select 1
        from public.ai_knowledge_documents kd
        join public.ai_knowledge_sources ks on ks.id = kd.knowledge_source_id
        where kd.id = c.knowledge_document_id
          and ks.knowledge_base_id = knowledge_base
      )
    )
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;

comment on function public.match_knowledge_chunks is
  'SECURITY INVOKER cosine similarity over ai_knowledge_chunks. RLS is '
  'the authorization boundary; this function adds no identity parameter '
  'and must never be converted to SECURITY DEFINER.';


-- =========================================================
-- 3. EXECUTE PRIVILEGES
--
-- `authenticated` may call it; RLS decides what they see.
-- `anon` is refused outright: an unauthenticated caller has no
-- knowledge bases and would receive nothing, but denying EXECUTE
-- removes the ability to probe the function at all.
-- =========================================================

grant execute on function public.match_knowledge_chunks(
  vector(1536), double precision, integer, uuid
) to authenticated;

revoke execute on function public.match_knowledge_chunks(
  vector(1536), double precision, integer, uuid
) from anon;
