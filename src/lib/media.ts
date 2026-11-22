import type { FileDiff } from "../api";
import { formatBytes } from "./format";
import { t } from "./i18n";

/** A data: URL's bytes (fetching it isn't allowed by the page's content policy). */
export function dataUrlBytes(url: string): ArrayBuffer {
  const base64 = url.slice(url.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** "1:05" or "0:03.4" for short ones. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  if (seconds < 10) return `0:0${seconds.toFixed(1)}`;
  const whole = Math.round(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** What a file was and became, when it isn't shown line by line. */
export function describeSizes(diff: FileDiff): string {
  const { sizeBefore: before, sizeAfter: after } = diff;
  if (before === null && after !== null) return `Added, ${formatBytes(after)}`;
  if (before !== null && after === null) return t("Deleted (it was {0})", formatBytes(before));
  if (before !== null && after !== null) return before === after ? t("{0}, the same size", formatBytes(after)) : `${formatBytes(before)} → ${formatBytes(after)}`;
  return "";
}

/** Why one side has nothing to show: it wasn't there, was deleted, or is too big. */
export function missingSide(diff: Pick<FileDiff, "sizeBefore" | "sizeAfter">, side: "before" | "after"): string {
  const size = side === "before" ? diff.sizeBefore : diff.sizeAfter;
  if (size !== null) return t("Too big to show here ({0})", formatBytes(size));
  return side === "before" ? t("Not there yet") : t("Deleted");
}
