"use client";

import { useEffect, useRef, useState } from "react";
import type { Palate, WineLogEntry } from "@/lib/types";
import {
  ensureHousehold,
  initialsFor,
  isCoupleProfile,
  isIndividualSeat,
  mergeImportedPalate,
  palateToMarkdown,
  vibeLine,
} from "@/lib/palates";
import { compressAvatar } from "@/lib/image";
import { syncConfigured } from "@/lib/supabase";
import {
  currentUserEmail,
  pullState,
  pushState,
  signIn,
  signOut,
  type CloudState,
} from "@/lib/sync";
import {
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  DownloadIcon,
  PlusIcon,
  UploadIcon,
} from "./icons";

type ImportTarget = { mode: "new" } | { mode: "more"; id: string };

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
  journal: WineLogEntry[];
  defaultTable: string[];
  onChange: (next: Palate[]) => void;
  onSaveDefault: (ids: string[]) => void;
  onPulled: (state: CloudState) => void;
  onClose: () => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState<ImportTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const detail = detailId ? palates.find((p) => p.id === detailId) ?? null : null;

  const commit = (next: Palate[]) => {
    const ensured = ensureHousehold(next);
    onChange(ensured.palates);
    onSaveDefault(ensured.defaultTable);
  };

  const toggleActive = (id: string) => {
    const next = palates.map((p) => (p.id === id ? { ...p, active: !p.active } : p));
    if (!next.some((p) => p.active)) return;
    onChange(next);
  };

  const remove = (id: string) => {
    const target = palates.find((p) => p.id === id);
    if (!target) return;
    if (target.source === "household") return;
    if (isIndividualSeat(target, "Erin") || isIndividualSeat(target, "Addison")) return;
    const next = palates.filter((p) => p.id !== id);
    if (next.length === 0) return;
    if (!next.some((p) => p.active)) next[0] = { ...next[0], active: true };
    commit(next);
    setDetailId(null);
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
        setImporting((prev) => prev ?? { mode: "new" });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const closeImport = () => {
    setImporting(null);
    setName("");
    setNotes("");
    setError("");
  };

  const runImport = async () => {
    if (!notes.trim() || !importing) return;
    setBusy(true);
    setError("");
    try {
      const personName =
        importing.mode === "more"
          ? palates.find((p) => p.id === importing.id)?.name
          : name.trim() || undefined;
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, personName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Import failed.");
        setBusy(false);
        return;
      }
      const incoming: Palate = {
        id: `p-${Date.now()}`,
        name: personName || data.name || `Palate ${palates.length + 1}`,
        active: false,
        summary: data.summary ?? "",
        loves: data.loves ?? [],
        avoids: data.avoids ?? [],
        favoriteWines: data.favoriteWines ?? [],
        priceBand: data.priceBand ?? "",
        source: "imported",
        updatedAt: Date.now(),
        guest: true,
      };
      if (isCoupleProfile(incoming)) {
        setError("Erin and Addison each have their own seat. Import one person at a time.");
        setBusy(false);
        return;
      }

      if (importing.mode === "more") {
        const target = palates.find((p) => p.id === importing.id);
        if (!target) {
          setError("That seat isn't here anymore.");
          setBusy(false);
          return;
        }
        commit(palates.map((p) => (p.id === target.id ? mergeImportedPalate(p, incoming) : p)));
        closeImport();
        setBusy(false);
        return;
      }

      const rest = palates.filter((p) => p.source !== "starter");
      const existing = rest.find(
        (p) => p.name.trim().toLowerCase() === incoming.name.trim().toLowerCase(),
      );
      const merged = existing
        ? rest.map((p) => (p.id === existing.id ? mergeImportedPalate(p, incoming) : p))
        : [...rest, incoming];
      commit(merged);
      closeImport();
    } catch {
      setError("Couldn't reach SommAI. Check your connection.");
    }
    setBusy(false);
  };

  const setGuestFlag = (id: string, guest: boolean) => {
    const target = palates.find((p) => p.id === id);
    if (!target) return;
    if (isIndividualSeat(target, "Erin") || isIndividualSeat(target, "Addison")) return;
    commit(
      palates.map((p) =>
        p.id === id ? { ...p, guest, active: guest ? p.active : true } : p,
      ),
    );
  };

  const headerBack = () => {
    if (importing) {
      closeImport();
      return;
    }
    if (adding) {
      setAdding(false);
      return;
    }
    if (detailId) {
      setDetailId(null);
      return;
    }
    onClose();
  };

  const title = importing
    ? importing.mode === "more"
      ? `More for ${detail?.name ?? "this palate"}`
      : "Import notes"
    : adding
      ? "Add a person"
      : detail
        ? detail.name
        : "The Table";

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-ink">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={headerBack} className="flex items-center gap-1.5 text-cream">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Back</span>
        </button>
        <p className="text-[15px] font-semibold text-cream">{title}</p>
        <div className="w-14" aria-hidden />
      </header>

      <div className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {adding ? (
          <AddPersonForm
            onCancel={() => setAdding(false)}
            onCreate={(person) => {
              commit([...palates.filter((p) => p.source !== "starter"), person]);
              setAdding(false);
            }}
          />
        ) : importing ? (
          <ImportNotes
            target={importing}
            personName={
              importing.mode === "more"
                ? (detail?.name ?? "")
                : name
            }
            onName={setName}
            notes={notes}
            onNotes={setNotes}
            busy={busy}
            error={error}
            onPickFile={() => fileRef.current?.click()}
            onCancel={closeImport}
            onRun={runImport}
          />
        ) : detail ? (
          <PalateDetail
            palate={detail}
            usual={defaultTable.includes(detail.id)}
            canRemove={
              palates.length > 1 &&
              detail.source !== "household" &&
              !isIndividualSeat(detail, "Erin") &&
              !isIndividualSeat(detail, "Addison")
            }
            onToggle={() => toggleActive(detail.id)}
            onGuest={(guest) => setGuestFlag(detail.id, guest)}
            onImportMore={() => {
              setName(detail.name);
              setImporting({ mode: "more", id: detail.id });
            }}
            onExport={() => exportPalate(detail)}
            onRemove={() => remove(detail.id)}
          />
        ) : (
          <Roster
            palates={palates}
            defaultTable={defaultTable}
            onAdd={() => setAdding(true)}
            onImport={() => setImporting({ mode: "new" })}
            onFile={() => fileRef.current?.click()}
            onOpen={(id) => setDetailId(id)}
            onToggle={toggleActive}
          />
        )}

        <input
          ref={fileRef}
          type="file"
          accept=".md,.txt,text/markdown,text/plain"
          hidden
          onChange={onFile}
        />

        {!adding && !importing && !detail && (
          <CloudSyncCard
            getState={() => ({ palates, journal, defaultTable })}
            onPulled={onPulled}
          />
        )}
      </div>
    </div>
  );
}

