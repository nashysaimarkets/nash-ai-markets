"use client";
/* Private original images intentionally bypass next/image. */
/* eslint-disable @next/next/no-img-element */
import {useEffect,useId,useRef,useState} from 'react';
import {effectiveLiquidityGeometry,type LiquidityGeometrySource} from './liquidity-guard';
import {canonicalizePocketGeometry} from '../lib/pocket-geometry';
import {evidencePriceRange} from './evidence-price';
import {chartGridRows} from './chart-grid-rows';
import {verifyOriginalAxis} from './browser-axis-ocr';
import type {AxisVerification} from './axis-verification';
import {preciseLiquidityZones} from './precise-liquidity';

type GuardAnalysis=LiquidityGeometrySource & {instrument?:string;timeframe:string;currentPrice?:string;evidenceQuality?:LiquidityGeometrySource['evidenceQuality'] & {instrumentConfidence?:string;timeframeConfidence?:string;scaleReadable?:boolean;limitations?:string[]};trustGate?:{identityLocked?:boolean;scaleLocked?:boolean}};
export default function LiquidityGuardOverlay({analysis,sourceImage,onRescan,rescanning=false,errorMessage=''}:{analysis:GuardAnalysis;sourceImage:string;onRescan?:()=>void;rescanning?:boolean;errorMessage?:string}){
 const headingId=useId(),detailId=useId();
 const imageRef=useRef<HTMLImageElement>(null);
 const [ready,setReady]=useState(0),[visible,setVisible]=useState(true),[selection,setSelection]=useState(0);
 const [measured,setMeasured]=useState<{key:string;width:number;height:number;axis:AxisVerification|null}|null>(null);
 const raw=effectiveLiquidityGeometry(analysis);
 const geometry=canonicalizePocketGeometry({plotBounds:raw.plotBounds,priceScaleAnchors:raw.priceScaleAnchors,liquidityShield:raw.liquidityShield}) as typeof raw;
 const key=JSON.stringify([sourceImage,geometry.plotBounds,geometry.priceScaleAnchors,analysis.instrument,analysis.timeframe,analysis.evidenceQuality,analysis.trustGate,raw.evidenceQuality]);
 const current=measured?.key===key?measured:null;
 const quality=analysis.evidenceQuality;
 const unsupported=(quality?.limitations??[]).some(t=>/\blog(?:arithmic)?\b|non[- ]linear/i.test(t));
 const identity=!unsupported&&quality?.instrumentConfidence==='HIGH'&&quality?.timeframeConfidence==='HIGH'&&analysis.trustGate?.identityLocked;
 const readable=raw.evidenceQuality?.chartReadability==='CLEAR'&&raw.evidenceQuality?.candlesReadable===true;
 const shield=geometry.liquidityShield;
 useEffect(()=>{
  const image=imageRef.current,bounds=geometry.plotBounds;
  if(!sourceImage||!image?.complete||!image.naturalWidth||!bounds)return;
  const controller=new AbortController(),base={key,width:image.naturalWidth,height:image.naturalHeight,axis:null};
  setMeasured(base);
  if(!identity||!readable){setMeasured({...base,axis:{status:'held',reason:'Chart identity or candle evidence needs verification.'}});return ()=>controller.abort();}
  if(shield?.status!=='VISIBLE_RISK_ZONES')return ()=>controller.abort();
  let rows:number[]=[];
  try{const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(ctx){ctx.drawImage(image,0,0);rows=chartGridRows(ctx.getImageData(0,0,base.width,base.height),bounds);}canvas.width=canvas.height=1;}catch{}
  void verifyOriginalAxis(image,bounds,rows,geometry.priceScaleAnchors??[],controller.signal).then(axis=>{if(!controller.signal.aborted)setMeasured({...base,axis});});
  return ()=>controller.abort();
 // key contains the complete source image, scale, identity and quality evidence.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[key,ready,shield?.status]);
 const result=preciseLiquidityZones(shield,analysis.currentPrice,geometry.priceScaleAnchors??[],geometry.plotBounds,current?.axis??null,current?.width??0,current?.height??0);
 const zones=identity&&readable?result.zones:[];
 const selected=zones[selection]??zones[0];
 const state=!shield?'unavailable':shield.status==='NO_VISIBLE_RISK_ZONES'&&identity&&readable?'verified-none':zones.length?'locked':(!current||current.axis===null)&&geometry.plotBounds&&identity&&readable&&shield.status==='VISIBLE_RISK_ZONES'?'checking':'withheld';
 const status=state==='locked'?`${zones.length} scale-checked ${zones.length===1?'area':'areas'} · ${current?.axis?.status==='verified'?current.axis.anchors.length:0} axis labels`:state==='checking'?'Verifying the original price labels…':state==='verified-none'?'NO CLEAR STOP-RISK CLUSTER':state==='unavailable'?'LIQUIDITY GUARD UNAVAILABLE':'OVERLAY WITHHELD';
 return <section className="psLiquidityGuard psLiquidityPrecise" data-status={state} aria-labelledby={headingId}>
  <header><div><span>LIQUIDITY GUARD</span><h2 id={headingId}>{analysis.instrument??'Source chart'} <b>{analysis.timeframe}</b></h2><small>Visually inferred stop-risk areas</small></div>{zones.length?<button type="button" aria-pressed={visible} onClick={()=>setVisible(v=>!v)}>{visible?'HIDE OVERLAY':'SHOW OVERLAY'}</button>:onRescan&&state!=='checking'&&state!=='verified-none'?<button type="button" onClick={onRescan} disabled={rescanning}>{rescanning?'REANALYSING…':'REANALYSE CHART'}</button>:null}</header>
  {errorMessage?<p className="psLiquidityError" role="alert">{errorMessage}</p>:null}
  <div className="psLiquidityStatus" role="status" aria-live="polite"><i data-ready={state==='locked'||state==='verified-none'}/><div><strong>{status}</strong>{state==='withheld'?<p>{!identity||!readable?'Chart identity or candle evidence needs verification.':result.reason}</p>:state==='unavailable'?<p>Your chart remains unchanged; retry when ready.</p>:state==='verified-none'?<p>Nothing has been added to your chart.</p>:null}</div><span>Original screenshot</span></div>
  <figure className="psLiquidityCanvas" style={current?{width:`min(100%, calc(65vh * ${current.width/current.height}), calc(760px * ${current.width/current.height}))`}:undefined}>
   <img ref={imageRef} src={sourceImage} alt={`${analysis.instrument??'Uploaded trading chart'} ${analysis.timeframe} original screenshot`} onLoad={()=>setReady(v=>v+1)}/>
   {visible&&zones.length?<svg className="psLiquidityVector" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Price-scale checked stop-risk bands">{zones.map((z,i)=><g key={`${z.pattern}-${z.priceLow}-${i}`} data-side={z.side} data-selected={selected===z}>
    {z.height>0?<rect x={z.left} y={z.top} width={z.right-z.left} height={z.height}/>:null}<line x1={z.left} x2={z.right} y1={z.lineY} y2={z.lineY} vectorEffect="non-scaling-stroke"/>
   </g>)}</svg>:null}
  </figure>
  {zones.length?<><nav className="psLiquidityChoices" aria-label="Inspect stop-risk areas">{zones.map((z,i)=><button key={`${z.pattern}-${i}`} type="button" data-side={z.side} aria-pressed={selected===z} aria-controls={detailId} onClick={()=>setSelection(i)}><span>{z.side==='ABOVE_PRICE'?'Above chart price':z.side==='BELOW_PRICE'?'Below chart price':'At chart price'}</span><strong>{evidencePriceRange(z.priceLow,z.priceHigh)}</strong><small>{z.label||z.pattern.replaceAll('_',' ')}</small></button>)}</nav><div id={detailId} className="psLiquidityDetail" aria-live="polite"><strong>{selected.label||selected.pattern.replaceAll('_',' ')}</strong><p>{selected.evidence}</p><small>{selected.touchPoints.length} reported touches · HIGH confidence in visual structure</small></div></>:null}
  <footer><p>Areas are inferred from visible candle structure. Scale checks verify placement; they do not verify resting orders or guarantee reversals.</p><small>Source screenshot only · not a live order book. Confirm on your original platform.</small></footer>
 </section>;
}
