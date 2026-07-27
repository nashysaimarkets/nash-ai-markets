export const DEFAULT_TTS_VOICE = "cedar";
export const TTS_MODEL = "gpt-4o-mini-tts";

export function narrationInstructions(): string {
  return [
    "Speak in a calm, authoritative British financial-news style.",
    "Use a measured pace and restrained emotion.",
    "Read figures clearly and pause briefly between sections.",
    "Do not add, infer, paraphrase, or omit any supplied words.",
  ].join(" ");
}

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildTitleCardSvg(title: string, label: string): string {
  const safeTitle = escapeXml(title.slice(0, 90));
  const safeLabel = escapeXml(label.slice(0, 60).toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <radialGradient id="bg" cx="74%" cy="18%" r="86%">
      <stop offset="0" stop-color="#12382a"/>
      <stop offset=".42" stop-color="#07140f"/>
      <stop offset="1" stop-color="#030706"/>
    </radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="14"/></filter>
  </defs>
  <rect width="1920" height="1080" fill="url(#bg)"/>
  <g opacity=".16" stroke="#55e69a" fill="none">
    <circle cx="1540" cy="300" r="210"/><circle cx="1540" cy="300" r="145"/><circle cx="1540" cy="300" r="78"/>
    <path d="M1270 300h540M1540 30v540"/>
  </g>
  <circle cx="1540" cy="300" r="14" fill="#55e69a" filter="url(#glow)"/>
  <text x="118" y="132" fill="#f1f0e9" font-family="Arial, sans-serif" font-size="31" font-weight="700" letter-spacing="7">NASH <tspan fill="#55e69a">AI</tspan> MARKETS</text>
  <text x="118" y="286" fill="#55e69a" font-family="monospace" font-size="24" font-weight="700" letter-spacing="5">${safeLabel}</text>
  <foreignObject x="112" y="330" width="1210" height="420">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#f1f0e9;font:600 90px/1.04 Arial,sans-serif;letter-spacing:-4px">${safeTitle}</div>
  </foreignObject>
  <line x1="118" y1="862" x2="1802" y2="862" stroke="#ffffff" stroke-opacity=".18"/>
  <text x="118" y="925" fill="#a1aca6" font-family="Arial, sans-serif" font-size="25">AI-generated narration · Educational market commentary only</text>
  <text x="118" y="974" fill="#718078" font-family="monospace" font-size="19">Verified inputs only · No executable trade instructions</text>
</svg>`;
}
