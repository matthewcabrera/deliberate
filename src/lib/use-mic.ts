"use client";

import { useCallback, useRef, useState } from "react";

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

async function transcribeBlob(blob: Blob): Promise<string> {
  if (!blob.size) return "";
  const res = await fetch("/api/transcribe-chunk", {
    method: "POST",
    headers: { "Content-Type": blob.type || "audio/webm" },
    body: blob,
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { text?: string };
  return (data.text || "").trim();
}

// Mic capture via segmented prerecorded transcription (no WebSocket; the
// Deepgram key never reaches the client). Two usage shapes:
//   - continuous: rolling ~5s segments (observe)
//   - turn: push-to-talk, one segment per turn (argue)
export function useMic(onText: (text: string) => void) {
  const [active, setActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const loopRef = useRef(false);

  const ensureStream = async () => {
    if (!streamRef.current) {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    return streamRef.current;
  };

  const recordSegment = (stream: MediaStream, ms: number) =>
    new Promise<Blob>((resolve) => {
      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream, pickMime() ? { mimeType: pickMime() } : undefined);
      recRef.current = rec;
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
      rec.start();
      window.setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, ms);
    });

  // observe: keep recording back-to-back segments, transcribe each in parallel.
  const startContinuous = useCallback(async () => {
    const stream = await ensureStream();
    loopRef.current = true;
    setActive(true);
    void (async () => {
      while (loopRef.current) {
        const blob = await recordSegment(stream, 5000);
        if (!loopRef.current) break;
        void transcribeBlob(blob).then((t) => {
          if (t) onText(t);
        });
      }
    })();
  }, [onText]);

  const stopContinuous = useCallback(() => {
    loopRef.current = false;
    setActive(false);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // argue: start on press, end on release; transcribe the whole turn.
  const startTurn = useCallback(async () => {
    const stream = await ensureStream();
    setActive(true);
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, pickMime() ? { mimeType: pickMime() } : undefined);
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      const t = await transcribeBlob(blob);
      if (t) onText(t);
    };
    rec.start();
  }, [onText]);

  const endTurn = useCallback(() => {
    setActive(false);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
  }, []);

  const release = useCallback(() => {
    loopRef.current = false;
    setActive(false);
    if (recRef.current && recRef.current.state !== "inactive") recRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  return { active, startContinuous, stopContinuous, startTurn, endTurn, release };
}
