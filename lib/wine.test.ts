import assert from "node:assert/strict";
import { capMenuWines, findPrior, lockFits, MENU_SHORTLIST_LIMIT, stampWineIds, upsertLog, wineIdentity, winesMatch } from "./wine";
import type { Palate, Wine, WineLogEntry } from "./types";

function wine(partial: Partial<Wine> & Pick<Wine, "name" | "producer" | "vintage">): Wine {
  return {
    id: "",
    region: "Napa Valley",
    varietals: ["Cabernet Sauvignon"],
    priceText: "",
    flavorNotes: ["blackcurrant"],
    structure: { body: 4, tannin: 4, acidity: 3, sweetness: 1 },
    terroir: "Oak Knoll.",
    pairings: ["steak"],
    fits: [{ palateId: "erin", palateName: "Erin", score: 90, reason: "Complete mid-palate." }],
    summary: "Polished Napa Cab.",
    ...partial,
  };
}

const seated: Palate[] = [
  {
    id: "erin",
    name: "Erin",
    active: true,
    summary: "",
    loves: [],
    avoids: [],
    favoriteWines: [],
    priceBand: "",
    source: "household",
    updatedAt: 1,
  },
];

const a = wine({ producer: "Sequoia Grove", name: "Cabernet Sauvignon", vintage: "2017" });
const b = wine({
  producer: "Sequoia Grove",
  name: "Cabernet Lamoreaux Vineyard",
  vintage: "2017",
  fits: [{ palateId: "erin", palateName: "Erin", score: 94, reason: "Re-rolled." }],
  summary: "Different notes.",
});

assert.equal(wineIdentity(a), "sequoia grove cabernet sauvignon 2017");
assert.equal(winesMatch(a, b), true);

const stamped = stampWineIds([a]);
const log: WineLogEntry[] = upsertLog([], stamped, "label", ["erin"], "scan");
assert.equal(log.length, 1);
assert.equal(log[0].wine.fits[0].score, 90);

const locked = lockFits([b], log, seated);
assert.equal(locked[0].fits[0].score, 90, "repeat scan must reuse the locked Fit Score");
assert.equal(locked[0].summary, "Polished Napa Cab.", "repeat scan must reuse notes");

const rescan = upsertLog(log, locked, "label", ["erin"], "scan");
assert.equal(rescan.length, 1, "same bottle stays one log row");
assert.equal(rescan[0].scanCount, 2);
assert.equal(rescan[0].wine.fits[0].score, 90);

const prior = findPrior(rescan, b);
assert.ok(prior);

const addisonSeated: Palate[] = [{ ...seated[0], id: "addison", name: "Addison" }];
const unlocked = lockFits([b], rescan, addisonSeated);
assert.equal(unlocked[0].fits[0].score, 94, "new seated palates may rescore");

const overflow = [a, b, wine({ producer: "Ridge", name: "Geyserville", vintage: "2019" }), wine({ producer: "Tablas Creek", name: "Esprit", vintage: "2020" })];
assert.equal(capMenuWines(overflow).length, MENU_SHORTLIST_LIMIT);
assert.equal(capMenuWines(overflow)[0].name, a.name);
assert.deepEqual(capMenuWines([a]), [a]);

console.log("wine lock + log checks passed");
