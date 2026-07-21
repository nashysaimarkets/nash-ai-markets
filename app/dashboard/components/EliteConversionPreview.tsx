import Link from "next/link";

const previews = [
  ["Structured trade plan", "Confirmation, invalidation and no-trade conditions organised into one review."],
  ["Full evidence workspace", "Deeper scenario, risk and provider context in the Elite terminal."],
  ["Data safeguards", "Additional verification and data-quality controls."],
] as const;

export function EliteConversionPreview() {
  return (
    <section className="eliteConversionPreview" aria-labelledby="elite-preview-title">
      <header>
        <div><span>ELITE WORKFLOW PREVIEW</span><h2 id="elite-preview-title">See the depth behind the daily decision.</h2><p>Your current dashboard remains active. Elite adds the complete planning and data-safeguard workflow.</p></div>
        <Link href="/pricing">Compare Elite access <span aria-hidden="true">→</span></Link>
      </header>
      <div>
        {previews.map(([title, copy], index) => <article key={title}>
          <span>0{index + 1} · LOCKED</span><h3>{title}</h3><p>{copy}</p><div aria-hidden="true"><i /><i /><i /></div>
        </article>)}
      </div>
      <footer><span>No performance promises · upgrade only when the additional workflow fits your process</span><Link href="/#membership">Explore membership options</Link></footer>
    </section>
  );
}
