import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1242;
const HEIGHT = 2688;
const output = resolve("docs/app-store/v1.2-assets/screenshots");
const contactSheetPath = resolve("docs/app-store/v1.2-assets/pocket-v1.2-contact-sheet.png");
mkdirSync(output, { recursive: true });

const C = {
  ink: "#02070a",
  bg: "#050b0f",
  panel: "#08141a",
  panel2: "#0b1c22",
  edge: "#29434d",
  text: "#f4fbf8",
  muted: "#93a7aa",
  dim: "#64767c",
  green: "#57f2a1",
  cyan: "#65f1ed",
  gold: "#f5c84c",
  orange: "#ff9a3d",
  red: "#ff6472",
};

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
})[char]);

const wrap = (copy, max = 32) => {
  const words = String(copy).split(/\s+/);
  const result = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && next.length > max) {
      result.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) result.push(line);
  return result;
};

const label = (copy, x, y, size, options = {}) => {
  const {
    fill = C.text,
    weight = 700,
    max = 32,
    lineHeight = Math.round(size * 1.14),
    anchor = "start",
    family = "Arial,Helvetica,sans-serif",
    tracking = 0,
    opacity = 1,
  } = options;
  const rows = Array.isArray(copy) ? copy : wrap(copy, max);
  return `<text x="${x}" y="${y}" fill="${fill}" fill-opacity="${opacity}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${tracking}">${rows.map((row, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${escapeXml(row)}</tspan>`).join("")}</text>`;
};

const mono = (copy, x, y, size, options = {}) => label(copy, x, y, size, {
  family: "Menlo,Consolas,monospace",
  tracking: 2,
  ...options,
});

const panel = (x, y, width, height, options = {}) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${options.radius ?? 30}" fill="${options.fill ?? C.panel}" fill-opacity="${options.opacity ?? 1}" stroke="${options.stroke ?? C.edge}" stroke-width="${options.strokeWidth ?? 2}"${options.filter ? ` filter="url(#${options.filter})"` : ""}/>`;

const pill = (copy, x, y, width, options = {}) => {
  const height = options.height ?? 70;
  const colour = options.colour ?? C.green;
  return `${panel(x, y, width, height, {
    radius: height / 2,
    fill: options.fill ?? "#071d18",
    stroke: options.stroke ?? colour,
    strokeWidth: options.strokeWidth ?? 2,
  })}${mono(copy, x + width / 2, y + height / 2 + (options.size ?? 21) * .34, options.size ?? 21, {
    fill: options.text ?? colour,
    anchor: "middle",
    max: 80,
    tracking: options.tracking ?? 1.5,
  })}`;
};

