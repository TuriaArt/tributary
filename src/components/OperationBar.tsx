import type { Operation } from "../api";
import { plural } from "../lib/format";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  operation: Operation;
  branch: string;
  /** Files that still have conflicts. */
  conflicts: number;
  /** What the two sides are called, like "main" and "feat/x". */
  sides: { mine: string; theirs: string };
  busy: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onAbort: () => void;
  onShowFiles: () => void;
  /** Take one side's version of every conflicted file. */
  onKeepAll: (keep: "mine" | "theirs") => void;
}


/** Shown while a merge, rebase, cherry-pick or revert waits for conflicts to be resolved. */
export function OperationBar({ operation, branch, conflicts, sides, busy, onContinue, onSkip, onAbort, onShowFiles, onKeepAll }: Props) {
  if (operation.kind === "other") {
    return (
      <div className="operation-bar" role="status">
        <span>{t("A git operation is in progress. Finish it in a terminal.")}</span>
      </div>
    );
  }
  const merging = operation.kind === "merge";
  const title = {
    merge: t("Merging into"),
    rebase: t("Rebase in progress on"),
    cherryPick: t("Cherry-pick in progress on"),
    revert: t("Revert in progress on"),
    applyPatches: t("Applying patches on"),
  }[operation.kind];
  const abort = {
    merge: t("Abort merge"),
    rebase: t("Abort rebase"),
    cherryPick: t("Abort cherry-pick"),
    revert: t("Abort revert"),
    applyPatches: t("Stop applying"),
  }[operation.kind];
  const files = (
    <Button kind="link" onClick={onShowFiles}>
      {tx("{0} with conflicts", plural(conflicts, "file"))}
    </Button>
  );
  return (
    <div className="operation-bar" role="status">
      <span className="operation-text">
        <span className="operation-title">
          {title}{" "}
          <strong>{branch}</strong>.
        </span>{" "}
        {conflicts > 0 ? (
          <>
            {merging
              ? tx("{0}: pick a version of each, or fix and stage them, then commit.", files)
              : tx("{0}: pick a version of each, or fix and stage them, then continue.", files)}
          </>
        ) : (
          <>{merging ? t("No conflicts left: commit when you're ready.") : t("No conflicts left: continue when you're ready.")}</>
        )}
      </span>
      <span className="operation-buttons">
        {conflicts > 0 ? (
          <>
            <Button kind="secondary" onClick={() => onKeepAll("mine")} disabled={busy} title={t("Keep {0}'s version of every conflicted file", sides.mine)}>
              {t("Keep all mine")}
            </Button>
            <Button kind="secondary" onClick={() => onKeepAll("theirs")} disabled={busy} title={t("Take {0}'s version of every conflicted file", sides.theirs)}>
              {t("Take all theirs")}
            </Button>
          </>
        ) : (
          <Button kind="primary" onClick={onContinue} disabled={busy}>
            {operation.kind === "merge" ? t("Commit merge") : t("Continue")}
          </Button>
        )}
        {operation.kind !== "merge" && (
          <Button kind="secondary" onClick={onSkip} disabled={busy} title={operation.kind === "applyPatches" ? t("Leave out this patch") : t("Leave out this commit")}>
            {operation.kind === "applyPatches" ? t("Skip patch") : t("Skip commit")}
          </Button>
        )}
        <button className="danger-outline-button" onClick={onAbort} disabled={busy}>
          {abort}
        </button>
      </span>
    </div>
  );
}
