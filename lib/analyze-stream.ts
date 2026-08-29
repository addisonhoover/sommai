import type { AnalyzeResult } from "./types";

export type ScanCue = {
  sourceType: AnalyzeResult["sourceType"];
  glassOnly: boolean;
};

export type AnalyzeStreamEvent =
  | ({ type: "scan" } & ScanCue)
  | ({ type: "result" } & AnalyzeResult)
  | { type: "error"; error: string };

export async function readAnalyzeStream(
  res: Response,
  onScan?: (cue: ScanCue) => void,
): Promise<AnalyzeResult> {
  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("ndjson")) {
    return res.json() as Promise<AnalyzeResult>;
  }
  if (!res.body) {
    throw new Error("No analysis returned.");
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let result: AnalyzeResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const msg = JSON.parse(trimmed) as AnalyzeStreamEvent;
      if (msg.type === "scan") onScan?.({ sourceType: msg.sourceType, glassOnly: msg.glassOnly });
      else if (msg.type === "result") result = msg;
      else if (msg.type === "error") throw new Error(msg.error);
    }
  }

  const tail = buf.trim();
  if (tail) {
    const msg = JSON.parse(tail) as AnalyzeStreamEvent;
    if (msg.type === "scan") onScan?.({ sourceType: msg.sourceType, glassOnly: msg.glassOnly });
    else if (msg.type === "result") result = msg;
    else if (msg.type === "error") throw new Error(msg.error);
  }

  if (!result) throw new Error("No analysis returned.");
  return result;
}