const dot = (x, y, colour, radius = 6) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${colour}" filter="url(#glow)"/>`;

const reticle = (cx, cy, radius, colour = C.green, opacity = .8) => `
  <g fill="none" stroke="${colour}" stroke-opacity="${opacity}" filter="url(#softGlow)">
    <circle cx="${cx}" cy="${cy}" r="${radius}" stroke-width="3" stroke-dasharray="8 16"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .58}" stroke-width="2" opacity=".65"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .13}" stroke-width="4"/>
    <path d="M ${cx - radius - 24} ${cy} H ${cx - radius * .66} M ${cx + radius * .66} ${cy} H ${cx + radius + 24} M ${cx} ${cy - radius - 24} V ${cy - radius * .66} M ${cx} ${cy + radius * .66} V ${cy + radius + 24}" stroke-width="4"/>
  </g>`;

const targetTag = (copy, x, y, colour = C.green, align = "left") => {
  const width = Math.max(188, copy.length * 13 + 54);
  const start = align === "right" ? x - width : x;
  return `<g filter="url(#softGlow)">${panel(start, y, width, 52, { radius: 10, fill: "#04100d", stroke: colour })}${dot(start + 20, y + 26, colour, 4)}${mono(copy, start + 37, y + 34, 16, { fill: colour, max: 80, tracking: 1 })}</g>`;
};

const cornerLock = (x, y, width, height, colour = C.green) => `<path d="M ${x} ${y + 40} V ${y} H ${x + 40} M ${x + width - 40} ${y} H ${x + width} V ${y + 40} M ${x} ${y + height - 40} V ${y + height} H ${x + 40} M ${x + width - 40} ${y + height} H ${x + width} V ${y + height - 40}" fill="none" stroke="${colour}" stroke-width="5" filter="url(#softGlow)"/>`;

const scannerBeam = (x, y, width, height, colour = C.green, position = .58, vertical = true) => vertical
  ? `<g filter="url(#beamGlow)"><rect x="${x + width * position - 65}" y="${y}" width="130" height="${height}" fill="url(#beamVertical)" opacity=".7"/><line x1="${x + width * position}" y1="${y}" x2="${x + width * position}" y2="${y + height}" stroke="${colour}" stroke-width="4"/><line x1="${x + width * position - 18}" y1="${y}" x2="${x + width * position - 18}" y2="${y + height}" stroke="${colour}" stroke-opacity=".32" stroke-width="2"/></g>`
  : `<g filter="url(#beamGlow)"><rect x="${x}" y="${y + height * position - 55}" width="${width}" height="110" fill="url(#beamHorizontal)" opacity=".75"/><line x1="${x}" y1="${y + height * position}" x2="${x + width}" y2="${y + height * position}" stroke="${colour}" stroke-width="4"/></g>`;

const candles = [
  [.02,.63,.47,.70,.42],[.07,.47,.39,.53,.34],[.12,.39,.49,.55,.35],[.17,.49,.57,.64,.44],[.22,.57,.51,.62,.46],
  [.27,.51,.38,.56,.31],[.32,.38,.31,.44,.25],[.37,.31,.37,.43,.28],[.42,.37,.46,.52,.34],[.47,.46,.41,.50,.36],
  [.52,.41,.55,.61,.38],[.57,.55,.66,.72,.50],[.62,.66,.59,.70,.53],[.67,.59,.47,.65,.41],[.72,.47,.39,.53,.33],
  [.77,.39,.45,.50,.35],[.82,.45,.34,.49,.28],[.87,.34,.27,.39,.22],[.92,.27,.35,.40,.24],[.97,.35,.29,.39,.25],
];

function chart(x, y, width, height, options = {}) {
  const {
    levels = false,
    zones = false,
    scan = false,
    mini = false,
    colour = C.green,
    beamPosition = .62,
    labelTop = "SIMULATED EXAMPLE",
    empty = false,
  } = options;
  const innerTop = y + (mini ? 20 : 52);
  const innerHeight = height - (mini ? 38 : 92);
  const candleWidth = Math.max(7, width / 54);
  let out = panel(x, y, width, height, { radius: mini ? 18 : 28, fill: "url(#chartPanel)", stroke: "#34535d" });
  out += `<g opacity=".72">`;
  for (let i = 1; i < 7; i += 1) out += `<line x1="${x + 2}" y1="${y + (height / 7) * i}" x2="${x + width - 2}" y2="${y + (height / 7) * i}" stroke="#18323d" stroke-width="2"/>`;
  for (let i = 1; i < 9; i += 1) out += `<line x1="${x + (width / 9) * i}" y1="${y + 2}" x2="${x + (width / 9) * i}" y2="${y + height - 2}" stroke="#112a33" stroke-width="2"/>`;
  out += `</g>`;
  if (!mini) out += mono(labelTop, x + 28, y + 35, 15, { fill: C.dim, max: 90, tracking: 1.3 });
  if (!empty) candles.forEach(([offset, open, close, high, low], index) => {
    if (mini && index % 2) return;
    const cx = x + 20 + offset * (width - 40);
    const candleColour = close < open ? C.green : C.red;
    const py = (value) => innerTop + value * innerHeight;
    out += `<line x1="${cx}" y1="${py(high)}" x2="${cx}" y2="${py(low)}" stroke="${candleColour}" stroke-width="${mini ? 3 : 5}"/>`;
    out += `<rect x="${cx - candleWidth / 2}" y="${Math.min(py(open), py(close))}" width="${candleWidth}" height="${Math.max(mini ? 5 : 10, Math.abs(py(open) - py(close)))}" rx="2" fill="${candleColour}"/>`;
  });
  if (empty) {
    out += reticle(x + width / 2, y + height / 2, Math.min(width, height) * .19, colour, .55);
    out += label("+", x + width / 2, y + height / 2 + 3, 42, { fill: colour, anchor: "middle", weight: 500, max: 4 });
    out += mono("NOT SUPPLIED", x + width / 2, y + height / 2 + 35, 10, { fill: C.dim, anchor: "middle", max: 30, tracking: 1 });
  }
  if (levels) {
    const resistanceY = y + height * .27;
    const supportY = y + height * .75;
    out += `<line x1="${x + 24}" y1="${resistanceY}" x2="${x + width - 24}" y2="${resistanceY}" stroke="${C.red}" stroke-width="7" filter="url(#softGlow)"/>`;
    out += `<line x1="${x + 24}" y1="${supportY}" x2="${x + width - 24}" y2="${supportY}" stroke="${C.green}" stroke-width="7" filter="url(#softGlow)"/>`;
    out += targetTag("R  7,760", x + width - 34, resistanceY - 27, C.red, "right");
    out += targetTag("S  7,700", x + width - 34, supportY - 27, C.green, "right");
    out += reticle(x + width * .64, resistanceY, 54, C.red, .75);
    out += reticle(x + width * .37, supportY, 54, C.green, .75);
  }
  if (zones) {
    const upper = y + height * .18;
    const lower = y + height * .76;
    out += `<rect x="${x + 18}" y="${upper}" width="${width - 36}" height="96" rx="16" fill="#6d3517" fill-opacity=".56" stroke="${C.gold}" stroke-width="4" stroke-dasharray="13 10" filter="url(#softGlow)"/>`;
    out += `<rect x="${x + 18}" y="${lower}" width="${width - 36}" height="88" rx="16" fill="#133d2b" fill-opacity=".72" stroke="${C.green}" stroke-width="4" stroke-dasharray="13 10"/>`;
    out += mono("EQUAL HIGHS · VISIBLE AREA", x + 46, upper + 58, 17, { fill: C.gold, max: 70 });
    out += mono("SWING CLUSTER · VISIBLE AREA", x + 46, lower + 53, 17, { fill: C.green, max: 70 });
    out += reticle(x + width * .78, upper + 48, 70, C.gold, .78);
  }
  if (scan) {
    out += scannerBeam(x + 2, y + 2, width - 4, height - 4, colour, beamPosition, true);
    out += reticle(x + width * beamPosition, y + height * .48, Math.min(width, height) * .18, colour, .82);
    out += cornerLock(x + 20, y + 20, width - 40, height - 40, colour);
  }
  return out;
}

function radar(cx, cy, radius, colour = C.green) {
  const points = [[-.52,-.3],[.31,-.52],[.56,.1],[-.22,.43],[.1,.22]];
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="#06130f" fill-opacity=".8" stroke="${colour}" stroke-opacity=".7" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .72}" fill="none" stroke="${colour}" stroke-opacity=".32" stroke-width="2"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .4}" fill="none" stroke="${colour}" stroke-opacity=".42" stroke-width="2"/>
    <path d="M ${cx} ${cy} L ${cx + radius * .95} ${cy - radius * .22} A ${radius} ${radius} 0 0 0 ${cx + radius * .33} ${cy - radius * .94} Z" fill="${colour}" fill-opacity=".14" stroke="${colour}" stroke-opacity=".35"/>
    <path d="M ${cx - radius} ${cy} H ${cx + radius} M ${cx} ${cy - radius} V ${cx} ${cy + radius}" stroke="${colour}" stroke-opacity=".25" stroke-width="2"/>
    ${points.map(([dx, dy], index) => `${dot(cx + dx * radius, cy + dy * radius, index === 2 ? C.gold : colour, index === 2 ? 8 : 5)}<circle cx="${cx + dx * radius}" cy="${cy + dy * radius}" r="${index === 2 ? 20 : 12}" fill="none" stroke="${index === 2 ? C.gold : colour}" stroke-opacity=".5"/>`).join("")}
    ${reticle(cx, cy, radius * .18, colour, .9)}
  </g>`;
}

function shield(cx, cy, size, colour = C.green) {
  const half = size / 2;
  return `<path d="M ${cx} ${cy - half} L ${cx + half * .78} ${cy - half * .66} V ${cy - half * .02} C ${cx + half * .78} ${cy + half * .52}, ${cx + half * .35} ${cy + half * .88}, ${cx} ${cy + half} C ${cx - half * .35} ${cy + half * .88}, ${cx - half * .78} ${cy + half * .52}, ${cx - half * .78} ${cy - half * .02} V ${cy - half * .66} Z" fill="${colour}" fill-opacity=".08" stroke="${colour}" stroke-width="5" filter="url(#softGlow)"/>`;
}

function orb(cx, cy, radius, value, colour = C.green, caption = "SETUP GRADE") {
  return `<g filter="url(#deepShadow)">
    <circle cx="${cx}" cy="${cy}" r="${radius + 26}" fill="#03090c" stroke="#294651" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#orbFill)" stroke="${colour}" stroke-width="8" stroke-dasharray="${Math.round(radius * 4.5)} ${Math.round(radius * 1.8)}" transform="rotate(-92 ${cx} ${cy})" filter="url(#softGlow)"/>
    <circle cx="${cx}" cy="${cy}" r="${radius * .68}" fill="#061016" stroke="#35525b" stroke-width="2"/>
    ${label(value, cx, cy + 24, radius * .62, { anchor: "middle", fill: colour, weight: 850, max: 20 })}
    ${mono(caption, cx, cy + radius * .5, 15, { anchor: "middle", fill: C.muted, max: 40, tracking: 1.4 })}
  </g>`;
}

const metric = (title, value, x, y, width, colour = C.green, note = "") => `${panel(x, y, width, 185, { radius: 24, fill: "#08171b", stroke: `${colour}88` })}${mono(title, x + 28, y + 42, 15, { fill: colour, max: 50 })}${label(value, x + 28, y + 112, 44, { fill: C.text, weight: 850, max: 30 })}${note ? mono(note, x + 28, y + 154, 13, { fill: C.dim, max: 50, tracking: 1 }) : ""}`;

function chrome({ number, eyebrow, title, subtitle, accent = C.green, body }) {
  const starPoints = [[87,610],[1160,550],[1040,176],[970,2435],[163,2420],[1115,1360],[95,1480],[1074,970],[310,560],[816,102]];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <defs>
      <linearGradient id="background" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#020609"/><stop offset=".48" stop-color="#061319"/><stop offset="1" stop-color="#020709"/></linearGradient>
      <radialGradient id="heroGlow" cx="78%" cy="12%" r="76%"><stop stop-color="${accent}" stop-opacity=".25"/><stop offset=".42" stop-color="#0b2225" stop-opacity=".25"/><stop offset="1" stop-color="#020609" stop-opacity="0"/></radialGradient>
      <linearGradient id="panelFill" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#10252b"/><stop offset=".46" stop-color="#071318"/><stop offset="1" stop-color="#050c10"/></linearGradient>
      <linearGradient id="chartPanel" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#07131d"/><stop offset="1" stop-color="#050a12"/></linearGradient>
      <linearGradient id="beamVertical" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${accent}" stop-opacity="0"/><stop offset=".5" stop-color="${accent}" stop-opacity=".52"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
      <linearGradient id="beamHorizontal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${accent}" stop-opacity="0"/><stop offset=".5" stop-color="${accent}" stop-opacity=".48"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></linearGradient>
      <radialGradient id="orbFill"><stop stop-color="${accent}" stop-opacity=".3"/><stop offset=".52" stop-color="#061319"/><stop offset="1" stop-color="#020608"/></radialGradient>
      <filter id="deepShadow" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="0" dy="34" stdDeviation="32" flood-color="#000" flood-opacity=".8"/></filter>
      <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="beamGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#background)"/>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#heroGlow)"/>
    <path d="M 780 -80 L 1280 160 L 1280 970 L 438 560 Z" fill="${accent}" fill-opacity=".045"/>
    <g opacity=".14">${Array.from({ length: 11 }, (_, i) => `<path d="M ${-260 + i * 170} 0 L ${740 + i * 170} 2688" stroke="#6e9ca0" stroke-width="1"/>`).join("")}</g>
    <g opacity=".3">${starPoints.map(([x, y], index) => dot(x, y, index % 3 === 0 ? accent : C.cyan, index % 4 === 0 ? 4 : 2)).join("")}</g>
    <g opacity=".3">${reticle(1100, 355, 210, accent, .3)}</g>
    ${reticle(82, 88, 24, accent, .95)}
    ${mono("POCKET BULLSEYE", 124, 99, 22, { fill: C.text, max: 60, tracking: 2.2 })}
    ${mono(`SCAN STORY 0${number} / 07`, 1168, 99, 16, { fill: C.muted, anchor: "end", max: 60, tracking: 1.4 })}
    <line x1="72" y1="137" x2="1170" y2="137" stroke="#36515a" stroke-width="2"/><line x1="72" y1="137" x2="${260 + number * 112}" y2="137" stroke="${accent}" stroke-width="5" filter="url(#softGlow)"/>
    ${pill(eyebrow.toUpperCase(), 72, 178, Math.min(690, eyebrow.length * 15 + 88), { colour: accent, height: 62, size: 17, fill: "#061310" })}
    ${label(title, 72, 335, 76, { max: 24, lineHeight: 80, weight: 850, tracking: -2 })}
    ${label(subtitle, 74, 528, 30, { fill: "#bdcccd", weight: 500, max: 62, lineHeight: 39 })}
    ${body}
    ${mono("EDUCATIONAL DECISION SUPPORT · SCANS UPLOADED SCREENSHOTS · NO ORDER CONNECTION", WIDTH / 2, 2637, 15, { fill: C.dim, anchor: "middle", max: 100, tracking: 1.2 })}
  </svg>`;
}

