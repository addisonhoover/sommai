"use client";

import { useEffect, useRef, useState } from "react";
import type { JournalEntry, Palate } from "@/lib/types";
import { palateToMarkdown } from "@/lib/palates";
import { syncConfigured } from "@/lib/supabase";
import {
  currentUserEmail,
  pullState,
  pushState,
  signIn,
  signOut,
  type CloudState,
} from "@/lib/sync";
import { ChevronLeft, CloseIcon, DownloadIcon, PlusIcon, UploadIcon } from "./icons";

export function PalatesScreen({
  palates,
  journal,
  defaultTable,
  onChange,
  onSaveDefault,
  onPulled,
  onClose,
}: {
  palates: Palate[];
  journal: JournalEntry[];
  defaultTable: string[];
  onChange: (next: Palate[]) => void;
  onSaveDefault: (ids: string[]) => void;
  onPulled: (state: CloudState) => void;
  onClose: () => void;
}) {
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeIds = palates.filter((p) => p.active).map((p) => p.id);
  const defaultMatchesActive =
    defaultTable.length === activeIds.length && activeIds.every((id) => defaultTable.includes(id));
  const defaultNames = palates
    .filter((p) => defaultTable.includes(p.id))
    .map((p) => p.name)
    .join(" · ");

  const toggleActive = (id: string) => {
    onChange(palates.map((p) => (p.id === id ? { ...p, active: !p.active } : p)));
  };

  const remove = (id: string) => {
    const next = palates.filter((p) => p.id !== id);
    if (next.length === 0) return; // the instant scan must always work
    if (!next.some((p) => p.active)) next[0] = { ...next[0], active: true };
    onChange(next);
    if (defaultTable.includes(id)) onSaveDefault(defaultTable.filter((x) => x !== id));
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
      if (typeof reader.result === "string") {
        setNotes(reader.result);
        setImporting(true);
      }
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
        <p className="text-[15px] font-semibold text-cream">The Table</p>
        <div className="w-14" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {/* ---- import: front and center ---- */}
        {!importing ? (
          <div className="flex gap-3">
            <button
              onClick={() => setImporting(true)}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-burgundy py-4 text-[14px] font-medium text-cream"
            >
              <PlusIcon className="h-4 w-4" />
              Import a palate
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-2xl border border-hairline px-5 text-[14px] text-cream"
            >
              <UploadIcon className="h-4 w-4" />
              File
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-burgundy-light/40 bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-cream">Import a palate</h3>
              <button
                onClick={() => setImporting(false)}
                className="grid h-8 w-8 place-items-center rounded-full border border-hairline"
              >
                <CloseIcon className="h-3.5 w-3.5 text-cream" />
              </button>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              Paste anything — tasting notes, wine lists, a doc you and Erin have been keeping. Or
              upload the file itself. SommAI distills it into a profile.
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whose palate? (e.g. Erin)"
              className="mt-4 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste the notes here…"
              rows={6}
              className="mt-3 w-full resize-none rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[13px] leading-relaxed text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
            />
            <div className="mt-3 flex items-center justify-between">
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 text-[13px] text-muted underline underline-offset-4 hover:text-cream"
              >
                <UploadIcon className="h-3.5 w-3.5" />
                Upload .md / .txt instead
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
          </div>
        )}
        <input ref={fileRef} type="file" accept=".md,.txt,text/markdown,text/plain" hidden onChange={onFile} />

        {/* ---- tonight's table ---- */}
        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="eyebrow">Tonight&apos;s table</p>
            <p className="mt-1 text-[12.5px] text-muted">Who&apos;s drinking? Each gets a fit score.</p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {palates.map((p) => (
            <div
              key={p.id}
              className={`rounded-3xl border bg-surface p-5 transition ${
                p.active ? "border-burgundy-light/40" : "border-hairline opacity-80"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold text-cream">
                    {p.name}
                    {defaultTable.includes(p.id) && (
                      <span className="ml-2 align-middle text-[10px] uppercase tracking-wider text-burgundy-light">
                        default
                      </span>
                    )}
                  </h3>
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
                  aria-label={`${p.active ? "Remove" : "Seat"} ${p.name} at the table`}
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

        {/* default table setting */}
        <div className="mt-5 rounded-2xl border border-hairline bg-surface p-4">
          <p className="text-[13px] text-cream/90">
            {defaultTable.length
              ? `Every scan starts as: ${defaultNames}`
              : "No default table set — the app starts with whoever was last active."}
          </p>
          {!defaultMatchesActive && (
            <button
              onClick={() => onSaveDefault(activeIds)}
              className="mt-3 rounded-full border border-burgundy-light/50 px-4 py-2 text-[13px] text-burgundy-light"
            >
              Make tonight&apos;s table the default
            </button>
          )}
        </div>

        {/* ---- cloud sync ---- */}
        <CloudSyncCard
          getState={() => ({ palates, journal, defaultTable })}
          onPulled={onPulled}
        />
      </div>
    </div>
  );
}

function CloudSyncCard({
  getState,
  onPulled,
}: {
  getState: () => CloudState;
  onPulled: (s: CloudState) => void;
}) {
  const configured = syncConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (configured) currentUserEmail().then(setUser);
  }, [configured]);

  if (!configured) {
    return (
      <div className="mt-8 rounded-2xl border border-hairline p-4">
        <p className="eyebrow">Cloud sync</p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
          Not connected yet. Once Supabase keys are added, your table syncs across every device.
        </p>
      </div>
    );
  }

  const run = async (fn: () => Promise<string | null | void>, okMsg: string) => {
    setBusy(true);
    setMsg("");
    const err = await fn();
    setMsg(err ? String(err) : okMsg);
    setBusy(false);
  };

  return (
    <div className="mt-8 rounded-2xl border border-hairline p-4">
      <p className="eyebrow">Cloud sync</p>
      {!user ? (
        <>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            One shared household sign-in — use the same email and password on every phone.
          </p>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            autoComplete="email"
            className="mt-3 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
            className="mt-2 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
          />
          <button
            disabled={busy || !email || password.length < 6}
            onClick={() =>
              run(async () => {
                const err = await signIn(email, password);
                if (!err) setUser(await currentUserEmail());
                return err;
              }, "Signed in.")
            }
            className="mt-3 w-full rounded-full bg-cream py-3 text-[14px] font-medium text-ink disabled:opacity-50"
          >
            {busy ? "Working…" : "Sign in / create account"}
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13px] text-cream/90">{user}</p>
          <div className="mt-3 flex gap-2">
            <button
              disabled={busy}
              onClick={() => run(() => pushState(getState()), "Pushed to the cloud.")}
              className="flex-1 rounded-full border border-hairline py-2.5 text-[13px] text-cream disabled:opacity-50"
            >
              Push
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { state, error } = await pullState();
                  if (error) return error;
                  if (!state) return "Nothing in the cloud yet — push first.";
                  onPulled(state);
                  return null;
                }, "Pulled from the cloud.")
              }
              className="flex-1 rounded-full border border-hairline py-2.5 text-[13px] text-cream disabled:opacity-50"
            >
              Pull
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await signOut();
                  setUser(null);
                }, "Signed out.")
              }
              className="rounded-full px-4 py-2.5 text-[13px] text-faint"
            >
              Sign out
            </button>
          </div>
        </>
      )}
      {msg && <p className="mt-3 text-[12.5px] text-muted">{msg}</p>}
    </div>
  );
}
