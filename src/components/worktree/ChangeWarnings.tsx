import type { Action, FileChange, FileChecks, Lock } from "../../api";
import { describeNameProblem } from "../../lib/fileNames";
import { describeMeta } from "../../lib/unityMeta";
import { formatBytes, plural } from "../../lib/format";
import { baseName } from "../../lib/paths";
import { LockIcon, WarningIcon } from "../Icons";
import { Button } from "../ui/Button";
import { t, tx } from "../../lib/i18n";

/** "*.umap" for "Content/Maps/Level.umap"; the path itself for a file without an extension. */
export function lfsPattern(path: string): string {
  const name = baseName(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? `*${name.slice(dot)}` : path;
}

interface Props {
  staged: FileChange[];
  unstaged: FileChange[];
  lockOf: (path: string) => Lock | undefined;
  /** Big files outside Git LFS and lockable files among the changes. */
  checks: FileChecks | null;
  /** The repository's server supports locking. */
  canLock: boolean;
  busy: boolean;
  run: (action: Action) => void;
}

/**
 * What to know before committing: changed files someone else has locked (pushing them
 * will be refused), big files that would go into git itself (with buttons to track them
 * with Git LFS), and lockable files nobody has locked yet.
 */
export function ChangeWarnings({ staged, unstaged, lockOf, checks, canLock, busy, run }: Props) {
  const lockedByOthers = [...staged, ...unstaged].filter((file) => {
    const lock = lockOf(file.path);
    return lock && !lock.mine;
  });
  const lockHolders = [...new Set(lockedByOthers.map((file) => lockOf(file.path)!.owner || t("someone else")))];
  // Grouped by the LFS pattern that would catch them.
  const large = checks?.large ?? [];
  const stagedPaths = new Set(staged.map((file) => file.path));
  const patterns = [...new Set(large.map((file) => lfsPattern(file.path)))];
  const unlocked = canLock ? (checks?.lockable ?? []).filter((path) => !lockOf(path)) : [];
  const names = checks?.names ?? [];
  const metas = checks?.metas ?? [];
  return (
    <>
    {metas.length > 0 && (
      <div className="file-warning large" role="status">
        <WarningIcon size={14} />
        <div>
          <div>
            {tx("{0} Unity finds assets by the id in their .meta, so a teammate's copy would lose whatever uses them.", metas.length === 1 ? t("A Unity .meta file is missing or wrong.") : t("{0} Unity .meta files are missing or wrong.", metas.length))}
          </div>
          <ul className="file-warning-list">
            {metas.slice(0, 6).map((problem) => (
              <li key={problem.path} title={problem.path}>
                <strong>{baseName(problem.path)}</strong> {describeMeta(problem)}
              </li>
            ))}
            {metas.length > 6 && <li>{tx("and {0}", plural(metas.length - 6, "more"))}</li>}
          </ul>
        </div>
      </div>
    )}
    {names.length > 0 && (
      <div className="file-warning large" role="status">
        <WarningIcon size={14} />
        <div>
          <div>
            {tx("{0} won't work on everyone's computer: a teammate's checkout fails, or goes wrong. Rename {1} before committing.", names.length === 1 ? t("A new file's name") : t("{0} new files' names", names.length), names.length === 1 ? "it" : "them")}
          </div>
          <ul className="file-warning-list">
            {names.slice(0, 6).map((problem) => (
              <li key={problem.path} title={problem.path}>
                <strong>{baseName(problem.path)}</strong>: {describeNameProblem(problem)}
              </li>
            ))}
            {names.length > 6 && <li>{tx("and {0}", plural(names.length - 6, "more file"))}</li>}
          </ul>
        </div>
      </div>
    )}
    {lockedByOthers.length > 0 && (
      <div className="lock-warning" role="status">
        <LockIcon size={13} />
        <span>
          {tx("{0}. You won't be able to push {1} until {2} unlocked.", lockedByOthers.length === 1 ? (
            <>
              {tx("{0} is locked by {1}", <strong>{lockedByOthers[0].path.split("/").pop()}</strong>, lockHolders[0])}
            </>
          ) : (
            <>
              {tx("{0} are locked by {1}", plural(lockedByOthers.length, "changed file"), lockHolders.join(", "))}
            </>
          ), lockedByOthers.length === 1 ? t("your changes to it") : "them", lockedByOthers.length === 1 ? "it's" : "they're")}
        </span>
      </div>
    )}
    {large.length > 0 && (
      <div className="file-warning large" role="status">
        <WarningIcon size={14} />
        <div>
          <div>
            {tx("{0} Committed like this, everyone who clones the repository downloads {1} forever.", large.length === 1 ? (
              <>
                {tx("{0} ({1}) isn't stored with Git LFS.", <strong>{baseName(large[0].path)}</strong>, formatBytes(large[0].size))}
              </>
            ) : (
              <>
                {tx("{0} big files ({1}) aren't stored with Git LFS.", large.length, formatBytes(large.reduce((sum, file) => sum + file.size, 0)))}
              </>
            ), large.length === 1 ? "it" : "them")}
          </div>
          <div className="file-warning-actions">
            {patterns.map((pattern) => (
              <Button
                key={pattern}
                kind="outline" size="small"
                disabled={busy}
                onClick={() =>
                  run({
                    kind: "trackWithLfs",
                    patterns: [pattern],
                    paths: large.filter((file) => lfsPattern(file.path) === pattern && stagedPaths.has(file.path)).map((file) => file.path),
                  })
                }
              >
                {tx("Track {0} with LFS", pattern)}
              </Button>
            ))}
          </div>
        </div>
      </div>
    )}
    {unlocked.length > 0 && (
      <div className="file-warning lockable" role="status">
        <LockIcon size={14} />
        <div>
          <div>
            {tx("{0} can be locked, and nobody has. Lock {1} before someone else starts on {2}.", unlocked.length === 1 ? <strong>{baseName(unlocked[0])}</strong> : t("{0} files you changed", unlocked.length), unlocked.length === 1 ? "it" : "them", unlocked.length === 1 ? "it" : "them")}
          </div>
          <div className="file-warning-actions">
            <Button kind="outline" size="small" disabled={busy} onClick={() => run({ kind: "lockFiles", paths: unlocked })}>
              {unlocked.length === 1 ? t("Lock it") : t("Lock {0} files", unlocked.length)}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
