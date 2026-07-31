export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">

      <nav className="flex justify-between items-center px-8 py-6">

        <h1 className="text-3xl font-bold tracking-widest">
          NOVA
        </h1>

        <button className="border border-white px-5 py-2 rounded-lg hover:bg-white hover:text-black transition">
          Login
        </button>

      </nav>

      <section className="flex flex-col items-center justify-center text-center mt-32 px-6">

        <h2 className="text-6xl font-bold">
          The Future of AI
        </h2>

        <p className="text-gray-400 mt-6 text-xl max-w-xl">
          One workspace.
          Every AI.
          Everything you need.
        </p>

        <button className="mt-10 bg-white text-black px-8 py-4 rounded-xl font-bold hover:scale-105 transition">
          Get Started
        </button>

      </section>

    </main>
  );
}