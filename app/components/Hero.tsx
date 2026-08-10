import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">

      <div className="absolute -top-40 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl"></div>
      <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl"></div>

      <div className="relative z-10">

        <div className="mb-6 inline-block rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm text-gray-300 backdrop-blur-md">
          🚀 Powered by QELVORA AI
        </div>

        <h1 className="text-6xl font-extrabold leading-tight md:text-8xl">
          The Future
          <br />
          of AI
        </h1>

        <p className="mx-auto mt-8 max-w-2xl text-lg text-gray-400 md:text-xl">
          Chat with multiple AI models, analyze documents,
          generate images, write code and boost your productivity
          in one powerful workspace.
        </p>

        <div className="mt-12 flex flex-col gap-4 sm:flex-row sm:justify-center">

          <Link
            href="/register"
            className="rounded-xl bg-white px-8 py-4 font-bold text-black transition hover:scale-105"
          >
            Get Started
          </Link>

          <a
            href="#features"
            className="rounded-xl border border-white/20 bg-white/5 px-8 py-4 font-bold backdrop-blur-md transition hover:bg-white/10"
          >
            Learn More
          </a>

        </div>

      </div>

    </section>
  );
}