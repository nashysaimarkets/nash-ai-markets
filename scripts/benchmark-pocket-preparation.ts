import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";
import { measureChartPixels } from "../app/pocket/browser-chart-extractor";

const directory = process.argv[2];
const output = process.argv[3];
if (!directory || !output) throw new Error("Usage: benchmark-pocket-preparation.ts approved-image-directory output.json [baseline-source-file]");
const baselineSource = process.argv[4] ? await readFile(process.argv[4], "utf8") : execFileSync("git", ["show", "HEAD:app/pocket/browser-chart-extractor.ts"], {encoding: "utf8"});
function load(source: string) {
  const context = vm.createContext({ exports: {} });
  vm.runInContext(ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }), context);
  return context.exports.measureChartPixels as typeof measureChartPixels;
}
const baseline = load(baselineSource);
const candidate = load(await readFile(new URL("../app/pocket/browser-chart-extractor.ts", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../prototype/chart-extraction/ig-development-manifest.json", import.meta.url), "utf8")) as Array<{file: string; sha256: string}>;
const rows: Array<{file: string; role: string; baselineMs: number; candidateMs: number; identical: boolean}> = [];
for (const entry of manifest) {
  const bytes = await readFile(resolve(directory, entry.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), entry.sha256, "Corpus image changed");
  const metadata = await sharp(bytes).metadata();
  const scale = Math.min(1, 900 / Math.max(metadata.width!, metadata.height!));
  const {data, info} = await sharp(bytes).resize({width: Math.round(metadata.width! * scale)}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const image = {data: new Uint8ClampedArray(data), width: info.width, height: info.height};
  for (const role of ["PRIMARY", "INDICATOR_VOLUME"] as const) {
    const start = performance.now(); const before = baseline(image, role); const oldMs = performance.now() - start;
    const candidateStart = performance.now(); const after = candidate(image, role); const newMs = performance.now() - candidateStart;
    assert.equal(JSON.stringify(after), JSON.stringify(before), `${entry.file}: changed measurement`);
    rows.push({file: entry.file, role, baselineMs: +oldMs.toFixed(2), candidateMs: +newMs.toFixed(2), identical: true});
  }
}
const average = (key: "baselineMs" | "candidateMs") => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const result = { images: manifest.length, comparisons: rows.length, identical: rows.every(row => row.identical), meanBaselineMs: average("baselineMs"), meanCandidateMs: average("candidateMs"), rows, limitation: "Local CPU microbenchmark; independent annotation accuracy and phone/network/AI latency are not established." };
await writeFile(output, JSON.stringify(result, null, 2));
console.log(JSON.stringify({...result, rows: undefined}));
