export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 w-full flex justify-between items-center px-8 py-5 bg-white/5 backdrop-blur-md border-b border-white/10">
      <h1 className="text-3xl font-bold tracking-widest text-white">
        NOVA
      </h1>

      <button className="px-5 py-2 rounded-xl bg-white text-black font-semibold hover:scale-105 transition duration-300">
        Login
      </button>
    </nav>
  );
}