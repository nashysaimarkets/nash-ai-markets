export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Hard disabled until approved vault, shared quota, session ownership and rights are bound.
 * No environment variable or browser request can activate this customer feature. */
export async function POST() {
  return Response.json({error:'IG_DEMO_NOT_CONFIGURED'},{status:503,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}
