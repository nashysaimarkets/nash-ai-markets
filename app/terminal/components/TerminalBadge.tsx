import type { ReactNode } from "react";

type TerminalBadgeProps = {
  label: ReactNode;
  tone?: "positive" | "neutral" | "warning" | "danger" | "info";
  pulse?: boolean;
};

export function TerminalBadge({ label, tone = "neutral", pulse = false }: TerminalBadgeProps) {
  return <span className="ftBadge" data-tone={tone}>{pulse ? <i aria-hidden="true" /> : null}{label}</span>;
}
