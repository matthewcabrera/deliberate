import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { captureUrl, pageTextToTranscript } from "@/lib/browserbase";
import { flushTraces, traced } from "@/lib/trace";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const jobId = `job_${randomUUID().slice(0, 8)}`;
  try {
    const body = (await req.json()) as { url?: string };
    const url = body.url?.trim();
    if (!url || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Provide a valid http(s) URL." }, { status: 400 });
    }

    const dir = join(process.cwd(), "data", "jobs", jobId);
    await mkdir(dir, { recursive: true });

    const page = await traced("browserbase.ingest", { job_id: jobId, "source.url": url }, async (span) => {
      const captured = await captureUrl(url);
      span.setAttributes({
        "browserbase.session_id": captured.sessionId,
        "source.title": captured.title,
        "source.text_chars": captured.text.length,
      });
      return captured;
    });

    const hasShot = page.screenshot.length > 0;
    if (hasShot) await writeFile(join(dir, "screenshot.png"), page.screenshot);
    const transcript = pageTextToTranscript(page, jobId);
    await writeFile(join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    return NextResponse.json({
      jobId,
      transcript,
      screenshot: hasShot ? `data:image/png;base64,${page.screenshot.toString("base64")}` : null,
      sessionId: page.sessionId,
      replayUrl: page.replayUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown capture error.";
    return NextResponse.json({ error: message, jobId }, { status: 500 });
  } finally {
    await flushTraces();
  }
}
