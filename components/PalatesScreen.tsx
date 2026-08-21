"use client";

import { useRef, useState } from "react";
import type { JournalEntry, Palate } from "@/lib/types";
import { palateToMarkdown } from "@/lib/palates";
import { ChevronLeft, CloseIcon, DownloadIcon, PlusIcon } from "./icons";

// Principle #3: the palate is living and portable.
// Import a pile of notes to bootstrap it; export it anywhere, anytime.
export function PalatesScreen({
  palates,
  journal,
  onChange,
  onClose,
}: {
  palates: Palate[];
  journal: JournalEntry[];
  onChange: (next: Palate[]) => void;
  onClose: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleActive = (id: string) => {
    onChange(palates.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  const remove = (id: string) => {
    const next = palates.filter((p) => p.id !== id);
    // never allow zero palates — the instant scan must always work
    if (next.length === 0) return;
    if (!next.some((p) => p.active)) next[0] = { ...next[0], active: true };
    onChange(next);
  };

  const exportPalate = (p: Palate) => {
    const md = palateToMarkdown(p, journal);
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sommai-palate-${p.name.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setNotes(reader.result);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const runImport = async () => {
    if (!notes.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, personName: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
      } else {
        const palate: Palate = {
          id: `p-${Date.now()}`,
          name: name.trim() || data.name || `Palate ${palates.length + 1}`,
          active: true,
          summary: data.summary,
          loves: data.loves ?? [],
          avoids: data.avoids ?? [],
          favoriteWines: data.favoriteWines ?? [],
          priceBand: data.priceBand ?? "",
          source: "imported",
          updatedAt: Date.now(),
        };
        // Replace the starter if it's still untouched; otherwise append.
        const rest = palates.filter((p) => p.source !== "starter");
        onChange([...rest, palate]);
        setImporting(false);
        setName("");
        setNotes("");
      }
    } catch {
      setError("Couldn't reach SommAI. Check your connection.");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={onClose} className="flex items-center gap-1.5 text-cream">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Back</span>
        </button>
        <p className="text-[15px] font-semibold text-cream">Palates</p>
        <div className="w-14" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        <p className="text-[13px] leading-relaxed text-muted">
          Active palates get their own fit score on every scan. Import tasting notes to bootstrap a
          profile; it keeps learning from every wine you save.
        </p>

        <div className="mt-6 space-y-4">
          {palates.map((p) => (
            <div key={p.id} className="rounded-3xl border border-hairline bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-cream">{p.name}</h3>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-faint">
                    {p.source === "starter" ? "Starter" : p.source === "imported" ? "Imported" : "Learning"}
                    {" · "}updated {new Date(p.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => toggleActive(p.id)}
                  aria-pressed={p.active}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    p.active ? "bg-burgundy" : "bg-surface-2"
                  }`}
                  aria-label={`${p.active ? "Deactivate" : "Activate"} ${p.name}`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-cream transition-all ${
                      p.active ? "left-6" : "left-1"
                    }`}
                  />
                </button>
              </div>

              <p className="mt-3 text-[13px] leading-relaxed text-cream/85">{p.summary}</p>

              {p.loves.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {p.loves.slice(0, 8).map((x) => (
                    <span key={x} className="rounded-full border border-hairline px-3 py-1 text-[11px] text-cream/80">
                      {x}
                    </span>
                  ))}
                </div>
              )}
              {p.avoids.length > 0 && (
                <p className="mt-3 text-[12px] text-faint">Avoids: {p.avoids.join(", ")}</p>
              )}

              <div className="mt-5 flex gap-3 border-t border-hairline pt-4">
                <button
                  onClick={() => exportPalate(p)}
                  className="flex items-center gap-2 rounded-full border border-hairline px-4 py-2 text-[13px] text-cream hover:border-burgundy-light/50"
                >
                  <DownloadIcon className="h-4 w-4" />
                  Export .md
                </button>
                {palates.length > 1 && (
                  <button
                    onClick={() => remove(p.id)}
                    className="rounded-full px-4 py-2 text-[13px] text-faint hover:text-cream"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!importing ? (
          <button
            onClick={() => setImporting(true)}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-hairline py-5 text-[14px] text-muted hover:text-cream"
          >
            <PlusIcon className="h-4 w-4" />
            Add a palate from tasting notes
          </button>
        ) : (
          <div className="mt-6 rounded-3xl border border-burgundy-light/40 bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-cream">Import a palate</h3>
              <button
                onClick={() => setImporting(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-hairline"
              >
                <CloseIcon className="h-3.5 w-3.5 text-cream" />
              </button>
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whose palate? (e.g. Erin)"
              className="mt-4 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste tasting notes, wine lists, anything — or upload a .md file below. SommAI will distill it into a profile."
              rows={6}
              className="mt-3 w-full resize-none rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[13px] leading-relaxed text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[13px] text-muted underline underline-offset-4 hover:text-cream"
              >
                Upload .md / .txt
              </button>
              <span className="text-[11px] text-faint">{notes.length.toLocaleString()} chars</span>
            </div>
            {error && <p className="mt-3 text-[13px] text-burgundy-light">{error}</p>}
            <button
              disabled={busy || !notes.trim()}
              onClick={runImport}
              className="mt-4 w-full rounded-full bg-cream py-3 text-[14px] font-medium text-ink disabled:opacity-50"
            >
              {busy ? "Distilling the palate…" : "Create palate"}
            </button>
            <input ref={fileRef} type="file" accept=".md,.txt,text/markdown,text/plain" hidden onChange={onFile} />
          </div>
        )}
      </div>
    </div>
  );
}
