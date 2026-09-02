import { readdir, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const sourceDirectory = path.resolve(process.argv[2] || "docs/app-store/v1.1-assets/screenshots");
const outputDirectory = path.resolve(process.argv[3] || "docs/google-play/assets");
const phoneDirectory = path.join(outputDirectory, "phone");
const files = (await readdir(sourceDirectory))
  .filter((file) => /^\d{2}.*\.png$/i.test(file))
  .sort()
  .slice(0, 8);

if (files.length < 4) throw new Error(`Expected at least four approved screenshots in ${sourceDirectory}.`);
await mkdir(phoneDirectory, { recursive: true });

function background(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="42%" r="78%"><stop offset="0" stop-color="#173b30"/><stop offset="0.42" stop-color="#0a211a"/><stop offset="1" stop-color="#050d0b"/></radialGradient>
      <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#54eea0" stop-opacity=".24"/><stop offset=".48" stop-color="#54eea0" stop-opacity="0"/><stop offset="1" stop-color="#e0b957" stop-opacity=".2"/></linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="34" fill="none" stroke="url(#edge)" stroke-width="2"/>
  </svg>`);
}

function brandMark(size) {
  const center = size / 2;
  const outer = size * 0.31;
  const inner = size * 0.19;
  const tick = size * 0.39;
  const stroke = Math.max(3, size * 0.026);
  return Buffer.from(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <g fill="none" stroke-linecap="round">
      <circle cx="${center}" cy="${center}" r="${outer}" stroke="#f2cf76" stroke-width="${stroke}"/>
      <circle cx="${center}" cy="${center}" r="${inner}" stroke="#857648" stroke-width="${stroke * 0.72}"/>
      <path d="M ${center} ${center - tick} V ${center - outer + stroke * 0.3} M ${center} ${center + outer - stroke * 0.3} V ${center + tick} M ${center - tick} ${center} H ${center - outer + stroke * 0.3} M ${center + outer - stroke * 0.3} ${center} H ${center + tick}" stroke="#f2cf76" stroke-width="${stroke}"/>
    </g>
    <circle cx="${center}" cy="${center}" r="${size * 0.082}" fill="#57a4f6"/>
    <circle cx="${center}" cy="${center}" r="${size * 0.027}" fill="#f7f5ed"/>
  </svg>`);
}

for (const file of files) {
  const input = path.join(sourceDirectory, file);
  const outputFile = file.replace(/\.png$/i, ".jpg");
  const foreground = await sharp(input).resize({ width: 884, height: 1920, fit: "fill" }).png().toBuffer();
  const ambient = await sharp(input).resize({ width: 1080, height: 1920, fit: "cover" }).blur(34).modulate({ brightness: 0.42, saturation: 0.7 }).png().toBuffer();
  await sharp(background(1080, 1920))
    .composite([
      { input: ambient, blend: "screen", opacity: 0.12 },
      { input: foreground, left: 98, top: 0 },
    ])
    .flatten({ background: "#050d0b" })
    .removeAlpha()
    .jpeg({ quality: 94, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(path.join(phoneDirectory, outputFile));
}

const iconSource = path.resolve("public/icons/app-icon-maskable-512.png");
await sharp(iconSource).resize(512, 512).flatten({ background: "#06130f" }).png({ compressionLevel: 9 }).toFile(path.join(outputDirectory, "app-icon-512.png"));

const mark = await sharp(brandMark(230)).png().toBuffer();
const featureGraphic = Buffer.from(`<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bg" cx="26%" cy="48%" r="90%"><stop stop-color="#174132"/><stop offset=".45" stop-color="#081b15"/><stop offset="1" stop-color="#040a09"/></radialGradient>
    <linearGradient id="line" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#53eca0"/><stop offset=".62" stop-color="#53eca0" stop-opacity=".25"/><stop offset="1" stop-color="#e6bd58"/></linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <path d="M0 418 C210 348 330 492 536 395 S838 342 1024 404" fill="none" stroke="#52ee9c" stroke-opacity=".12" stroke-width="2"/>
  <path d="M0 432 C220 362 366 505 562 416 S838 365 1024 426" fill="none" stroke="#e6bd58" stroke-opacity=".12" stroke-width="2"/>
  <rect x="314" y="92" width="616" height="3" fill="url(#line)"/>
  <text x="314" y="145" fill="#6ef0aa" font-family="Arial, sans-serif" font-size="20" font-weight="700" letter-spacing="5">POCKET BULLSEYE</text>
  <text x="314" y="228" fill="#f5f6f2" font-family="Arial, sans-serif" font-size="44" font-weight="900" letter-spacing="-1">ONE CHART.</text>
  <text x="314" y="281" fill="#58eca2" font-family="Arial, sans-serif" font-size="42" font-weight="900" letter-spacing="-1">ONE HONEST CHALLENGE.</text>
  <text x="316" y="339" fill="#a9b7b1" font-family="Arial, sans-serif" font-size="18" font-weight="500">AI-powered evidence, scenarios and risk checks before you act.</text>
  <text x="316" y="389" fill="#d8b967" font-family="monospace" font-size="13" font-weight="700" letter-spacing="3">SCAN · UNDERSTAND · PLAN · REVIEW</text>
</svg>`);

await sharp(featureGraphic)
  .composite([{ input: mark, left: 46, top: 135 }])
  .flatten({ background: "#040a09" })
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(path.join(outputDirectory, "feature-graphic-1024x500.png"));

console.log(`Generated ${files.length} Google Play phone screenshots plus icon and feature graphic in ${outputDirectory}.`);
