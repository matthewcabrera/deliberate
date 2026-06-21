import Anthropic from "@anthropic-ai/sdk";
import { NextResponse, type NextRequest } from "next/server";
import { flushTraces, traced } from "@/lib/trace";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = process.env.ANTHROPIC_ARGUE_MODEL || "claude-haiku-4-5";

const SYSTEM = `You are a sharp, fair debate opponent in a live spoken debate. The user argues a position out loud; you push back with the single strongest objection or counter-position.

Rules:
- Reply in 2-3 spoken sentences, conversational and direct. This is read aloud by a text-to-speech voice, so use no markdown, no lists, no stage directions, no emoji.
- Engage their ACTUAL point. Raise a real objection, counterexample, or trade-off — don't strawman.
- Be civil but don't concede easily. Hold a coherent opposing line across turns.
- End by putting a pointed question back to them.`;

type Turn = { role: "you" | "opponent"; text: string };

export async function POST(req: NextRequest) {
  try {
    const { history } = (await req.json()) as { history?: Turn[] };
    if (!history?.length) return NextResponse.json({ error: "No debate history." }, { status: 400 });

    const messages = history.map((h) => ({
      role: h.role === "you" ? ("user" as const) : ("assistant" as const),
      content: h.text,
    }));

    const reply = await traced("argue.rebuttal", { turns: history.length }, async (span) => {
      const client = new Anthropic();
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 320,
        system: SYSTEM,
        messages,
      });
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join(" ").trim();
      span.setAttributes({
        "reply.chars": text.length,
        "llm.token_count.completion": res.usage?.output_tokens ?? 0,
      });
      return text;
    });

    return NextResponse.json({ reply });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Argue failed." },
      { status: 500 },
    );
  } finally {
    await flushTraces();
  }
}
