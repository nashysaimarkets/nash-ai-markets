"use client";

import { useId, useMemo, useState, type FormEvent } from "react";
import {
  ASK_BULLSEYE_QUESTIONS,
  answerAskBullseye,
  answerAskBullseyeQuery,
  type AskBullseyeAnswer,
  type AskBullseyeContext,
} from "../lib/ask-bullseye.ts";
import { MARKET_BOARD_LABELS, MARKET_BOARD_SYMBOLS } from "../lib/market-board-instruments.ts";

type Props = {
  context: AskBullseyeContext;
  compact?: boolean;
  /** Free-form ask input for Pro/Elite (or preview) intelligence entitlement. */
  interactive?: boolean;
};

export function AskBullseye({ context, compact = false, interactive = false }: Props) {
  const listId = useId();
  const formId = useId();
  const [activeId, setActiveId] = useState(ASK_BULLSEYE_QUESTIONS[0].id);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState<AskBullseyeAnswer | null>(null);

  const chipAnswer = useMemo(
    () => answerAskBullseye(activeId, context),
    [activeId, context],
  );
  const answer = submitted ?? chipAnswer;
  const marketHint = MARKET_BOARD_SYMBOLS.map((symbol) => MARKET_BOARD_LABELS[symbol]).join(" · ");

  function selectChip(id: string) {
    setActiveId(id);
    setSubmitted(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!interactive) return;
    const next = draft.trim();
    if (!next) return;
    setSubmitted(answerAskBullseyeQuery(next, context));
  }

  return (
    <section className={`askBullseye${compact ? " is-compact" : ""}${interactive ? " is-interactive" : ""}`} aria-labelledby={listId}>
      <header>
        <div>
          <span>Ask Bullseye</span>
          <h2 id={listId}>Deterministic market intelligence</h2>
        </div>
        <p>
          {interactive
            ? "Ask about any verified market on the board. Answers use only snapshot quotes, desk levels, signals and freshness already available here — never invented prices."
            : "Answers use only the verified snapshot, evidence checklist, scenario logic and provider status already available here."}
        </p>
      </header>

      {interactive ? (
        <form className="askBullseyeForm" onSubmit={onSubmit} aria-labelledby={formId}>
          <label id={formId} htmlFor={`${formId}-input`}>Ask about a verified market</label>
          <div className="askBullseyeFormRow">
            <input
              id={`${formId}-input`}
              type="text"
              name="question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="e.g. What is Oil support? · How old is VIX? · Why stand aside?"
              autoComplete="off"
              maxLength={240}
            />
            <button type="submit">Ask</button>
          </div>
          <small>Markets: {marketHint}</small>
        </form>
      ) : (
        <p className="askBullseyeLocked" role="status">
          Free-form Ask Bullseye unlocks with Pro intelligence. Suggested questions below still answer from verified evidence only.
        </p>
      )}

      <div className="askBullseyeChips" role="group" aria-label="Suggested questions">
        {ASK_BULLSEYE_QUESTIONS.map((question) => (
          <button
            key={question.id}
            type="button"
            className={!submitted && activeId === question.id ? "is-active" : undefined}
            aria-pressed={!submitted && activeId === question.id}
            onClick={() => selectChip(question.id)}
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
