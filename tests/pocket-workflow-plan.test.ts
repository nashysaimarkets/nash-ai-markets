import assert from 'node:assert/strict';import test from 'node:test';
import {calculateUserPlan,isCompanyCalendarEligible,exportPocketPlan,type WorkflowReport} from '../app/pocket/workflow-plan.ts';
const report:WorkflowReport={instrument:'Apple',ticker:'AAPL',timeframe:'1h',verdict:'WAIT',summary:'Source read',verdictHeadline:'Wait',setupScore:{overall:60,grade:'C'},riskFlags:[],nextSequence:{confirmation:'Visible break',failure:'Visible failure',reassess:'Next bar'},invalidation:'Failure',evidenceQuality:{instrumentConfidence:'HIGH'}};
test('user prices require valid direction and exact correctly ordered positive values',()=>{
 assert.equal(calculateUserPlan({side:'LONG',entry:'100',stop:'95',target:'110'}).ratio,2);
 assert.equal(calculateUserPlan({side:'SHORT',entry:'100',stop:'105',target:'90'}).ratio,2);
 for(const plan of [{side:'LONG' as const,entry:'100',stop:'100',target:'110'},{side:'LONG' as const,entry:'100-ish',stop:'95',target:'110'},{side:'SHORT' as const,entry:'100',stop:'95',target:'90'}])assert.equal(calculateUserPlan(plan).valid,false);
});
test('company event eligibility rejects indices, uncertain identity and malformed ticker',()=>{
 assert.equal(isCompanyCalendarEligible(report),true);
 for(const change of [{ticker:'UNKNOWN'},{ticker:'SPX',instrument:'US 500 DFB'},{ticker:'QQQ'},{instrument:'Bitcoin'},{evidenceQuality:{instrumentConfidence:'MEDIUM'}},{ticker:'AAPL?other=1'}])assert.equal(isCompanyCalendarEligible({...report,...change}),false);
});
test('export distinguishes user-defined prices from source evidence and omits invalid price plans',()=>{
 const plan={side:'LONG' as const,entry:'100',stop:'95',target:'110'};
 const valid=exportPocketPlan(report,plan);assert.match(valid,/USER-DEFINED LONG PLAN/);assert.match(valid,/CONFIRMATION: Visible break/);
 const invalid=exportPocketPlan(report,{...plan,stop:'120'});assert.doesNotMatch(invalid,/USER-DEFINED LONG PLAN|entry 100/);assert.match(invalid,/No validated user-defined price plan/);
});
