import type { PixelRectangle, PlotRaster } from "../../app/pocket/image-plot-region.ts";

type Colour = [number, number, number];
type Panel = { plot: PixelRectangle; axis?: "left" | "right" | "both" | "none"; candles?: "price" | "volume" | "none";
  borders?: boolean; gridFractions?: number[]; stroke?: number; labels?: boolean };
const digits: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
};
export function plotRaster({ width = 720, height = 480, dark = false, gridContrast = 24,
  panels = [{ plot: { left: 60, right: 590, top: 55, bottom: 350 } }] }:
  { width?: number; height?: number; dark?: boolean; gridContrast?: number; panels?: Panel[] } = {}) {
  const background = dark ? 25 : 245;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) { data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = background; data[i * 4 + 3] = 255; }
  const grid: Colour = Array(3).fill(background + (dark ? gridContrast : -gridContrast)) as Colour;
  const ink: Colour = dark ? [225, 225, 225] : [25, 25, 25];
  const fill = (left: number, top: number, right: number, bottom: number, rgb: Colour) => {
    for (let y = Math.max(0, Math.round(top)); y <= Math.min(height - 1, Math.round(bottom)); y++)
      for (let x = Math.max(0, Math.round(left)); x <= Math.min(width - 1, Math.round(right)); x++) {
        const i = (y * width + x) * 4; data[i] = rgb[0]; data[i + 1] = rgb[1]; data[i + 2] = rgb[2];
      }
  };
  const label = (text: string, x: number, y: number) => {
    for (const [i, digit] of [...text].entries()) for (const [dy, row] of digits[digit].entries()) for (const [dx, cell] of [...row].entries()) {
      if (cell === "1") fill(x + i * 8 + dx * 2, y + dy * 2, x + i * 8 + dx * 2 + 1, y + dy * 2 + 1, ink);
    }
  };
  const expected: PixelRectangle[] = [];
  for (const panel of panels) {
    const { left, top, right, bottom } = panel.plot, w = right - left, h = bottom - top;
    const stroke = panel.stroke ?? 1, fractions = panel.gridFractions ?? [0, .2, .4, .6, .8, 1];
    const rows = fractions.map(v => Math.round(top + h * v));
    for (const y of rows) fill(left, y, right + stroke - 1, y + stroke - 1, grid);
    if (panel.borders !== false) {
      fill(left, top, left + stroke - 1, bottom + stroke - 1, grid);
      fill(right, top, right + stroke - 1, bottom + stroke - 1, grid);
    }
    const axis = panel.axis ?? "right";
    if (panel.labels !== false) for (const [index, y] of rows.entries()) {
      const text = String(12345 - index * 125);
      if (axis === "right" || axis === "both") label(text, right + 9, y - 4);
      if (axis === "left" || axis === "both") label(text, left - 9 - (text.length * 8 - 2), y - 4);
    }
    const kind = panel.candles ?? "price";
    const centers = [.3, .42, .25, .5, .65, .55, .7, .38, .58, .48, .33, .44];
    if (kind !== "none") for (const [i, center] of centers.entries()) {
      const x = Math.round(left + w * (.06 + i * .88 / (centers.length - 1)));
      const bodyWidth = Math.max(3, Math.floor(w / (centers.length * 4.5))), half = Math.floor(bodyWidth / 2);
      const colour: Colour = i % 2 ? [20, 185, 145] : [225, 70, 100];
      if (kind === "volume") fill(x - half, bottom - 10 - h * (.1 + center * .2), x + half, bottom - 10, colour);
      else {
        fill(x, top + h * (center - .08), x, top + h * (center + .1), colour);
        fill(x - half, top + h * (center - .025), x + half, top + h * (center + .04), colour);
      }
    }
    expected.push({ left: left + (stroke - 1) / 2, right: right + (stroke - 1) / 2,
      top: top + (stroke - 1) / 2, bottom: bottom + (stroke - 1) / 2 });
  }
  return { raster: { width, height, data } satisfies PlotRaster, expected, fill };
}
