"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Workspace from "@/components/Workspace";
import { buildLiveTranscript, type LiveTurn } from "@/lib/live-transcript";
import type { IbisGraph } from "@/lib/contracts";
import { useMic } from "@/lib/use-mic";

const MAP_INTERVAL_MS = 20000;

export default function Observe({ onExit }: { onExit: () => void }) {
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [graph, setGraph] = useState<IbisGraph | null>(null);
  const [version, setVersion] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [mapping, setMapping] = useState(false);
  const turnsRef = useRef<LiveTurn[]>([]);
  const lastMapped = useRef(0);

  const onText = useCallback((text: string) => {
    turnsRef.current = [...turnsRef.current, { speaker: "Live", text }];
    setTurns(turnsRef.current);
  }, []);

  const mic = useMic(onText);

  // Start listening on mount; tick the clock; release the mic on exit.
  useEffect(() => {
    void mic.startContinuous();
    const clock = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      window.clearInterval(clock);
      mic.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-extract the IBIS map every ~20s when there's new speech.
  useEffect(() => {
    const id = window.setInterval(async () => {
      const current = turnsRef.current;
      if (current.length <= lastMapped.current) return;
      lastMapped.current = current.length;
      setMapping(true);
      try {
        const transcript = buildLiveTranscript(current, "Live session");
        const res = await fetch("/api/extract-ibis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transcript }),
        });
        const data = await res.json();
        if (res.ok) {
          setGraph(data.graph as IbisGraph);
          setVersion((v) => v + 1);
        }
      } finally {
        setMapping(false);
      }
    }, MAP_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, []);

  const handleExit = () => {
    mic.release();
    onExit();
  };

  const clock = `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const transcript = turns.length ? buildLiveTranscript(turns, "Live session") : undefined;

  if (!graph) {
    return (
      <main className="screen">
        <button type="button" className="crumb" onClick={handleExit}>
          deliberate
        </button>
        <div className="stage stage-center">
          <div className="live-listening">
            <div className="live-dot" />
            <p className="label">observing · {clock}</p>
            <p className="phase">{mapping ? "building the map…" : "listening — the map appears after ~20s"}</p>
            <div className="live-feed">
              {turns.slice(-6).map((t, i) => (
                <p key={i} className="live-line">
                  {t.text}
                </p>
              ))}
            </div>
            <button type="button" className="text-action" onClick={handleExit}>
              stop
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Workspace key={version} transcript={transcript} graph={graph} onExit={handleExit} />
      <div className="live-overlay">
        <span className="live-dot" />
        <span>observing · {clock}</span>
        <span className="live-sep">·</span>
        <span>{turns.length} utterances</span>
        {mapping && <span className="live-sep">· mapping…</span>}
        <button type="button" className="live-stop" onClick={handleExit}>
          stop
        </button>
      </div>
    </main>
  );
}
