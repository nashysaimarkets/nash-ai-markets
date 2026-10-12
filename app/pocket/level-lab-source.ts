import {exactAxisPrice} from './axis-verification.ts';
import type {ChartConfirmation} from './chart-preflight';
import type {OriginalLevelReport} from './original-pixel-levels';
export function validateLevelLabConfirmation(value:unknown):ChartConfirmation|null{
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const r=value as Record<string,unknown>;
 const instrument=typeof r.instrument==='string'?r.instrument.trim():'';
 const timeframe=typeof r.timeframe==='string'?r.timeframe.trim():'';
 const currentPrice=typeof r.currentPrice==='string'?r.currentPrice.trim():'';
 if(instrument.length<2||instrument.length>40||!timeframe||timeframe.length>30||exactAxisPrice(currentPrice)===null||r.contextMatch!=='NOT_PROVIDED')return null;
 return {instrument,timeframe,currentPrice,contextMatch:'NOT_PROVIDED'};
}
export type LevelLabSource=OriginalLevelReport&{instrument?:string;timeframe?:string;currentPrice?:string};
/** This qualifies the image-bound source only. OriginalChartEvidence must still
 * independently read three prices/grid rows and enforce the unchanged pixel fit. */
export function canOverlayLevelLab(report:LevelLabSource,confirmation:ChartConfirmation|null){
 const facts=validateLevelLabConfirmation(confirmation);if(!facts)return false;
 const q=report.evidenceQuality;
 const name=(s:string|undefined)=>(s??'').trim().toUpperCase().replace(/\s+/g,'');
 const frame=(s:string|undefined)=>name(s).replace(/MIN(?:UTE)?S?/g,'M').replace(/HOUR(?:S)?/g,'H');
 const price=exactAxisPrice(report.currentPrice??''),confirmed=exactAxisPrice(facts.currentPrice)!;
 return Boolean(q&&q.chartReadability==='CLEAR'&&q.scaleReadable===true&&q.candlesReadable===true&&q.instrumentConfidence==='HIGH'&&q.timeframeConfidence==='HIGH'
  &&name(report.instrument)===name(facts.instrument)&&frame(report.timeframe)===frame(facts.timeframe)
  &&price!==null&&Math.abs(price-confirmed)<=Math.max(1e-10,confirmed*1e-10));
}
