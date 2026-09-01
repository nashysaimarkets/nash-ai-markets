import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const WIDTH = 1242;
const HEIGHT = 2688;
const output = resolve("docs/app-store/v1.2-assets/screenshots");
mkdirSync(output, { recursive: true });

const colours = {
  bg: "#050b0e",
  panel: "#0a1419",
  panel2: "#0d1b20",
  edge: "#29414a",
  text: "#eef7f4",
  muted: "#82939a",
  green: "#62efa8",
  cyan: "#6be7e4",
  gold: "#e8c561",
  red: "#f16f79",
};

const xml = (value) => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
const lines = (copy, max = 30) => {
  const words = copy.split(/\s+/);
  const result = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) { result.push(line); line = word; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
};
const text = (copy, x, y, size, options = {}) => {
  const { fill = colours.text, weight = 700, max = 34, lineHeight = Math.round(size * 1.18), anchor = "start", family = "ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif", tracking = 0 } = options;
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${family}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${tracking}">${lines(copy, max).map((line, index) => `<tspan x="${x}" dy="${index ? lineHeight : 0}">${xml(line)}</tspan>`).join("")}</text>`;
};
const mono = (copy, x, y, size, options = {}) => text(copy, x, y, size, { family: "ui-monospace,SFMono-Regular,Menlo,monospace", tracking: 2, ...options });
const card = (x, y, width, height, options = {}) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${options.radius ?? 28}" fill="${options.fill ?? colours.panel}" stroke="${options.stroke ?? colours.edge}" stroke-width="${options.strokeWidth ?? 3}"/>`;
const pill = (copy, x, y, width, options = {}) => `${card(x, y, width, 76, { radius: 38, fill: options.fill ?? "#0b2020", stroke: options.stroke ?? colours.green, strokeWidth: 2 })}${mono(copy, x + width / 2, y + 49, 24, { fill: options.text ?? colours.green, anchor: "middle", max: 40 })}`;

function chart(x, y, width, height, { zones = false, levels = false } = {}) {
  const candles = [
    [0.02,.62,.49,.69,.43],[.07,.49,.41,.55,.37],[.12,.42,.48,.54,.36],[.17,.48,.57,.63,.44],[.22,.57,.52,.62,.47],
    [.27,.52,.39,.57,.33],[.32,.39,.32,.45,.27],[.37,.32,.38,.44,.29],[.42,.38,.46,.51,.35],[.47,.46,.42,.51,.37],
    [.52,.42,.55,.61,.39],[.57,.55,.65,.71,.50],[.62,.65,.59,.69,.53],[.67,.59,.47,.64,.42],[.72,.47,.39,.52,.34],
    [.77,.39,.44,.49,.35],[.82,.44,.35,.48,.29],[.87,.35,.28,.39,.23],[.92,.28,.34,.39,.25],[.97,.34,.30,.38,.26],
  ];
  const innerTop = y + 36;
  const innerHeight = height - 72;
  const candleWidth = Math.max(9, width / 48);
  let out = `${card(x, y, width, height, { radius: 22, fill: "#071115", stroke: "#29454e" })}`;
  for (let i = 1; i < 6; i += 1) out += `<line x1="${x}" y1="${y + (height / 6) * i}" x2="${x + width}" y2="${y + (height / 6) * i}" stroke="#173039" stroke-width="2"/>`;
  for (let i = 1; i < 8; i += 1) out += `<line x1="${x + (width / 8) * i}" y1="${y}" x2="${x + (width / 8) * i}" y2="${y + height}" stroke="#10272e" stroke-width="2"/>`;
  candles.forEach(([offset, open, close, high, low]) => {
    const cx = x + 18 + offset * (width - 36);
    const colour = close < open ? colours.green : colours.red;
    const py = (value) => innerTop + value * innerHeight;
    out += `<line x1="${cx}" y1="${py(high)}" x2="${cx}" y2="${py(low)}" stroke="${colour}" stroke-width="5"/>`;
    out += `<rect x="${cx - candleWidth / 2}" y="${Math.min(py(open), py(close))}" width="${candleWidth}" height="${Math.max(10, Math.abs(py(open) - py(close)))}" rx="3" fill="${colour}"/>`;
  });
  if (levels) {
    out += `<line x1="${x + 20}" y1="${y + height * .29}" x2="${x + width - 20}" y2="${y + height * .29}" stroke="${colours.red}" stroke-width="7"/><rect x="${x + width - 204}" y="${y + height * .29 - 34}" width="184" height="58" rx="12" fill="#4c1b22"/>${mono("R · 7,760", x + width - 112, y + height * .29 + 7, 21, { fill: "#ff9aa1", anchor: "middle" })}`;
    out += `<line x1="${x + 20}" y1="${y + height * .72}" x2="${x + width - 20}" y2="${y + height * .72}" stroke="${colours.green}" stroke-width="7"/><rect x="${x + width - 204}" y="${y + height * .72 - 34}" width="184" height="58" rx="12" fill="#123f2c"/>${mono("S · 7,700", x + width - 112, y + height * .72 + 7, 21, { fill: "#9affca", anchor: "middle" })}`;
  }
  if (zones) {
    out += `<rect x="${x + 18}" y="${y + height * .18}" width="${width - 36}" height="78" fill="#7a3c16" opacity=".55" stroke="${colours.gold}" stroke-width="4" stroke-dasharray="13 10"/>`;
    out += `<rect x="${x + 18}" y="${y + height * .77}" width="${width - 36}" height="72" fill="#145135" opacity=".55" stroke="${colours.green}" stroke-width="4" stroke-dasharray="13 10"/>`;
    out += mono("EQUAL HIGHS · VISIBLE LIQUIDITY", x + 42, y + height * .18 + 49, 19, { fill: colours.gold, max: 60 });
    out += mono("SWING CLUSTER BELOW PRICE", x + 42, y + height * .77 + 45, 19, { fill: colours.green, max: 60 });
  }
  return out;
}

