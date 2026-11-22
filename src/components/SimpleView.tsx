import { useEffect, useMemo, useState } from "react";
import { commitsBetween, type Action, type FileChange, type FileChecks, type Overlap, type RepoSnapshot } from "../api";
import type { Running } from "../app/constants";
import type { LfsLocks } from "../lib/locks";
import { plural, relativeTime } from "../lib/format";
import { baseName, folderOf } from "../lib/paths";
import type { OpenDialog } from "../menus";
import { Avatar } from "./Avatar";
import { FileKindIcon } from "./FileKindIcon";
import { BranchIcon, CheckIcon, FetchIcon, HistoryIcon, LockIcon, PullIcon, PushIcon, ShelfIcon, ViewIcon, WarningIcon } from "./Icons";
import type { CommitDraft } from "./worktree/CommitBox";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  snapshot: RepoSnapshot;
  ahead: number;
  behind: number;
  running: Running;
  act: (action: Action, options?: { quiet?: boolean }) => Promise<boolean>;
  locks: LfsLocks;
  checks: FileChecks | null;
  localBranches: string[];
  /** The commit message, shared with the full view's commit box. */
  draft: CommitDraft;
  setDraft: (draft: CommitDraft) => void;
  openDialog: (dialog: OpenDialog) => void;
  onFullView: () => void;
  /** Files you're changing that other branches changed too. */
  overlaps: Overlap[];
}

/** Each changed file once, staged or not, without conflicts. */
function changedFiles(snapshot: RepoSnapshot): FileChange[] {
  const byPath = new Map<string, FileChange>();
  for (const file of [...(snapshot.worktree?.staged ?? []), ...(snapshot.worktree?.unstaged ?? [])]) {
    if (file.status !== "conflicted" && !byPath.has(file.path)) byPath.set(file.path, file);
  }
  return [...byPath.values()];
}

const pathsOf = (files: FileChange[]) => files.flatMap((file) => (file.oldPath ? [file.oldPath, file.path] : [file.path]));

/**
 * Simple mode, for people who'd rather not think in branches and graphs: get the latest,
 * your changes with their locks and Submit (commit and push in one), and who's working on
 * what. The full view is a click away.
 */
