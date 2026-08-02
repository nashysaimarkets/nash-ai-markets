import type { ReactNode } from "react";

type SafeStateProps = {
  title: string;
  children: ReactNode;
  tone?: "neutral" | "warning" | "danger";
};

export function SafeState({ title, children, tone = "neutral" }: SafeStateProps) {
  return <div className="dashboardUnavailable safeState" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
    <strong>{title}</strong>
    <div>{children}</div>
  </div>;
}
