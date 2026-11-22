import { useCallback, useEffect, useMemo, useState } from "react";
import { localHistory, takeSnapshot, type Action, type Snapshot } from "../api";
import { plural } from "../lib/format";
import { useStoredState } from "../lib/settings";
import { baseName, folderOf } from "../lib/paths";
import { Dialog } from "./Dialog";
import { HistoryIcon } from "./Icons";
import { Button } from "./ui/Button";
import { locale, t, tx } from "../lib/i18n";

interface Props {
  repoPath: string;
  /** Only the snapshots of this file. */
  file?: string;
  canChange: boolean;
  /** Runs a git action (closing this first). */
  run: (action: Action) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

/** "Today", "Yesterday", or the date. */
function dayOf(time: number): string {
  const date = new Date(time);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return t("Today");
  if (date.toDateString() === yesterday.toDateString()) return t("Yesterday");
  return date.toLocaleDateString(locale(), { weekday: "long", month: "short", day: "numeric" });
}

const timeOf = (time: number) => new Date(time).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });

/**
 * Local history: snapshots of uncommitted work, taken every few minutes, to put files back
 * as they were. Restoring snapshots what they are now first, so Undo brings that back.
 */
export function LocalHistoryDialog({ repoPath, file, canChange, run, onOpenSettings, onClose }: Props) {
  // The settings: how often (minutes, 0 for never), how big a file can be (MB), how long they're kept (days).
  const [minutes] = useStoredState("history.minutes", 10);
  const [maxMB] = useStoredState("history.maxMB", 50);
  const [days] = useStoredState("history.days", 7);
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [taking, setTaking] = useState(false);
  const load = useCallback(() => {
    localHistory(repoPath)
      .then((found) => {
        const shown = file ? found.filter((snapshot) => snapshot.files.some((each) => each.path === file)) : found;
        setSnapshots(shown);
        setChosen((now) => (now && shown.some((snapshot) => snapshot.reference === now) ? now : (shown[0]?.reference ?? null)));
      })
      .catch((e) => setError(String(e)));
  }, [repoPath, file]);
  useEffect(load, [load]);

  const byDay = useMemo(() => {
    const groups: { day: string; snapshots: Snapshot[] }[] = [];
    for (const snapshot of snapshots ?? []) {
      const day = dayOf(snapshot.time);
      let last = groups[groups.length - 1];
      if (last?.day !== day) {
        last = { day, snapshots: [] };
        groups.push(last);
      }
      last.snapshots.push(snapshot);
    }
    return groups;
  }, [snapshots]);
  const selected = snapshots?.find((snapshot) => snapshot.reference === chosen) ?? null;
  const files = selected ? (file ? selected.files.filter((each) => each.path === file) : selected.files) : [];

  const restore = (paths: string[]) => {
    if (!selected) return;
    onClose();
    run({ kind: "restoreFromHistory", reference: selected.reference, paths });
  };
  const takeOne = async () => {
    setTaking(true);
    setError(null);
    try {
      const taken = await takeSnapshot(repoPath, maxMB * 1_000_000, days);
      if (!taken) setError(t("Nothing new to keep: your changes are as the last snapshot has them."));
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setTaking(false);
    }
  };

  return (
    <Dialog
      title={file ? t("Local history of {0}", baseName(file)) : t("Local history")}
      wide
      className="local-history-dialog"
      error={error}
      onCancel={onClose}
      buttons={
        <>
          <Button kind="secondary" onClick={() => void takeOne()} disabled={taking || !canChange}>
            {taking ? t("Keeping…") : t("Keep a snapshot now")}
          </Button>
          <span className="spacer" />
          <Button kind="secondary" onClick={onClose}>
            {t("Close")}
          </Button>
          {files.length > 1 && (
            <Button kind="primary" disabled={!canChange} onClick={() => restore(files.map((each) => each.path))}>
              {tx("Restore all {0}", files.length)}
            </Button>
          )}
        </>
      }
    >
      <p className="dialog-note-line">
        {minutes > 0 ? (
          <>
            {tx("Your uncommitted work, kept every {0} minutes for {1} (files up to {2}). Restoring a file puts it back as it was then; what it is now is kept too, so Undo brings it back.", minutes, days === 1 ? t("a day") : plural(days, "day"), maxMB >= 1000 ? `${maxMB / 1000} ${t("GB")}` : `${maxMB} ${t("MB")}`)}{" "}
          </>
        ) : (
          <>{t("Snapshots aren't kept now.")}{" "}</>
        )}
        <Button kind="link" onClick={onOpenSettings}>
          {t("Settings")}
        </Button>
      </p>
      {snapshots === null ? (
        <p className="shelves-empty">{t("Looking…")}</p>
      ) : snapshots.length === 0 ? (
        <p className="shelves-empty">{file ? t("No snapshots of this file yet.") : t("No snapshots yet. They're kept while you have uncommitted changes.")}</p>
      ) : (
        <div className="history-columns">
          <div className="history-times" role="listbox" aria-label={t("Snapshots")}>
            {byDay.map((group) => (
              <div key={group.day}>
                <div className="history-day">{group.day}</div>
                {group.snapshots.map((snapshot) => (
                  <button
                    key={snapshot.reference}
                    role="option"
                    aria-selected={snapshot.reference === chosen}
                    className={`history-time${snapshot.reference === chosen ? " on" : ""}`}
                    onClick={() => setChosen(snapshot.reference)}
                  >
                    <HistoryIcon size={12} />
                    <span className="history-clock">{timeOf(snapshot.time)}</span>
                    <span className="history-count">{plural(snapshot.files.length, "file")}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
          <ul className="history-files">
            {files.map((each) => (
              <li key={each.path}>
                <span className={`shelf-change ${each.change}`}>{each.change === "added" ? "A" : each.change === "deleted" ? "D" : "M"}</span>
                <span className="history-file-name">{baseName(each.path)}</span>
                <span className="history-file-dir">{folderOf(each.path)}</span>
                <Button
                  kind="outline"
                  disabled={!canChange}
                  title={each.change === "deleted" ? t("It had been deleted then: delete it again") : t("Put {0} back as it was at {1}", baseName(each.path), selected ? timeOf(selected.time) : "")}
                  onClick={() => restore([each.path])}
                >
                  <span className="button-label">{t("Restore")}</span>
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
