"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";

import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  Code2,
  Database,
  Download,
  ExternalLink,
  Globe2,
  Heart,
  Loader2,
  Play,
  SearchX,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Zap,
} from "lucide-react";

type MarketplaceCategory =
  | "AI Agents"
  | "Development"
  | "Data"
  | "Productivity"
  | "Research";

type IconType =
  | "bot"
  | "code"
  | "database"
  | "zap"
  | "globe";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  category: MarketplaceCategory;
  author: string;
  version: string;
  rating: number;
  reviews: number;
  installs: string;
  verified: boolean;
  featured: boolean;
  icon: IconType;
  features: string[];
  requirements: string[];
  updatedAt: string;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: "syraven-research-agent",
    name: "SYRAVEN Research Agent",
    description:
      "Autonomous research agent for deep analysis, source discovery and structured intelligence.",
    longDescription:
      "SYRAVEN Research Agent helps teams transform complex questions into structured research workflows. It can organize information, identify relevant topics, synthesize findings and create actionable intelligence for your workspace.",
    category: "AI Agents",
    author: "SYRAVEN Intelligence",
    version: "1.0.0",
    rating: 4.9,
    reviews: 248,
    installs: "12.4k",
    verified: true,
    featured: true,
    icon: "bot",
    features: [
      "Autonomous research workflows",
      "Structured knowledge discovery",
      "Source and topic analysis",
      "Intelligent insight generation",
      "Workspace integration",
    ],
    requirements: [
      "SYRAVEN Workspace",
      "Knowledge access",
      "Active AI capabilities",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "code-architect",
    name: "Code Architect",
    description:
      "Analyze codebases, generate architecture insights and accelerate complex engineering workflows.",
    longDescription:
      "Code Architect provides a structured intelligence layer for software development. It helps teams understand complex codebases, identify architectural patterns and accelerate engineering decisions.",
    category: "Development",
    author: "SYRAVEN Engineering",
    version: "1.2.0",
    rating: 4.8,
    reviews: 193,
    installs: "9.8k",
    verified: true,
    featured: true,
    icon: "code",
    features: [
      "Codebase analysis",
      "Architecture insights",
      "Dependency understanding",
      "Engineering recommendations",
      "Development workflow support",
    ],
    requirements: [
      "Repository access",
      "SYRAVEN Workspace",
      "Development permissions",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "data-intelligence",
    name: "Data Intelligence",
    description:
      "Transform raw datasets into structured insights, reports and intelligent recommendations.",
    longDescription:
      "Data Intelligence helps teams turn complex datasets into understandable insights. It supports structured analysis, pattern discovery and intelligent reporting across your workspace.",
    category: "Data",
    author: "SYRAVEN Data",
    version: "1.1.0",
    rating: 4.7,
    reviews: 156,
    installs: "7.2k",
    verified: true,
    featured: false,
    icon: "database",
    features: [
      "Dataset analysis",
      "Pattern discovery",
      "Intelligent reporting",
      "Data summaries",
      "Workspace insights",
    ],
    requirements: [
      "Data access",
      "SYRAVEN Workspace",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "workflow-automation",
    name: "Workflow Automation",
    description:
      "Build intelligent workflows that automate repetitive tasks across your workspace.",
    longDescription:
      "Workflow Automation enables teams to create intelligent automations for repetitive processes and workspace operations.",
    category: "Productivity",
    author: "Automation Labs",
    version: "2.0.0",
    rating: 4.8,
    reviews: 121,
    installs: "6.5k",
    verified: true,
    featured: false,
    icon: "zap",
    features: [
      "Workflow creation",
      "Automation triggers",
      "Task orchestration",
      "Workspace actions",
      "Intelligent automation",
    ],
    requirements: [
      "SYRAVEN Workspace",
      "Automation permissions",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "market-insights",
    name: "Market Insights",
    description:
      "Discover market opportunities, competitive signals and emerging industry trends.",
    longDescription:
      "Market Insights helps organizations understand market movement, competitive signals and emerging opportunities through structured intelligence.",
    category: "Research",
    author: "Insight Systems",
    version: "1.0.0",
    rating: 4.6,
    reviews: 89,
    installs: "4.3k",
    verified: true,
    featured: false,
    icon: "globe",
    features: [
      "Market analysis",
      "Competitive intelligence",
      "Trend discovery",
      "Opportunity detection",
      "Research summaries",
    ],
    requirements: [
      "SYRAVEN Workspace",
      "Research capabilities",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "autonomous-builder",
    name: "Autonomous Builder",
    description:
      "An AI-powered development assistant for planning, building and improving software products.",
    longDescription:
      "Autonomous Builder supports software teams throughout planning, implementation and iteration by providing an intelligent development workflow.",
    category: "Development",
    author: "SYRAVEN Labs",
    version: "1.3.0",
    rating: 4.9,
    reviews: 207,
    installs: "10.1k",
    verified: true,
    featured: true,
    icon: "code",
    features: [
      "Project planning",
      "Intelligent development",
      "Code generation support",
      "Architecture guidance",
      "Product iteration",
    ],
    requirements: [
      "SYRAVEN Workspace",
      "Development environment",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "knowledge-miner",
    name: "Knowledge Miner",
    description:
      "Extract valuable insights from documents, knowledge bases and unstructured information.",
    longDescription:
      "Knowledge Miner analyzes large collections of information and helps transform fragmented documents into structured, searchable intelligence.",
    category: "AI Agents",
    author: "Knowledge Systems",
    version: "1.0.0",
    rating: 4.7,
    reviews: 114,
    installs: "5.9k",
    verified: false,
    featured: false,
    icon: "bot",
    features: [
      "Document analysis",
      "Knowledge extraction",
      "Information organization",
      "Insight generation",
      "Searchable intelligence",
    ],
    requirements: [
      "Knowledge access",
      "SYRAVEN Workspace",
    ],
    updatedAt: "Updated recently",
  },
  {
    id: "team-intelligence",
    name: "Team Intelligence",
    description:
      "Understand team activity, project momentum and organizational knowledge patterns.",
    longDescription:
      "Team Intelligence provides a structured view of organizational activity, project momentum and collaboration patterns.",
    category: "Productivity",
    author: "Workspace Labs",
    version: "1.0.0",
    rating: 4.5,
    reviews: 76,
    installs: "3.7k",
    verified: true,
    featured: false,
    icon: "globe",
    features: [
      "Team activity analysis",
      "Project insights",
      "Collaboration patterns",
      "Knowledge visibility",
      "Organizational intelligence",
    ],
    requirements: [
      "Team workspace",
      "SYRAVEN Workspace",
    ],
    updatedAt: "Updated recently",
  },
];

function MarketplaceIcon({
  type,
  className,
}: {
  type: IconType;
  className?: string;
}) {
  switch (type) {
    case "code":
      return <Code2 className={className} />;

    case "database":
      return <Database className={className} />;

    case "zap":
      return <Zap className={className} />;

    case "globe":
      return <Globe2 className={className} />;

    case "bot":
    default:
      return <Bot className={className} />;
  }
}

export default function MarketplaceDetailPage() {
  const params = useParams<{ id: string }>();

  const [isInstalling, setIsInstalling] =
    useState(false);

  const [isInstalled, setIsInstalled] =
    useState(false);

  const [isFavorite, setIsFavorite] =
    useState(false);

  const item = useMemo(() => {
    return MARKETPLACE_ITEMS.find(
      (marketplaceItem) =>
        marketplaceItem.id === params.id
    );
  }, [params.id]);

  const handleInstall = async () => {
    if (isInstalling || isInstalled) {
      return;
    }

    setIsInstalling(true);

    await new Promise((resolve) => {
      window.setTimeout(resolve, 700);
    });

    setIsInstalling(false);
    setIsInstalled(true);
  };

  if (!item) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <SearchX className="h-8 w-8 text-muted-foreground" />
          </div>

          <h1 className="mt-6 text-2xl font-semibold text-foreground">
            Marketplace item not found
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The item you are looking for does not exist or
            may have been removed from the marketplace.
          </p>

          <Link
            href="/marketplace"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 lg:px-8 lg:py-10">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <section className="rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MarketplaceIcon
                    type={item.icon}
                    className="h-8 w-8"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                      {item.category}
                    </span>

                    {item.featured && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                        <Sparkles className="h-3.5 w-3.5" />
                        Featured
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                      {item.name}
                    </h1>

                    {item.verified && (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    )}
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground">
                    By {item.author}
                  </p>

                  <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                    {item.description}
                  </p>

                  <div className="mt-6 flex flex-wrap items-center gap-5 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4 fill-current text-primary" />

                      <span className="font-semibold text-foreground">
                        {item.rating}
                      </span>

                      <span className="text-muted-foreground">
                        {item.reviews} reviews
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      {item.installs} installs
                    </div>

                    <div className="text-muted-foreground">
                      Version {item.version}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground">
                About this capability
              </h2>

              <p className="mt-5 text-sm leading-7 text-muted-foreground">
                {item.longDescription}
              </p>
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />

                <h2 className="text-xl font-semibold text-foreground">
                  Key capabilities
                </h2>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {item.features.map((feature) => (
                  <div
                    key={feature}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />

                    <span className="text-sm text-foreground">
                      {feature}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-xl font-semibold text-foreground">
                Requirements
              </h2>

              <div className="mt-5 space-y-3">
                {item.requirements.map(
                  (requirement) => (
                    <div
                      key={requirement}
                      className="flex items-center gap-3 text-sm text-muted-foreground"
                    >
                      <ShieldCheck className="h-4 w-4 text-primary" />

                      {requirement}
                    </div>
                  )
                )}
              </div>
            </section>
          </div>

          <aside>
            <div className="sticky top-6 rounded-3xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Add to workspace
              </h2>

              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Install this capability and make it available
                across your SYRAVEN workspace.
              </p>

              <button
                type="button"
                onClick={handleInstall}
                disabled={
                  isInstalling || isInstalled
                }
                className={`mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-all ${
                  isInstalled
                    ? "bg-primary/10 text-primary"
                    : "bg-primary text-primary-foreground hover:opacity-90"
                } disabled:cursor-not-allowed`}
              >
                {isInstalling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Installing...
                  </>
                ) : isInstalled ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Installed
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Install capability
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setIsFavorite(
                    (current) => !current
                  )
                }
                className={`mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors ${
                  isFavorite
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Heart
                  className={`h-4 w-4 ${
                    isFavorite
                      ? "fill-current"
                      : ""
                  }`}
                />

                {isFavorite
                  ? "Saved"
                  : "Save for later"}
              </button>

              <div className="mt-6 space-y-4 border-t border-border pt-6">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Version
                  </span>

                  <span className="font-medium text-foreground">
                    {item.version}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Updated
                  </span>

                  <span className="font-medium text-foreground">
                    {item.updatedAt}
                  </span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Installs
                  </span>

                  <span className="font-medium text-foreground">
                    {item.installs}
                  </span>
                </div>
              </div>

              <Link
                href="/dashboard"
                className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Open workspace
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-5 rounded-2xl border border-border bg-muted/30 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Play className="h-5 w-5" />
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">
                    Ready to explore?
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Install and start using it instantly.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}