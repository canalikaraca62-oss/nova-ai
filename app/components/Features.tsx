export default function Features() {
  const features = [
    {
      icon: "✦",
      title: "AI Chat",
      description:
        "Work with advanced AI models through one intelligent conversation interface.",
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
      title: "Document Intelligence",
      description:
        "Upload documents and turn large amounts of information into useful answers and insights.",
      accent: "from-purple-500/[0.08]",
      preview: (
        <>
          <div className="flex items-center justify-between gap-3">
            <span className="truncate text-sm text-zinc-300">
              Research.pdf
            </span>

            <span className="shrink-0 text-xs text-emerald-400">
              Analyzed
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
        "QELVORA can remember important context and preferences across conversations.",
      accent: "from-cyan-500/[0.08]",
      preview: (
        <>
          <div className="text-xs uppercase tracking-widest text-zinc-600">
            Memory
          </div>

          <div className="mt-3 text-sm leading-6 text-zinc-300">
            User prefers concise technical answers.
          </div>

          <div className="mt-3 text-xs text-emerald-400">
            ● Remembered
          </div>
        </>
      ),
    },

    {
      icon: "</>",
      title: "AI Coding",
      description:
        "Build, debug and understand software with intelligent coding assistance.",
      accent: "from-emerald-500/[0.07]",
      preview: (
        <div className="font-mono text-xs">
          <div className="text-purple-400">
            const
            <span className="text-zinc-300"> workspace </span>
            =
            <span className="text-blue-400"> QELVORA</span>
          </div>

          <div className="mt-2 text-zinc-600">
            // build something extraordinary
          </div>
        </div>
      ),
    },

    {
      icon: "◌",
      title: "Voice AI",
      description:
        "Interact naturally with your AI workspace through voice.",
      accent: "from-pink-500/[0.07]",
      preview: (
        <div className="flex h-20 items-center justify-center gap-1">
          {[20, 35, 50, 70, 40, 65, 30, 55, 25].map(
            (height, index) => (
              <div
                key={index}
                className="w-1 rounded-full bg-zinc-500"
                style={{
                  height: `${height}%`,
                }}
              />
            )
          )}
        </div>
      ),
    },

    {
      icon: "⌘",
      title: "One Workspace",
      description:
        "Keep conversations, files, knowledge and intelligent tools together in one place.",
      accent: "from-indigo-500/[0.08]",
      preview: (
        <div className="flex gap-2">
          <div className="h-8 flex-1 rounded-lg bg-white/[0.06]" />
          <div className="h-8 w-12 rounded-lg bg-white/[0.06]" />
          <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />
        </div>
      ),
    },
  ];

  return (
    <section
      id="features"
      className="relative overflow-hidden bg-black px-4 py-24 text-white sm:px-6 sm:py-32"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-72 w-72 rounded-full bg-blue-500/10 blur-[120px] sm:h-96 sm:w-96 sm:blur-[140px]" />

      <div className="pointer-events-none absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-purple-500/10 blur-[120px] sm:h-96 sm:w-96 sm:blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl">
        {/* Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center sm:mb-20">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />

            <span>One intelligent workspace</span>
          </div>

          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Everything you need.
            <br />

            <span className="text-zinc-500">
              One intelligent workspace.
            </span>
          </h2>

          <p className="mt-6 text-base leading-7 text-zinc-400 sm:text-lg sm:leading-8">
            QELVORA brings conversation, knowledge, memory,
            documents and powerful AI tools together in one
            seamless environment.
          </p>
        </div>

        {/* Feature grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition duration-500 hover:-translate-y-1 hover:border-white/20 sm:p-8"
            >
              {/* Hover glow */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${feature.accent} via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100`}
              />

              <div className="relative">
                {/* Icon */}
                <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl text-zinc-200">
                  {feature.icon}
                </div>

                {/* Title */}
                <h3 className="text-2xl font-semibold tracking-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="mt-3 leading-7 text-zinc-400">
                  {feature.description}
                </p>

                {/* Preview */}
                <div className="mt-8 min-h-[80px] rounded-2xl border border-white/10 bg-black/40 p-4">
                  {feature.preview}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom statement */}
        <div className="mt-20 text-center sm:mt-24">
          <p className="text-xs uppercase tracking-[0.25em] text-zinc-600 sm:text-sm sm:tracking-[0.3em]">
            Intelligence without boundaries
          </p>

          <div className="mx-auto mt-6 h-px max-w-xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
    </section>
  );
}