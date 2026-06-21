"use client";

import { useEffect, useRef, useState } from "react";
import Workspace from "@/components/Workspace";
import Observe from "@/components/Observe";
import Argue from "@/components/Argue";
import type { MediaSource } from "@/components/VideoPanel";
import { demoYoutubeUrl } from "@/lib/demo-data";
import type { IbisGraph, NormalizedTranscript, SpeakerProfile } from "@/lib/contracts";
import deliberateLogo from "../../deliberate logo no bg.png";

function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
  return m ? m[1] : null;
}

type Screen = "menu" | "upload" | "processing" | "workspace" | "browse" | "observe" | "argue";
type UploadMode = "youtube" | "media" | "transcript";
type Phase = "transcribing" | "mapping" | "done" | "error";

const menuItems: { key: Screen; word: string }[] = [
  { key: "upload", word: "upload" },
  { key: "browse", word: "browse" },
  { key: "observe", word: "observe" },
  { key: "argue", word: "argue" },
];


function InkMark() {
  return (
    <div className="ink-mark" aria-hidden="true">
      <svg width="100%" height="100%" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <g fill="none" stroke="rgba(27,23,19,0.06)" strokeWidth="2">
          <path d="M120 720 C 300 600, 360 760, 520 660 S 760 560, 900 660" />
          <path d="M90 780 C 280 690, 380 820, 560 720 S 800 650, 940 720" />
          <path d="M160 660 C 320 560, 420 700, 600 600" strokeWidth="1.4" />
        </g>
        <g fill="rgba(27,23,19,0.05)">
          <circle cx="250" cy="250" r="2.2" />
          <circle cx="780" cy="200" r="1.8" />
          <circle cx="680" cy="820" r="2.4" />
        </g>
      </svg>
    </div>
  );
}

// Parse a pasted transcript ("Name: line") into a minimal normalized transcript
// so the IBIS extractor can run without audio.
function transcriptFromText(text: string): NormalizedTranscript {
  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const labelToId = new Map<string, string>();
  let cursor = 0;
  const utterances = lines.map((line, index) => {
    const match = line.match(/^([^:]{1,40}):\s*(.+)$/);
    const label = match ? match[1].trim() : "Speaker 1";
    const body = match ? match[2].trim() : line;
    if (!labelToId.has(label)) labelToId.set(label, `speaker_${labelToId.size}`);
    const start = cursor;
    cursor += Math.max(3, Math.round(body.split(/\s+/).length / 2.5));
    return {
      id: `u${index + 1}`,
      speakerId: labelToId.get(label)!,
      speakerLabel: label,
      startSec: start,
      endSec: cursor,
      confidence: 1,
      text: body,
    };
  });

  const speakers: SpeakerProfile[] = [...labelToId.entries()].map(([label, id]) => ({
    id,
    label,
    inferredName: /^speaker/i.test(label) ? undefined : label,
    confidence: /^speaker/i.test(label) ? "low" : "high",
  }));

  return {
    type: "normalized_transcript",
    version: 1,
    source: { id: "src_paste", inputUrl: "pasted-transcript", sourceType: "transcript", title: "Pasted transcript" },
    durationSec: cursor,
    speakers,
    utterances,
    fullText: lines.join("\n"),
  };
}

