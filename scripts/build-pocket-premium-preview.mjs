/** Reproducible local-only preview of the existing accepted component, no deploy. */
import {build} from 'esbuild';import {mkdir,writeFile} from 'node:fs/promises';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
export async function buildPremiumPreview({output='dist/premium-preview',source=process.env.GITHUB_SHA??process.env.PREVIEW_SOURCE_SHA,offline=true}={}){
 if(!/^[a-f0-9]{40}$/.test(source??''))throw Error('Exact reviewed source SHA required');
 const relevant=['app','scripts','tests','database','.github','package.json','package-lock.json'];
 execFileSync('git',['diff','--quiet','HEAD','--',...relevant]);
 if(execFileSync('git',['ls-files','--others','--exclude-standard','--',...relevant],{encoding:'utf8'}).trim())throw Error('Uncommitted preview source');
 const head=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const tree=execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim();
 if(source!==head){let sourceTree;try{sourceTree=execFileSync('git',['rev-parse',source+'^{tree}'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{sourceTree=process.env.PREVIEW_VERIFIED_SOURCE_TREE;}if(sourceTree!==tree)throw Error('Source SHA/tree binding required');}
 const bundle=await build({entryPoints:['tests/support/pocket-rc-browser.tsx'],bundle:true,write:false,outdir:'/tmp/premium-preview',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'empty'}});
 const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text,css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
 const gate=`window.fetch=async()=>new Response(JSON.stringify({error:'Offline preview: real account, broker and scanner services are disabled.'}),{status:503,headers:{'content-type':'application/json'}});`;
 const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; worker-src blob:; form-action 'none'; base-uri 'none'"><title>Pocket Bullseye — offline premium preview</title><style>${css.replaceAll('</style','<\\/style')}</style></head><body style="margin:0"><div role="note" style="background:#101b2b;color:white;padding:10px;font:14px system-ui">OFFLINE PREVIEW · synthetic interface demo only · services disabled · source ${source}</div><div id="root"></div><script>${offline?gate:''}\n${js.replaceAll('</script','<\\/script')}</script></body></html>`;
 await mkdir(output,{recursive:true});await writeFile(resolve(output,'index.html'),html);const manifest={source,tree,sha256:createHash('sha256').update(html).digest('hex'),deployment:'DISABLED',services:'OFFLINE_DISABLED',entry:'actual PocketNext and complete /pocket stylesheet stack'};await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2));return{js,css,manifest};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(await buildPremiumPreview().then(x=>x.manifest)));
