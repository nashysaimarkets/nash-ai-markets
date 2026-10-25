import {handlePocketIgDemoRequest} from '../../../lib/server/pocket-ig-demo-access.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Default remains OFF. Only an approved trusted server binding can supply the existing DEMO bridge. */
export async function POST(request:Request) {return handlePocketIgDemoRequest(request);}
