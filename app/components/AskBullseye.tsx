"use client";

import { useId, useMemo, useState } from "react";
import {
  ASK_BULLSEYE_QUESTIONS,
  answerAskBullseye,
  type AskBullseyeContext,
} from "../lib/ask-bullseye.ts";

type Props = {
  context: AskBullseyeContext;
  compact?: boolean;
};

export function AskBullseye({ context, compact = false }: Props) {
  const listId = useId();
  const [activeId, setActiveId] = useState(ASK_BULLSEYE_QUESTIONS[0].id);
  const answer = useMemo(
    () => answerAskBullseye(activeId, context),
    [activeId, context],
  );

  return (
    <section className={`askBullseye${compact ? " is-compact" : ""}`} aria-labelledby={listId}>
      <header>
        <div>
          <span>Ask Bullseye</span>
          <h2 id={listId}>Deterministic market intelligence</h2>
        </div>
        <p>Answers use only the verified snapshot, evidence checklist, scenario logic and provider status already available here.</p>
      </header>
      <div className="askBullseyeChips" role="group" aria-label="Suggested questions">
        {ASK_BULLSEYE_QUESTIONS.map((question) => (
          <button
            key={question.id}
            type="button"
            className={activeId === question.id ? "is-active" : undefined}
            aria-pressed={activeId === question.id}
            onClick={() => setActiveId(question.id)}
          >
            {question.label}
          </button>
        ))}
      </div>
      <article className="askBullseyePanel" aria-live="polite">
        <h3>{answer.title}</h3>
        <p>{answer.body}</p>
        {answer.bullets.length ? (
          <ul>
            {answer.bullets.map((item) => <li key={item}>{item}</li>)}
          </ul>
        ) : null}
        <small>{answer.disclaimer}</small>
      </article>
    </section>
  );
}
