import {handleGoogleNotificationRequest} from '../../../lib/server/pocket-google-notifications.ts';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
/** Default503 until a reviewed server bootstrap binds the exact sandbox backend. */
export async function POST(request:Request){return handleGoogleNotificationRequest(request);}
