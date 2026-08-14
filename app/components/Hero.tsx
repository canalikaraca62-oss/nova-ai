import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-black text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-220px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[120px] sm:h-[520px] sm:w-[520px] sm:blur-[140px]" />

        <div className="absolute right-[-180px] top-[35%] h-[420px] w-[420px] rounded-full bg-purple-600/10 blur-[130px] sm:h-[520px] sm:w-[520px] sm:blur-[150px]" />

        <div className="absolute bottom-[-150px] left-[-180px] h-[360px] w-[360px] rounded-full bg-cyan-500/5 blur-[110px] sm:h-[420px] sm:w-[420px] sm:blur-[130px]" />
      </div>

      {/* Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col items-center px-4 pt-28 text-center sm:px-6 sm:pt-36">
        {/* Eyebrow */}
        <div className="mb-6 inline-flex max-w-[calc(100vw-32px)] items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-zinc-300 shadow-[0_0_30px_rgba(255,255,255,0.03)] backdrop-blur-xl sm:mb-8 sm:px-4 sm:text-sm">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />

          <span className="truncate">
            The intelligent workspace for the future
          </span>
        </div>

        {/* Main headline */}
        <h1 className="w-full max-w-5xl text-[44px] font-semibold leading-[0.98] tracking-[-0.045em] sm:text-6xl md:text-7xl lg:text-[88px]">
          One workspace.
          <br />

          <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Limitless intelligence.
          </span>
        </h1>

        {/* Description */}
        <p className="mt-6 w-full max-w-2xl px-2 text-sm leading-6 text-zinc-400 sm:mt-8 sm:text-lg sm:leading-7">
          QELVORA brings AI chat, document intelligence, persistent memory,
          coding and powerful AI tools into one elegant workspace.
        </p>

        {/* CTA */}
        <div className="mt-8 flex w-full flex-col items-center gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:gap-4">
          <Link
            href="/register"
            className="group inline-flex w-full items-center justify-center rounded-xl bg-white px-7 py-3.5 text-sm font-semibold text-black shadow-[0_0_40px_rgba(255,255,255,0.08)] transition duration-300 hover:scale-[1.03] hover:bg-zinc-100 sm:w-auto"
          >
            Start for free

            <span className="ml-2 transition-transform duration-300 group-hover:translate-x-1">
              →
            </span>
          </Link>

          <a
            href="#features"
            className="inline-flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-xl transition duration-300 hover:border-white/20 hover:bg-white/[0.07] sm:w-auto"
          >
            Explore QELVORA
          </a>
        </div>

        {/* Trust line */}
        <div className="mt-4 text-[11px] text-zinc-600 sm:text-xs">
          No credit card required · Start in seconds
        </div>

        {/* Product preview */}
        <div className="relative mt-14 w-full max-w-6xl sm:mt-20">
          {/* Glow */}
          <div className="absolute left-1/2 top-1/2 h-[180px] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[80px] sm:h-[260px] sm:blur-[100px]" />

          {/* Browser */}
          <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-950/90 text-left shadow-[0_30px_100px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:rounded-2xl">
            {/* Browser top */}
            <div className="flex h-10 items-center border-b border-white/10 bg-white/[0.025] px-3 sm:h-12 sm:px-4">
              <div className="flex shrink-0 gap-1.5">
                <span className="h-2 w-2 rounded-full bg-zinc-700 sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-zinc-700 sm:h-2.5 sm:w-2.5" />
                <span className="h-2 w-2 rounded-full bg-zinc-700 sm:h-2.5 sm:w-2.5" />
              </div>

              <div className="mx-auto max-w-[150px] truncate rounded-md border border-white/5 bg-white/[0.03] px-4 py-1 text-[8px] text-zinc-600 sm:max-w-none sm:px-20 sm:text-[10px]">
                app.qelvora.ai
              </div>
            </div>

            {/* Product */}
            <div className="grid min-h-[300px] grid-cols-[85px_1fr] sm:min-h-[430px] sm:grid-cols-[190px_1fr]">
              {/* Sidebar */}
              <div className="border-r border-white/10 bg-white/[0.015] p-2 sm:p-4">
                <div className="mb-5 truncate text-[9px] font-bold tracking-[0.18em] sm:mb-8 sm:text-sm">
                  QELVORA
                </div>

                <div className="space-y-1 text-[8px] sm:space-y-2 sm:text-xs">
                  <div className="truncate rounded-lg bg-white/[0.07] px-2 py-2 text-white sm:px-3 sm:py-2.5">
                    ✦ New conversation
                  </div>

                  <div className="truncate px-2 py-1.5 text-zinc-600 sm:px-3 sm:py-2">
                    Recent chats
                  </div>

                  <div className="truncate px-2 py-1.5 text-zinc-500 sm:px-3 sm:py-2">
                    Product strategy
                  </div>

                  <div className="truncate px-2 py-1.5 text-zinc-500 sm:px-3 sm:py-2">
                    Website architecture
                  </div>

                  <div className="truncate px-2 py-1.5 text-zinc-500 sm:px-3 sm:py-2">
                    Market research
                  </div>
                </div>
              </div>

              {/* Chat */}
              <div className="flex min-w-0 flex-col">
                <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-3 sm:px-6 sm:py-4">
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-medium sm:text-sm">
                      New conversation
                    </p>

                    <p className="mt-0.5 truncate text-[8px] text-zinc-600 sm:text-[11px]">
                      QELVORA Intelligence
                    </p>
                  </div>

                  <div className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[7px] text-zinc-500 sm:px-3 sm:py-1.5 sm:text-[10px]">
                    AI Workspace
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-center px-3 py-6 sm:px-8 sm:py-10">
                  <div className="mx-auto w-full max-w-2xl">
                    <div className="mb-5 sm:mb-8">
                      <p className="text-[8px] uppercase tracking-[0.18em] text-zinc-600 sm:text-xs sm:tracking-[0.2em]">
                        QELVORA
                      </p>

                      <h2 className="mt-2 text-base font-medium tracking-tight text-zinc-200 sm:mt-3 sm:text-2xl">
                        What are you building today?
                      </h2>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.025] p-2.5 shadow-inner sm:rounded-xl sm:p-4">
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate text-[8px] text-zinc-600 sm:text-xs">
                          Ask anything...
                        </span>

                        <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-[8px] font-semibold text-black sm:px-3 sm:py-1.5 sm:text-[10px]">
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
        <div className="h-20 sm:h-28" />
      </div>
    </section>
  );
}