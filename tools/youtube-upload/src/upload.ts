/**
 * Operator CLI: resumable YouTube upload using youtube.upload scope only.
 *
 * Usage:
 *   npm run upload -- --file ./video.mp4 --title "Title" [--privacy private|unlisted|public]
 */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { google } from "googleapis";
import { loadYoutubeUploadEnv, YOUTUBE_UPLOAD_SCOPE } from "./config.ts";

type Privacy = "private" | "unlisted" | "public";

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main(): Promise<void> {
  if (flag("help") || flag("h")) {
    console.log(
      "Usage: npm run upload -- --file <path> --title <title> [--description <text>] [--privacy private|unlisted|public]",
    );
    return;
  }

  const file = arg("file");
  const title = arg("title");
  const description = arg("description") ?? "";
  const privacy = (arg("privacy") as Privacy | undefined) ?? "private";

  if (!file || !title) {
    throw new Error("Required: --file and --title");
  }
  if (!["private", "unlisted", "public"].includes(privacy)) {
    throw new Error("--privacy must be private, unlisted, or public");
  }
  if (!existsSync(file)) {
    throw new Error(`File not found: ${file}`);
  }

  const env = loadYoutubeUploadEnv();
  if (!existsSync(env.tokenPath)) {
    throw new Error(`No token at ${env.tokenPath}. Run: npm run auth`);
  }

  const saved = JSON.parse(readFileSync(env.tokenPath, "utf8")) as {
    refresh_token?: string;
  };
  if (!saved.refresh_token) {
    throw new Error("Token file missing refresh_token. Re-run npm run auth.");
  }

  const oauth2 = new google.auth.OAuth2(env.clientId, env.clientSecret, env.redirectUri);
  oauth2.setCredentials({ refresh_token: saved.refresh_token });

  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const size = statSync(file).size;

  console.log("Uploading (resumable)…");
  console.log("Scope expected:", YOUTUBE_UPLOAD_SCOPE);
  console.log("File bytes:", size);
  console.log("Privacy:", privacy);

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "22",
      },
      status: {
        privacyStatus: privacy,
        selfDeclaredMadeForKids: false,
      },
    },
    media: {
      body: createReadStream(file),
    },
  });

  const id = response.data.id;
  if (!id) {
    throw new Error("Upload completed but no video id returned.");
  }

  console.log("Upload complete.");
  console.log("Video id:", id);
  console.log("Studio:", `https://studio.youtube.com/video/${id}/edit`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
