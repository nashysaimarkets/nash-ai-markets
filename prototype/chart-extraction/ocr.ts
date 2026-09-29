import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import type { PriceAnchor } from "./extractor.ts";

const execFileAsync = promisify(execFile);

export type OcrWord = { x: number; y: number; width: number; height: number; confidence: number; text: string };
export type OcrEvidence = {
  instrument?: string;
  timeframe?: string;
  anchors: PriceAnchor[];
  volumeProfile: { visibleCue: boolean; pointOfControlYPercent?: number };
  confidence: { instrument: number; timeframe: number; scale: number };
};

export const exactTimeframe = (text: string) => text.match(/\b(?:[1-9]\d*)(?:m|h|d|w|mo)\b/i)?.[0];

const numericText = (text: string) => {
  const candidate = text.trim().replace(/,/g, "");
  if (/[^0-9Oo.+-]/.test(candidate)) return null;
  const cleaned = candidate.replace(/[Oo]/g, "0");
  return /^[-+]?\d+(?:\.\d+)?$/.test(cleaned) ? Number(cleaned) : null;
};

export function parseTsv(tsv: string): OcrWord[] {
  return tsv.split(/\r?\n/).slice(1).flatMap(line => {
    const fields = line.split("\t");
    if (fields.length < 12 || !fields[11]?.trim()) return [];
    return [{ x: Number(fields[6]), y: Number(fields[7]), width: Number(fields[8]), height: Number(fields[9]), confidence: Number(fields[10]), text: fields.slice(11).join("\t").trim() }];
  }).filter(word => Number.isFinite(word.x) && Number.isFinite(word.y));
}

function scaleAnchors(words: OcrWord[], width: number, height: number): PriceAnchor[] {
  const candidates = words.flatMap(word => {
    const price = numericText(word.text);
    const centreX = word.x + word.width / 2;
    const centreY = word.y + word.height / 2;
    return price !== null && word.confidence >= 70 && centreX >= width * 0.76 && centreY >= height * 0.1 && centreY <= height * 0.88
      ? [{ price, y: centreY, x: centreX }]
      : [];
  });
  const groups = new Map<string, Array<PriceAnchor & { x: number }>>();
  for (const anchor of candidates) {
    const magnitude = Math.floor(Math.log10(Math.max(Math.abs(anchor.price), 1e-8)));
    const xBand = Math.round(anchor.x / Math.max(12, width * 0.06));
    const key = `${magnitude}:${xBand}`;
    groups.set(key, [...(groups.get(key) ?? []), anchor]);
  }
  const ranked = [...groups.values()].filter(group => group.length >= 3).sort((a, b) => b.length - a.length);
  for (const group of ranked) {
    const ordered = [...group].sort((a, b) => a.y - b.y);
    let best: Array<PriceAnchor & { x: number }> = [];
    for (let start = 0; start < ordered.length; start++) {
      const run = [ordered[start]];
      for (let i = start + 1; i < ordered.length; i++) {
        if (ordered[i].price < run[run.length - 1].price && ordered[i].y - run[run.length - 1].y >= 4) run.push(ordered[i]);
      }
      if (run.length > best.length) best = run;
    }
    if (best.length >= 3) return best.map(({ price, y }) => ({ price, y }));
  }
  return [];
}

