import { useEffect, useState } from "react";
import { lostCommits, type LostCommits } from "../api";
import { compactTime, plural, shortId } from "../lib/format";
import { Dialog } from "./Dialog";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

/** The branches protected by default, until you change them for a repository. */
export const DEFAULT_PROTECTED = ["main", "master", "develop"];

/**
 * For changes to a protected branch: type its name to go ahead.
 * Returns whether what's typed matches (always true when `name` is null).
 */
export function TypeToConfirm({ name, value, onChange }: { name: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="type-to-confirm">
      <span>
        {tx("{0} is protected. Type its name to go ahead.", <strong>{name}</strong>)}
      </span>
      <input
        className="text-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={name}
        spellCheck={false}
        autoComplete="off"
        autoFocus
        aria-label={t("Type {0} to confirm", name)}
      />
    </label>
  );
}

/**
 * What deleting a branch would lose: its commits that are on no other branch, remote branch
 * or tag. Calls `onChecked` once it knows.
 */
export function LostCommitsNote({
  repoPath,
  reference,
  name,
  onChecked,
}: {
  repoPath: string;
  /** "refs/heads/…" or "refs/remotes/…". */
  reference: string;
  name: string;
  onChecked?: (lost: LostCommits | null) => void;
}) {
  const [lost, setLost] = useState<LostCommits | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    lostCommits(repoPath, reference)
      .then((result) => live && setLost(result))
      .catch(() => live && setLost(null));
    return () => {
      live = false;
    };
  }, [repoPath, reference]);
  useEffect(() => {
    if (lost !== undefined) onChecked?.(lost);
    // Only when the answer arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lost]);

  const restore = <p className="hint">{t("Tributary keeps a backup for 30 days: Repository → Branches → Restore Branch… puts it back.")}</p>;
  if (lost === undefined) return <p className="hint">{t("Checking what would be lost…")}</p>;
  if (lost === null) return restore;
  if (lost.count === 0) {
    return (
      <>
        <p className="safe-note">{tx("Nothing is lost: every commit on {0} is also on another branch, remote branch or tag.", name)}</p>
        {restore}
      </>
    );
  }
  return (
    <>
      <div className="dialog-warning lost-commits">
        <p>
          {lost.count === 1
            ? tx("{0} on {1} isn't on any other branch, remote branch or tag:", t("1 commit"), name)
            : tx("{0} on {1} aren't on any other branch, remote branch or tag:", plural(lost.count, "commit"), name)}
        </p>
        <ul>
          {lost.commits.map((commit) => (
            <li key={commit.id}>
              <span className="mono">{shortId(commit.id)}</span> {commit.summary}
              <span className="muted"> · {compactTime(commit.time)}</span>
            </li>
          ))}
        </ul>
        {lost.count > lost.commits.length && <p className="muted">{tx("…and {0} more.", lost.count - lost.commits.length)}</p>}
      </div>
      {restore}
    </>
  );
}

/** A change to a protected branch (like rebasing it): type its name to go ahead. */
export function ProtectedActionDialog({
  branch,
  title,
  explanation,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  branch: string;
  title: string;
  explanation: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState("");
  const confirmed = typed.trim() === branch;
  return (
    <Dialog
      title={title}
      onCancel={onCancel}
      buttons={
        <>
          <Button kind="secondary" onClick={onCancel}>
            {t("Cancel")}
          </Button>
          <Button kind="danger" disabled={!confirmed} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p>{explanation}</p>
      <TypeToConfirm name={branch} value={typed} onChange={setTyped} />
    </Dialog>
  );
}
