"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type AgentStatus = "ready" | "running" | "paused" | "error";
type AgentTab =
  | "overview"
  | "activity"
  | "knowledge"
  | "permissions"
  | "settings";

type Agent = {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  status: AgentStatus;
  verified: boolean;
  featured: boolean;
  capabilities: string[];
  suggestedTasks: string[];
  integrations: string[];
  permissions: {
    label: string;
    description: string;
    enabled: boolean;
    required?: boolean;
  }[];
};

const AGENTS: Record<string, Agent> = {
  research: {
    id: "research",
    name: "Research Agent",
    description:
      "Web, kaynaklar ve belgeler üzerinde derin araştırma yapar; bilgileri karşılaştırır, doğrular ve yapılandırılmış sonuçlara dönüştürür.",
    category: "Research",
    icon: "🔎",
    status: "ready",
    verified: true,
    featured: true,
    capabilities: [
      "Deep web research",
      "Kaynak karşılaştırma",
      "Çok adımlı araştırma",
      "Kaynaklandırılmış rapor",
      "Rakip analizi",
      "Trend takibi",
    ],
    suggestedTasks: [
      "Rakiplerimizi analiz et ve fırsatları çıkar",
      "Bu konu hakkında kaynaklı araştırma hazırla",
      "Pazardaki son gelişmeleri karşılaştır",
    ],
    integrations: ["Web", "Knowledge", "Files", "Tasks"],
    permissions: [
      {
        label: "Web araştırması",
        description: "Güncel bilgi ve kaynak araştırmasına izin verir.",
        enabled: true,
        required: true,
      },
      {
        label: "Knowledge erişimi",
        description: "Bağlı bilgi kaynaklarında arama yapabilir.",
        enabled: true,
      },
      {
        label: "Dosya analizi",
        description: "Seçtiğiniz belgeleri ve dosyaları analiz edebilir.",
        enabled: true,
      },
      {
        label: "Task oluşturma",
        description: "Araştırma sonucunda takip görevi önerebilir.",
        enabled: false,
      },
    ],
  },

  coding: {
    id: "coding",
    name: "Coding Agent",
    description:
      "Projeleri analiz eder, kod üretir, hataları bulur, refactor önerir ve geliştirme işlerini adım adım yürütür.",
    category: "Development",
    icon: "💻",
    status: "ready",
    verified: true,
    featured: true,
    capabilities: [
      "Kod analizi",
      "Bug detection",
      "Refactoring",
      "Test üretimi",
      "Dosya tabanlı çalışma",
      "Proje mimarisi analizi",
    ],
    suggestedTasks: [
      "Bu projedeki hataları analiz et",
      "Uygulamayı mobil uyumlu hale getir",
      "Kod yapısını refactor et",
    ],
    integrations: ["Projects", "Files", "Knowledge", "GitHub"],
    permissions: [
      {
        label: "Proje dosyaları",
        description: "Bağlanan proje dosyalarını okuyabilir.",
        enabled: true,
        required: true,
      },
      {
        label: "Kod değişikliği",
        description:
          "Değişiklik önerileri ve uygulama planları hazırlayabilir.",
        enabled: true,
      },
      {
        label: "GitHub",
        description: "Bağlı depoları analiz etmek için kullanılır.",
        enabled: false,
      },
      {
        label: "Terminal",
        description:
          "İzin verilen çalışma ortamlarında komut çalıştırma isteği oluşturabilir.",
        enabled: false,
      },
    ],
  },

  writing: {
    id: "writing",
    name: "Writing Agent",
    description:
      "İçerik, strateji, metin, doküman ve profesyonel yazılar üretmek için tasarlanmış yaratıcı yazım agentı.",
    category: "Creative",
    icon: "✍️",
    status: "ready",
    verified: true,
    featured: false,
    capabilities: [
      "Uzun form içerik",
      "Profesyonel yazım",
      "Metin iyileştirme",
      "Tone of voice",
      "Özetleme",
      "Çoklu format üretimi",
    ],
    suggestedTasks: [
      "Bu konu için kapsamlı bir içerik stratejisi oluştur",
      "Profesyonel bir teklif hazırla",
      "Bu metni daha güçlü hale getir",
    ],
    integrations: ["Knowledge", "Files", "Projects"],
    permissions: [
      {
        label: "Knowledge erişimi",
        description: "Bağlı bilgi kaynaklarını referans alabilir.",
        enabled: true,
      },
      {
        label: "Dosyalar",
        description: "Seçilen dokümanları okuyabilir ve analiz edebilir.",
        enabled: true,
      },
      {
        label: "Projects",
        description: "Proje bağlamına erişebilir.",
        enabled: false,
      },
    ],
  },
};

