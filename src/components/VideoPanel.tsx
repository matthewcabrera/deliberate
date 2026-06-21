"use client";

import { useEffect, useRef } from "react";

export type MediaSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "file"; url: string }
  | { kind: "webpage"; screenshotUrl: string; pageUrl: string; sessionUrl?: string };

export type SeekFn = (seconds: number) => void;

interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  destroy?: () => void;
}

declare global {
  interface Window {
    YT?: { Player: new (el: HTMLElement, opts: unknown) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function YouTubePlayer({ videoId, registerSeek }: { videoId: string; registerSeek: (fn: SeekFn) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);

  useEffect(() => {
    let cancelled = false;

    const build = () => {
      if (cancelled || !mountRef.current || !window.YT) return;
      playerRef.current = new window.YT.Player(mountRef.current, {
        videoId,
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => {
            registerSeek((seconds: number) => {
              playerRef.current?.seekTo(seconds, true);
              playerRef.current?.playVideo();
            });
          },
        },
      });
    };

    if (window.YT?.Player) {
      build();
    } else {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        build();
      };
      if (!document.getElementById("yt-iframe-api")) {
        const script = document.createElement("script");
        script.id = "yt-iframe-api";
        script.src = "https://www.youtube.com/iframe_api";
        document.body.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [videoId, registerSeek]);

  return (
    <div className="ws-video">
      <div ref={mountRef} className="ws-video-frame" />
    </div>
  );
}

function FilePlayer({ url, registerSeek }: { url: string; registerSeek: (fn: SeekFn) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    registerSeek((seconds: number) => {
      const el = videoRef.current;
      if (!el) return;
      el.currentTime = seconds;
      void el.play();
    });
  }, [registerSeek]);

  return (
    <div className="ws-video">
      <video ref={videoRef} className="ws-video-frame" src={url} controls />
    </div>
  );
}

// Captured web page — show the Browserbase screenshot + a link to the recorded
// session (the evidence/trust layer). No seek.
function WebPagePanel({ media }: { media: Extract<MediaSource, { kind: "webpage" }> }) {
  return (
    <div className="ws-video ws-webpage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ws-screenshot" src={media.screenshotUrl} alt="Captured source page" />
      <div className="bb-evidence">
        <span>captured via Browserbase</span>
        {media.sessionUrl && (
          <a href={media.sessionUrl} target="_blank" rel="noreferrer">
            view session ↗
          </a>
        )}
      </div>
    </div>
  );
}

export default function VideoPanel({
  media,
  registerSeek,
}: {
  media: MediaSource;
  registerSeek: (fn: SeekFn) => void;
}) {
  if (media.kind === "youtube") return <YouTubePlayer videoId={media.videoId} registerSeek={registerSeek} />;
  if (media.kind === "file") return <FilePlayer url={media.url} registerSeek={registerSeek} />;
  return <WebPagePanel media={media} />;
}
