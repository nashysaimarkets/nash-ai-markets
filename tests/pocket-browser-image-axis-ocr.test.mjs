import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.env.POCKET_QA_SOURCE_ROOT ?? resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { build } = createRequire(resolve(root, 'package.json'))('esbuild');
const entry = resolve(root, 'app/pocket/browser-image-axis-ocr.ts');
const hash = value => createHash('sha256').update(value).digest('hex');
const sourceSha256 = hash(await readFile(entry));
const built = await build({
  entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', write: false,
  plugins: [{ name: 'controlled-ocr-only', setup(b) {
    b.onResolve({ filter: /^tesseract\.js$/ }, () => ({ path: 'controlled-ocr', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `
      export const PSM = { SPARSE_TEXT: 11, SINGLE_BLOCK: 6 };
      export async function createWorker() {
        globalThis.__pocketAxisOcrTest.created++;
        return globalThis.__pocketAxisOcrTest.worker;
      }
    ` }));
  } }],
});
const { verifyImagePriceAxis } = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].contents).toString('base64'));

const rows = [100, 200, 300, 400, 500, 600, 700];
const region = {
  status: 'measured', width: 1000, height: 1000,
  plotPixels: { left: 100, right: 850, top: 100, bottom: 700 },
  plotPercent: { left: 10, right: 85, top: 10, bottom: 70 },
  gridRowPixels: rows,
  axisLabelRegionPixels: { side: 'right', left: 860, right: 950, top: 90, bottom: 710, matchedGridRows: rows },
  evidence: { gridRows: 7, candles: 12, candleSpanPixels: 600, borderEdges: 4, coherentPricePanels: 1, axisTextColumns: 1 },
};
const words = rows.map((y, i) => ({ text: String(160 - i * 10), confidence: 95, x: 862, y: y + 1, width: 60, height: 12 }));
function tsv(readings, canvas) {
  const sx = canvas.width / 90, sy = canvas.height / 620;
  return 'level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n' + readings.map((w, i) => [
    5, 1, 1, 1, i + 1, 1, (w.x - 860) * sx, (w.y - w.height / 2 - 90) * sy,
    w.width * sx, w.height * sy, w.confidence, w.text,
  ].join('\t')).join('\n');
}

/** Actual browser wrapper with controlled OCR/DOM adapters. No real OCR,
 * raster, provider, network or semantic-accuracy claim is made by this test. */
async function run(firstWords, expectedStatus, expectedPasses) {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const previousControl = Object.getOwnPropertyDescriptor(globalThis, '__pocketAxisOcrTest');
  let passes = 0, terminations = 0;
  const canvases = [];
  try {
    globalThis.document = { createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }) };
      canvases.push(canvas);
      return canvas;
    } };
    globalThis.__pocketAxisOcrTest = { created: 0, worker: {
      async setParameters() {},
      async recognize(canvas) { return { data: { tsv: tsv(passes++ === 0 ? firstWords : words, canvas) } }; },
      async terminate() { terminations++; },
    } };
    const result = await verifyImagePriceAxis(
      { naturalWidth: 1000, naturalHeight: 1000 }, region, [160, 100], new AbortController().signal,
    );
    assert.equal(result.status, expectedStatus);
    assert.equal(passes, expectedPasses);
    assert.equal(globalThis.__pocketAxisOcrTest.created, 1);
    assert.equal(terminations, 1);
    assert.ok(canvases.every(c => c.width === 1 && c.height === 1));
    assert.equal(hash(await readFile(entry)), sourceSha256);
    return result;
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete globalThis.document;
    if (previousControl) Object.defineProperty(globalThis, '__pocketAxisOcrTest', previousControl);
    else delete globalThis.__pocketAxisOcrTest;
  }
}

test('OCR wrapper stops on confident same-row contradictions before a second read', async () => {
  const result = await run([...words, { ...words[3], text: '131' }], 'held', 1);
  assert.match(result.reason, /conflict/);
});
test('OCR wrapper stops on competing columns before a second read', async () => {
  const result = await run([...words.map(w => ({ ...w, width: 30 })), ...words.map(w => ({ ...w, x: 915, width: 30 }))], 'held', 1);
  assert.match(result.reason, /competing/);
});
test('OCR wrapper retains insufficient first-pass readings when the next pass contradicts them', async () => {
  const result = await run([{ ...words[0], text: '163' }, { ...words[3], text: '131' }], 'held', 2);
  assert.match(result.reason, /conflict/);
});
test('OCR wrapper allows an insufficient reading to gain consistent evidence without discarding it', async () => {
  const result = await run([words[0], words[3]], 'verified', 2);
  assert.equal(result.wordEvidence.length, 9);
  assert.equal(result.anchors.length, 7);
  assert.deepEqual(result.matchedModelPrices, [160, 100]);
});
