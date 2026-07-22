type Props = {
  providerStatus: string;
  asOfLabel: string | null;
  delayed: boolean;
};

/** Designed empty state when the provider calendar has no verified events. */
export function EventWindowEmpty({ providerStatus, asOfLabel, delayed }: Props) {
  return (
    <section className="ctPanel ctEventEmpty" aria-labelledby="catalysts-title">
      <header>
        <div>
          <span>Upcoming catalysts</span>
          <h2 id="catalysts-title">Verified event window</h2>
        </div>
      </header>
      <div className="ctEventEmptyBody">
        <div className="ctEventEmptyIcon" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="56" height="56">
            <rect x="8" y="14" width="48" height="42" rx="6" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M8 26h48M22 8v12M42 8v12" fill="none" stroke="currentColor" strokeWidth="2" />
            <circle cx="32" cy="42" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M32 38v5l3 2" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
        <div>
          <strong>Awaiting verified schedule</strong>
          <p>Economic calendar events appear only when the provider supplies a verified schedule. Unverified or invented catalysts are excluded.</p>
          <dl>
            <div><dt>Provider status</dt><dd>{providerStatus}</dd></div>
            <div><dt>Last update</dt><dd>{asOfLabel ?? "Unknown"}</dd></div>
            <div><dt>Feed label</dt><dd>{delayed ? "Delayed" : "Verified path"}</dd></div>
          </dl>
        </div>
        <ol className="ctEventTimeline" aria-hidden="true">
          <li /><li /><li /><li />
        </ol>
      </div>
    </section>
  );
}
