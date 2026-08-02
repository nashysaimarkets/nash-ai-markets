import type { ReactNode } from "react";
import { BrandLogo } from "./BrandLogo";
import { MemberShell, type MemberShellActive } from "./MemberShell";

type Props = {
  active: MemberShellActive;
  className?: string;
  children?: ReactNode;
};

/** Logo-only premium canvas for member surfaces during product rebuild. */
export function MemberEmptyCanvas({ active, className = "", children }: Props) {
  return (
    <MemberShell
      active={active}
      className={`customerTerminal premiumTerminal terminalMemberPage terminalCanvasPage ${className}`.trim()}
    >
      <div className="memberDashboardShell ctWorkspace terminalEmptyCanvas" id="overview">
        <BrandLogo authenticated className="terminalCanvasLogo" />
        {children}
      </div>
    </MemberShell>
  );
}
