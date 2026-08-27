"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  Bot,
  Brain,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Code2,
  Crown,
  FileSearch,
  Globe2,
  Image,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRound,
  WandSparkles,
  Zap,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

/* ==================================================
 * TYPES
 * ================================================== */

type AgentVisibility =
  | "private"
  | "workspace"
  | "public";

type AgentModel =
  | "auto"
  | "fast"
  | "smart"
  | "deep";

type AgentCategory =
  | "general"
  | "research"
  | "coding"
  | "business"
  | "creative"
  | "data"
  | "productivity"
  | "custom";

type AgentCapability = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

type Category = {
  id: AgentCategory;
  title: string;
  description: string;
  icon: React.ReactNode;
};

/* ==================================================
 * CONSTANTS
 * ================================================== */

const categories: Category[] = [
  {
    id: "general",
    title: "General",
    description: "Her türlü görev için esnek AI agent.",
    icon: <Bot size={18} />,
  },
  {
    id: "research",
    title: "Research",
    description: "Araştırma, analiz ve kaynak odaklı çalışma.",
    icon: <FileSearch size={18} />,
  },
  {
    id: "coding",
    title: "Coding",
    description: "Kodlama, debugging ve teknik üretim.",
    icon: <Code2 size={18} />,
  },
  {
    id: "business",
    title: "Business",
    description: "Strateji, operasyon ve iş süreçleri.",
    icon: <BriefcaseBusiness size={18} />,
  },
  {
    id: "creative",
    title: "Creative",
    description: "Tasarım, içerik ve yaratıcı üretim.",
    icon: <Image size={18} />,
  },
  {
    id: "data",
    title: "Data",
    description: "Veri analizi ve içgörü üretimi.",
    icon: <Brain size={18} />,
  },
  {
    id: "productivity",
    title: "Productivity",
    description: "Planlama, görev ve kişisel verimlilik.",
    icon: <Zap size={18} />,
  },
  {
    id: "custom",
    title: "Custom",
    description: "Tamamen sana özel bir agent.",
    icon: <WandSparkles size={18} />,
  },
];

const capabilities: AgentCapability[] = [
  {
    id: "chat",
    title: "Advanced Chat",
    description: "Uzun bağlamlı ve akıllı konuşmalar.",
    icon: <MessageSquare size={19} />,
  },
  {
    id: "web",
    title: "Web Research",
    description: "Web üzerinde araştırma ve kaynak toplama.",
    icon: <Globe2 size={19} />,
  },
  {
    id: "reasoning",
    title: "Deep Reasoning",
    description: "Karmaşık problemleri çok adımlı analiz etme.",
    icon: <Brain size={19} />,
  },
  {
    id: "files",
    title: "File Analysis",
    description: "Belge, PDF, tablo ve diğer dosyaları analiz etme.",
    icon: <FileSearch size={19} />,
  },
  {
    id: "code",
    title: "Code Intelligence",
    description: "Kod üretme, inceleme ve hata tespiti.",
    icon: <Code2 size={19} />,
  },
  {
    id: "creative",
    title: "Creative Tools",
    description: "Yaratıcı içerik ve fikir üretimi.",
    icon: <Sparkles size={19} />,
  },
];

const suggestedPrompts = [
  "Bugün benim için en önemli işleri belirle.",
  "Bu konuyu detaylı şekilde araştır.",
  "Bir strateji ve uygulama planı oluştur.",
];

/* ==================================================
 * PAGE
 * ================================================== */

