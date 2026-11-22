import type { CommitRow } from "../api";
import { copyText } from "../lib/clipboard";
import { shortId } from "../lib/format";
import { Avatar } from "./Avatar";
import { CherryIcon, CloseIcon, CompareIcon, CopyIcon, RevertIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  /** The selected commits, in list order (newest first). */
  commits: CommitRow[];
  branch: string | null;
  canChange: boolean;
  onCherryPick: () => void;
  onRevert: () => void;
  onClose: () => void;
  /** Compare the two selected commits (shown when exactly two are). */
  onCompare?: () => void;
}

/** Shown instead of a commit's details while several commits are selected. */
export function MultiSelectPanel({ commits, branch, canChange, onCherryPick, onRevert, onClose, onCompare }: Props) {
  const merges = commits.filter((commit) => commit.parents.length > 1).length;
  const stashes = commits.some((commit) => commit.kind !== "commit");
  const blocked = merges > 0 ? t("Merge commits can only be cherry-picked or reverted one at a time.") : stashes ? t("Stashes can't be cherry-picked this way.") : null;
  const disabled = !canChange || !branch || blocked !== null;
  return (
    <aside className="details" aria-label={t("Selected commits")}>
      <header className="details-header">
        <span className="details-label">{tx("{0} commits selected", commits.length)}</span>
        <span className="spacer" />
        <Button kind="icon" onClick={onClose} title={t("Clear the selection (Esc)")} aria-label={t("Clear the selection")}>
          <CloseIcon />
        </Button>
      </header>
      <div className="details-scroll">
        <div className="details-actions">
          {onCompare && (
            <Button kind="outline" onClick={onCompare}>
              <CompareIcon size={14} />
              <span className="button-label">{t("Compare these two")}</span>
            </Button>
          )}
          <Button kind="outline" onClick={onCherryPick} disabled={disabled}>
            <CherryIcon size={14} />
            <span className="button-label">
              {tx("Cherry-pick {0} onto {1}", commits.length, branch ?? "HEAD")}
            </span>
          </Button>
          <Button kind="outline" onClick={onRevert} disabled={disabled}>
            <RevertIcon size={14} />
            <span className="button-label">{tx("Revert {0}", commits.length)}</span>
          </Button>
          <Button
            kind="outline"
            onClick={() => copyText(commits.map((commit) => commit.id).join("\n"))}
          >
            <CopyIcon size={14} />
            <span className="button-label">{t("Copy SHAs")}</span>
          </Button>
        </div>
        {blocked && <p className="hint">{blocked}</p>}
        <p className="hint">
          {tx("Cherry-picking applies them oldest first; reverting undoes them newest first. Shift-click to select a range, {0}-click to add or remove one.", navigator.userAgent.includes("Mac") ? "⌘" : t("Ctrl"))}
        </p>
        <ul className="selected-commits">
          {commits.map((commit) => (
            <li key={commit.id}>
              <Avatar name={commit.authorName} email={commit.authorEmail} size={18} />
              <span className="mono">{shortId(commit.id)}</span>
              <span className="selected-summary" title={commit.summary}>
                {commit.summary}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
