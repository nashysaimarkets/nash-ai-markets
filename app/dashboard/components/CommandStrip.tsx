import { Sparkline } from "../../components/mini-visuals/Sparkline.tsx";
import { StatusIcon } from "../../components/StatusIcon.tsx";
import type { CommandStripModel } from "../lib/command-strip.ts";

/** Dense verified command strip for the dashboard header. */
export function CommandStrip({ model }: { model: CommandStripModel }) {
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
        {model.cells.map((cell) => (
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
      <p className="dashCommandStripNote">{model.disclosure}</p>
    </section>
  );
}
