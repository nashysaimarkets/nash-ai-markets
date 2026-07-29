import type { MarketQuote, MarketSnapshot } from "../../lib/market-data.ts";

const prettyDirection = (direction: MarketQuote["direction"] | undefined) => {
  if (direction === "up") return "higher";
  if (direction === "down") return "lower";
  if (direction === "flat") return "broadly unchanged";
  return "unavailable";
};

function quote(snapshot: MarketSnapshot, symbol: string) {
  return snapshot.quotes.find((item) => item.symbol === symbol);
}

/**
 * Deterministic plain-English cross-market reading from verified quotes only.
 * Educational and conditional — never a forecast or trade instruction.
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

  const parts: string[] = [];
  if (vix) {
    parts.push(vix.direction === "down"
      ? "VIX is lower, which supports risk appetite"
      : vix.direction === "up"
        ? "VIX is higher, which constrains risk appetite"
        : "VIX is broadly unchanged");
  }
  if (es) parts.push(`ES is ${prettyDirection(es.direction)}`);
  const treasuryDirections = [twoYear?.direction, tenYear?.direction].filter(Boolean);
  if (treasuryDirections.length) {
    const rising = treasuryDirections.filter((direction) => direction === "up").length;
    const falling = treasuryDirections.filter((direction) => direction === "down").length;
    if (rising && !falling) parts.push("Treasury yields are higher");
    else if (falling && !rising) parts.push("Treasury yields are lower");
    else parts.push("Treasury yields are broadly unchanged");
  }
  if (dollar) parts.push(`the US dollar is ${prettyDirection(dollar.direction)}`);

  const directions = [es?.direction, vix?.direction === "down" ? "up" : vix?.direction === "up" ? "down" : vix?.direction, dollar?.direction]
    .filter((direction): direction is MarketQuote["direction"] => Boolean(direction) && direction !== "flat");
  const up = directions.filter((direction) => direction === "up").length;
  const down = directions.filter((direction) => direction === "down").length;
  const stance = up > 0 && down > 0
    ? "Cross-market evidence is mixed rather than strongly directional."
    : up > down
      ? "Cross-market evidence leans supportive of risk appetite, subject to fresh confirmation."
      : down > up
        ? "Cross-market evidence leans restrictive for risk appetite, subject to fresh confirmation."
        : "Cross-market evidence is balanced with no strong directional lean.";

  return `${parts.join(", while ")}. ${stance}`;
}
