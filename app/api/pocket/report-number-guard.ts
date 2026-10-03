/** Incremental resource guard, not a number parser or price repair.
 * Bound pathological unquoted numeric output well beyond the report's needs.
 * Reject the attempt; never truncate or round it. Quoted evidence, including
 * escaped quotes, is deliberately left untouched. */
export function createReportNumberGuard() {
  let quoted = false, escaped = false, numericLength = 0, rejected = false;
  return (delta: string): boolean => {
    if (rejected) return false;
    for (const char of delta) {
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
        continue;
      }
      if (char === '"') { quoted = true; numericLength = 0; continue; }
      if (numericLength) {
        if (/[0-9eE+.-]/.test(char)) {
          if (++numericLength > 1024) { rejected = true; return false; }
          continue;
        }
        numericLength = 0;
      }
      if (/[0-9-]/.test(char)) numericLength = 1;
    }
    return true;
  };
}