function Roster({
  palates,
  defaultTable,
  onAdd,
  onImport,
  onFile,
  onOpen,
  onToggle,
}: {
  palates: Palate[];
  defaultTable: string[];
  onAdd: () => void;
  onImport: () => void;
  onFile: () => void;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <>
      <button
        onClick={onAdd}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-burgundy py-4 text-[14px] font-medium text-cream"
      >
        <PlusIcon className="h-4 w-4" />
        Add a person
      </button>
      <div className="mt-3 flex items-center justify-center gap-4 text-[12.5px] text-muted">
        <button onClick={onImport} className="underline underline-offset-4 hover:text-cream">
          Import notes
        </button>
        <span className="text-faint">·</span>
        <button onClick={onFile} className="flex items-center gap-1.5 hover:text-cream">
          <UploadIcon className="h-3.5 w-3.5" />
          File
        </button>
      </div>

      <div className="mt-8">
        <p className="eyebrow">Place settings</p>
        <p className="mt-2 text-[13px] leading-relaxed text-cream/90">
          Erin and Addison sit by default. Flip a seat for a solo night. Tap a
          person for the full palate.
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {palates.map((p) => (
          <SeatCard
            key={p.id}
            palate={p}
            usual={defaultTable.includes(p.id)}
            onOpen={() => onOpen(p.id)}
            onToggle={() => onToggle(p.id)}
          />
        ))}
      </div>
    </>
  );
}

