import type {
  NormalizedTranscript,
  SourceRecord,
  SpeakerProfile,
  TranscriptUtterance,
  TranscriptWord,
} from "@/lib/contracts";

// Best-effort name inference from what each speaker says about themselves.
// Diarization only gives speaker numbers; if nobody self-identifies we keep the
// "Speaker N" fallback. Names are confirmed/edited by the user in the UI.
const SELF_INTRO = /\b(?:i'?m|i am|my name is|this is)\s+([A-Z][a-z]+)\b/;

function inferSpeakers(utterances: TranscriptUtterance[]): SpeakerProfile[] {
  const byId = new Map<string, TranscriptUtterance[]>();
  for (const u of utterances) {
    const list = byId.get(u.speakerId) ?? [];
    list.push(u);
    byId.set(u.speakerId, list);
  }

  const profiles: SpeakerProfile[] = [];
  for (const [id, list] of byId) {
    let inferredName: string | undefined;
    for (const u of list) {
      const match = u.text.match(SELF_INTRO);
      if (match) {
        inferredName = match[1];
        break;
      }
    }
    profiles.push({
      id,
      label: list[0]?.speakerLabel ?? id,
      inferredName,
      confidence: inferredName ? "medium" : "low",
    });
  }
  return profiles;
}

// Prerecorded transcription tuned for IBIS evidence: diarized, timestamped,
// semantically chunked utterances. See research/deepgram-integration.md.
const DEEPGRAM_QUERY = new URLSearchParams({
  model: "nova-3",
  smart_format: "true",
  punctuate: "true",
  diarize: "true",
  utterances: "true",
}).toString();

interface DeepgramWord {
  word: string;
  punctuated_word?: string;
  start: number;
  end: number;
  confidence: number;
  speaker?: number;
}

interface DeepgramUtterance {
  start: number;
  end: number;
  confidence: number;
  transcript: string;
  speaker?: number;
  words?: DeepgramWord[];
}

export interface DeepgramResponse {
  metadata?: { request_id?: string; duration?: number };
  results?: {
    utterances?: DeepgramUtterance[];
    summary?: { short?: string };
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
  };
}

export async function transcribeWithDeepgram(
  audio: Uint8Array,
  contentType: string,
): Promise<DeepgramResponse> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new Error("DEEPGRAM_API_KEY is not set (add it to .env.local).");

  const res = await fetch(`https://api.deepgram.com/v1/listen?${DEEPGRAM_QUERY}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": contentType },
    // undici accepts a byte buffer body; the DOM BodyInit type omits BufferSource.
    body: audio as unknown as BodyInit,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Deepgram error ${res.status}: ${detail.slice(0, 400)}`);
  }
  return (await res.json()) as DeepgramResponse;
}

export function normalizeDeepgram(
  dg: DeepgramResponse,
  source: SourceRecord,
): NormalizedTranscript {
  const rawUtterances = dg.results?.utterances ?? [];

  const utterances: TranscriptUtterance[] = rawUtterances.map((u, index) => {
    const speaker = u.speaker ?? 0;
    const words: TranscriptWord[] | undefined = u.words?.map((w) => ({
      text: w.punctuated_word ?? w.word,
      startSec: w.start,
      endSec: w.end,
      confidence: w.confidence,
    }));
    return {
      id: `u${index + 1}`,
      speakerId: `speaker_${speaker}`,
      speakerLabel: `Speaker ${speaker + 1}`,
      startSec: u.start,
      endSec: u.end,
      confidence: u.confidence,
      text: u.transcript,
      words,
    };
  });

  const fullText =
    utterances.map((u) => `${u.speakerLabel}: ${u.text}`).join("\n") ||
    dg.results?.channels?.[0]?.alternatives?.[0]?.transcript ||
    "";

  return {
    type: "normalized_transcript",
    version: 1,
    source,
    durationSec: dg.metadata?.duration,
    deepgramRequestId: dg.metadata?.request_id,
    summary: dg.results?.summary?.short,
    speakers: inferSpeakers(utterances),
    utterances,
    fullText,
  };
}
