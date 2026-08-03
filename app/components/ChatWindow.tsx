import Message from "./Message";

type MessageType = {
  sender: "user" | "nova";
  text: string;
};

type ChatWindowProps = {
  messages: MessageType[];
};

export default function ChatWindow({ messages }: ChatWindowProps) {
  return (
    <div className="flex-1 w-full max-w-4xl mx-auto bg-zinc-900 rounded-xl p-6 mb-6 overflow-y-auto">
      {messages.map((msg, index) => (
        <Message
          key={index}
          sender={msg.sender}
          text={msg.text}
        />
      ))}
    </div>
  );
}