export type PocketReportResponse = {
  status?: string | null;
  output_text?: string | null;
  incomplete_details?: { reason?: string | null } | null;
};

export class PocketReportCompletionError extends Error {
  constructor(public readonly reason: string, outputLength: number) {
    super(`Structured response did not complete (${reason}; ${outputLength} chars).`);
    this.name = "PocketReportCompletionError";
  }
}

export function completedPocketReportOutput(response: PocketReportResponse) {
  const output = response.output_text?.trim() ?? "";
  const incompleteReason = response.incomplete_details?.reason ?? null;
  if (response.status !== "completed") {
    throw new PocketReportCompletionError(incompleteReason ?? response.status ?? "unknown", output.length);
  }
  if (!output) throw new Error("Structured response was empty (completed).");
  let parsed: unknown;
  try { parsed = JSON.parse(output); }
  catch { throw new Error(`Structured response was invalid JSON (completed; ${output.length} chars).`); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Structured response was not a JSON object (completed).");
  }
  return output;
}
