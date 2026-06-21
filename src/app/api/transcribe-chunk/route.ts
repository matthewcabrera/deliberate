import { NextResponse, type NextRequest } from "next/server";
import { transcribeWithDeepgram } from "@/lib/deepgram";
import { flushTraces, traced } from "@/lib/trace";

export const runtime = "nodejs";
export const maxDuration = 60;

// Live modes (observe/argue) stream short audio segments here. The Deepgram key
// stays server-side; we return just the recognized text for that segment.
export async function POST(req: NextRequest) {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    if (!buf.length) return NextResponse.json({ error: "Empty audio." }, { status: 400 });
    const contentType = req.headers.get("content-type") || "audio/webm";

    const text = await traced("deepgram.live_chunk", { "audio.bytes": buf.length }, async (span) => {
      const dg = await transcribeWithDeepgram(new Uint8Array(buf), contentType);
      const recognized = (
        dg.results?.utterances?.map((u) => u.transcript).join(" ") ||
        dg.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
        ""
      ).trim();
      span.setAttributes({ "transcript.chars": recognized.length });
      return recognized;
    });

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Transcription failed." },
      { status: 500 },
    );
  } finally {
    await flushTraces();
  }
}
