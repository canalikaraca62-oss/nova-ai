"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  ExternalLink,
  Hash,
  SearchX,
  Share2,
} from "lucide-react";

/*
  One knowledge record, loaded from GET /api/knowledge?id=.

  This page used to look the id up in four hardcoded records, so every
  real record -- linked from /knowledge, /search and the activity feed --
  landed on "Knowledge not found" while the demo slugs rendered invented
  content and an "Intelligence: Active" card
  (docs/engineering/PURIFICATION_EVIDENCE.md P2-E01).
*/

interface KnowledgeRecord {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  type: string | null;
  status: string | null;
  tags: string[] | null;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

function formatDate(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Unknown"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

/*
  A stored source URL is user-supplied. It is rendered as a link only
  when it is http(s): anything else -- a javascript: URL above all --
  would turn a knowledge record into a script link.
*/
function safeSourceUrl(value: string | null): string | null {
  if (!value) return null;

  return /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

export default function KnowledgeDetailPage() {
  const params = useParams();

  const knowledgeId = useMemo(() => {
    const id = params?.id;

    if (Array.isArray(id)) {
      return id[0] ?? "";
    }

    return id ?? "";
  }, [params]);

  const [record, setRecord] = useState<KnowledgeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setSignedOut(false);

    try {
      const response = await fetch(
        `/api/knowledge?id=${encodeURIComponent(knowledgeId)}`,
        { cache: "no-store" },
      );

      if (response.status === 401) {
        setRecord(null);
        setSignedOut(true);
        return;
      }

      if (response.status === 404) {
        setRecord(null);
        return;
      }

      if (!response.ok) {
        setRecord(null);
        setLoadError("This knowledge record could not be loaded.");
        return;
      }

      const payload = (await response.json().catch(() => null)) as {
        data?: KnowledgeRecord[];
      } | null;

      setRecord(payload?.data?.[0] ?? null);
    } catch {
      setRecord(null);
      setLoadError("This knowledge record could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [knowledgeId]);

  useEffect(() => {
    let cancelled = false;

    void Promise.resolve().then(() => {
      if (cancelled) return undefined;

      return load();
    });

    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!record) {
    return (
      /*
        A plain container, not a second <main>: AppChrome already emits
        the page main landmark, and two of them is invalid HTML.
      */
      <div className="bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
          {loading ? (
            <p role="status" className="text-sm text-muted-foreground">
              Loading knowledge...
            </p>
          ) : loadError ? (
            <p
              role="alert"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {loadError}
            </p>
          ) : (
            <>
              <div className="rounded-2xl bg-muted p-4">
                <SearchX className="h-8 w-8 text-muted-foreground" />
              </div>

              <h1 className="mt-6 text-2xl font-semibold text-foreground">
                {signedOut ? "Sign in to view this record" : "Knowledge not found"}
              </h1>

              <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                {signedOut
                  ? "Knowledge records belong to an account. Sign in, then open it again."
                  : "This record does not exist, or it belongs to another account."}
              </p>
            </>
          )}

          <Link
            href={signedOut ? "/login" : "/knowledge"}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            {signedOut ? "Sign in" : "Back to knowledge"}
          </Link>
        </div>
      </div>
    );
  }

  const paragraphs = (record.content ?? "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  const tags = (record.tags ?? []).filter((tag) => tag.trim().length > 0);

  const sourceUrl = safeSourceUrl(record.source_url);

  return (
    /*
      A plain container, not a second <main>: AppChrome already emits
      the page main landmark, and two of them is invalid HTML.
    */
    <div className="bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 lg:px-8 lg:py-10">
        <Link
          href="/knowledge"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to knowledge
        </Link>

        <header className="mt-8 border-b border-border pb-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                {record.type ? (
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium capitalize text-muted-foreground">
                    {record.type}
                  </span>
                ) : null}

                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Updated {formatDate(record.updated_at)}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {record.title}
              </h1>

              {record.description ? (
                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {record.description}
                </p>
              ) : null}
            </div>

            {/*
              Sharing needs a sharing model -- who a recipient is, what
              they may see, how access is revoked. None of that exists,
              and knowledge rows are RLS-scoped to their owner, so this
              button has nothing to call.
            */}
            <button
              type="button"
              disabled
              aria-label="Share knowledge"
              aria-describedby="knowledge-share-availability"
              className="inline-flex h-10 w-10 shrink-0 cursor-not-allowed items-center justify-center rounded-xl border border-border text-muted-foreground opacity-60"
            >
              <Share2 className="h-4 w-4" />
            </button>

            <span id="knowledge-share-availability" className="sr-only">
              Sharing is not available yet.
            </span>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />

              <div>
                <p className="text-xs text-muted-foreground">Created</p>

                <p className="mt-1 text-sm font-medium text-foreground">
                  {formatDate(record.created_at)}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-primary" />

              <div>
                <p className="text-xs text-muted-foreground">Status</p>

                <p className="mt-1 text-sm font-medium capitalize text-foreground">
                  {record.status ?? "Unknown"}
                </p>
              </div>
            </div>
          </div>

          {sourceUrl ? (
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <ExternalLink className="h-5 w-5 text-primary" />

                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Source</p>

                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm font-medium text-primary hover:underline"
                  >
                    {sourceUrl}
                  </a>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />

            <h2 className="text-lg font-semibold text-foreground">Content</h2>
          </div>

          <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
            {paragraphs.length > 0 ? (
              paragraphs.map((paragraph, index) => (
                <p key={index} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))
            ) : (
              <p>This record has no content yet.</p>
            )}
          </div>
        </section>

        {tags.length > 0 ? (
          <section className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" />

              <h2 className="text-lg font-semibold text-foreground">Tags</h2>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
