import { StatusIcon } from "../../components/StatusIcon.tsx";
import type { TodaysGamePlanModel } from "../lib/todays-game-plan.ts";

function toneClass(tone: string) {
  return `is-${tone}`;
}

/** Premium Game Plan centrepiece — verified plan fields only. */
export function TodaysGamePlanPanel({ model }: { model: TodaysGamePlanModel }) {
  return (
    <section className="dashGamePlan vxSoftPanel" aria-labelledby="dash-game-plan-title">
      <header className="dashGamePlanHeader">
        <div>
          <span className="mccEyebrow vxIconLabel">
            <StatusIcon name="verified" />
            CENTREPIECE
          </span>
          <h2 id="dash-game-plan-title">{model.title}</h2>
          <p>What is happening, what to watch, and what to do next — from verified delayed inputs.</p>
        </div>
        <span className={`dashPill ${toneClass(model.permissionTone)}`}>{model.permissionLabel}</span>
      </header>

      <div className="dashGamePlanGrid">
        <article>
          <span>Today’s bias</span>
          <strong>{model.bias}</strong>
        </article>
        <article>
          <span>Confidence</span>
          <strong>{model.confidence}</strong>
          {model.confidenceDetail ? <small>{model.confidenceDetail}</small> : null}
        </article>
        <article>
          <span>Expected move</span>
          <strong>{model.expectedMove ?? "Not established"}</strong>
          {model.expectedMoveDetail ? <small>{model.expectedMoveDetail}</small> : null}
        </article>
        <article>
          <span>Key confirmation</span>
          <strong>{model.confirmationLevel ?? "Awaiting verified levels"}</strong>
        </article>
        <article>
          <span>Invalidation</span>
          <strong>{model.invalidationLevel ?? "—"}</strong>
        </article>
        <article>
          <span>Maximum risk</span>
          <strong>{model.maximumRisk}</strong>
        </article>
        <article className="is-wide">
          <span>Best trading window</span>
          <strong>{model.bestWindow}</strong>
        </article>
        <article className="is-wide">
          <span>Avoid trading if…</span>
          <ul>
            {model.avoidIf.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="is-wide dashGamePlanTrade">
          <span>Trade of the day</span>
          <strong>{model.tradeOfTheDay ?? "Not published"}</strong>
          <small>{model.tradeOfTheDayNote}</small>
        </article>
        <article className="is-wide dashGamePlanMindset">
          <span>Today’s mindset</span>
          <strong>{model.mindset}</strong>
        </article>
      </div>
      <p className="dashGamePlanDisclosure">{model.disclosure}</p>
    </section>
  );
}
