/** Optional opaque server-issued reference; never inferred from screenshot labels.
 * This UI check prevents stale display. Server provenance remains the authority. */
export type IgDemoChartBinding=Readonly<{ownerScope:string;contextKey:string;token:string;expiresAt:number}>;
export function igDemoChartToken(binding:IgDemoChartBinding|undefined,ownerScope:string|undefined,contextKey:string,now=Date.now()):string|undefined {
 if(!binding||!ownerScope||binding.ownerScope!==ownerScope||binding.contextKey!==contextKey||
    !Number.isFinite(binding.expiresAt)||binding.expiresAt<=now||!Number.isFinite(now)||
    typeof binding.token!=='string'||!/^[A-Za-z0-9:_-]{1,96}$/.test(binding.token))return undefined;
 return binding.token;
}
