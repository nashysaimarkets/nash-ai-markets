import {nativeEmailReturn} from '../../pocket/native-email-return.ts';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const target=nativeEmailReturn(request.url),nonce=crypto.randomUUID();
  const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':`default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'`};
  // Target contains only validated ASCII nonce/code and a fixed application URL.
  const script=target?`history.replaceState(null,'','/auth/native-return');location.replace(${JSON.stringify(target)});`:'';
  return new Response(`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>Return to NTP</title><style nonce="${nonce}">body{background:#0f1927;color:#ede9df;font:16px system-ui;padding:60px 24px;max-width:480px;margin:auto}h1{font:36px Georgia}a{display:block;background:#d1b380;color:#0f1927;padding:16px;text-align:center;border-radius:4px;text-decoration:none}p{line-height:1.6;color:#bdc5cf}</style></head><body><h1>${target?'Welcome back.':'This link is incomplete.'}</h1><p>${target?'Continue in NTP to finish signing in. Your selected charts are waiting.':'Return to the app and request a new sign-in link.'}</p>${target?`<a href="${target.replaceAll('&','&amp;')}">Open NTP</a><script nonce="${nonce}">${script}</script>`:''}</body></html>`,{status:target?200:400,headers});
}
