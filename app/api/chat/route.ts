import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: message,
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      console.error("OPENAI ERROR:", error);

      return NextResponse.json(
        {
          reply: error,
        },
        {
          status: 500,
        }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      reply:
        data.output?.[0]?.content?.[0]?.text ??
        "Cevap alınamadı.",
    });
  } catch (error) {
    console.error("SERVER ERROR:", error);

    return NextResponse.json(
      {
        reply: "Sunucu hatası oluştu.",
      },
      {
        status: 500,
      }
    );
  }
}