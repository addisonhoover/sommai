"use client";

import type { Wine } from "@/lib/types";
import { HeartIcon } from "./icons";

function ringTone(score: number): string {
  return score >= 75 ? "var(--color-burgundy-light)" : score >= 50 ? "#c9a24a" : "var(--color-faint)";
}

// One fit ring. Compact mode is used when several palates share a card.
function FitRing({ score, label, compact }: { score: number; label?: string; compact?: boolean }) {
  const size = compact ? 52 : 68;
  const r = compact ? 21 : 26;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, score));
  const dash = (clamped / 100) * c;
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <div className="relative grid place-items-center" style={{ width: size, height: size }}>
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--color-hairline)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke={ringTone(clamped)} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={`font-semibold leading-none text-cream ${compact ? "text-[14px]" : "text-[17px]"}`}>
            {clamped}
          </span>
          {!compact && <span className="mt-0.5 text-[8px] tracking-[0.2em] text-muted">FIT</span>}
        </div>
      </div>
      {label && <span className="max-w-14 truncate text-[10px] text-muted">{label}</span>}
    </div>
  );
}

function StructureBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= value ? "bg-burgundy-light" : "bg-hairline"}`}
          />
        ))}
      </div>
    </div>
  );
}

export function WineCard({
  wine,
  isTopPick,
  verdict,
  onSave,
}: {
  wine: Wine;
  isTopPick?: boolean;
  verdict?: "loved" | "disliked";
  onSave: (v: "loved" | "disliked") => void;
}) {
  const title = [wine.producer, wine.name].filter(Boolean).join(" ").trim() || wine.name;
  const sub = [wine.vintage, wine.region].filter(Boolean).join(" · ");
  const solo = wine.fits.length <= 1;

  return (
    <article className="animate-fade-up rounded-3xl border border-hairline bg-surface p-6">
      {isTopPick && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-burgundy/20 px-3 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-burgundy-light" />
          <span className="text-[11px] font-medium tracking-wide text-burgundy-light">SOMMAI&apos;S PICK</span>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold leading-tight text-cream">{title}</h3>
          {sub && <p className="mt-1 text-[13px] text-muted">{sub}</p>}
          {wine.varietals.length > 0 && (
            <p className="mt-0.5 text-[13px] text-faint">{wine.varietals.join(", ")}</p>
          )}
        </div>
        {solo ? (
          <FitRing score={wine.fits[0]?.score ?? 0} />
        ) : (
          <div className="flex gap-2">
            {wine.fits.map((f) => (
              <FitRing key={f.palateId} score={f.score} label={f.palateName} compact />
            ))}
          </div>
        )}
      </div>

      {wine.priceText && <p className="mt-3 text-[14px] font-medium text-cream">{wine.priceText}</p>}

      <p className="mt-4 text-[14px] leading-relaxed text-cream/90">{wine.summary}</p>

      <div className="mt-3 space-y-2">
        {wine.fits.map(
          (f) =>
            f.reason && (
              <p
                key={f.palateId}
                className="border-l border-burgundy-light/50 pl-3 text-[13px] italic leading-relaxed text-muted"
              >
                {solo ? f.reason : <><span className="not-italic font-medium text-cream/80">{f.palateName}:</span> {f.reason}</>}
              </p>
            ),
        )}
      </div>

      {wine.flavorNotes.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {wine.flavorNotes.map((n) => (
            <span key={n} className="rounded-full border border-hairline px-3 py-1 text-[12px] text-cream/85">
              {n}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 space-y-2.5">
        <StructureBar label="Body" value={wine.structure.body} />
        <StructureBar label="Tannin" value={wine.structure.tannin} />
        <StructureBar label="Acidity" value={wine.structure.acidity} />
        <StructureBar label="Sweet" value={wine.structure.sweetness} />
      </div>

      {wine.terroir && (
        <div className="mt-6">
          <p className="eyebrow">Terroir</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{wine.terroir}</p>
        </div>
      )}

      {wine.pairings.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Pairs with</p>
          <p className="mt-2 text-[13px] leading-relaxed text-cream/85">{wine.pairings.join(" · ")}</p>
        </div>
      )}

      <div className="mt-6 flex gap-3 border-t border-hairline pt-5">
        <button
          onClick={() => onSave("loved")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[14px] font-medium transition ${
            verdict === "loved"
              ? "bg-burgundy text-cream"
              : "border border-hairline text-cream hover:border-burgundy-light/50"
          }`}
        >
          <HeartIcon filled={verdict === "loved"} className="h-4 w-4" />
          {verdict === "loved" ? "Saved" : "Save"}
        </button>
        <button
          onClick={() => onSave("disliked")}
          className={`rounded-full px-5 py-3 text-[14px] font-medium transition ${
            verdict === "disliked"
              ? "bg-surface-2 text-muted"
              : "border border-hairline text-muted hover:text-cream"
          }`}
        >
          Not for me
        </button>
      </div>
    </article>
  );
}