function SeatCard({
  palate,
  usual,
  onOpen,
  onToggle,
}: {
  palate: Palate;
  usual: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  const vibe = vibeLine(palate.summary);
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-surface px-3.5 py-3 transition ${
        palate.active ? "border-burgundy-light/35" : "border-hairline"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <SeatPortrait name={palate.name} photo={palate.photo} seated={palate.active} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="truncate text-[15px] font-semibold text-cream">{palate.name}</h3>
            <span className="shrink-0 text-[10px] uppercase tracking-wider text-faint">
              {usual ? "Usually here" : "Guest"}
            </span>
          </div>
          {vibe ? (
            <p className="mt-0.5 truncate text-[12.5px] text-muted">{vibe}</p>
          ) : (
            <p className="mt-0.5 text-[12.5px] text-faint">Tap for the full palate</p>
          )}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        aria-pressed={palate.active}
        aria-label={`${palate.active ? "Unseat" : "Seat"} ${palate.name}`}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${
          palate.active ? "bg-burgundy" : "bg-surface-2"
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-cream transition-all ${
            palate.active ? "left-7" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function SeatPortrait({
  name,
  photo,
  seated,
  size = "sm",
}: {
  name: string;
  photo?: string;
  seated: boolean;
  size?: "sm" | "lg";
}) {
  const outer = size === "lg" ? "size-24" : "size-14";
  const inner = size === "lg" ? "size-[5.25rem]" : "size-11";
  const type = size === "lg" ? "text-[22px]" : "text-[13px]";
  return (
    <div
      className={`relative grid shrink-0 place-items-center ${outer} ${seated ? "" : "opacity-60"}`}
    >
      <div className="absolute inset-0 rounded-full border border-dashed border-burgundy/30" />
      <div className="absolute inset-[3px] rounded-full border border-hairline" />
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data-URL portraits
        <img src={photo} alt="" className={`relative ${inner} rounded-full object-cover`} />
      ) : (
        <div
          className={`relative grid ${inner} place-items-center rounded-full bg-surface-2 font-semibold tracking-wide text-cream ${type}`}
        >
          {initialsFor(name)}
        </div>
      )}
    </div>
  );
}

function PalateDetail({
  palate,
  usual,
  canRemove,
  onToggle,
  onGuest,
  onImportMore,
  onExport,
  onRemove,
}: {
  palate: Palate;
  usual: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onGuest: (guest: boolean) => void;
  onImportMore: () => void;
  onExport: () => void;
  onRemove: () => void;
}) {
  const household =
    palate.source === "household" ||
    isIndividualSeat(palate, "Erin") ||
    isIndividualSeat(palate, "Addison");

  return (
    <div>
      <div className="flex flex-col items-center text-center">
        <SeatPortrait name={palate.name} photo={palate.photo} seated={palate.active} size="lg" />
        <h2 className="mt-4 text-[22px] font-semibold text-cream">{palate.name}</h2>
        <p className="mt-1 text-[12px] uppercase tracking-wider text-faint">
          {palate.active ? "Seated tonight" : "Not tonight"}
          {" · "}
          {usual ? "Usually at the table" : "Guest"}
        </p>
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={palate.active}
          className={`relative mt-4 h-8 w-14 rounded-full transition ${
            palate.active ? "bg-burgundy" : "bg-surface-2"
          }`}
          aria-label={`${palate.active ? "Unseat" : "Seat"} ${palate.name}`}
        >
          <span
            className={`absolute top-1 h-6 w-6 rounded-full bg-cream transition-all ${
              palate.active ? "left-7" : "left-1"
            }`}
          />
        </button>
      </div>

      {palate.summary && (
        <p className="mt-6 text-[14px] leading-relaxed text-cream/90">{palate.summary}</p>
      )}

      {palate.loves.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Loves</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {palate.loves.map((x) => (
              <span key={x} className="rounded-full border border-hairline px-3 py-1 text-[11px] text-cream/80">
                {x}
              </span>
            ))}
          </div>
        </div>
      )}
      {palate.avoids.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Avoids</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{palate.avoids.join(", ")}</p>
        </div>
      )}
      {palate.favoriteWines.length > 0 && (
        <div className="mt-5">
          <p className="eyebrow">Favorites</p>
          <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-cream/85">
            {palate.favoriteWines.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      )}
      {palate.priceBand && (
        <div className="mt-5">
          <p className="eyebrow">Spend</p>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{palate.priceBand}</p>
        </div>
      )}

      {!household && (
        <div className="mt-6 rounded-2xl border border-hairline bg-surface p-4">
          <p className="text-[13px] text-cream/90">When do they sit?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onGuest(false)}
              className={`rounded-full py-2.5 text-[13px] ${
                usual ? "bg-burgundy text-cream" : "border border-hairline text-muted"
              }`}
            >
              Usually here
            </button>
            <button
              type="button"
              onClick={() => onGuest(true)}
              className={`rounded-full py-2.5 text-[13px] ${
                !usual ? "bg-burgundy text-cream" : "border border-hairline text-muted"
              }`}
            >
              Guest
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onImportMore}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-cream py-3 text-[14px] font-medium text-ink"
        >
          <PlusIcon className="h-4 w-4" />
          Import more
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onExport}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-hairline px-4 py-2.5 text-[13px] text-cream hover:border-burgundy-light/50"
          >
            <DownloadIcon className="h-4 w-4" />
            Export .md
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="rounded-full px-4 py-2.5 text-[13px] text-faint hover:text-cream"
            >
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddPersonForm({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (person: Palate) => void;
}) {
  const [name, setName] = useState("");
  const [vibe, setVibe] = useState("");
  const [loves, setLoves] = useState("");
  const [avoids, setAvoids] = useState("");
  const [photo, setPhoto] = useState("");
  const [guest, setGuest] = useState(true);
  const photoRef = useRef<HTMLInputElement>(null);

  const splitList = (raw: string) =>
    raw
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPhoto(await compressAvatar(file));
    } catch {
      /* skip a bad image */
    }
  };

  return (
    <div className="rounded-3xl border border-burgundy-light/40 bg-surface p-5">
      <p className="text-[13px] leading-relaxed text-muted">
        A new place at the table. A name is enough — the rest can wait, or come
        in later from notes.
      </p>

      <button
        type="button"
        onClick={() => photoRef.current?.click()}
        className="mx-auto mt-5 flex flex-col items-center gap-2"
      >
        <SeatPortrait name={name || "New"} photo={photo} seated size="lg" />
        <span className="text-[12.5px] text-muted underline underline-offset-4">
          {photo ? "Change photo" : "Add a photo"}
        </span>
      </button>
      <input ref={photoRef} type="file" accept="image/*" hidden onChange={onPhoto} />

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name"
        className="mt-5 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
      />
      <textarea
        value={vibe}
        onChange={(e) => setVibe(e.target.value)}
        placeholder="A line or two about what they like…"
        rows={3}
        className="mt-3 w-full resize-none rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[13px] leading-relaxed text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
      />
      <input
        value={loves}
        onChange={(e) => setLoves(e.target.value)}
        placeholder="Loves (comma-separated)"
        className="mt-3 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
      />
      <input
        value={avoids}
        onChange={(e) => setAvoids(e.target.value)}
        placeholder="Avoids (comma-separated)"
        className="mt-3 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
      />

      <p className="mt-5 text-[13px] text-cream/90">Do they usually sit?</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setGuest(false)}
          className={`rounded-full py-2.5 text-[13px] ${
            !guest ? "bg-burgundy text-cream" : "border border-hairline text-muted"
          }`}
        >
          Usually at the table
        </button>
        <button
          type="button"
          onClick={() => setGuest(true)}
          className={`rounded-full py-2.5 text-[13px] ${
            guest ? "bg-burgundy text-cream" : "border border-hairline text-muted"
          }`}
        >
          Guest for some nights
        </button>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-faint">
        Regulars sit whenever you open the app. Guests stay off until you seat
        them tonight.
      </p>

      <div className="mt-5 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-4 py-3 text-[13px] text-faint"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!name.trim()}
          onClick={() =>
            onCreate({
              id: `p-${Date.now()}`,
              name: name.trim(),
              active: !guest,
              summary: vibe.trim(),
              loves: splitList(loves),
              avoids: splitList(avoids),
              favoriteWines: [],
              priceBand: "",
              source: "imported",
              updatedAt: Date.now(),
              photo: photo || undefined,
              guest,
            })
          }
          className="flex-1 rounded-full bg-cream py-3 text-[14px] font-medium text-ink disabled:opacity-50"
        >
          Set their place
        </button>
      </div>
    </div>
  );
}

