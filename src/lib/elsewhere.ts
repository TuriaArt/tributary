import type { OtherChange, Overlap } from "../api";
import { baseName } from "./paths";
import { plural, relativeTime } from "./format";
import { pluralWord, t } from "./i18n";

/** "origin/art/lighting, by Rosa Bell 2 days ago". */
export function describeChange(change: OtherChange, now?: number): string {
  return t("{0}, by {1} {2}", change.branch, change.author, relativeTime(change.time, now));
}

/** For a file's mark: where else it changed, and what that means. */
export function overlapTitle(overlap: Overlap, now?: number): string {
  const where = overlap.elsewhere.map((change) => t("Also changed on {0}", describeChange(change, now))).join("\n");
  return `${where}\n${
    overlap.unmergeable ? t("It can't be merged: one version will have to win.") : t("Git can usually merge both changes.")
  }`;
}

/**
 * The warning's first line: the one file and where, or how many. Files that can't be
 * merged come first and set the tone.
 */
export function overlapHeadline(overlaps: Overlap[], now?: number): string {
  const assets = overlaps.filter((overlap) => overlap.unmergeable);
  if (overlaps.length === 1) {
    const [only] = overlaps;
    const latest = only.elsewhere[0];
    const others = only.elsewhere.length > 1 ? t(" (and {0} more {1})", only.elsewhere.length - 1, pluralWord(only.elsewhere.length - 1, "branch", "branches")) : "";
    return t("{0} was also changed on {1}{2}.", baseName(only.path), describeChange(latest, now), others);
  }
  if (assets.length > 0) {
    const files = assets.length === 1 ? t("{0} and {1} more", baseName(assets[0].path), overlaps.length - 1) : plural(overlaps.length, "file");
    return t("{0} you're changing were also changed on other branches.", files);
  }
  return t("{0} files you're changing were also changed on other branches.", overlaps.length);
}

/** Another branch, and the files you're changing that it also changed. */
export interface BranchOverlap {
  branch: string;
  /** Each file, with that branch's latest change to it. */
  files: { overlap: Overlap; change: OtherChange }[];
  /** Who changed them, the most recent first. */
  authors: string[];
  /** When it last changed one of them. */
  latest: number;
  /** How many of them can't be merged. */
  assets: number;
}

/**
 * The overlaps by branch: branches with files that can't be merged first, then the ones
 * changed most recently.
 */
export function byBranch(overlaps: Overlap[]): BranchOverlap[] {
  const branches = new Map<string, BranchOverlap>();
  for (const overlap of overlaps) {
    for (const change of overlap.elsewhere) {
      let entry = branches.get(change.branch);
      if (!entry) {
        entry = { branch: change.branch, files: [], authors: [], latest: 0, assets: 0 };
        branches.set(change.branch, entry);
      }
      entry.files.push({ overlap, change });
      entry.latest = Math.max(entry.latest, change.time);
      if (overlap.unmergeable) entry.assets++;
    }
  }
  for (const entry of branches.values()) {
    entry.files.sort((a, b) => Number(b.overlap.unmergeable) - Number(a.overlap.unmergeable) || b.change.time - a.change.time);
    const seen = new Set<string>();
    for (const { change } of [...entry.files].sort((a, b) => b.change.time - a.change.time)) {
      if (!seen.has(change.author)) {
        seen.add(change.author);
        entry.authors.push(change.author);
      }
    }
  }
  return [...branches.values()].sort((a, b) => Number(b.assets > 0) - Number(a.assets > 0) || b.latest - a.latest);
}

/** "Rosa Bell", "Rosa Bell and Theo Park", "Rosa Bell, Theo Park and 2 others". */
export function people(names: string[]): string {
  if (names.length <= 1) return names.join("");
  if (names.length === 2) return t("{0} and {1}", names[0], names[1]);
  const others = names.length - 2;
  return others === 1 ? t("{0}, {1} and 1 other", names[0], names[1]) : t("{0}, {1} and {2} others", names[0], names[1], others);
}
