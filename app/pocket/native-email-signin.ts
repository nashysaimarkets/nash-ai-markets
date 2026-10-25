import { createClient } from '@supabase/supabase-js';
import { App } from '@capacitor/app';
import { createAuthCompatibleFetch } from '../../utils/supabase/auth-compatible-fetch.ts';
export { nativeEmailCode,NATIVE_EMAIL_CALLBACK } from "./native-email-callback.ts";
/** Nonpersistent PKCE exchange: late SDK responses cannot change browser cookies
 * or the shared user session. Only the caller's guarded server bridge can do so. */
export function nativeEmailClient(url:string,key:string,signal:AbortSignal) {
  const transport=createAuthCompatibleFetch(key);
  return createClient(url,key,{auth:{flowType:'pkce',persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'ntp-native-email-'+crypto.randomUUID()},
    global:{fetch:(input,init)=>transport(input,{...init,signal:AbortSignal.any([signal,AbortSignal.timeout(20_000),...(init?.signal?[init.signal]:[])])})}});
}
export const listenNativeEmail = (callback:(url:string)=>void) => App.addListener('appUrlOpen',event=>callback(event.url));
