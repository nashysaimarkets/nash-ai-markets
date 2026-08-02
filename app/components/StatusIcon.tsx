/**
 * Restrained inline SVG icons for member surfaces.
 * Decorative by default — pass title for accessible naming when icon-only.
 */

type IconName =
  | "brief"
  | "dashboard"
  | "desk"
  | "catalyst"
  | "risk"
  | "verified"
  | "delayed"
  | "stale"
  | "unavailable"
  | "bull"
  | "bear"
  | "pause"
  | "video"
  | "device"
  | "sunrise"
  | "sunset"
  | "archive";

const PATHS: Record<IconName, string> = {
  brief: "M4 12c2-4 5-6 8-6s6 2 8 6c-2 4-5 6-8 6s-6-2-8-6zm8-2.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  dashboard: "M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zm0 2.2L6 8.5v7l6 3.3 6-3.3v-7L12 5.2zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  desk: "M4 6h16v3H4V6zm1 5h6v7H5v-7zm8 0h6v7h-6v-7zM7 8.5h2M15 8.5h2",
  catalyst: "M8 3h8v2H8V3zm1 4h6l-1 4h3l-7 10 1.5-6H8L9 7z",
  risk: "M12 3l8 4v5c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V7l8-4zm0 2.2L6 8.1v3.8c0 3.8 2.5 6.7 6 7.9 3.5-1.2 6-4.1 6-7.9V8.1l-6-2.9zM11 10h2v5h-2v-5zm0 6h2v2h-2v-2z",
  verified: "M12 3a9 9 0 100 18 9 9 0 000-18zm-1.2 10.6l-2.5-2.5 1.1-1.1 1.4 1.4 3.6-3.6 1.1 1.1-4.7 4.7z",
  delayed: "M12 3a9 9 0 100 18 9 9 0 000-18zm1 4h-2v6l4.5 2.7 1-1.6-3.5-2.1V7z",
  stale: "M12 3a9 9 0 100 18 9 9 0 000-18zm1 4h-2v5h5v-2h-3V7zm-6.5 9.5L5 18l1.5 1.5L8 18l-1.5-1.5zM19 18l-1.5-1.5L16 18l1.5 1.5L19 18z",
  unavailable: "M4.2 5.6l1.4-1.4L19.8 18.4l-1.4 1.4-2.2-2.2A8.9 8.9 0 0112 21a9 9 0 01-7.8-13.4L4.2 5.6zM12 5c1.8 0 3.4.5 4.8 1.5l-1.5 1.5A6.9 6.9 0 0012 7a7 7 0 00-6.1 3.6L4.4 9A8.9 8.9 0 0112 5zm7.6 4L18 10.6A7 7 0 0117.5 15l1.6 1.6A9 9 0 0019.6 9z",
  bull: "M5 16l5-8 3 4 2-3 4 7H5z",
  bear: "M5 8l5 8 3-4 2 3 4-7H5z",
  pause: "M8 6h3v12H8V6zm5 0h3v12h-3V6zM5 4h14v2H5V4zm0 14h14v2H5v-2z",
  video: "M12 4a8 8 0 100 16 8 8 0 000-16zm-2 4.5l7 3.5-7 3.5v-7z",
  device: "M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm0 2v12h10V5H7zm3 13h4v1h-4v-1z",
  sunrise: "M4 16h16v2H4v-2zm8-11l1.5 3H18l-2.5 2 1 3.2L12 12l-4.5 1.2 1-3.2L6 8h4.5L12 5zm-7 9a7 7 0 0114 0H5z",
  sunset: "M4 18h16v2H4v-2zm8-3l-4.5-1.2 1-3.2L6 8.5h4.5L12 5.5l1.5 3H18l-2.5 2.1 1 3.2L12 15zm-7-1a7 7 0 0114 0H5z",
  archive: "M4 5h16v4H4V5zm1 5h14v9H5v-9zm3 2v2h8v-2H8z",
};

export function StatusIcon({
  name,
  title,
  className = "",
}: {
  name: IconName;
  title?: string;
  className?: string;
}) {
  const labelled = Boolean(title);
  return (
    <span className={`vxIcon ${className}`.trim()} aria-hidden={labelled ? undefined : true}>
      <svg viewBox="0 0 24 24" role={labelled ? "img" : "presentation"} focusable="false">
        {title ? <title>{title}</title> : null}
        <path fill="currentColor" d={PATHS[name]} />
      </svg>
    </span>
  );
}

export type { IconName };
