export default function Features() {
  const features = [
    {
      icon: "✦",
      title: "Intelligent AI Chat",
      description:
        "Ask questions, explore ideas and work through complex tasks with QELVORA in one continuous conversation.",
      accent: "from-blue-500/[0.08]",
      preview: (
        <>
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-emerald-400" />

            <span className="text-sm text-zinc-400">
              QELVORA Intelligence
            </span>
          </div>

          <div className="mt-4 h-2 w-3/4 rounded-full bg-white/10" />

          <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
        </>
      ),
    },

    {
      icon: "◫",
      title: "File Intelligence",
      description:
        "Upload files and use AI to explore, understand and work with the information inside them.",
      accent: "from-purple-500/[0.08]",
      preview: (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-zinc-300">
              Research.pdf
            </span>

            <span className="shrink-0 text-xs text-emerald-400">
              Ready
            </span>
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
          </div>
        </>
      ),
    },

    {
      icon: "◉",
      title: "Persistent Memory",
      description:
        "Save important information and preferences so QELVORA can use relevant context across conversations.",
      accent: "from-cyan-500/[0.08]",
      preview: (
        <>
          <div className="text-xs uppercase tracking-widest text-zinc-600">
            Memory
          </div>

          <div className="mt-3 text-sm leading-6 text-zinc-300">
            Important user context is available when needed.
          </div>

          <div className="mt-3 text-xs text-emerald-400">
            ● Remembered
          </div>
        </>
      ),
    },

    {
      icon: "⚡",
      title: "Real-Time Responses",
      description:
        "Watch responses appear as they are generated for a faster and more natural conversation experience.",
      accent: "from-amber-500/[0.07]",
      preview: (
        <>
          <div className="flex items-center gap-2 text-sm text-zinc-300">
            <span>QELVORA is thinking</span>

            <span className="animate-pulse">
              ...
            </span>
          </div>

          <div className="mt-4 flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/60" />

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/40 [animation-delay:150ms]" />

            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/20 [animation-delay:300ms]" />
          </div>
        </>
      ),
    },

    {
      icon: "☷",
      title: "Your Conversations",
      description:
        "Create new chats, revisit previous conversations, rename them and keep your workspace organized.",
      accent: "from-indigo-500/[0.08]",
      preview: (
        <div className="space-y-2">
          <div className="rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-zinc-300">
            ✦ New conversation
          </div>

          <div className="px-3 text-xs text-zinc-500">
            Product strategy
          </div>

          <div className="px-3 text-xs text-zinc-600">
            Website ideas
          </div>
        </div>
      ),
    },

    {
      icon: "⌘",
      title: "One Workspace",
      description:
        "Keep conversations, files and remembered information together in one simple AI workspace.",
      accent: "from-emerald-500/[0.07]",
      preview: (
        <div className="flex gap-2">
          <div className="flex h-8 flex-1 items-center rounded-lg bg-white/[0.06] px-3 text-[10px] text-zinc-500">
            Chat
          </div>

          <div className="flex h-8 w-14 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] text-zinc-500">
            Files
          </div>

          <div className="flex h-8 w-12 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] text-zinc-500">
            Memory
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      id="features"
      className="relative overflow-hidden bg-black px-4 py-24 text-white sm:px-6 sm:py-32"
    >
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px] sm:h-96 sm:w-96 sm:blur-[140px]" />

      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[120px] sm:h-96 sm:w-96 sm:blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl">

        {/* HEADER */}
        <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

            <span>Built for your AI workflow</span>
          </div>

          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            More than a conversation.
            <br />

            <span className="text-zinc-500">
              Your AI workspace.
            </span>
          </h2>

          <p className="mt-6 text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            QELVORA brings intelligent conversations, files,
            memory and your conversation history together
            in one seamless workspace.
          </p>
        </div>

        {/* FEATURE GRID */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition duration-500 hover:-translate-y-1 hover:border-white/20 sm:p-8"
            >
              {/* HOVER GLOW */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.accent} via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100`}
              />

              <div className="relative">

                {/* ICON */}
                <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-zinc-200">
                  {feature.icon}
                </div>

                {/* TITLE */}
                <h3 className="text-2xl font-semibold tracking-tight">
                  {feature.title}
                </h3>

                {/* DESCRIPTION */}
                <p className="mt-3 leading-7 text-zinc-400">
                  {feature.description}
                </p>

                {/* PREVIEW */}
                <div className="mt-8 min-h-[80px] rounded-2xl border border-white/10 bg-black/40 p-4">
                  {feature.preview}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* BOTTOM CTA */}
        <div className="mt-20 text-center sm:mt-24">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-600 sm:text-sm sm:tracking-[0.3em]">
            Intelligence that remembers your journey
          </p>

          <div className="mx-auto mt-6 h-px max-w-xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
    </section>
  );
}