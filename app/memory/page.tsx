"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  Brain,
  Loader2,
  Trash2,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Memory = {
  id: string;
  content: string;
  created_at: string;
};

export default function MemoriesPage() {
  const router = useRouter();

  const [
    memories,
    setMemories,
  ] = useState<Memory[]>([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(
    null
  );

  const loadMemories =
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
            router.replace(
              "/login"
            );

            return;
          }

          const {
            data,
            error,
          } =
            await supabase
              .from(
                "memories"
              )
              .select(
                `
                  id,
                  content,
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
                  ascending:
                    false,
                }
              );

          if (error) {
            throw error;
          }

          setMemories(
            (data ??
              []) as Memory[]
          );
        } catch (error) {
          console.error(
            "MEMORIES YÜKLEME HATASI:",
            error
          );
        } finally {
          setIsLoading(
            false
          );
        }
      },
      [
        router,
      ]
    );

  useEffect(() => {
    void loadMemories();
  }, [
    loadMemories,
  ]);

  const deleteMemory =
    useCallback(
      async (
        memoryId: string
      ) => {
        setDeletingId(
          memoryId
        );

        try {
          const {
            error,
          } =
            await supabase
              .from(
                "memories"
              )
              .delete()
              .eq(
                "id",
                memoryId
              );

          if (error) {
            throw error;
          }

          setMemories(
            (
              previous
            ) =>
              previous.filter(
                (
                  memory
                ) =>
                  memory.id !==
                  memoryId
              )
          );
        } catch (error) {
          console.error(
            "MEMORY SİLME HATASI:",
            error
          );
        } finally {
          setDeletingId(
            null
          );
        }
      },
      []
    );

  return (
    <main
      className="
        min-h-screen
        bg-[#090a0f]
        text-white
      "
    >
      <div
        className="
          mx-auto
          max-w-4xl
          px-5
          py-8
          sm:px-8
        "
      >
        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="
            mb-10
            flex
            items-center
            gap-2
            text-sm
            text-zinc-400
            transition
            hover:text-white
          "
        >
          <ArrowLeft
            size={18}
          />

          Geri dön
        </button>

        <div
          className="
            mb-10
            flex
            items-start
            gap-5
          "
        >
          <div
            className="
              flex
              h-14
              w-14
              items-center
              justify-center
              rounded-2xl
              border
              border-white/[0.08]
              bg-white/[0.04]
            "
          >
            <Brain
              size={25}
            />
          </div>

          <div>
            <h1
              className="
                text-3xl
                font-semibold
                tracking-tight
              "
            >
              Memories
            </h1>

            <p
              className="
                mt-2
                max-w-xl
                text-sm
                leading-6
                text-zinc-500
              "
            >
              SYRAVEN'ın senin hakkında
              hatırladığı bilgiler burada
              görüntülenir.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div
            className="
              flex
              items-center
              justify-center
              py-24
            "
          >
            <Loader2
              size={24}
              className="animate-spin text-zinc-500"
            />
          </div>
        ) : memories.length ===
          0 ? (
          <div
            className="
              rounded-3xl
              border
              border-white/[0.07]
              bg-white/[0.02]
              px-6
              py-20
              text-center
            "
          >
            <Brain
              size={30}
              className="
                mx-auto
                mb-4
                text-zinc-600
              "
            />

            <h2 className="text-base font-medium">
              Henüz kayıtlı memory yok
            </h2>

            <p
              className="
                mx-auto
                mt-2
                max-w-sm
                text-sm
                leading-6
                text-zinc-500
              "
            >
              SYRAVEN ile yaptığın
              konuşmalardan önemli ve
              kalıcı bilgiler burada
              görünecek.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories.map(
              (
                memory
              ) => (
                <div
                  key={
                    memory.id
                  }
                  className="
                    group
                    flex
                    items-start
                    gap-4
                    rounded-2xl
                    border
                    border-white/[0.07]
                    bg-white/[0.025]
                    p-5
                    transition
                    hover:border-white/[0.12]
                    hover:bg-white/[0.04]
                  "
                >
                  <div
                    className="
                      flex
                      h-10
                      w-10
                      shrink-0
                      items-center
                      justify-center
                      rounded-xl
                      bg-white/[0.05]
                    "
                  >
                    <Brain
                      size={18}
                      className="
                        text-zinc-400
                      "
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p
                      className="
                        text-sm
                        leading-6
                        text-zinc-300
                      "
                    >
                      {
                        memory.content
                      }
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void deleteMemory(
                        memory.id
                      )
                    }
                    disabled={
                      deletingId ===
                      memory.id
                    }
                    className="
                      flex
                      h-9
                      w-9
                      shrink-0
                      items-center
                      justify-center
                      rounded-lg
                      text-zinc-600
                      transition
                      hover:bg-red-500/10
                      hover:text-red-400
                      disabled:opacity-50
                    "
                    aria-label="Memory sil"
                  >
                    {deletingId ===
                    memory.id ? (
                      <Loader2
                        size={16}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2
                        size={16}
                      />
                    )}
                  </button>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}