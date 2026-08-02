import Link from "next/link";

type LearningStep = "ideas" | "journal" | "reviews";

const steps: Array<{ id: LearningStep; href: string; index: string; label: string; detail: string }> = [
  { id: "ideas", href: "/ideas", index: "01", label: "Shape", detail: "Improve the product" },
  { id: "journal", href: "/journal", index: "02", label: "Capture", detail: "Record your process" },
  { id: "reviews", href: "/reviews", index: "03", label: "Review", detail: "Learn from the session" },
];

export function LearningWorkflowRail({ active }: { active: LearningStep }) {
  return (
    <nav className="learningWorkflowRail" aria-label="Review and learning workflow">
      <span>REVIEW &amp; LEARN</span>
      <ol>
        {steps.map((step) => (
          <li key={step.id} className={active === step.id ? "is-active" : undefined}>
            <Link href={step.href} aria-current={active === step.id ? "step" : undefined}>
              <b>{step.index}</b>
              <span><strong>{step.label}</strong><small>{step.detail}</small></span>
              <i aria-hidden="true">↗</i>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}
