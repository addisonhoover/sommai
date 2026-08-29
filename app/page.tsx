"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResult, Palate, PriceBand, RefineContext, ServeStyle, Wine, WineLogEntry } from "@/lib/types";
import { ensureHousehold, householdPalates, learningSignal, seatDefaultPool } from "@/lib/palates";
import { prepareScanImage } from "@/lib/image";
import { readAnalyzeStream } from "@/lib/analyze-stream";
import { DEFAULT_BAND, defaultBand, rankPicks, retargetWindow, slideWindow } from "@/lib/price";
import {
  compactKnown,
  flagsFor,
  lockFits,
  migrateLog,
  toggleDisliked,
  toggleHeart,
  upsertLog,
} from "@/lib/wine";
import { CameraView } from "@/components/CameraView";
import { Analyzing } from "@/components/Analyzing";
import { Results } from "@/components/Results";
import { RefineSheet } from "@/components/RefineSheet";
import { PalatesScreen } from "@/components/PalatesScreen";
import { WineLog } from "@/components/Journal";

const LS = {
  palates: "sommai.v2.palates",
  journal: "sommai.v2.journal",
  defaultTable: "sommai.v2.defaultTable",
};
const EMPTY_CONTEXT: RefineContext = { occasion: null, dishes: "", intent: null, priceBand: null };

type View = "camera" | "analyzing" | "result";

function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) return { base64: dataUrl, mediaType: "image/jpeg" };
  return { mediaType: match[1] || "image/jpeg", base64: match[2] };
}

