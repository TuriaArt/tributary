import type { Submodule } from "../api";
import { plural } from "./format";
import { t } from "./i18n";

/** A submodule's folder name, like "editor-kit". */
export function submoduleName(submodule: Submodule): string {
  return submodule.path.split("/").filter(Boolean).pop() ?? submodule.path;
}

/** A word or two about where it is, for the sidebar; null when it's where it should be. */
export function submoduleNote(submodule: Submodule): string | null {
  switch (submodule.state) {
    case "notSetUp":
      return t("not set up");
    case "behind":
    case "different":
      return t("out of date");
    case "ahead":
      return t("new commits");
    case "conflicted":
      return "conflicted";
    case "upToDate":
      return submodule.changed ? "changed" : null;
  }
}

/** The whole story, for a tooltip. */
export function submoduleTitle(submodule: Submodule): string {
  const lines = [submodule.path];
  if (submodule.url) lines.push(submodule.url);
  switch (submodule.state) {
    case "notSetUp":
      lines.push(t("Not set up yet: its files aren't here. Update it to clone it."));
      break;
    case "upToDate":
      lines.push(t("At the commit this repository records."));
      break;
    case "behind":
      lines.push(
        submodule.behind > 0
          ? t("{0} behind the commit this repository records. Update it to catch up.", plural(submodule.behind, "commit"))
          : t("Not at the commit this repository records (it isn't downloaded yet). Update it to catch up."),
      );
      break;
    case "ahead":
      lines.push(t("{0} in it. Commit it here to record them.", plural(submodule.ahead, "new commit")));
      break;
    case "different":
      lines.push(t("At a different commit from the one this repository records. Update it to go back to that one."));
      break;
    case "conflicted":
      lines.push(t("Both sides of the merge moved it. Stage the commit you want it at."));
      break;
  }
  if (submodule.changed) lines.push(t("It has uncommitted changes of its own."));
  return lines.join("\n");
}

/**
 * Set up, but not where this repository says it should be. Ahead counts only for the
 * submodules in `moved` (left there by a checkout or pull, rather than new work).
 */
export function outOfDate(submodules: Submodule[], moved: ReadonlySet<string> = new Set()): Submodule[] {
  return submodules.filter(
    (submodule) => submodule.state === "behind" || submodule.state === "different" || (submodule.state === "ahead" && moved.has(submodule.path)),
  );
}

/** What the banner says about submodules out of date, or not set up; null when there's nothing to say. */
export function submoduleNotice(submodules: Submodule[], moved: ReadonlySet<string> = new Set()): { text: string; paths: string[]; action: string } | null {
  const late = outOfDate(submodules, moved);
  if (late.length > 0) {
    const names = late.map(submoduleName);
    const [only] = late;
    const one =
      only.state === "behind"
        ? t("Your copy of the submodule {0} is older than the version this branch uses.", names[0])
        : only.state === "ahead"
          ? t("Your copy of the submodule {0} is newer than the version this branch uses.", names[0])
          : t("Your copy of the submodule {0} isn't the version this branch uses.", names[0]);
    return {
      text:
        late.length === 1
          ? one
          : t("Your copies of {0} submodules ({1}) aren't the versions this branch uses.", late.length, names.join(", ")),
      paths: late.map((submodule) => submodule.path),
      action: late.length === 1 ? "Update it" : "Update them",
    };
  }
  const missing = submodules.filter((submodule) => submodule.state === "notSetUp");
  if (missing.length > 0 && missing.length === submodules.length) {
    return {
      text:
        missing.length === 1
          ? t("The submodule {0} isn't set up yet: its files aren't here.", submoduleName(missing[0]))
          : t("This repository's {0} submodules aren't set up yet: their files aren't here.", missing.length),
      paths: missing.map((submodule) => submodule.path),
      action: missing.length === 1 ? "Set it up" : "Set them up",
    };
  }
  return null;
}

/** What a submodule is, and why one gets out of date, for the banner's tooltip. */
export const SUBMODULE_EXPLAINED =
  t("A submodule is another repository kept inside this one (a library, say), pinned to one of its commits. ") +
  t("Each branch says which commit it uses. When a pull or a checkout changes that, git leaves the submodule's folder ") +
  t("as it was until you update it, so you'd be building with the wrong version.");
