'use strict';

// A JavaScript action receives GitHub's artifact runtime credentials. Keep them
// in the inherited child environment; never export them into a file or log.
const {spawn, spawnSync} = require('node:child_process');
const {realpathSync} = require('node:fs');
const {isAbsolute, join, resolve} = require('node:path');

const EXPECTED_NODE_VERSION = 'v24.19.0';
const REQUIRED_ARTIFACT_RETENTION_DAYS = 7;
const SOURCE_ROOT = resolve(__dirname,'../../..');
const requireValue = ok => {if (!ok) throw Error('LOCAL_ACTION_PREREQUISITES_REFUSED');};

/** No network, secret lookup or execution on import. Overrides allow focused
 * process-boundary tests; the action entry always uses these real defaults.
 */
async function runLocalAction({env = process.env, sourceRoot = SOURCE_ROOT,
  spawnProcess = spawn, probeProcess = spawnSync, signals = process} = {}) {
  requireValue(typeof env.ACTIONS_RUNTIME_TOKEN === 'string' && env.ACTIONS_RUNTIME_TOKEN.trim()
    && typeof env.ACTIONS_RESULTS_URL === 'string' && env.ACTIONS_RESULTS_URL.trim()
    && typeof env.GITHUB_RETENTION_DAYS === 'string' && /^[0-9]+$/.test(env.GITHUB_RETENTION_DAYS));
  const retention = Number(env.GITHUB_RETENTION_DAYS), results = new URL(env.ACTIONS_RESULTS_URL);
  requireValue(Number.isSafeInteger(retention) && retention >= REQUIRED_ARTIFACT_RETENTION_DAYS
    && results.protocol === 'https:' && !results.username && !results.password
    && typeof env.MONACO_PINNED_NODE_EXECUTABLE === 'string'
    && isAbsolute(env.MONACO_PINNED_NODE_EXECUTABLE));
  const binary = realpathSync(env.MONACO_PINNED_NODE_EXECUTABLE), root = realpathSync(sourceRoot);
  const entry = join(root,'scripts/pocket-monaco-hosted-entry.mjs');
  requireValue(realpathSync(entry) === entry);
  const inherited = {...env};
  // No ambient preload or alternate module search can change the pinned entry.
  delete inherited.NODE_OPTIONS; delete inherited.NODE_PATH;
  const probe = probeProcess(binary,['--version'],{cwd:root,env:inherited,shell:false,
    stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:5000,maxBuffer:1024});
  requireValue(!probe.error && probe.status === 0 && probe.signal === null
    && probe.stdout === EXPECTED_NODE_VERSION+'\n' && probe.stderr === '');
  return new Promise(resolveResult => {
    let child, settled = false;
    const forwardInt = () => {try {child?.kill('SIGINT');} catch { /* Child already stopped. */ }};
    const forwardTerm = () => {try {child?.kill('SIGTERM');} catch { /* Child already stopped. */ }};
    const settle = code => {
      if (settled) return; settled = true;
      signals.off('SIGINT',forwardInt); signals.off('SIGTERM',forwardTerm);
      resolveResult(Number.isInteger(code) && code >= 0 && code <= 255 ? code : 1);
    };
    try {
      child = spawnProcess(binary,[entry,'--run-once'],{cwd:root,env:inherited,shell:false,stdio:'inherit'});
      signals.on('SIGINT',forwardInt); signals.on('SIGTERM',forwardTerm);
      child.once('error',() => settle(1)); // Discard error text and credential-bearing environment.
      child.once('close',(code,signal) => settle(code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1)));
    } catch {settle(1);}
  });
}

module.exports = {runLocalAction,EXPECTED_NODE_VERSION,REQUIRED_ARTIFACT_RETENTION_DAYS};

if (require.main === module) {
  runLocalAction().then(code => {process.exitCode = code;},() => {
    process.stderr.write('::error::Protected runner action prerequisites are missing or invalid.\n');
    process.exitCode = 1;
  });
}
