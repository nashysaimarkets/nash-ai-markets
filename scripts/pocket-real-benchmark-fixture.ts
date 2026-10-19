/** Pinned real-market chart pack guard. No network, billing or provider calls. */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';

export const REAL_CASES = Object.freeze({
  'range-clear-01':['eab89b05051a24f9f4721d25634223ab2f1dd2b9fba6c1c1764d707d1ced2beb','55f965d8b8f38f10cf5fd336601c1a3ab3f7750cc2fbe0d3f4b7f18ae93c2bf9'],
  'double-top-01':['1981b9c89e5e11d4e8011f9149457360d7e27137c5c7ab666384e7485ae37871','2ac8933cc0592bcc7243e7c98a3ecea731045c10ca0ed2bbe2f9427e3289d7ea'],
  'head-shoulders-01':['4d29ac52ab63330f4caff56150dcd76ab55b46f626f5e2a183201ca8ecdc03ce','8003d0ba17370d732fe9b94bd903631b6bbe553650991bd8973722c2b6632ffc'],
  'sweep-reclaim-01':['2899b7041500bb28ae50c736c93cb9010cdabb7131b450793882ff18cb56acaa','16f8792d03eb36473922edc105554c45f86e6cad0f84c410e2d34872103ff046'],
  'near-miss-chop-01':['3afd7f24a98319c6020e8249ec6f6872817ed3019915b5dee899387867f7fea8','1aef76d84be06ce5d3d5ddc5ecccf90571c09653315e60e68a3f1858215705b8'],
  'degraded-no-signal-01':['4b65d87a2ba2ce2db3fdb633f84e29157478b3aeaf3f88d5f24242971f9393cf','3bb6233e398898b61f8abbc3ad98a4e08f60b72875d1e60a04f55238881528fb'],
});
export type RealCaseId = keyof typeof REAL_CASES;
const digest=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export function caseId(v:unknown):RealCaseId {
 if(typeof v!=='string'||!Object.prototype.hasOwnProperty.call(REAL_CASES,v))throw Error('Select exactly ONE pinned real-image case.');
 return v as RealCaseId;
}
function bytes(v:unknown,format:'png'|'jpeg') {
 if(typeof v!=='string')throw Error('Missing image data.');
 const match= new RegExp('^data:image/'+format+';base64,([a-zA-Z0-9+/]+={0,2})$').exec(v);
 if(!match || match[1]!.length%4)throw Error('Invalid encoded image.');
 const b=Buffer.from(match[1]!,'base64');
 if(!b.length||b.toString('base64')!==match[1])throw Error('Invalid base64.');
 return b;
}
function dimensionsJpeg(b:Buffer) {
 if(b[0]!==255||b[1]!==216)throw Error('Invalid JPEG.');
 let i=2;
 while(i<b.length){
  if(b[i++]!==255)throw Error('Invalid JPEG segment.');
  while(b[i]===255)i++;
  const marker=b[i++];
  if(marker===217||marker===218)break;
  if(marker===216||marker===1||(marker!==undefined&&marker>=208&&marker<=215))continue;
  if(i+2>b.length)break;
  const n=b.readUInt16BE(i);
  if(n<2||i+n>b.length)throw Error('Invalid JPEG length.');
  if(marker!==undefined&&[192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)){
   return [b.readUInt16BE(i+5),b.readUInt16BE(i+3)];
  }
  i+=n;
 }
 throw Error('Cannot verify precision JPEG dimensions.');
}
export function verifyPackedCase(id:RealCaseId,raw:Buffer,sourcePrice:string,timeframe:string){
 if(digest(raw)!==REAL_CASES[id][1])throw Error('Original scanner input hash mismatch.');
 const value:unknown=JSON.parse(raw.toString('utf8'));
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Malformed scanner payload.');
 const input=value as Record<string,unknown>, c=input.chartConfirmation;
 if(Object.keys(input).sort().join(',')!=='chartConfirmation,image,intention,precisionImage'
  ||!c||typeof c!=='object'||Array.isArray(c))throw Error('Unapproved scanner payload.');
 const facts=c as Record<string,unknown>;
 if(Object.keys(facts).sort().join(',')!=='contextMatch,currentPrice,instrument,timeframe'
  ||input.intention!=='UNSURE'||facts.instrument!=='SPX500 (GetData)'
  ||facts.currentPrice!==sourcePrice||facts.timeframe!==timeframe
  ||facts.contextMatch!=='NOT_PROVIDED')throw Error('Unapproved original chart facts.');
 const png=bytes(input.image,'png');
 if(png.length<33||!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||png.toString('ascii',12,16)!=='IHDR'
  ||png.readUInt32BE(16)!==1400||png.readUInt32BE(20)!==850
  ||digest(png)!==REAL_CASES[id][0])throw Error('Original PNG hash/dimensions mismatch.');
 const jpeg=bytes(input.precisionImage,'jpeg');
 const [w,h]=dimensionsJpeg(jpeg);
 if(w!==1400||h!==697)throw Error('Precision crop dimensions mismatch.');
 return {id,originalSha256:REAL_CASES[id][0],inputSha256:REAL_CASES[id][1],input};
}
export async function loadRealCase(dir:string,id:RealCaseId){
 if(!dir?.trim())throw Error('External POCKET_REAL_CORPUS_DIRECTORY must be provided.');
 const root=resolve(dir);
 const pack=JSON.parse(await readFile(join(root,'DISPATCH-SAFETY-MANIFEST.json'),'utf8')) as Record<string,unknown>;
 if(pack.status!=='OFFLINE_INPUTS_PREPARED_PROVIDER_NOT_CALLED'||pack.case_count!==6||pack.actual_provider_scans!==0||!Array.isArray(pack.cases)||pack.cases.length!==6)throw Error('Unverified six-case pack.');
 const c=pack.cases.find((x:unknown)=>x&&typeof x==='object'&&(x as {case_id?:unknown}).case_id===id) as Record<string,unknown>|undefined;
 if(!c||c.original_png_sha256!==REAL_CASES[id][0]||c.input_sha256!==REAL_CASES[id][1]
  ||c.input_file!==id+'.scan-input.json'||typeof c.timeframe!=='string'||typeof c.current_price!=='string')throw Error('Unverified case manifest.');
 const file=await readFile(join(root,id+'.scan-input.json'));
 return verifyPackedCase(id,file,c.current_price,c.timeframe);
}
function price(v:unknown):number|null {
 if(typeof v==='number')return Number.isFinite(v)?v:null;
 if(typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v.trim()))return Number(v);
 return null;
}
function px(v:unknown,span:number) {
 return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100?Math.round(v*span*10)/1000:null;
}
/** Produces independent-score.py observation shape in ORIGINAL IMAGE pixels. */
export function realObservation(id:RealCaseId,data:unknown,latencyMs:number){
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('Unmeasurable scanner response.');
 const a=data as Record<string,unknown>;
 if(!Array.isArray(a.levels)||!Array.isArray(a.patterns)||!a.liquidity||typeof a.liquidity!=='object'||Array.isArray(a.liquidity)||!Array.isArray((a.liquidity as {zones?:unknown}).zones))throw Error('Missing scanners: not a measured NO SIGNAL.');
 const liq=a.liquidity as {event?:unknown;zones:unknown[]};
 const levels=a.levels.map((v:unknown)=>{
  const l=v as Record<string,unknown>, y=px(l?.y,850),p=price(l?.price);
  if(!l||typeof l.kind!=='string'||p===null||y===null)throw Error('Invalid level evidence.');
  return {kind:l.kind,price:p,y_px:y};
 });
 const patterns=a.patterns.map((v:unknown)=>{
  const p=v as {name?:unknown;status?:unknown;geometry?:{points?:unknown}};
  if(!p||typeof p.name!=='string'||!Array.isArray(p.geometry?.points))throw Error('Invalid pattern evidence.');
  return {name:p.name,confirmed:p.status==='CONFIRMED',geometry:(p.geometry.points as unknown[]).map(x=>{
   const pt=x as {x?:unknown;y?:unknown},x_px=px(pt?.x,1400),y_px=px(pt?.y,850);
   if(x_px===null||y_px===null)throw Error('Invalid pattern pivots.');
   return {x_px,y_px};
  })};
 });
 const liquidity_zones=liq.zones.map((v:unknown)=>{
  const z=v as Record<string,unknown>,lo=price(z?.priceLow),hi=price(z?.priceHigh),x=px(z?.x,1400),x2=px(z?.x2,1400);
  if(!z||typeof z.side!=='string'||typeof z.basis!=='string'||lo===null||hi===null||lo>hi||x===null||x2===null||x>=x2)throw Error('Invalid liquidity evidence.');
  return {side:z.side,basis:z.basis,price_interval:[lo,hi],x_px:x,x2_px:x2,event:liq.event};
 });
 return {id,image_sha256:REAL_CASES[id][0],status:'completed',scored:true,levels,patterns,liquidity_zones,latency_ms:latencyMs};
}