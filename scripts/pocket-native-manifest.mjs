/** Pure bounded verifier; transport injected for offline checks. No calls on import. */
export async function verifyPocketNativeManifest(rawUrl, revision, {transport=fetch,timeoutMs=10000,maxBytes=16384,requireReadiness=false}={}) {
  if(!/^[a-f0-9]{40}$/i.test(revision))throw new Error('INVALID_REVISION');
  const url=new URL(rawUrl);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname.replace(/\/$/,'')!=='/pocket'||url.hostname==='pocket.nashaimarkets.com'||url.hostname.includes('-git-'))throw new Error('INVALID_PREVIEW_URL');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000||!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>16384)throw new Error('INVALID_BOUNDS');
  const controller=new AbortController();let timer;let reader;
  const stopped=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('MANIFEST_TIMEOUT'));},timeoutMs);});
  try {
    const pending=transport(new URL(requireReadiness ? '/api/pocket/native-readiness' : '/api/pocket/build-manifest',url.origin),{headers:{accept:'application/json'},redirect:'error',signal:controller.signal});
    pending.then(r=>{if(controller.signal.aborted)void r.body?.cancel().catch(()=>{});},()=>{});
    const response=await Promise.race([pending,stopped]);
    if(!response.ok){void response.body?.cancel().catch(()=>{});throw new Error('MANIFEST_HTTP_ERROR');}
    reader=response.body?.getReader();if(!reader)throw new Error('MANIFEST_EMPTY');
    let bytes=0;let text='';const decoder=new TextDecoder('utf-8',{fatal:true});
    while(true){const part=await Promise.race([reader.read(),stopped]);if(part.done)break;bytes+=part.value.byteLength;if(bytes>maxBytes)throw new Error('MANIFEST_TOO_LARGE');text+=decoder.decode(part.value,{stream:true});}
    text+=decoder.decode();const payload=JSON.parse(text);
    if(payload?.revision!==revision)throw new Error('MANIFEST_REVISION_MISMATCH');
    if(requireReadiness && (payload.ready!==true || payload.deviceAcceptance!==false ||
      !['appleConfiguration','webLedger','legacyOwnership','ownedTransactions'].every(key=>payload.checks?.[key]===true)))throw new Error('NATIVE_RUNTIME_NOT_READY');
    return {revision,origin:url.origin};
  } finally {clearTimeout(timer);controller.abort();if(reader){void reader.cancel().catch(()=>{});reader.releaseLock();}}
}
