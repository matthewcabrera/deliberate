import type { NormalizedTranscript } from "@/lib/contracts";

export interface LiveTurn {
  speaker: string;
  text: string;
}

// Wrap live turns (observe utterances or argue exchanges) into the transcript
// shape so the existing IBIS extractor maps them unchanged.
export function buildLiveTranscript(turns: LiveTurn[], title: string): NormalizedTranscript {
  const speakerIds = new Map<string, string>();
  const utterances = turns.map((t, i) => {
    let sid = speakerIds.get(t.speaker);
    if (!sid) {
      sid = `spk_${speakerIds.size}`;
      speakerIds.set(t.speaker, sid);
    }
    return {
      id: `u${i + 1}`,
      speakerId: sid,
      speakerLabel: t.speaker,
      startSec: i,
      endSec: i + 1,
      confidence: 1,
      text: t.text,
    };
  });

  const speakers = [...speakerIds.entries()].map(([label, id]) => ({
    id,
    label,
    inferredName: label,
    confidence: "high" as const,
  }));

  return {
    type: "normalized_transcript",
    version: 1,
    source: {
      id: "src_live",
      inputUrl: "live",
      canonicalUrl: "live",
      sourceType: "transcript",
      title,
      fetchedAt: new Date().toISOString(),
    },
    durationSec: utterances.length,
    speakers,
    utterances,
    fullText: turns.map((t) => t.text).join("\n"),
  };
}
