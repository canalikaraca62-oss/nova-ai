type MessageProps = {
  sender: "user" | "nova";
  text: string;
};

export default function Message({ sender, text }: MessageProps) {
  const isUser = sender === "user";

  return (
    <div
      className={`flex mb-4 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-zinc-800 text-white"
        }`}
      >
        <p className="text-sm opacity-70 mb-1">
          {isUser ? "👤 Sen" : "🤖 NOVA"}
        </p>

        <p>{text}</p>
      </div>
    </div>
  );
}