import assert from "node:assert/strict";
import { formatBand, parseMenuPrice, preferBand, rankPicks } from "./price";
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

const cheap = wine({ name: "Weeknight", priceText: "$42", fits: [{ palateId: "erin", palateName: "Erin", score: 78, reason: "" }] });
const splashy = wine({ name: "Celebration", priceText: "$210", fits: [{ palateId: "erin", palateName: "Erin", score: 94, reason: "" }] });
const ranked = preferBand([splashy, cheap], { min: 0, max: 50 }, "bottle");
assert.equal(ranked[0].name, "Weeknight");
assert.equal(ranked.length, 2, "band is a guide — the $210 bottle stays on the list");

const byFit = rankPicks([cheap, splashy], null, "bottle");
assert.equal(byFit[0].name, "Celebration", "no band: best fit first");

console.log("price band checks passed");
