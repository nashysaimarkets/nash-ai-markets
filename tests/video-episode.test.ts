import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTitleCardSvg,
  DEFAULT_TTS_VOICE,
  narrationInstructions,
  TTS_MODEL,
} from "../tools/youtube-upload/src/video-episode.ts";

test("video automation defaults to Cedar on the current speech model", () => {
  assert.equal(DEFAULT_TTS_VOICE, "cedar");
  assert.equal(TTS_MODEL, "gpt-4o-mini-tts");
  assert.match(narrationInstructions(), /British financial-news/);
  assert.match(narrationInstructions(), /Do not add, infer, paraphrase, or omit/);
});

test("branded title card discloses AI narration and escapes supplied copy", () => {
  const svg = buildTitleCardSvg("S&P < 500", "Pre-market & plan");

  assert.match(svg, /NASH/);
  assert.match(svg, /AI-generated narration/);
  assert.match(svg, /Educational market commentary only/);
  assert.match(svg, /S&amp;P &lt; 500/);
  assert.match(svg, /PRE-MARKET &amp; PLAN/);
  assert.doesNotMatch(svg, /S&P < 500/);
});
