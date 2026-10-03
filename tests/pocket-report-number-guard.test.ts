import test from 'node:test';import assert from 'node:assert/strict';
import {createReportNumberGuard} from '../app/api/pocket/report-number-guard';
import {runPocketReport} from '../app/api/pocket/report-recovery';
import {PocketReportCompletionError} from '../app/api/pocket/report-completion';
test('runaway decimal output is rejected across arbitrary stream boundaries',()=>{
 const json='{"price":0.'+'1'.repeat(2048)+'}';
 for(const chunkSize of [1,17,3000]){const guard=createReportNumberGuard();let accepted=true;for(let i=0;i<json.length;i+=chunkSize)if(!guard(json.slice(i,i+chunkSize))){accepted=false;break;}assert.equal(accepted,false);assert.equal(guard('}'),false);}
});
test('quoted numeric evidence and escaped quotes do not trip the numeric guard',()=>{
 const guard=createReportNumberGuard();const json=JSON.stringify({evidence:'A quote "'+ '1'.repeat(3000)+'" and a backslash \\',price:7723.23});
 for(const char of json)assert.equal(guard(char),true);
});
test('finite numeric extrema, scientific notation and ordinary geometry stay intact',()=>{
 const values=[Number.MAX_VALUE,Number.MIN_VALUE,-100,0,1.225];
 const text=JSON.stringify({values,precision:0.1234567890123456789})+' '.repeat(3000);
 assert.equal(createReportNumberGuard()(text),true);
 assert.equal(createReportNumberGuard()('{"price":0.'+'0'.repeat(323)+'5}'),true);
});
test('numeric resource failures receive one bounded recovery and never become a partial result',async()=>{
 let calls=0;
 await assert.rejects(runPocketReport(async()=>{calls++;throw new PocketReportCompletionError('numeric_output_limit',2048);},{signal:new AbortController().signal,deadlineAt:Date.now()+5000,attemptTimeoutMs:200,recoveryTimeoutMs:200}),PocketReportCompletionError);
 assert.equal(calls,2);
});
