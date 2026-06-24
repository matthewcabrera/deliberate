import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { NextResponse, type NextRequest } from "next/server";
import { normalizeDeepgram, transcribeWithDeepgram } from "@/lib/deepgram";
import { fetchYoutubeAudio } from "@/lib/youtube-audio";
import { jobDir } from "@/lib/job-storage";
import { flushTraces, traced } from "@/lib/trace";
import type { SourceRecord } from "@/lib/contracts";

export const runtime = "nodejs";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);
const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";
const FFMPEG_DIR = process.env.FFMPEG_DIR;

const EXEC_OPTS = { maxBuffer: 1024 * 1024 * 64 } as const;

function youtubeSource(jobId: string, url: string, title?: string): SourceRecord {
  return {
    id: `src_${jobId}`,
    inputUrl: url,
    canonicalUrl: url,
    sourceType: "youtube",
    title,
    fetchedAt: new Date().toISOString(),
  };
}

async function ingestYoutube(dir: string, jobId: string, url: string): Promise<{ audioPath: string; mime: string; source: SourceRecord }> {
  // Serverless path: pull audio via RapidAPI (no yt-dlp/ffmpeg binaries needed).
  if (process.env.RAPIDAPI_KEY) {
    const { audio, title } = await fetchYoutubeAudio(url);
    const audioPath = join(dir, "source.mp3");
    await writeFile(audioPath, Buffer.from(audio));
    return { audioPath, mime: "audio/mpeg", source: youtubeSource(jobId, url, title) };
  }

  // Local fallback: yt-dlp + ffmpeg.
  const output = join(dir, "source.%(ext)s");
  const args = ["-x", "--audio-format", "mp3", "--no-playlist", "-o", output];
  if (FFMPEG_DIR) args.push("--ffmpeg-location", FFMPEG_DIR);
  args.push(url);
  await execFileAsync(YT_DLP, args, EXEC_OPTS);

  let title: string | undefined;
  try {
    const { stdout } = await execFileAsync(YT_DLP, ["--no-playlist", "--skip-download", "--print", "title", url], EXEC_OPTS);
    title = stdout.trim() || undefined;
  } catch {
    // title is best-effort
  }

  return {
    audioPath: join(dir, "source.mp3"),
    mime: "audio/mpeg",
    source: {
      id: `src_${jobId}`,
      inputUrl: url,
      canonicalUrl: url,
      sourceType: "youtube",
      title,
      fetchedAt: new Date().toISOString(),
    },
  };
}

function mimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() || "";
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "video/mp4",
    mov: "video/quicktime",
    wav: "audio/wav",
    webm: "audio/webm",
    ogg: "audio/ogg",
    flac: "audio/flac",
    aac: "audio/aac",
  };
  return map[ext] || "audio/mpeg";
}

async function ingestUpload(dir: string, jobId: string, file: File): Promise<{ audioPath: string; mime: string; source: SourceRecord }> {
  // Send the uploaded media straight to Deepgram (it handles mp4/m4a/wav/mp3/webm
  // and extracts audio from video) — no ffmpeg, so it runs on serverless.
  const audioPath = join(dir, `upload_${(file.name || "media").replace(/[^\w.-]/g, "_")}`);
  await writeFile(audioPath, Buffer.from(await file.arrayBuffer()));

  return {
    audioPath,
    mime: file.type || mimeFromName(file.name || ""),
    source: {
      id: `src_${jobId}`,
      inputUrl: file.name || "upload",
      sourceType: "upload",
      title: file.name || "Uploaded media",
      fetchedAt: new Date().toISOString(),
    },
  };
}

export async function POST(req: NextRequest) {
  const jobId = `job_${randomUUID().slice(0, 8)}`;
  const dir = jobDir(jobId);

  try {
    await mkdir(dir, { recursive: true });
    const contentType = req.headers.get("content-type") || "";

    let ingest: { audioPath: string; mime: string; source: SourceRecord };

    if (contentType.includes("application/json")) {
      const body = (await req.json()) as { youtubeUrl?: string };
      const url = body.youtubeUrl?.trim();
      if (!url) return NextResponse.json({ error: "Missing youtubeUrl." }, { status: 400 });
      ingest = await ingestYoutube(dir, jobId, url);
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "Missing file." }, { status: 400 });
      ingest = await ingestUpload(dir, jobId, file);
    } else {
      return NextResponse.json({ error: "Send JSON { youtubeUrl } or a multipart file." }, { status: 415 });
    }

    const audio = await readFile(ingest.audioPath);

    const transcript = await traced(
      "deepgram.transcribe",
      { job_id: jobId, "source.type": ingest.source.sourceType, "audio.mime": ingest.mime },
      async (span) => {
        const dg = await transcribeWithDeepgram(audio, ingest.mime);
        const t = normalizeDeepgram(dg, ingest.source);
        const avgConf = t.utterances.length
          ? t.utterances.reduce((s, u) => s + u.confidence, 0) / t.utterances.length
          : 0;
        span.setAttributes({
          "transcript.duration_sec": t.durationSec,
          "transcript.utterance_count": t.utterances.length,
          "transcript.speaker_count": t.speakers?.length ?? 0,
          "transcript.avg_confidence": Number(avgConf.toFixed(3)),
          "deepgram.request_id": t.deepgramRequestId,
        });
        return t;
      },
    );

    await writeFile(join(dir, "transcript.json"), JSON.stringify(transcript, null, 2));

    return NextResponse.json({ jobId, transcript });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown transcription error.";
    return NextResponse.json({ error: message, jobId }, { status: 500 });
  } finally {
    await flushTraces();
  }
}
