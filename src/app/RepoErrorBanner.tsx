import { useEffect, useState, type ReactNode } from "react";
import { unseenCommits, upstreamChoices, type Action, type CommitRow, type UnseenCommits, type UpstreamChoices } from "../api";
import { ErrorBanner, type ErrorChoice } from "../components/ErrorBanner";
import { byWhom, explainError, gitHeadline, type ErrorFix } from "../lib/explainError";
import { relativeTime, shortId } from "../lib/format";
import type { Running } from "./constants";
import type { RepoError } from "./useRepository";
import { useOpenRepository } from "./OpenRepository";
import { t, tx } from "../lib/i18n";

interface Props {
  error: RepoError;
  /** The checked-out commit's row, for a new branch from it. */
  head: CommitRow | undefined;
  running: Running;
  onDismiss: () => void;
}

/**
 * The last error, in plain words when it's one git often gives, with what can be done about
 * it. A force push that stopped for someone else's commits lists them.
 */
export function RepoErrorBanner({ error, head, running, onDismiss }: Props) {
  const { snapshot, act, openDialog, openTab: openWorktree, goTo } = useOpenRepository();
  const branch = snapshot.headBranch ?? "HEAD";
  const upstream = snapshot.upstream?.name ?? null;
  // A safe force push stopped for commits someone else pushed: the push fetched them, to
  // be listed here.
  const stale = error.kind?.kind === "staleLease";
  const [unseen, setUnseen] = useState<UnseenCommits | null>(null);
  useEffect(() => {
    if (!stale || !upstream) return;
    let live = true;
    unseenCommits(snapshot.path, upstream, error.upstreamWas ?? null)
      .then((found) => live && setUnseen(found))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [stale, snapshot.path, upstream, error.upstreamWas, error.message]);

  // The branch's remote branch is gone: what it could go with instead.
  const gone = error.kind?.kind === "upstreamGone";
  const [others, setOthers] = useState<UpstreamChoices | null>(null);
  useEffect(() => {
    if (!gone || !snapshot.headBranch) return;
    let live = true;
    upstreamChoices(snapshot.path, snapshot.headBranch)
      .then((found) => live && setOthers(found))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [gone, snapshot.path, snapshot.headBranch, error.message]);

  // Whose commits they are: who pushed them isn't known (a merge brings in others' commits).
  const by = unseen ? byWhom(unseen.commits.map((commit) => commit.author), unseen.count > unseen.commits.length) : null;
  const explained = explainError(error.kind ?? null, { branch, upstream, unseen: unseen && unseen.count > 0 ? { count: unseen.count, by } : null });
  const headline = explained?.headline ?? gitHeadline(error.message);
  const busy = running !== null;

  const choice = (fix: ErrorFix): ErrorChoice | null => {
    switch (fix) {
      case "sync":
        return {
          label: t("Sync"),
          says: (
            <>
              {tx("Get their commits, then push yours on top. {0}", <b>{t("Nothing is lost.")}</b>)}
            </>
          ),
          run: () => act({ kind: "sync" }),
          disabled: busy,
        };
      case "forcePush":
        return {
          label: t("Force push…"),
          says: (
            <>
              {tx("Replace {0} with your {1}. {2}", upstream ?? t("the remote branch"), branch, <b>{t("Their commits are removed from it.")}</b>)}
            </>
          ),
          run: () => openDialog({ kind: "forcePush" }),
          disabled: busy,
        };
      case "forcePushAnyway":
        return {
          label: t("Force push anyway…"),
          says: (
            <>
              {unseen?.count === 1
                ? tx("Replace it with your {0}. {1}, and a copy is kept in Repository → Restore.", branch, <b>{t("It's removed from {0}", upstream ?? t("the remote branch"))}</b>)
                : tx("Replace them with your {0}. {1}, and a copy is kept in Repository → Restore.", branch, <b>{t("They're removed from {0}", upstream ?? t("the remote branch"))}</b>)}
            </>
          ),
          run: () => openDialog({ kind: "forcePush", overwrite: true }),
          disabled: busy,
        };
      case "showUnseen": {
        const newest = unseen?.commits[0];
        return newest
          ? { label: unseen.count === 1 ? t("Show it") : t("Show them"), says: unseen.count === 1 ? t("Go to it in the history.") : t("Go to the newest in the history."), run: () => goTo(newest.id) }
          : null;
      }
      case "retry":
        return error.action
          ? { label: t("Try again"), says: t("Run it again."), run: () => act(error.action!), disabled: busy }
          : null;
      case "push":
        return {
          label: t("Push"),
          says: t("Push {0}, which links it to a branch of the same name on the remote.", branch),
          run: () => act({ kind: "push", force: false }),
          disabled: busy,
        };
      case "stash":
        return error.retry ? stashChoice(error.retry) : null;
      case "newBranch":
        return head
          ? {
              label: t("New branch…"),
              says: t("Make a branch for your commits, push it, and open a pull request from it."),
              run: () => openDialog({ kind: "newBranch", target: head }),
              disabled: busy,
            }
          : null;
      case "useUpstream": {
        const suggested = others?.suggested;
        if (!suggested || !others) return null;
        const why = suggested === others.defaultBranch ? t("It's {0}'s main branch", others.remote) : t("It has the same name as your {0}", branch);
        return {
          label: t("Use {0}", suggested),
          says: t("Pull from and push to {0} from now on. {1}{2}", suggested, why, others.suggestedHasAll ? t(", and has everything {0} had.", others.gone) : "."),
          run: () => act({ kind: "setUpstream", branch, upstream: suggested }),
          disabled: busy,
        };
      }
      case "chooseUpstream":
        return {
          label: others?.suggested ? t("Choose another…") : t("Choose…"),
          says: t("Pick which of {0}'s branches {1} goes with.", others?.remote ?? t("the remote"), branch),
          run: () => openDialog({ kind: "chooseUpstream", branch }),
          disabled: busy,
        };
      case "pushBack":
        return {
          label: t("Push {0}", branch),
          says: t("Put {0} back on {1}, as a branch of its own.", branch, others?.remote ?? t("the remote")),
          run: () => act({ kind: "push", force: false }),
          disabled: busy,
        };
      case "moveToLfs":
        return { label: t("Move into Git LFS…"), says: t("See which files are too big, and move them into Git LFS."), run: () => openDialog({ kind: "repoSize" }) };
    }
  };
  const stashChoice = (retry: Action): ErrorChoice => ({
    label: t("Stash changes and retry"),
    says: t("Put your changes aside, do it, then bring them back."),
    run: () => act(retry),
    disabled: busy,
  });

  const fixes = explained?.fixes ?? [];
  const choices = fixes.map(choice).filter((found): found is ErrorChoice => found !== null);
  // What the error came with, beyond what the words above offer.
  if (error.retry && !fixes.includes("stash")) choices.push(stashChoice(error.retry));
  if (error.anyway) {
    const anyway = error.anyway;
    choices.push({ label: t("Download anyway"), says: t("If the disk fills up, the download stops partway."), run: () => act(anyway), disabled: busy });
  }
  if (error.worktree) {
    const worktree = error.worktree;
    choices.push({ label: t("Open that worktree"), says: t("It's checked out in that working tree: open it in its own tab."), run: () => openWorktree(worktree) });
  }

  let detail: ReactNode = explained?.detail;
  if (stale && unseen && unseen.count > 0) detail = `${explained?.detail ?? ""} ${unseen.count === 1 ? t("It would be:") : t("These would be:")}`;
  // git's own words, when there's more to them than the headline.
  const raw = error.message.trim() !== headline ? error.message.trim() : undefined;

  return (
    <ErrorBanner headline={headline} detail={detail} choices={choices} raw={raw} onDismiss={onDismiss}>
      {stale && unseen && unseen.count > 0 && (
        <ul className="error-commits">
          {unseen.commits.map((commit) => (
            <li key={commit.id}>
              <code>{shortId(commit.id)}</code>
              <strong>{commit.summary}</strong>
              <span>
                {commit.author}, {relativeTime(commit.time)}
              </span>
            </li>
          ))}
          {unseen.count > unseen.commits.length && <li className="error-commits-more">{tx("and {0} more", unseen.count - unseen.commits.length)}</li>}
        </ul>
      )}
    </ErrorBanner>
  );
}