function getFallbackAgent(id: string): Agent {
  return {
    id,
    name:
      id
        .split("-")
        .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
        .join(" ") + " Agent",
    description:
      "SYRAVEN ekosisteminde karmaşık görevleri planlamak, yürütmek ve sonuçlandırmak için yapılandırılmış yapay zeka agentı.",
    category: "SYRAVEN Agent",
    icon: "✦",
    status: "ready",
    verified: true,
    featured: false,
    capabilities: [
      "Akıllı planlama",
      "Çok adımlı yürütme",
      "Bağlam farkındalığı",
      "Knowledge entegrasyonu",
      "Task entegrasyonu",
      "Sonuç raporlama",
    ],
    suggestedTasks: [
      "Bu agent ile yeni bir görev başlat",
      "Mevcut projemi analiz et",
      "Bana uygulanabilir bir plan oluştur",
    ],
    integrations: ["Chat", "Knowledge", "Tasks", "Projects"],
    permissions: [
      {
        label: "Chat bağlamı",
        description: "Mevcut çalışma bağlamını kullanabilir.",
        enabled: true,
        required: true,
      },
      {
        label: "Knowledge",
        description: "Seçilen bilgi kaynaklarında arama yapabilir.",
        enabled: true,
      },
      {
        label: "Tasks",
        description: "Görev ve otomasyon önerileri oluşturabilir.",
        enabled: false,
      },
    ],
  };
}

