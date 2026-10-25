import { automaticChartConfirmation, type ChartConfirmation } from '../pocket/chart-preflight.ts';

export class WorkspaceAccessError extends Error {
  constructor() { super('Sign in to continue. Your charts are kept here.'); }
}
/** One user action; provenance is acquired internally before analysis. No retries,
 * manual facts, invented defaults, or analysis after cancelled/uncertain evidence. */
export async function automaticAnalysis<Report>(input: {
  image: string; intention: string; signal: AbortSignal;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
  precisionCrop: (image: string) => Promise<string | null>;
  onConfirmation: (facts: ChartConfirmation) => void;
}): Promise<{ analysis: Report; confirmation: ChartConfirmation }> {
  const send = async (url: string, body: unknown) => {
    input.signal.throwIfAborted();
    const response = await input.fetch(url, {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:input.signal});
    input.signal.throwIfAborted();
    if (response.status === 401) throw new WorkspaceAccessError();
    if (response.status === 402 || response.status === 403) throw new Error('Your account access needs attention. Open Account; do not purchase again.');
    if (!response.ok) throw new Error('Analysis is temporarily unavailable. Your chart is saved here.');
    const payload = await response.json();
    input.signal.throwIfAborted();
    return payload;
  };
  const preflight = await send('/api/pocket/preflight', {image:input.image,contextImage:''});
  const confirmation = automaticChartConfirmation(preflight.preflight, false);
  if (!confirmation) throw new Error('This image cannot be read reliably. Replace it with a clear chart showing its instrument, timeframe and price scale.');
  input.onConfirmation(confirmation);
  const precisionImage = await input.precisionCrop(input.image);
  input.signal.throwIfAborted();
  const result = await send('/api/pocket/analyse', {image:input.image,precisionImage,intention:input.intention,chartConfirmation:confirmation});
  if (!result.analysis || typeof result.analysis !== 'object' || Array.isArray(result.analysis)) throw new Error('Analysis could not complete. Your chart is saved here.');
  return {analysis:result.analysis,confirmation};
}