export function deriveOcrEvidence(words: OcrWord[], width: number, height: number): OcrEvidence {
  const top = words.filter(word => word.y < height * 0.32 && word.confidence >= 55);
  const timeframeWord = top.find(word => /^(?:[1-9]\d*)(?:m|h|d|w|mo)$/i.test(word.text));
  const dfbIndex = top.findIndex(word => /^\(DFB\)$/i.test(word.text));
  const dfbWord = dfbIndex >= 0 ? top[dfbIndex] : undefined;
  const instrumentWords = dfbWord
    ? top.filter(word => Math.abs((word.y + word.height / 2) - (dfbWord.y + dfbWord.height / 2)) <= Math.max(18, height * 0.012) && word.x <= dfbWord.x)
    : top.filter(word => word.y < height * 0.18 && word.x < width * 0.6 && /[A-Za-z]/.test(word.text)).slice(-4);
  const instrumentConfidence = instrumentWords.length ? Math.min(...instrumentWords.map(word => word.confidence)) / 100 : 0;
  const dfbInstrument = instrumentWords.map(word => word.text).join(" ").replace(/^[<\s]+/, "").trim();
  const tickerWord = top.find(word => word.confidence >= 75 && /^[A-Z]{2,6}(?:[/-][A-Z]{2,6})$/.test(word.text));
  const instrument = dfbWord && instrumentConfidence >= 0.55 && /[A-Za-z].+\(DFB\)/i.test(dfbInstrument) ? dfbInstrument : tickerWord?.text;
  const timeframe = dfbWord ? timeframeWord?.text : undefined;
  const anchors = scaleAnchors(words, width, height);
  const allText = words.map(word => word.text).join(" ");
  const visibleCue = /volume\s+profile|high\s+volume\s+nodes|\bPOC\b.*\bVAH\b|\bVAH\b.*\bVAL\b/i.test(allText);
  const pocWord = words.find(word => /^POC:?$/i.test(word.text));
  return {
    instrument,
    timeframe,
    anchors,
    volumeProfile: { visibleCue, ...(pocWord ? { pointOfControlYPercent: Number((100 * (pocWord.y + pocWord.height / 2) / height).toFixed(2)) } : {}) },
    confidence: {
      instrument: instrument ? (dfbWord ? instrumentConfidence : (tickerWord?.confidence ?? 0) / 100) : 0,
      timeframe: timeframe ? (timeframeWord?.confidence ?? 0) / 100 : 0,
      scale: anchors.length >= 3 ? Math.min(1, anchors.length / 6) : 0,
    },
  };
}

