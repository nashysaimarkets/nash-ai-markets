/** Extract an explicitly reported value; this does not independently verify
 * pixels or certify that an indicator exists in the source screenshot. */
export function readVisibleRsi(text: unknown): number | null {
  if (typeof text !== "string" || !text.trim() || text.length > 2048) return null;
  // Unqualified numbers after RSI can be the period (RSI14) or a threshold.
  // Require an explicit reading separator instead of promoting either to data.
  if ([...text.matchAll(/\bRSI\b/gi)].length !== 1) return null;
  const match = /\bRSI(?:\s*\(\s*[1-9]\d{0,2}\s*\))?\s*(?::|=|\bis(?:\s+at)?\b|\breads?\b|\bat\b)\s*([+\-−]?(?:\d+(?:\.\d+)?|\.\d+))/i.exec(text);
  if (!match) return null;
  const clauseStart = Math.max(text.lastIndexOf(";", match.index), text.lastIndexOf("\n", match.index)) + 1;
  const clauseEnd = text.slice(match.index).search(/[;\n]/);
  const clause = text.slice(clauseStart, clauseEnd < 0 ? text.length : match.index + clauseEnd);
  if (/\b(?:no|not|without|unreadable|unavailable|hidden|missing|unclear|unverified|estimate[ds]?|estimated|approximately|approx|around|about|near|if|could|would|may|might|assum\w*|threshold|period|previous(?:ly)?|prior|yesterday|historical|earlier|former(?:ly)?|ago|last)\b/i.test(clause)) return null;
  if (/\b(?:or|versus|vs)\b|\b(?:or|and)\s*[+\-−]?(?:\d|\.\d)/i.test(clause)) return null;
  const suffix = text.slice(match.index + match[0].length);
  if (/^(?:[\w%]|[.,][\dA-Za-z]|\s*(?:[-+±~≈–—/&]|to\b|,)\s*\d|\s*\+\s*\/\s*-)/i.test(suffix)) return null;
  const value = Number(match[1]);
  return !/^[\-−]/.test(match[1]) && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}
