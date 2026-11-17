const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Current time, ticking every minute so countdowns stay live. */
export const clock = $state({ now: Date.now() });
setInterval(() => (clock.now = Date.now()), MINUTE);

/** "2d 5h left", "3h 10m left", "1d 2h ago". */
export function relative(iso: string): string {
  const diff = Date.parse(iso) - clock.now;
  const abs = Math.abs(diff);
  const d = Math.floor(abs / DAY);
  const h = Math.floor((abs % DAY) / HOUR);
  const m = Math.floor((abs % HOUR) / MINUTE);
  const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `${text} left` : `${text} ago`;
}

export type Urgency = "soon" | "near" | "later" | "past";

export function urgency(iso: string): Urgency {
  const diff = Date.parse(iso) - clock.now;
  if (diff < 0) return "past";
  if (diff < DAY) return "soon";
  if (diff < 3 * DAY) return "near";
  return "later";
}

const FULL_DATE_KEY = "fullDate";
const HOUR24_KEY = "hour24";

export const datePrefs = $state({
  /** Month and day ("Sun, Nov 15, 23:59") or just weekday and time ("Sun 23:59"). */
  full: localStorage.getItem(FULL_DATE_KEY) !== "false",
  /** "23:59" or "11:59 PM". */
  hour24: localStorage.getItem(HOUR24_KEY) !== "false",
});

export function setFullDate(full: boolean): void {
  datePrefs.full = full;
  localStorage.setItem(FULL_DATE_KEY, String(full));
}

export function setHour24(hour24: boolean): void {
  datePrefs.hour24 = hour24;
  localStorage.setItem(HOUR24_KEY, String(hour24));
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    ...(datePrefs.full && { month: "short", day: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hour12: !datePrefs.hour24,
  });
}