function scannerDeck() {
  const x = 58;
  const y = 690;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 28, y + 34, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#173039", opacity: .7 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.green, strokeWidth: 3 })}
    <path d="M ${x + 2} ${y + 170} H ${x + 1124}" stroke="#294751" stroke-width="2"/>
    ${mono("BULLSEYE PATTERN X-RAY", x + 52, y + 70, 18, { fill: C.green, max: 60 })}
    ${mono("UPLOADED SCREENSHOT", x + 1074, y + 70, 17, { fill: C.muted, anchor: "end", max: 60 })}
    ${pill("SCAN COMPLETE", x + 770, y + 105, 300, { colour: C.green, height: 52, size: 15 })}
    ${chart(x + 52, y + 210, 1022, 850, { scan: true, beamPosition: .66, labelTop: "CHART X-RAY · SIMULATED EXAMPLE" })}
    ${targetTag("VISIBLE STRUCTURE", x + 90, y + 296, C.green)}
    ${targetTag("BOTH SIDES", x + 760, y + 830, C.gold)}
    ${targetTag("PATTERN CHECK", x + 100, y + 928, C.cyan)}
    ${panel(x + 52, y + 1100, 1022, 430, { radius: 32, fill: "#071419", stroke: "#355762" })}
    ${mono("ONE ANALYSIS · FOUR DECISION LAYERS", x + 90, y + 1162, 17, { fill: C.muted, max: 70 })}
    ${["STRUCTURE", "BOTH SIDES", "PATTERNS", "RISK"].map((copy, index) => {
      const bx = x + 92 + (index % 2) * 490;
      const by = y + 1200 + Math.floor(index / 2) * 142;
      const colour = [C.cyan, C.green, C.gold, C.orange][index];
      return `${panel(bx, by, 445, 112, { radius: 24, fill: "#061014", stroke: `${colour}88` })}${reticle(bx + 52, by + 56, 22, colour, .95)}${mono(copy, bx + 94, by + 48, 17, { fill: colour, max: 40 })}${mono("EVIDENCE CHECK", bx + 94, by + 78, 13, { fill: C.dim, max: 50, tracking: 1 })}`;
    }).join("")}
    ${panel(x + 52, y + 1570, 1022, 150, { radius: 30, fill: "#113827", stroke: C.green, strokeWidth: 3 })}
    ${label("CHALLENGE THE SETUP", x + 563, y + 1658, 34, { anchor: "middle", weight: 850, max: 50 })}
    ${mono("STATIC SCREENSHOT · NO BROKER CONNECTION", x + 563, y + 1702, 14, { fill: C.green, anchor: "middle", max: 70 })}
  </g>`;
}

function levelsDeck() {
  const x = 58;
  const y = 690;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 24, y + 34, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#19323a", opacity: .75 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.cyan, strokeWidth: 3 })}
    ${mono("INDEPENDENT LEVEL LAB", x + 52, y + 68, 18, { fill: C.cyan, max: 70 })}
    ${pill("SUPPORT + RESISTANCE ONLY", x + 690, y + 35, 384, { colour: C.green, height: 54, size: 13 })}
    ${chart(x + 52, y + 128, 1022, 1070, { levels: true, scan: true, colour: C.cyan, beamPosition: .43, labelTop: "TWO-SIDED PRICE MAP · SIMULATED EXAMPLE" })}
    ${targetTag("PRICE SCALE CALIBRATED", x + 98, y + 250, C.cyan)}
    ${panel(x + 52, y + 1245, 1022, 170, { radius: 28, fill: "#061418", stroke: "#3d5d66" })}
    ${mono("ACTIVE DECISION RANGE", x + 86, y + 1300, 15, { fill: C.gold, max: 60 })}
    ${label("7,700  →  7,760", x + 86, y + 1375, 42, { weight: 850, max: 50 })}
    ${mono("CURRENT PRICE 7,728 · EXAMPLE", x + 1028, y + 1368, 14, { fill: C.dim, anchor: "end", max: 70 })}
    ${metric("SUPPORT BELOW", "7,700", x + 52, y + 1460, 314, C.green, "VISIBLE + CALIBRATED")}
    ${metric("CURRENT PRICE", "7,728", x + 405, y + 1460, 314, C.cyan, "READ FROM SCALE")}
    ${metric("RESISTANCE ABOVE", "7,760", x + 758, y + 1460, 316, C.red, "VISIBLE + CALIBRATED")}
    ${pill("RESCAN LEVELS ONLY", x + 52, y + 1685, 420, { colour: C.cyan, height: 68, size: 16, fill: "#08252a" })}
    ${mono("EXACT LEVELS APPEAR ONLY WHEN SCALE + EVIDENCE VERIFY", x + 1040, y + 1727, 13, { fill: C.muted, anchor: "end", max: 90 })}
  </g>`;
}

