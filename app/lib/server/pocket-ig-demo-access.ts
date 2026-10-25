import {isPocketIgDemoBinding} from './pocket-ig-demo-bootstrap.ts';
import type {PocketIgDemoBinding,PocketIgDemoAvailability} from './pocket-ig-demo-bootstrap.ts';

let binding:PocketIgDemoBinding|undefined;
const unavailable:PocketIgDemoAvailability=Object.freeze({igDemoAvailable:false});
const headers={'Cache-Control':'private, no-store','Vary':'Cookie','X-Content-Type-Options':'nosniff'};
/** Approved server bootstrap only. No request, environment flag or serialized object can install it. */
export function bindPocketIgDemoRuntime(value:PocketIgDemoBinding) {
  if(typeof window!=='undefined'||binding||!isPocketIgDemoBinding(value))throw Error('IG_DEMO_RUNTIME_BINDING_UNAVAILABLE');
  binding=value;
}
/** Missing binding stays OFF; future configured route uses the accepted shared DEMO implementation. */
export async function handlePocketIgDemoRequest(request?:Request,configured=binding):Promise<Response> {
  if(!configured||!isPocketIgDemoBinding(configured))return Response.json({error:'IG_DEMO_NOT_CONFIGURED'},{status:503,headers});
  if(!request)return Response.json({error:'INVALID_REQUEST'},{status:400,headers});
  return configured.handle(request);
}
/** The server page and POST share the same immutable binding and current account authority. */
export async function readPocketIgDemoAvailability(requestHeaders:Headers,configured=binding):Promise<PocketIgDemoAvailability> {
  if(!configured||!isPocketIgDemoBinding(configured))return unavailable;
  return configured.availability(requestHeaders);
}
