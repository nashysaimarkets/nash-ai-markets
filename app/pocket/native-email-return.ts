import { NATIVE_EMAIL_CALLBACK } from './native-email-callback.ts';
/** HTTPS relay uses the existing approved preview redirect. Only a PKCE code and
 * opaque request nonce can reach the fixed app scheme; never tokens or a next URL. */
export function nativeEmailReturn(url:string):string|null {
  try{const u=new URL(url);
    if(u.pathname!=='/auth/native-return' || u.hash || u.searchParams.getAll('state').length!==1 || u.searchParams.getAll('code').length!==1 || u.searchParams.has('error'))return null;
    const state=u.searchParams.get('state')||'',code=u.searchParams.get('code')||'';
    if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(state) || !/^[A-Za-z0-9_-]{16,512}$/.test(code))return null;
    return NATIVE_EMAIL_CALLBACK+'?'+new URLSearchParams({state,code}).toString();
  }catch{return null;}
}
