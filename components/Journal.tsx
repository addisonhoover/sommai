"use client";

import type { JournalEntry } from "@/lib/types";
import { ChevronLeft, GlassMark, HeartIcon } from "./icons";

export function Journal({
  entries,
  onClose,
  onRemove,
}: {
  entries: JournalEntry[];
  onClose: () => void;
  onRemove: (wineId: string) => void;
}) {
  const loved = entries.filter((e) => e.verdict === "loved");
  const disliked = entries.filter((e) => e.verdict === "disliked");

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={onClose} className="flex items-center gap-1.5 text-cream">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Back</span>
        </button>
        <p className="text-[15px] font-semibold text-cream">Wine Journal</p>
        <div className="w-14" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {entries.length === 0 ? (
          <div className="mt-28 flex flex-col items-center px-8 text-center">
            <GlassMark className="h-12 w-9 text-burgundy-light/60" />
            <p className="mt-6 text-[15px] leading-relaxed text-muted">
              Your saved wines will live here — and every verdict quietly sharpens your palate for
              the next scan.
            </p>
          </div>
        ) : (
          <>
            {loved.length > 0 && <Section title="Loved" items={loved} onRemove={onRemove} />}
            {disliked.length > 0 && <Section title="Not for me" items={disliked} onRemove={onRemove} muted />}
          </>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  items,
  onRemove,
  muted,
}: {
  title: string;
  items: JournalEntry[];
  onRemove: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <section className="mb-8">
      <p className="eyebrow mb-3">
        {title} · {items.length}
      </p>
      <div className="space-y-3">
        {items.map((e) => {
          const w = e.wine;
          const label = [w.producer, w.name].filter(Boolean).join(" ").trim() || w.name;
          const sub = [w.vintage, w.region].filter(Boolean).join(" · ");
          const best = Math.max(0, ...w.fits.map((f) => f.score));
          return (
            <div
              key={w.id}
              className={`flex items-center gap-3 rounded-2xl border border-hairline bg-surface p-3.5 ${
                muted ? "opacity-70" : ""
              }`}
            >
              <div className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-surface-2">
                <GlassMark className="h-6 w-4 text-burgundy-light/60" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-cream">{label}</p>
                {sub && <p className="truncate text-[12px] text-muted">{sub}</p>}
                <p className="mt-0.5 text-[11px] text-faint">Fit {best}</p>
              </div>
              <button
                onClick={() => onRemove(w.id)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-burgundy-light"
                aria-label="Remove from journal"
              >
                <HeartIcon filled className="h-5 w-5" />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
