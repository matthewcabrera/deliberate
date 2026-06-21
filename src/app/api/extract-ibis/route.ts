import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { extractIbisGraph } from "@/lib/ibis-extract";
import { evaluateIbis } from "@/lib/ibis-eval";
import { jobDir } from "@/lib/job-storage";
import { flushTraces, traced } from "@/lib/trace";
import type { NormalizedTranscript } from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { transcript?: NormalizedTranscript; jobId?: string; judge?: boolean };
    const transcript = body.transcript;
    if (!transcript?.utterances?.length) {
      return NextResponse.json({ error: "Missing transcript with utterances." }, { status: 400 });
    }

    const jobId = body.jobId || `job_${randomUUID().slice(0, 8)}`;

    // Run extraction + evaluation under one trace so Arize shows the whole job.
    const { graph, quality } = await traced(
      "ibis.pipeline",
      { job_id: jobId, "source.type": transcript.source.sourceType, "transcript.utterances": transcript.utterances.length },
      async () => {
        const g = await extractIbisGraph(transcript);
        const q = await evaluateIbis(g, transcript, { judge: Boolean(body.judge) });
        return { graph: g, quality: q };
      },
    );

    const dir = jobDir(jobId);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, "graph.json"), JSON.stringify(graph, null, 2));

    return NextResponse.json({ jobId, graph, quality });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await flushTraces();
  }
}
