import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// Deepgram Aura — the opponent's spoken voice in argue mode.
const MODEL = process.env.DEEPGRAM_TTS_MODEL || "aura-2-thalia-en";

export async function POST(req: NextRequest) {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return NextResponse.json({ error: "DEEPGRAM_API_KEY not set." }, { status: 500 });

  const { text } = (await req.json()) as { text?: string };
  if (!text?.trim()) return NextResponse.json({ error: "No text to speak." }, { status: 400 });

  const dg = await fetch(`https://api.deepgram.com/v1/speak?model=${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: text.slice(0, 1800) }),
  });

  if (!dg.ok) {
    const detail = await dg.text();
    return NextResponse.json({ error: `Aura TTS error ${dg.status}: ${detail.slice(0, 200)}` }, { status: 502 });
  }

  const audio = Buffer.from(await dg.arrayBuffer());
  return new NextResponse(audio as unknown as BodyInit, {
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
