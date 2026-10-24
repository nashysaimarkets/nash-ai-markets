/** Prepared PostgreSQL binding. No client is constructed and no SQL runs on import. */
import {createHash} from 'node:crypto';
import type {IgDemoChartIdentity} from '../ig-demo-panel.ts';
import type {IgDemoSharedStore,IgDemoSharedState} from './ig-demo-shared.ts';
export type IgDemoPgClient={query(sql:string,parameters?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;release():void};
export type IgDemoPgPool={connect():Promise<IgDemoPgClient>};
export function createIgDemoPostgresStore(pool:IgDemoPgPool,application:string,limits:{application:number;account:number}) {
  if(typeof window!=='undefined'||!/^[-a-zA-Z0-9_]{1,64}$/.test(application)||
    !Number.isInteger(limits.application)||limits.application<1||limits.application>60||
    !Number.isInteger(limits.account)||limits.account<1||limits.account>30)throw new Error('IG_DEMO_STORE_CONFIGURATION');
  const owner=(id:string)=>{if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))throw new Error('IG_DEMO_OWNER_REQUIRED');return id;};
  async function transaction<T>(run:(c:IgDemoPgClient)=>Promise<T>):Promise<T>{
    let c:IgDemoPgClient;
    try{c=await pool.connect();}catch{throw new Error('IG_DEMO_STORE_UNAVAILABLE');}
    try {await c.query('BEGIN');await c.query("SET LOCAL statement_timeout = '2s'");await c.query("SET LOCAL lock_timeout = '1s'");
      const result=await run(c);await c.query('COMMIT');return result;
    }catch{await c.query('ROLLBACK').catch(()=>{});throw new Error('IG_DEMO_STORE_UNAVAILABLE');}finally{c.release();}
  }
  const state=(r:Record<string,unknown>|undefined):IgDemoSharedState|null=>{
    if(!r)return null;
    if(typeof r.epoch!=='string'||!/^[1-9][0-9]*$/.test(r.epoch)||(r.sealed!==null&&typeof r.sealed!=='string'))throw new Error('IG_DEMO_STORE_CONTRACT');
    return {epoch:r.epoch,sealed:r.sealed as string|null};
  };
  const store:IgDemoSharedStore={
    read:async(id)=>transaction(async c=>state((await c.query('SELECT epoch::text, sealed FROM ig_demo_private.sessions WHERE application=$1 AND owner_id=$2',[application,owner(id)])).rows[0])),
    revoke:async(id,expectedEpoch)=>transaction(async c=>{
      if(expectedEpoch!==undefined){
        if(!/^[1-9][0-9]*$/.test(expectedEpoch))throw new Error('IG_DEMO_STORE_CONTRACT');
        return state((await c.query('UPDATE ig_demo_private.sessions SET epoch=epoch+1,sealed=NULL WHERE application=$1 AND owner_id=$2 AND epoch=$3::bigint RETURNING epoch::text,sealed',[application,owner(id),expectedEpoch])).rows[0]);
      }
      const r=await c.query('INSERT INTO ig_demo_private.sessions(application,owner_id,epoch,sealed) VALUES($1,$2,1,NULL) ON CONFLICT(application,owner_id) DO UPDATE SET epoch=ig_demo_private.sessions.epoch+1,sealed=NULL RETURNING epoch::text,sealed',[application,owner(id)]);
      const s=state(r.rows[0]);if(!s)throw new Error('IG_DEMO_STORE_CONTRACT');return s;
    }),
    save:async(id,epoch,sealed)=>{
      if(!/^[1-9][0-9]*$/.test(epoch)||typeof sealed!=='string'||sealed.length>24000)throw new Error('IG_DEMO_STORE_CONTRACT');
      return transaction(async c=>(await c.query('UPDATE ig_demo_private.sessions SET sealed=$4 WHERE application=$1 AND owner_id=$2 AND epoch=$3::bigint RETURNING epoch::text',[application,owner(id),epoch,sealed||null])).rows.length===1);
    },
    reserve:async(account)=>{
      if(!/^[A-Za-z0-9_-]{1,30}$/.test(account))return false;
      return transaction(async c=>{
        // App-wide serialization prevents two instances/accounts overbooking the shared limit.
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`pocket-ig-demo-quota:${application}`]);
        await c.query("DELETE FROM ig_demo_private.requests WHERE application=$1 AND charged_at <= clock_timestamp()-interval '60 seconds'",[application]);
        const r=(await c.query('SELECT count(*)::int AS app_used,count(*) FILTER(WHERE account_id=$2)::int AS account_used FROM ig_demo_private.requests WHERE application=$1',[application,account])).rows[0];
        if(!r||!Number.isInteger(r.app_used)||!Number.isInteger(r.account_used))throw new Error('IG_DEMO_STORE_CONTRACT');
        if((r.app_used as number)>=limits.application||(r.account_used as number)>=limits.account)return false;
        await c.query('INSERT INTO ig_demo_private.requests(application,account_id,charged_at) VALUES($1,$2,clock_timestamp())',[application,account]);
        return true; // Never refunded: even canceled attempts consume their reservation.
      });
    },
  };
  return Object.freeze({store,
    provenance:async(id:string,token:string)=>transaction(async c=>{
      if(!/^[A-Za-z0-9:_-]{1,96}$/.test(token))return null;
      const row=(await c.query('SELECT revision,expires_at,epic,account_type FROM ig_demo_private.chart_provenance WHERE application=$1 AND owner_id=$2 AND token_hash=$3 AND expires_at>clock_timestamp()',
        [application,owner(id),createHash('sha256').update(token).digest()])).rows[0];
      if(!row)return null;
      if(typeof row.revision!=='string'||typeof row.epic!=='string'||!['CFD','SPREADBET','PHYSICAL'].includes(String(row.account_type)))throw new Error('IG_DEMO_PROVENANCE_CONTRACT');
      const expiresAt=new Date(row.expires_at as string).getTime();if(!Number.isFinite(expiresAt))throw new Error('IG_DEMO_PROVENANCE_CONTRACT');
      return {ownerId:id,revision:row.revision,expiresAt,identity:{source:'IG_DEMO',confirmed:true,epic:row.epic,accountType:row.account_type} as IgDemoChartIdentity};
    }),
    vaultRead:async(id:string):Promise<string|null>=>transaction(async c=>{
      const r=(await c.query("SELECT sealed FROM ig_demo_private.credentials WHERE application=$1 AND owner_id=$2 AND environment='DEMO' AND enabled=true",[application,owner(id)])).rows[0];
      if(!r)return null;if(typeof r.sealed!=='string'||r.sealed.length>24000)throw new Error('IG_DEMO_VAULT_CONTRACT');return r.sealed;
    }),
  });
}
