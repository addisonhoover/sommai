import assert from "node:assert/strict";
import { readAnalyzeStream } from "./analyze-stream";

async function main() {
  const body = [
    JSON.stringify({ type: "scan", sourceType: "menu", glassOnly: false }),
    JSON.stringify({
      type: "result",
      sourceType: "menu",
      note: "",
      wines: [],
      topPick: "",
      readFailed: false,
    }),
  ].join("\n");

  const cues: { sourceType: string; glassOnly: boolean }[] = [];
  const streamed = await readAnalyzeStream(
    new Response(body, { headers: { "Content-Type": "application/x-ndjson" } }),
    (cue) => cues.push(cue),
  );
  assert.equal(cues[0]?.sourceType, "menu");
  assert.equal(cues[0]?.glassOnly, false);
  assert.equal(streamed.sourceType, "menu");

  const glassCues: { sourceType: string; glassOnly: boolean }[] = [];
  const glassOnly = await readAnalyzeStream(
    new Response(
      [
        JSON.stringify({ type: "scan", sourceType: "menu", glassOnly: true }),
        JSON.stringify({
          type: "result",
          sourceType: "menu",
          note: "",
          wines: [],
          topPick: "",
          readFailed: false,
        }),
      ].join("\n"),
      { headers: { "Content-Type": "application/x-ndjson" } },
    ),
    (cue) => glassCues.push(cue),
  );
  assert.equal(glassCues[0]?.glassOnly, true);
  assert.equal(glassOnly.sourceType, "menu");

  const labelCues: { sourceType: string; glassOnly: boolean }[] = [];
  const label = await readAnalyzeStream(
    new Response(
      [
        JSON.stringify({ type: "scan", sourceType: "label", glassOnly: false }),
        JSON.stringify({ type: "result", sourceType: "label", note: "", wines: [], topPick: "" }),
      ].join("\n"),
      { headers: { "Content-Type": "application/x-ndjson" } },
    ),
    (cue) => labelCues.push(cue),
  );
  assert.equal(labelCues[0]?.sourceType, "label");
  assert.equal(label.sourceType, "label");

  const plain = await readAnalyzeStream(
    new Response(JSON.stringify({ sourceType: "label", note: "", wines: [], topPick: "" }), {
      headers: { "Content-Type": "application/json" },
    }),
  );
  assert.equal(plain.sourceType, "label");

  console.log("analyze stream checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
