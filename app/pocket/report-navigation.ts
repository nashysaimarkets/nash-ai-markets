/** Open every disclosure on the route to a report section before moving focus. */
export function revealReportTarget(target: HTMLElement | null, reducedMotion = false) {
  if (!target) return;
  let parent: HTMLElement | null = target;
  while (parent) {
    if (parent.tagName === "DETAILS") (parent as HTMLDetailsElement).open = true;
    parent = parent.parentElement;
  }
  // Measure the real sticky picker: its height changes with screen size and text zoom.
  const sticky = target.closest(".psResults")?.querySelector(".psTimeframeSticky");
  if (sticky) target.style.scrollMarginTop = `${Math.ceil(sticky.getBoundingClientRect().height) + 16}px`;
  target.setAttribute("tabindex", "-1");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
}
