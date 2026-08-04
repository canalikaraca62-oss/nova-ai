import { NextResponse } from "next/server";
import { askNova } from "@/services/ai";

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    const reply = await askNova(messages);

    return NextResponse.json({
      reply,
    });
  } catch (error) {
    console.error(error);

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