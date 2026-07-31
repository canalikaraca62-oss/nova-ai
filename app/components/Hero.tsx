export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center mt-32 px-6">

      <div className="mb-6 rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-300">
        🚀 Powered by NOVA AI
      </div>

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
  );
}