export function SimpleView({ snapshot, ahead, behind, running, act, locks, checks, localBranches, draft, setDraft, openDialog, onFullView, overlaps }: Props) {
  const busy = running !== null;
  const canChange = !snapshot.bare;
  const files = useMemo(() => changedFiles(snapshot), [snapshot]);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const chosen = files.filter((file) => !left.has(file.path));
  const toggle = (path: string) =>
    setLeft((now) => {
      const next = new Set(now);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  // Who the updates are from.
  const upstream = snapshot.upstream?.commit ?? null;
  const [from, setFrom] = useState<string[]>([]);
  useEffect(() => {
    if (!upstream || !snapshot.headCommit || behind === 0) {
      setFrom([]);
      return;
    }
    let current = true;
    commitsBetween(snapshot.path, snapshot.headCommit, upstream)
      .then((between) => current && setFrom(between.authors))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [snapshot.path, snapshot.headCommit, upstream, behind]);

  const lockedByOthers = chosen.filter((file) => locks.byPath.get(file.path) && !locks.byPath.get(file.path)!.mine);
  const lockable = new Set(checks?.lockable ?? []);
  const large = new Set((checks?.large ?? []).map((file) => file.path));
  const message = [draft.summary.trim(), draft.description.trim()].filter(Boolean).join("\n\n");

  const submit = async () => {
    if (chosen.length === 0 || !draft.summary.trim() || lockedByOthers.length > 0) return;
    // Exactly the chosen files go in.
    const chosenPaths = new Set(chosen.map((file) => file.path));
    const unchoose = (snapshot.worktree?.staged ?? []).filter((file) => !chosenPaths.has(file.path));
    if (unchoose.length > 0 && !(await act({ kind: "unstage", paths: pathsOf(unchoose) }, { quiet: true }))) return;
    if (!(await act({ kind: "stage", paths: pathsOf(chosen) }, { quiet: true }))) return;
    if (!(await act({ kind: "commit", message, amend: false }, { quiet: true }))) return;
    setDraft({ summary: "", description: "", amend: false });
    setLeft(new Set());
    // The team's updates first, or the server turns it away.
    if (behind > 0 && !(await act({ kind: "pull" }))) return;
    await act({ kind: "push", force: false });
  };
  const send = () => void act({ kind: "push", force: false });

  const status = !snapshot.upstream
    ? { text: t("Not on the server yet"), tone: "warning" }
    : behind > 0
      ? { text: t("{0} to get", plural(behind, "update")), tone: "accent" }
      : ahead > 0
        ? { text: t("{0} to send", plural(ahead, "change")), tone: "accent" }
        : { text: t("Up to date"), tone: "good" };
  const othersLocks = (locks.locks?.locks ?? []).filter((lock) => !lock.mine).slice(0, 6);
  const recent = snapshot.commits.filter((commit) => commit.kind !== "worktree" && commit.kind !== "stash").slice(0, 6);

  return (
    <div className="simple-view">
      <header className="simple-header" data-tour="simple-header">
        <label className="simple-branch" title={t("The branch you're working on")}>
          <BranchIcon size={15} />
          <select
            value={snapshot.headBranch ?? ""}
            disabled={busy || !canChange || localBranches.length < 2}
            onChange={(event) => void act({ kind: "checkoutBranch", name: event.target.value })}
            aria-label={t("Branch")}
          >
            {!snapshot.headBranch && <option value="">{t("No branch")}</option>}
            {localBranches.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
        </label>
        <span className={`simple-status ${status.tone}`}>
          {status.tone === "good" && <CheckIcon size={12} />}
          {status.text}
        </span>
        <span className="spacer" />
        <Button kind="outline" onClick={() => openDialog({ kind: "shelves" })}>
          <ShelfIcon size={14} />
          <span className="button-label">{t("Shelves")}</span>
        </Button>
        <Button kind="outline" onClick={() => openDialog({ kind: "localHistory" })}>
          <HistoryIcon size={14} />
          <span className="button-label">{t("Local history")}</span>
        </Button>
        <Button kind="outline" onClick={onFullView} title={t("Branches, the commit graph and everything else")}>
          <ViewIcon size={14} />
          <span className="button-label">{t("Full view")}</span>
        </Button>
      </header>

      <div className="simple-columns">
        <section className="simple-card simple-changes" data-tour="simple-changes">
          <div className="simple-card-head">
            <h2>{t("My changes")}</h2>
            <span className="simple-count">{files.length > 0 ? plural(files.length, "file") : ""}</span>
          </div>
          {files.length === 0 ? (
            <div className="simple-empty">
              {ahead > 0 ? (
                <>
                  <p>{tx("{0} saved here but not sent to the team yet.", plural(ahead, "change"))}</p>
                  <Button kind="primary" size="large" onClick={send} disabled={busy || !canChange}>
                    {ahead === 1 ? tx("{0}Send it", <PushIcon size={15} />) : tx("{0}Send them", <PushIcon size={15} />)}
                  </Button>
                </>
              ) : (
                <p>{t("No changes. Files you change in your project show up here, to submit for the team.")}</p>
              )}
            </div>
          ) : (
            <>
              <ul className="simple-files">
                {files.map((file) => {
                  const lock = locks.byPath.get(file.path);
                  const other = overlaps.find((overlap) => overlap.path === file.path)?.elsewhere[0];
                  return (
                    <li key={file.path} className={left.has(file.path) ? "left-out" : undefined}>
                      <label className="checkbox">
                        <input type="checkbox" checked={!left.has(file.path)} onChange={() => toggle(file.path)} />
                        <FileKindIcon path={file.path} size={15} />
                        <span className="simple-file-name">{baseName(file.path)}</span>
                        <span className="simple-file-dir">{file.status === "untracked" ? "new" : folderOf(file.path)}</span>
                      </label>
                      {other && (
                        <span
                          className="simple-badge warning"
                          title={t("{0} changed it on {1} too, {2}: talk before you both submit", other.author, other.branch, relativeTime(other.time))}
                        >
                          {tx("{0} changed it too", other.author.split(" ")[0])}
                        </span>
                      )}
                      {large.has(file.path) && (
                        <span className="simple-badge warning" title={t("It's big and not stored with Git LFS: everyone who clones downloads every version of it")}>
                          {t("Big file")}
                        </span>
                      )}
                      {lock ? (
                        <span className={`simple-badge ${lock.mine ? "mine" : "danger"}`} title={lock.mine ? t("You hold its lock") : t("{0} holds its lock: your changes can't be submitted", lock.owner)}>
                          <LockIcon size={11} />
                          {lock.mine ? t("Locked by you") : t("Locked by {0}", lock.owner)}
                        </span>
                      ) : lockable.has(file.path) ? (
                        <button
                          className="simple-badge lock-it"
                          disabled={busy || !canChange}
                          title={t("Lock it, so nobody else changes it at the same time")}
                          onClick={() => void act({ kind: "lockFiles", paths: [file.path] })}
                        >
                          {tx("{0}Lock", <LockIcon size={11} />)}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              <div className="simple-message">
                <input
                  className="text-input"
                  value={draft.summary}
                  onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
                  placeholder={t("What did you change?")}
                  aria-label={t("What you changed")}
                />
                <textarea
                  className="text-input"
                  value={draft.description}
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder={t("More about it, if it helps (optional)")}
                  aria-label={t("More about it")}
                  rows={2}
                />
              </div>
              {lockedByOthers.length > 0 && (
                <p className="simple-warning">
                  <WarningIcon size={13} />
                  {lockedByOthers.length === 1
                    ? t("{0} is locked by {1}: leave it out, or ask them to unlock it.", baseName(lockedByOthers[0].path), locks.byPath.get(lockedByOthers[0].path)?.owner)
                    : t("{0} are locked by someone else: leave them out, or ask for them to be unlocked.", plural(lockedByOthers.length, "file"))}
                </p>
              )}
              <div className="simple-submit">
                <Button
                  kind="primary" size="large"
                  onClick={() => void submit()}
                  disabled={busy || !canChange || chosen.length === 0 || !draft.summary.trim() || lockedByOthers.length > 0}
                  title={t("Commit these files and send them to the team")}
                >
                  {tx("{0}Submit {1}", <PushIcon size={15} />, plural(chosen.length, "file"))}
                </Button>
              </div>
            </>
          )}
        </section>

        <div className="simple-side">
          <section className="simple-card simple-latest" data-tour="simple-latest">
            <div className="simple-card-head">
              <h2>{t("Get latest")}</h2>
              <Button kind="link" onClick={() => void act({ kind: "fetch" })} disabled={busy || !snapshot.upstream}>
                {tx("{0}Check now", <FetchIcon size={13} />)}
              </Button>
            </div>
            <p className="simple-latest-text">
              {!snapshot.upstream
                ? t("This branch isn't on the server yet: submitting sends it.")
                : behind > 0
                  ? `${plural(behind, "update")}${from.length > 0 ? t(" from {0}", `${from.slice(0, 3).join(", ")}${from.length > 3 ? t(" and others") : ""}`) : ""}.`
                  : t("You have everything the team has sent.")}
              {snapshot.lastFetched ? <span className="simple-muted">{" "}{tx("Checked {0}.", relativeTime(snapshot.lastFetched))}</span> : null}
            </p>
            <Button kind="primary" size="large" className="simple-get" onClick={() => void act({ kind: "pull" })} disabled={busy || !canChange || !snapshot.upstream}>
              {tx("{0}Get latest", <PullIcon size={16} />)}
            </Button>
          </section>

          <section className="simple-card" data-tour="simple-team">
            <div className="simple-card-head">
              <h2>{t("The team")}</h2>
            </div>
            {othersLocks.length > 0 && (
              <>
                <h3 className="simple-subhead">{t("Working on")}</h3>
                <ul className="simple-locks">
                  {othersLocks.map((lock) => (
                    <li key={lock.id}>
                      <LockIcon size={12} />
                      <span className="simple-file-name">{baseName(lock.path)}</span>
                      <span className="simple-muted">{lock.owner}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <h3 className="simple-subhead">{t("Lately")}</h3>
            <ul className="simple-recent">
              {recent.map((commit) => (
                <li key={commit.id}>
                  <Avatar name={commit.authorName} email={commit.authorEmail} size={24} />
                  <span className="simple-recent-text">
                    <span className="simple-recent-summary">{commit.summary}</span>
                    <span className="simple-muted">
                      {commit.authorName} · {relativeTime(commit.time)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
