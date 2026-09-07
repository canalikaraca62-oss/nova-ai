# How to produce the schema dump Phase 2 needs

Phase 2 must reconcile the migrations against the **real** production schema.
Column names and types were verified remotely, but the following cannot be read
through the REST API and must come from a dump or catalog query:

- foreign keys into `auth.users`
- `CHECK` constraints
- indexes
- triggers
- which tables have RLS **enabled**
- RLS **policy** definitions
- table-level `GRANT`s

Either option below produces what is needed. **Option B needs no software.**

---

## Option A — Supabase CLI (needs Docker Desktop)

```bash
supabase db dump --linked -f supabase/live_schema.sql
```

Commit or paste `supabase/live_schema.sql`. This is the most complete output.

---

## Option B — SQL Editor (no install required)

Open the Supabase dashboard → **SQL Editor**, run each query below, and save the
result. All are **read-only** `SELECT`s against system catalogs; none reads user
data and none modifies anything.

### B1. RLS enabled/disabled per table

```sql
select
  c.relname                                as table_name,
  c.relrowsecurity                         as rls_enabled,
  c.relforcerowsecurity                    as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
```

### B2. All RLS policies

```sql
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
```

### B3. Constraints — PK, FK (including cross-schema), UNIQUE, CHECK

```sql
select
  rel.relname                                   as table_name,
  con.conname                                   as constraint_name,
  con.contype                                   as type,          -- p/f/u/c
  pg_get_constraintdef(con.oid)                 as definition
from pg_constraint con
join pg_class rel      on rel.oid = con.conrelid
join pg_namespace nsp  on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
order by rel.relname, con.contype, con.conname;
```

### B4. Indexes

```sql
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
```

### B5. Triggers

```sql
select
  c.relname                                     as table_name,
  t.tgname                                      as trigger_name,
  pg_get_triggerdef(t.oid)                      as definition
from pg_trigger t
join pg_class c       on c.oid = t.tgrelid
join pg_namespace n   on n.oid = c.relnamespace
where n.nspname = 'public'
  and not t.tgisinternal
order by c.relname, t.tgname;
```

### B6. Table-level grants (confirms the `messages` finding)

```sql
select
  table_name,
  grantee,
  string_agg(privilege_type, ', ' order by privilege_type) as privileges
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon', 'authenticated', 'service_role')
group by table_name, grantee
order by table_name, grantee;
```

### B7. Function definitions (confirms the `handle_updated_at` finding)

```sql
select
  p.proname                                     as function_name,
  pg_get_functiondef(p.oid)                     as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by p.proname;
```

---

## Where to put the output

Save as `supabase/live_schema.sql` (Option A), or paste the query results into
`supabase/live_schema_report.txt` (Option B). Then say the file is ready and the
baseline migration will be reconciled against it.

---

## A note on `SUPABASE_DB_URL`

`.env.local` sets `SUPABASE_DB_URL` to a `db.<ref>.supabase.co` host, which no
longer resolves (`ENOTFOUND`) — Supabase has moved projects to pooler
hostnames. Any tooling relying on that variable will fail. The correct
connection string is in **Dashboard → Project Settings → Database → Connection
string**. This is unrelated to Phase 2's migrations but will block local
tooling until corrected.
