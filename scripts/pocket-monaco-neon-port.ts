/** An injected pg-compatible connection, never a secret lookup or provider client. */
import type {RpcPort,RunnerIdentity} from './pocket-monaco-runner-bridge.ts';
export type NeonIdentity={organizationId:string;projectId:string;branchId:string;endpointHost:string;
 databaseName:string;roleName:string;controlPlaneEvidenceSha256:string};
export type SqlClient={query:(text:string,values?:unknown[])=>Promise<{rows:Record<string,unknown>[]}>};
const fields=['organizationId','projectId','branchId','endpointHost','databaseName','roleName','controlPlaneEvidenceSha256'];
export function validateNeonIdentity(n:NeonIdentity){
 if(JSON.stringify(Object.keys(n).sort())!==JSON.stringify([...fields].sort())||
 !/^org-[a-z0-9-]{3,100}$/.test(n.organizationId)||! /^[a-z0-9-]{3,100}$/.test(n.projectId)||
 !/^br-[a-z0-9-]{3,100}$/.test(n.branchId)||!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(n.endpointHost)||
 !/^[a-z_][a-z0-9_]{0,62}$/.test(n.databaseName)||n.roleName!=='monaco_ledger_runner'||
 !/^[a-f0-9]{64}$/.test(n.controlPlaneEvidenceSha256))throw Error('Verified Neon control-plane identity required');
 return `neon:${n.projectId}/${n.branchId}/${n.databaseName}`;
}
/** Pass individual pg config fields, not a URI whose options could override TLS.
 * password stays in the caller's protected memory. No logging, defaults or retries. */
export function neonConnectionOptions(n:NeonIdentity,password:string){
 validateNeonIdentity(n);
 if(typeof password!=='string'||password.length<24)throw Error('Protected database credential missing');
 return {host:n.endpointHost,port:5432,database:n.databaseName,user:n.roleName,password,
  ssl:{rejectUnauthorized:true,servername:n.endpointHost},connectionTimeoutMillis:10000,
  statement_timeout:15000,query_timeout:20000,application_name:'monaco-first-six-ledger'};
}
export function createNeonSqlPort(client:SqlClient,n:NeonIdentity,identity:RunnerIdentity):RpcPort{
 if(validateNeonIdentity(n)!==identity.backendRef)throw Error('Neon backend identity mismatch');
 const neon=JSON.stringify(n),bound=JSON.stringify(identity);
 const names=new Set(['inspect_monaco_isolated_runner','claim_pocket_benchmark_case','submit_pocket_benchmark_call',
  'record_pocket_benchmark_receipt','void_pocket_benchmark_call','account_pocket_benchmark_reserved_case']);
 return {async rpc(name,args){
  if(!names.has(name))return {data:null,error:'Ledger operation denied'};
  try{const result=await client.query('select public.monaco_neon_rpc($1::jsonb,$2::jsonb,$3::text,$4::jsonb) as result',
    [neon,bound,name,JSON.stringify(args)]);
   if(result.rows.length!==1||!result.rows[0].result)throw Error();
   return {data:result.rows[0].result,error:null};
  }catch{return {data:null,error:'Ledger operation failed; preserve exposure and reconcile; no retry'};}
 }};
}
