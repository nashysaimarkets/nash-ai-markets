/**
 * Operator CLI: obtain a YouTube upload refresh token via browser consent.
 * Does NOT touch Supabase customer auth. Scope: youtube.upload only.
 *
 * Usage (from tools/youtube-upload):
 *   npm run auth
 * Then open the printed URL, approve, and paste the ?code= value when prompted.
 */
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { google } from "googleapis";
import { loadYoutubeUploadEnv, YOUTUBE_UPLOAD_SCOPE } from "./config.ts";

async function main(): Promise<void> {
  const env = loadYoutubeUploadEnv();
  const oauth2 = new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [YOUTUBE_UPLOAD_SCOPE],
  });

  console.log("\nProject BULLSEYE — YouTube operator OAuth");
  console.log("Scope:", YOUTUBE_UPLOAD_SCOPE);
  console.log("\n1. Open this URL in a browser signed into the YouTube channel account:\n");
  console.log(authUrl);
  console.log("\n2. After approval, Google redirects to your redirect URI with ?code=...");

  const redirect = new URL(env.redirectUri);
  const useLocalListener =
    (redirect.hostname === "localhost" || redirect.hostname === "127.0.0.1") &&
    redirect.port !== "";

  let code: string;

  if (useLocalListener) {
    const port = Number(redirect.port);
    console.log(`\nListening on ${redirect.origin}${redirect.pathname} for the callback…`);
    code = await waitForLocalCode(port, redirect.pathname);
  } else {
    const rl = createInterface({ input, output });
    const pasted = await rl.question(
      "\nPaste the full redirect URL (or just the code= value), then press Enter:\n> ",
    );
    rl.close();
    code = extractCode(pasted);
  }

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token returned. Revoke prior grants in Google Account → Security → Third-party access, then retry with prompt=consent.",
    );
  }

  mkdirSync(dirname(env.tokenPath), { recursive: true });
  writeFileSync(
    env.tokenPath,
    JSON.stringify(
      {
        refresh_token: tokens.refresh_token,
        scope: tokens.scope ?? YOUTUBE_UPLOAD_SCOPE,
        token_type: tokens.token_type ?? "Bearer",
        expiry_date: tokens.expiry_date ?? null,
        obtained_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );

  console.log("\nRefresh token saved to a gitignored path (not printed).");
  console.log("Next: npm run upload -- --file ./sample.mp4 --title \"Draft title\"");
}

function extractCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.includes("://") && !trimmed.includes("=")) return trimmed;
  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    if (code) return code;
  } catch {
    /* fall through */
  }
  const match = /[?&]code=([^&]+)/.exec(trimmed);
  if (match?.[1]) return decodeURIComponent(match[1]);
  throw new Error("Could not parse OAuth code from input.");
}

function waitForLocalCode(port: number, pathname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      try {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
        if (url.pathname !== pathname) {
          res.writeHead(404).end("Not found");
          return;
        }
        const code = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        if (err) {
          res.writeHead(400).end(`OAuth error: ${err}`);
          server.close();
          reject(new Error(`OAuth error: ${err}`));
          return;
        }
        if (!code) {
          res.writeHead(400).end("Missing code");
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(
          "<html><body><p>YouTube upload authorization complete. You can close this tab and return to the terminal.</p></body></html>",
        );
        server.close();
        resolve(code);
      } catch (error) {
        server.close();
        reject(error);
      }
    });
    server.listen(port, "127.0.0.1");
    server.on("error", reject);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
