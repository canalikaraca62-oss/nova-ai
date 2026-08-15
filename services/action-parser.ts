import {
  ActionRequest,
  ActionType,
} from "./action-types";

type ParsedActionResponse = {
  type?: string;
  requiresConfirmation?: boolean;
  confidence?: number;
  data?: Record<string, unknown>;
};

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const MODEL =
  process.env.GROQ_MODEL ||
  "llama-3.3-70b-versatile";

const ACTION_TYPES: ActionType[] = [
  "none",
  "calendar_create",
  "calendar_update",
  "calendar_delete",
  "email_send",
  "email_reply",
  "reminder_create",
  "notification_send",
  "web_task",
];

function isActionType(
  value: unknown
): value is ActionType {
  return (
    typeof value === "string" &&
    ACTION_TYPES.includes(
      value as ActionType
    )
  );
}

function extractJson(
  text: string
): ParsedActionResponse | null {
  try {
    return JSON.parse(text);
  } catch {
    // Model bazen JSON'u markdown
    // code fence içerisinde döndürebilir.
  }

  const match = text.match(
    /\{[\s\S]*\}/
  );

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalizeAction(
  result: ParsedActionResponse
): ActionRequest {
  const type: ActionType =
    isActionType(result.type)
      ? result.type
      : "none";

  const confidence =
    typeof result.confidence ===
      "number" &&
    Number.isFinite(result.confidence)
      ? Math.max(
          0,
          Math.min(1, result.confidence)
        )
      : 0;

  const requiresConfirmation =
    type === "none"
      ? false
      : Boolean(
          result.requiresConfirmation ??
            true
        );

  return {
    type,
    requiresConfirmation,
    confidence,
    data:
      result.data &&
      typeof result.data ===
        "object"
      ? result.data
      : {},
  };
}

export async function parseAction(
  userMessage: string
): Promise<ActionRequest> {
  const cleanMessage =
    userMessage.trim();

  if (!cleanMessage) {
    return {
      type: "none",
      requiresConfirmation: false,
      confidence: 1,
      data: {},
    };
  }

  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error(
      "GROQ_API_KEY bulunamadı."
    );

    return {
      type: "none",
      requiresConfirmation: false,
      confidence: 0,
      data: {},
    };
  }

  try {
    const response = await fetch(
      GROQ_API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          Authorization: `Bearer ${apiKey}`,
        },

        body: JSON.stringify({
          model: MODEL,

          temperature: 0,

          max_tokens: 300,

          messages: [
            {
              role: "system",

              content: `
Sen QELVORA'nın ACTION ANALYZER sistemisin.

Görevin kullanıcının mesajının bir işlem
yapılmasını isteyip istemediğini belirlemektir.

SADECE geçerli JSON döndür.

Şema:

{
  "type": "none",
  "requiresConfirmation": false,
  "confidence": 0,
  "data": {}
}

Geçerli action türleri:

none
calendar_create
calendar_update
calendar_delete
email_send
email_reply
reminder_create
notification_send
web_task

Kurallar:

1. Kullanıcı yalnızca bilgi istiyorsa:
type = "none"

2. Kullanıcı gerçekten bir işlem yapılmasını
istiyorsa uygun action türünü seç.

3. Şimdilik hiçbir işlemi gerçekten gerçekleştirme.
Sadece kullanıcının niyetini sınıflandır.

4. İşlem yapmayı gerektiren bütün action'larda
requiresConfirmation varsayılan olarak true olsun.

5. confidence 0 ile 1 arasında olsun.

6. Kullanıcının söylemediği bilgileri uydurma.

7. Tarih, saat, e-posta adresi, kişi adı,
başlık veya diğer bilgileri yalnızca mesajda
varsa data içine koy.

Örnek:

Kullanıcı:
"Yarın saat 15'te toplantı oluştur."

JSON:
{
  "type": "calendar_create",
  "requiresConfirmation": true,
  "confidence": 0.98,
  "data": {
    "date": "yarın",
    "time": "15:00",
    "title": "toplantı"
  }
}

Kullanıcı:
"Yarın yağmur yağacak mı?"

JSON:
{
  "type": "none",
  "requiresConfirmation": false,
  "confidence": 0.99,
  "data": {}
}

Kullanıcı:
"Ahmet'e toplantının yarına alındığını
mail at."

JSON:
{
  "type": "email_send",
  "requiresConfirmation": true,
  "confidence": 0.97,
  "data": {
    "recipient": "Ahmet",
    "content": "toplantının yarına alındığını bildir"
  }
}
`.trim(),
            },

            {
              role: "user",
              content: cleanMessage,
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error(
        "Action parser API hatası:",
        response.status
      );

      return {
        type: "none",
        requiresConfirmation: false,
        confidence: 0,
        data: {},
      };
    }

    const responseData =
      await response.json();

    const content =
      responseData?.choices?.[0]
        ?.message?.content;

    if (
      typeof content !==
      "string"
    ) {
      return {
        type: "none",
        requiresConfirmation: false,
        confidence: 0,
        data: {},
      };
    }

    const parsed =
      extractJson(content);

    if (!parsed) {
      console.error(
        "Action parser geçerli JSON döndürmedi:",
        content
      );

      return {
        type: "none",
        requiresConfirmation: false,
        confidence: 0,
        data: {},
      };
    }

    return normalizeAction(
      parsed
    );
  } catch (error) {
    console.error(
      "Action parser hatası:",
      error
    );

    return {
      type: "none",
      requiresConfirmation: false,
      confidence: 0,
      data: {},
    };
  }
}