type ChatInputProps = {
  input: string;
  setInput: (value: string) => void;
  sendMessage: () => void;
};

export default function ChatInput({
  input,
  setInput,
  sendMessage,
}: ChatInputProps) {
  return (
    <div className="flex gap-3 w-full max-w-4xl mx-auto">
      <input
        className="flex-1 p-4 rounded-xl bg-zinc-800 text-white border border-zinc-700 outline-none focus:border-blue-500"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="NOVA'ya mesaj yaz..."
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            sendMessage();
          }
        }}
      />

      <button
        onClick={sendMessage}
        className="bg-blue-600 hover:bg-blue-700 transition px-6 rounded-xl"
      >
        Gönder
      </button>
    </div>
  );
}