const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; className: string }
> = {
  ready: {
    label: "Hazır",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  running: {
    label: "Çalışıyor",
    className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  paused: {
    label: "Duraklatıldı",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  error: {
    label: "Hata",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
};

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const agentId = Array.isArray(params?.id)
    ? params.id[0]
    : params?.id || "research";

  const initialAgent = useMemo(
    () => AGENTS[agentId] || getFallbackAgent(agentId),
    [agentId]
  );

  const [agent, setAgent] = useState<Agent>(initialAgent);
  const [activeTab, setActiveTab] = useState<AgentTab>("overview");
  const [task, setTask] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const status = isRunning ? STATUS_CONFIG.running : STATUS_CONFIG[agent.status];

  const handleRun = useCallback(async () => {
    const trimmedTask = task.trim();

    if (!trimmedTask) {
      setRunMessage("Önce agent için bir görev yazmalısın.");
      return;
    }

    setIsRunning(true);
    setRunMessage(null);

    /*
      Gerçek execution bağlantısı ileride:
      POST /api/agents/execute

      Bu sayfa UI ve state sözleşmesini şimdiden hazır tutar.
      AgentExecution, services/agents.ts ve API route bu yapıyla uyumlu bağlanacaktır.
    */

    await new Promise((resolve) => setTimeout(resolve, 700));

    setRunMessage(
      `"${trimmedTask}" görevi hazırlandı. Agent execution sistemi üzerinden çalıştırılacak.`
    );

    setIsRunning(false);
  }, [task]);

  const togglePermission = (index: number) => {
    setAgent((current) => ({
      ...current,
      permissions: current.permissions.map((permission, permissionIndex) =>
        permissionIndex === index && !permission.required
          ? {
              ...permission,
              enabled: !permission.enabled,
            }
          : permission
      ),
    }));
  };

  const tabs: { id: AgentTab; label: string }[] = [
    { id: "overview", label: "Genel Bakış" },
    { id: "activity", label: "Aktivite" },
    { id: "knowledge", label: "Knowledge" },
    { id: "permissions", label: "İzinler" },
    { id: "settings", label: "Ayarlar" },
  ];

  return (
    <main className="min-h-screen bg-[#08090d] text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Top navigation */}
        <div className="mb-6 flex flex-col gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex w-fit items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <span>←</span>
            Agents&apos;a dön
          </button>

          <div className="rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
              <div className="flex gap-4 sm:gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-3xl shadow-2xl sm:h-20 sm:w-20 sm:text-4xl">
                  {agent.icon}
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-xs text-zinc-400">
                      {agent.category}
                    </span>

                    {agent.verified && (
                      <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs text-blue-300">
                        ✓ SYRAVEN Verified
                      </span>
                    )}

                    {agent.featured && (
                      <span className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs text-violet-300">
                        ✦ Featured
                      </span>
                    )}
                  </div>

                  <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
                    {agent.name}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
                    {agent.description}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${status.className}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {status.label}
                    </span>

                    <span className="text-xs text-zinc-500">
                      Agent ID: {agent.id}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/chat?agent=${encodeURIComponent(agent.id)}`}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  Chat&apos;te Aç
                </Link>

                <button
                  type="button"
                  onClick={() => setActiveTab("settings")}
                  className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]"
                >
                  Yapılandır
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 overflow-x-auto border-b border-white/[0.08]">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative px-4 py-3 text-sm transition ${
                    active
                      ? "text-white"
                      : "text-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {tab.label}

                  {active && (
                    <span className="absolute inset-x-2 bottom-0 h-px bg-white" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
            {/* Main execution */}
            <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
                  Agent Workspace
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Bu agent&apos;a bir görev ver
                </h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  SYRAVEN görevi analiz eder, gerekli araçları planlar ve
                  execution sistemine aktarır.
                </p>
              </div>

              <textarea
                value={task}
                onChange={(event) => setTask(event.target.value)}
                placeholder={`${agent.name} ile ne yapmak istiyorsun?`}
                rows={6}
                className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-white/[0.2] focus:bg-white/[0.025]"
              />

              <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <p className="text-xs text-zinc-600">
                  Hassas veya dış dünyada işlem yapacak görevlerde SYRAVEN
                  gerekli yerlerde açık onay ister.
                </p>

                <button
                  type="button"
                  onClick={handleRun}
                  disabled={isRunning}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isRunning ? "Agent hazırlanıyor..." : "Agent'ı Çalıştır →"}
                </button>
              </div>

              {runMessage && (
                <div className="mt-4 rounded-2xl border border-blue-500/15 bg-blue-500/[0.06] px-4 py-3 text-sm text-blue-200">
                  {runMessage}
                </div>
              )}

              <div className="mt-8 border-t border-white/[0.06] pt-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <h3 className="font-medium">Hızlı başlangıç</h3>
                  <span className="text-xs text-zinc-600">
                    Önerilen görevler
                  </span>
                </div>

                <div className="grid gap-3">
                  {agent.suggestedTasks.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setTask(suggestion)}
                      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-4 text-left transition hover:border-white/[0.14] hover:bg-white/[0.04]"
                    >
                      <span className="text-sm text-zinc-300">
                        {suggestion}
                      </span>

                      <span className="text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-white">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Sidebar */}
            <aside className="space-y-6">
              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
                <h2 className="font-semibold">Yetenekler</h2>

                <div className="mt-4 flex flex-wrap gap-2">
                  {agent.capabilities.map((capability) => (
                    <span
                      key={capability}
                      className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-xs text-zinc-400"
                    >
                      {capability}
                    </span>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">Bağlantılar</h2>
                  <Link
                    href="/apps"
                    className="text-xs text-zinc-500 transition hover:text-white"
                  >
                    Yönet →
                  </Link>
                </div>

                <div className="mt-4 space-y-2">
                  {agent.integrations.map((integration) => (
                    <div
                      key={integration}
                      className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-black/10 px-3 py-3"
                    >
                      <span className="text-sm text-zinc-300">
                        {integration}
                      </span>

                      <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-violet-500/15 bg-gradient-to-br from-violet-500/[0.09] to-transparent p-5">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-violet-300">
                  SYRAVEN Intelligence
                </p>

                <h3 className="mt-3 text-lg font-semibold">
                  Tek agent değil, bir ekip oluştur.
                </h3>

                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  Birden fazla agent&apos;ı aynı Workspace içinde
                  çalıştırabilir ve görevleri birbirine devredebilirsin.
                </p>

                <Link
                  href="/workspace"
                  className="mt-5 inline-flex text-sm font-medium text-white hover:text-violet-200"
                >
                  Workspace&apos;e git →
                </Link>
              </section>
            </aside>
          </div>
        )}

        {activeTab === "activity" && (
          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              Agent Run History
            </p>

            <h2 className="mt-2 text-xl font-semibold">
              Agent aktivitesi
            </h2>

            <div className="mt-6 rounded-2xl border border-dashed border-white/[0.1] px-6 py-16 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-xl">
                ✦
              </div>

              <h3 className="font-medium">Henüz kayıtlı çalışma yok</h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-500">
                Agent çalıştırıldığında execution geçmişi, durum, kullanılan
                araçlar ve sonuç özeti burada görüntülenecek.
              </p>
            </div>
          </section>
        )}

        {activeTab === "knowledge" && (
          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                  Agent Knowledge
                </p>

                <h2 className="mt-2 text-xl font-semibold">
                  Bilgi kaynakları
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Bu agent için hangi Knowledge kaynaklarının kullanılacağını
                  yönet.
                </p>
              </div>

              <Link
                href="/knowledge"
                className="rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2.5 text-sm transition hover:bg-white/[0.08]"
              >
                Knowledge&apos;ı Aç
              </Link>
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-white/[0.1] px-6 py-12 text-center text-sm text-zinc-500">
              Knowledge kaynakları `KnowledgeContext`, `useKnowledge` ve
              `services/knowledge.ts` katmanları üzerinden bağlanacak.
            </div>
          </section>
        )}

        {activeTab === "permissions" && (
          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
                Security & Control
              </p>

              <h2 className="mt-2 text-xl font-semibold">Agent izinleri</h2>

              <p className="mt-2 text-sm leading-6 text-zinc-500">
                Agent yalnızca izin verdiğin kaynaklara erişebilir. Dış
                dünyada etkisi olan işlemler için execution katmanında ayrıca
                kullanıcı onayı korunur.
              </p>
            </div>

            <div className="space-y-3">
              {agent.permissions.map((permission, index) => (
                <div
                  key={permission.label}
                  className="flex items-center justify-between gap-5 rounded-2xl border border-white/[0.07] bg-black/10 p-4"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-medium">
                        {permission.label}
                      </h3>

                      {permission.required && (
                        <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-500">
                          Gerekli
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs leading-5 text-zinc-500">
                      {permission.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={permission.required}
                    onClick={() => togglePermission(index)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      permission.enabled
                        ? "bg-white"
                        : "bg-zinc-800"
                    } ${
                      permission.required
                        ? "cursor-not-allowed opacity-70"
                        : ""
                    }`}
                    aria-label={`${permission.label} iznini değiştir`}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full transition ${
                        permission.enabled
                          ? "left-6 bg-black"
                          : "left-1 bg-zinc-500"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {activeTab === "settings" && (
          <section className="rounded-3xl border border-white/[0.08] bg-white/[0.025] p-6">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">
              Agent Configuration
            </p>

            <h2 className="mt-2 text-xl font-semibold">Agent ayarları</h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <h3 className="font-medium">Agent davranışı</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Model, çalışma tarzı, otomasyon seviyesi ve yanıt
                  tercihleri AgentBuilder sistemi tarafından yönetilecek.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <h3 className="font-medium">Usage & Limits</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Kullanım limitleri aktif plan ve billing katmanına göre
                  `UsageMeter` ve `services/usage.ts` üzerinden gösterilecek.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <h3 className="font-medium">Automation</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Agent&apos;ı manuel çalıştırmanın yanında Tasks ve
                  Automation sistemlerine bağlayabilirsin.
                </p>

                <Link
                  href="/tasks"
                  className="mt-4 inline-flex text-sm text-zinc-300 hover:text-white"
                >
                  Tasks&apos;ı aç →
                </Link>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/10 p-5">
                <h3 className="font-medium">Gelişmiş yapılandırma</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  Özel agent ayarları, model tercihleri ve execution
                  politikaları AgentBuilder ekranında yönetilecek.
                </p>

                <Link
                  href="/agents/create"
                  className="mt-4 inline-flex text-sm text-zinc-300 hover:text-white"
                >
                  Agent Builder →
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Bottom action area */}
        <section className="mt-8 flex flex-col justify-between gap-5 rounded-3xl border border-white/[0.08] bg-gradient-to-r from-white/[0.04] to-transparent p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-semibold">
              SYRAVEN Agent Ecosystem
            </h2>

            <p className="mt-1 text-sm text-zinc-500">
              Agent&apos;lar Chat, Workspace, Knowledge, Projects ve Tasks
              sistemleri arasında ortak bağlamla çalışacak.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/agents"
              className="rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.05]"
            >
              Agent Store
            </Link>

            <Link
              href="/agents/create"
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-zinc-200"
            >
              Yeni Agent Oluştur
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}