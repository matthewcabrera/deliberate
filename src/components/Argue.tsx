"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Workspace from "@/components/Workspace";
import { buildLiveTranscript } from "@/lib/live-transcript";
import type { IbisGraph } from "@/lib/contracts";
import { useMic } from "@/lib/use-mic";

type Msg = { role: "you" | "opponent"; text: string };
type Status = "idle" | "recording" | "thinking" | "speaking";

export default function Argue({ onExit }: { onExit: () => void }) {
  const [history, setHistory] = useState<Msg[]>([]);
  const [graph, setGraph] = useState<IbisGraph | null>(null);
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<Status>("idle");
  const historyRef = useRef<Msg[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleUserTurn = useCallback(async (text: string) => {
    const next: Msg[] = [...historyRef.current, { role: "you", text }];
    historyRef.current = next;
    setHistory(next);
    setStatus("thinking");
    try {
      const res = await fetch("/api/argue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ history: next }),
      });
      const data = await res.json();
      const reply = (data.reply || "").trim();
      if (!reply) {
        setStatus("idle");
        return;
      }
      const withReply: Msg[] = [...historyRef.current, { role: "opponent", text: reply }];
      historyRef.current = withReply;
      setHistory(withReply);

      // Map the debate so far (fire-and-forget).
      void (async () => {
        const transcript = buildLiveTranscript(
          withReply.map((m) => ({ speaker: m.role === "you" ? "You" : "Opponent", text: m.text })),
          "Live debate",
        );
        const mapRes = await fetch("/api/extract-ibis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        });
        const mapData = await mapRes.json();
        if (mapRes.ok) {
          setGraph(mapData.graph as IbisGraph);
          setVersion((v) => v + 1);
        }
      })();

      // Speak the rebuttal via Deepgram Aura.
      setStatus("speaking");
      const ttsRes = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      if (!ttsRes.ok) {
        setStatus("idle");
        return;
      }
      const url = URL.createObjectURL(await ttsRes.blob());
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      audio.onended = () => {
        setStatus("idle");
        URL.revokeObjectURL(url);
      };
      await audio.play().catch(() => setStatus("idle"));
    } catch {
      setStatus("idle");
    }
  }, []);

  const mic = useMic(handleUserTurn);

  const toggleMic = () => {
    if (status === "recording") {
      mic.endTurn();
      setStatus("thinking");
    } else if (status === "idle") {
      void mic.startTurn();
      setStatus("recording");
    }
  };

  const handleExit = () => {
    mic.release();
    audioRef.current?.pause();
    onExit();
  };

  const opponentLast = [...history].reverse().find((m) => m.role === "opponent");
  const busy = status === "thinking" || status === "speaking";
  const statusLabel =
    status === "recording"
      ? "listening…"
      : status === "thinking"
        ? "thinking…"
        : status === "speaking"
          ? "opponent speaking…"
          : history.length
            ? "your turn"
            : "state your position to begin";

  const micButton = (big = false) => (
    <button
      type="button"
      className={`argue-mic${big ? " big" : ""}${status === "recording" ? " on" : ""}`}
      onClick={toggleMic}
      disabled={busy}
    >
      {status === "recording" ? "■ stop" : "● speak"}
    </button>
  );

  if (!graph) {
    return (
      <main className="screen">
        <div className="crumb">
          <button type="button" className="crumb-back" onClick={handleExit} aria-label="Back">
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <span className="crumb-label">deliberate</span>
        </div>
        <div className="stage stage-center">
          <div className="live-listening">
            <p className="label">argue</p>
            <p className="phase">{statusLabel}</p>
            {micButton(true)}
            {opponentLast && <p className="argue-reply">{opponentLast.text}</p>}
            <button type="button" className="text-action" onClick={handleExit}>
              exit
            </button>
          </div>
        </div>
      </main>
    );
  }

  const transcript = buildLiveTranscript(
    history.map((m) => ({ speaker: m.role === "you" ? "You" : "Opponent", text: m.text })),
    "Live debate",
  );

  return (
    <main className="app-shell">
      <Workspace key={version} transcript={transcript} graph={graph} onExit={handleExit} />
      <div className="argue-bar">
        {micButton()}
        <div className="argue-status">
          <p className="argue-state">{statusLabel}</p>
          {opponentLast && <p className="argue-reply">{opponentLast.text}</p>}
        </div>
        <button type="button" className="live-stop" onClick={handleExit}>
          exit
        </button>
      </div>
    </main>
  );
}
