"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AnalyzeResult, Palate, RefineContext, Wine, WineLogEntry } from "@/lib/types";
import { ensureHousehold, householdPalates, learningSignal } from "@/lib/palates";
import { prepareScanImage } from "@/lib/image";
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
const EMPTY_CONTEXT: RefineContext = { occasion: null, dishes: "", intent: null, spend: 50 };

type View = "camera" | "analyzing" | "result";

function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) return { base64: dataUrl, mediaType: "image/jpeg" };
  return { mediaType: match[1] || "image/jpeg", base64: match[2] };
}

export default function Home() {
  const seeded = useMemo(() => householdPalates(), []);
  const [view, setView] = useState<View>("camera");
  const [thinkPhase, setThinkPhase] = useState<"analyze" | "refine">("analyze");
  const [palates, setPalates] = useState<Palate[]>(seeded);
  const [defaultTable, setDefaultTable] = useState<string[]>(seeded.map((p) => p.id));
  const [log, setLog] = useState<WineLogEntry[]>([]);
  const [captured, setCaptured] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [tableNote, setTableNote] = useState("");
  const [refined, setRefined] = useState(false);
  const [refineCtx, setRefineCtx] = useState<RefineContext>(EMPTY_CONTEXT);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [palatesOpen, setPalatesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage. Default table seats Erin & Addison together
  // every time the app opens — flip one off for a solo night.
  /* eslint-disable react-hooks/set-state-in-effect -- one-time localStorage hydrate */
  useEffect(() => {
    try {
      const rawPalates = localStorage.getItem(LS.palates);
      const rawDefault = localStorage.getItem(LS.defaultTable);
      const storedPalates: Palate[] | null = rawPalates ? JSON.parse(rawPalates) : null;
      const storedDefault: string[] | null = rawDefault ? JSON.parse(rawDefault) : null;
      const ensured = ensureHousehold(storedPalates, storedDefault);
      let next = ensured.palates;
      if (ensured.defaultTable.length) {
        next = next.map((p) => ({ ...p, active: ensured.defaultTable.includes(p.id) }));
        if (!next.some((p) => p.active)) next = next.map((p, i) => ({ ...p, active: i < 2 }));
      }
      setPalates(next);
      setDefaultTable(ensured.defaultTable);
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

  const analyze = useCallback(
    async (dataUrl: string) => {
      const prepared = await prepareScanImage(dataUrl);
      const { base64, mediaType } = splitDataUrl(prepared);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mediaType,
            palates: activePalates,
            signal: learningSignal(log),
            known: compactKnown(log),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setResult({ sourceType: "unknown", note: data.error || "Analysis failed.", wines: [], topPick: "" });
        } else {
          const seatedIds = activePalates.map((p) => p.id);
          const wines = lockFits((data as AnalyzeResult).wines ?? [], log, activePalates);
          const next: AnalyzeResult = { ...(data as AnalyzeResult), wines };
          setResult(next);
          if (wines.length) setLog((prev) => upsertLog(prev, wines, next.sourceType, seatedIds, "scan"));
        }
      } catch {
        setResult({
          sourceType: "unknown",
          note: "Couldn't reach SommAI. Check your connection and try again.",
          wines: [],
          topPick: "",
        });
      }
      setView("result");
    },
    [activePalates, log],
  );

  const onCapture = useCallback(
    (dataUrl: string) => {
      setCaptured(dataUrl);
      setResult(null);
      setTableNote("");
      setRefined(false);
      setRefineCtx(EMPTY_CONTEXT);
      setThinkPhase("analyze");
      setView("analyzing");
      analyze(dataUrl);
    },
    [analyze],
  );

  const applyRefine = useCallback(
    async (ctx: RefineContext) => {
      if (!result?.wines.length) return;
      setRefineBusy(true);
      setRefineCtx(ctx);
      setRefineOpen(false);
      setThinkPhase("refine");
      setView("analyzing");
      try {
        const res = await fetch("/api/refine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wines: result.wines, palates: activePalates, context: ctx }),
        });
        const data = await res.json();
        if (res.ok) {
          const byId = new Map<string, Wine["fits"]>(
            (data.rescored ?? []).map((r: { wineId: string; fits: Wine["fits"] }) => [r.wineId, r.fits]),
          );
          const wines = result.wines.map((w) => ({ ...w, fits: byId.get(w.id) ?? w.fits }));
          setResult({
            ...result,
            topPick: data.topPick || result.topPick,
            wines,
          });
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
    [result, activePalates],
  );

  const onHeart = useCallback((wine: Wine) => {
    setLog((prev) => toggleHeart(prev, wine));
  }, []);

  const onPass = useCallback((wine: Wine) => {
    setLog((prev) => toggleDisliked(prev, wine));
  }, []);

  const scanAgain = useCallback(() => {
    setView("camera");
    setResult(null);
    setTableNote("");
    setRefined(false);
    setThinkPhase("analyze");
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
          <Analyzing image={captured} phase={thinkPhase} />
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
          />
        </div>
      )}

      {refineOpen && (
        <RefineSheet
          open={refineOpen}
          busy={refineBusy}
          initial={refineCtx}
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
            const ensured = ensureHousehold(s.palates, s.defaultTable);
            setPalates(ensured.palates);
            setLog(migrateLog(s.journal));
            setDefaultTable(ensured.defaultTable);
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
