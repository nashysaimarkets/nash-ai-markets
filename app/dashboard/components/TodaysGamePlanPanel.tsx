import { StatusIcon } from "../../components/StatusIcon.tsx";
import type { TodaysGamePlanModel } from "../lib/todays-game-plan.ts";
import { ConfidenceRing } from "./visual/ConfidenceRing.tsx";
import { RiskMeter } from "./visual/RiskMeter.tsx";
import { StatusBadge } from "./visual/StatusBadge.tsx";

function toneClass(tone: string) {
  return `is-${tone}`;
}

function confidenceActive(label: string): boolean {
  return !/await|not established|unavailable|incomplete/i.test(label);
}

function confidenceTone(permissionTone: string): "positive" | "info" | "caution" | "risk" | "neutral" {
  if (permissionTone === "open") return "positive";
  if (permissionTone === "caution") return "caution";
  if (permissionTone === "blocked") return "risk";
  return "info";
}

/** Premium Game Plan centrepiece — verified plan fields only. */
export function TodaysGamePlanPanel({ model }: { model: TodaysGamePlanModel }) {
  const active = confidenceActive(model.confidence);

  return (
    <section className="dashGamePlan vxSoftPanel" aria-labelledby="dash-game-plan-title">
      <header className="dashGamePlanHeader">
        <div>
          <span className="mccEyebrow vxIconLabel">
            <StatusIcon name="verified" />
            TODAY&apos;S GAME PLAN
          </span>
          <h2 id="dash-game-plan-title">{model.title}</h2>
        </div>
        <StatusBadge
          label={model.permissionLabel}
          tone={
            model.permissionTone === "blocked"
              ? "risk"
              : model.permissionTone === "caution"
                ? "caution"
                : model.permissionTone === "open"
                  ? "positive"
                  : "info"
          }
        />
      </header>

      <div className="dashGamePlanCanvas">
        <div className="dashGamePlanPrimary">
          <ConfidenceRing
            label={model.confidence}
            detail={model.confidenceDetail}
            active={active}
            tone={confidenceTone(model.permissionTone)}
          />
          <div className="dashGamePlanMetrics">
            <article>
              <span>Today&apos;s bias</span>
              <strong className={toneClass(model.permissionTone)}>{model.bias}</strong>
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
              <span>Preferred window</span>
              <strong>{model.bestWindow}</strong>
            </article>
          </div>
        </div>

        <div className="dashGamePlanSide">
          <RiskMeter label={model.maximumRisk} tone={model.permissionTone} />
          <article className="dashGamePlanInvalidation">
            <span>Invalidation</span>
            <strong>{model.invalidationLevel ?? "—"}</strong>
          </article>
          <article className="dashGamePlanAvoid">
            <span>Avoid if…</span>
            <ul>
              {model.avoidIf.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
          <article>
            <span>Trade of the day</span>
            <strong>{model.tradeOfTheDay ?? "Not published"}</strong>
            <small>{model.tradeOfTheDayNote}</small>
          </article>
        </div>

        <aside className="dashGamePlanMindsetBanner" aria-label="Today's mindset">
          <strong>Mindset · </strong>
          {model.mindset}
        </aside>
      </div>
      <p className="dashGamePlanDisclosure">{model.disclosure}</p>
    </section>
  );
}