export default function Home() {
  const seeded = useMemo(() => householdPalates(), []);
  const [view, setView] = useState<View>("camera");
  const [thinkPhase, setThinkPhase] = useState<"analyze" | "refine" | "glass">("analyze");
  const [palates, setPalates] = useState<Palate[]>(seeded);
  const [defaultTable, setDefaultTable] = useState<string[]>(seeded.map((p) => p.id));
  const [log, setLog] = useState<WineLogEntry[]>([]);
  const [captured, setCaptured] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [bottleResult, setBottleResult] = useState<AnalyzeResult | null>(null);
  const [glassResult, setGlassResult] = useState<AnalyzeResult | null>(null);
  const [tableNote, setTableNote] = useState("");
  const [refined, setRefined] = useState(false);
  const [refineCtx, setRefineCtx] = useState<RefineContext>(EMPTY_CONTEXT);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [palatesOpen, setPalatesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [serve, setServe] = useState<ServeStyle>("bottle");
  const [priceBand, setPriceBand] = useState<PriceBand>(DEFAULT_BAND);
  const [bandTouched, setBandTouched] = useState(false);
  const [thinkMenu, setThinkMenu] = useState(false);
  const [bandSent, setBandSent] = useState(false);

  const viewRef = useRef(view);
  const capturedRef = useRef(captured);
  const serveRef = useRef(serve);
  const bandRef = useRef({ band: priceBand, touched: bandTouched });
  const genRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const bandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    viewRef.current = view;
    capturedRef.current = captured;
    serveRef.current = serve;
    bandRef.current = { band: priceBand, touched: bandTouched };
  }, [view, captured, serve, priceBand, bandTouched]);

  // Hydrate from localStorage. Default table seats Erin & Addison together
  // every time the app opens — flip one off for a solo night.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydrate */
  useEffect(() => {
    try {
      const rawPalates = localStorage.getItem(LS.palates);
      const storedPalates: Palate[] | null = rawPalates ? JSON.parse(rawPalates) : null;
      const ensured = ensureHousehold(storedPalates);
      setDefaultTable(ensured.defaultTable);
      setPalates(seatDefaultPool(ensured.palates, ensured.defaultTable));
      const j = localStorage.getItem(LS.journal);
      if (j) setLog(migrateLog(JSON.parse(j)));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS.palates, JSON.stringify(palates));
  }, [palates, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS.journal, JSON.stringify(log));
  }, [log, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS.defaultTable, JSON.stringify(defaultTable));
  }, [defaultTable, hydrated]);

  const activePalates = useMemo(() => {
    const act = palates.filter((p) => p.active);
    return act.length ? act : palates.slice(0, 1);
  }, [palates]);

  const cacheResult = (next: AnalyzeResult, forServe: ServeStyle) => {
    if (forServe === "glass") setGlassResult(next);
    else setBottleResult(next);
  };

  const analyze = useCallback(
    async (
      dataUrl: string,
      opts?: { priceBand?: PriceBand | null; serve?: ServeStyle; onSent?: () => void },
    ) => {
      const gen = ++genRef.current;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      const thisServe = opts?.serve ?? "bottle";
      const thisBand = opts?.priceBand ?? null;
      const prepared = await prepareScanImage(dataUrl);
      if (gen !== genRef.current) return;
      const { base64, mediaType } = splitDataUrl(prepared);
      const publish = (next: AnalyzeResult) => {
        cacheResult(next, thisServe);
        if (serveRef.current === thisServe) setResult(next);
      };
      try {
        const resPromise = fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            image: base64,
            mediaType,
            palates: activePalates,
            signal: learningSignal(log),
            known: compactKnown(log),
            priceBand: thisBand,
            serve: thisServe,
          }),
        });
        if (gen === genRef.current) opts?.onSent?.();
        const res = await resPromise;
        if (gen !== genRef.current) return;
        if (!res.ok) {
          let err = "Couldn't read that photo. Snap again — a closer page helps.";
          try {
            const data = (await res.json()) as { error?: string };
            if (data.error) err = data.error;
          } catch {
            /* keep fallback */
          }
          setThinkMenu(false);
          setBandSent(false);
          publish({
            sourceType: "unknown",
            note: err,
            wines: [],
            topPick: "",
            readFailed: true,
          });
        } else {
          const data = await readAnalyzeStream(res, (cue) => {
            if (gen !== genRef.current) return;
            if (cue.sourceType === "menu") {
              setThinkMenu(true);
              if (cue.glassOnly && serveRef.current !== "glass") {
                const from = serveRef.current;
                setServe("glass");
                setPriceBand(
                  bandRef.current.touched
                    ? retargetWindow(bandRef.current.band, from, "glass")
                    : defaultBand("glass"),
                );
              }
            } else {
              setThinkMenu(false);
            }
          });
          if (gen !== genRef.current) return;
          if (data.sourceType === "menu") setThinkMenu(true);
          const seatedIds = activePalates.map((p) => p.id);
          const usedServe = serveRef.current;
          const usedBand = bandRef.current.touched ? bandRef.current.band : thisBand;
          const wines = rankPicks(
            lockFits((data as AnalyzeResult).wines ?? [], log, activePalates),
            usedBand,
            usedServe,
          );
          const next: AnalyzeResult = { ...(data as AnalyzeResult), wines };
          cacheResult(next, usedServe);
          setResult(next);
          if (wines.length) setLog((prev) => upsertLog(prev, wines, next.sourceType, seatedIds, "scan"));
        }
      } catch (err) {
        if (ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) return;
        if (gen !== genRef.current) return;
        setThinkMenu(false);
        setBandSent(false);
        publish({
          sourceType: "unknown",
          note: "Couldn't reach SommAI. Check your connection and try again.",
          wines: [],
          topPick: "",
          readFailed: true,
        });
      }
      if (gen !== genRef.current) return;
      setView("result");
    },
    [activePalates, log],
  );

  const onCapture = useCallback(
    (dataUrl: string) => {
      if (bandTimerRef.current) clearTimeout(bandTimerRef.current);
      setCaptured(dataUrl);
      setResult(null);
      setBottleResult(null);
      setGlassResult(null);
      setTableNote("");
      setRefined(false);
      setServe("bottle");
      setPriceBand(DEFAULT_BAND);
      setBandTouched(false);
      setThinkMenu(false);
      setBandSent(false);
      setRefineCtx(EMPTY_CONTEXT);
      setThinkPhase("analyze");
      setView("analyzing");
      analyze(dataUrl, { priceBand: null, serve: "bottle" });
    },
    [analyze],
  );

  const onBandChange = useCallback(
    (next: PriceBand) => {
      setPriceBand(next);
      setBandTouched(true);
      setBandSent(false);
      setRefineCtx((ctx) => ({ ...ctx, priceBand: next }));
      const here = viewRef.current;
      if (here !== "analyzing" && here !== "result") return;
      if (bandTimerRef.current) clearTimeout(bandTimerRef.current);
      bandTimerRef.current = setTimeout(() => {
        const now = viewRef.current;
        if (now !== "analyzing" && now !== "result") return;
        const photo = capturedRef.current;
        if (!photo) return;
        if (now === "result") {
          setThinkPhase("analyze");
          setView("analyzing");
        }
        analyze(photo, {
          priceBand: next,
          serve: serveRef.current,
          onSent: () => setBandSent(true),
        });
      }, 480);
    },
    [analyze],
  );

  const onServe = useCallback(
    (next: ServeStyle) => {
      if (next === serveRef.current) return;
      const prev = serveRef.current;
      const remapped = bandRef.current.touched
        ? retargetWindow(bandRef.current.band, prev, next)
        : slideWindow(0, next);
      const live = bandRef.current.touched ? remapped : null;
      setServe(next);
      setPriceBand(remapped);
      setRefineCtx((ctx) => ({ ...ctx, serve: next, priceBand: live }));
      if (next === "glass" && glassResult) {
        const wines = rankPicks(glassResult.wines, live, "glass");
        const ranked = { ...glassResult, wines };
        setGlassResult(ranked);
        setResult(ranked);
        return;
      }
      if (next === "bottle" && bottleResult) {
        const wines = rankPicks(bottleResult.wines, live, "bottle");
        const ranked = { ...bottleResult, wines };
        setBottleResult(ranked);
        setResult(ranked);
        return;
      }
      const photo = capturedRef.current;
      if (photo) {
        setThinkPhase(next === "glass" ? "glass" : "analyze");
        setView("analyzing");
        analyze(photo, { priceBand: live, serve: next });
      }
    },
    [analyze, bottleResult, glassResult],
  );

  const applyRefine = useCallback(
    async (ctx: RefineContext) => {
      if (!result?.wines.length) return;
      const thisServe = ctx.serve ?? serve;
      setRefineBusy(true);
      setRefineCtx(ctx);
      if (ctx.priceBand) {
        setPriceBand(ctx.priceBand);
        setBandTouched(true);
      }
      setRefineOpen(false);
      setThinkPhase("refine");
      setView("analyzing");
      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wines: result.wines,
            palates: activePalates,
            context: { ...ctx, serve: thisServe },
          }),
        });
        const data = await res.json();
        if (res.ok) {
          const byId = new Map<string, Wine["fits"]>(
            (data.rescored ?? []).map((r: { wineId: string; fits: Wine["fits"] }) => [r.wineId, r.fits]),
          );
          const wines = rankPicks(
            result.wines.map((w) => ({ ...w, fits: byId.get(w.id) ?? w.fits })),
            ctx.priceBand,
            thisServe,
          );
          const next: AnalyzeResult = {
            ...result,
            topPick: data.topPick || result.topPick,
            wines,
          };
          setResult(next);
          cacheResult(next, thisServe);
          setTableNote(data.tableNote ?? "");
          setRefined(true);
          setLog((prev) =>
            upsertLog(prev, wines, result.sourceType, activePalates.map((p) => p.id), "refine"),
          );
        } else {
          setRefineOpen(true);
        }
      } catch {
        setRefineOpen(true);
      }
      setRefineBusy(false);
      setView("result");
    },
    [result, activePalates, serve],
  );

  const onHeart = useCallback((wine: Wine) => {
    setLog((prev) => toggleHeart(prev, wine));
  }, []);

  const onPass = useCallback((wine: Wine) => {
    setLog((prev) => toggleDisliked(prev, wine));
  }, []);

  const scanAgain = useCallback(() => {
    if (bandTimerRef.current) clearTimeout(bandTimerRef.current);
    abortRef.current?.abort();
    genRef.current += 1;
    setView("camera");
    setResult(null);
    setTableNote("");
    setRefined(false);
    setThinkPhase("analyze");
    setThinkMenu(false);
    setBandSent(false);
  }, []);

  return (
    <>
      <div className={view === "camera" ? "relative z-0" : "invisible pointer-events-none absolute inset-0 z-0"}>
        <CameraView
          palateNames={activePalates.map((p) => p.name)}
          logCount={log.length}
          onCapture={onCapture}
          onOpenPalates={() => setPalatesOpen(true)}
          onOpenLog={() => setLogOpen(true)}
        />
      </div>

      {view === "analyzing" && (
        <div className="fixed inset-0 z-20">
          <Analyzing
            image={captured}
            phase={thinkPhase}
            serve={serve}
            band={priceBand}
            bandTouched={bandTouched}
            showBand={thinkPhase !== "refine" && thinkMenu}
            bandSent={bandSent}
            onBandChange={onBandChange}
          />
        </div>
      )}

      {view === "result" && result && (
        <div className="fixed inset-0 z-20">
          <Results
            result={result}
            tableNote={tableNote}
            refined={refined}
            flags={Object.fromEntries(
              (result.wines ?? []).map((w) => [w.id, flagsFor(log, w)]),
            )}
            onHeart={onHeart}
            onPass={onPass}
            onScanAgain={scanAgain}
            onOpenRefine={() => setRefineOpen(true)}
            serve={serve}
            onServe={onServe}
            band={priceBand}
            bandTouched={bandTouched}
            onBandChange={onBandChange}
          />
        </div>
      )}

      {refineOpen && (
        <RefineSheet
          open={refineOpen}
          busy={refineBusy}
          initial={refineCtx}
          serve={serve}
          showBand={result?.sourceType === "menu"}
          onApply={applyRefine}
          onClose={() => setRefineOpen(false)}
        />
      )}

      {palatesOpen && (
        <PalatesScreen
          palates={palates}
          journal={log}
          defaultTable={defaultTable}
          onChange={setPalates}
          onSaveDefault={(ids) => setDefaultTable(ids)}
          onPulled={(s) => {
            const ensured = ensureHousehold(s.palates);
            setDefaultTable(ensured.defaultTable);
            setPalates(seatDefaultPool(ensured.palates, ensured.defaultTable));
            setLog(migrateLog(s.journal));
          }}
          onClose={() => setPalatesOpen(false)}
        />
      )}

      {logOpen && (
        <WineLog
          entries={log}
          onClose={() => setLogOpen(false)}
          onHeart={(id) => {
            const row = log.find((e) => e.wine.id === id);
            if (row) setLog((prev) => toggleHeart(prev, row.wine));
          }}
          onRemove={(id) => setLog((j) => j.filter((e) => e.wine.id !== id))}
        />
      )}
    </>
  );
}
