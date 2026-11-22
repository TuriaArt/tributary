import { useEffect, useState } from "react";
import type { RepoSnapshot } from "../api";
import { plural, relativeTime } from "../lib/format";
import { isMac } from "../lib/platform";
import { useLinkUrl } from "../lib/linkPreview";
import { ActivityIcon, BranchIcon, BroomIcon, CloseIcon, CloudIcon, CommitIcon, ExternalLinkIcon, EyeOffIcon, FolderIcon, TeamIcon } from "./Icons";
import { t, tx } from "../lib/i18n";

interface Props {
  snapshot: RepoSnapshot;
  ahead: number;
  behind: number;
  /** What's running, like "Fetching". */
  running: string | null;
  /** Hidden (or, while soloing, shown) branches. */
  hiddenCount: number;
  soloing: boolean;
  onShowAll: () => void;
  onFetch: (() => void) | null;
  activityOpen: boolean;
  /** The last git command failed. */
  activityFailed: boolean;
  onToggleActivity: () => void;
  /** Who committed this week, on any branch; opens team activity. */
  pulse: { people: number; commits: number } | null;
  teamOpen: boolean;
  onToggleTeam: () => void;
  onReveal: () => void;
  /** Local branches gone from the remote, to offer cleaning up. */
  pruneHint: { count: number; remote: string } | null;
  /** Files you're changing that other branches also changed (some can't be merged: `assets`). */
  elsewhere: { count: number; assets: boolean } | null;
  /** Show the branches and files, in a panel over `anchor`. */
  onElsewhere: (anchor: HTMLElement) => void;
  onPrune: (() => void) | null;
  onDismissPruneHint: () => void;
}

/** A thin bar at the bottom of the window: where the branch stands, and the repository's folder. */
export function StatusBar(props: Props) {
  const { snapshot, ahead, behind, running, hiddenCount, soloing, onFetch, activityOpen, activityFailed } = props;
  // Re-render every half minute so "Fetched 2 minutes ago" stays right.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((tick) => tick + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  // While a link is pointed at, the page it opens, in place of the rest, as browsers show it.
  const link = useLinkUrl();
  const commits = snapshot.commits.filter((commit) => commit.kind === "commit").length;
  const fetched = snapshot.lastFetched ? t("Fetched {0}", relativeTime(snapshot.lastFetched)) : t("Never fetched");
  return (
    <footer className={`status-bar${link ? " showing-link" : ""}`}>
      {link && (
        <span className="status-link" aria-hidden>
          <ExternalLinkIcon size={12} />
          <span className="button-label">{link}</span>
        </span>
      )}
      <span className="status-item strong" title={snapshot.headBranch ? t("On {0}", snapshot.headBranch) : t("Detached HEAD")}>
        {snapshot.headBranch ? <BranchIcon size={12} /> : <CommitIcon size={12} />}
        <span className="button-label">{snapshot.headBranch ?? t("HEAD at {0}", snapshot.headCommit?.slice(0, 7) ?? "nothing")}</span>
      </span>
      {snapshot.headBranch &&
        (snapshot.upstream ? (
          <span className="status-item" title={t("{0} to push, {1} to pull", ahead, behind)}>
            <CloudIcon size={12} />
            <span className="button-label">{snapshot.upstream.name}</span>
            {ahead > 0 && <span className="status-count button-label">↑{ahead}</span>}
            {behind > 0 && <span className="status-count button-label">↓{behind}</span>}
            {ahead === 0 && behind === 0 && <span className="muted button-label">{t("up to date")}</span>}
          </span>
        ) : (
          snapshot.remotes.length > 0 && <span className="status-item muted"><span className="button-label">{t("Not pushed yet")}</span></span>
        ))}
      {snapshot.remotes.length > 0 &&
        (onFetch ? (
          <button className="status-item status-button" onClick={onFetch} title={t("Fetch now")}>
            <span className="button-label">{fetched}</span>
          </button>
        ) : (
          <span className="status-item muted"><span className="button-label">{fetched}</span></span>
        ))}
      {props.pruneHint && props.onPrune && (
        <span className="status-item status-hint">
          <button
            className="status-button"
            onClick={props.onPrune}
            title={t("Their remote branches were deleted, usually because their pull requests were merged")}
          >
            <BroomIcon size={12} />
            <span className="button-label">{tx("{0} gone from {1}", plural(props.pruneHint.count, "branch", "branches"), props.pruneHint.remote)}</span>
            <span className="status-hint-action button-label">{t("Clean up")}</span>
          </button>
          <button className="status-hint-close" onClick={props.onDismissPruneHint} aria-label={t("Hide this")} title={t("Hide this until another branch goes")}>
            <CloseIcon size={10} />
          </button>
        </span>
      )}
      {props.elsewhere && (
        <button
          className={`status-item status-button elsewhere${props.elsewhere.assets ? " assets" : ""}`}
          data-tour="elsewhere"
          onClick={(event) => props.onElsewhere(event.currentTarget)}
          title={t("Files you're changing that someone also changed recently on another branch: click to see the branches")}
          aria-haspopup="dialog"
        >
          <BranchIcon size={12} />
          <span className="button-label">{tx("{0} also changed elsewhere", plural(props.elsewhere.count, "file"))}</span>
        </button>
      )}
      {running && <span className="status-item running"><span className="button-label">{running}…</span></span>}
      {snapshot.operation && (
        <span className="status-item warning">
          <span className="button-label">
            {{ merge: t("Merge"), rebase: t("Rebase"), cherryPick: t("Cherry-pick"), revert: t("Revert"), applyPatches: t("Applying patches"), other: t("Git operation") }[snapshot.operation.kind]}
            {snapshot.operation.kind === "applyPatches" ? "" : t(" in progress")}
          </span>
        </span>
      )}
      <span className="status-fill" />
      {hiddenCount > 0 && (
        <button className="status-item status-button" onClick={props.onShowAll} title={t("Show every branch")}>
          <EyeOffIcon size={12} />
          <span className="button-label">{soloing ? t("Showing {0} soloed", hiddenCount) : t("{0} hidden", hiddenCount)}</span>
        </button>
      )}
      {props.pulse && props.pulse.people > 0 && (
        <button
          className={`status-item status-button${props.teamOpen ? " active" : ""}`}
          data-tour="pulse"
          onClick={props.onToggleTeam}
          title={t("{0} on any branch in the last 7 days: show team activity", plural(props.pulse.commits, "commit"))}
        >
          <TeamIcon size={12} />
          <span className="button-label">{tx("{0} this week", props.pulse.people === 1 ? t("1 person") : t("{0} people", props.pulse.people))}</span>
        </button>
      )}
      <span className="status-item muted">
        <span className="button-label">
          {commits.toLocaleString()}
          {snapshot.truncated ? "+" : ""} {commits === 1 ? "commit" : "commits"}
        </span>
      </span>
      <button
        className={`status-item status-button${activityOpen ? " active" : ""}`}
        data-tour="activity"
        onClick={props.onToggleActivity}
        title={t("Show the git commands Tributary ran")}
      >
        <ActivityIcon size={12} />
        <span className="button-label">{t("Activity")}</span>
        {activityFailed && <span className="status-dot" aria-label={t("The last command failed")} />}
      </button>
      <button className="status-item status-button path" onClick={props.onReveal} title={isMac ? t("Show in Finder") : t("Show in Explorer")}>
        <FolderIcon size={12} />
        <span className="status-path">{snapshot.path}</span>
      </button>
    </footer>
  );
}
