type MacroScanInput = {
  sample: boolean;
  available: boolean;
  unavailable: readonly string[];
  todayCount: number;
  nextHighImpactLabel: string | null;
};

/** Missing calendar coverage can never establish an absence of event risk. */
export function macroScanStatus(input: MacroScanInput) {
  const { sample, available, unavailable, todayCount, nextHighImpactLabel } = input;
  if (sample) return { state: "clear", badge: "FICTIONAL SAMPLE", title: "NO LIVE EVENT CONTEXT", detail: "This example is not a real instrument. Live macro events do not apply to the sample." };
  if (!available) return { state: "withheld", badge: "CHECK SOURCE", title: "MACRO SCHEDULE UNAVAILABLE", detail: "Connected calendar sources could not be confirmed. Treat event risk as unknown." };
  const coverageNote = unavailable.length ? ` ${unavailable.join(" · ")} unavailable; additional event risk is unverified.` : "";
  if (nextHighImpactLabel) return { state: "warning", badge: "HIGH IMPACT", title: nextHighImpactLabel, detail: `${todayCount} macro ${todayCount === 1 ? "event" : "events"} listed today in UK time.${coverageNote}` };
  if (unavailable.length) return { state: "warning", badge: "PARTIAL COVERAGE", title: "MACRO SCHEDULE INCOMPLETE", detail: `${todayCount} ${todayCount === 1 ? "event" : "events"} returned for today.${coverageNote} Check the agency or broker calendar.` };
  return { state: "clear", badge: "LIVE CHECK", title: todayCount ? `${todayCount} MACRO ${todayCount === 1 ? "EVENT" : "EVENTS"} TODAY` : "NO RELEASE LISTED TODAY", detail: todayCount ? "Open Macro Check for times, impact and source details." : "No medium or high-impact US release is listed today; unscheduled news can still move price." };
}
