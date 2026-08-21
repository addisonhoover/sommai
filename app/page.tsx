"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AnalyzeResult,
  JournalEntry,
  Palate,
  RefineContext,
  Wine,
} from "@/lib/types";
import { learningSignal, starterPalate } from "@/lib/palates";
import { CameraView } from "@/components/CameraView";
import { Analyzing } from "@/components/Analyzing";
import { Results } from "@/components/Results";
import { RefineSheet } from "@/components/RefineSheet";
import { PalatesScreen } from "@/components/PalatesScreen";
import { Journal } from "@/components/Journal";

const LS = { palates: "sommai.v2.palates", journal: "sommai.v2.journal" };
const EMPTY_CONTEXT: RefineContext = { occasion: null, dishes: "", intent: null };

type View = "camera" | "analyzing" | "result";

function splitDataUrl(dataUrl: string): { base64: string; mediaType: string } {
  const match = /^data:(.*?);base64,(.*)$/.exec(dataUrl);
  if (!match) return { base64: dataUrl, mediaType: "image/jpeg" };
  return { mediaType: match[1] || "image/jpeg", base64: match[2] };
}

export default function Home() {
  const [view, setView] = useState<View>("camera");
  const [palates, setPalates] = useState<Palate[]>([starterPalate()]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [captured, setCaptured] = useState<string>("");
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [tableNote, setTableNote] = useState("");
  const [refineCtx, setRefineCtx] = useState<RefineContext>(EMPTY_CONTEXT);
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineBusy, setRefineBusy] = useState(false);
  const [palatesOpen, setPalatesOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hydrate from localStorage
  useEffect(() => {
    try {
      const p = localStorage.getItem(LS.palates);
      if (p) {
        const parsed: Palate[] = JSON.parse(p);
        if (parsed.length) setPalates(parsed);
      }
      const j = localStorage.getItem(LS.journal);
      if (j) setJournal(JSON.parse(j));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(LS.palates, JSON.stringify(palates));
  }, [palates, hydrated]);
  useEffect(() => {
    if (hydrated) localStorage.setItem(LS.journal, JSON.stringify(journal));
  }, [journal, hydrated]);

  const activePalates = useMemo(() => {
    const act = palates.filter((p) => p.active);
    return act.length ? act : palates.slice(0, 1);
  }, [palates]);

  const verdicts = useMemo(() => {
    const map: Record<string, "loved" | "disliked"> = {};
    for (const e of journal) map[e.wine.id] = e.verdict;
    return map;
  }, [journal]);

  const analyze = useCallback(
    async (dataUrl: string) => {
      const { base64, mediaType } = splitDataUrl(dataUrl);
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            mediaType,
            palates: activePalates,
            signal: learningSignal(journal),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setResult({ sourceType: "unknown", note: data.error || "Analysis failed.", wines: [], topPick: "" });
        } else {
          setResult(data as AnalyzeResult);
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
    [activePalates, journal],
  );

  const onCapture = useCallback(
    (dataUrl: string) => {
      setCaptured(dataUrl);
      setResult(null);
      setTableNote("");
      setRefineCtx(EMPTY_CONTEXT);
      setView("analyzing");
      analyze(dataUrl);
    },
    [analyze],
  );

  // Principle #2 — re-rank in place with table context, no re-scan.
  const applyRefine = useCallback(
    async (ctx: RefineContext) => {
      if (!result?.wines.length) return;
      setRefineBusy(true);
      setRefineCtx(ctx);
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
          setResult({
            ...result,
            topPick: data.topPick || result.topPick,
            wines: result.wines.map((w) => ({ ...w, fits: byId.get(w.id) ?? w.fits })),
          });
          setTableNote(data.tableNote ?? "");
          setRefineOpen(false);
        }
      } catch {
        /* keep sheet open so they can retry */
      }
      setRefineBusy(false);
    },
    [result, activePalates],
  );

  const onSave = useCallback((wine: Wine, verdict: "loved" | "disliked") => {
    setJournal((j) => {
      const existing = j.find((e) => e.wine.id === wine.id);
      if (existing && existing.verdict === verdict) {
        return j.filter((e) => e.wine.id !== wine.id);
      }
      return [{ wine, verdict, savedAt: Date.now() }, ...j.filter((e) => e.wine.id !== wine.id)];
    });
  }, []);

  const scanAgain = useCallback(() => {
    setView("camera");
    setResult(null);
    setTableNote("");
  }, []);

  return (
    <>
      {view === "camera" && (
        <CameraView
          palateNames={activePalates.map((p) => p.name)}
          journalCount={journal.length}
          onCapture={onCapture}
          onOpenPalates={() => setPalatesOpen(true)}
          onOpenJournal={() => setJournalOpen(true)}
        />
      )}

      {view === "analyzing" && <Analyzing image={captured} />}

      {view === "result" && result && (
        <Results
          result={result}
          tableNote={tableNote}
          verdicts={verdicts}
          onSave={onSave}
          onScanAgain={scanAgain}
          onOpenRefine={() => setRefineOpen(true)}
        />
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
          journal={journal}
          onChange={setPalates}
          onClose={() => setPalatesOpen(false)}
        />
      )}

      {journalOpen && (
        <Journal
          entries={journal}
          onClose={() => setJournalOpen(false)}
          onRemove={(id) => setJournal((j) => j.filter((e) => e.wine.id !== id))}
        />
      )}
    </>
  );
}
