import type { MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";

function quote(snapshot: MarketSnapshot, symbol: string) {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

function joinClauses(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
}

/**
 * Deterministic editorial cross-market reading from verified quotes only.
 * Educational and conditional — never a forecast, news story or trade instruction.
 */
export function interpretCrossMarket(snapshot: MarketSnapshot): string {
  const es = quote(snapshot, "ES");
  const vix = quote(snapshot, "VIX");
  const twoYear = quote(snapshot, "US2Y");
  const tenYear = quote(snapshot, "US10Y");
  const dollar = quote(snapshot, "DXY");
  const available = [es, vix, twoYear, tenYear, dollar].filter(Boolean).length;
  if (available === 0) {
    return "Cross-market interpretation is unavailable until verified quotes arrive for ES, VIX, Treasuries or the US dollar.";
  }

  const leadParts = [
    es?.direction === "up"
      ? "ES is higher"
      : es?.direction === "down"
        ? "ES is lower"
        : es
          ? "ES is broadly unchanged"
          : null,
    vix?.direction === "down"
      ? "volatility is easing"
      : vix?.direction === "up"
        ? "volatility is rising"
        : vix
          ? "volatility is broadly unchanged"
          : null,
    dollar?.direction === "down"
      ? "the dollar is softer"
      : dollar?.direction === "up"
        ? "the dollar is firmer"
        : dollar
          ? "the dollar is broadly unchanged"
          : null,
  ].filter((item): item is string => Boolean(item));

  const treasuryDirections = [twoYear?.direction, tenYear?.direction].filter(
    (direction): direction is MarketQuote["direction"] => Boolean(direction),
  );
  let treasury: string | null = null;
  if (treasuryDirections.length) {
    const rising = treasuryDirections.filter((direction) => direction === "up").length;
    const falling = treasuryDirections.filter((direction) => direction === "down").length;
    if (rising && !falling) treasury = "Treasury yields are higher";
    else if (falling && !rising) treasury = "Treasury yields are lower";
    else treasury = "Treasury yields are broadly unchanged";
  }

  const riskSignals: Array<"supportive" | "restrictive"> = [];
  if (es?.direction === "up") riskSignals.push("supportive");
  if (es?.direction === "down") riskSignals.push("restrictive");
  if (vix?.direction === "down") riskSignals.push("supportive");
  if (vix?.direction === "up") riskSignals.push("restrictive");
  if (dollar?.direction === "down") riskSignals.push("supportive");
  if (dollar?.direction === "up") riskSignals.push("restrictive");

  const supportive = riskSignals.filter((item) => item === "supportive").length;
  const restrictive = riskSignals.filter((item) => item === "restrictive").length;
  const stance = supportive > 0 && restrictive > 0
    ? "The combination is mixed rather than strongly directional, and confirmation remains incomplete."
    : supportive > restrictive
      ? "The combination is mildly supportive of risk appetite, although confirmation remains incomplete."
      : restrictive > supportive
        ? "The combination leans restrictive for risk appetite, although confirmation remains incomplete."
        : "The combination is balanced, with no strong directional lean from the verified quotes.";

  const leadSentence = leadParts.length ? `${joinClauses(leadParts)}.` : "";
  const treasurySentence = treasury ? ` ${treasury}.` : "";
  return `${leadSentence}${treasurySentence} ${stance}`.replace(/\s+/g, " ").trim();
}
