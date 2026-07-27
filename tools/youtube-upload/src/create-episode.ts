import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { loadDotEnvLocal } from "./config.ts";
import {
  buildTitleCardSvg,
  DEFAULT_TTS_VOICE,
  narrationInstructions,
  TTS_MODEL,
} from "./video-episode.ts";

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
  loadDotEnvLocal();
  const scriptFile = arg("script-file");
  const title = arg("title");
  const label = arg("label") ?? "AI market briefing";
  const output = resolve(arg("output") ?? "./episode.mp4");
  const voice = process.env.BULLSEYE_TTS_VOICE?.trim() || DEFAULT_TTS_VOICE;

  if (!scriptFile || !title) {
    throw new Error("Required: --script-file <txt> and --title <title>");
  }
  if (!existsSync(scriptFile)) throw new Error(`Script file not found: ${scriptFile}`);
  if (extname(output).toLowerCase() !== ".mp4") throw new Error("--output must end in .mp4");
  const script = readFileSync(scriptFile, "utf8").trim();
  if (script.length < 40 || script.length > 8_000) {
    throw new Error("Narration script must contain 40–8,000 characters.");
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY in the protected environment.");
  const outputDir = dirname(output);
  mkdirSync(outputDir, { recursive: true });
  const frame = resolve(outputDir, ".bullseye-episode-frame.svg");
  const narration = resolve(outputDir, ".bullseye-episode-narration.mp3");
  writeFileSync(frame, buildTitleCardSvg(title, label), { mode: 0o600 });

  try {
    const speech = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: TTS_MODEL,
        voice,
        input: script,
        instructions: narrationInstructions(),
        response_format: "mp3",
      }),
    });
    if (!speech.ok) {
      throw new Error(`Speech generation failed with status ${speech.status}.`);
    }
    writeFileSync(narration, Buffer.from(await speech.arrayBuffer()), { mode: 0o600 });

    const rendered = spawnSync(
      "ffmpeg",
      [
        "-y", "-loop", "1", "-i", frame, "-i", narration,
        "-c:v", "libx264", "-tune", "stillimage",
        "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p",
        "-shortest", output,
      ],
      { encoding: "utf8" },
    );
    if (rendered.error && "code" in rendered.error && rendered.error.code === "ENOENT") {
      throw new Error("ffmpeg is required to render the MP4.");
    }
    if (rendered.status !== 0) {
      throw new Error(`ffmpeg failed with status ${rendered.status ?? "unknown"}.`);
    }
  } finally {
    rmSync(frame, { force: true });
    rmSync(narration, { force: true });
  }

  console.log("Episode rendered.");
  console.log("Output:", output);
  console.log("Voice:", voice);
  console.log("Disclosure: AI-generated narration");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
