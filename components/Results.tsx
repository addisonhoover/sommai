"use client";

import type { AnalyzeResult, Wine } from "@/lib/types";
import { WineCard } from "./WineCard";
import { CameraIcon, ChevronLeft, TuneIcon } from "./icons";

function bestScore(w: Wine): number {
  return Math.max(0, ...w.fits.map((f) => f.score));
}

export function Results({
  result,
  tableNote,
  verdicts,
  onSave,
  onScanAgain,
  onOpenRefine,
}: {
  result: AnalyzeResult;
  tableNote: string;
  verdicts: Record<string, "loved" | "disliked">;
  onSave: (wine: Wine, v: "loved" | "disliked") => void;
  onScanAgain: () => void;
  onOpenRefine: () => void;
}) {
  const wines = [...result.wines].sort((a, b) => bestScore(b) - bestScore(a));
  const topName = result.topPick || wines[0]?.name;

  return (
    <div className="min-h-[100dvh] bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={onScanAgain} className="flex items-center gap-1.5 text-cream" aria-label="Scan again">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Scan</span>
        </button>
        <p className="wordmark text-[15px]">
          Somm<span className="text-burgundy-light">AI</span>
        </p>
        <button
          onClick={onOpenRefine}
          className="flex items-center gap-1.5 text-burgundy-light"
          aria-label="Refine for this table"
        >
          <TuneIcon className="h-4 w-4" />
          <span className="text-[14px]">Refine</span>
        </button>
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-28 pt-6">
        {wines.length === 0 ? (
          <div className="mt-24 flex flex-col items-center px-6 text-center">
            <p className="text-[15px] leading-relaxed text-muted">
              {result.note ||
                "No wine could be read from that photo. Try again with a clearer, well-lit shot of the menu or label."}
            </p>
            <button
              onClick={onScanAgain}
              className="mt-8 flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink"
            >
              <CameraIcon className="h-5 w-5" />
              Scan again
            </button>
          </div>
        ) : (
          <>
            <p className="eyebrow mb-1">
              {result.sourceType === "menu"
                ? `${wines.length} ${wines.length === 1 ? "wine" : "wines"} on this list`
                : "Bottle analysis"}
            </p>
            <h2 className="text-[22px] font-semibold tracking-tight text-cream">
              Matched to your table
            </h2>
            {tableNote && (
              <p className="animate-fade-in mt-3 rounded-2xl border border-burgundy-light/30 bg-burgundy/10 px-4 py-3 text-[13px] leading-relaxed text-cream/90">
                {tableNote}
              </p>
            )}
            <div className="mt-6 space-y-5">
              {wines.map((w) => (
                <WineCard
                  key={w.id}
                  wine={w}
                  isTopPick={wines.length > 1 && w.name === topName}
                  verdict={verdicts[w.id]}
                  onSave={(v) => onSave(w, v)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {wines.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex justify-center bg-gradient-to-t from-ink via-ink/90 to-transparent px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6">
          <button
            onClick={onScanAgain}
            className="flex items-center gap-2 rounded-full bg-cream px-7 py-3.5 text-[15px] font-medium text-ink shadow-lg shadow-black/40"
          >
            <CameraIcon className="h-5 w-5" />
            Scan another
          </button>
        </div>
      )}
    </div>
  );
}
