import {checkGoogleRequest} from '../../../lib/server/pocket-google-access';
export const dynamic='force-dynamic';
export const runtime='nodejs';
/** Restore records only server-verified ownership; no purchase or client account ID. */
export async function POST(request:Request){return checkGoogleRequest(request,undefined,true);}