export default function Home() {
  const [showSplash, setShowSplash] = useState(true);
  const [screen, setScreen] = useState<Screen>("menu");
  const [uploadMode, setUploadMode] = useState<UploadMode | null>(null);

  const [sourceUrl, setSourceUrl] = useState(demoYoutubeUrl);
  const [pasted, setPasted] = useState("");
  const [browseUrl, setBrowseUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("transcribing");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<NormalizedTranscript | null>(null);
  const [graph, setGraph] = useState<IbisGraph | null>(null);
  const [media, setMedia] = useState<MediaSource | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2400);
    return () => clearTimeout(t);
  }, []);

  async function extract(activeTranscript: NormalizedTranscript, jobId?: string) {
    setPhase("mapping");
    const res = await fetch("/api/extract-ibis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: activeTranscript, jobId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Mapping failed.");
    setGraph(data.graph as IbisGraph);
    setPhase("done");
    setScreen("workspace");
  }

  async function runTranscribe(init: RequestInit) {
    setScreen("processing");
    setPhase("transcribing");
    setErrorMsg(null);
    setGraph(null);
    setTranscript(null);
    try {
      const res = await fetch("/api/transcribe", init);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed.");
      const t = data.transcript as NormalizedTranscript;
      setTranscript(t);
      await extract(t, data.jobId as string);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Something failed.");
      setPhase("error");
    }
  }

  function runYoutube() {
    const url = sourceUrl.trim();
    if (!url) return;
    const id = youtubeId(url);
    setMedia(id ? { kind: "youtube", videoId: id } : null);
    runTranscribe({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ youtubeUrl: url }),
    });
  }

  function runMedia(file: File) {
    setMedia({ kind: "file", url: URL.createObjectURL(file) });
    const form = new FormData();
    form.append("file", file);
    runTranscribe({ method: "POST", body: form });
  }

  async function runTranscriptPaste() {
    if (!pasted.trim()) return;
    setMedia(null);
    setScreen("processing");
    setErrorMsg(null);
    setGraph(null);
    try {
      const t = transcriptFromText(pasted);
      setTranscript(t);
      await extract(t);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Mapping failed.");
      setPhase("error");
    }
  }

  async function runBrowse() {
    const url = browseUrl.trim();
    if (!url) return;
    setMedia(null);
    setScreen("processing");
    setPhase("transcribing");
    setErrorMsg(null);
    setGraph(null);
    setTranscript(null);
    try {
      const res = await fetch("/api/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Capture failed.");
      const t = data.transcript as NormalizedTranscript;
      setTranscript(t);
      setMedia(
        data.screenshot
          ? { kind: "webpage", screenshotUrl: data.screenshot as string, pageUrl: url, sessionUrl: data.replayUrl }
          : null,
      );
      await extract(t, data.jobId as string);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Capture failed.");
      setPhase("error");
    }
  }

  function toMenu() {
    setScreen("menu");
    setUploadMode(null);
  }

  // ---- Workspace is full-bleed ----
  if (screen === "workspace") {
    return (
      <main className="app-shell">
        <Workspace
          transcript={transcript ?? undefined}
          graph={graph ?? undefined}
          media={media ?? undefined}
          onExit={toMenu}
        />
      </main>
    );
  }

  // ---- Live Deepgram modes are self-contained, full-bleed screens ----
  if (screen === "observe") return <Observe onExit={toMenu} />;
  if (screen === "argue") return <Argue onExit={toMenu} />;

  return (
    <>
      {showSplash && (
        <div className="deliberate-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="splash-mark" src={deliberateLogo.src} alt="" />
          <p className="wordmark ink-text">deliberate</p>
        </div>
      )}

      <main className="screen">
        <InkMark />

        {screen !== "menu" && (
          <button type="button" className="crumb" onClick={toMenu}>
            deliberate
          </button>
        )}

        {screen === "menu" && (
          <div className="stage">
            <nav className="menu" aria-label="Main menu">
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setScreen(item.key);
                    if (item.key !== "upload") setUploadMode(null);
                  }}
                >
                  <span className="word ink-text">{item.word}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {screen === "upload" && (
          <div className="stage">
            <nav className="menu compact" aria-label="Source type">
              <button type="button" className="menu-item" onClick={() => setUploadMode("youtube")}>
                <span className="word ink-text">youtube</span>
              </button>
              <button type="button" className="menu-item" onClick={() => setUploadMode("media")}>
                <span className="word ink-text">mp4 / audio</span>
              </button>
              <button type="button" className="menu-item" onClick={() => setUploadMode("transcript")}>
                <span className="word ink-text">transcript</span>
              </button>
            </nav>

            {uploadMode === "youtube" && (
              <div className="mode-field">
                <input
                  className="quiet-input"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="paste a youtube link"
                />
                <button type="button" className="primary-action" onClick={runYoutube}>
                  deliberate
                </button>
              </div>
            )}

            {uploadMode === "media" && (
              <div className="mode-field">
                <button type="button" className="primary-action" onClick={() => fileInputRef.current?.click()}>
                  choose a file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) runMedia(file);
                    e.target.value = "";
                  }}
                />
              </div>
            )}

            {uploadMode === "transcript" && (
              <div className="mode-field">
                <textarea
                  className="quiet-input"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder={"Moderator: Should cities restrict cars downtown?\nMaya: Yes — cleaner air and safer streets.\nJonas: It can punish workers far from transit."}
                />
                <button type="button" className="primary-action" onClick={runTranscriptPaste}>
                  deliberate
                </button>
              </div>
            )}
          </div>
        )}

        {screen === "processing" && (
          <div className="stage stage-center">
            {phase === "error" ? (
              <div className="placeholder-mode">
                <h2>could not deliberate</h2>
                <p>{errorMsg}</p>
                <button type="button" className="text-action" onClick={() => setScreen("upload")}>
                  try again
                </button>
              </div>
            ) : (
              <div className="deliberating">
                <div className="spinner-ring" />
                <div>
                  <p className="label">deliberating</p>
                  <p className="phase">
                    {phase === "transcribing"
                      ? "reading the source"
                      : phase === "mapping"
                        ? "mapping the argument"
                        : "ready"}
                  </p>
                  {transcript && (
                    <p className="detail">
                      {transcript.utterances.length} utterances · {transcript.speakers?.length ?? 0} speakers
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "browse" && (
          <div className="stage">
            <div className="mode-field">
              <input
                className="quiet-input"
                value={browseUrl}
                onChange={(e) => setBrowseUrl(e.target.value)}
                placeholder="paste an article or debate URL"
              />
              <button type="button" className="primary-action" onClick={runBrowse}>
                deliberate
              </button>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
