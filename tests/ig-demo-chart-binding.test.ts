import test from 'node:test';import assert from 'node:assert/strict';
import {igDemoChartToken} from '../app/lib/ig-demo-chart-binding.ts';
const binding={ownerScope:'owner',contextKey:'source:revision:confirmed',token:'opaque-server-reference',expiresAt:100};
test('premium chart reference forwards only exact owner and source context',()=>{assert.equal(igDemoChartToken(binding,'owner',binding.contextKey,50),binding.token);});
test('replaced chart, changed confirmation or different owner drops reference',()=>{for(const [owner,context] of [['other',binding.contextKey],['owner','new-source'],[undefined,binding.contextKey]])assert.equal(igDemoChartToken(binding,owner,context!,50),undefined);});
test('screenshots do not create provenance and expired/malformed references hold',()=>{assert.equal(igDemoChartToken(undefined,'owner',binding.contextKey,50),undefined);for(const patch of [{expiresAt:50},{expiresAt:NaN},{token:'../bad'},{token:''}])assert.equal(igDemoChartToken({...binding,...patch},'owner',binding.contextKey,50),undefined);});
