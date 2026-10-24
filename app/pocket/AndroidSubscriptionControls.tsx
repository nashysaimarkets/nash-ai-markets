'use client';
import {useEffect,useRef,useState} from 'react';
import {restorePlaySubscription} from './play-billing';
export default function AndroidSubscriptionControls(){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('Restore an existing Google Play purchase to check this Pocket account.');
 const pending=useRef<AbortController|null>(null);
 const cancel=()=>{pending.current?.abort();pending.current=null;setBusy(false);setMessage('Check cancelled. Access remains unverified.');};
 useEffect(()=>{const hide=()=>{pending.current?.abort();pending.current=null;setBusy(false);setMessage('Return and restore to verify current access.');};window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',hide);return()=>{pending.current?.abort();pending.current=null;window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',hide);};},[]);
 const restore=async()=>{if(pending.current)return;const controller=new AbortController();pending.current=controller;setBusy(true);try{const response=await restorePlaySubscription(controller.signal),body=await response.json();if(pending.current===controller)setMessage(body.entitled===true?'Google Play access verified for this request. Every scan checks again.':'HOLD — account ownership or current subscription could not be verified. Contact support before purchasing again.');}catch{if(pending.current===controller)setMessage('HOLD — restore verification unavailable. Retry or contact support before purchasing again.');}finally{if(pending.current===controller){pending.current=null;setBusy(false);}}};
 return <section className="psPreflight" aria-label="Google Play subscription access" aria-busy={busy}><strong>Google Play subscription</strong><p role="status">{message}</p><a href="/pocket/login">Sign in</a><p>New purchases remain unavailable until signed-device billing acceptance.</p><button disabled={busy} onClick={()=>void restore()}>Restore Google Play purchase</button>{busy&&<button onClick={cancel}>Cancel check</button>}</section>;
}
