import type { Founding100Record } from "../lib/server/founding-100.ts";

export function Founding100Badge({
  record,
  compact = false,
}: {
  record: Pick<Founding100Record, "programme" | "position" | "status" | "priceLockActive">;
  compact?: boolean;
}) {
  const active = record.status === "active" && record.priceLockActive;
  return <section className={`founding100Badge${compact ? " founding100BadgeCompact" : ""}`} aria-label={`Founding 100 ${record.programme.toUpperCase()} member ${record.position}`}>
    <span aria-hidden="true">100</span>
    <div><small>FOUNDING 100 {record.programme.toUpperCase()}</small><strong>Member #{record.position}</strong><p>{active ? "Founding price lock active while this subscription remains continuously active." : "Founding place retained in programme history · price lock forfeited."}</p></div>
  </section>;
}
