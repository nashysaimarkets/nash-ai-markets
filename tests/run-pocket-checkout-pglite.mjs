/** Optional local functional/ACL check; NOT evidence of PostgreSQL concurrency. */
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const modulePath = process.env.POCKET_CHECKOUT_QA_PGLITE_MODULE;
if (!modulePath || !modulePath.startsWith("/workspace/") || !modulePath.endsWith("/@electric-sql/pglite/dist/index.js")) throw Error("Explicit local PGlite module required");
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
try {
  for (const path of [
    "tests/sql/support/pocket-checkout-intent-bootstrap.sql",
    "supabase/proposed/pocket-checkout-intent.sql",
    "tests/sql/support/pocket-checkout-intent-helpers.sql",
  ]) await db.exec(await readFile(path, "utf8"));
  await db.exec("begin;" + await readFile("tests/sql/pocket-checkout-intent.sql", "utf8") + "rollback;");
  const remaining = await db.query("select count(*)::int as n from private.pocket_checkout_intents");
  if (remaining.rows[0].n !== 0) throw Error("Synthetic fixture rows persisted");
  console.log("PASS: isolated SQL function/ACL assertions; all synthetic rows rolled back. No concurrency claim.");
} finally { await db.close(); }
