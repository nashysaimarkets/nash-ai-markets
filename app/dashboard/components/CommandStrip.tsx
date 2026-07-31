import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { StatusIcon } from "../../components/StatusIcon.tsx";
import type { CommandStripModel } from "../lib/command-strip.ts";

/**
 * Dense verified command strip for the dashboard header.
 *
 * Instruments with no verified source at all are still disclosed, but as one
 * line rather than a row of identical empty tiles — six placeholder cells in the
 * highest-value strip on the page crowded out the readings that do exist.
 */
export function CommandStrip({ model }: { model: CommandStripModel }) {
  const readable = model.cells.filter((cell) => cell.coverage !== "unconfigured");
  const unconfigured = model.cells.filter((cell) => cell.coverage === "unconfigured");

  return (
    <section className="dashCommandStrip" aria-label="Trading command centre">
      <header className="dashCommandStripHead">
        <span className="mccEyebrow vxIconLabel">
          <StatusIcon name="dashboard" />
          COMMAND CENTRE
        </span>
        <small>{model.updatedLabel}</small>
      </header>
      <ul className="dashCommandStripGrid">
        {readable.map((cell) => (
          <li
            key={cell.id}
            className={`dashCommandCell is-${cell.tone}${cell.available ? "" : " is-empty"}`}
          >
            <span className="dashCommandLabel">{cell.label}</span>
            <strong>{cell.value}</strong>
            {cell.detail ? <em>{cell.detail}</em> : null}
            {cell.sparkline?.length ? (
              <Sparkline values={cell.sparkline} tone={cell.tone === "up" || cell.tone === "down" || cell.tone === "flat" ? cell.tone : "neutral"} label={`${cell.label} recent verified closes`} width={72} height={20} filled />
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
