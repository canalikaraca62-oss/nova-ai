export default function Features() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-black px-6 py-32 text-white"
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/4 top-0 h-96 w-96 rounded-full bg-blue-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-1/4 bottom-0 h-96 w-96 rounded-full bg-purple-500/10 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-7xl">

        {/* Header */}
        <div className="mx-auto mb-20 max-w-3xl text-center">

          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-zinc-400 backdrop-blur-xl">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            One intelligent workspace
          </div>

          <h2 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
            Everything you need.
            <br />
            <span className="text-zinc-500">
              One intelligent workspace.
            </span>
          </h2>

          <p className="mt-6 text-lg leading-8 text-zinc-400">
            QELVORA brings conversation, knowledge, memory,
            documents and powerful AI tools together in one
            seamless environment.
          </p>

        </div>

        {/* Feature grid */}
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">

          {/* AI Chat */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.08] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                ✦
              </div>

              <h3 className="text-2xl font-semibold">
                AI Chat
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Work with advanced AI models through one
                intelligent conversation interface.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm text-zinc-400">
                    QELVORA Intelligence
                  </span>
                </div>

                <div className="mt-4 h-2 w-3/4 rounded-full bg-white/10" />
                <div className="mt-2 h-2 w-1/2 rounded-full bg-white/5" />
              </div>

            </div>
          </div>

          {/* Documents */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.08] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                ◫
              </div>

              <h3 className="text-2xl font-semibold">
                Document Intelligence
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Upload documents and turn large amounts of
                information into useful answers and insights.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-4">

                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-300">
                    Research.pdf
                  </span>

                  <span className="text-xs text-emerald-400">
                    Analyzed
                  </span>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500" />
                </div>

              </div>

            </div>
          </div>

          {/* Memory */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/[0.08] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                ◉
              </div>

              <h3 className="text-2xl font-semibold">
                Persistent Memory
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                QELVORA can remember important context and
                preferences across conversations.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-4">

                <div className="text-xs uppercase tracking-widest text-zinc-600">
                  Memory
                </div>

                <div className="mt-3 text-sm text-zinc-300">
                  User prefers concise technical answers.
                </div>

                <div className="mt-3 text-xs text-emerald-400">
                  ● Remembered
                </div>

              </div>

            </div>
          </div>

          {/* Coding */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.07] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
  {"</>"}
</div>

              <h3 className="text-2xl font-semibold">
                AI Coding
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Build, debug and understand software with
                intelligent coding assistance.
              </p>

              <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-4 font-mono text-xs">
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

            </div>
          </div>

          {/* Voice */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-pink-500/[0.07] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                ◌
              </div>

              <h3 className="text-2xl font-semibold">
                Voice AI
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Interact naturally with your AI workspace
                through voice.
              </p>

              <div className="mt-8 flex h-20 items-center justify-center gap-1 rounded-2xl border border-white/10 bg-black/40">
                {[20, 35, 50, 70, 40, 65, 30, 55, 25].map(
                  (height, index) => (
                    <div
                      key={index}
                      className="w-1 rounded-full bg-zinc-500"
                      style={{ height: `${height}%` }}
                    />
                  )
                )}
              </div>

            </div>
          </div>

          {/* Workspace */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-8 transition duration-500 hover:-translate-y-1 hover:border-white/20">

            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.08] via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />

            <div className="relative">

              <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
                ⌘
              </div>

              <h3 className="text-2xl font-semibold">
                One Workspace
              </h3>

              <p className="mt-3 leading-7 text-zinc-400">
                Keep conversations, files, knowledge and
                intelligent tools together in one place.
              </p>

              <div className="mt-8 flex gap-2 rounded-2xl border border-white/10 bg-black/40 p-4">

                <div className="h-8 flex-1 rounded-lg bg-white/[0.06]" />
                <div className="h-8 w-12 rounded-lg bg-white/[0.06]" />
                <div className="h-8 w-8 rounded-lg bg-white/[0.06]" />

              </div>

            </div>
          </div>

        </div>

        {/* Bottom statement */}
        <div className="mt-24 text-center">

          <p className="text-sm uppercase tracking-[0.3em] text-zinc-600">
            Intelligence without boundaries
          </p>

          <div className="mx-auto mt-6 h-px max-w-xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        </div>

      </div>
    </section>
  );
}