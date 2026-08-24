import sharp from "sharp";

type Bounds = { left?: unknown; top?: unknown; right?: unknown; bottom?: unknown };

function percent(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(100, value))
    : fallback;
}

/** Creates a temporary high-resolution reading crop; original customer bytes stay unchanged. */
export async function createPrecisionCrop(dataUrl: string, bounds: Bounds) {
  const match = /^data:image\/(jpeg|png|webp);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return null;
  const source = Buffer.from(match[2], "base64");
  const image = sharp(source, { failOn: "error" });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return null;

  // Include the right-hand price labels and a little context around the candle plot.
  const leftPct = Math.max(0, percent(bounds.left, 5) - 4);
  const topPct = Math.max(0, percent(bounds.top, 8) - 5);
  const rightPct = Math.min(100, percent(bounds.right, 94) + 10);
  const bottomPct = Math.min(100, percent(bounds.bottom, 88) + 5);
  const left = Math.floor(metadata.width * leftPct / 100);
  const top = Math.floor(metadata.height * topPct / 100);
  const width = Math.max(1, Math.min(metadata.width - left, Math.ceil(metadata.width * (rightPct - leftPct) / 100)));
  const height = Math.max(1, Math.min(metadata.height - top, Math.ceil(metadata.height * (bottomPct - topPct) / 100)));
  if (width < 120 || height < 120) return null;

  const output = await image
    .extract({ left, top, width, height })
    .resize({ width: Math.min(1800, Math.max(width, 1400)), withoutEnlargement: false })
    .png({ compressionLevel: 8 })
    .toBuffer();
  return `data:image/png;base64,${output.toString("base64")}`;
}
