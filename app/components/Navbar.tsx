import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
        
        {/* LOGO */}
        <Link
          href="/"
          className="group flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sm font-black text-black transition duration-300 group-hover:scale-110 sm:h-10 sm:w-10">
            Q
          </div>

          <span className="text-xl font-bold tracking-[0.18em] text-white sm:text-2xl">
            SYRAVEN
          </span>
        </Link>

        {/* DESKTOP MENU */}
        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="#features"
            className="text-sm text-zinc-400 transition hover:text-white"
          >
            Features
          </Link>

          <Link
            href="/login"
            className="text-sm font-medium text-zinc-300 transition hover:text-white"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-zinc-200"
          >
            Get Started
          </Link>
        </div>

        {/* MOBILE BUTTONS */}
        <div className="flex items-center gap-2 md:hidden">
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-medium text-zinc-300"
          >
            Login
          </Link>

          <Link
            href="/register"
            className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-black transition active:scale-95"
          >
            Start
          </Link>
        </div>

      </div>
    </nav>
  );
}