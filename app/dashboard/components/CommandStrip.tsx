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

function MicroVisual({ cell }: { cell: CommandStripModel["cells"][number] }) {
  if (cell.sparkline?.length) {
    return (
      <Sparkline
        values={cell.sparkline}
        tone={cell.tone === "up" || cell.tone === "down" || cell.tone === "flat" ? cell.tone : "neutral"}
        label={`${cell.label} recent verified closes`}
        className="dashCellSparkline"
        width={104}
        height={24}
        filled
      />
    );
  }

  if (!cell.available) {
    return <span className="dashMicroAwaiting" aria-label={`${cell.label} visual awaiting verified data`}><i /><i /><i /><i /></span>;
  }

  if (cell.id === "bias") {
    return <span className={`dashMicroBias is-${cell.tone}`} aria-label={`Bias direction: ${cell.value}`}><i /><i /><i /><b /></span>;
  }

  if (cell.id === "risk") {
    const level = /low/i.test(cell.value) ? 1 : /medium|moderate/i.test(cell.value) ? 3 : /high|elevated/i.test(cell.value) ? 5 : 2;
    return <span className={`dashMicroRisk is-level-${level}`} aria-label={`Risk category: ${cell.value}`}>{[1,2,3,4,5].map((step) => <i key={step} />)}</span>;
  }

  if (cell.id === "expected") {
    return <span className="dashMicroRange" aria-label="Verified expected range is available"><i /><b /><i /></span>;
  }

  if (cell.id === "session") {
    return <span className="dashMicroSession" aria-label={`Current session: ${cell.value}`}><i /><i /><b /><i /><i /></span>;
  }

  return <span className={`dashMicroDirection is-${cell.tone}`} aria-label={`${cell.label} direction: ${cell.tone}`}><i /><b /></span>;
}

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
            <MicroVisual cell={cell} />
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
