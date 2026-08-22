import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function GET() {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const response =
      await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: "Sadece 'Merhaba SYRAVEN' yaz.",
          },
        ],
      });

    return NextResponse.json({
      success: true,
      reply:
        response.choices[0].message.content,
    });
  } catch (error: any) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        message: error.message,
        code: error.code,
        status: error.status,
      },
      {
        status: 500,
      }
    );
  }
}