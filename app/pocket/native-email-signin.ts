import { createClient } from '@supabase/supabase-js';
import { App } from '@capacitor/app';
import { createAuthCompatibleFetch } from '../../utils/supabase/auth-compatible-fetch.ts';
export const NATIVE_EMAIL_CALLBACK = 'com.nashaimarkets.pocketbullseye://auth/callback';
export function nativeEmailCode(url:string,state:string,createdAt:number,now=Date.now()):string|null {
  if(!state || now-createdAt>600_000 || now<createdAt || url.length>4096)return null;
  try{const u=new URL(url);
    if(u.protocol!=='com.nashaimarkets.pocketbullseye:' || u.host!=='auth' || u.pathname!=='/callback' || u.hash || u.username || u.password)return null;
    if(u.searchParams.getAll('state').length!==1 || u.searchParams.get('state')!==state || u.searchParams.getAll('code').length!==1 || u.searchParams.has('error'))return null;
    const code=u.searchParams.get('code')||'';
    return /^[A-Za-z0-9_-]{16,512}$/.test(code)?code:null;
  }catch{return null;}
}
/** Nonpersistent PKCE exchange: late SDK responses cannot change browser cookies
 * or the shared user session. Only the caller's guarded server bridge can do so. */
export function nativeEmailClient(url:string,key:string,signal:AbortSignal) {
  const transport=createAuthCompatibleFetch(key);
  return createClient(url,key,{auth:{flowType:'pkce',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'ntp-native-email-'+crypto.randomUUID()},
    global:{fetch:(input,init)=>transport(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(20_000),...(init?.signal?[init.signal]:[])])})}});
}
export const listenNativeEmail = (callback:(url:string)=>void) => App.addListener('appUrlOpen',event=>callback(event.url));