function ImportNotes({
  target,
  personName,
  onName,
  notes,
  onNotes,
  busy,
  error,
  onPickFile,
  onCancel,
  onRun,
}: {
  target: ImportTarget;
  personName: string;
  onName: (v: string) => void;
  notes: string;
  onNotes: (v: string) => void;
  busy: boolean;
  error: string;
  onPickFile: () => void;
  onCancel: () => void;
  onRun: () => void;
}) {
  const more = target.mode === "more";
  return (
    <div className="rounded-3xl border border-burgundy-light/40 bg-surface p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-cream">
          {more ? "Import more" : "Import notes"}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="grid h-8 w-8 place-items-center rounded-full border border-hairline"
        >
          <CloseIcon className="h-3.5 w-3.5 text-cream" />
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
        {more
          ? `Fold more notes into ${personName}'s palate. This refines their seat — it does not add a second card.`
          : "Paste tasting notes or upload a file. SommAI distills it into a person. One person at a time."}
      </p>
      {!more && (
        <input
          value={personName}
          onChange={(e) => onName(e.target.value)}
          placeholder="Whose palate? (e.g. a guest)"
          className="mt-4 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
        />
      )}
      <textarea
        value={notes}
        onChange={(e) => onNotes(e.target.value)}
        placeholder="Paste the notes here…"
        rows={6}
        className="mt-3 w-full resize-none rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[13px] leading-relaxed text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
      />
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onPickFile}
          className="flex items-center gap-2 text-[13px] text-muted underline underline-offset-4 hover:text-cream"
        >
          <UploadIcon className="h-3.5 w-3.5" />
          Upload .md / .txt instead
        </button>
        <span className="text-[11px] text-faint">{notes.length.toLocaleString()} chars</span>
      </div>
      {error && <p className="mt-3 text-[13px] text-burgundy-light">{error}</p>}
      <button
        type="button"
        disabled={busy || !notes.trim()}
        onClick={onRun}
        className="mt-4 w-full rounded-full bg-cream py-3 text-[14px] font-medium text-ink disabled:opacity-50"
      >
        {busy ? "Distilling the palate…" : more ? `Fold into ${personName}` : "Add to the table"}
      </button>
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
