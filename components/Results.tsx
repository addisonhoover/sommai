"use client";

import { useRef, useState } from "react";
import type { AnalyzeResult, PriceBand, ServeStyle, Wine } from "@/lib/types";
import { NO_GLASS_NOTE, UNREADABLE_MENU_NOTE } from "@/lib/menu";
import { WineCard } from "./WineCard";
import { CameraIcon, ChevronLeft, TuneIcon } from "./icons";
import { PriceBandControl } from "./PriceBandControl";

const INITIAL_COUNT = 3;

function folio(n: number): string {
  return String(n).padStart(2, "0");
}

function PagerDots({
  count,
  page,
  onGo,
}: {
  count: number;
  page: number;
  onGo: (i: number) => void;
}) {
  if (count < 2) return null;
  return (
    <div className="flex items-center gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onGo(i)}
          aria-label={`Page ${i + 1}`}
          aria-current={i === page}
          className={`rounded-full transition-all ${
            i === page
              ? "h-3.5 w-9 bg-burgundy-light shadow-[0_0_16px_rgba(192,80,106,0.75)]"
              : "h-3.5 w-3.5 bg-cream/45"
          }`}
        />
      ))}
    </div>
  );
}

function MenuNightControls({
  serve,
  onServe,
  band,
  bandTouched,
  onBandChange,
}: {
  serve: ServeStyle;
  onServe?: (next: ServeStyle) => void;
  band?: PriceBand;
  bandTouched?: boolean;
  onBandChange?: (next: PriceBand) => void;
}) {
  if (!onServe && !onBandChange) return null;
  return (
    <div className="w-full">
      {onServe && (
        <div className="flex rounded-full border border-hairline p-1">
          <button
            type="button"
            onClick={() => onServe("bottle")}
            className={`flex-1 rounded-full py-2 text-[13px] transition ${
              serve === "bottle" ? "bg-burgundy text-cream" : "text-muted"
            }`}
          >
            By the bottle
          </button>
          <button
            type="button"
            onClick={() => onServe("glass")}
            className={`flex-1 rounded-full py-2 text-[13px] transition ${
              serve === "glass" ? "bg-burgundy text-cream" : "text-muted"
            }`}
          >
            By the glass
          </button>
        </div>
      )}
      {onBandChange && band && (
        <div className={onServe ? "mt-4" : ""}>
          <p className="eyebrow">Tonight&apos;s band</p>
          <p className="mt-1 text-left text-[12px] leading-relaxed text-faint">
            A guide, not a wall. Great fits a little outside can still make the three.
          </p>
          <div className="mt-3">
            <PriceBandControl
              band={band}
              touched={bandTouched ?? false}
              serve={serve}
              onChange={onBandChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function WineDeck({
  shown,
  pageCount,
  extraPage,
  hidden,
  isList,
  topName,
  flags,
  onHeart,
  onPass,
  onExpand,
  onOpenRefine,
  onScanAgain,
}: {
  shown: Wine[];
  pageCount: number;
  extraPage: boolean;
  hidden: number;
  isList: boolean;
  topName: string;
  flags: Record<string, { hearted: boolean; disliked: boolean }>;
  onHeart: (wine: Wine) => void;
  onPass: (wine: Wine) => void;
  onExpand: () => void;
  onOpenRefine: () => void;
  onScanAgain: () => void;
}) {
  const [page, setPage] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    const rail = railRef.current;
    if (!rail || i < 0 || i >= pageCount) return;
    const w = rail.clientWidth;
    if (w <= 0) return;
    rail.scrollTo({ left: i * w, behavior: "smooth" });
    setPage(i);
  };

  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const w = rail.clientWidth;
    if (w <= 0) return;
    const next = Math.round(rail.scrollLeft / w);
    if (next !== page && next >= 0 && next < pageCount) setPage(next);
  };

  return (
    <>
      {isList && (
        <div className="mt-3 flex items-center justify-between px-4">
          <PagerDots count={pageCount} page={page} onGo={goTo} />
          <p className="text-[11px] tracking-[0.28em] text-faint">
            {folio(Math.min(page, shown.length - 1) + 1)} / {folio(shown.length)}
          </p>
        </div>
      )}

      <div
        ref={railRef}
        onScroll={onRailScroll}
        className="wine-rail no-scrollbar mt-2 flex min-w-0 w-full flex-1 overflow-x-auto overflow-y-hidden"
      >
        {shown.map((w) => (
          <div key={w.id} className="wine-page no-scrollbar h-full min-w-full w-full shrink-0 overflow-y-auto px-4 pb-4">
            <WineCard
              wine={w}
              isTopPick={shown.length > 1 && w.name === topName}
              hearted={flags[w.id]?.hearted}
              disliked={flags[w.id]?.disliked}
              onHeart={() => onHeart(w)}
              onPass={() => onPass(w)}
            />
            <div className="h-2" />
          </div>
        ))}
        {extraPage && (
          <div className="wine-page flex h-full w-full shrink-0 flex-col items-center justify-center px-10">
            <p className="eyebrow">There&apos;s more on the list</p>
            <p className="mt-3 max-w-[26ch] text-center text-[14px] leading-relaxed text-muted">
              {hidden} more {hidden === 1 ? "wine" : "wines"} were read from this menu.
            </p>
            <button
              onClick={onExpand}
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
        <PagerDots count={pageCount} page={page} onGo={goTo} />
        {isList && pageCount > 1 && (
          <p className="text-[12px] tracking-wide text-muted">Swipe the list</p>
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
  );
}

// Results read like a wine list you push with a thumb — snap pages, not a flip.
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
  serve = "bottle",
  onServe,
  band,
  bandTouched = false,
  onBandChange,
}: {
  result: AnalyzeResult;
  tableNote: string;
  refined: boolean;
  flags: Record<string, { hearted: boolean; disliked: boolean }>;
  onHeart: (wine: Wine) => void;
  onPass: (wine: Wine) => void;
  onScanAgain: () => void;
  onOpenRefine: () => void;
  serve?: ServeStyle;
  onServe?: (next: ServeStyle) => void;
  band?: PriceBand;
  bandTouched?: boolean;
  onBandChange?: (next: PriceBand) => void;
}) {
  const [expandedByUser, setExpandedByUser] = useState(false);
  const isMenu = result.sourceType === "menu";
  const menuGuides = isMenu ? (
    <MenuNightControls
      serve={serve}
      onServe={onServe}
      band={band}
      bandTouched={bandTouched}
      onBandChange={onBandChange}
    />
  ) : null;

  const expanded = refined || expandedByUser;

  const sorted = result.wines;
  const shown = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);
  const hidden = sorted.length - shown.length;
  const extraPage = !expanded && hidden > 0;
  const pageCount = shown.length + (extraPage ? 1 : 0);
  const topName = result.topPick || sorted[0]?.name;
  const isList = shown.length > 1 || extraPage;

  const wineKey = result.wines.map((w) => w.id).join("|");
  const rawNote = result.note?.trim() ?? "";
  const looksJson = rawNote.startsWith("{") || rawNote.startsWith("[");
  const friendlyNote =
    (!looksJson && rawNote) ||
    (serve === "glass" ? NO_GLASS_NOTE : UNREADABLE_MENU_NOTE);
  const glassEmpty = isMenu && serve === "glass" && shown.length === 0 && !result.readFailed;
  const showReadFail = shown.length === 0 && !glassEmpty;

  return (
    <div className="relative flex h-[100dvh] flex-col bg-ink">
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
          {menuGuides && <div className="mb-8 w-full max-w-sm">{menuGuides}</div>}
          {glassEmpty && (
            <>
              <p className="text-[15px] leading-relaxed text-muted">{friendlyNote}</p>
              <button
                onClick={onScanAgain}
                className="mt-8 flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink"
              >
                <CameraIcon className="h-5 w-5" />
                Scan again
              </button>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="px-5 pt-4">
            {menuGuides && <div className="mb-4">{menuGuides}</div>}
            <p className="eyebrow">
              {expanded
                ? `All ${sorted.length} wines · best fit first`
                : isList
                  ? `The list · ${shown.length} picks`
                  : result.sourceType === "label"
                    ? "This bottle"
                    : serve === "glass"
                      ? "Tonight’s pours"
                      : "Tonight’s pick"}
            </p>
            {(tableNote || (!looksJson && rawNote)) && (
              <p className="animate-fade-in mt-3 rounded-2xl border border-burgundy-light/30 bg-burgundy/10 px-4 py-3 text-[13px] leading-relaxed text-cream/90">
                {tableNote || rawNote}
              </p>
            )}
          </div>

          <WineDeck
            key={wineKey}
            shown={shown}
            pageCount={pageCount}
            extraPage={extraPage}
            hidden={hidden}
            isList={isList}
            topName={topName}
            flags={flags}
            onHeart={onHeart}
            onPass={onPass}
            onExpand={() => setExpandedByUser(true)}
            onOpenRefine={onOpenRefine}
            onScanAgain={onScanAgain}
          />
        </>
      )}

      {showReadFail && (
        <div className="absolute inset-0 z-30 flex items-end justify-center bg-ink/75 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-labelledby="read-fail-title"
            aria-describedby="read-fail-body"
            className="w-full max-w-sm rounded-3xl border border-hairline bg-surface p-6 shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
          >
            <p className="eyebrow">The list</p>
            <p id="read-fail-title" className="mt-3 text-[18px] font-semibold text-cream">
              Couldn&apos;t read this page
            </p>
            <p id="read-fail-body" className="mt-3 text-[14px] leading-relaxed text-cream/85">
              {friendlyNote}
            </p>
            <button
              onClick={onScanAgain}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-cream py-3.5 text-[14px] font-medium text-ink"
            >
              <CameraIcon className="h-5 w-5" />
              Snap again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
