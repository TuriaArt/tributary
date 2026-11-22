import { useEffect, useState } from "react";
import type { Comparison, FileChange } from "../api";
import type { Comparing } from "../app/useComparison";
import { ActorNames, useActorNames } from "../lib/actorNames";
import { FILTER_FROM, filterFiles } from "../lib/fileFilter";
import { plural, shortId } from "../lib/format";
import { FileLine } from "./FileLine";
import { FileFilter, FileList } from "./FileList";
import { CloseIcon, CompareIcon } from "./Icons";
import { Loader } from "./Loader";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  comparing: Comparing;
  /** Show a file's change between the two. */
  onOpenFile: (file: FileChange) => void;
  isShown: (path: string) => boolean;
  /** Go to a commit, if it's loaded. */
  onSelect: (id: string) => void;
  hasCommit: (id: string) => boolean;
}

/**
 * Two commits or branches compared, in the details panel: how many commits each has that
 * the other doesn't, and the files that differ, since they split (what one adds, like a
 * pull request) or directly.
 */
export function ComparePanel({ comparing, onOpenFile, isShown, onSelect, hasCommit }: Props) {
  const { request, comparison, error, close } = comparing;
  // Unreal actors among the files, named as they are in the editor.
  const actors = useActorNames(comparing.repoPath, request?.to.id ?? null, comparison?.base ?? request?.from.id ?? null, request ? comparison?.files : undefined);
  const [query, setQuery] = useState("");

  // Esc closes the comparison: after a file's changes, menus and dialogs over it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const typing = (event.target as HTMLElement | null)?.closest?.("textarea, select, input, [contenteditable]");
      if (typing || document.querySelector('.diff-view, [role="menu"], [role="dialog"], [aria-modal="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  if (!request) return null;
  const { from, to, split } = request;
  const files = comparison ? (comparison.files.length > FILTER_FROM && query.trim() ? filterFiles(comparison.files, query, actors) : comparison.files) : [];
  return (
    <ActorNames.Provider value={actors}>
      <aside className="details compare-panel" aria-label={t("{0} compared with {1}", to.label, from.label)}>
        <header className="details-header">
          <span className="details-label">{t("Compare")}</span>
          <span className="spacer" />
          <Button kind="icon" onClick={comparing.close} title={t("Close (Esc)")} aria-label={t("Close the comparison")}>
            <CloseIcon />
          </Button>
        </header>
        <div className="details-scroll">
          <div className="compare-sides">
            <span className="compare-side mono" title={from.id}>
              {from.label}
            </span>
            <Button kind="icon" className="compare-swap" onClick={comparing.swap} title={t("Swap them")} aria-label={t("Swap the two sides")}>
              <CompareIcon size={14} />
            </Button>
            <span className="compare-side mono to" title={to.id}>
              {to.label}
            </span>
          </div>
          <div className="diff-switch compare-how" role="group" aria-label={t("Compare")}>
            <button className={split ? "selected" : undefined} aria-pressed={split} onClick={() => comparing.setSplit(true)} title={t("What {0} changed since the two split, like a pull request", to.label)}>
              <span className="button-label">{t("Since they split")}</span>
            </button>
            <button className={!split ? "selected" : undefined} aria-pressed={!split} onClick={() => comparing.setSplit(false)} title={t("Everything that's different between {0} and {1}", from.label, to.label)}>
              <span className="button-label">{t("Directly")}</span>
            </button>
          </div>
          {comparison && <Facts comparison={comparison} from={from.label} to={to.label} split={split} onSelect={onSelect} hasCommit={hasCommit} />}
          <section className="files">
            <h3>{comparison ? plural(comparison.files.length, "different file") : t("Different files")}</h3>
            {error ? (
              <div className="details-error">{error}</div>
            ) : !comparison ? (
              <Loader size={48} title={t("Comparing them")} />
            ) : comparison.files.length === 0 ? (
              <div className="muted">{split ? t("{0} hasn't changed any files since they split.", to.label) : t("The files are the same in both.")}</div>
            ) : (
              <>
                {comparison.files.length > FILTER_FROM && <FileFilter value={query} onChange={setQuery} shown={files.length} total={comparison.files.length} />}
                <FileList
                  items={files}
                  keyOf={(file) => `${file.status}:${file.oldPath ?? ""}:${file.path}`}
                  render={(file) => <FileLine file={file} onOpen={onOpenFile} shown={isShown(file.path)} />}
                />
                {files.length === 0 && <div className="muted">{tx("No files match “{0}”.", query.trim())}</div>}
              </>
            )}
          </section>
        </div>
      </aside>
    </ActorNames.Provider>
  );
}

function Facts({ comparison, from, to, split, onSelect, hasCommit }: { comparison: Comparison; from: string; to: string; split: boolean; onSelect: (id: string) => void; hasCommit: (id: string) => boolean }) {
  const { onlyFrom, onlyTo, splitAt } = comparison;
  return (
    <div className="compare-facts">
      <p>
        {tx("{0} has {1} that {2} doesn't{3}", <strong>{to}</strong>, plural(onlyTo, "commit"), <strong>{from}</strong>, onlyFrom > 0 ? (
          <>
            {tx(", and {0} has {1} that {2} doesn't.", <strong>{from}</strong>, plural(onlyFrom, "commit"), <strong>{to}</strong>)}
          </>
        ) : (
          "."
        ))}
      </p>
      {splitAt ? (
        <p className="muted">
          {tx("They split at {0}{1}", <button className="sha-link" onClick={() => onSelect(splitAt)} disabled={!hasCommit(splitAt)} title={hasCommit(splitAt) ? t("Go to that commit") : t("Not loaded")}>
            <span className="button-label">{shortId(splitAt)}</span>
          </button>, split ? t(": the files below are {0}'s changes since then.", to) : ".")}
        </p>
      ) : (
        <p className="muted">{t("They don't share any history.")}</p>
      )}
    </div>
  );
}
