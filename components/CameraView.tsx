"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CameraIcon, GlassMark, JournalIcon, PalateIcon, UploadIcon } from "./icons";

// Principle #1: instant camera. No splash, no gate — the camera starts
// the moment this mounts. The wordmark fades in OVER the warming
// viewfinder and never blocks the shutter.
export function CameraView({
  palateNames,
  logCount,
  onCapture,
  onOpenPalates,
  onOpenLog,
}: {
  palateNames: string[];
  logCount: number;
  onCapture: (dataUrl: string) => void;
  onOpenPalates: () => void;
  onOpenLog: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [camState, setCamState] = useState<"idle" | "live" | "denied">("idle");
  const [brandGone, setBrandGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBrandGone(true), 1600);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCamState("live");
      } catch {
        setCamState("denied");
      }
    }
    start();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || camState !== "live") {
      fileRef.current?.click();
      return;
    }
    const w = video.videoWidth || 1080;
    const h = video.videoHeight || 1440;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    onCapture(canvas.toDataURL("image/jpeg", 0.85));
  }, [camState, onCapture]);

  const onFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") onCapture(reader.result);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [onCapture],
  );

  const palateLabel =
    palateNames.length === 2
      ? `${palateNames[0]} & ${palateNames[1]}`
      : palateNames.length > 1
        ? palateNames.join(" · ")
        : palateNames[0] ?? "The table";

  return (
    <div className="relative flex h-[100dvh] flex-col bg-ink">
      {/* viewfinder */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            camState === "live" ? "opacity-100" : "opacity-0"
          }`}
        />
        {camState !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
            <GlassMark className="h-12 w-9 text-burgundy-light/70" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              {camState === "denied"
                ? "Camera unavailable. Tap the shutter to upload a photo of a wine menu or label instead."
                : "Opening the camera…"}
            </p>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-ink/70 via-transparent to-ink/85" />
        <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 aspect-[3/4] rounded-2xl border border-cream/15" />
      </div>

      {/* wordmark — overlays the live camera, fades out, never blocks */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/4 z-20 flex flex-col items-center transition-opacity duration-700 ${
          brandGone ? "opacity-0" : "opacity-100"
        }`}
      >
        <h1 className="wordmark text-3xl text-cream drop-shadow-lg">
          Somm<span className="text-burgundy-light">AI</span>
        </h1>
      </div>

      {/* top bar */}
      <div className="relative z-10 flex items-center justify-between px-5 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={onOpenPalates}
          className="flex max-w-[70%] items-center gap-2 rounded-full border border-hairline bg-ink/40 px-3.5 py-2 backdrop-blur-md"
        >
          <PalateIcon className="h-4 w-4 shrink-0 text-burgundy-light" />
          <span className="flex min-w-0 flex-col items-start">
            <span className="text-[9px] uppercase tracking-[0.22em] text-burgundy-light">The table</span>
            <span className="truncate text-[13px] font-medium text-cream">{palateLabel}</span>
          </span>
        </button>
        <button
          onClick={onOpenLog}
          className="relative grid h-10 w-10 place-items-center rounded-full border border-hairline bg-ink/40 backdrop-blur-md"
          aria-label="Wine log"
        >
          <JournalIcon className="h-5 w-5 text-cream" />
          {logCount > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-burgundy px-1 text-[11px] font-semibold text-cream">
              {logCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex-1" />

      {/* shutter row */}
      <div className="relative z-10 flex items-center justify-center gap-10 px-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <button
          onClick={() => fileRef.current?.click()}
          className="grid h-12 w-12 place-items-center rounded-full border border-hairline text-cream/80"
          aria-label="Upload a photo"
        >
          <UploadIcon className="h-5 w-5" />
        </button>

        <button onClick={shoot} className="group relative grid place-items-center" aria-label="Scan wine">
          <span className="absolute h-[78px] w-[78px] rounded-full border border-cream/80 transition group-active:scale-95" />
          <span className="grid h-[64px] w-[64px] place-items-center rounded-full bg-cream transition group-active:scale-90">
            <CameraIcon className="h-7 w-7 text-ink" />
          </span>
        </button>

        <div className="h-12 w-12" aria-hidden />
      </div>

      <p className="relative z-10 pb-3 text-center text-[11px] tracking-wide text-faint">
        Point at a wine list or bottle label
      </p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
    </div>
  );
}
