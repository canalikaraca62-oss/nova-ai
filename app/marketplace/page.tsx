"use client";

import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  Code2,
  Database,
  Search,
  Sparkles,
  Star,
  Users,
  Zap,
  Globe2,
  SlidersHorizontal,
  ArrowUpRight,
} from "lucide-react";
import {
  useMemo,
  useState,
} from "react";

type MarketplaceCategory =
  | "All"
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
  | "globe"
  | "users";

interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: Exclude<
    MarketplaceCategory,
    "All"
  >;
  author: string;
  rating: number;
  reviews: number;
  installs: string;
  verified: boolean;
  featured: boolean;
  icon: IconType;
}

const MARKETPLACE_ITEMS: MarketplaceItem[] = [
  {
    id: "nova-research-agent",
    name: "NOVA Research Agent",
    description:
      "Autonomous research agent for deep analysis, source discovery and structured intelligence.",
    category: "AI Agents",
    author: "NOVA Intelligence",
    rating: 4.9,
    reviews: 248,
    installs: "12.4k",
    verified: true,
    featured: true,
    icon: "bot",
  },
  {
    id: "code-architect",
    name: "Code Architect",
    description:
      "Analyze codebases, generate architecture insights and accelerate complex engineering workflows.",
    category: "Development",
    author: "NOVA Engineering",
    rating: 4.8,
    reviews: 193,
    installs: "9.8k",
    verified: true,
    featured: true,
    icon: "code",
  },
  {
    id: "data-intelligence",
    name: "Data Intelligence",
    description:
      "Transform raw datasets into structured insights, reports and intelligent recommendations.",
    category: "Data",
    author: "NOVA Data",
    rating: 4.7,
    reviews: 156,
    installs: "7.2k",
    verified: true,
    featured: false,
    icon: "database",
  },
  {
    id: "workflow-automation",
    name: "Workflow Automation",
    description:
      "Build intelligent workflows that automate repetitive tasks across your workspace.",
    category: "Productivity",
    author: "Automation Labs",
    rating: 4.8,
    reviews: 121,
    installs: "6.5k",
    verified: true,
    featured: false,
    icon: "zap",
  },
  {
    id: "market-insights",
    name: "Market Insights",
    description:
      "Discover market opportunities, competitive signals and emerging industry trends.",
    category: "Research",
    author: "Insight Systems",
    rating: 4.6,
    reviews: 89,
    installs: "4.3k",
    verified: true,
    featured: false,
    icon: "globe",
  },
  {
    id: "autonomous-builder",
    name: "Autonomous Builder",
    description:
      "An AI-powered development assistant for planning, building and improving software products.",
    category: "Development",
    author: "NOVA Labs",
    rating: 4.9,
    reviews: 207,
    installs: "10.1k",
    verified: true,
    featured: true,
    icon: "code",
  },
  {
    id: "knowledge-miner",
    name: "Knowledge Miner",
    description:
      "Extract valuable insights from documents, knowledge bases and unstructured information.",
    category: "AI Agents",
    author: "Knowledge Systems",
    rating: 4.7,
    reviews: 114,
    installs: "5.9k",
    verified: false,
    featured: false,
    icon: "bot",
  },
  {
    id: "team-intelligence",
    name: "Team Intelligence",
    description:
      "Understand team activity, project momentum and organizational knowledge patterns.",
    category: "Productivity",
    author: "Workspace Labs",
    rating: 4.5,
    reviews: 76,
    installs: "3.7k",
    verified: true,
    featured: false,
    icon: "users",
  },
];

const CATEGORIES: MarketplaceCategory[] = [
  "All",
  "AI Agents",
  "Development",
  "Data",
  "Productivity",
  "Research",
];

function MarketplaceIcon({
  type,
  className,
}: {
  type: IconType;
  className?: string;
}) {
  switch (type) {
    case "bot":
      return <Bot className={className} />;

    case "code":
      return <Code2 className={className} />;

    case "database":
      return <Database className={className} />;

    case "zap":
      return <Zap className={className} />;

    case "globe":
      return <Globe2 className={className} />;

    case "users":
      return <Users className={className} />;

    default:
      return <Sparkles className={className} />;
  }
}

export default function MarketplacePage() {
  const [searchQuery, setSearchQuery] =
    useState("");

  const [selectedCategory, setSelectedCategory] =
    useState<MarketplaceCategory>("All");

  const filteredItems = useMemo(() => {
    const query =
      searchQuery.trim().toLowerCase();

    return MARKETPLACE_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" ||
        item.category === selectedCategory;

      const searchableContent = [
        item.name,
        item.description,
        item.category,
        item.author,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        query.length === 0 ||
        searchableContent.includes(query);

      return (
        matchesCategory &&
        matchesSearch
      );
    });
  }, [
    searchQuery,
    selectedCategory,
  ]);

  const featuredItems = useMemo(() => {
    return MARKETPLACE_ITEMS.filter(
      (item) => item.featured
    );
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-8">
        <section className="border-b border-border pb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                NOVA Ecosystem
              </div>

              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Marketplace
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Discover intelligent capabilities,
                autonomous agents and powerful tools
                designed to expand your NOVA workspace.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {MARKETPLACE_ITEMS.length} capabilities
            </div>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />

            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Featured capabilities
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Popular intelligence tools for
                high-performance workspaces.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {featuredItems.map((item) => (
              <Link
                key={item.id}
                href={`/marketplace/${item.id}`}
                className="group relative overflow-hidden rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl"
              >
                <div className="absolute right-5 top-5">
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MarketplaceIcon
                    type={item.icon}
                    className="h-6 w-6"
                  />
                </div>

                <div className="mt-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {item.name}
                    </h3>

                    {item.verified && (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    )}
                  </div>

                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border pt-5">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="h-4 w-4 fill-current text-primary" />

                    <span className="font-medium text-foreground">
                      {item.rating}
                    </span>

                    <span className="text-muted-foreground">
                      ({item.reviews})
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {item.installs} installs
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                Explore marketplace
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Find the right intelligence layer
                for your workflow.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />

              {filteredItems.length} results
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value
                  )
                }
                placeholder="Search capabilities..."
                className="h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() =>
                    setSelectedCategory(category)
                  }
                  className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                    selectedCategory === category
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MarketplaceIcon
                      type={item.icon}
                      className="h-5 w-5"
                    />
                  </div>

                  <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                    {item.category}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">
                      {item.name}
                    </h3>

                    {item.verified && (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </div>

                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                    {item.description}
                  </p>

                  <p className="mt-4 text-xs text-muted-foreground">
                    By {item.author}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Star className="h-4 w-4 fill-current text-primary" />

                    <span className="font-medium text-foreground">
                      {item.rating}
                    </span>

                    <span className="text-muted-foreground">
                      {item.reviews}
                    </span>
                  </div>

                  <span className="text-xs text-muted-foreground">
                    {item.installs}
                  </span>
                </div>

                <Link
                  href={`/marketplace/${item.id}`}
                  className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  View details

                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground" />

              <h3 className="mt-4 text-lg font-semibold text-foreground">
                No capabilities found
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
                Try adjusting your search query or
                selecting another category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
                className="mt-5 text-sm font-medium text-primary hover:underline"
              >
                Reset filters
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}