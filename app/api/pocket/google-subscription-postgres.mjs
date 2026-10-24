/** Existing approved dedicated pool only. No connection/role/credential defaults. */
import {OWNERSHIP_SQL} from './google-subscription-ownership.mjs';
export const LOOKUP_SQL='select pocket_google_ownership.lookup_token($1::text) as result';
export function createGooglePostgresPorts(pool){
 if(typeof window!=='undefined'||!pool||typeof pool.query!=='function')throw Error('GOOGLE_STORAGE_CONFIG');
 const query=pool.query.bind(pool);
 return Object.freeze({
  async commitRevocation({accountId,packageName,environment,tokenSha256,signal}){
   signal?.throwIfAborted();
   try{const r=await query("select pocket_google_ownership.revoke_known_token($1::uuid,$2::text,$3::text,$4::text) as result",[accountId,packageName,environment,tokenSha256]);return r?.rows?.[0]?.result??{status:"UNCERTAIN"};}catch{throw Error("GOOGLE_REVOCATION_UNKNOWN");}
  },
  async readTokenBinding({tokenSha256,signal}={}){
   signal?.throwIfAborted();if(typeof tokenSha256!=='string'||!/^[a-f0-9]{64}$/.test(tokenSha256))throw Error('GOOGLE_STORAGE_INPUT');
   try{const r=await query(LOOKUP_SQL,[tokenSha256]);signal?.throwIfAborted();
    if(r?.rows?.length!==1||!r.rows[0].result||typeof r.rows[0].result!=='object')throw Error();return Object.freeze({...r.rows[0].result});
   }catch{throw Error('GOOGLE_STORAGE_UNAVAILABLE');}
  },
  async commitStatement(sql,values){
   if(sql!==OWNERSHIP_SQL||!Array.isArray(values)||values.length!==5)throw Error('GOOGLE_STORAGE_INPUT');
   try{return await query(OWNERSHIP_SQL,[...values]);}catch{throw Error('GOOGLE_STORAGE_COMMIT_UNKNOWN');}
  },
 });
}
