"use client";

import { useParams } from "next/navigation";

export default function ChatDetailPage() {
  const params = useParams();

  const chatId = params.id;

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-3xl font-bold">
        NOVA Chat
      </h1>

      <p className="mt-4 text-zinc-400">
        Sohbet ID: {chatId}
      </p>
    </div>
  );
}