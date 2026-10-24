/** Explicit hosted entry. Import is inert; no automatic runner or schedule.
 * Protected identity/evidence/authentication remain in the accepted runner.
 * This file only supplies its concrete, one-shot ciphertext receiver.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadPinnedRuntime,loadProtectedRunnerInputs,runProtectedFirstSix}
  from './pocket-monaco-protected-runner.mjs';
import {createGitHubEnvelopeReceiver} from './pocket-monaco-github-input-relay.mjs';

export async function runHostedFirstSix({env,argv,signal}, {
  loadInputs = loadProtectedRunnerInputs, loadRuntime = loadPinnedRuntime,
  execute = runProtectedFirstSix, createReceiver = createGitHubEnvelopeReceiver
} = {}) {
  let invoked = false;
  try {
    if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== '--run-once'
      || !env || signal?.aborted) throw Error('HOSTED_ENTRY_REFUSED');
    const input = loadInputs(env);
    const receiveInputOnce = createReceiver({token:env.GITHUB_TOKEN});
    const runtime = await loadRuntime(env.RUNNER_TEMP);
    if (signal?.aborted) throw Error('HOSTED_ENTRY_REFUSED');
    invoked = true;
    return await execute({...input,runtime,receiveInputOnce,signal,
      credentials:{existingKey:env.MONACO_FIRST_SIX_OPENAI_API_KEY,
        ledgerPassword:env.MONACO_FIRST_SIX_LEDGER_KEY}});
  } catch {
    return {kind:'MONACO_PROTECTED_FIRST_SIX_RUN',status:invoked ? 'UNCERTAIN' : 'HOLD',
      stage:'HOSTED_ENTRY',bootstrapInvocations:invoked ? null : 0,
      transportSendAttempts:invoked ? null : 0,providerMetadataRequests:0,
      diagnosticCasesRetained:0,providerAuthenticity:'NOT_ATTESTED_BY_CLI_SUMMARY',
      financiallySettled:false,actualMicroUsd:null};
  }
}

async function main() {
  const controller = new AbortController(), stop = () => controller.abort();
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
  try {
    const result = await runHostedFirstSix({env:process.env,argv:process.argv.slice(2),signal:controller.signal});
    process.stdout.write(JSON.stringify(result)+'\n');
    if (result.status !== 'COMPLETED') process.exitCode = 1;
  } finally {process.off('SIGINT',stop); process.off('SIGTERM',stop);}
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
