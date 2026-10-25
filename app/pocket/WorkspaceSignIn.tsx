"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { isAppleNativeApp } from './apple-storekit';
import { isAllowedAuthOrigin, isAuthProviderCompatibleWithOrigin } from '../lib/auth/safe-auth-redirect';
import { nativeAccountOriginMatches, type NativeAccountBinding } from './native-account-policy';
import { nativeEmailClient,listenNativeEmail,nativeEmailCode } from './native-email-signin';
const subscribePlatform=()=>()=>{};
const serverPlatform=()=>false;
export type WorkspaceAuthConfig = {url:string;key:string;binding?:NativeAccountBinding|null};
/** Email authentication returns to this app; selected charts remain in memory. */
export default function WorkspaceSignIn({config,onSignedIn}:{config:WorkspaceAuthConfig;onSignedIn:()=>void}) {
  const native=useSyncExternalStore(subscribePlatform,isAppleNativeApp,serverPlatform);
  const [email,setEmail]=useState('');const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);const [message,setMessage]=useState('');
  const mounted=useRef(false);const current=useRef<AbortController|null>(null);const cleanup=useRef<()=>void>(()=>{});const pending=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;current.current?.abort();cleanup.current();};},[]);
  async function submit(event:FormEvent) {
    event.preventDefault();if(pending.current)return;pending.current=true;setBusy(true);setMessage('');setSent(false);
    current.current?.abort();cleanup.current();
    const controller=new AbortController();current.current=controller;
    const active=()=>mounted.current && !controller.signal.aborted && current.current===controller;
    const wait=<T,>(promise:Promise<T>,ms=20_000)=>new Promise<T>((resolve,reject)=>{
      const timer=setTimeout(()=>{controller.abort();reject(new Error('Sign-in timed out. Request a new link.'));},ms);
      promise.then(resolve,reject).finally(()=>clearTimeout(timer));
    });
    try {
      const origin=window.location.origin;
      if(!isAppleNativeApp())throw new Error('Use email sign-in from the Account page in this browser.');
      if(!isAllowedAuthOrigin(origin) || (!isAuthProviderCompatibleWithOrigin(origin,config.url) && !nativeAccountOriginMatches(config.binding,origin,config.url)))throw new Error('Sign-in is unavailable in this build. Your charts are kept; support must correct the account connection.');
      const client=nativeEmailClient(config.url,config.key,controller.signal);
      const state=crypto.randomUUID(),createdAt=Date.now();let consumed=false;
      const listenerPromise=listenNativeEmail(url=>{
        const code=nativeEmailCode(url,state,createdAt);
        if(!active() || consumed || !code)return;
        consumed=true;pending.current=true;setBusy(true);setMessage('Signing you in…');
        void (async()=>{
          try{
            const {data,error}=await wait(client.auth.exchangeCodeForSession(code));
            if(!active())return;
            if(error || !data.session)throw new Error('This sign-in link could not be verified. Request a new link.');
            const response=await wait(fetch('/api/auth/session',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',signal:controller.signal,headers:{'content-type':'application/json'},body:JSON.stringify({accessToken:data.session.access_token,refreshToken:data.session.refresh_token})}));
            if(!active())return;
            if(!response.ok)throw new Error('Your session could not be saved. Request a new link.');
            cleanup.current();onSignedIn();
          }catch{if(mounted.current && current.current===controller){setSent(false);setMessage('Sign-in could not complete. Request a new link.');}}
          finally{if(mounted.current && current.current===controller){pending.current=false;setBusy(false);}}
        })();
      });
      void listenerPromise.then(handle=>{if(!active())void handle.remove();},()=>{});
      const listener=await wait(listenerPromise,10_000);
      if(!active())return;
      const expiry=setTimeout(()=>{controller.abort();void listener.remove();if(mounted.current){setSent(false);setMessage('This link has expired. Request a new link.');}},600_000);
      cleanup.current=()=>{clearTimeout(expiry);void listener.remove();};
      const {error}=await wait(client.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:false,emailRedirectTo:origin+'/auth/native-return?state='+encodeURIComponent(state)}}));
      if(!active())return;
      if(error)throw new Error('We could not send the sign-in link. Please try again later.');
      setSent(true);setMessage('Open the sign-in link in your email to return here. Your charts are kept.');
    }catch{if(mounted.current && current.current===controller)setMessage('Email sign-in is unavailable for this build. Your charts are kept; please contact support.');cleanup.current();}
    finally{if(mounted.current && current.current===controller){pending.current=false;setBusy(false);}}
  }
  if(!native)return <div id="pn-account-signin" className="pnSignInForm"><h2>Welcome back.</h2><a href="/pocket/login">Continue with email sign-in</a></div>;
  return <form id="pn-account-signin" className="pnSignInForm" onSubmit={submit} aria-label="Sign in to your existing account">
    <h2>Welcome back.</h2><p>Sign in with your existing account. No password or new purchase.</p>
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy||sent}/></label>
    <button disabled={busy||sent} type="submit">{busy?'Connecting…':sent?'Check your email':'Email me a sign-in link'}</button>
    {message?<p role="status">{message}</p>:null}
  </form>;
}
