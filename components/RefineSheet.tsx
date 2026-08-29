"use client";

import { useState } from "react";
import type { RefineContext } from "@/lib/types";
import { CloseIcon } from "./icons";

const OCCASIONS = ["Date night", "Group dinner", "Celebration", "Casual"];
const INTENTS = ["One bottle for the table", "By the glass", "Something special"];

// Principle #2: a ~10 second second pass after the shot — not a form.
// Occasion / dishes / intent stay as quick chips; spend is the new tilt.
export function RefineSheet({
  open,
  busy,
  initial,
  onApply,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  initial: RefineContext;
  onApply: (c: RefineContext) => void;
  onClose: () => void;
}) {
  const [occasion, setOccasion] = useState<string | null>(initial.occasion);
  const [intent, setIntent] = useState<string | null>(initial.intent);
  const [dishes, setDishes] = useState(initial.dishes);
  const [spend, setSpend] = useState(initial.spend ?? 50);

  return (
    <div className={`fixed inset-0 z-40 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-3xl border-t border-hairline bg-surface transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sticky top-0 flex items-center justify-between bg-surface px-6 pb-2 pt-5">
          <h2 className="text-[18px] font-semibold text-cream">A little more</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border border-hairline">
            <CloseIcon className="h-4 w-4 text-cream" />
          </button>
        </div>

        <div className="px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <p className="mt-1 text-[13px] leading-relaxed text-muted">
            Those three were a first read. Add a bit — did anything change?
          </p>

          <p className="eyebrow mt-6">Tonight&apos;s spend</p>
          <input
            type="range"
            min={0}
            max={100}
            value={spend}
            onChange={(e) => setSpend(Number(e.target.value))}
            className="spectrum mt-4 w-full"
            aria-label="Cheap night to expensive night"
          />
          <div className="mt-2 flex justify-between text-[12px] text-muted">
            <span>Cheap night</span>
            <span>Expensive night</span>
          </div>

          <p className="eyebrow mt-6">Occasion</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button
                key={o}
                onClick={() => setOccasion(occasion === o ? null : o)}
                className={`rounded-full border px-4 py-2 text-[13px] transition ${
                  occasion === o
                    ? "border-burgundy-light bg-burgundy/25 text-cream"
                    : "border-hairline text-muted hover:text-cream"
                }`}
              >
                {o}
              </button>
            ))}
          </div>

          <p className="eyebrow mt-5">Eating?</p>
          <input
            value={dishes}
            onChange={(e) => setDishes(e.target.value)}
            placeholder="Lamb, roast chicken…"
            className="mt-3 w-full rounded-2xl border border-hairline bg-ink/50 px-4 py-3 text-[14px] text-cream placeholder:text-faint focus:border-burgundy-light/60 focus:outline-none"
          />

          <p className="eyebrow mt-5">Intent</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {INTENTS.map((i) => (
              <button
                key={i}
                onClick={() => setIntent(intent === i ? null : i)}
                className={`rounded-full border px-4 py-2 text-[13px] transition ${
                  intent === i
                    ? "border-burgundy-light bg-burgundy/25 text-cream"
                    : "border-hairline text-muted hover:text-cream"
                }`}
              >
                {i}
              </button>
            ))}
          </div>

          <button
            disabled={busy}
            onClick={() => onApply({ occasion, intent, dishes, spend })}
            className="mt-8 w-full rounded-full bg-cream py-3.5 text-[15px] font-medium text-ink disabled:opacity-60"
          >
            {busy ? "Taking another look…" : "Take another look"}
          </button>
        </div>
      </div>
    </div>
  );
}
