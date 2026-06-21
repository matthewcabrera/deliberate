// Gold-test-set experiment: re-extract + LLM-judge a set of transcripts and
// print an aggregate quality table. Each run is also traced to Arize.
//
//   npm run dev          # in one terminal
//   node scripts/eval-ibis.mjs
//
// Watch the mean judge score move as you tune the extraction prompt/model.

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const JOBS_DIR = join(process.cwd(), "data", "jobs");

function loadTranscripts(limit = 4) {
  if (!existsSync(JOBS_DIR)) return [];
  const seen = new Set();
  const out = [];
  for (const id of readdirSync(JOBS_DIR)) {
    const path = join(JOBS_DIR, id, "transcript.json");
    if (!existsSync(path)) continue;
    try {
      const t = JSON.parse(readFileSync(path, "utf8"));
      const title = t.source?.title || id;
      if (seen.has(title)) continue;
      seen.add(title);
      out.push({ id, title, transcript: t });
    } catch {
      /* skip unreadable */
    }
    if (out.length >= limit) break;
  }
  return out;
}

async function evaluateOne(item) {
  const res = await fetch(`${BASE}/api/extract-ibis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript: item.transcript, jobId: `eval-${item.id}`, judge: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return { graph: data.graph, quality: data.quality };
}

async function main() {
  const items = loadTranscripts();
  if (!items.length) {
    console.error("No transcripts found under data/jobs/. Run a transcription first.");
    process.exit(1);
  }
  console.log(`Evaluating ${items.length} transcript(s) against ${BASE}\n`);

  const rows = [];
  for (const item of items) {
    process.stdout.write(`• ${item.title.slice(0, 48).padEnd(48)} `);
    try {
      const { graph, quality } = await evaluateOne(item);
      const j = quality.judge;
      rows.push({ title: item.title, score: j?.score ?? null, quality, nodes: graph.nodes.length });
      console.log(
        `nodes=${graph.nodes.length} ground=${quality.groundingCoverage} orphans=${quality.orphanCount} ` +
          `judge=${j ? `${j.overall} (${j.score})` : "n/a"}`,
      );
      if (j) console.log(`    grounding: ${j.grounding.label} — ${j.grounding.explanation}`);
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  const scored = rows.filter((r) => r.score != null);
  if (scored.length) {
    const mean = scored.reduce((s, r) => s + r.score, 0) / scored.length;
    console.log(`\nMean judge score across ${scored.length} run(s): ${mean.toFixed(3)}`);
    console.log("Open app.arize.com → project 'deliberate-ibis' to inspect each trace + evaluation.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
