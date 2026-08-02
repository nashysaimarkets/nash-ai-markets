import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { StatusIcon, type IconName } from "../../components/StatusIcon.tsx";
import type { CommandStripModel } from "../lib/command-strip.ts";

const CELL_ICON: Record<string, IconName> = {
  es: "dashboard",
  session: "desk",
  bias: "bull",
  "expected-move": "verified",
  risk: "risk",
  vix: "catalyst",
  dxy: "delayed",
  us10y: "delayed",
  oil: "unavailable",
};

/**
 * Dense verified market-pulse strip.
 * Unconfigured instruments stay as one disclosure line — never fabricated tiles.
 */
export function CommandStrip({ model }: { model: CommandStripModel }) {
  const readable = model.cells.filter((cell) => cell.coverage !== "unconfigured");
  const unconfigured = model.cells.filter((cell) => cell.coverage === "unconfigured");

  return (
    <section className="dashCommandStrip" aria-label="Market pulse">
      <header className="dashCommandStripHead">
        <span className="mccEyebrow vxIconLabel">
          <StatusIcon name="dashboard" />
          MARKET PULSE
        </span>
        <small>{model.updatedLabel}</small>
      </header>
      <ul className="dashCommandStripGrid">
        {readable.map((cell) => (
          <li
            key={cell.id}
            className={`dashCommandCell is-${cell.tone}${cell.available ? "" : " is-empty"}`}
          >
            <div className="dashCommandCellHead">
              <span className="dashCommandLabel">{cell.label}</span>
              <span className="dashCommandCellIcon">
                <StatusIcon
                  name={cell.available ? CELL_ICON[cell.id] ?? "verified" : "unavailable"}
                  title={cell.available ? undefined : "Awaiting verified feed"}
                />
              </span>
            </div>
            <strong>{cell.value}</strong>
            {cell.detail ? <em>{cell.detail}</em> : null}
            {cell.sparkline?.length ? (
              <Sparkline
                values={cell.sparkline}
                tone={cell.tone === "up" || cell.tone === "down" || cell.tone === "flat" ? cell.tone : "neutral"}
                label={`${cell.label} recent verified closes`}
                width={72}
                height={20}
                filled
              />
            ) : null}
          </li>
        ))}
      </ul>
      {unconfigured.length ? (
        <p className="dashCommandStripCoverage">
          <span>Not on the verified dashboard feed:</span>{" "}
          {unconfigured.map((cell) => cell.label).join(", ")}.
        </p>
      ) : null}
      <p className="dashCommandStripNote">{model.disclosure}</p>
    </section>
  );
}
