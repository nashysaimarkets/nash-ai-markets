export type VerificationKind = "support" | "resistance" | "pivot";

export type VerificationLevel = {
  kind: VerificationKind | "trend" | "zone" | "gap";
  label: string;
  price: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
};

export type VerificationDraft = {
  id: string;
  kind: VerificationKind;
  price: string;
  label: string;
  status: "review" | "confirmed" | "rejected";
  geometry?: Pick<VerificationLevel, "x" | "y" | "x2" | "y2">;
};

export function numericLevelPrice(value: string | undefined) {
  const source = value?.replace(/[−–—]/g, "-").replace(/[’'\s]/g, "") ?? "";
  const commaDecimal = /^-?\d+,\d{1,2}(?:\D|$)/.test(source) && !source.includes(".");
  const normalized = commaDecimal ? source.replace(",", ".") : source.replaceAll(",", "");
  const parsed = Number(normalized.match(/-?\d+(?:\.\d+)?/)?.[0]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function seedVerificationDrafts(levels: VerificationLevel[]): VerificationDraft[] {
  return levels.flatMap((level, index) => {
    if (numericLevelPrice(level.price) === null || !["support", "resistance", "pivot"].includes(level.kind)) return [];
    return [{
      id: `detected-${index}`,
      kind: level.kind as VerificationKind,
      price: level.price,
      label: level.label || "Detected level",
      status: "review" as const,
      geometry: { x: level.x, y: level.y, x2: level.x2, y2: level.y2 },
    }];
  });
}

function projectedY(price: number, anchors: { price: number; y: number }[]) {
  const clean = anchors
    .filter((anchor) => Number.isFinite(anchor.price) && Number.isFinite(anchor.y) && anchor.price > 0 && anchor.y >= 0 && anchor.y <= 100)
    .sort((a, b) => a.price - b.price);
  const low = clean[0];
  const high = clean.at(-1);
  if (!low || !high || low.price === high.price || low.y <= high.y) return null;
  return low.y + ((price - low.price) / (high.price - low.price)) * (high.y - low.y);
}

/** Convert trader-approved rows back into distinct, scale-calibrated chart lines. */
export function buildVerifiedLevels(
  drafts: VerificationDraft[],
  currentPrice: string | undefined,
  anchors: { price: number; y: number }[],
): VerificationLevel[] {
  const current = numericLevelPrice(currentPrice);
  const accepted = drafts.flatMap((draft) => {
    const price = numericLevelPrice(draft.price);
    if (draft.status === "rejected" || price === null) return [];

    let kind = draft.kind;
    if (kind !== "pivot" && current !== null) {
      if (price < current) kind = "support";
      else if (price > current) kind = "resistance";
    }

    const calibratedY = projectedY(price, anchors);
    const sourceY = Number.isFinite(draft.geometry?.y) ? draft.geometry!.y : null;
    const y = Math.max(2, Math.min(98, calibratedY ?? sourceY ?? 50));
    const isHorizontal = kind === "support" || kind === "resistance";
    return [{
      kind,
      label: draft.status === "confirmed" ? "USER VERIFIED" : draft.label,
      price: String(price),
      x: isHorizontal ? (draft.geometry?.x ?? 4) : (draft.geometry?.x ?? 50),
      y,
      x2: isHorizontal ? (draft.geometry?.x2 ?? 96) : (draft.geometry?.x2 ?? 50),
      y2: isHorizontal ? y : Math.max(2, Math.min(98, draft.geometry?.y2 ?? y)),
    } satisfies VerificationLevel];
  });

  return accepted.reduce<VerificationLevel[]>((unique, level) => {
    const price = numericLevelPrice(level.price)!;
    const tolerance = Math.max(price * 0.0005, 0.01);
    const duplicate = unique.findIndex((candidate) => {
      const candidatePrice = numericLevelPrice(candidate.price);
      return candidatePrice !== null && candidate.kind === level.kind && Math.abs(candidatePrice - price) <= tolerance;
    });
    if (duplicate < 0) return [...unique, level];
    if (/USER VERIFIED/i.test(level.label) && !/USER VERIFIED/i.test(unique[duplicate].label)) {
      return unique.map((candidate, index) => index === duplicate ? level : candidate);
    }
    return unique;
  }, []);
}
