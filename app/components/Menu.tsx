export default function Sidebar() {
  const chats = [
    "NOVA Tanışma",
    "React Projesi",
    "İş Planı",
    "Yatırım Sunumu",
    "Yapay Zeka Fikirleri",
  ];

  return (
    <aside className="w-72 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-2xl font-bold text-white">🚀 NOVA</h1>
        <p className="text-zinc-400 text-sm">
          Artificial Intelligence
        </p>
      </div>

      {/* Yeni Sohbet */}
      <div className="p-4">
        <button className="w-full bg-blue-600 hover:bg-blue-700 transition py-3 rounded-xl font-semibold">
          ➕ Yeni Sohbet
        </button>
      </div>

      {/* Sohbet Geçmişi */}
      <div className="flex-1 overflow-y-auto px-4">
        <p className="text-xs text-zinc-500 uppercase mb-3 tracking-wider">
          Son Sohbetler
        </p>

        <div className="space-y-2">
          {chats.map((chat, index) => (
            <button
              key={index}
              className="w-full text-left bg-zinc-800 hover:bg-zinc-700 transition p-3 rounded-xl text-white"
            >
              💬 {chat}
            </button>
          ))}
        </div>
      </div>

      {/* Alt Menü */}
      <div className="border-t border-zinc-800 p-4 space-y-2">
        <button className="w-full text-left text-zinc-300 hover:text-white transition">
          ⚙️ Ayarlar
        </button>

        <button className="w-full text-left text-zinc-300 hover:text-white transition">
          👤 Profil
        </button>
      </div>
    </aside>
  );
}