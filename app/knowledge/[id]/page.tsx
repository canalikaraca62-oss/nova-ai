"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";

import {
  ArrowLeft,
  BookOpen,
  Brain,
  Calendar,
  Clock,
  Database,
  FileText,
  FolderOpen,
  Hash,
  SearchX,
  Share2,
  Sparkles,
} from "lucide-react";

type KnowledgeType =
  | "document"
  | "note"
  | "research"
  | "dataset";

interface KnowledgeItem {
  id: string;
  title: string;
  description: string;
  type: KnowledgeType;
  updatedAt: string;
  createdAt: string;
  author: string;
  tags: string[];
  content: string[];
}

const KNOWLEDGE_ITEMS: KnowledgeItem[] = [
  {
    id: "ai-strategy",
    title: "AI Strategy & Architecture",
    description:
      "Core architecture, product strategy and AI system decisions.",
    type: "research",
    updatedAt: "Recently updated",
    createdAt: "August 2026",
    author: "SYRAVEN Intelligence",
    tags: ["AI", "Architecture", "Strategy"],
    content: [
      "This knowledge space contains the core strategic decisions and architectural principles behind the SYRAVEN intelligence platform.",
      "The system is designed around scalable intelligence, autonomous workflows, secure data handling and modular product capabilities.",
      "Every major technical decision should support long-term extensibility while maintaining a fast and reliable user experience.",
    ],
  },
  {
    id: "product-research",
    title: "Product Research",
    description:
      "Research, market analysis and product discovery notes.",
    type: "research",
    updatedAt: "Updated today",
    createdAt: "August 2026",
    author: "Product Intelligence",
    tags: ["Research", "Product"],
    content: [
      "This collection contains product discovery research, competitive analysis and market intelligence.",
      "Insights are continuously organized to help teams identify opportunities, understand user needs and improve strategic decisions.",
      "Research should be connected to measurable outcomes and actionable product initiatives.",
    ],
  },
  {
    id: "technical-docs",
    title: "Technical Documentation",
    description:
      "Engineering documentation, APIs and implementation details.",
    type: "document",
    updatedAt: "Updated yesterday",
    createdAt: "July 2026",
    author: "Engineering",
    tags: ["Engineering", "API"],
    content: [
      "This section centralizes technical architecture, implementation decisions and engineering documentation.",
      "Documentation should remain clear, maintainable and accessible to every authorized team member.",
      "Each system component should define its responsibilities, dependencies and operational constraints.",
    ],
  },
  {
    id: "user-insights",
    title: "User Insights",
    description:
      "Customer feedback, interviews and behavioral insights.",
    type: "dataset",
    updatedAt: "Updated 2 days ago",
    createdAt: "July 2026",
    author: "Research Team",
    tags: ["Users", "Insights"],
    content: [
      "This knowledge collection aggregates user feedback, behavioral signals and qualitative research.",
      "Patterns discovered here can inform product priorities, interface improvements and automation opportunities.",
      "Insights should be reviewed regularly and connected to validated product decisions.",
    ],
  },
];

const TYPE_LABELS: Record<
  KnowledgeType,
  string
> = {
  document: "Document",
  note: "Note",
  research: "Research",
  dataset: "Dataset",
};

function getTypeIcon(type: KnowledgeType) {
  switch (type) {
    case "research":
      return Brain;

    case "dataset":
      return Database;

    case "note":
      return BookOpen;

    case "document":
    default:
      return FileText;
  }
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

  const knowledge = useMemo(() => {
    return KNOWLEDGE_ITEMS.find(
      (item) => item.id === knowledgeId
    );
  }, [knowledgeId]);

  if (!knowledge) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
          <div className="rounded-2xl bg-muted p-4">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="mt-6 text-2xl font-semibold text-foreground">
            Knowledge not found
          </h1>

          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            The knowledge item you are looking for does not
            exist or may have been moved.
          </p>

          <Link
            href="/knowledge"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to knowledge
          </Link>
        </div>
      </main>
    );
  }

  const TypeIcon = getTypeIcon(
    knowledge.type
  );

  return (
    <main className="min-h-screen bg-background">
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
            <div className="flex gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <TypeIcon className="h-7 w-7" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    {TYPE_LABELS[knowledge.type]}
                  </span>

                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {knowledge.updatedAt}
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  {knowledge.title}
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {knowledge.description}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Share knowledge"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />

              <div>
                <p className="text-xs text-muted-foreground">
                  Created
                </p>

                <p className="mt-1 text-sm font-medium text-foreground">
                  {knowledge.createdAt}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <FolderOpen className="h-5 w-5 text-primary" />

              <div>
                <p className="text-xs text-muted-foreground">
                  Source
                </p>

                <p className="mt-1 text-sm font-medium text-foreground">
                  {knowledge.author}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />

              <div>
                <p className="text-xs text-muted-foreground">
                  Intelligence
                </p>

                <p className="mt-1 text-sm font-medium text-foreground">
                  Active
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />

            <h2 className="text-lg font-semibold text-foreground">
              Overview
            </h2>
          </div>

          <div className="mt-6 space-y-5 text-sm leading-7 text-muted-foreground">
            {knowledge.content.map(
              (paragraph, index) => (
                <p key={index}>
                  {paragraph}
                </p>
              )
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" />

            <h2 className="text-lg font-semibold text-foreground">
              Tags
            </h2>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {knowledge.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-primary/20 bg-primary/[0.03] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />

                <span className="text-sm font-medium">
                  AI Knowledge Intelligence
                </span>
              </div>

              <h2 className="mt-3 text-xl font-semibold text-foreground">
                Explore this knowledge with AI
              </h2>

              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Ask questions, generate insights and connect
                this knowledge with your workspace.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Sparkles className="h-4 w-4" />
              Ask SYRAVEN
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}