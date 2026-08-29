import assert from "node:assert/strict";
import { formatBand, parseMenuPrice, preferBand, rankPicks, retargetWindow, slideWindow, trackFor } from "./price";
import type { Wine } from "./types";

function wine(partial: Partial<Wine> & Pick<Wine, "name" | "priceText">): Wine {
  return {
    id: partial.name,
    producer: "",
    vintage: "",
    region: "",
    varietals: [],
    flavorNotes: [],
    structure: { body: 3, tannin: 3, acidity: 3, sweetness: 1 },
    terroir: "",
    pairings: [],
    fits: [{ palateId: "erin", palateName: "Erin", score: 80, reason: "" }],
    summary: "",
    ...partial,
  };
}

assert.equal(parseMenuPrice("$14 / $56", "glass"), 14);
assert.equal(parseMenuPrice("$14 / $56", "bottle"), 56);
assert.equal(parseMenuPrice("$85", "bottle"), 85);
assert.equal(parseMenuPrice("BTG 18", "glass"), 18);
assert.equal(parseMenuPrice("", "bottle"), null);

assert.equal(formatBand({ min: 90, max: 140 }), "$90–$140");

assert.deepEqual(slideWindow(0), { min: 0, max: 50 });
assert.deepEqual(slideWindow(40), { min: 40, max: 90 });
assert.deepEqual(slideWindow(90), { min: 90, max: 140 });
assert.deepEqual(slideWindow(250), { min: 250, max: 300 });
assert.deepEqual(slideWindow(-20), { min: 0, max: 50 }, "left edge stays $0–$50");
assert.deepEqual(slideWindow(280), { min: 250, max: 300 }, "right edge stays $250–$300 — no shrink");
assert.deepEqual(slideWindow(47), { min: 50, max: 100 });

assert.deepEqual(trackFor("glass"), { floor: 0, ceiling: 60, window: 10, step: 2 });
assert.deepEqual(slideWindow(0, "glass"), { min: 0, max: 10 });
assert.deepEqual(slideWindow(14, "glass"), { min: 14, max: 24 });
assert.deepEqual(slideWindow(55, "glass"), { min: 50, max: 60 }, "glass right edge stays $50–$60");
assert.deepEqual(slideWindow(70, "glass"), { min: 50, max: 60 }, "a $70 bottle window cannot sit on the glass track");

const glassFromBottle = retargetWindow({ min: 70, max: 120 }, "bottle", "glass");
assert.equal(glassFromBottle.max - glassFromBottle.min, 10);
assert.ok(glassFromBottle.max <= 60);
assert.ok(glassFromBottle.min >= 0);
assert.notDeepEqual(glassFromBottle, { min: 70, max: 120 });

const back = retargetWindow(glassFromBottle, "glass", "bottle");
assert.equal(back.max - back.min, 50);
assert.ok(back.max <= 300);

const cheap = wine({ name: "Weeknight", priceText: "$42", fits: [{ palateId: "erin", palateName: "Erin", score: 78, reason: "" }] });
const splashy = wine({ name: "Celebration", priceText: "$210", fits: [{ palateId: "erin", palateName: "Erin", score: 94, reason: "" }] });
const ranked = preferBand([splashy, cheap], { min: 0, max: 50 }, "bottle");
assert.equal(ranked[0].name, "Weeknight");
assert.equal(ranked.length, 2, "band is a guide — the $210 bottle stays on the list");

const byFit = rankPicks([cheap, splashy], null, "bottle");
assert.equal(byFit[0].name, "Celebration", "no band: best fit first");

console.log("price band checks passed");
