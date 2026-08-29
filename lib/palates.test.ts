import assert from "node:assert/strict";
import {
  ADDISON_ID,
  ERIN_ID,
  ensureHousehold,
  householdPalates,
  isCoupleProfile,
  isIndividualSeat,
  mergeImportedPalate,
  seatDefaultPool,
  vibeLine,
} from "./palates";
import type { Palate } from "./types";

function palate(partial: Partial<Palate> & Pick<Palate, "id" | "name">): Palate {
  return {
    active: true,
    summary: "",
    loves: [],
    avoids: [],
    favoriteWines: [],
    priceBand: "",
    source: "imported",
    updatedAt: 1,
    ...partial,
  };
}

const couple = palate({
  id: "p-combined",
  name: "Erin & Addison",
  summary: "A couple's palate — combined notes from last night.",
  source: "imported",
});

assert.equal(isCoupleProfile(couple), true);
assert.equal(isIndividualSeat(couple, "Erin"), false);
assert.equal(isIndividualSeat(couple, "Addison"), false);

const fromCouple = ensureHousehold([couple]);
assert.equal(fromCouple.palates.length, 2);
assert.deepEqual(
  fromCouple.palates.map((p) => p.name),
  ["Erin", "Addison"],
);
assert.equal(fromCouple.palates.every((p) => p.active), true);
assert.deepEqual(fromCouple.defaultTable, [ERIN_ID, ADDISON_ID]);
assert.equal(fromCouple.palates.some((p) => p.name.includes("&")), false);

const starter = palate({
  id: "starter",
  name: "My palate",
  source: "starter",
  summary: "Still calibrating",
});
const fromStarter = ensureHousehold([starter]);
assert.equal(fromStarter.palates.length, 2);
assert.deepEqual(
  fromStarter.palates.map((p) => p.name),
  ["Erin", "Addison"],
);

const empty = ensureHousehold([]);
assert.equal(empty.palates.length, 2);

const learnedErin = palate({
  id: "p-erin",
  name: "Erin",
  summary: "Learned Erin notes — keep me.",
  active: true,
  source: "imported",
});
const learnedAddison = palate({
  id: "p-addison",
  name: "Addison",
  summary: "Learned Addison notes — keep me too.",
  active: false,
  source: "imported",
});
const kept = ensureHousehold([learnedErin, learnedAddison]);
assert.equal(kept.palates.length, 2);
assert.equal(kept.palates[0].summary, "Learned Erin notes — keep me.");
assert.equal(kept.palates[1].summary, "Learned Addison notes — keep me too.");
assert.equal(kept.palates[0].active, true);
assert.equal(kept.palates[1].active, false, "solo night: Addison stays off");
assert.equal(kept.palates.filter((p) => p.name === "Erin" || p.name === "Addison").length, 2);

const mixed = ensureHousehold([couple, ...householdPalates()]);
assert.equal(mixed.palates.some((p) => p.id === "p-combined"), false);
assert.equal(mixed.palates.filter((p) => p.name === "Erin").length, 1);
assert.equal(mixed.palates.filter((p) => p.name === "Addison").length, 1);

const guest = palate({
  id: "p-guest",
  name: "Mom",
  guest: true,
  active: true,
});
const withGuest = ensureHousehold([learnedErin, learnedAddison, guest]);
assert.equal(withGuest.palates.length, 3);
assert.deepEqual(withGuest.defaultTable, [learnedErin.id, learnedAddison.id]);
assert.equal(
  withGuest.palates.find((p) => p.id === "p-guest")?.active,
  true,
  "tonight's guest seat is kept until the next open",
);

const regular = palate({
  id: "p-regular",
  name: "Dad",
  guest: false,
  active: false,
});
const withRegular = ensureHousehold([learnedErin, learnedAddison, regular]);
assert.ok(withRegular.defaultTable.includes("p-regular"));

const reseated = seatDefaultPool(withGuest.palates, withGuest.defaultTable);
assert.equal(reseated.find((p) => p.id === "p-guest")?.active, false);
assert.equal(reseated.find((p) => p.id === learnedErin.id)?.active, true);
assert.equal(reseated.find((p) => p.id === learnedAddison.id)?.active, true);

const merged = mergeImportedPalate(
  palate({
    id: "p-erin",
    name: "Erin",
    summary: "Polished Napa.",
    loves: ["French oak"],
    avoids: ["jammy"],
    favoriteWines: ["Artemis"],
  }),
  palate({
    id: "incoming",
    name: "Erin",
    summary: "Also earthy Brunello.",
    loves: ["French oak", "Brunello"],
    avoids: ["thin"],
    favoriteWines: ["Altesino"],
    priceBand: "$100+",
    source: "imported",
  }),
);
assert.equal(merged.id, "p-erin");
assert.match(merged.summary, /Polished Napa/);
assert.match(merged.summary, /earthy Brunello/);
assert.deepEqual(merged.loves, ["French oak", "Brunello"]);
assert.deepEqual(merged.avoids, ["jammy", "thin"]);
assert.deepEqual(merged.favoriteWines, ["Artemis", "Altesino"]);
assert.equal(merged.priceBand, "$100+");

assert.equal(
  vibeLine("Polished, fruit-present, structured wines with a complete mid-palate. That middle is the tell."),
  "Polished, fruit-present, structured wines with a complete mid-palate.",
);
assert.ok(vibeLine("x".repeat(90)).endsWith("…"));
assert.ok(vibeLine("x".repeat(90)).length <= 72);

assert.equal(
  isCoupleProfile(
    palate({ id: "x", name: "Household", summary: "A couple's palate for the table." }),
  ),
  true,
);

console.log("household seat checks passed");
