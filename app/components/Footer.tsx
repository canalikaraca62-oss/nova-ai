import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[600px] -translate-x-1/2 rounded-full bg-blue-500/[0.04] blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6 py-16 sm:px-8 sm:py-20">
        {/* Top */}
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="max-w-sm">
            <Link
              href="/"
              className="text-2xl font-bold tracking-widest"
            >
              QELVORA
            </Link>

            <p className="mt-5 text-sm leading-7 text-zinc-500">
              An intelligent workspace for conversation,
              knowledge, documents, memory and powerful AI tools.
            </p>

            <div className="mt-6 flex items-center gap-2 text-xs text-zinc-600">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />

              <span>QELVORA is online</span>
            </div>
          </div>

          {/* Product */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Product
            </h3>

            <div className="mt-5 flex flex-col gap-3 text-sm">
              <Link
                href="/#features"
                className="text-zinc-500 transition hover:text-white"
              >
                Features
              </Link>

              <Link
                href="/chat"
                className="text-zinc-500 transition hover:text-white"
              >
                AI Chat
              </Link>

              <Link
                href="/memory"
                className="text-zinc-500 transition hover:text-white"
              >
                Memory
              </Link>

              <Link
                href="/settings"
                className="text-zinc-500 transition hover:text-white"
              >
                Settings
              </Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Company
            </h3>

            <div className="mt-5 flex flex-col gap-3 text-sm">
              <Link
                href="/"
                className="text-zinc-500 transition hover:text-white"
              >
                About
              </Link>

              <Link
                href="/#features"
                className="text-zinc-500 transition hover:text-white"
              >
                Product
              </Link>

              <Link
                href="mailto:support@qelvora.com"
                className="text-zinc-500 transition hover:text-white"
              >
                Contact
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold text-white">
              Legal
            </h3>

            <div className="mt-5 flex flex-col gap-3 text-sm">
              <Link
                href="/privacy"
                className="text-zinc-500 transition hover:text-white"
              >
                Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="text-zinc-500 transition hover:text-white"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-12 h-px w-full bg-white/10" />

        {/* Bottom */}
        <div className="flex flex-col gap-4 text-xs text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} QELVORA. All rights reserved.
          </p>

          <p>
            Intelligence without boundaries.
          </p>
        </div>
      </div>
    </footer>
  );
}