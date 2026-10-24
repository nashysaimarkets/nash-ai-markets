/** Affected scanner regressions only. All transports in these tests are local controls. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const files = [
  'tests/pocket-precision-output-v2.test.ts',
  'tests/pocket-calibration-observations-contract.test.ts',
  'tests/pocket-confirmed-facts.test.ts',
  'tests/pocket-precision-fallback.test.ts',
  'tests/pocket-liquidity-chain-integration.test.ts',
  'tests/pocket-liquidity-guard.test.ts',
  'tests/pocket-liquidity-event-evidence.test.ts',
  'tests/pocket-monaco-internal-diagnostics.test.ts',
  'tests/pocket-launch-hardening.test.ts',
  'tests/pocket-source-placement.test.ts',
  'tests/pocket-source-placement-render.test.ts',
  'tests/pocket-original-levels.test.ts',
  'tests/axis-verification.test.ts',
  'tests/pocket-original-geometry.test.ts',
  'tests/axis-reader-cache.test.ts',
  'tests/pocket-next-integration.test.ts',
  'tests/pocket-workflow-source-lifecycle.test.ts',
];
const out = resolve(process.env.POCKET_SCANNER_QA_OUTPUT || '.scanner-repair-qa');
mkdirSync(out, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const results = [];
for (const file of files) {
  const run = spawnSync(process.execPath, ['--test-reporter=tap', file], { encoding: 'utf8', timeout: 120_000 });
  const log = `${run.stdout || ''}${run.stderr || ''}${run.error ? String(run.error) : ''}`;
  const count = field => Number(log.match(new RegExp(`^# ${field} (\\d+)$`, 'm'))?.[1] ?? NaN);
  const tests = count('tests'), pass = count('pass'), fail = count('fail'), skipped = count('skipped');
  const passed = !run.error && run.status === 0 && tests > 0 && pass === tests && fail === 0 && skipped === 0;
  const receipt = { file, sourceSha256: hash(readFileSync(file)), status: passed ? 'PASS' : 'FAIL', tests, pass, fail, skipped, exitCode: run.status, logSha256: hash(log) };
  results.push(receipt);
  writeFileSync(resolve(out, file.split('/').at(-1) + '.log'), log);
  console.log(JSON.stringify(receipt));
  if (!passed) { console.error(log.slice(-12_000)); process.exitCode = 1; }
}
const summary = {
  kind: 'POCKET_SCANNER_REPAIR_AFFECTED_REGRESSIONS',
  status: process.exitCode ? 'FAIL' : 'PASS',
  observedAtUtc: new Date().toISOString(),
  sourceCommit: process.env.GIT_COMMIT_SHA || null,
  runtime: process.version,
  results,
  totals: Object.fromEntries(['tests', 'pass', 'fail', 'skipped'].map(key => [key, results.reduce((sum, row) => sum + (Number.isFinite(row[key]) ? row[key] : 0), 0)])),
  providerCalls: 0,
  liveAcceptance: false,
};
writeFileSync(resolve(out, 'AFFECTED-REGRESSIONS.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ status: summary.status, totals: summary.totals, suites: results.length }));
