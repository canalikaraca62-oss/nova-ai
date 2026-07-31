export default function Features() {
  return (
    <section className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto px-8 py-24">

      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 hover:scale-105 hover:border-blue-500 transition duration-300">
        <h3 className="text-2xl font-bold mb-4">🤖 AI Chat</h3>

        <p className="text-gray-400">
          Chat with the world's most powerful AI models.
        </p>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 hover:scale-105 hover:border-blue-500 transition duration-300">
        <h3 className="text-2xl font-bold mb-4">📄 Documents</h3>

        <p className="text-gray-400">
          Upload PDFs and let NOVA analyze them instantly.
        </p>
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-8 hover:scale-105 hover:border-blue-500 transition duration-300">
        <h3 className="text-2xl font-bold mb-4">🎤 Voice AI</h3>

        <p className="text-gray-400">
          Talk naturally with your AI assistant.
        </p>
      </div>

    </section>
  );
}