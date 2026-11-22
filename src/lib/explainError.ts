/**
 * git's errors in plain words: what happened, and what can be done about it. git's own
 * message stays available beside it, for whoever wants the details.
 */
import type { ErrorKind } from "../api/invoke";
import { plural } from "./format";
import { t } from "./i18n";

/** What can be done about an error, when the app can do it. */
export type ErrorFix =
  /** Get the remote branch's commits, then push this one's on top. */
  | "sync"
  /** Replace the remote branch with this one (asks first). */
  | "forcePush"
  /** Replace it even with commits someone else pushed since the last fetch (asks first). */
  | "forcePushAnyway"
  /** Go to the commits someone else pushed. */
  | "showUnseen"
  /** Run the same thing again (the network was down, say). */
  | "retry"
  /** Push the branch, which links it to a remote branch. */
  | "push"
  /** Put the changes in the way aside, do it, and bring them back. */
  | "stash"
  /** Make a branch for the commits (the branch they're on is protected). */
  | "newBranch"
  /** Move the files too big for the host into Git LFS. */
  | "moveToLfs"
  /** The branch's remote branch is gone: go with the likely one instead. */
  | "useUpstream"
  /** The branch's remote branch is gone: choose which of the remote's it goes with. */
  | "chooseUpstream"
  /** The branch's remote branch is gone: push it, which puts it back. */
  | "pushBack";

export interface Explained {
  /** What happened, in one line: "Push stopped: origin/main has commits you don't have yet". */
  headline: string;
  /** Why, in a sentence or two. */
  detail?: string;
  /** What can be done, the likeliest first. */
  fixes: ErrorFix[];
}

/** What was going on when it failed, for the words. */
export interface ErrorContext {
  /** The checked-out branch. */
  branch?: string | null;
  /** Its remote branch: "origin/main". */
  upstream?: string | null;
  /** The commits a force push stopped for, once they're known: how many, and whose ("Theo Park"). */
  unseen?: { count: number; by: string | null } | null;
}

const files = (count: number, what = "file") => plural(count, what);

/**
 * A failure in plain words, from its kind (the backend says which it is), or null when it
 * isn't one explained here: then its message is shown as it is.
 */
