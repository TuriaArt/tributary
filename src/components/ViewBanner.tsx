import type { Focus } from "../app/constants";
import { baseName } from "../lib/paths";
import { plural } from "../lib/format";
import { ChevronDownIcon, ChevronUpIcon, EyeIcon, FileHistoryIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  focus: Focus | null;
  /** Only the checked-out branch's own (first-parent) history is shown. */
  firstParent: boolean;
  /** The branches shown on their own, as full ref names. */
  solo: string[];
  /** The checked-out branch, or "HEAD". */
  branchLabel: string;
  /** Highlighting the user's own commits. */
  mine: boolean;
  /** How many loaded commits are highlighted. */
  focusedCount: number;
  /** For a file's history: the rows of the loaded commits that changed it. */
  pathMatches: number[];
  selectedIndex: number | undefined;
  onStep: (direction: -1 | 1) => void;
  /** Leave the highlight, or show every branch again. */
  onShowEverything: () => void;
}

/** Says what part of the history is highlighted or shown, with a way back to all of it. */
export function ViewBanner({ focus, firstParent, solo, branchLabel, mine, focusedCount, pathMatches, selectedIndex, onStep, onShowEverything }: Props) {
  return (
    <div className="view-banner" role="status">
      {focus?.kind === "path" ? <FileHistoryIcon size={14} /> : <EyeIcon size={14} />}
      {focus?.kind === "path" ? (
        <span>
          {tx("Highlighting the {0}{1} that changed {2}{3}.", plural(focus.ids.length, "commit"), focus.truncated ? "+" : "", <strong title={focus.path}>
            {baseName(focus.path)}
            {focus.folder ? "/" : ""}
          </strong>, focus.ids.length > pathMatches.length && t(" ({0} not loaded)", (focus.ids.length - pathMatches.length).toLocaleString()))}
        </span>
      ) : focus?.kind === "history" ? (
        <span>
          {tx("Highlighting {0}'s history.", <strong>{focus.name}</strong>)}
        </span>
      ) : focus?.kind === "author" ? (
        <span>
          {tx("Highlighting {0} commits ({1} loaded).", <strong>{mine ? "your" : `${focus.name || focus.email}'s`}</strong>, focusedCount)}
        </span>
      ) : firstParent ? (
        <span>
          {tx("Showing only {0}'s own history.", <strong>{branchLabel}</strong>)}
        </span>
      ) : (
        <span>
          {tx("Showing only {0} (and {1}).", <strong>
            {solo
              .map((name) => name.replace(/^refs\/(heads|remotes|tags)\//, ""))
              .slice(0, 4)
              .join(", ")}
            {solo.length > 4 ? t(" and {0} more", solo.length - 4) : ""}
          </strong>, branchLabel)}
        </span>
      )}
      {focus?.kind === "path" && pathMatches.length > 0 && (
        <span className="banner-steps">
          <Button kind="icon" onClick={() => onStep(-1)} title={t("Newer change")} aria-label={t("Newer change")}>
            <ChevronUpIcon size={13} />
          </Button>
          <span className="banner-step-count">
            {selectedIndex !== undefined && pathMatches.includes(selectedIndex)
              ? `${pathMatches.indexOf(selectedIndex) + 1} of ${pathMatches.length}`
              : plural(pathMatches.length, "change")}
          </span>
          <Button kind="icon" onClick={() => onStep(1)} title={t("Older change")} aria-label={t("Older change")}>
            <ChevronDownIcon size={13} />
          </Button>
        </span>
      )}
      <Button kind="link" onClick={onShowEverything}>
        {focus ? t("Show everything (Esc)") : t("Show all branches")}
      </Button>
    </div>
  );
}
