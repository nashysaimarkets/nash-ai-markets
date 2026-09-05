import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { measureChartPixels as after } from '../../app/pocket/browser-chart-extractor.ts';

type Source = { file: string; volumeProfile: boolean; excludeFromAccuracy?: boolean };
type Row = {
 file: string;
 variant: string;
 version: 'before' | 'after';
 expected: boolean;
 detected: boolean;
 confidenceValid: boolean;
 durationMs: number;
};

if (!process.argv[2] || !process.argv[3]) throw new Error('Pass the public fixture directory and baseline extractor file.');
const { measureChartPixels: before } = await import(pathToFileURL(resolve(process.argv[3])).href) as { measureChartPixels: typeof after };
const sources = (JSON.parse(await readFile(new URL('../../prototype/chart-extraction/cross-platform-sources.json', import.meta.url), 'utf8')) as Source[]).filter(x => !x.excludeFromAccuracy);
const engines = [['before', before], ['after', after]] as const;
const rows: Row[] = [];
for(const source of sources){
 const original=await readFile(resolve(process.argv[2],source.file));
 for(const variant of ['original','jpeg85','720px']){
  const bytes=variant==='jpeg85'?await sharp(original).jpeg({quality:85}).toBuffer():original;
  const metadata=await sharp(bytes).metadata(); const limit=variant==='720px'?720:900;
  const sourceWidth = metadata.width ?? 1, sourceHeight = metadata.height ?? 1;
  const width=Math.round(sourceWidth*Math.min(1,limit/Math.max(sourceWidth,sourceHeight)));
  const {data,info}=await sharp(bytes).resize({width}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const image={data:new Uint8ClampedArray(data),width:info.width,height:info.height};
  for(const [version,engine] of engines){
   const start=performance.now();const result=engine(image,'INDICATOR_VOLUME');const durationMs=performance.now()-start;
   rows.push({file:source.file,variant,version,expected:source.volumeProfile,detected:result.volumeProfile.status==='visible',confidenceValid:result.volumeProfile.confidence>=0&&result.volumeProfile.confidence<=1,durationMs});
  }
 }
}
console.log(JSON.stringify({note:'Robustness variants of the same public sample; not an independent labelled AI benchmark.',summary:['before','after'].map(version=>{const r=rows.filter(x=>x.version===version);return {version,truePositives:r.filter(x=>x.expected&&x.detected).length,positives:r.filter(x=>x.expected).length,falsePositives:r.filter(x=>!x.expected&&x.detected).length,negatives:r.filter(x=>!x.expected).length,invalidConfidences:r.filter(x=>!x.confidenceValid).length,medianMs:r.map(x=>x.durationMs).sort((a,b)=>a-b)[Math.floor(r.length/2)]};}),rows},null,2));
