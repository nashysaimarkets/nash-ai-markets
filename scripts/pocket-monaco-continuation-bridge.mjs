/** Successor-only facade over the unchanged original claim/submit/receipt
 * implementation. SQL receives the honest eight-field successor identity.
 * No old source identity, budget history or d001 state is substituted.
 */
import {isDeepStrictEqual} from 'node:util';
import {createIsolatedLedgerBridge} from './pocket-monaco-runner-bridge.ts';
import {CONTINUATION_IDS,validateContinuationIdentity,validateContinuationInspection}
  from './pocket-monaco-continuation-admission.mjs';

export function createContinuationLedgerBridge(port,ledgerKey,identity) {
  const bound=validateContinuationIdentity(identity);
  const {continuation,...baseIdentity}=bound;
  const admittedPort={async rpc(name,args) {
    if(name==='inspect_monaco_isolated_runner') {
      if(!isDeepStrictEqual(args?.p_identity,baseIdentity)) return {data:null,error:'CONTINUATION_IDENTITY_MISMATCH'};
      // The legacy bridge has seven identity fields. Add the independently
      // verified continuation record without changing any source/credential field.
      const result=await port.rpc(name,{...args,p_identity:structuredClone(bound)});
      if(!result.error) {
        try {validateContinuationInspection(result.data,bound);}
        catch {return {data:null,error:'CONTINUATION_INSPECTION_REFUSED'};}
      }
      return result;
    }
    if(!CONTINUATION_IDS.includes(args?.p_case_id)) return {data:null,error:'CONTINUATION_CASE_REFUSED'};
    return await port.rpc(name,args);
  }};
  return createIsolatedLedgerBridge(admittedPort,ledgerKey,baseIdentity);
}
