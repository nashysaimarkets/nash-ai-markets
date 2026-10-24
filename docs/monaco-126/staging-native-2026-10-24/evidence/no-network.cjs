const http=require('node:http'),https=require('node:https');
const deny=()=>{throw new Error('Offline build: external network disabled');};
globalThis.fetch=async()=>{throw new Error('Offline build: fetch disabled');};
https.request=deny;https.get=deny;
for(const k of ['request','get']){const original=http[k];http[k]=function(...args){const a=args[0],host=typeof a==='string'?new URL(a).hostname:a instanceof URL?a.hostname:a?.hostname??a?.host;if(host&&!['localhost','127.0.0.1','::1'].includes(host))return deny();return original.apply(this,args);};}
