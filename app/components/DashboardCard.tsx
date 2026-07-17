import type { ReactNode } from "react";

type DashboardCardProps = {
  eyebrow: string;
  title: string;
  badge?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
};

export function DashboardCard({
  eyebrow,
  title,
  badge,
  children,
  className = "",
  footer,
}: DashboardCardProps) {
  return <article className={`dailyCard ${className}`.trim()}>
    <header>
      <div><span>{eyebrow}</span><h2>{title}</h2></div>
      {badge}
    </header>
    {children}
    {footer ? <footer>{footer}</footer> : null}
  </article>;
}
