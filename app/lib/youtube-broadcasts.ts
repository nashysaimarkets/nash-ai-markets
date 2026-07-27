export type YouTubeBroadcastEpisode = {
  videoId: string;
  publishedAt: string;
};

export type YouTubeBroadcastSchedule = {
  premarket: YouTubeBroadcastEpisode | null;
  close: YouTubeBroadcastEpisode | null;
};

type FeedEpisode = YouTubeBroadcastEpisode & {
  published: Date;
};

const DEFAULT_CHANNEL_ID = "UCR0y7LUI4z9rruzv3DBAuSg";
const CHANNEL_ID_PATTERN = /^UC[A-Za-z0-9_-]{22}$/;
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

function ukParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: read("weekday"),
    dateKey: `${read("year")}-${read("month")}-${read("day")}`,
    minutes: Number(read("hour")) * 60 + Number(read("minute")),
  };
}

function extractTag(entry: string, tag: string): string | null {
  const match = entry.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return match?.[1]?.trim() || null;
}

export function parseYouTubeChannelFeed(xml: string): FeedEpisode[] {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match) => {
      const videoId = extractTag(match[1], "yt:videoId");
      const publishedAt = extractTag(match[1], "published");
      if (!videoId || !VIDEO_ID_PATTERN.test(videoId) || !publishedAt) return null;
      const published = new Date(publishedAt);
      if (!Number.isFinite(published.getTime())) return null;
      return { videoId, publishedAt: published.toISOString(), published };
    })
    .filter((episode): episode is FeedEpisode => episode !== null);
}

export function selectTodaysBroadcasts(
  episodes: FeedEpisode[],
  now = new Date(),
): YouTubeBroadcastSchedule {
  const today = ukParts(now);
  if (today.weekday === "Sat" || today.weekday === "Sun") {
    return { premarket: null, close: null };
  }

  const todaysEpisodes = episodes.filter(
    (episode) => ukParts(episode.published).dateKey === today.dateKey,
  );
  const closestInWindow = (start: number, end: number, target: number) => {
    const candidates = todaysEpisodes
      .filter((episode) => {
        const minutes = ukParts(episode.published).minutes;
        return minutes >= start && minutes <= end;
      })
      .sort(
        (left, right) =>
          Math.abs(ukParts(left.published).minutes - target) -
          Math.abs(ukParts(right.published).minutes - target),
      );
    const selected = candidates[0];
    return selected
      ? { videoId: selected.videoId, publishedAt: selected.publishedAt }
      : null;
  };

  return {
    premarket: closestInWindow(5 * 60 + 30, 11 * 60, 7 * 60 + 30),
    close: closestInWindow(19 * 60, 23 * 60 + 59, 21 * 60 + 30),
  };
}

export async function getTodaysYouTubeBroadcasts(): Promise<YouTubeBroadcastSchedule> {
  const channelId = process.env.BULLSEYE_YOUTUBE_CHANNEL_ID?.trim() || DEFAULT_CHANNEL_ID;
  if (!CHANNEL_ID_PATTERN.test(channelId)) return { premarket: null, close: null };

  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`,
      {
        headers: { Accept: "application/atom+xml, application/xml;q=0.9" },
        next: { revalidate: 300 },
      },
    );
    if (!response.ok) return { premarket: null, close: null };
    return selectTodaysBroadcasts(parseYouTubeChannelFeed(await response.text()));
  } catch {
    return { premarket: null, close: null };
  }
}
