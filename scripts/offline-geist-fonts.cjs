// Next's documented local response adapter; serves genuine pinned cached font bytes.
// Explicit opt-in: NEXT_FONT_GOOGLE_MOCKED_RESPONSES=$PWD/scripts/offline-geist-fonts.cjs
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../qa/offline-fonts');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
for(const [name,pin] of Object.entries(manifest)){
 const bytes=fs.readFileSync(path.join(root,name));
 if(crypto.createHash('sha256').update(bytes).digest('hex')!==pin.sha256)throw Error('Offline font integrity failure: '+name);
}
module.exports=new Proxy({}, {get(_,url){
 const u=new URL(url);if(u.origin!=='https://fonts.googleapis.com')throw Error('Unexpected font origin');
 const family=u.searchParams.get('family');
 const dir=family==='Geist:wght@100..900'?'geist-8ac0455e797f':family==='Geist Mono:wght@100..900'?'geist-mono-00e989178794':null;
 if(!dir)throw Error('Unexpected offline font request');
 return fs.readFileSync(path.join(root,dir,'style.css'),'utf8').replace(/url\(([^/()]+\.woff2)\)/g,(_,file)=>{
  const relative=dir+'/'+file;if(!manifest[relative])throw Error('Unpinned font');return 'url('+path.join(root,relative)+')';
 });
}});
