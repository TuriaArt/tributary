import { locale, pluralWord, t } from "./i18n";
const relative = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat(locale(), { year: "numeric", month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" });

const relativeShort = new Intl.RelativeTimeFormat(locale(), { numeric: "auto", style: "short" });
const dayInYear = new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric" });

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "5 minutes ago" for the last week, a plain date after that. */
export function relativeTime(seconds: number, now = Date.now() / 1000): string {
  const diff = seconds - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return t("just now");
  if (abs < HOUR) return relative.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return relative.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return relative.format(Math.round(diff / DAY), "day");
  return shortDate.format(new Date(seconds * 1000));
}

/**
 * Like {@link relativeTime}, but shorter, for the commit list: "5 min. ago", "21 hr. ago",
 * "yesterday", then "Oct 31" this year and "Oct 31, 2025" before.
 */
export function compactTime(seconds: number, now = Date.now() / 1000): string {
  const diff = seconds - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return t("just now");
  if (abs < HOUR) return relativeShort.format(Math.round(diff / MINUTE), "minute");
  if (abs < DAY) return relativeShort.format(Math.round(diff / HOUR), "hour");
  if (abs < 7 * DAY) return relativeShort.format(Math.round(diff / DAY), "day");
  const date = new Date(seconds * 1000);
  return date.getFullYear() === new Date(now * 1000).getFullYear() ? dayInYear.format(date) : shortDate.format(date);
}

/** How long ago `seconds` was, in months or years, for "no commits for 8 months". */
export function idleFor(seconds: number, now = Date.now() / 1000): string {
  const months = Math.floor((now - seconds) / (30.44 * DAY));
  if (months < 12) return plural(Math.max(months, 1), "month");
  const years = Math.floor(months / 12);
  return years === 1 ? t("over a year") : t("over {0} years", years);
}

const longDateUtc = new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export function fullDate(seconds: number): string {
  return longDate.format(new Date(seconds * 1000));
}

/** The date and time on the clock of whoever made the commit, given their UTC offset in seconds. */
export function dateInZone(seconds: number, offset: number): string {
  return longDateUtc.format(new Date((seconds + offset) * 1000));
}

/** A timezone offset in seconds as "UTC+02:00". */
export function utcOffset(offset: number): string {
  const sign = offset < 0 ? "−" : "+";
  const abs = Math.abs(offset);
  const hours = String(Math.floor(abs / HOUR)).padStart(2, "0");
  const minutes = String(Math.floor((abs % HOUR) / MINUTE)).padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[words.length - 1][0];
  return letters.toUpperCase();
}

export function shortId(id: string): string {
  return id.slice(0, 7);
}

/** "3 commits": a count and its noun, given in English, in the language in use. */
export function plural(count: number, word: string, pluralWordEn = `${word}s`): string {
  return `${count.toLocaleString(locale())} ${pluralWord(count, word, pluralWordEn)}`;
}

/** A list in words: "a", "a and b", "a, b and c". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return t("{0} and {1}", items.slice(0, -1).join(", "), items[items.length - 1]);
}

/** "48 MB", like Git LFS shows sizes (powers of 1000). */
export function formatBytes(bytes: number): string {
  const units = ["bytes", t("KB"), t("MB"), t("GB"), t("TB")];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  if (unit === 0) return `${bytes} ${pluralWord(bytes, "byte")}`;
  return `${value >= 100 ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")} ${units[unit]}`;
}
