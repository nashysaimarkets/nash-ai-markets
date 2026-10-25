'use client';
import {useEffect, useMemo, useState} from 'react';
import IgDemoPositionPanel from './IgDemoPositionPanel';
import {createIgDemoWorkspace, type IgDemoWorkspaceState} from '../lib/ig-demo-workspace';

import {sendIgDemoAction} from '../lib/ig-demo-client';

/** Host must supply a server-reviewed availability flag; opting in cannot enable the backend. */
export default function IgDemoWorkspace({available=false, disconnectAvailable=false, contextKey, ownerScope, chartToken}:{available?:boolean;disconnectAvailable?:boolean;contextKey:string;ownerScope?:string;chartToken?:string}) {
  if((!available&&!disconnectAvailable) || !ownerScope) return null;
  return <IgDemoWorkspaceSession key={`${ownerScope}:${contextKey}:${chartToken??""}:${available}`} chartToken={chartToken} readAvailable={available}/>;
}
function IgDemoWorkspaceSession({chartToken,readAvailable}:{chartToken?:string;readAvailable:boolean}) {
  const [optedIn,setOptedIn] = useState(false);
  const [state,setState] = useState<IgDemoWorkspaceState>({snapshot:null,busy:false});
  const controller=useMemo(()=>createIgDemoWorkspace((action,signal)=>{
    if(!readAvailable&&action!=='disconnect')return Promise.reject(Error('IG_DEMO_UNAVAILABLE'));
    return sendIgDemoAction(action,signal,chartToken);
  },setState),[chartToken,readAvailable]);
  useEffect(()=>{ controller.reset(); return ()=>controller.reset(); },[controller]);
  useEffect(()=>{
    const hide=()=>controller.reset();
    window.addEventListener('pagehide',hide);
    return ()=>window.removeEventListener('pagehide',hide);
  },[controller]);
  if(!readAvailable)return <section className="pnIgDemo" aria-label="Revoke saved IG DEMO access">
    <p>You can revoke saved IG DEMO access for this account. This does not indicate an active broker connection.</p>
    <button type="button" disabled={state.busy} onClick={()=>void controller.run('disconnect')}>Revoke saved IG DEMO access</button>
    {state.busy&&<button type="button" onClick={()=>controller.cancel()}>Cancel revocation request</button>}
    <p role="status" aria-live="polite">{state.busy?'Revoking saved access…':state.logout?
      state.logout==='CONFIRMED'?'Saved DEMO access revoked.':'Saved DEMO access revoked; IG logout was not confirmed.':
      state.message==='CANCELLED'?'Request cancelled. Revocation was not confirmed.':state.message?'Revocation could not be confirmed.':''}</p>
  </section>;
  return <div className="pnIgDemo">
    <label><input type="checkbox" checked={optedIn} onChange={e=>{setOptedIn(e.target.checked); if(!e.target.checked) void controller.run('disconnect');}}/> Enable this session’s IG DEMO view</label>
    <p>Use your existing securely configured DEMO account. Never enter broker passwords here.</p>
    <IgDemoPositionPanel enabled={optedIn} snapshot={state.snapshot} busy={state.busy} message={state.message} onConnect={()=>void controller.run('connect')} onRefresh={()=>void controller.run('refresh')} onDisconnect={()=>void controller.run('disconnect')}/>
    {state.busy && <button type="button" onClick={()=>controller.cancel()}>Cancel DEMO request</button>}
    {optedIn && !state.snapshot && <button type="button" onClick={()=>void controller.run('disconnect')}>Disconnect DEMO session</button>}
    {state.logout && <p role="status">{state.logout==='CONFIRMED'?'DEMO disconnected.':'Local access revoked; IG logout was not confirmed.'}</p>}
  </div>;
}