function shell({ eyebrow, title, subtitle, body, number }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="0%" r="90%"><stop offset="0" stop-color="#16483a" stop-opacity=".62"/><stop offset=".55" stop-color="#071418" stop-opacity=".2"/><stop offset="1" stop-color="${colours.bg}" stop-opacity="0"/></radialGradient>
    <linearGradient id="fade" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0f2024"/><stop offset="1" stop-color="#071014"/></linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="24" stdDeviation="28" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${colours.bg}"/><rect width="${WIDTH}" height="${HEIGHT}" fill="url(#halo)"/>
  <g opacity=".18">${Array.from({ length: 16 }, (_, i) => `<line x1="0" y1="${i * 170}" x2="1242" y2="${i * 170}" stroke="#5c8b8c"/>`).join("")}${Array.from({ length: 8 }, (_, i) => `<line x1="${i * 178}" y1="0" x2="${i * 178}" y2="2688" stroke="#5c8b8c"/>`).join("")}</g>
  ${mono(`0${number} · POCKET BULLSEYE`, 72, 108, 25, { fill: colours.green, max: 60 })}
  ${mono(eyebrow.toUpperCase(), 72, 180, 22, { fill: colours.gold, max: 70 })}
  ${text(title, 72, 284, 66, { max: 28, lineHeight: 72 })}
  ${text(subtitle, 72, 447, 31, { fill: "#b8c7c7", weight: 500, max: 56, lineHeight: 42 })}
  <g filter="url(#shadow)">${body}</g>
  ${mono("EDUCATIONAL DECISION SUPPORT · VERIFY ON YOUR ORIGINAL CHART", WIDTH / 2, 2638, 18, { fill: "#72858b", anchor: "middle", max: 90 })}
  </svg>`;
}

const assets = [
  {
    file: "01-chart-second-opinion.png", eyebrow: "One complete analysis free", title: "Challenge the setup before you trade", subtitle: "Upload a clear chart screenshot. Bullseye checks structure, evidence and reasons to wait.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)", stroke: "#31535a" })}${mono("POCKET BULLSEYE · NEW CHART", 98, 684, 22, { fill: colours.green, max: 60 })}${chart(98, 770, 1046, 760)}${pill("CHART READY · PRIVATE", 98, 1575, 390)}${mono("WHAT ARE YOU CONSIDERING?", 98, 1748, 21, { fill: colours.muted, max: 60 })}${pill("LONG", 98, 1790, 270, { fill: "#10271e" })}${pill("JUST ANALYSE", 385, 1790, 330, { stroke: colours.cyan, text: colours.cyan })}${pill("SHORT", 732, 1790, 270, { stroke: colours.red, text: colours.red, fill: "#2c1519" })}${card(98, 1925, 1046, 170, { fill: "#0d1a1a", stroke: "#31574d" })}${mono("PRIVACY SHIELD", 140, 1993, 22, { fill: colours.green })}${text("Remove names, balances and notifications before upload.", 140, 2050, 27, { fill: "#c4d0ce", weight: 500, max: 55 })}${card(98, 2150, 1046, 190, { fill: "#133027", stroke: colours.green })}${text("CHALLENGE MY SETUP", 621, 2262, 40, { anchor: "middle", max: 50 })}${mono("READ STRUCTURE · TEST BIAS · MAP RISK", 621, 2310, 18, { fill: colours.green, anchor: "middle", max: 60 })}`,
  },
  {
    file: "02-support-resistance.png", eyebrow: "Evidence-mapped price structure", title: "Map verified support and resistance", subtitle: "Exact levels appear only when the price scale and chart evidence can be calibrated.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("DECISION MAP · US 500 · 4H", 98, 684, 22, { fill: colours.green, max: 60 })}${chart(98, 750, 1046, 1080, { levels: true })}${card(98, 1880, 1046, 210, { fill: "#0c1c1f" })}${mono("ACTIVE DECISION RANGE", 140, 1944, 19, { fill: colours.gold })}${text("7,700 support → 7,760 resistance", 140, 2015, 37, { max: 45 })}${text("Current price 7,728 · two-sided structure locked", 140, 2065, 25, { fill: colours.muted, weight: 500, max: 60 })}${card(98, 2140, 500, 250, { fill: "#10271e", stroke: colours.green })}${mono("SUPPORT BELOW", 140, 2205, 18, { fill: colours.green })}${text("7,700", 140, 2295, 62, { fill: colours.green })}${card(644, 2140, 500, 250, { fill: "#2b1519", stroke: colours.red })}${mono("RESISTANCE ABOVE", 686, 2205, 18, { fill: colours.red })}${text("7,760", 686, 2295, 62, { fill: colours.red })}`,
  },
  {
    file: "03-liquidity-guard.png", eyebrow: "Stop-cluster awareness", title: "See where liquidity may be clustered", subtitle: "Liquidity Guard marks only visible, calibrated risk zones and explains what makes each area relevant.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("LIQUIDITY GUARD · CALIBRATED", 98, 684, 22, { fill: colours.gold, max: 60 })}${chart(98, 750, 1046, 1120, { zones: true })}${card(98, 1925, 1046, 380, { fill: "#15170e", stroke: "#6a5922" })}${mono("VISIBLE RISK ZONES", 140, 1992, 20, { fill: colours.gold })}${text("Equal highs above price may attract a sweep before direction becomes clear.", 140, 2070, 32, { max: 53, lineHeight: 42 })}${mono("STOP GUIDANCE", 140, 2195, 18, { fill: colours.muted })}${text("Do not place a stop solely because a shaded band is visible. Confirm structure on the broker chart.", 140, 2260, 26, { fill: "#c5ceca", weight: 500, max: 64, lineHeight: 35 })}${pill("2 VERIFIED ZONES", 98, 2350, 390, { stroke: colours.gold, text: colours.gold, fill: "#292211" })}`,
  },
  {
    file: "04-pattern-timeframes.png", eyebrow: "Pattern Watch", title: "Switch between supplied timeframes", subtitle: "Compare 30-minute, 1-hour and 4-hour chart reads without forcing a pattern onto ordinary price noise.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("PATTERN WATCH · STRUCTURE CHECK", 98, 684, 22, { fill: colours.green, max: 60 })}${pill("30M · CHART READ", 98, 750, 318)}${pill("1H · CHART READ", 462, 750, 318, { stroke: colours.cyan, text: colours.cyan })}${pill("4H · VIEWING", 826, 750, 318, { fill: "#15382a" })}${card(98, 880, 1046, 650, { fill: "#0a171b", stroke: "#46626a" })}${mono("4H · MEDIUM CONFIDENCE", 140, 952, 19, { fill: colours.muted })}${text("BREAKOUT & RETEST", 140, 1032, 46, { max: 40 })}${pill("FORMING", 840, 965, 250, { stroke: colours.gold, text: colours.gold, fill: "#2c2410" })}${text("Price has broken below a short horizontal support area and is testing that level from underneath.", 140, 1130, 31, { fill: "#c5d0ce", weight: 500, max: 55, lineHeight: 42 })}${mono("CONFIRMS IF", 140, 1290, 18, { fill: colours.green })}${text("A clean 4H close below support after a failed reclaim.", 140, 1350, 28, { max: 58 })}${card(98, 1580, 1046, 620, { fill: "#0b1518" })}${mono("PATTERN GALLERY", 140, 1652, 20, { fill: colours.cyan })}${pill("HEAD & SHOULDERS", 140, 1725, 420)}${pill("RISING WEDGE", 590, 1725, 330, { stroke: "#50676d", text: "#b4c3c5" })}${pill("BULL FLAG", 140, 1840, 300, { stroke: "#50676d", text: "#b4c3c5" })}${pill("TRIANGLE", 470, 1840, 300, { stroke: "#50676d", text: "#b4c3c5" })}${text("A shape is not a signal by itself. Wait for the stated boundary confirmation.", 140, 2010, 28, { fill: colours.muted, weight: 500, max: 58, lineHeight: 38 })}`,
  },
  {
    file: "05-personal-risk-desk.png", eyebrow: "Private risk calculator", title: "Set a personal cash-risk ceiling", subtitle: "Use your own account value, risk limit and broker contract details. Pocket Bullseye never places an order.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("PERSONAL RISK DESK · PRIVATE", 98, 684, 22, { fill: colours.green, max: 60 })}${mono("ACCOUNT VALUE", 98, 795, 18, { fill: colours.muted })}${card(98, 825, 1046, 135)}${text("GBP", 140, 908, 32, { fill: colours.gold })}${text("10,000", 330, 908, 40, { fill: "#dfe9e5" })}${mono("MAX RISK PER IDEA", 98, 1030, 18, { fill: colours.muted })}${card(98, 1060, 1046, 135)}${text("0.5", 140, 1143, 40)}${text("%", 1080, 1143, 28, { fill: colours.muted, anchor: "end" })}${mono("STOP DISTANCE", 98, 1265, 18, { fill: colours.muted })}${card(98, 1295, 1046, 135)}${text("12", 140, 1378, 40)}${mono("PTS", 1080, 1370, 22, { fill: colours.muted, anchor: "end" })}${mono("VALUE PER POINT / UNIT", 98, 1500, 18, { fill: colours.muted })}${card(98, 1530, 1046, 135)}${text("1", 140, 1613, 40)}${mono("GBP", 1080, 1605, 22, { fill: colours.muted, anchor: "end" })}${card(98, 1740, 1046, 560, { fill: "#0c1a1c", stroke: "#36545b" })}${mono("MAX CASH RISK", 140, 1810, 18, { fill: colours.muted })}${text("£50.00", 140, 1900, 55, { fill: colours.green })}${mono("RISK PER UNIT", 140, 1990, 18, { fill: colours.muted })}${text("£12.00", 140, 2070, 44)}${card(650, 1790, 440, 380, { fill: "#123027", stroke: colours.green })}${mono("ILLUSTRATIVE MAX UNITS", 870, 1870, 17, { fill: colours.green, anchor: "middle", max: 60 })}${text("4", 870, 2020, 116, { fill: colours.green, anchor: "middle" })}${mono("ROUND DOWN · NEVER UP", 870, 2085, 16, { fill: colours.muted, anchor: "middle" })}`,
  },
  {
    file: "06-conditional-scenarios.png", eyebrow: "Bull · wait · bear", title: "Compare conditional market paths", subtitle: "Challenge directional bias with confirmation, failure and patience conditions before making your own decision.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("BULLSEYE PRE-TRADE DECISION AUDIT", 98, 684, 21, { fill: colours.green, max: 70 })}${card(98, 750, 1046, 360, { fill: "#0c181c", stroke: "#36515a" })}${mono("SETUP GRADE", 140, 820, 18, { fill: colours.muted })}${text("B", 140, 1010, 150, { fill: colours.gold })}${text("68/100", 400, 890, 48)}${pill("WAIT", 800, 815, 250, { stroke: colours.gold, text: colours.gold, fill: "#292211" })}${text("Wait for the retest to prove itself", 400, 990, 35, { max: 35, lineHeight: 44 })}${card(98, 1170, 1046, 330, { fill: "#10271e", stroke: colours.green })}${mono("🐂  BULL CASE", 140, 1240, 22, { fill: colours.green })}${text("Reclaim resistance and hold above it on a closing basis.", 140, 1325, 30, { max: 58, lineHeight: 40 })}${pill("ACTIVATES ON CONFIRMATION", 140, 1410, 500)}${card(98, 1550, 1046, 330, { fill: "#28220f", stroke: colours.gold })}${mono("🛡  PATIENCE", 140, 1620, 22, { fill: colours.gold })}${text("Stay neutral while price remains trapped inside the active range.", 140, 1705, 30, { max: 58, lineHeight: 40 })}${pill("NO CLEAN EDGE YET", 140, 1790, 420, { stroke: colours.gold, text: colours.gold, fill: "#292211" })}${card(98, 1930, 1046, 330, { fill: "#2b1519", stroke: colours.red })}${mono("🐻  BEAR CASE", 140, 2000, 22, { fill: colours.red })}${text("Lose support and fail the first reclaim attempt.", 140, 2085, 30, { max: 58, lineHeight: 40 })}${pill("INVALIDATES THE BULL PATH", 140, 2170, 500, { stroke: colours.red, text: colours.red, fill: "#2c1519" })}`,
  },
  {
    file: "07-evidence-first.png", eyebrow: "Precision before persuasion", title: "No guesses when evidence is incomplete", subtitle: "Weak or partial chart evidence reduces confidence. Unverified prices and levels remain visibly withheld.",
    body: `${card(58, 610, 1126, 1920, { fill: "url(#fade)" })}${mono("RESULT EVIDENCE STATUS · PARTIAL", 98, 684, 22, { fill: colours.gold, max: 70 })}${card(98, 760, 1046, 300, { fill: "#211d10", stroke: colours.gold })}${mono("PRECISION HOLD", 140, 835, 21, { fill: colours.gold })}${text("Exact levels need a clearer price scale", 140, 925, 39, { max: 48 })}${text("Bullseye will not replace missing evidence with an invented price.", 140, 1000, 26, { fill: "#c6cec9", weight: 500, max: 62 })}${card(98, 1120, 1046, 460, { fill: "#0c181c" })}${mono("WHAT IS VERIFIED", 140, 1190, 19, { fill: colours.green })}${text("✓ Instrument and timeframe confirmed", 140, 1270, 30, { max: 60 })}${text("✓ Candles and visible structure readable", 140, 1340, 30, { max: 60 })}${text("✓ Directional evidence reported conditionally", 140, 1410, 30, { max: 60 })}${card(98, 1630, 1046, 460, { fill: "#201317", stroke: "#65343b" })}${mono("WHAT IS WITHHELD", 140, 1700, 19, { fill: colours.red })}${text("— Unsupported horizontal levels", 140, 1780, 30, { max: 60 })}${text("— Uncalibrated liquidity overlays", 140, 1850, 30, { max: 60 })}${text("— Certainty language and guaranteed outcomes", 140, 1920, 30, { max: 60 })}${card(98, 2140, 1046, 200, { fill: "#123027", stroke: colours.green })}${text("ADD A CLEARER CHART TO RETRY", 621, 2248, 34, { anchor: "middle", max: 50 })}${mono("EVIDENCE FIRST · ALWAYS", 621, 2305, 18, { fill: colours.green, anchor: "middle" })}`,
  },
];

for (const [index, asset] of assets.entries()) {
  const svg = shell({ ...asset, number: index + 1 });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(resolve(output, asset.file));
  console.log(`${asset.file} · ${WIDTH}x${HEIGHT}`);
}
