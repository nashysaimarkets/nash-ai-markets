import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Sole YouTube scope for Project BULLSEYE video automation uploads. */
export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";

export type YoutubeUploadEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenPath: string;
};

function loadDotEnvLocal(): void {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

export function loadYoutubeUploadEnv(): YoutubeUploadEnv {
  loadDotEnvLocal();

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI?.trim() ||
    "http://localhost:8787/api/youtube/oauth/callback";
  const tokenPath = resolve(
    ROOT,
    process.env.YOUTUBE_TOKEN_PATH?.trim() || "./.tokens/youtube-oauth.json",
  );

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Copy .env.example → .env.local and fill from Google Cloud Console (never commit secrets).",
    );
  }

  return { clientId, clientSecret, redirectUri, tokenPath };
}
