"use client";
/* Private originals remain local data URLs. */
/* eslint-disable @next/next/no-img-element */
import {useEffect,useRef,useState} from 'react';
import {pocketAuthenticatedFetch} from '../pocket/apple-storekit';
import ChartPreflightPanel from '../pocket/ChartPreflightPanel';
import OriginalChartEvidence from '../pocket/OriginalChartEvidence';
import {preflightAllowsAnalysis,type ChartConfirmation,type PreflightStatus} from '../pocket/chart-preflight';
import {createPrecisionReadingCrop} from '../pocket/precision-reading-crop';
import {listPocketDecisions,savePocketDecision,deletePocketDecision} from '../pocket/decision-vault';
import type {CompatibleLockedDecision} from '../pocket/decision-compatibility';
import {calculateUserPlan,exportPocketPlan,isCompanyCalendarEligible,type UserPlan,type WorkflowReport} from '../pocket/workflow-plan';
import type {VerifiedMacroContext} from '../lib/macro-data';
import {canOverlayLevelLab,type LevelLabSource} from '../pocket/level-lab-source';

type Reply={answer:string;evidence:string[];caution:string;nextCheck:string};
type Review={outcome:string;processGrade:string;decisionQuality:number;headline:string;outcomeSummary:string;confirmationReview:string;invalidationReview:string;timingReview:string;disciplineReview:string;lessons:string[]};
type LevelResult=LevelLabSource&{levelStory:string;limitation:string;confidence:string};
type CompanyEvent={id:string;type:string;date:string;detail:string;source:string};
export async function readWorkflowImage(file:File):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>8*1024*1024)throw new Error('Use a JPEG, PNG or WebP under 8 MB.');
 return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error('Chart could not be read.'));reader.onerror=()=>reject(new Error('Chart could not be read.'));reader.readAsDataURL(file);});
}
function date(value:string){const timestamp=Date.parse(value);return Number.isFinite(timestamp)?new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(timestamp):'Time unavailable';}
const EMPTY_PLAN:UserPlan={side:'LONG',entry:'',stop:'',target:''};
export default function PocketWorkflowDesk({report,image,intention,macroContext}:{report:WorkflowReport;image:string;intention:'LONG'|'SHORT'|'UNSURE';macroContext:VerifiedMacroContext}){
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [question,setQuestion]=useState(''),[reply,setReply]=useState<Reply|null>(null);
 const [history,setHistory]=useState<CompatibleLockedDecision[]>([]),[selected,setSelected]=useState<CompatibleLockedDecision|null>(null);
 const [after,setAfter]=useState<string|null>(null),[reviewPrivacy,setReviewPrivacy]=useState(false),[review,setReview]=useState<Review|null>(null);
 const [labImage,setLabImage]=useState<string|null>(null),[labStatus,setLabStatus]=useState<PreflightStatus>('IDLE'),[labFacts,setLabFacts]=useState<ChartConfirmation|null>(null),[labResult,setLabResult]=useState<LevelResult|null>(null);
 const [plan,setPlan]=useState<UserPlan>(EMPTY_PLAN);
 const [companyEvents,setCompanyEvents]=useState<CompanyEvent[]>([]),[companyChecked,setCompanyChecked]=useState(false);
 const generation=useRef(0),pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>{generation.current++;pending.current?.abort();},[]);
 const cancel=()=>{generation.current++;pending.current?.abort();pending.current=null;setBusy('');};
 const perform=async(route:string,body:unknown|(()=>Promise<unknown>),receive:(payload:Record<string,unknown>)=>void,method:'POST'|'GET'='POST')=>{
  if(pending.current)return;
  const token=generation.current,controller=new AbortController();pending.current=controller;setBusy(route);setError('');setNotice('');
  try{
   const payloadBody=typeof body==='function'?await body():body;
   if(token!==generation.current||controller.signal.aborted)return;
   const response=await pocketAuthenticatedFetch('/api/pocket/'+route,{method,headers:{'content-type':'application/json'},signal:controller.signal,...(method==='POST'?{body:JSON.stringify(payloadBody)}:{})});
   const payload=await response.json() as Record<string,unknown>;
   if(token!==generation.current||controller.signal.aborted)return;
   if(!response.ok)throw new Error(typeof payload.error==='string'?payload.error:'This request could not complete.');
   receive(payload);
  }catch(e){if(token===generation.current&&!controller.signal.aborted)setError(e instanceof Error?e.message:'This request could not complete.');}
  finally{if(pending.current===controller){pending.current=null;setBusy('');}}
 };
 const load=async(file:File|undefined,kind:'after'|'lab')=>{
  if(!file)return;cancel();const token=generation.current;
  if(kind==='after'){setAfter(null);setReview(null);setReviewPrivacy(false);}else{setLabImage(null);setLabResult(null);setLabStatus('IDLE');setLabFacts(null);}
  try{const value=await readWorkflowImage(file);if(token!==generation.current)return;if(kind==='after')setAfter(value);else setLabImage(value);}
  catch(e){if(token===generation.current)setError(e instanceof Error?e.message:'Image unavailable.');}
 };
 const refresh=async()=>{const token=generation.current;try{const values=await listPocketDecisions();if(token===generation.current){setHistory(values);setNotice(values.length?'Device history loaded.':'No saved decisions on this device.');}}catch{if(token===generation.current)setError('Device history is unavailable in this browser.');}};
 const save=async()=>{const token=generation.current;try{await savePocketDecision({id:crypto.randomUUID(),createdAt:new Date().toISOString(),image,intention,analysis:report});const values=await listPocketDecisions();if(token===generation.current){setNotice('Decision saved on this device.');setHistory(values);}}catch{if(token===generation.current)setError('Decision could not be saved on this device.');}};
 const remove=async(id:string)=>{const token=generation.current;try{await deletePocketDecision(id);if(token===generation.current){if(selected?.id===id){cancel();setSelected(null);setAfter(null);setReview(null);}setHistory(await listPocketDecisions());setNotice('Saved decision removed.');}}catch{if(token===generation.current)setError('Saved decision could not be removed.');}};
 const exportPlan=()=>{const file=new Blob([exportPocketPlan(report,plan)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download='pocket-bullseye-plan.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 const calculation=calculateUserPlan(plan);
 const scanLevels=async()=>{
  if(!labImage||!labFacts||!preflightAllowsAnalysis(labStatus)||pending.current)return;
  const source=labImage;setLabResult(null);
  await perform('levels',async()=>({image:source,precisionImage:await createPrecisionReadingCrop(source),chartConfirmation:labFacts}),payload=>{
   const result=payload.levels as LevelResult|undefined;
   if(!result||!Array.isArray(result.levels)||result.levels.some(level=>!level||typeof level.price!=='string'||typeof level.label!=='string'||typeof level.kind!=='string'))throw new Error('Level scan returned an invalid result.');
   setLabResult(result);
  });
 };
 return <section className="pnWorkflow" aria-label="Decision workflows">
  <header><h2>Your next steps</h2><p>{report.instrument} · {report.timeframe}</p><p>{report.verdictHeadline}</p><p>Keep the evidence, plan your own risk and review what happened.</p></header>
  {busy?<button type="button" onClick={cancel}>Cancel tool request</button>:null}
  {error?<p role="alert">{error}</p>:null}{notice?<p role="status">{notice}</p>:null}
  <details open><summary>Trading plan & export</summary>
   <p><strong>{report.verdict.replaceAll('_',' ')}</strong> · {report.summary}</p>
   <dl><dt>Confirmation</dt><dd>{report.nextSequence.confirmation}</dd><dt>Invalidation</dt><dd>{report.nextSequence.failure||report.invalidation}</dd><dt>Next check</dt><dd>{report.nextSequence.reassess}</dd></dl>
   <p>Optional prices below are yours. They do not change the scanner read.</p>
   <label>Plan side<select aria-label="Plan side" value={plan.side} onChange={e=>setPlan(p=>({...p,side:e.target.value as UserPlan['side']}))}><option>LONG</option><option>SHORT</option></select></label>
   {(['entry','stop','target'] as const).map(field=><label key={field}>{field.toUpperCase()}<input aria-label={'Your '+field+' price'} inputMode="decimal" value={plan[field]} onChange={e=>setPlan(p=>({...p,[field]:e.target.value}))}/></label>)}
   <p role="status">{calculation.valid?'Illustrative reward/risk '+calculation.ratio.toFixed(2):calculation.reason}</p>
   <button type="button" onClick={exportPlan}>Export plan</button><button type="button" onClick={()=>void save()}>Save decision on this device</button>
  </details>
  <details open><summary>Ask a follow-up</summary>
   <form onSubmit={e=>{e.preventDefault();if(!question.trim())return;setReply(null);void perform('follow-up',{analysis:report,question:question.trim()},payload=>{const result=payload.reply as Reply|undefined;if(!result||typeof result.answer!=='string'||!Array.isArray(result.evidence))throw new Error('Follow-up returned an invalid result.');setReply(result);});}}>
    <label>Your question<input aria-label="Ask a follow-up question" maxLength={180} value={question} onChange={e=>setQuestion(e.target.value)}/></label><button disabled={Boolean(busy)||!question.trim()}>Ask Bullseye</button>
   </form>
   {reply?<article aria-label="Follow-up answer"><p>{reply.answer}</p><ul>{reply.evidence.map((item,i)=><li key={i}>{item}</li>)}</ul><p>{reply.caution}</p><strong>{reply.nextCheck}</strong></article>:null}
  </details>
  <details open><summary>Decision history & process review</summary>
   <p>Saved screenshots and decisions stay on this device.</p><button type="button" onClick={()=>void refresh()}>Load saved decisions</button>
   <ul>{history.map(decision=><li key={decision.id}><strong>{decision.analysis.instrument}</strong> · {date(decision.createdAt)} · {decision.analysis.verdict}<button type="button" onClick={()=>{cancel();setSelected(decision);setAfter(null);setReview(null);setReviewPrivacy(false);}}>Review this decision</button><button type="button" onClick={()=>void remove(decision.id)}>Delete saved decision</button></li>)}</ul>
   {selected?<div><h3>Before: {selected.analysis.instrument}</h3><img src={selected.image} alt="Saved before chart"/><label>Add after chart<input aria-label="Add after chart for process review" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void load(e.target.files?.[0],'after')}/></label>
    {after?<img src={after} alt="After chart selected for process review"/>:null}
    <label><input type="checkbox" checked={reviewPrivacy} onChange={e=>setReviewPrivacy(e.target.checked)}/>I removed personal details from the after chart.</label>
    <button type="button" disabled={!after||!reviewPrivacy||Boolean(busy)} onClick={()=>{setReview(null);void perform('review',{beforeImage:selected.image,afterImage:after,lockedAnalysis:selected.analysis},payload=>{const result=payload.review as Review|undefined;if(!result||typeof result.headline!=='string'||!Array.isArray(result.lessons))throw new Error('Process review returned an invalid result.');setReview(result);});}}>Compare decision process</button>
    {review?<article aria-label="Process review result"><h3>{review.headline}</h3><p>Process {review.processGrade} · {review.decisionQuality}/100 · Outcome {review.outcome}</p><p>{review.outcomeSummary}</p><p>{review.confirmationReview}</p><p>{review.invalidationReview}</p><p>{review.timingReview}</p><p>{review.disciplineReview}</p><ul>{review.lessons.map((item,i)=><li key={i}>{item}</li>)}</ul></article>:null}
   </div>:null}
  </details>
  <details open><summary>Calendar & event risk</summary>
   <p>Official macro schedule · UK time · {macroContext.status} · checked {date(macroContext.generatedAt)}</p>
   {macroContext.releases.length?<ol>{macroContext.releases.slice(0,8).map(event=><li key={event.id}><time>{date(event.scheduledAt)}</time> · {event.name} · {event.agency} · {event.risk} impact{event.sourceUrl&&/^https:\/\//.test(event.sourceUrl)?<a href={event.sourceUrl} target="_blank" rel="noreferrer">Official source</a>:null}</li>)}</ol>:<p>No verified scheduled macro rows are available. An unavailable calendar does not mean no event risk.</p>}
   {isCompanyCalendarEligible(report)?<><button type="button" disabled={Boolean(busy)} onClick={()=>{setCompanyChecked(false);setCompanyEvents([]);void perform('events?symbol='+encodeURIComponent(report.ticker),null,payload=>{if(payload.symbol!==report.ticker||!Array.isArray(payload.events)||payload.events.some(event=>!event||typeof event!=='object'||typeof event.id!=='string'||typeof event.date!=='string'||typeof event.detail!=='string'||typeof event.source!=='string'||!['EARNINGS','DIVIDEND','SPLIT'].includes(event.type)))throw new Error('Company calendar returned an invalid or mismatched result.');setCompanyEvents(payload.events as CompanyEvent[]);setCompanyChecked(true);},'GET');}}>Check {report.ticker} company events</button>{companyEvents.length?<ul>{companyEvents.map(event=><li key={event.id}>{event.date} · {event.type} · {event.detail} · {event.source} · SYMBOL MATCHED</li>)}</ul>:companyChecked?<p>No symbol-matched company event was returned in the connected feed window.</p>:null}</>:<p>Company events require a confidently identified listed company; this panel supplies macro timing only.</p>}
  </details>
  <details open><summary>Standalone Level Lab</summary>
   <p>Scan another source image for levels. Results stay separate from your main chart and report.</p>
   <label>Level Lab chart<input aria-label="Add separate chart for Level Lab" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void load(e.target.files?.[0],'lab')}/></label>
   {labImage?<><ChartPreflightPanel image={labImage} onStatus={status=>{if(!preflightAllowsAnalysis(status))cancel();setLabStatus(status);}} onConfirmation={setLabFacts}/><button type="button" disabled={!labFacts||!preflightAllowsAnalysis(labStatus)||Boolean(busy)} onClick={()=>void scanLevels()}>Scan this chart for levels</button><OriginalChartEvidence image={labImage} report={labResult&&canOverlayLevelLab(labResult,labFacts)?labResult:null} identityConfirmed={preflightAllowsAnalysis(labStatus)&&Boolean(labFacts)}/></>:null}
   {labResult?<article aria-label="Separate Level Lab result"><p>{labResult.levelStory}</p><p>{labResult.confidence} reported confidence · {labResult.limitation}</p><ul>{labResult.levels.map((level,i)=><li key={i}>{level.kind} · {level.price||'No numeric price'} · {level.label}</li>)}</ul><p>{canOverlayLevelLab(labResult,labFacts)?'Source facts match. Original-image overlay still requires independent price-label and grid verification.':'Source identity or exact price agreement remains unverified; original-image placement is held.'}</p></article>:null}
  </details>
 </section>;
}