function liquidityDeck() {
  const x = 58;
  const y = 690;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 26, y + 36, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#382a14", opacity: .8 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.gold, strokeWidth: 3 })}
    ${mono("LIQUIDITY GUARD · CALIBRATED", x + 52, y + 68, 18, { fill: C.gold, max: 70 })}
    ${pill("2 SCALE-CHECKED AREAS", x + 668, y + 35, 406, { colour: C.gold, height: 54, size: 13, fill: "#251b08" })}
    ${chart(x + 52, y + 128, 1022, 1030, { zones: true, scan: true, colour: C.gold, beamPosition: .76, labelTop: "VISUAL STOP-RISK MAP · SIMULATED EXAMPLE" })}
    ${radar(x + 862, y + 468, 170, C.gold)}
    ${targetTag("POTENTIAL SWEEP RISK", x + 98, y + 284, C.gold)}
    ${metric("ABOVE PRICE", "EQUAL HIGHS", x + 52, y + 1208, 490, C.gold, "VISIBLE REACTIONS")}
    ${metric("BELOW PRICE", "SWING LOWS", x + 584, y + 1208, 490, C.green, "VISIBLE REACTIONS")}
    ${panel(x + 52, y + 1440, 1022, 240, { radius: 30, fill: "#171408", stroke: "#7c6124" })}
    ${shield(x + 155, y + 1560, 120, C.gold)}
    ${mono("WHAT THIS MEANS", x + 250, y + 1514, 16, { fill: C.gold, max: 50 })}
    ${label(["A visible cluster may mark sweep risk—not resting", "orders, a guaranteed reversal or a trade signal."], x + 250, y + 1575, 26, { fill: C.text, weight: 650, lineHeight: 38, max: 70 })}
    ${pill("VIEW TOUCH EVIDENCE", x + 52, y + 1720, 420, { colour: C.gold, height: 70, size: 17, fill: "#251b08" })}
    ${mono("SCALE-CHECKED AREAS ONLY", x + 1040, y + 1762, 14, { fill: C.dim, anchor: "end", max: 80 })}
  </g>`;
}

function timeframesDeck() {
  const x = 58;
  const y = 690;
  const states = [
    { copy: "30M", status: "+ ADD CHART", colour: C.green, empty: true },
    { copy: "1H", status: "CHART READ", colour: C.cyan, empty: false },
    { copy: "4H", status: "VIEWING", colour: C.orange, empty: false },
  ];
  return `<g filter="url(#deepShadow)">
    ${panel(x + 26, y + 36, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#1c383e", opacity: .8 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.orange, strokeWidth: 3 })}
    ${mono("PATTERN WATCH · SUPPLIED CHARTS", x + 52, y + 68, 18, { fill: C.orange, max: 70 })}
    ${mono("TAP A TIMEFRAME TO SWITCH", x + 1074, y + 68, 15, { fill: C.muted, anchor: "end", max: 70 })}
    ${states.map((state, index) => {
      const bx = x + 52 + index * 350;
      const active = index === 2;
      return `${panel(bx, y + 118, 320, 250, { radius: 28, fill: active ? "#25170a" : "#071318", stroke: state.colour, strokeWidth: active ? 4 : 2 })}${mono(state.copy, bx + 26, y + 162, 20, { fill: state.colour, max: 20 })}${chart(bx + 22, y + 184, 276, 145, { mini: true, colour: state.colour, empty: state.empty })}${active ? pill(state.status, bx + 170, y + 130, 126, { colour: state.colour, height: 42, size: 12, fill: "#2b190a" }) : mono(state.status, bx + 292, y + 160, 12, { fill: state.empty ? state.colour : C.dim, anchor: "end", max: 30 })}`;
    }).join("")}
    <path d="M ${x + 210} ${y + 410} C ${x + 360} ${y + 510}, ${x + 760} ${y + 510}, ${x + 914} ${y + 410}" fill="none" stroke="${C.orange}" stroke-width="4" stroke-dasharray="12 12" opacity=".6"/>
    ${reticle(x + 914, y + 420, 52, C.orange, .85)}
    ${panel(x + 52, y + 478, 1022, 800, { radius: 34, fill: "#07151a", stroke: "#3b5963" })}
    ${mono("4H · MEDIUM CONFIDENCE", x + 94, y + 542, 16, { fill: C.muted, max: 60 })}
    ${pill("FORMING", x + 790, y + 508, 230, { colour: C.gold, height: 58, size: 15, fill: "#251d08" })}
    ${label("BREAKOUT & RETEST", x + 94, y + 635, 47, { weight: 850, max: 45 })}
    ${chart(x + 94, y + 690, 936, 320, { mini: true, scan: true, colour: C.orange, beamPosition: .63 })}
    ${mono("CONFIRMS IF", x + 94, y + 1070, 16, { fill: C.green, max: 40 })}
    ${label("A clean 4H close below support after a failed reclaim.", x + 94, y + 1128, 27, { max: 68, weight: 650 })}
    ${panel(x + 52, y + 1328, 1022, 265, { radius: 30, fill: "#071217", stroke: "#34505a" })}
    ${mono("PATTERN GALLERY", x + 90, y + 1384, 16, { fill: C.cyan, max: 50 })}
    ${pill("HEAD & SHOULDERS", x + 90, y + 1424, 360, { colour: C.green, height: 58, size: 14 })}
    ${pill("RISING WEDGE", x + 474, y + 1424, 286, { colour: C.cyan, height: 58, size: 14, fill: "#07191d" })}
    ${pill("BULL FLAG", x + 784, y + 1424, 246, { colour: C.orange, height: 58, size: 14, fill: "#211509" })}
    ${mono("A SHAPE IS NOT A SIGNAL · WAIT FOR BOUNDARY CONFIRMATION", x + 90, y + 1555, 13, { fill: C.dim, max: 100 })}
    ${pill("SWITCH STRUCTURE VIEW", x + 52, y + 1640, 1022, { colour: C.orange, height: 92, size: 22, fill: "#26170a" })}
  </g>`;
}

function riskDeck() {
  const x = 58;
  const y = 690;
  const cx = x + 563;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 26, y + 36, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#1d343a", opacity: .82 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.green, strokeWidth: 3 })}
    ${mono("PERSONAL RISK DESK · PRIVATE", x + 52, y + 68, 18, { fill: C.green, max: 70 })}
    ${mono("SAVED ON THIS DEVICE · NO ORDER CONNECTION", x + 1074, y + 68, 14, { fill: C.dim, anchor: "end", max: 80 })}
    ${shield(cx, y + 535, 570, C.green)}
    ${reticle(cx, y + 535, 250, C.cyan, .24)}
    ${mono("MAX CASH RISK", cx, y + 405, 17, { fill: C.muted, anchor: "middle", max: 50 })}
    ${label("£50.00", cx, y + 545, 88, { fill: C.green, anchor: "middle", weight: 850, max: 20 })}
    ${mono("0.5% PERSONAL CEILING", cx, y + 610, 15, { fill: C.green, anchor: "middle", max: 60 })}
    ${pill("ROUND DOWN · NEVER UP", cx - 210, y + 660, 420, { colour: C.green, height: 58, size: 14 })}
    ${metric("ACCOUNT VALUE", "£10,000", x + 52, y + 895, 314, C.cyan, "YOUR INPUT")}
    ${metric("STOP DISTANCE", "12 PTS", x + 405, y + 895, 314, C.gold, "YOUR INPUT")}
    ${metric("VALUE / POINT", "£1.00", x + 758, y + 895, 316, C.orange, "CHECK BROKER")}
    ${panel(x + 52, y + 1130, 1022, 410, { radius: 34, fill: "#08171b", stroke: "#3b5d66" })}
    ${mono("ILLUSTRATIVE MAX UNITS", x + 90, y + 1195, 17, { fill: C.muted, max: 60 })}
    ${label("4", x + 90, y + 1410, 190, { fill: C.green, weight: 850, max: 10 })}
    ${panel(x + 430, y + 1190, 598, 285, { radius: 28, fill: "#0d2b20", stroke: C.green })}
    ${mono("RISK PER UNIT", x + 470, y + 1250, 15, { fill: C.green, max: 50 })}
    ${label("£12.00", x + 470, y + 1330, 48, { weight: 850, max: 30 })}
    ${label("Four units = £48 illustrative risk, beneath the £50 ceiling.", x + 470, y + 1390, 24, { fill: "#c9d5d1", weight: 600, max: 40, lineHeight: 32 })}
    ${pill("SAVE ON THIS DEVICE", x + 52, y + 1640, 1022, { colour: C.green, height: 92, size: 20, fill: "#103426" })}
  </g>`;
}

function scenariosDeck() {
  const x = 58;
  const y = 690;
  const cx = x + 563;
  const cy = y + 700;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 26, y + 36, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#1d3038", opacity: .82 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.cyan, strokeWidth: 3 })}
    ${mono("IF / THEN DECISION PATHS", x + 52, y + 68, 18, { fill: C.cyan, max: 70 })}
    ${pill("WAIT", x + 862, y + 35, 212, { colour: C.gold, height: 54, size: 17, fill: "#251d08" })}
    <path d="M ${cx - 168} ${cy - 20} C ${cx - 330} ${cy - 220}, ${x + 300} ${y + 320}, ${x + 188} ${y + 308} M ${cx + 168} ${cy - 20} C ${cx + 330} ${cy - 220}, ${x + 826} ${y + 320}, ${x + 938} ${y + 308} M ${cx} ${cy + 168} V ${y + 1160}" fill="none" stroke="#35515a" stroke-width="4" stroke-dasharray="12 13"/>
    ${panel(x + 52, y + 126, 426, 270, { radius: 28, fill: "#0d2a1d", stroke: C.green })}
    ${mono("BULL CASE", x + 86, y + 180, 16, { fill: C.green, max: 40 })}
    ${label("Reclaim resistance and hold on a closing basis.", x + 86, y + 244, 27, { max: 34, lineHeight: 35, weight: 650 })}
    ${panel(x + 648, y + 126, 426, 270, { radius: 28, fill: "#31171b", stroke: C.red })}
    ${mono("BEAR CASE", x + 682, y + 180, 16, { fill: C.red, max: 40 })}
    ${label("Lose support and fail the first reclaim attempt.", x + 682, y + 244, 27, { max: 34, lineHeight: 35, weight: 650 })}
    ${orb(cx, cy, 190, "B", C.gold, "GRADE · 68/100")}
    ${reticle(cx, cy, 270, C.cyan, .26)}
    ${panel(x + 216, y + 1040, 694, 245, { radius: 30, fill: "#211b08", stroke: C.gold })}
    ${mono("PATIENCE CASE", cx, y + 1100, 16, { fill: C.gold, anchor: "middle", max: 50 })}
    ${label(["Wait for the retest", "to prove itself."], cx, y + 1172, 33, { anchor: "middle", lineHeight: 39, weight: 800, max: 50 })}
    ${panel(x + 52, y + 1350, 1022, 245, { radius: 30, fill: "#07171a", stroke: "#35545e" })}
    ${mono("ASK BULLSEYE", x + 90, y + 1406, 16, { fill: C.cyan, max: 50 })}
    ${label("“What invalidates this setup?”", x + 90, y + 1476, 30, { fill: C.text, weight: 750, max: 60 })}
    ${pill("ANSWER FROM COMPLETED AUDIT EVIDENCE", x + 90, y + 1516, 560, { colour: C.cyan, height: 54, size: 12, fill: "#071b1d" })}
    ${pill("COMPARE ALL THREE PATHS", x + 52, y + 1640, 1022, { colour: C.cyan, height: 92, size: 20, fill: "#09252a" })}
    ${mono("CONDITIONAL PATHS · NOT A PREDICTION", cx, y + 1772, 13, { fill: C.dim, anchor: "middle", max: 80 })}
  </g>`;
}

function precisionDeck() {
  const x = 58;
  const y = 690;
  return `<g filter="url(#deepShadow)">
    ${panel(x + 26, y + 36, 1126, 1815, { radius: 54, fill: "#020609", stroke: "#382b13", opacity: .82 })}
    ${panel(x, y, 1126, 1815, { radius: 54, fill: "url(#panelFill)", stroke: C.gold, strokeWidth: 3 })}
    ${mono("BULLSEYE TRUST GATE · PARTIAL EVIDENCE", x + 52, y + 68, 17, { fill: C.gold, max: 80 })}
    ${pill("PRECISION HOLD", x + 760, y + 35, 314, { colour: C.gold, height: 54, size: 15, fill: "#251d08" })}
    ${chart(x + 52, y + 128, 1022, 560, { scan: true, colour: C.gold, beamPosition: .51, labelTop: "RESULT ACCURACY CHECK · SCALE INCOMPLETE" })}
    ${shield(x + 563, y + 408, 250, C.gold)}
    ${mono("LEVELS WITHHELD", x + 563, y + 425, 17, { fill: C.gold, anchor: "middle", max: 50 })}
    ${targetTag("SCALE NOT CLEAR", x + 92, y + 230, C.red)}
    ${panel(x + 52, y + 738, 1022, 300, { radius: 32, fill: "#211b08", stroke: C.gold })}
    ${mono("PRECISION HOLD", x + 94, y + 800, 16, { fill: C.gold, max: 50 })}
    ${label("Exact levels need a clearer price scale.", x + 94, y + 880, 38, { weight: 850, max: 48 })}
    ${label("Missing evidence is never replaced with an invented price.", x + 94, y + 965, 25, { fill: "#cbd3cf", weight: 600, max: 68 })}
    ${panel(x + 52, y + 1090, 490, 400, { radius: 30, fill: "#0b271c", stroke: C.green })}
    ${mono("VERIFIED · 3", x + 90, y + 1150, 16, { fill: C.green, max: 40 })}
    ${label(["✓  Instrument + timeframe", "✓  Candles + structure", "✓  Conditional evidence"], x + 90, y + 1235, 25, { lineHeight: 70, weight: 700, max: 40 })}
    ${panel(x + 584, y + 1090, 490, 400, { radius: 30, fill: "#2b1519", stroke: C.red })}
    ${mono("WITHHELD · 3", x + 622, y + 1150, 16, { fill: C.red, max: 40 })}
    ${label(["—  Unsupported levels", "—  Liquidity overlays", "—  Certainty language"], x + 622, y + 1235, 25, { lineHeight: 70, weight: 700, max: 40 })}
    ${panel(x + 52, y + 1540, 1022, 190, { radius: 32, fill: "#103426", stroke: C.green, strokeWidth: 3 })}
    ${label("ADD A CLEARER CHART TO RETRY", x + 563, y + 1635, 30, { anchor: "middle", weight: 850, max: 50 })}
    ${mono("EVIDENCE FIRST · ALWAYS", x + 563, y + 1684, 14, { fill: C.green, anchor: "middle", max: 50 })}
  </g>`;
}

const assets = [
  {
    file: "01-chart-second-opinion.png",
    accent: C.green,
    eyebrow: "One complete analysis free",
    title: ["SCAN THE CHART.", "CHALLENGE THE SETUP."],
    subtitle: "One uploaded screenshot. Visible structure, both sides and risk—challenged before you decide.",
    body: scannerDeck(),
  },
  {
    file: "02-support-resistance.png",
    accent: C.cyan,
    eyebrow: "Level Lab",
    title: ["RESCAN SUPPORT", "+ RESISTANCE"],
    subtitle: "Independent Level Lab checks a clearer price-scale photo without changing patterns or scenarios.",
    body: levelsDeck(),
  },
  {
    file: "03-liquidity-guard.png",
    accent: C.gold,
    eyebrow: "Liquidity Guard",
    title: ["SPOT VISIBLE", "STOP-RISK CLUSTERS"],
    subtitle: "Map scale-checked areas formed by visible candle reactions—not resting orders or guaranteed reversals.",
    body: liquidityDeck(),
  },
  {
    file: "04-pattern-timeframes.png",
    accent: C.orange,
    eyebrow: "Pattern Watch",
    title: ["SWITCH THE", "STRUCTURE VIEW"],
    subtitle: "Review supplied 30M, 1H or 4H chart reads. Add a missing chart instead of forcing a label.",
    body: timeframesDeck(),
  },
  {
    file: "05-personal-risk-desk.png",
    accent: C.green,
    eyebrow: "Personal Risk Desk",
    title: ["SET THE CASH", "LIMIT FIRST"],
    subtitle: "Enter your own limits and broker contract details. See illustrative units—with no order connection.",
    body: riskDeck(),
  },
  {
    file: "06-conditional-scenarios.png",
    accent: C.cyan,
    eyebrow: "Scenario Theatre + Ask Bullseye",
    title: ["BULL. WAIT. BEAR.", "COMPARE THE PATHS."],
    subtitle: "See what activates each conditional read, what weakens it, and why waiting can be the answer.",
    body: scenariosDeck(),
  },
  {
    file: "07-evidence-first.png",
    accent: C.gold,
    eyebrow: "Bullseye Trust Gate",
    title: ["NO EVIDENCE.", "NO MADE-UP LEVELS."],
    subtitle: "When a price scale cannot be verified, unsupported prices stay withheld and confidence comes down.",
    body: precisionDeck(),
  },
];

for (const [index, asset] of assets.entries()) {
  const svg = chrome({ ...asset, number: index + 1 });
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(resolve(output, asset.file));
  console.log(`${asset.file} · ${WIDTH}x${HEIGHT}`);
}

const thumbWidth = 300;
const thumbHeight = Math.round(thumbWidth * HEIGHT / WIDTH);
const gap = 24;
const sheetWidth = gap + (thumbWidth + gap) * 4;
const sheetHeight = 136 + gap + (thumbHeight + gap) * 2;
const contactBase = sharp({
  create: { width: sheetWidth, height: sheetHeight, channels: 4, background: "#03080b" },
});
const contactLayers = [];
for (const [index, asset] of assets.entries()) {
  const input = await sharp(resolve(output, asset.file)).resize({ width: thumbWidth }).png().toBuffer();
  contactLayers.push({
    input,
    left: gap + (index % 4) * (thumbWidth + gap),
    top: 136 + Math.floor(index / 4) * (thumbHeight + gap),
  });
}
const contactHeader = Buffer.from(`<svg width="${sheetWidth}" height="136" xmlns="http://www.w3.org/2000/svg"><rect width="${sheetWidth}" height="136" fill="#03080b"/><text x="24" y="54" fill="${C.green}" font-family="Menlo,monospace" font-size="17" font-weight="700" letter-spacing="2">POCKET BULLSEYE · v1.2</text><text x="24" y="101" fill="${C.text}" font-family="Arial,sans-serif" font-size="30" font-weight="800">App Store scanner story · 7-screen set</text></svg>`);
await contactBase
  .composite([{ input: contactHeader, left: 0, top: 0 }, ...contactLayers])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(contactSheetPath);
console.log(`pocket-v1.2-contact-sheet.png · ${sheetWidth}x${sheetHeight}`);
