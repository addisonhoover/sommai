import assert from "node:assert/strict";
import { isGlassOnlyMenu, keepPrintedWines, printedMatch, settlePicks, shortListNote, UNREADABLE_MENU_NOTE } from "./menu";
import type { PrintedListing, Wine } from "./types";

function wine(partial: Partial<Wine> & Pick<Wine, "name" | "producer">): Wine {
  return {
    id: "",
    vintage: "",
    region: "",
    varietals: [],
    priceText: "",
    flavorNotes: [],
    structure: { body: 3, tannin: 3, acidity: 3, sweetness: 1 },
    terroir: "",
    pairings: [],
    fits: [{ palateId: "erin", palateName: "Erin", score: 88, reason: "" }],
    summary: "",
    ...partial,
  };
}

function listing(partial: Partial<PrintedListing> & Pick<PrintedListing, "name" | "producer">): PrintedListing {
  return {
    vintage: "",
    region: "",
    priceText: "",
    byTheGlass: false,
    ...partial,
  };
}

const menu: PrintedListing[] = [
  listing({ name: "Cabernet Sauvignon Lucky Tiger", producer: "Georges Duboeuf", priceText: "$36" }),
  listing({ name: "Pinot Noir", producer: "Ant Moore", region: "Oregon" }),
  listing({ name: "Zinfandel", producer: "Frank Family Vineyards" }),
  listing({ name: "Gamay", producer: "Jean-Paul Brun" }),
  listing({ name: "Malbec", producer: "MAAL" }),
];

const sequoia = wine({
  name: "Sequoia Grove Cabernet Sauvignon, Rutherford",
  producer: "Sequoia Grove",
  region: "Rutherford, Napa Valley, CA",
  varietals: ["Cabernet Sauvignon"],
});

assert.equal(
  printedMatch(sequoia, menu[0]!),
  false,
  "Sequoia Grove is not the Lucky Tiger Cab",
);
assert.equal(
  keepPrintedWines([sequoia], menu).length,
  0,
  "log favorite must not survive a menu that does not print it",
);

const lucky = wine({ name: "Cabernet Sauvignon Lucky Tiger", producer: "Georges Duboeuf" });
assert.equal(printedMatch(lucky, menu[0]!), true);
assert.equal(keepPrintedWines([lucky, sequoia], menu).map((w) => w.producer).join(","), "Georges Duboeuf");

const frankCab = wine({ name: "Cabernet Sauvignon", producer: "Frank Family Vineyards" });
assert.equal(
  printedMatch(frankCab, menu[2]!),
  false,
  "Frank Family Cab from the log is not the printed Zinfandel",
);

const ocrBrun = wine({ name: "Gamay", producer: "Jean Paul Brun" });
assert.equal(printedMatch(ocrBrun, menu[3]!), true, "OCR-close producer still counts");

const padded = settlePicks(
  { sourceType: "menu", note: "", wines: [lucky, sequoia, frankCab], topPick: sequoia.name },
  menu,
  "bottle",
);
assert.equal(padded.wines.length, 1);
assert.equal(padded.wines[0]?.producer, "Georges Duboeuf");
assert.notEqual(padded.topPick, sequoia.name);
assert.equal(padded.readFailed, false);
assert.equal(padded.note, shortListNote(1));

const empty = settlePicks({ sourceType: "menu", note: "", wines: [sequoia], topPick: sequoia.name }, menu, "bottle");
assert.equal(empty.wines.length, 0);
assert.equal(empty.readFailed, true);
assert.ok(empty.note.length > 0);
assert.equal(empty.note.includes("{"), false, "no raw JSON in the note");

const unread = settlePicks({ sourceType: "menu", note: "", wines: [], topPick: "" }, [], "bottle");
assert.equal(unread.wines.length, 0);
assert.equal(unread.readFailed, true);
assert.equal(unread.note, UNREADABLE_MENU_NOTE);

const twoHonest = settlePicks(
  {
    sourceType: "menu",
    note: "",
    wines: [
      lucky,
      wine({ name: "Pinot Noir", producer: "Ant Moore" }),
    ],
    topPick: "Pinot Noir",
  },
  menu,
  "bottle",
);
assert.equal(twoHonest.wines.length, 2);
assert.equal(twoHonest.readFailed, false);
assert.equal(twoHonest.note, shortListNote(2));

assert.equal(isGlassOnlyMenu(menu), false);
assert.equal(isGlassOnlyMenu([]), false);
assert.equal(
  isGlassOnlyMenu([
    listing({ name: "Malbec", producer: "House", byTheGlass: true, priceText: "9" }),
    listing({ name: "Cabernet", producer: "House", byTheGlass: false, priceText: "48" }),
  ]),
  false,
  "a mixed bottle + glass page is not glass-only",
);
assert.equal(
  isGlassOnlyMenu([
    listing({ name: "Malbec", producer: "House", byTheGlass: true, priceText: "9" }),
    listing({ name: "Barbera", producer: "House", byTheGlass: true, priceText: "10" }),
  ]),
  true,
);

console.log("printed-list guard checks passed");
