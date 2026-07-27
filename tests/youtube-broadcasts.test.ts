import assert from "node:assert/strict";
import test from "node:test";
import {
  parseYouTubeChannelFeed,
  selectTodaysBroadcasts,
} from "../app/lib/youtube-broadcasts.ts";

const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry><yt:videoId>Morning1234</yt:videoId><published>2026-07-27T06:32:00Z</published></entry>
  <entry><yt:videoId>Closing1234</yt:videoId><published>2026-07-27T20:34:00Z</published></entry>
  <entry><yt:videoId>Yesterday12</yt:videoId><published>2026-07-26T20:30:00Z</published></entry>
</feed>`;

test("channel feed selects today's two UK weekday broadcast windows", () => {
  const schedule = selectTodaysBroadcasts(
    parseYouTubeChannelFeed(feed),
    new Date("2026-07-27T12:00:00Z"),
  );

  assert.equal(schedule.premarket?.videoId, "Morning1234");
  assert.equal(schedule.close?.videoId, "Closing1234");
});

test("channel feed withholds every episode at weekends", () => {
  const schedule = selectTodaysBroadcasts(
    parseYouTubeChannelFeed(feed),
    new Date("2026-08-01T12:00:00Z"),
  );

  assert.deepEqual(schedule, { premarket: null, close: null });
});

test("malformed, stale and out-of-window uploads cannot fill a slot", () => {
  const outOfWindow = `<?xml version="1.0"?><feed xmlns:yt="x">
    <entry><yt:videoId>Midday12345</yt:videoId><published>2026-07-27T12:00:00Z</published></entry>
    <entry><yt:videoId>too-short</yt:videoId><published>2026-07-27T06:30:00Z</published></entry>
  </feed>`;
  const schedule = selectTodaysBroadcasts(
    parseYouTubeChannelFeed(outOfWindow),
    new Date("2026-07-27T14:00:00Z"),
  );

  assert.deepEqual(schedule, { premarket: null, close: null });
});
