import { POCKET_PRODUCT } from "../lib/product-brand.ts";
import {exactAxisPrice} from './axis-verification.ts';
export type UserPlan={side:'LONG'|'SHORT';entry:string;stop:string;target:string};
export function calculateUserPlan(input:UserPlan){
 if(!['LONG','SHORT'].includes(input.side))return {valid:false as const,reason:'Choose a plan side.',risk:null,reward:null,ratio:null};
 const entry=exactAxisPrice(input.entry),stop=exactAxisPrice(input.stop),target=exactAxisPrice(input.target);
 if(entry===null||stop===null||target===null)return {valid:false as const,reason:'Enter three exact positive prices.',risk:null,reward:null,ratio:null};
 const risk=input.side==='LONG'?entry-stop:stop-entry;
 const reward=input.side==='LONG'?target-entry:entry-target;
 if(risk<=0||reward<=0||![risk,reward,reward/risk].every(Number.isFinite))return {valid:false as const,reason:'The stop and target must be on the correct sides of your entry.',risk:null,reward:null,ratio:null};
 return {valid:true as const,reason:null,risk,reward,ratio:reward/risk};
}
export type WorkflowReport={instrument:string;timeframe:string;ticker:string;verdict:string;summary:string;verdictHeadline:string;setupScore:{overall:number;grade:string};riskFlags:string[];nextSequence:{confirmation:string;failure:string;reassess:string};invalidation:string;evidenceQuality?:{instrumentConfidence:string}};
export function isCompanyCalendarEligible(report:WorkflowReport){
 return report.evidenceQuality?.instrumentConfidence==='HIGH'&&/^[A-Z][A-Z0-9.-]{0,14}$/.test(report.ticker)&&!['UNKNOWN','SPX','SPY','QQQ','DIA','IWM','VIX'].includes(report.ticker)&&!/(INDEX|DFB|FUTURE|FOREX|FX\b|CRYPTO|BITCOIN|COMMODIT|BOND|YIELD|VIX|ETF|S&P|US\s?500|NASDAQ|DOW)/i.test(report.instrument);
}
export function exportPocketPlan(report:WorkflowReport,plan:UserPlan){
 const calculation=calculateUserPlan(plan);
 return ['UNVERIFIED MODEL ANALYSIS — verify reported prices and trading conclusions independently.',POCKET_PRODUCT.displayName+' · '+report.instrument+' · '+report.timeframe,'REPORT: '+report.verdict+' · '+report.setupScore.grade+' ('+report.setupScore.overall+'/100)',report.verdictHeadline,
  'CONFIRMATION: '+report.nextSequence.confirmation,'INVALIDATION: '+(report.nextSequence.failure||report.invalidation),'NEXT CHECK: '+report.nextSequence.reassess,
  ...(calculation.valid?['USER-DEFINED '+plan.side+' PLAN: entry '+plan.entry+' / stop '+plan.stop+' / target '+plan.target,'Illustrative reward/risk: '+calculation.ratio.toFixed(2)]:['No validated user-defined price plan.']),
  'Screenshot-based second opinion. Verify prices and execution on your broker.'].join('\n');
}
