import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[140px]" />

        <div className="absolute right-[-180px] top-[35%] h-[520px] w-[520px] rounded-full bg-purple-600/10 blur-[150px]" />

        <div className="absolute left-[-180px] bottom-[-150px] h-[420px] w-[420px] rounded-full bg-cyan-500/5 blur-[130px]" />
      </div>

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center px-6 pt-36 text-center">
        {/* Eyebrow */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300 shadow-[0_0_30px_rgba(255,255,255,0.03)] backdrop-blur-xl">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />

          The intelligent workspace for the future
        </div>

        {/* Main headline */}
        <h1 className="max-w-5xl text-5xl font-semibold tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[88px] lg:leading-[0.98]">
          One workspace.
          <br />

          <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Limitless intelligence.
          </span>
        </h1>

        {/* Description */}
        <p className="mt-8 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          QELVORA brings AI chat, document intelligence, persistent
          memory, coding and powerful AI tools into one elegant workspace.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link
            href="/register"
            className="group inline-flex items-center justify-center rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.08)] transition duration-300 hover:scale-[1.03] hover:bg-zinc-100"
          >
            Start for free

            <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>

          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-xl transition duration-300 hover:border-white/20 hover:bg-white/[0.07]"
          >
            Explore QELVORA
          </a>
        </div>

        {/* Trust line */}
        <div className="mt-5 text-xs text-zinc-600">
          No credit card required · Start in seconds
        </div>

        {/* Product preview */}
        <div className="relative mt-20 w-full max-w-6xl">
          {/* Glow behind product */}
          <div className="absolute left-1/2 top-1/2 h-[260px] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[100px]" />

          {/* Browser frame */}
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/90 text-left shadow-[0_30px_100px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
            {/* Browser top */}
            <div className="flex h-12 items-center border-b border-white/10 bg-white/[0.025] px-4">
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
              </div>

              <div className="mx-auto rounded-md border border-white/5 bg-white/[0.03] px-20 py-1 text-[10px] text-zinc-600">
                app.qelvora.ai
              </div>
            </div>

            {/* Product */}
            <div className="grid min-h-[430px] grid-cols-[190px_1fr]">
              {/* Sidebar */}
              <div className="border-r border-white/10 bg-white/[0.015] p-4">
                <div className="mb-8 text-sm font-bold tracking-[0.2em]">
                  QELVORA
                </div>

                <div className="space-y-2 text-xs">
                  <div className="rounded-lg bg-white/[0.07] px-3 py-2.5 text-white">
                    ✦ New conversation
                  </div>

                  <div className="px-3 py-2 text-zinc-600">
                    Recent chats
                  </div>

                  <div className="px-3 py-2 text-zinc-500">
                    Product strategy
                  </div>

                  <div className="px-3 py-2 text-zinc-500">
                    Website architecture
                  </div>

                  <div className="px-3 py-2 text-zinc-500">
                    Market research
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                  <div>
                    <p className="text-sm font-medium">
                      New conversation
                    </p>

                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      QELVORA Intelligence
                    </p>
                  </div>

                  <div className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] text-zinc-500">
                    AI Workspace
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-center px-8 py-10">
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="mb-8">
                      <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                        QELVORA
                      </p>

                      <h2 className="mt-3 text-2xl font-medium tracking-tight text-zinc-200">
                        What are you building today?
                      </h2>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-zinc-600">
                          Ask anything...
                        </span>

                        <span className="rounded-lg bg-white px-3 py-1.5 text-[10px] font-semibold text-black">
                          Send
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom spacing */}
        <div className="h-28" />
      </div>
    </section>
  );
}