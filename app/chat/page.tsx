export default function ChatPage() {
  return (
    <main className="min-h-screen bg-black text-white flex">

      <aside className="w-72 border-r border-white/10 p-6">
        <h2 className="text-2xl font-bold mb-6">NOVA</h2>

        <button className="w-full rounded-xl bg-white text-black py-3 font-bold">
          + New Chat
        </button>

        <div className="mt-8 text-gray-400">
          No conversations yet.
        </div>
      </aside>

      <section className="flex-1 flex flex-col">

        <div className="flex-1 flex items-center justify-center">
          <h1 className="text-5xl font-bold">
            Welcome to NOVA AI
          </h1>
        </div>

        <div className="border-t border-white/10 p-6">
          <input
            type="text"
            placeholder="Message NOVA..."
            className="w-full rounded-xl bg-white/10 p-4 outline-none"
          />
        </div>

      </section>

    </main>
  );
}