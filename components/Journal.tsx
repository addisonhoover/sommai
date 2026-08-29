"use client";

import { useMemo, useState } from "react";
import type { WineLogEntry } from "@/lib/types";
import { sortLog, type LogSort } from "@/lib/wine";
import { ChevronLeft, GlassMark, HeartIcon } from "./icons";

const SORTS: { id: LogSort; label: string }[] = [
  { id: "recent", label: "Recent" },
  { id: "hearted", label: "Hearted" },
  { id: "fit", label: "Best fit" },
  { id: "name", label: "A–Z" },
];

export function WineLog({
  entries,
  onClose,
  onHeart,
  onRemove,
}: {
  entries: WineLogEntry[];
  onClose: () => void;
  onHeart: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [sort, setSort] = useState<LogSort>("recent");
  const shown = useMemo(() => sortLog(entries, sort), [entries, sort]);
  const heartedCount = entries.filter((e) => e.hearted).length;

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={onClose} className="flex items-center gap-1.5 text-cream">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Back</span>
        </button>
        <p className="text-[15px] font-semibold text-cream">Wine Log</p>
        <div className="w-14" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {entries.length === 0 ? (
          <div className="mt-28 flex flex-col items-center px-8 text-center">
            <GlassMark className="h-12 w-9 text-burgundy-light/60" />
            <p className="mt-6 text-[15px] leading-relaxed text-muted">
              Every bottle you scan lives here. Heart the ones that matter.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[12.5px] text-muted">
              {entries.length} {entries.length === 1 ? "bottle" : "bottles"}
              {heartedCount > 0 ? ` · ${heartedCount} hearted` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12px] transition ${
                    sort === s.id
                      ? "border-burgundy-light bg-burgundy/25 text-cream"
                      : "border-hairline text-muted hover:text-cream"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {shown.map((e) => {
                const w = e.wine;
                const label = [w.producer, w.name].filter(Boolean).join(" ").trim() || w.name;
                const sub = [w.vintage, w.region].filter(Boolean).join(" · ");
                const best = Math.max(0, ...w.fits.map((f) => f.score));
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 rounded-2xl border bg-surface p-3.5 ${
                      e.hearted ? "border-burgundy-light/40" : "border-hairline"
                    } ${e.disliked ? "opacity-70" : ""}`}
                  >
                    <div className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-surface-2">
                      <GlassMark className="h-6 w-4 text-burgundy-light/60" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-cream">{label}</p>
                      {sub && <p className="truncate text-[12px] text-muted">{sub}</p>}
                      <p className="mt-0.5 text-[11px] text-faint">
                        Fit {best}
                        {e.scanCount > 1 ? ` · seen ${e.scanCount}×` : ""}
                        {e.disliked ? " · not for me" : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => onHeart(w.id)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-burgundy-light"
                      aria-label={e.hearted ? "Unheart" : "Heart"}
                    >
                      <HeartIcon filled={e.hearted} className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => onRemove(w.id)}
                      className="text-[11px] text-faint hover:text-cream"
                      aria-label="Remove from log"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
