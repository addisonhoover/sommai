"use client";

import { useMemo, useRef, useState } from "react";
import type { AnalyzeResult, Wine } from "@/lib/types";
import { WineCard } from "./WineCard";
import { CameraIcon, ChevronLeft, TuneIcon } from "./icons";

function bestScore(w: Wine): number {
  return Math.max(0, ...w.fits.map((f) => f.score));
}

const INITIAL_COUNT = 3;

function folio(n: number): string {
  return String(n).padStart(2, "0");
}

// Results read like a wine list — pages that turn, not a scroll.
// Up to three picks to start; anything beyond unlocks on refine or demand.
export function Results({
  result,
  tableNote,
  refined,
  flags,
  onHeart,
  onPass,
  onScanAgain,
  onOpenRefine,
}: {
  result: AnalyzeResult;
  tableNote: string;
  refined: boolean;
  flags: Record<string, { hearted: boolean; disliked: boolean }>;
  onHeart: (wine: Wine) => void;
  onPass: (wine: Wine) => void;
  onScanAgain: () => void;
  onOpenRefine: () => void;
}) {
  const [expandedByUser, setExpandedByUser] = useState(false);
  const [page, setPage] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const expanded = refined || expandedByUser;

  const sorted = useMemo(
    () => [...result.wines].sort((a, b) => bestScore(b) - bestScore(a)),
    [result.wines],
  );
  const shown = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);
  const hidden = sorted.length - shown.length;
  const extraPage = !expanded && hidden > 0;
  const pageCount = shown.length + (extraPage ? 1 : 0);
  const topName = result.topPick || sorted[0]?.name;
  const isList = shown.length > 1 || extraPage;

  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const w = rail.clientWidth;
    if (w > 0) setPage(Math.round(rail.scrollLeft / w));
  };

  const goTo = (i: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: i * rail.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-ink">
      <header className="z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
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

      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
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
          <div className="px-5 pt-4">
            <p className="eyebrow">
              {expanded
                ? `All ${sorted.length} wines · best fit first`
                : isList
                  ? `The list · ${shown.length} picks`
                  : result.sourceType === "label"
                    ? "This bottle"
                    : "Tonight’s pick"}
            </p>
            {tableNote && (
              <p className="animate-fade-in mt-3 rounded-2xl border border-burgundy-light/30 bg-burgundy/10 px-4 py-3 text-[13px] leading-relaxed text-cream/90">
                {tableNote}
              </p>
            )}
          </div>

          <div
            ref={railRef}
            onScroll={onRailScroll}
            className="wine-rail no-scrollbar mt-3 flex flex-1 snap-x snap-mandatory overflow-x-auto"
          >
            {shown.map((w, i) => (
              <div
                key={w.id}
                className={`wine-page no-scrollbar h-full w-full shrink-0 snap-start overflow-y-auto px-4 pb-4 ${
                  i === page ? "wine-page-active" : ""
                }`}
              >
                {isList && (
                  <p className="mb-2 text-right text-[11px] tracking-[0.28em] text-faint">
                    {folio(i + 1)} / {folio(shown.length)}
                  </p>
                )}
                <WineCard
                  wine={w}
                  isTopPick={sorted.length > 1 && w.name === topName}
                  hearted={flags[w.id]?.hearted}
                  disliked={flags[w.id]?.disliked}
                  onHeart={() => onHeart(w)}
                  onPass={() => onPass(w)}
                />
                <div className="h-2" />
              </div>
            ))}
            {extraPage && (
              <div className="wine-page flex h-full w-full shrink-0 snap-start flex-col items-center justify-center px-10">
                <p className="eyebrow">There&apos;s more on the list</p>
                <p className="mt-3 max-w-[26ch] text-center text-[14px] leading-relaxed text-muted">
                  {hidden} more {hidden === 1 ? "wine" : "wines"} were read from this menu.
                </p>
                <button
                  onClick={() => setExpandedByUser(true)}
                  className="mt-6 rounded-full border border-hairline px-6 py-3 text-[14px] text-cream hover:border-burgundy-light/50"
                >
                  Show the full list
                </button>
                <button onClick={onOpenRefine} className="mt-4 text-[13px] text-burgundy-light">
                  or refine for tonight first
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            {pageCount > 1 && (
              <div className="flex items-center gap-2">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => goTo(i)}
                    aria-label={`Page ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      i === page ? "w-5 bg-burgundy-light" : "w-1.5 bg-hairline"
                    }`}
                  />
                ))}
              </div>
            )}
            {isList && pageCount > 1 && (
              <p className="text-[11px] tracking-wide text-faint">Turn the page</p>
            )}
            <button
              onClick={onScanAgain}
              className="flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink shadow-lg shadow-black/40"
            >
              <CameraIcon className="h-5 w-5" />
              Scan another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
