import { scannerClaimEvidence, UNVERIFIED_SCANNER_NOTICE } from './scanner-claims';
import type { OriginalGeometryReport } from './original-pixel-geometry';
import type { OriginalChartMeasurement } from './source-placement';

export default function ScannerClaimStatus({report,image,measurement,confirmed}:{report:OriginalGeometryReport;image:string|null;measurement:OriginalChartMeasurement|null;confirmed:boolean}) {
  const evidence=scannerClaimEvidence(report,image,measurement,confirmed);
  return <section aria-label="Scanner claim validation" className="scannerClaimStatus" style={{padding:'12px',border:'1px solid currentColor',borderRadius:8,margin:'12px 0'}}>
    <strong>ANALYSIS UNVERIFIED · {evidence.status === 'HOLD' ? 'PRICE CHECK HOLD' : 'PRICE POSITIONS CHECKED'}</strong>
    <p>{UNVERIFIED_SCANNER_NOTICE}</p>
    {evidence.levels.length ? <ul>{evidence.levels.map((level,index)=><li key={index}>{level.price} · POSITION CHECKED · {level.kind} role UNVERIFIED</li>)}</ul> : <p>No current-image price placement is verified. Reported prices remain UNVERIFIED.</p>}
    <p>Patterns and liquidity: UNVERIFIED. Empty output does not establish absence. Setup scores and trading decisions are unverified model opinions.</p>
  </section>;
}
