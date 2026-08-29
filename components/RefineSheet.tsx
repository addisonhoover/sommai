"use client";

import { useState } from "react";
import { DEFAULT_BAND } from "@/lib/price";
import type { PriceBand, RefineContext, ServeStyle } from "@/lib/types";
import { CloseIcon } from "./icons";
import { PriceBandControl } from "./PriceBandControl";

const OCCASIONS = ["Date night", "Group dinner", "Celebration", "Casual"];
const INTENTS = ["One bottle for the table", "Something special"];

// Principle #2: a ~10 second second pass after the shot — not a form.
// Dollar band is what they know at the table; occasion / dishes stay as chips.
export function RefineSheet({
  open,
  busy,
  initial,
  serve = "bottle",
  showBand = false,
  onApply,
  onClose,
}: {
  open: boolean;
  busy: boolean;
  initial: RefineContext;
  serve?: ServeStyle;
  showBand?: boolean;
  onApply: (c: RefineContext) => void;
  onClose: () => void;
}) {
  const [occasion, setOccasion] = useState<string | null>(initial.occasion);
  const [intent, setIntent] = useState<string | null>(initial.intent);
  const [dishes, setDishes] = useState(initial.dishes);
  const [band, setBand] = useState<PriceBand>(initial.priceBand ?? DEFAULT_BAND);
  const [bandTouched, setBandTouched] = useState(Boolean(initial.priceBand));

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
            {showBand
              ? "Those three were a first read. Nudge the band if the list is richer than you thought."
              : "Those three were a first read. Add a little more for this table."}
          </p>

          {showBand && (
            <>
              <p className="eyebrow mt-6">Tonight&apos;s band</p>
              <p className="mt-2 text-[12px] leading-relaxed text-faint">
                A guide, not a wall. Great fits a little outside can still make the three.
              </p>
              <div className="mt-3">
                <PriceBandControl
                  band={band}
                  touched={bandTouched}
                  serve={serve}
                  onChange={(next) => {
                    setBand(next);
                    setBandTouched(true);
                  }}
                />
              </div>
            </>
          )}

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
            {INTENTS.map((item) => (
              <button
                key={item}
                onClick={() => setIntent(intent === item ? null : item)}
                className={`rounded-full border px-4 py-2 text-[13px] transition ${
                  intent === item
                    ? "border-burgundy-light bg-burgundy/25 text-cream"
                    : "border-hairline text-muted hover:text-cream"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <button
            disabled={busy}
            onClick={() =>
              onApply({
                occasion,
                intent,
                dishes,
                priceBand: showBand && bandTouched ? band : null,
                serve,
              })
            }
            className="mt-8 w-full rounded-full bg-cream py-3.5 text-[15px] font-medium text-ink disabled:opacity-60"
          >
            {busy ? "Taking another look…" : "Take another look"}
          </button>
        </div>
      </div>
    </div>
  );
}
