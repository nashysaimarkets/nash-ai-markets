import test from 'node:test';
import assert from 'node:assert/strict';
import {buildEvaluationRunWorkflow,sealEvaluationInput} from '../scripts/pocket-scanner-evaluation-v2-operator.mjs';
import {CASE_IDS,V2} from '../scripts/pocket-scanner-evaluation-v2-source.mjs';

test('offline wrappers bind one case and separate immutable checkouts without self-referential run IDs',()=>{
  for(const caseId of CASE_IDS){
    const r=buildEvaluationRunWorkflow({caseId,sourceSha:'a'.repeat(40),evidenceSha:'b'.repeat(40)});
    assert.equal(r.published,false);assert.equal(r.dispatchAuthorised,false);
    assert.equal(r.branch,`monaco-scanner-evaluation-v2-run-${caseId}`);
    assert.equal(JSON.parse(r.vercel).git.deploymentEnabled[r.branch],false);
    assert.match(r.workflow,/environment: monaco-first-six-inference/);
    assert.match(r.workflow,/name: Pocket scanner evaluation v2\n/);
    assert.match(r.workflow,/actions: read/);
    assert.match(r.workflow,/github.run_attempt == 1/);
    assert.match(r.workflow,/persist-credentials: false/);
    assert.doesNotMatch(r.workflow,/\b(schedule|workflow_dispatch|matrix):|REVIEWED_JOB_ID|__CASE_ID__|__SOURCE_SHA__|__EVIDENCE_SHA__/);
    for(const other of CASE_IDS.filter(x=>x!==caseId))assert.ok(!r.workflow.includes(other));
  }
});
test('workflow generation rejects original case IDs, shell-shaped input, unbound pins and self-referential checkout',()=>{
  for(const change of [{caseId:'d001'},{caseId:'v2-d007'},{caseId:'v2-d001; echo wrong'},
    {sourceSha:'UNBOUND'},{sourceSha:V2.appSourceSha},{evidenceSha:'a'.repeat(40)}]){
    assert.throws(()=>buildEvaluationRunWorkflow({caseId:'v2-d001',sourceSha:'a'.repeat(40),evidenceSha:'b'.repeat(40),...change}));
  }
});
test('offline relay cannot reuse an original run, case identity or unverified bundle',()=>{
  const base={caseId:'v2-d001',sourceSha:'a'.repeat(40),runId:'90000000009',bundleSha256:'b'.repeat(64),planSha256:'c'.repeat(64),
    publicHandoff:{},bundleBytes:Buffer.from('unverified'),planBytes:Buffer.from('{}')};
  for(const change of [{runId:'40083992183'},{runId:'40086015008'},{caseId:'d001'},{caseId:'v2-d007'},
    {sourceSha:V2.appSourceSha},{runId:'0'},{}])assert.throws(()=>sealEvaluationInput({...base,...change}));
});
