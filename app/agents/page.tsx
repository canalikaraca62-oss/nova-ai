"use client";

import {
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowRight,
  Bot,
  Brain,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Code2,
  Compass,
  Database,
  FileSearch,
  Globe2,
  Heart,
  LayoutGrid,
  Mail,
  Megaphone,
  MessageSquareText,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  WandSparkles,
} from "lucide-react";

/* =========================================================
 * TYPES
 * ========================================================= */

type AgentCategory =
  | "All"
  | "Research"
  | "Development"
  | "Business"
  | "Creative"
  | "Productivity"
  | "Personal";

type Agent = {
  id: string;
  name: string;
  description: string;
  category: AgentCategory;
  icon: React.ReactNode;
  featured?: boolean;
  premium?: boolean;
  popular?: boolean;
  color: string;
  tags: string[];
};

/* =========================================================
 * AGENTS
 * ========================================================= */

const agents: Agent[] = [
  {
    id: "research-agent",
    name: "Research Agent",
    description:
      "Araştırır, kaynakları karşılaştırır, doğrular ve karar vermeye hazır sonuçlar üretir.",
    category: "Research",
    icon: <FileSearch size={23} />,
    featured: true,
    popular: true,
    color: "from-blue-500/20 via-cyan-500/10 to-transparent",
    tags: ["Web", "Sources", "Analysis"],
  },
  {
    id: "coding-agent",
    name: "Coding Agent",
    description:
      "Kod yazar, hataları analiz eder, refactor yapar ve proje mimarisini geliştirir.",
    category: "Development",
    icon: <Code2 size={23} />,
    featured: true,
    popular: true,
    color: "from-violet-500/20 via-fuchsia-500/10 to-transparent",
    tags: ["Code", "Debug", "Refactor"],
  },
  {
    id: "website-agent",
    name: "Website Agent",
    description:
      "Web sitelerini analiz eder, geliştirme planı çıkarır ve yeni özellikler için çözüm üretir.",
    category: "Development",
    icon: <Globe2 size={23} />,
    featured: true,
    premium: true,
    color: "from-emerald-500/20 via-teal-500/10 to-transparent",
    tags: ["Website", "UX", "Build"],
  },
  {
    id: "business-agent",
    name: "Business Agent",
    description:
      "İş fikirleri, strateji, operasyon ve büyüme planları için AI iş ortağın.",
    category: "Business",
    icon: <BriefcaseBusiness size={23} />,
    featured: true,
    color: "from-orange-500/20 via-amber-500/10 to-transparent",
    tags: ["Strategy", "Growth", "Planning"],
  },
  {
    id: "marketing-agent",
    name: "Marketing Agent",
    description:
      "Kampanyalar, içerik fikirleri, hedef kitle ve büyüme stratejileri oluşturur.",
    category: "Business",
    icon: <Megaphone size={23} />,
    popular: true,
    color: "from-pink-500/20 via-rose-500/10 to-transparent",
    tags: ["Marketing", "Content", "Growth"],
  },
  {
    id: "data-agent",
    name: "Data Analyst",
    description:
      "Verileri analiz eder, önemli eğilimleri bulur ve anlaşılır içgörüler oluşturur.",
    category: "Research",
    icon: <Database size={23} />,
    premium: true,
    color: "from-sky-500/20 via-blue-500/10 to-transparent",
    tags: ["Data", "Insights", "Reports"],
  },
  {
    id: "writing-agent",
    name: "Writing Agent",
    description:
      "Makale, e-posta, içerik, senaryo ve profesyonel metinler üretir.",
    category: "Creative",
    icon: <MessageSquareText size={23} />,
    color: "from-purple-500/20 via-violet-500/10 to-transparent",
    tags: ["Writing", "Content", "Ideas"],
  },
  {
    id: "design-agent",
    name: "Design Agent",
    description:
      "Ürün fikirlerini, tasarım sistemlerini ve yaratıcı yönlendirmeleri geliştirir.",
    category: "Creative",
    icon: <WandSparkles size={23} />,
    premium: true,
    color: "from-fuchsia-500/20 via-purple-500/10 to-transparent",
    tags: ["Design", "Creative", "Brand"],
  },
  {
    id: "personal-agent",
    name: "Personal Assistant",
    description:
      "Gününü organize eder, önemli işleri takip eder ve sana proaktif öneriler sunar.",
    category: "Personal",
    icon: <Brain size={23} />,
    featured: true,
    color: "from-indigo-500/20 via-blue-500/10 to-transparent",
    tags: ["Life", "Planning", "Memory"],
  },
  {
    id: "email-agent",
    name: "Email Agent",
    description:
      "E-postaları özetlemek, taslak hazırlamak ve önemli konuları ayıklamak için tasarlandı.",
    category: "Productivity",
    icon: <Mail size={23} />,
    color: "from-cyan-500/20 via-sky-500/10 to-transparent",
    tags: ["Email", "Inbox", "Summary"],
  },
  {
    id: "calendar-agent",
    name: "Calendar Agent",
    description:
      "Takvimini anlamlandırır, programını düzenler ve yaklaşan işleri takip eder.",
    category: "Productivity",
    icon: <CalendarDays size={23} />,
    color: "from-green-500/20 via-emerald-500/10 to-transparent",
    tags: ["Calendar", "Schedule", "Planning"],
  },
  {
    id: "shopping-agent",
    name: "Shopping Research",
    description:
      "Ürünleri araştırır, seçenekleri karşılaştırır ve karar vermeni kolaylaştırır.",
    category: "Personal",
    icon: <ShoppingBag size={23} />,
    color: "from-yellow-500/20 via-orange-500/10 to-transparent",
    tags: ["Products", "Compare", "Research"],
  },
];

