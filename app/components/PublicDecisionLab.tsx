"use client";

import { useMemo, useState } from "react";

type Trust = "verified" | "unavailable";
type Structure = "acceptance" | "rejection" | "mixed";
type Evidence = "aligned" | "conflicted";
type Catalyst = "clear" | "elevated";

function choiceClass(active: boolean) {
  return active ? "isActive" : "";
}

export function PublicDecisionLab() {
  const [trust, setTrust] = useState<Trust>("verified");
  const [structure, setStructure] = useState<Structure>("mixed");
  const [evidence, setEvidence] = useState<Evidence>("conflicted");
  const [catalyst, setCatalyst] = useState<Catalyst>("clear");

  const decision = useMemo(() => {
    if (trust === "unavailable") {
      return {
        tone: "locked",
        label: "Safety locked",
        detail: "The evidence chain stops when the underlying information cannot be verified.",
        changedBy: "Restore verified inputs",
      };
    }

    if (catalyst === "elevated") {
      return {
        tone: "warning",
        label: "Stand aside",
        detail: "Elevated scheduled risk overrides direction until the event window clears.",
        changedBy: "Catalyst window clears",
      };
    }

    if (structure === "mixed" || evidence === "conflicted") {
      return {
        tone: "warning",
        label: "Wait for confirmation",
        detail: "Structure and supporting evidence do not yet agree, so neither path has permission.",
        changedBy: structure === "mixed" ? "Structure resolves" : "Evidence aligns",
      };
    }

    if (structure === "acceptance") {
      return {
        tone: "positive",
        label: "Prepare bullish path",
        detail: "Verified acceptance and aligned evidence support preparation, subject to invalidation.",
        changedBy: "Acceptance fails",
      };
    }

    return {
      tone: "negative",
      label: "Prepare bearish path",
      detail: "Verified rejection and aligned evidence support preparation, subject to invalidation.",
      changedBy: "Structure recovers",
    };
  }, [catalyst, evidence, structure, trust]);

  return (
    <section className="decisionLab" aria-labelledby="decision-lab-title">
      <header>
        <div>
          <p className="resetEyebrow">Interactive public experiment</p>
          <h2 id="decision-lab-title">Change the conditions.<br /><em>Watch the decision change.</em></h2>
        </div>
        <p>
          This educational simulator contains no market prices or live signals.
          It demonstrates the transparent logic behind the Bullseye process.
        </p>
      </header>

      <div className="decisionLabWorkspace">
        <div className="decisionLabControls">
          <fieldset>
            <legend><span>01</span> Data trust</legend>
            <div>
              <button type="button" className={choiceClass(trust === "verified")} aria-pressed={trust === "verified"} onClick={() => setTrust("verified")}>Verified</button>
              <button type="button" className={choiceClass(trust === "unavailable")} aria-pressed={trust === "unavailable"} onClick={() => setTrust("unavailable")}>Unavailable</button>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>02</span> Price structure</legend>
            <div>
              <button type="button" className={choiceClass(structure === "acceptance")} aria-pressed={structure === "acceptance"} onClick={() => setStructure("acceptance")}>Acceptance</button>
              <button type="button" className={choiceClass(structure === "mixed")} aria-pressed={structure === "mixed"} onClick={() => setStructure("mixed")}>Mixed</button>
              <button type="button" className={choiceClass(structure === "rejection")} aria-pressed={structure === "rejection"} onClick={() => setStructure("rejection")}>Rejection</button>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>03</span> Supporting evidence</legend>
            <div>
              <button type="button" className={choiceClass(evidence === "aligned")} aria-pressed={evidence === "aligned"} onClick={() => setEvidence("aligned")}>Aligned</button>
              <button type="button" className={choiceClass(evidence === "conflicted")} aria-pressed={evidence === "conflicted"} onClick={() => setEvidence("conflicted")}>Conflicted</button>
            </div>
          </fieldset>
          <fieldset>
            <legend><span>04</span> Catalyst risk</legend>
            <div>
              <button type="button" className={choiceClass(catalyst === "clear")} aria-pressed={catalyst === "clear"} onClick={() => setCatalyst("clear")}>Clear window</button>
              <button type="button" className={choiceClass(catalyst === "elevated")} aria-pressed={catalyst === "elevated"} onClick={() => setCatalyst("elevated")}>Elevated</button>
            </div>
          </fieldset>
        </div>

        <output className="decisionLabOutput" data-tone={decision.tone} aria-live="polite">
          <span>Resulting posture</span>
          <strong>{decision.label}</strong>
          <p>{decision.detail}</p>
          <dl>
            <div><dt>Permission</dt><dd>{decision.tone === "positive" || decision.tone === "negative" ? "Conditional" : "Withheld"}</dd></div>
            <div><dt>What changes it?</dt><dd>{decision.changedBy}</dd></div>
          </dl>
          <small>Scenarios, not predictions · educational demonstration only</small>
        </output>
      </div>
    </section>
  );
}