export async function selectedTimeframe(imagePath: string, width: number, height: number) {
  const raw = await sharp(imagePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const startY = Math.floor(height * 0.78);
  const bandHeight = height - startY;
  const mask = new Uint8Array(width * bandHeight);
  for (let y = startY; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * raw.info.channels;
    const r = raw.data[offset] ?? 0;
    const g = raw.data[offset + 1] ?? 0;
    const b = raw.data[offset + 2] ?? 0;
    if (b - r > 45 && g - r > 20 && b > 130) mask[(y - startY) * width + x] = 1;
  }
  const seen = new Uint8Array(mask.length);
  const boxes: Array<{ left: number; top: number; right: number; bottom: number; area: number }> = [];
  for (let index = 0; index < mask.length; index++) {
    if (!mask[index] || seen[index]) continue;
    const queue = [index];
    seen[index] = 1;
    let cursor = 0, area = 0, left = width, right = 0, top = bandHeight, bottom = 0;
    while (cursor < queue.length) {
      const current = queue[cursor++];
      const x = current % width;
      const y = Math.floor(current / width);
      area++; left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of [current - 1, current + 1, current - width, current + width]) {
        if (next >= 0 && next < mask.length && !seen[next] && mask[next] && Math.abs((next % width) - x) <= 1) {
          seen[next] = 1; queue.push(next);
        }
      }
    }
    const boxWidth = right - left + 1;
    const boxHeight = bottom - top + 1;
    if (area >= 400 && boxWidth >= 35 && boxWidth <= width * 0.16 && boxHeight >= 20 && boxHeight <= 80) boxes.push({ left, right, top: top + startY, bottom: bottom + startY, area });
  }
  const selected = boxes.sort((a, b) => b.area - a.area)[0];
  if (!selected) return undefined;
  const padding = 4;
  const left = Math.max(0, selected.left - padding);
  const top = Math.max(0, selected.top - padding);
  const cropWidth = Math.min(width - left, selected.right - selected.left + 1 + padding * 2);
  const cropHeight = Math.min(height - top, selected.bottom - selected.top + 1 + padding * 2);
  const png = await sharp(imagePath).extract({ left, top, width: cropWidth, height: cropHeight }).resize({ width: cropWidth * 8 }).png().toBuffer();
  const temporary = await mkdtemp(join(tmpdir(), "pocket-ocr-"));
  const cropPath = join(temporary, "selected.png");
  try {
    await writeFile(cropPath, png);
    const { stdout } = await execFileAsync("tesseract", [cropPath, "stdout", "--psm", "8", "-c", "tessedit_char_whitelist=0123456789mhdwo"], { maxBuffer: 1024 * 1024 });
    return exactTimeframe(stdout);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function targetedHeaderTimeframe(imagePath: string, width: number, height: number) {
  const left = 0;
  const top = Math.max(0, Math.floor(height * 0.155));
  const cropWidth = Math.max(1, Math.floor(width * 0.26));
  const cropHeight = Math.max(1, Math.floor(height * 0.04));
  const source = sharp(imagePath)
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize({ width: cropWidth * 10 })
    .grayscale()
    .normalize();
  const [normalized, thresholded] = await Promise.all([
    source.clone().png().toBuffer(),
    source.clone().threshold(190).png().toBuffer(),
  ]);
  const temporary = await mkdtemp(join(tmpdir(), "pocket-timeframe-"));
  try {
    for (const [index, png] of [thresholded, normalized].entries()) {
      const cropPath = join(temporary, `header-${index}.png`);
      await writeFile(cropPath, png);
      const { stdout } = await execFileAsync("tesseract", [cropPath, "stdout", "--psm", "7", "-c", "tessedit_char_whitelist=0123456789mhdwo"], { maxBuffer: 1024 * 1024 });
      const timeframe = exactTimeframe(stdout);
      if (timeframe) return timeframe;
    }
    return undefined;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function targetedDfbLabel(imagePath: string, width: number, height: number) {
  const left = 0;
  const top = Math.max(0, Math.floor(height * 0.125));
  const cropWidth = Math.max(1, Math.floor(width * 0.48));
  const cropHeight = Math.max(1, Math.floor(height * 0.085));
  const png = await sharp(imagePath).extract({ left, top, width: cropWidth, height: cropHeight }).resize({ width: cropWidth * 5 }).png().toBuffer();
  const temporary = await mkdtemp(join(tmpdir(), "pocket-label-"));
  const cropPath = join(temporary, "label.png");
  try {
    await writeFile(cropPath, png);
    const { stdout } = await execFileAsync("tesseract", [cropPath, "stdout", "--psm", "6"], { maxBuffer: 1024 * 1024 });
    const line = stdout.split(/\r?\n/).find(value => /\(DFB\)/i.test(value));
    const matched = line?.match(/([A-Za-z0-9][A-Za-z0-9 /().-]*\(DFB\))/i)?.[1].replace(/\s+/g, " ").trim();
    return matched;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export async function readChartOcr(imagePath: string, width: number, height: number): Promise<OcrEvidence> {
  const { stdout } = await execFileAsync("tesseract", [imagePath, "stdout", "--psm", "11", "tsv"], { maxBuffer: 16 * 1024 * 1024 });
  const evidence = deriveOcrEvidence(parseTsv(stdout), width, height);
  if (!evidence.instrument && /\(DFB\)/i.test(stdout)) {
    const focused = await targetedDfbLabel(imagePath, width, height);
    if (focused) {
      evidence.instrument = focused;
      evidence.confidence.instrument = 0.9;
    }
  }
  if (/^Al Index \(DFB\)$/i.test(evidence.instrument ?? "")) {
    evidence.instrument = "AI Index (DFB)";
    evidence.confidence.instrument = Math.min(evidence.confidence.instrument, 0.85);
  }
  if (!evidence.timeframe) {
    const targeted = await targetedHeaderTimeframe(imagePath, width, height) ?? await selectedTimeframe(imagePath, width, height);
    if (targeted) {
      evidence.timeframe = targeted;
      evidence.confidence.timeframe = 0.9;
    }
  }
  return evidence;
}