const categories: AgentCategory[] = [
  "All",
  "Research",
  "Development",
  "Business",
  "Creative",
  "Productivity",
  "Personal",
];

/* =========================================================
 * PAGE
 * ========================================================= */

export default function AgentsPage() {
  const [search, setSearch] =
    useState("");

  const [activeCategory, setActiveCategory] =
    useState<AgentCategory>("All");

  const [favorites, setFavorites] =
    useState<string[]>([]);

  const filteredAgents =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return agents.filter((agent) => {
        const categoryMatch =
          activeCategory === "All" ||
          agent.category === activeCategory;

        const searchMatch =
          !query ||
          agent.name
            .toLowerCase()
            .includes(query) ||
          agent.description
            .toLowerCase()
            .includes(query) ||
          agent.tags.some((tag) =>
            tag
              .toLowerCase()
              .includes(query)
          );

        return (
          categoryMatch &&
          searchMatch
        );
      });
    }, [
      activeCategory,
      search,
    ]);

  const featuredAgents =
    agents.filter(
      (agent) =>
        agent.featured
    );

  function toggleFavorite(
    agentId: string
  ) {
    setFavorites(
      (previous) =>
        previous.includes(agentId)
          ? previous.filter(
              (id) =>
                id !== agentId
            )
          : [
              ...previous,
              agentId,
            ]
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-10">

        {/* =================================================
         * HERO
         * ================================================= */}

        <section className="relative overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet-500/[0.10] blur-3xl" />

          <div className="pointer-events-none absolute bottom-0 left-1/3 h-48 w-72 rounded-full bg-blue-500/[0.08] blur-3xl" />

          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">

            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-3 py-1.5 text-xs font-medium text-violet-200">
                <Sparkles size={14} />
                SYRAVEN Intelligence Network
              </div>

              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                Tek bir AI değil.
                <span className="block bg-gradient-to-r from-violet-300 via-white to-cyan-300 bg-clip-text text-transparent">
                  Kendi AI ekibin.
                </span>
              </h1>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                Araştırma, kodlama, tasarım,
                iş geliştirme ve günlük yaşam için
                uzmanlaşmış SYRAVEN Agent’larını kullan.
                İstersen tamamen kendine özel bir
                agent oluştur.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/agents/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                <Plus size={18} />
                Agent Oluştur
              </Link>

              <Link
                href="/marketplace"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/[0.10] bg-white/[0.04] px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
              >
                Marketplace
                <ArrowRight size={17} />
              </Link>
            </div>
          </div>

          {/* STATS */}

          <div className="relative mt-10 grid gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <p className="text-2xl font-semibold tracking-tight">
                {agents.length}+
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Hazır uzman agent
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <p className="text-2xl font-semibold tracking-tight">
                24/7
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                AI çalışma kapasitesi
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
              <p className="text-2xl font-semibold tracking-tight">
                ∞
              </p>

              <p className="mt-1 text-xs text-zinc-500">
                Kendi workflow imkanın
              </p>
            </div>
          </div>
        </section>

        {/* =================================================
         * FEATURED
         * ================================================= */}

        <section className="mt-12">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-violet-300">
                <Star size={14} />
                Öne Çıkanlar
              </div>

              <h2 className="text-2xl font-semibold tracking-tight">
                En güçlü agentlar
              </h2>
            </div>

            <Link
              href="/marketplace"
              className="hidden items-center gap-1 text-sm text-zinc-400 transition hover:text-white sm:inline-flex"
            >
              Tümünü gör
              <ChevronRight size={16} />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {featuredAgents.slice(0, 4).map(
              (agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isFavorite={
                    favorites.includes(
                      agent.id
                    )
                  }
                  onFavorite={() =>
                    toggleFavorite(
                      agent.id
                    )
                  }
                />
              )
            )}
          </div>
        </section>

        {/* =================================================
         * SEARCH + FILTERS
         * ================================================= */}

        <section className="mt-14">
          <div className="flex flex-col gap-5">

            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-cyan-300">
                <Compass size={14} />
                Agent Explorer
              </div>

              <h2 className="text-2xl font-semibold tracking-tight">
                İhtiyacın için doğru agentı bul
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Uzmanlık alanına göre filtrele
                veya doğrudan ara.
              </p>
            </div>

            <div className="relative">
              <Search
                size={19}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Agent ara..."
                className="h-14 w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/40 focus:bg-white/[0.06]"
              />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(
                (category) => {
                  const active =
                    activeCategory ===
                    category;

                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() =>
                        setActiveCategory(
                          category
                        )
                      }
                      className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${
                        active
                          ? "border-white bg-white text-black"
                          : "border-white/[0.08] bg-white/[0.03] text-zinc-400 hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {category}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* =================================================
           * ALL AGENTS
           * ================================================= */}

          <div className="mt-8">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <LayoutGrid
                  size={17}
                  className="text-zinc-500"
                />

                <p className="text-sm text-zinc-400">
                  <span className="font-medium text-white">
                    {filteredAgents.length}
                  </span>{" "}
                  agent bulundu
                </p>
              </div>
            </div>

            {filteredAgents.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredAgents.map(
                  (agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      isFavorite={
                        favorites.includes(
                          agent.id
                        )
                      }
                      onFavorite={() =>
                        toggleFavorite(
                          agent.id
                        )
                      }
                    />
                  )
                )}
              </div>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/[0.10] bg-white/[0.02] px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.05] text-zinc-400">
                  <Search size={23} />
                </div>

                <h3 className="mt-5 text-lg font-semibold">
                  Agent bulunamadı
                </h3>

                <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500">
                  Arama ifadenizi veya kategori
                  seçiminizi değiştirmeyi deneyin.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* =================================================
         * CREATE CTA
         * ================================================= */}

        <section className="mt-14 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-br from-violet-500/[0.12] via-blue-500/[0.06] to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">

            <div className="max-w-2xl">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.10] bg-white/[0.08]">
                <Bot size={22} />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                Kendi AI uzmanını oluştur.
              </h2>

              <p className="mt-3 text-sm leading-7 text-zinc-400">
                Agent’ın rolünü, uzmanlık alanını,
                çalışma şeklini ve davranışlarını
                sen belirle. SYRAVEN agent sistemi
                gelecekte workflow, memory, tools ve
                otomasyonlarla birlikte çalışacak şekilde
                tasarlanmıştır.
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className="text-emerald-400"
                  />
                  Custom instructions
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className="text-emerald-400"
                  />
                  Memory ready
                </span>

                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    size={14}
                    className="text-emerald-400"
                  />
                  Tools & workflows
                </span>
              </div>
            </div>

            <Link
              href="/agents/create"
              className="inline-flex h-13 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              <Plus size={18} />
              Yeni Agent Oluştur
            </Link>
          </div>
        </section>

        {/* =================================================
         * TRUST / SYSTEM
         * ================================================= */}

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={
              <ShieldCheck
                size={20}
              />
            }
            title="Kullanıcı kontrolü"
            description="Agent dış dünyada işlem yapmadan önce gerekli durumlarda açık kullanıcı onayı ister."
          />

          <InfoCard
            icon={
              <Users size={20} />
            }
            title="Ekip uyumlu"
            description="Agent mimarisi gelecekte personal, workspace, team ve enterprise kullanımlarına uyumludur."
          />

          <InfoCard
            icon={
              <TrendingUp size={20} />
            }
            title="Ölçeklenebilir yapı"
            description="Marketplace, workflow, memory ve bağlı uygulamalarla büyüyebilecek şekilde tasarlanmıştır."
          />
        </section>
      </main>
    </div>
  );
}

