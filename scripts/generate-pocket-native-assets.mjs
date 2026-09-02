import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const root = process.cwd();
const source = path.join(root, "public/icons/app-icon-maskable-512.png");
const androidRes = path.join(root, "android/app/src/main/res");
const nativeBackground = "#06130f";

const launcherSizes = {
  mdpi: { legacy: 48, foreground: 108 },
  hdpi: { legacy: 72, foreground: 162 },
  xhdpi: { legacy: 96, foreground: 216 },
  xxhdpi: { legacy: 144, foreground: 324 },
  xxxhdpi: { legacy: 192, foreground: 432 },
};

const splashSizes = [
  ["drawable", 480, 320],
  ["drawable-land-mdpi", 480, 320],
  ["drawable-land-hdpi", 800, 480],
  ["drawable-land-xhdpi", 1280, 720],
  ["drawable-land-xxhdpi", 1600, 960],
  ["drawable-land-xxxhdpi", 1920, 1280],
  ["drawable-port-mdpi", 320, 480],
  ["drawable-port-hdpi", 480, 800],
  ["drawable-port-xhdpi", 720, 1280],
  ["drawable-port-xxhdpi", 960, 1600],
  ["drawable-port-xxxhdpi", 1280, 1920],
];

function backdrop(width, height) {
  return Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="g" cx="50%" cy="48%" r="68%">
        <stop offset="0" stop-color="#17372d"/>
        <stop offset="0.34" stop-color="#0b211b"/>
        <stop offset="1" stop-color="${nativeBackground}"/>
      </radialGradient>
      <radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0" stop-color="#54eba0" stop-opacity="0.16"/>
        <stop offset="0.58" stop-color="#d8b36a" stop-opacity="0.06"/>
        <stop offset="1" stop-color="#06130f" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#g)"/>
    <circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.38}" fill="url(#halo)"/>
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

async function renderLaunchAsset(output, width, height, iconScale = 0.28) {
  const iconSize = Math.round(Math.min(width, height) * iconScale);
  const icon = await sharp(brandMark(iconSize)).png().toBuffer();
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(backdrop(width, height))
    .composite([{ input: icon, left: Math.round((width - iconSize) / 2), top: Math.round((height - iconSize) / 2) }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

for (const [density, sizes] of Object.entries(launcherSizes)) {
  const directory = path.join(androidRes, `mipmap-${density}`);
  await mkdir(directory, { recursive: true });
  const legacy = await sharp(source).resize(sizes.legacy, sizes.legacy).png().toBuffer();
  await Promise.all([
    sharp(legacy).toFile(path.join(directory, "ic_launcher.png")),
    sharp(legacy).toFile(path.join(directory, "ic_launcher_round.png")),
  ]);

  const safeSize = Math.round(sizes.foreground * 0.66);
  const safeIcon = await sharp(brandMark(safeSize)).png().toBuffer();
  await sharp({ create: { width: sizes.foreground, height: sizes.foreground, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: safeIcon, left: Math.round((sizes.foreground - safeSize) / 2), top: Math.round((sizes.foreground - safeSize) / 2) }])
    .png()
    .toFile(path.join(directory, "ic_launcher_foreground.png"));
}

for (const [directory, width, height] of splashSizes) {
  await renderLaunchAsset(path.join(androidRes, directory, "splash.png"), width, height);
}

const iosSplash = path.join(root, "ios/App/App/Assets.xcassets/Splash.imageset");
for (const filename of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"]) {
  await renderLaunchAsset(path.join(iosSplash, filename), 2732, 2732, 0.25);
}

console.log("Pocket Bullseye native icons and launch assets generated.");
