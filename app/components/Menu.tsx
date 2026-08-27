"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import {
  Brain,
  ChevronRight,
  Clock3,
  Menu as MenuIcon,
  MessageSquarePlus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type MenuProps = {
  open: boolean;
  onClose: () => void;
};

type Conversation = {
  id: string;
  title: string | null;
  created_at: string;
};

export default function Menu({
  open,
  onClose,
}: MenuProps) {
  const router = useRouter();

  const params = useParams();

  const currentConversationId =
    typeof params?.id === "string"
      ? params.id
      : "";

  const [
    conversations,
    setConversations,
  ] = useState<Conversation[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const loadConversations =
    useCallback(
      async () => {
        setIsLoading(true);

        try {
          const {
            data: {
              user,
            },
            error: userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            setConversations([]);
            return;
          }

          const {
            data,
            error,
          } =
            await supabase
              .from("conversations")
              .select(
                `
                  id,
                  title,
                  created_at
                `
              )
              .eq(
                "user_id",
                user.id
              )
              .order(
                "created_at",
                {
                  ascending: false,
                }
              )
              .limit(50);

          if (error) {
            console.error(
              "SOHBETLER YÜKLENEMEDİ:",
              error
            );

            return;
          }

          setConversations(
            (data ??
              []) as Conversation[]
          );
        } catch (error) {
          console.error(
            "MENÜ SOHBET HATASI:",
            error
          );
        } finally {
          setIsLoading(false);
        }
      },
      []
    );

  useEffect(() => {
    void loadConversations();
  }, [
    loadConversations,
  ]);

  const handleNewChat =
    useCallback(() => {
      onClose();

      router.push("/chat");
    }, [
      onClose,
      router,
    ]);

  const handleConversationClick =
    useCallback(
      (
        conversationId: string
      ) => {
        onClose();

        router.push(
          `/chat/${conversationId}`
        );
      },
      [
        onClose,
        router,
      ]
    );

  const formatTitle =
    (
      title: string | null
    ) => {
      if (
        !title ||
        !title.trim()
      ) {
        return "Yeni Sohbet";
      }

      return title.trim();
    };

  return (
    <>
      {/* =========================================
          MOBILE BACKDROP
      ========================================== */}

      {open && (
        <button
          type="button"
          aria-label="Menüyü kapat"
          onClick={onClose}
          className="
            fixed
            inset-0
            z-40
            bg-black/70
            backdrop-blur-sm
            md:hidden
          "
        />
      )}

      {/* =========================================
          SIDEBAR
      ========================================== */}

      <aside
        className={`
          fixed
          inset-y-0
          left-0
          z-50
          flex
          w-[300px]
          flex-col
          border-r
          border-white/[0.07]
          bg-zinc-950
          shadow-2xl
          transition-transform
          duration-300
          ease-out

          ${
            open
              ? "translate-x-0"
              : "-translate-x-full"
          }

          md:static
          md:z-auto
          md:translate-x-0
          md:shadow-none
        `}
      >
        {/* =========================================
            HEADER
        ========================================== */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b
            border-white/[0.07]
            px-4
            py-4
          "
        >
          <div className="flex items-center gap-3">
            <div
              className="
                flex
                h-10
                w-10
                items-center
                justify-center
                rounded-xl
                border
                border-white/[0.08]
                bg-white/[0.04]
              "
            >
              <Sparkles
                size={19}
                className="text-white"
              />
            </div>

            <div>
              <h2
                className="
                  text-sm
                  font-bold
                  tracking-[0.12em]
                  text-white
                "
              >
                SYRAVEN
              </h2>

              <p className="mt-0.5 text-[10px] text-zinc-500">
                Artificial Intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              flex
              h-9
              w-9
              items-center
              justify-center
              rounded-xl
              text-zinc-500
              transition
              hover:bg-white/[0.06]
              hover:text-white
              md:hidden
            "
            aria-label="Menüyü kapat"
          >
            <X size={19} />
          </button>
        </div>

        {/* =========================================
            NEW CHAT
        ========================================== */}

        <div className="shrink-0 p-3">
          <button
            type="button"
            onClick={handleNewChat}
            className="
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              border
              border-white/[0.10]
              bg-white
              px-4
              py-3
              text-sm
              font-semibold
              text-black
              transition
              hover:bg-zinc-200
            "
          >
            <MessageSquarePlus
              size={18}
            />

            Yeni Sohbet
          </button>
        </div>

        {/* =========================================
            CONVERSATIONS TITLE
        ========================================== */}

        <div
          className="
            flex
            shrink-0
            items-center
            gap-2
            px-4
            pb-2
            pt-1
          "
        >
          <Clock3
            size={14}
            className="text-zinc-500"
          />

          <p
            className="
              text-[11px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-zinc-500
            "
          >
            Sohbet Geçmişi
          </p>
        </div>

        {/* =========================================
            CONVERSATIONS
        ========================================== */}

        <div
          className="
            min-h-0
            flex-1
            overflow-y-auto
            px-2
            pb-3
          "
        >
          {isLoading ? (
            <div className="space-y-2 px-2 pt-1">
              {[1, 2, 3, 4].map(
                (item) => (
                  <div
                    key={item}
                    className="
                      h-11
                      animate-pulse
                      rounded-xl
                      bg-white/[0.04]
                    "
                  />
                )
              )}
            </div>
          ) : conversations.length ===
            0 ? (
            <div
              className="
                px-4
                py-8
                text-center
              "
            >
              <MenuIcon
                size={24}
                className="
                  mx-auto
                  mb-3
                  text-zinc-700
                "
              />

              <p className="text-sm text-zinc-500">
                Henüz sohbet yok.
              </p>

              <p className="mt-1 text-xs text-zinc-600">
                Yeni bir sohbet başlat.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map(
                (
                  conversation
                ) => {
                  const isActive =
                    conversation.id ===
                    currentConversationId;

                  return (
                    <button
                      key={
                        conversation.id
                      }
                      type="button"
                      onClick={() =>
                        handleConversationClick(
                          conversation.id
                        )
                      }
                      className={`
                        flex
                        w-full
                        items-center
                        gap-3
                        rounded-xl
                        px-3
                        py-3
                        text-left
                        transition

                        ${
                          isActive
                            ? `
                              bg-white/[0.09]
                              text-white
                            `
                            : `
                              text-zinc-400
                              hover:bg-white/[0.05]
                              hover:text-white
                            `
                        }
                      `}
                    >
                      <div
                        className={`
                          flex
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg

                          ${
                            isActive
                              ? "bg-white/[0.10]"
                              : "bg-white/[0.04]"
                          }
                        `}
                      >
                        <Clock3
                          size={15}
                        />
                      </div>

                      <span
                        className="
                          min-w-0
                          flex-1
                          truncate
                          text-sm
                        "
                      >
                        {formatTitle(
                          conversation.title
                        )}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* =========================================
            BOTTOM MENU
        ========================================== */}

        <div
          className="
            shrink-0
            border-t
            border-white/[0.07]
            p-3
          "
        >
          {/* MEMORIES */}

          <Link
            href="/memories"
            onClick={onClose}
            className="
              flex
              items-center
              justify-between
              rounded-xl
              px-3
              py-3
              text-zinc-400
              transition
              hover:bg-white/[0.05]
              hover:text-white
            "
          >
            <div className="flex items-center gap-3">
              <Brain size={18} />

              <span className="text-sm">
                Memories
              </span>
            </div>

            <ChevronRight
              size={16}
              className="text-zinc-600"
            />
          </Link>

          {/* SETTINGS */}

          <Link
            href="/settings"
            onClick={onClose}
            className="
              flex
              items-center
              justify-between
              rounded-xl
              px-3
              py-3
              text-zinc-400
              transition
              hover:bg-white/[0.05]
              hover:text-white
            "
          >
            <div className="flex items-center gap-3">
              <Settings size={18} />

              <span className="text-sm">
                Ayarlar
              </span>
            </div>

            <ChevronRight
              size={16}
              className="text-zinc-600"
            />
          </Link>
        </div>
      </aside>
    </>
  );
}