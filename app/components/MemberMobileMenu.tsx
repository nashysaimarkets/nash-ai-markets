"use client";

import type { MouseEvent, ReactNode, SyntheticEvent } from "react";
import { useState } from "react";

type MemberMobileMenuProps = {
  children: ReactNode;
};

/**
 * Native details/summary menu with explicit close behaviour after navigation.
 *
 * App Router transitions can preserve the details element between member pages,
 * so relying on the browser to collapse it leaves the drawer covering the next
 * destination. Keeping the open state here makes pointer and keyboard-selected
 * links close the drawer immediately.
 */
export function MemberMobileMenu({ children }: MemberMobileMenuProps) {
  const [open, setOpen] = useState(false);

  const syncOpenState = (event: SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(event.currentTarget.open);
  };

  const closeAfterNavigation = (event: MouseEvent<HTMLDetailsElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest("a[href]")) setOpen(false);
  };

  return (
    <details
      className="memberMobileMenu"
      open={open}
      onToggle={syncOpenState}
      onClick={closeAfterNavigation}
    >
      <summary
        aria-label={open ? "Close member navigation" : "Open member navigation"}
        aria-expanded={open}
      >
        <span>Menu</span>
        <i aria-hidden="true" />
      </summary>
      {children}
    </details>
  );
}
