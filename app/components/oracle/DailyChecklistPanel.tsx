"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { ChecklistItemId } from "../../lib/oracle/daily-checklist.ts";
import {
  buildDailyChecklist,
  readDailyChecklist,
  resetDailyChecklist,
  writeDailyChecklist,
} from "../../lib/oracle/daily-checklist.ts";
import { subscribeOracleStorage } from "../../lib/oracle/oracle-storage-bus.ts";
import { syncProcessScoreFromChecklist } from "../../lib/oracle/process-score.ts";
import { createCachedSnapshot, createConstantSnapshot } from "../../lib/oracle/cached-snapshot.ts";

const checklistSnapshot = createCachedSnapshot(() => readDailyChecklist());
const checklistServerSnapshot = createConstantSnapshot(() => readDailyChecklist(null));

export function DailyChecklistPanel({
  postureHeadline,
  permissionTone,
  hasUpcomingEvent,
}: {
  postureHeadline: string;
  permissionTone: string;
  hasUpcomingEvent: boolean;
}) {
  const coaching = useMemo(
    () => ({ postureHeadline, permissionTone, hasUpcomingEvent }),
    [postureHeadline, permissionTone, hasUpcomingEvent],
  );

  const state = useSyncExternalStore(
    subscribeOracleStorage,
    checklistSnapshot,
    checklistServerSnapshot,
  );

  const model = useMemo(() => buildDailyChecklist(state, coaching), [state, coaching]);

  function toggle(id: ChecklistItemId) {
    const next = readDailyChecklist();
    next.items[id] = !next.items[id];
    writeDailyChecklist(next);
    syncProcessScoreFromChecklist(next.items);
  }

  function reset() {
    if (!window.confirm("Reset today’s preparation checklist?")) return;
    const next = resetDailyChecklist();
    syncProcessScoreFromChecklist(next.items);
  }

  return (
    <section className="oracleChecklist" aria-labelledby="daily-checklist-title">
      <header>
        <div>
          <span className="companionEyebrow">DAILY CHECKLIST</span>
          <h2 id="daily-checklist-title">Preparation over frequency</h2>
        </div>
        <strong>
          {model.completed}/{model.total}
        </strong>
      </header>
      <p className="oracleCoaching">{model.coachingNote}</p>
      <ul>
        {model.items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.done} onChange={() => toggle(item.id)} />
              <span>{item.label}</span>
            </label>
          </li>
        ))}
      </ul>
      <footer>
        <button type="button" className="oracleResetBtn" onClick={reset}>
          Reset today
        </button>
        <span>Completing the checklist never requires taking a trade.</span>
      </footer>
    </section>
  );
}
