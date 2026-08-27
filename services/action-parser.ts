import type {
  ActionRequest,
  ActionType,
} from "./action-types";

type ParsedActionResponse = {
  type?: unknown;
  requiresConfirmation?: unknown;
  confidence?: unknown;
  data?: unknown;
};

const GROQ_API_URL =
  "https://api.groq.com/openai/v1/chat/completions";

const MODEL =
  process.env.GROQ_MODEL ||
  "openai/gpt-oss-20b";

const MAX_MESSAGE_LENGTH = 12000;

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

function createNoneAction(
  confidence = 1
): ActionRequest {
  return {
    type: "none",
    requiresConfirmation: false,
    confidence,
    data: {},
  };
}

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

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function clampConfidence(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(1, value)
  );
}

function extractJson(
  text: string
): ParsedActionResponse | null {
  const cleaned =
    text
      .trim()
      .replace(
        /^```(?:json)?\s*/i,
        ""
      )
      .replace(
        /\s*```$/i,
        ""
      )
      .trim();

  try {
    const parsed =
      JSON.parse(cleaned);

    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    // JSON doğrudan parse edilemedi.
  }

  const start =
    cleaned.indexOf("{");

  const end =
    cleaned.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1 ||
    end <= start
  ) {
    return null;
  }

  const jsonCandidate =
    cleaned.slice(
      start,
      end + 1
    );

  try {
    const parsed =
      JSON.parse(jsonCandidate);

    if (!isRecord(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeAction(
  result: ParsedActionResponse
): ActionRequest {
  const type =
    isActionType(result.type)
      ? result.type
      : "none";

  if (type === "none") {
    return {
      type: "none",
      requiresConfirmation: false,
      confidence:
        clampConfidence(
          result.confidence
        ),
      data: {},
    };
  }

  return {
    type,
    requiresConfirmation: true,
    confidence:
      clampConfidence(
        result.confidence
      ),
    data:
      isRecord(result.data)
        ? result.data
        : {},
  };
}

export async function parseAction(
  userMessage: string
): Promise<ActionRequest> {
  const cleanMessage =
    userMessage
      .trim()
      .slice(
        0,
        MAX_MESSAGE_LENGTH
      );

  if (!cleanMessage) {
    return createNoneAction();
  }

  const apiKey =
    process.env.GROQ_API_KEY;

  if (!apiKey) {
    console.error(
      "GROQ_API_KEY bulunamadı."
    );

    return createNoneAction(0);
  }

  try {
    const response =
      await fetch(
        GROQ_API_URL,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${apiKey}`,
          },

          body: JSON.stringify({
            model: MODEL,

            temperature: 0,

            reasoning_effort:
              "low",

            include_reasoning:
              false,

            max_completion_tokens:
              500,

            response_format: {
              type:
                "json_object",
            },

            messages: [
              {
                role: "system",

                content: `
Sen SYRAVEN ACTION ANALYZER sistemisin.

Görevin kullanıcının mesajında gerçekten bir işlem isteği olup olmadığını belirlemektir.

Sadece JSON döndür.

Geçerli action türleri:

- none
- calendar_create
- calendar_update
- calendar_delete
- email_send
- email_reply
- reminder_create
- notification_send
- web_task

JSON formatı:

{
  "type": "none",
  "requiresConfirmation": false,
  "confidence": 0,
  "data": {}
}

Kurallar:

1. Kullanıcı sadece soru soruyorsa type "none" kullan.

2. Kullanıcı gerçekten bir işlem yapılmasını istiyorsa uygun action türünü seç.

3. Şimdilik hiçbir işlemi gerçekleştirme.

4. Action türü "none" değilse requiresConfirmation her zaman true olmalıdır.

5. type "none" ise requiresConfirmation her zaman false olmalıdır.

6. confidence 0 ile 1 arasında sayı olmalıdır.

7. Kullanıcının söylemediği bilgileri uydurma.

8. data içine sadece kullanıcının açıkça verdiği bilgileri koy.

9. Mesaj belirsizse tahmin yürütme. type "none" kullan.

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
"Ahmet'e toplantının yarına alındığını mail at."

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

                content:
                  cleanMessage,
              },
            ],
          }),
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        "Action parser API hatası:",
        response.status,
        errorText
      );

      return createNoneAction(0);
    }

    const responseData =
      await response.json();

    const content =
      responseData
        ?.choices?.[0]
        ?.message?.content;

    if (
      typeof content !== "string" ||
      !content.trim()
    ) {
      console.error(
        "Action parser boş yanıt döndürdü."
      );

      return createNoneAction(0);
    }

    const parsed =
      extractJson(content);

    if (!parsed) {
      console.error(
        "Action parser geçerli JSON döndürmedi:",
        content
      );

      return createNoneAction(0);
    }

    return normalizeAction(
      parsed
    );
  } catch (error) {
    console.error(
      "Action parser hatası:",
      error
    );

    return createNoneAction(0);
  }
}