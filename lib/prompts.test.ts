import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTRACT_SCHEMA, IMPORT_SCHEMA, REFINE_SCHEMA, WINE_SCHEMA } from "./prompts";

// Anthropic output_config.format.schema rejects these on arrays/strings/numbers.
// minItems is only allowed as 0 or 1; we do not send it at all.
const BANNED = new Set([
  "maxItems",
  "minItems",
  "uniqueItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "minProperties",
  "maxProperties",
]);

function collectBanned(node: unknown, path: string, hits: string[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => collectBanned(item, `${path}[${i}]`, hits));
    return;
  }
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (BANNED.has(key)) hits.push(`${path}.${key}`);
    collectBanned(value, `${path}.${key}`, hits);
  }
}

for (const [name, schema] of [
  ["WINE_SCHEMA", WINE_SCHEMA],
  ["EXTRACT_SCHEMA", EXTRACT_SCHEMA],
  ["REFINE_SCHEMA", REFINE_SCHEMA],
  ["IMPORT_SCHEMA", IMPORT_SCHEMA],
] as const) {
  const hits: string[] = [];
  collectBanned(schema, name, hits);
  assert.deepEqual(hits, [], `${name} must not send Anthropic-unsupported JSON Schema keywords`);
}

console.log("anthropic schema keyword checks passed");

// Claude Opus 4.8 rejects temperature / top_p / top_k (400 invalid_request_error).
const SAMPLING = /\b(?:temperature|top_p|top_k)\s*:/;
for (const file of ["analyze/route.ts", "refine/route.ts", "import/route.ts"]) {
  const src = readFileSync(join(process.cwd(), "app/api", file), "utf8");
  assert.equal(SAMPLING.test(src), false, `${file} must not send Opus 4.8-rejected sampling params`);
}

console.log("anthropic sampling param checks passed");