export function explainError(kind: ErrorKind | null, context: ErrorContext = {}): Explained | null {
  if (!kind) return null;
  // The branch a push was refused for, as git named it; else the checked-out one.
  const pushed = kind.kind === "pushRejected" || kind.kind === "staleLease" ? kind.branch : null;
  const branch = pushed ?? context.branch ?? t("the branch");
  const remoteBranch = context.upstream ?? (pushed ? t("the remote's {0}", branch) : t("the remote branch"));
  const where = "host" in kind ? kind.host : null;

  switch (kind.kind) {
    case "pushRejected":
      return {
        headline: t("Push stopped: {0} has commits you don't have yet", remoteBranch),
        detail: t("Someone pushed to {0} after you last fetched.", branch),
        fixes: ["sync", "forcePush"],
      };
    case "staleLease": {
      const { unseen } = context;
      return {
        headline: unseen
          ? t("Force push stopped: {0} has {1} you haven't fetched{2}", remoteBranch, unseen.count === 1 ? t("a commit") : plural(unseen.count, "commit"), unseen.by ? t(", by {0}", unseen.by) : "")
          : t("Force push stopped: {0} has commits you haven't fetched", remoteBranch),
        detail: t("A force push stops for commits you haven't seen, so they aren't removed by mistake."),
        fixes: ["forcePushAnyway", "showUnseen"],
      };
    }
    case "upstreamGone": {
      const remote = context.upstream?.split("/")[0] ?? t("the remote");
      return {
        headline: t("{0} has no branch called {1} any more", remote, kind.branch),
        detail: t("Your {0} pulls from {1}, which was renamed or deleted on {2}.", branch, remote === "the remote" ? kind.branch : `${remote}/${kind.branch}`, remote),
        fixes: ["useUpstream", "chooseUpstream", "pushBack"],
      };
    }
    case "notFastForward":
      return {
        headline: t("Pull stopped: {0} and {1} both have new commits", branch, remoteBranch),
        detail: t("git is set to only fast-forward (pull.ff = only), so it won't combine them."),
        fixes: ["sync"],
      };
    case "tooLarge":
      return {
        headline: t("{0} is too big for {1}", kind.file ?? t("A file"), where ?? "GitHub"),
        detail: t("GitHub takes files up to 100 MB. Bigger ones go in Git LFS."),
        fixes: ["moveToLfs"],
      };
    case "protected":
      return {
        headline: t("{0} is protected{1}", branch, where ? ` on ${where}` : ""),
        detail: t("Changes go into {0} through a pull request.", branch),
        fixes: ["newBranch"],
      };
    case "signIn":
      return {
        headline: t("git couldn't sign in to {0}", where ?? t("the remote")),
        detail: t("Sign in once with git in a terminal, or set up a credential helper, then try again."),
        fixes: ["retry"],
      };
    case "repositoryNotFound":
      return {
        headline: t("git can't find the repository{0}", where ? ` on ${where}` : ""),
        detail: t("Its address may be wrong (see Repository → Remotes), or you may not have access to it with the account git signs in with."),
        fixes: [],
      };
    case "unreachable":
      return {
        headline: t("Couldn't reach {0}", where ?? t("the remote")),
        detail: t("Check your internet connection (and VPN, if you use one), then try again."),
        fixes: ["retry"],
      };
    case "connectionDropped":
      return {
        headline: t("The connection to {0} dropped partway", where ?? t("the remote")),
        detail: t("Big pushes and pulls sometimes do on slow or unsteady connections. Try again."),
        fixes: ["retry"],
      };
    case "changesInTheWay":
      return kind.untracked
        ? {
            headline: kind.files > 0 ? kind.files === 1 ? t("{0} of yours is in the way", files(kind.files, "new file")) : t("{0} of yours are in the way", files(kind.files, "new file")) : t("New files of yours are in the way"),
            detail: t("Files with the same names would replace them."),
            fixes: ["stash"],
          }
        : {
            headline: kind.files > 0 ? t("Your changes to {0} are in the way", files(kind.files)) : t("Your changes are in the way"),
            detail: t("Doing this would overwrite them."),
            fixes: ["stash"],
          };
    case "noUpstream":
      return {
        headline: t("{0} isn't linked to a remote branch", branch),
        detail: t("git doesn't know which remote branch to pull from."),
        fixes: ["push"],
      };
    case "indexLocked":
      return {
        headline: t("Another git program is busy in this repository"),
        detail: t("Wait for it to finish. If none is running, one stopped halfway and left .git/index.lock behind: delete that file, then try again."),
        fixes: ["retry"],
      };
    case "unrelatedHistories":
      return {
        headline: t("These two histories have no commit in common"),
        detail: t("They don't come from the same repository, so git won't combine them."),
        fixes: [],
      };
    case "diskFull":
      return {
        headline: t("The disk is full"),
        detail: t("Make some room, then try again."),
        fixes: ["retry"],
      };
    case "noLfs":
      return {
        headline: t("Git LFS isn't installed"),
        detail: t("This repository keeps big files in Git LFS. Install it from git-lfs.com, then try again."),
        fixes: [],
      };
    default:
      // The rest have a banner or a dialog of their own, or their message says it all.
      return null;
  }
}

/**
 * The line of git's message that says what went wrong, for a headline when it isn't one of
 * the errors explained here: the first "fatal:" or "error:" line without that word, or else
 * the first line. "fatal: bad revision 'x'" → "Bad revision 'x'".
 */
export function gitHeadline(message: string): string {
  const lines = message
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const said = lines.find((line) => /^(?:fatal|error):\s/i.test(line)) ?? lines[0] ?? t("Something went wrong");
  const plain = said.replace(/^(?:fatal|error):\s+/i, "");
  // git's own words start lower case after "fatal:"; the app's are left as they are.
  return plain === said ? said : plain.charAt(0).toUpperCase() + plain.slice(1);
}

/**
 * Whose commits these are, by their authors: "Theo Park", "Theo Park and Rosa Bell", "Theo
 * Park and 2 others". With `more`, some commits weren't listed, so their authors aren't
 * known: "Theo Park and others".
 */
export function byWhom(authors: string[], more = false): string | null {
  const names = [...new Set(authors)];
  if (names.length === 0) return null;
  if (more) return t("{0} and others", names.slice(0, 2).join(", "));
  if (names.length === 1) return names[0];
  if (names.length === 2) return t("{0} and {1}", names[0], names[1]);
  return t("{0} and {1} others", names[0], names.length - 1);
}
