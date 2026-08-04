"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

export type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

type ChatContextType = {
  messages: ChatMessage[];
  setMessages: React.Dispatch<
    React.SetStateAction<ChatMessage[]>
  >;
};

const ChatContext = createContext<
  ChatContextType | undefined
>(undefined);

export function ChatProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);

  if (!context) {
    throw new Error(
      "useChat must be used inside ChatProvider"
    );
  }

  return context;
}