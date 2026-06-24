import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { pageTextToTranscript, searchAndCapture } from "@/lib/browserbase";
import { jobDir } from "@/lib/job-storage";
import { flushTraces, traced } from "@/lib/trace";

export const runtime = "nodejs";
export const maxDuration = 120;

// Topic search → Browserbase opens the top results → combined argument map.
export async function POST(req: NextRequest) {
  const jobId = `job_${randomUUID().slice(0, 8)}`;
  try {
    const body = (await req.json()) as { query?: string };
    const query = body.query?.trim();
    if (!query) return NextResponse.json({ error: "Enter a topic to search." }, { status: 400 });

    const page = await traced("browserbase.search", { job_id: jobId, "search.query": query }, async (span) => {
      const captured = await searchAndCapture(query);
      span.setAttributes({
        "browserbase.session_id": captured.sessionId,
        "search.sources": captured.sources?.length ?? 0,
        "source.text_chars": captured.text.length,
      });
      return captured;
    });

    const transcript = pageTextToTranscript(page, jobId);
    try {
      const dir = jobDir(jobId);
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, "screenshot.png"), page.screenshot);
      await writeFile(join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));
    } catch {
      // best-effort persistence
    }

    return NextResponse.json({
      jobId,
      transcript,
      screenshot: `data:image/png;base64,${page.screenshot.toString("base64")}`,
      sessionId: page.sessionId,
      replayUrl: page.replayUrl,
      sources: page.sources ?? [],
      query,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed.";
    return NextResponse.json({ error: message, jobId }, { status: 500 });
  } finally {
    await flushTraces();
  }
}
