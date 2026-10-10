/**
 * Historical test charges are not reconciled and no shared atomic dollar
 * reservation ledger has been verified. Neither preview secrets, per-IP
 * limits nor a fresh CI job prove remaining allowance under the cumulative $2
 * cap. Keep both billed benchmark entry points closed, regardless of env vars.
 * Replace this hold only after implementing and testing durable reservations
 * (including retries and unsettled charges), and obtaining separate approval.
 */
export function isCumulativeTestSpendHeld(): boolean {
  return true;
}
