/** Explicit successor entry; the original entry cannot silently become a
 * continuation. Uses the same pinned runtime, encrypted receiver and secrets.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runHostedFirstSix} from './pocket-monaco-hosted-entry.mjs';
import {runProtectedContinuation} from './pocket-monaco-protected-runner.mjs';
import {CONTINUATION} from './pocket-monaco-continuation-admission.mjs';

export async function runHostedContinuation(input,dependencies={}) {
  const result=await runHostedFirstSix(input,{...dependencies,execute:runProtectedContinuation});
  return {...result,kind:'MONACO_PROTECTED_FIRST_FIVE_CONTINUATION_RUN',
    predecessorRunId:CONTINUATION.originalRunId,previousTransportSendAttempts:CONTINUATION.previousTransportSendAttempts};
}
async function main() {
  const controller=new AbortController(),stop=()=>controller.abort();
  process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try {
    const result=await runHostedContinuation({env:process.env,argv:process.argv.slice(2),signal:controller.signal});
    process.stdout.write(JSON.stringify(result)+'\n');
    if(result.status!=='COMPLETED')process.exitCode=1;
  } finally {process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