/* =========================================================
 * AGENT CARD
 * ========================================================= */

function AgentCard({
  agent,
  isFavorite,
  onFavorite,
}: {
  agent: Agent;
  isFavorite: boolean;
  onFavorite: () => void;
}) {
  return (
    <div className="group relative overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-white/[0.025] p-5 transition duration-300 hover:-translate-y-1 hover:border-white/[0.14] hover:bg-white/[0.05]">

      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${agent.color} opacity-0 transition duration-500 group-hover:opacity-100`}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.10] bg-black/20 text-white shadow-lg">
            {agent.icon}
          </div>

          <button
            type="button"
            onClick={onFavorite}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
              isFavorite
                ? "border-rose-400/30 bg-rose-400/[0.10] text-rose-300"
                : "border-white/[0.07] bg-white/[0.03] text-zinc-500 hover:text-white"
            }`}
            aria-label="Favorilere ekle"
          >
            <Heart
              size={17}
              fill={
                isFavorite
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-2">
          <h3 className="font-semibold tracking-tight text-white">
            {agent.name}
          </h3>

          {agent.premium && (
            <span className="rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-2 py-0.5 text-[9px] font-bold tracking-wider text-amber-300">
              PRO
            </span>
          )}

          {agent.popular && (
            <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-2 py-0.5 text-[9px] font-bold tracking-wider text-violet-300">
              POPULAR
            </span>
          )}
        </div>

        <p className="mt-2 min-h-[60px] text-sm leading-6 text-zinc-500">
          {agent.description}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {agent.tags.map(
            (tag) => (
              <span
                key={tag}
                className="rounded-lg bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-zinc-500"
              >
                {tag}
              </span>
            )
          )}
        </div>

        <Link
          href={`/agents/${agent.id}`}
          className="mt-6 flex h-11 items-center justify-between rounded-xl border border-white/[0.08] bg-black/20 px-4 text-sm font-medium text-zinc-300 transition hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white"
        >
          Agent’ı Aç

          <ArrowRight
            size={17}
            className="transition group-hover:translate-x-1"
          />
        </Link>
      </div>
    </div>
  );
}

/* =========================================================
 * INFO CARD
 * ========================================================= */

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-zinc-300">
        {icon}
      </div>

      <h3 className="mt-4 text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-2 text-xs leading-6 text-zinc-500">
        {description}
      </p>
    </div>
  );
}