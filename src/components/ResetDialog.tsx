import { useMemo, useState } from "react";
import { runAction, type CommitRow, type RepoSnapshot } from "../api";
import { ancestors, countMissing } from "../lib/graph";
import { joinAnd, plural, shortId } from "../lib/format";
import { Dialog } from "./Dialog";
import { TypeToConfirm } from "./Safety";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  snapshot: RepoSnapshot;
  target: CommitRow;
  /** The checked-out branch, when it's protected: its name must be typed to go ahead. */
  protectedName?: string | null;
  onCancel: () => void;
  /** Called with git's result message once the reset worked. */
  onDone: (message: string) => void;
  /** Throw away every uncommitted change, new files too, to undo later (the action's runner does it). */
  onDiscardAll: () => void;
}

/**
 * Asks for confirmation before `git reset --hard`, saying exactly what will be lost. To the
 * checked-out commit, it only discards uncommitted changes: then new files go too, and it can
 * be undone (except while a merge or rebase is under way, which a reset ends).
 */
export function ResetDialog({ snapshot, target, protectedName, onCancel, onDone, onDiscardAll }: Props) {
  const [typed, setTyped] = useState("");
  const confirmed = !protectedName || typed.trim() === protectedName;
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const branch = snapshot.headBranch ?? "HEAD";
  // Resetting to the current commit only throws away uncommitted changes.
  const discardOnly = target.id === snapshot.headCommit;
  // That's discarding them all, new files too, to put back later; not in a merge or a rebase.
  const discardAll = discardOnly && !snapshot.operation;

  const { head, leaving, lostFiles, untrackedFiles, newFolders } = useMemo(() => {
    const byId = new Map(snapshot.commits.map((commit) => [commit.id, commit]));
    const leaving = countMissing(ancestors(snapshot.headCommit, byId), ancestors(target.id, byId));
    const changes = [...(snapshot.worktree?.staged ?? []), ...(snapshot.worktree?.unstaged ?? [])];
    const lost = new Set(changes.filter((f) => f.status !== "untracked").map((f) => f.path));
    // A new folder is listed as itself ("exports/"), however many files are in it.
    const untracked = changes.filter((f) => f.status === "untracked");
    const newFolders = untracked.filter((f) => f.path.endsWith("/")).length;
    const head = snapshot.headCommit ? byId.get(snapshot.headCommit) : undefined;
    return { head, leaving, lostFiles: lost.size, untrackedFiles: untracked.length - newFolders, newFolders };
  }, [snapshot, target]);

  const reset = async () => {
    setRunning(true);
    setError(null);
    try {
      onDone(await runAction(snapshot.path, { kind: "resetHard", id: target.id }));
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  };

  return (
    <Dialog
      title={discardOnly ? t("Discard all uncommitted changes?") : t("Hard reset {0}?", branch)}
      error={error}
      busy={running}
      onCancel={onCancel}
      buttons={
        <>
          <Button kind="secondary" onClick={onCancel} disabled={running} autoFocus={!protectedName}>
            {t("Cancel")}
          </Button>
          <Button kind="danger" onClick={discardAll ? onDiscardAll : reset} disabled={running || !confirmed}>
            {running ? (discardOnly ? t("Discarding…") : t("Resetting…")) : discardOnly ? t("Discard changes") : t("Reset {0}", branch)}
          </Button>
        </>
      }
    >
      {discardAll ? (
        <p>{t("Your files will be changed back to how they are in the last commit, and new files will be deleted.")}</p>
      ) : discardOnly ? (
        <p>{t("Your files will be changed back to how they are in the last commit.")}</p>
      ) : (
      <p>
        {tx("{0} will point to {1}{2}, and your files will be changed to match it.", <strong>{branch}</strong>, <CommitRef commit={target} />, head && head.id !== target.id && (
          <>
            {" "}{tx("instead of {0}", <CommitRef commit={head} />)}
          </>
        ))}
      </p>
      )}
      <ul className="dialog-consequences">
        {leaving > 0 && (
          <li>
            {tx("{0} will no longer be on {1}. You can still get them back with {2} for a while.", plural(leaving, "commit"), branch, <code>git reflog</code>)}
          </li>
        )}
        {discardAll ? (
          <>
            {lostFiles > 0 && <li className="danger">{tx("Changes to {0} will be discarded.", plural(lostFiles, "file"))}</li>}
            {untrackedFiles + newFolders > 0 && (
              <li className="danger">
                {tx("{0} will be deleted{1}.", joinAnd([untrackedFiles > 0 ? plural(untrackedFiles, "new file") : "", newFolders > 0 ? plural(newFolders, "new folder") : ""].filter(Boolean)), newFolders === 0 ? "" : newFolders === 1 ? t(", with everything in it") : t(", with everything in them"))}
              </li>
            )}
            <li>{t("You can put them back with Undo, for 30 days.")}</li>
          </>
        ) : (
          <>
            {lostFiles > 0 && (
              <li className="danger">
                {tx("Uncommitted changes to {0} will be discarded. This can't be undone.", plural(lostFiles, "file"))}
              </li>
            )}
            {untrackedFiles + newFolders > 0 && <li>{t("New files are kept.")}</li>}
            {leaving === 0 && lostFiles === 0 && <li>{t("No commits or uncommitted changes will be lost.")}</li>}
          </>
        )}
      </ul>
      {protectedName && <TypeToConfirm name={protectedName} value={typed} onChange={setTyped} />}
    </Dialog>
  );
}

export function CommitRef({ commit }: { commit: CommitRow }) {
  return (
    <span className="commit-ref" title={commit.summary}>
      <code>{shortId(commit.id)}</code> {commit.summary}
    </span>
  );
}
