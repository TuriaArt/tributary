import { useEffect, useState } from "react";
import { branchBackups, runAction, type Backup, type BackupEvent } from "../api";
import { relativeTime, shortId } from "../lib/format";
import { Dialog } from "./Dialog";
import { CloseIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t } from "../lib/i18n";

interface Props {
  repoPath: string;
  onCancel: () => void;
  onRestore: (backup: Backup) => void;
}

const EVENTS: Record<BackupEvent, string> = {
  deleted: t("Deleted"),
  deletedFromRemote: t("Deleted from the remote"),
  forcePushed: t("Replaced by a force push"),
  reset: t("Reset"),
  rebased: t("Rebased"),
};

/** What restoring a backup will do, in a few words. */
function outcome(backup: Backup): string {
  const leaf = backup.remote ? backup.name.slice(backup.name.indexOf("/") + 1) : backup.name;
  if (backup.event === "forcePushed") return t("Creates the local branch {0}-before-force-push", leaf);
  if (backup.remote) {
    return backup.current === null ? t("Pushes it back to {0}", backup.name.split("/")[0]) : t("Creates the local branch {0}-restored", leaf);
  }
  if (backup.current === null) return t("Recreates {0}", backup.name);
  if (backup.current === backup.id) return t("{0} is already there, as it was", backup.name);
  return t("{0} has moved on, so this creates {1}-restored", backup.name, backup.name);
}

/**
 * Where branches were before Tributary deleted, reset, rebased or force-pushed them, for
 * the last 30 days. Restoring never overwrites anything.
 */
export function RestoreDialog({ repoPath, onCancel, onRestore }: Props) {
  const [backups, setBackups] = useState<Backup[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () =>
    branchBackups(repoPath)
      .then(setBackups)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);
  const remove = async (backup: Backup) => {
    try {
      await runAction(repoPath, { kind: "removeBackup", reference: backup.reference });
      await load();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <Dialog
      title={t("Restore a branch")}
      wide
      error={error}
      onCancel={onCancel}
      buttons={
        <Button kind="secondary" onClick={onCancel}>
          {t("Close")}
        </Button>
      }
    >
      <p className="hint">
        {t("Whenever Tributary deletes, resets, rebases or force-pushes a branch, it keeps where the branch was for 30 days. Restoring never overwrites anything: if a branch has moved on since, its earlier version comes back beside it.")}
      </p>
      {backups === null ? (
        !error && <p className="hint">{t("Looking…")}</p>
      ) : backups.length === 0 ? (
        <p className="hint">{t("Nothing to restore yet.")}</p>
      ) : (
        <ul className="restore-list">
          {backups.map((backup) => (
            <li key={backup.reference} className="restore-row">
              <div className="restore-main">
                <div className="restore-top">
                  <span className="restore-name">{backup.name}</span>
                  <span className={`restore-event ${backup.event}`}>{EVENTS[backup.event] ?? backup.event}</span>
                  <span className="restore-when">{relativeTime(backup.time)}</span>
                </div>
                <div className="restore-commit">
                  <span className="mono">{shortId(backup.id)}</span> {backup.summary}
                </div>
                <div className="restore-outcome">{outcome(backup)}</div>
              </div>
              <Button
                kind="outline"
                onClick={() => onRestore(backup)}
                disabled={!backup.remote && backup.current === backup.id}
              >
                <span className="button-label">{t("Restore")}</span>
              </Button>
              <Button kind="icon" className="restore-remove" onClick={() => remove(backup)} title={t("Forget this backup")} aria-label={t("Forget this backup")}>
                <CloseIcon size={12} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
