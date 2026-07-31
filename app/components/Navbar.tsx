export default function Navbar() {
  return (
    <nav className="flex justify-between items-center px-8 py-6">
      <h1 className="text-3xl font-bold tracking-widest">
        NOVA
      </h1>

      <button className="border border-white px-5 py-2 rounded-lg hover:bg-white hover:text-black transition">
        Login
      </button>
    </nav>
  );
}