export default function CreateAgentPage() {
  const router =
    useRouter();

  const [
    name,
    setName,
  ] =
    useState("");

  const [
    description,
    setDescription,
  ] =
    useState("");

  const [
    category,
    setCategory,
  ] =
    useState<AgentCategory>(
      "general"
    );

  const [
    instructions,
    setInstructions,
  ] =
    useState("");

  const [
    selectedCapabilities,
    setSelectedCapabilities,
  ] =
    useState<string[]>([
      "chat",
      "reasoning",
    ]);

  const [
    visibility,
    setVisibility,
  ] =
    useState<AgentVisibility>(
      "private"
    );

  const [
    model,
    setModel,
  ] =
    useState<AgentModel>(
      "auto"
    );

  const [
    starters,
    setStarters,
  ] =
    useState<string[]>(
      suggestedPrompts
    );

  const [
    starterInput,
    setStarterInput,
  ] =
    useState("");

  const [
    isCreating,
    setIsCreating,
  ] =
    useState(false);

  const [
    showAdvanced,
    setShowAdvanced,
  ] =
    useState(false);

  /* ==================================================
   * AGENT AVATAR
   * ================================================== */

  const avatarLetter =
    useMemo(() => {
      const trimmed =
        name.trim();

      if (!trimmed) {
        return "S";
      }

      return trimmed
        .charAt(0)
        .toUpperCase();
    }, [
      name,
    ]);

  /* ==================================================
   * CAPABILITY TOGGLE
   * ================================================== */

  function toggleCapability(
    capabilityId: string
  ) {
    setSelectedCapabilities(
      (
        current
      ) => {
        if (
          current.includes(
            capabilityId
          )
        ) {
          if (
            current.length ===
            1
          ) {
            return current;
          }

          return current.filter(
            (
              item
            ) =>
              item !==
              capabilityId
          );
        }

        return [
          ...current,
          capabilityId,
        ];
      }
    );
  }

  /* ==================================================
   * ADD STARTER
   * ================================================== */

  function addStarter() {
    const value =
      starterInput.trim();

    if (!value) {
      return;
    }

    if (
      starters.includes(
        value
      )
    ) {
      setStarterInput(
        ""
      );

      return;
    }

    setStarters(
      (
        current
      ) => [
        ...current,
        value,
      ]
    );

    setStarterInput(
      ""
    );
  }

  /* ==================================================
   * REMOVE STARTER
   * ================================================== */

  function removeStarter(
    index: number
  ) {
    setStarters(
      (
        current
      ) =>
        current.filter(
          (
            _,
            currentIndex
          ) =>
            currentIndex !==
            index
        )
    );
  }

  /* ==================================================
   * CREATE AGENT
   * ================================================== */

  async function createAgent() {
    const cleanName =
      name.trim();

    if (!cleanName) {
      return;
    }

    setIsCreating(
      true
    );

    try {
      /*
       * Agent API / database bağlantısı
       * ileride burada merkezi agent service
       * üzerinden yapılacak.
       */

      await new Promise(
        (
          resolve
        ) =>
          setTimeout(
            resolve,
            700
          )
      );

      router.push(
        "/agents"
      );
    } catch (
      error
    ) {
      console.error(
        "AGENT OLUŞTURMA HATASI:",
        error
      );
    } finally {
      setIsCreating(
        false
      );
    }
  }

  /* ==================================================
   * RENDER
   * ================================================== */

  return (
    <main
      className="
        min-h-screen
        bg-[#09090b]
        text-white
      "
    >
      {/* ==================================================
       * TOP BAR
       * ================================================== */}

      <header
        className="
          sticky
          top-0
          z-30
          border-b
          border-white/[0.07]
          bg-[#09090b]/85
          backdrop-blur-2xl
        "
      >
        <div
          className="
            mx-auto
            flex
            h-16
            max-w-[1600px]
            items-center
            justify-between
            px-4
            sm:px-6
            lg:px-8
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <button
              type="button"
              onClick={() =>
                router.back()
              }
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-white/[0.08]
                bg-white/[0.025]
                text-zinc-400
                transition
                hover:border-white/[0.15]
                hover:bg-white/[0.06]
                hover:text-white
              "
              aria-label="Geri dön"
            >
              <ArrowLeft
                size={19}
              />
            </button>

            <div>
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <h1
                  className="
                    text-sm
                    font-semibold
                    tracking-tight
                    text-white
                    sm:text-base
                  "
                >
                  Create Agent
                </h1>

                <span
                  className="
                    hidden
                    items-center
                    gap-1
                    rounded-full
                    border
                    border-violet-400/20
                    bg-violet-500/10
                    px-2
                    py-0.5
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.16em]
                    text-violet-300
                    sm:inline-flex
                  "
                >
                  <Crown
                    size={10}
                  />
                  SYRAVEN
                </span>
              </div>

              <p
                className="
                  mt-0.5
                  text-xs
                  text-zinc-500
                "
              >
                Build your own intelligent AI agent
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={
              !name.trim() ||
              isCreating
            }
            onClick={
              createAgent
            }
            className="
              inline-flex
              h-10
              items-center
              gap-2
              rounded-xl
              bg-white
              px-4
              text-sm
              font-semibold
              text-black
              transition
              hover:bg-zinc-200
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {isCreating ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Sparkles
                size={16}
              />
            )}

            <span
              className="
                hidden
                sm:inline
              "
            >
              {isCreating
                ? "Creating..."
                : "Create Agent"}
            </span>
          </button>
        </div>
      </header>

      {/* ==================================================
       * CONTENT
       * ================================================== */}

      <div
        className="
          mx-auto
          grid
          w-full
          max-w-[1600px]
          gap-8
          px-4
          py-8
          sm:px-6
          lg:grid-cols-[minmax(0,1fr)_380px]
          lg:px-8
          lg:py-10
        "
      >
        {/* ==================================================
         * LEFT
         * ================================================== */}

        <section
          className="
            min-w-0
            space-y-8
          "
        >
          {/* IDENTITY */}

          <div
            className="
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.08]
              bg-gradient-to-b
              from-white/[0.045]
              to-white/[0.015]
            "
          >
            <div
              className="
                border-b
                border-white/[0.07]
                px-5
                py-5
                sm:px-7
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <div
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    border
                    border-violet-400/20
                    bg-violet-500/10
                    text-violet-300
                  "
                >
                  <Bot
                    size={17}
                  />
                </div>

                <div>
                  <h2
                    className="
                      text-base
                      font-semibold
                    "
                  >
                    Agent Identity
                  </h2>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      text-zinc-500
                    "
                  >
                    Give your AI agent a clear identity and purpose.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="
                grid
                gap-6
                p-5
                sm:p-7
                md:grid-cols-[110px_minmax(0,1fr)]
              "
            >
              <div
                className="
                  flex
                  flex-col
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-24
                    w-24
                    items-center
                    justify-center
                    rounded-[28px]
                    border
                    border-violet-400/25
                    bg-gradient-to-br
                    from-violet-500/30
                    via-fuchsia-500/15
                    to-cyan-400/10
                    text-3xl
                    font-bold
                    shadow-[0_0_60px_rgba(139,92,246,0.12)]
                  "
                >
                  {avatarLetter}
                </div>

                <span
                  className="
                    text-center
                    text-[11px]
                    text-zinc-500
                  "
                >
                  Agent avatar
                </span>
              </div>

              <div
                className="
                  space-y-5
                "
              >
                <label
                  className="
                    block
                  "
                >
                  <span
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                      text-zinc-200
                    "
                  >
                    Agent Name
                  </span>

                  <input
                    value={name}
                    onChange={
                      (
                        event
                      ) =>
                        setName(
                          event.target
                            .value
                        )
                    }
                    maxLength={80}
                    placeholder="Example: Research Pro"
                    className="
                      h-12
                      w-full
                      rounded-xl
                      border
                      border-white/[0.09]
                      bg-black/20
                      px-4
                      text-sm
                      text-white
                      outline-none
                      transition
                      placeholder:text-zinc-600
                      focus:border-violet-400/40
                      focus:ring-4
                      focus:ring-violet-500/10
                    "
                  />
                </label>

                <label
                  className="
                    block
                  "
                >
                  <span
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                      text-zinc-200
                    "
                  >
                    Short Description
                  </span>

                  <textarea
                    value={description}
                    onChange={
                      (
                        event
                      ) =>
                        setDescription(
                          event.target
                            .value
                        )
                    }
                    maxLength={300}
                    rows={4}
                    placeholder="What makes this agent useful?"
                    className="
                      w-full
                      resize-none
                      rounded-xl
                      border
                      border-white/[0.09]
                      bg-black/20
                      px-4
                      py-3
                      text-sm
                      leading-6
                      text-white
                      outline-none
                      transition
                      placeholder:text-zinc-600
                      focus:border-violet-400/40
                      focus:ring-4
                      focus:ring-violet-500/10
                    "
                  />
                </label>
              </div>
            </div>
          </div>

          {/* CATEGORY */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
              p-5
              sm:p-7
            "
          >
            <div
              className="
                mb-5
              "
            >
              <h2
                className="
                  text-base
                  font-semibold
                "
              >
                Agent Category
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-zinc-500
                "
              >
                Choose the primary role of your agent.
              </p>
            </div>

            <div
              className="
                grid
                gap-3
                sm:grid-cols-2
                xl:grid-cols-4
              "
            >
              {categories.map(
                (
                  item
                ) => {
                  const active =
                    category ===
                    item.id;

                  return (
                    <button
                      key={
                        item.id
                      }
                      type="button"
                      onClick={() =>
                        setCategory(
                          item.id
                        )
                      }
                      className={`
                        group
                        relative
                        min-h-[128px]
                        rounded-2xl
                        border
                        p-4
                        text-left
                        transition
                        ${
                          active
                            ? "border-violet-400/40 bg-violet-500/[0.09] shadow-[0_0_40px_rgba(139,92,246,0.07)]"
                            : "border-white/[0.07] bg-black/10 hover:border-white/[0.14] hover:bg-white/[0.035]"
                        }
                      `}
                    >
                      {active && (
                        <div
                          className="
                            absolute
                            right-3
                            top-3
                            flex
                            h-5
                            w-5
                            items-center
                            justify-center
                            rounded-full
                            bg-violet-400
                            text-black
                          "
                        >
                          <Check
                            size={13}
                            strokeWidth={3}
                          />
                        </div>
                      )}

                      <div
                        className={`
                          mb-4
                          flex
                          h-9
                          w-9
                          items-center
                          justify-center
                          rounded-xl
                          transition
                          ${
                            active
                              ? "bg-violet-400 text-black"
                              : "bg-white/[0.05] text-zinc-400 group-hover:text-white"
                          }
                        `}
                      >
                        {item.icon}
                      </div>

                      <p
                        className="
                          text-sm
                          font-semibold
                        "
                      >
                        {item.title}
                      </p>

                      <p
                        className="
                          mt-1
                          text-xs
                          leading-5
                          text-zinc-500
                        "
                      >
                        {item.description}
                      </p>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* CAPABILITIES */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
              p-5
              sm:p-7
            "
          >
            <div
              className="
                mb-5
                flex
                flex-col
                justify-between
                gap-3
                sm:flex-row
                sm:items-end
              "
            >
              <div>
                <h2
                  className="
                    text-base
                    font-semibold
                  "
                >
                  Capabilities
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    text-zinc-500
                  "
                >
                  Select what your agent is allowed to do.
                </p>
              </div>

              <div
                className="
                  inline-flex
                  w-fit
                  items-center
                  rounded-full
                  border
                  border-white/[0.08]
                  bg-white/[0.025]
                  px-3
                  py-1.5
                  text-xs
                  text-zinc-400
                "
              >
                {
                  selectedCapabilities.length
                }{" "}
                enabled
              </div>
            </div>

            <div
              className="
                grid
                gap-3
                md:grid-cols-2
              "
            >
              {capabilities.map(
                (
                  capability
                ) => {
                  const active =
                    selectedCapabilities.includes(
                      capability.id
                    );

                  return (
                    <button
                      key={
                        capability.id
                      }
                      type="button"
                      onClick={() =>
                        toggleCapability(
                          capability.id
                        )
                      }
                      className={`
                        flex
                        items-start
                        gap-4
                        rounded-2xl
                        border
                        p-4
                        text-left
                        transition
                        ${
                          active
                            ? "border-violet-400/35 bg-violet-500/[0.07]"
                            : "border-white/[0.07] bg-black/10 hover:border-white/[0.14]"
                        }
                      `}
                    >
                      <div
                        className={`
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          ${
                            active
                              ? "bg-violet-400 text-black"
                              : "bg-white/[0.05] text-zinc-400"
                          }
                        `}
                      >
                        {capability.icon}
                      </div>

                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
                        <div
                          className="
                            flex
                            items-center
                            justify-between
                            gap-3
                          "
                        >
                          <p
                            className="
                              text-sm
                              font-semibold
                              text-white
                            "
                          >
                            {
                              capability.title
                            }
                          </p>

                          <div
                            className={`
                              flex
                              h-5
                              w-5
                              shrink-0
                              items-center
                              justify-center
                              rounded-md
                              border
                              ${
                                active
                                  ? "border-violet-400 bg-violet-400 text-black"
                                  : "border-white/[0.15]"
                              }
                            `}
                          >
                            {active && (
                              <Check
                                size={13}
                                strokeWidth={3}
                              />
                            )}
                          </div>
                        </div>

                        <p
                          className="
                            mt-1
                            text-xs
                            leading-5
                            text-zinc-500
                          "
                        >
                          {
                            capability.description
                          }
                        </p>
                      </div>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {/* INSTRUCTIONS */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
              p-5
              sm:p-7
            "
          >
            <div
              className="
                mb-5
                flex
                items-start
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-violet-400/20
                  bg-violet-500/10
                  text-violet-300
                "
              >
                <Lightbulb
                  size={19}
                />
              </div>

              <div>
                <h2
                  className="
                    text-base
                    font-semibold
                  "
                >
                  Agent Instructions
                </h2>

                <p
                  className="
                    mt-1
                    text-sm
                    leading-6
                    text-zinc-500
                  "
                >
                  Define how SYRAVEN should think, respond and behave when this agent is active.
                </p>
              </div>
            </div>

            <textarea
              value={instructions}
              onChange={
                (
                  event
                ) =>
                  setInstructions(
                    event.target
                      .value
                  )
              }
              rows={10}
              placeholder={`Example:

You are an elite research agent.

Always:
• Understand the user's real goal before answering.
• Compare multiple perspectives.
• Clearly separate facts from assumptions.
• Structure complex answers clearly.
• Suggest the next useful action when appropriate.

Never invent sources or pretend to have completed an action you did not perform.`}
              className="
                w-full
                resize-y
                rounded-2xl
                border
                border-white/[0.09]
                bg-black/20
                px-4
                py-4
                font-mono
                text-[13px]
                leading-7
                text-zinc-200
                outline-none
                transition
                placeholder:text-zinc-700
                focus:border-violet-400/40
                focus:ring-4
                focus:ring-violet-500/10
              "
            />
          </div>

          {/* CONVERSATION STARTERS */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
              p-5
              sm:p-7
            "
          >
            <div
              className="
                mb-5
              "
            >
              <h2
                className="
                  text-base
                  font-semibold
                "
              >
                Conversation Starters
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-zinc-500
                "
              >
                Help users understand how they can use this agent.
              </p>
            </div>

            <div
              className="
                space-y-3
              "
            >
              {starters.map(
                (
                  starter,
                  index
                ) => (
                  <div
                    key={`${starter}-${index}`}
                    className="
                      group
                      flex
                      items-center
                      gap-3
                      rounded-xl
                      border
                      border-white/[0.07]
                      bg-black/10
                      px-3
                      py-3
                    "
                  >
                    <MessageSquare
                      size={16}
                      className="
                        shrink-0
                        text-violet-300
                      "
                    />

                    <p
                      className="
                        min-w-0
                        flex-1
                        text-sm
                        text-zinc-300
                      "
                    >
                      {starter}
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        removeStarter(
                          index
                        )
                      }
                      className="
                        rounded-lg
                        px-2
                        py-1
                        text-xs
                        text-zinc-600
                        opacity-0
                        transition
                        hover:bg-red-500/10
                        hover:text-red-300
                        group-hover:opacity-100
                      "
                    >
                      Remove
                    </button>
                  </div>
                )
              )}

              <div
                className="
                  flex
                  gap-2
                  pt-1
                "
              >
                <input
                  value={
                    starterInput
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setStarterInput(
                        event.target
                          .value
                      )
                  }
                  onKeyDown={
                    (
                      event
                    ) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        addStarter();
                      }
                    }
                  }
                  placeholder="Add a conversation starter..."
                  className="
                    h-11
                    min-w-0
                    flex-1
                    rounded-xl
                    border
                    border-white/[0.08]
                    bg-black/20
                    px-4
                    text-sm
                    outline-none
                    placeholder:text-zinc-600
                    focus:border-violet-400/40
                  "
                />

                <button
                  type="button"
                  onClick={
                    addStarter
                  }
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-xl
                    border
                    border-white/[0.09]
                    bg-white/[0.04]
                    text-zinc-300
                    transition
                    hover:bg-white/[0.08]
                    hover:text-white
                  "
                  aria-label="Add starter"
                >
                  <Plus
                    size={19}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* ADVANCED */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
            "
          >
            <button
              type="button"
              onClick={() =>
                setShowAdvanced(
                  (
                    current
                  ) =>
                    !current
                )
              }
              className="
                flex
                w-full
                items-center
                justify-between
                gap-4
                p-5
                text-left
                sm:p-7
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-white/[0.05]
                    text-zinc-400
                  "
                >
                  <Settings2
                    size={19}
                  />
                </div>

                <div>
                  <h2
                    className="
                      text-base
                      font-semibold
                    "
                  >
                    Advanced Configuration
                  </h2>

                  <p
                    className="
                      mt-1
                      text-sm
                      text-zinc-500
                    "
                  >
                    Model preferences and future execution settings.
                  </p>
                </div>
              </div>

              <ChevronDown
                size={20}
                className={`
                  shrink-0
                  text-zinc-500
                  transition-transform
                  ${
                    showAdvanced
                      ? "rotate-180"
                      : ""
                  }
                `}
              />
            </button>

            {showAdvanced && (
              <div
                className="
                  grid
                  gap-6
                  border-t
                  border-white/[0.07]
                  p-5
                  sm:p-7
                  md:grid-cols-2
                "
              >
                <label
                  className="
                    block
                  "
                >
                  <span
                    className="
                      mb-2
                      block
                      text-sm
                      font-medium
                    "
                  >
                    Model Preference
                  </span>

                  <select
                    value={model}
                    onChange={
                      (
                        event
                      ) =>
                        setModel(
                          event.target
                            .value as AgentModel
                        )
                    }
                    className="
                      h-12
                      w-full
                      rounded-xl
                      border
                      border-white/[0.09]
                      bg-[#111114]
                      px-4
                      text-sm
                      text-zinc-200
                      outline-none
                      focus:border-violet-400/40
                    "
                  >
                    <option value="auto">
                      SYRAVEN Auto — Recommended
                    </option>

                    <option value="fast">
                      Fast — Lower latency
                    </option>

                    <option value="smart">
                      Smart — Balanced intelligence
                    </option>

                    <option value="deep">
                      Deep — Maximum reasoning
                    </option>
                  </select>
                </label>

                <div
                  className="
                    rounded-2xl
                    border
                    border-violet-400/15
                    bg-violet-500/[0.04]
                    p-4
                  "
                >
                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >
                    <ShieldCheck
                      size={17}
                      className="
                        text-violet-300
                      "
                    />

                    <p
                      className="
                        text-sm
                        font-medium
                        text-violet-100
                      "
                    >
                      SYRAVEN Safety Layer
                    </p>
                  </div>

                  <p
                    className="
                      mt-2
                      text-xs
                      leading-5
                      text-zinc-500
                    "
                  >
                    External actions, account changes, purchases and other sensitive operations will require explicit user confirmation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ==================================================
         * RIGHT SIDEBAR
         * ================================================== */}

        <aside
          className="
            space-y-5
            lg:sticky
            lg:top-24
            lg:h-fit
          "
        >
          {/* PREVIEW */}

          <div
            className="
              overflow-hidden
              rounded-3xl
              border
              border-white/[0.09]
              bg-gradient-to-b
              from-white/[0.055]
              to-white/[0.018]
            "
          >
            <div
              className="
                border-b
                border-white/[0.07]
                px-5
                py-5
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >
                <div>
                  <p
                    className="
                      text-sm
                      font-semibold
                    "
                  >
                    Live Preview
                  </p>

                  <p
                    className="
                      mt-1
                      text-xs
                      text-zinc-500
                    "
                  >
                    This is how your agent will appear.
                  </p>
                </div>

                <div
                  className="
                    flex
                    h-8
                    w-8
                    items-center
                    justify-center
                    rounded-lg
                    bg-white/[0.05]
                    text-zinc-400
                  "
                >
                  <Sparkles
                    size={15}
                  />
                </div>
              </div>
            </div>

            <div
              className="
                p-5
              "
            >
              <div
                className="
                  rounded-2xl
                  border
                  border-white/[0.07]
                  bg-black/20
                  p-5
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-4
                  "
                >
                  <div
                    className="
                      flex
                      h-14
                      w-14
                      shrink-0
                      items-center
                      justify-center
                      rounded-2xl
                      border
                      border-violet-400/25
                      bg-gradient-to-br
                      from-violet-500/30
                      to-fuchsia-500/10
                      text-xl
                      font-bold
                    "
                  >
                    {avatarLetter}
                  </div>

                  <div
                    className="
                      min-w-0
                    "
                  >
                    <h3
                      className="
                        truncate
                        text-base
                        font-semibold
                      "
                    >
                      {name.trim() ||
                        "Untitled Agent"}
                    </h3>

                    <p
                      className="
                        mt-1
                        line-clamp-2
                        text-xs
                        leading-5
                        text-zinc-500
                      "
                    >
                      {description.trim() ||
                        "Your intelligent SYRAVEN agent is ready to be customized."}
                    </p>
                  </div>
                </div>

                <div
                  className="
                    mt-5
                    flex
                    flex-wrap
                    gap-2
                  "
                >
                  {selectedCapabilities.map(
                    (
                      capabilityId
                    ) => {
                      const capability =
                        capabilities.find(
                          (
                            item
                          ) =>
                            item.id ===
                            capabilityId
                        );

                      if (
                        !capability
                      ) {
                        return null;
                      }

                      return (
                        <span
                          key={
                            capabilityId
                          }
                          className="
                            rounded-full
                            border
                            border-white/[0.08]
                            bg-white/[0.04]
                            px-2.5
                            py-1
                            text-[10px]
                            font-medium
                            text-zinc-400
                          "
                        >
                          {
                            capability.title
                          }
                        </span>
                      );
                    }
                  )}
                </div>

                <button
                  type="button"
                  className="
                    mt-5
                    flex
                    h-11
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-xl
                    bg-white
                    text-sm
                    font-semibold
                    text-black
                  "
                >
                  <MessageSquare
                    size={16}
                  />

                  Start conversation
                </button>
              </div>
            </div>
          </div>

          {/* PRIVACY */}

          <div
            className="
              rounded-3xl
              border
              border-white/[0.08]
              bg-white/[0.018]
              p-5
            "
          >
            <div
              className="
                mb-4
                flex
                items-center
                gap-3
              "
            >
              <div
                className="
                  flex
                  h-10
                  w-10
                  items-center
                  justify-center
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-white/[0.04]
                  text-zinc-300
                "
              >
                <Lock
                  size={18}
                />
              </div>

              <div>
                <p
                  className="
                    text-sm
                    font-semibold
                  "
                >
                  Visibility
                </p>

                <p
                  className="
                    mt-0.5
                    text-xs
                    text-zinc-500
                  "
                >
                  Control who can use this agent.
                </p>
              </div>
            </div>

            <div
              className="
                space-y-2
              "
            >
              <button
                type="button"
                onClick={() =>
                  setVisibility(
                    "private"
                  )
                }
                className={`
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-xl
                  border
                  px-4
                  py-3
                  text-left
                  transition
                  ${
                    visibility ===
                    "private"
                      ? "border-violet-400/35 bg-violet-500/[0.08]"
                      : "border-white/[0.07] bg-black/10 hover:border-white/[0.13]"
                  }
                `}
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <Lock
                    size={16}
                    className="
                      text-zinc-400
                    "
                  />

                  <div>
                    <p
                      className="
                        text-sm
                        font-medium
                      "
                    >
                      Private
                    </p>

                    <p
                      className="
                        text-[11px]
                        text-zinc-500
                      "
                    >
                      Only you
                    </p>
                  </div>
                </div>

                {visibility ===
                  "private" && (
                  <Check
                    size={17}
                    className="
                      text-violet-300
                    "
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setVisibility(
                    "workspace"
                  )
                }
                className={`
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-xl
                  border
                  px-4
                  py-3
                  text-left
                  transition
                  ${
                    visibility ===
                    "workspace"
                      ? "border-violet-400/35 bg-violet-500/[0.08]"
                      : "border-white/[0.07] bg-black/10 hover:border-white/[0.13]"
                  }
                `}
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <UserRound
                    size={16}
                    className="
                      text-zinc-400
                    "
                  />

                  <div>
                    <p
                      className="
                        text-sm
                        font-medium
                      "
                    >
                      Workspace
                    </p>

                    <p
                      className="
                        text-[11px]
                        text-zinc-500
                      "
                    >
                      Your team
                    </p>
                  </div>
                </div>

                {visibility ===
                  "workspace" && (
                  <Check
                    size={17}
                    className="
                      text-violet-300
                    "
                  />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  setVisibility(
                    "public"
                  )
                }
                className={`
                  flex
                  w-full
                  items-center
                  justify-between
                  rounded-xl
                  border
                  px-4
                  py-3
                  text-left
                  transition
                  ${
                    visibility ===
                    "public"
                      ? "border-violet-400/35 bg-violet-500/[0.08]"
                      : "border-white/[0.07] bg-black/10 hover:border-white/[0.13]"
                  }
                `}
              >
                <div
                  className="
                    flex
                    items-center
                    gap-3
                  "
                >
                  <Globe2
                    size={16}
                    className="
                      text-zinc-400
                    "
                  />

                  <div>
                    <p
                      className="
                        text-sm
                        font-medium
                      "
                    >
                      Public
                    </p>

                    <p
                      className="
                        text-[11px]
                        text-zinc-500
                      "
                    >
                      Marketplace ready
                    </p>
                  </div>
                </div>

                {visibility ===
                  "public" && (
                  <Check
                    size={17}
                    className="
                      text-violet-300
                    "
                  />
                )}
              </button>
            </div>
          </div>

          {/* PREMIUM NOTE */}

          <div
            className="
              rounded-3xl
              border
              border-violet-400/15
              bg-gradient-to-br
              from-violet-500/[0.10]
              via-fuchsia-500/[0.04]
              to-transparent
              p-5
            "
          >
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <Crown
                size={17}
                className="
                  text-violet-300
                "
              />

              <p
                className="
                  text-sm
                  font-semibold
                  text-violet-100
                "
              >
                SYRAVEN Agent System
              </p>
            </div>

            <p
              className="
                mt-3
                text-xs
                leading-6
                text-zinc-400
              "
            >
              Every agent is designed to work as part of the wider SYRAVEN ecosystem: Chat, Workspace, Knowledge, Tasks, Apps and future connected services.
            </p>
          </div>

          {/* CREATE */}

          <button
            type="button"
            disabled={
              !name.trim() ||
              isCreating
            }
            onClick={
              createAgent
            }
            className="
              flex
              h-14
              w-full
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-gradient-to-r
              from-white
              to-zinc-200
              text-sm
              font-bold
              text-black
              shadow-[0_12px_50px_rgba(255,255,255,0.08)]
              transition
              hover:scale-[1.01]
              hover:shadow-[0_18px_60px_rgba(255,255,255,0.12)]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {isCreating ? (
              <>
                <Loader2
                  size={18}
                  className="
                    animate-spin
                  "
                />

                Creating Agent...
              </>
            ) : (
              <>
                <Save
                  size={18}
                />

                Create Agent
              </>
            )}
          </button>
        </aside>
      </div>
    </main>
  );
}