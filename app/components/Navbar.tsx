import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full flex justify-between items-center px-8 py-5 bg-white/5 backdrop-blur-md border-b border-white/10 z-50">
      <Link
        href="/"
        className="text-3xl font-bold tracking-widest text-white"
      >
        QELVORA
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href="/register"
          className="px-5 py-2 rounded-xl border border-white/20 text-white font-semibold hover:bg-white/10 transition duration-300"
        >
          Register
        </Link>

        <Link
          href="/login"
          className="px-5 py-2 rounded-xl bg-white text-black font-semibold hover:scale-105 transition duration-300"
        >
          Login
        </Link>
      </div>
    </nav>
  );
}