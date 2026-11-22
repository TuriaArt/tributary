import { useRef, type CSSProperties, type RefObject } from "react";
import type { SearchMode } from "../app/useSearch";
import type { RepoSnapshot } from "../api";
import { describeCount } from "../lib/branchSync";
import { plural, shortId } from "../lib/format";
import { isMac, modKey } from "../lib/platform";
import {
  BranchIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  CommitIcon,
  FetchIcon,
  ExternalLinkIcon,
  GearIcon,
  PullIcon,
  PushIcon,
  SyncIcon,
  SearchIcon,
  SidebarIcon,
  TeamIcon,
  ForkIcon,
} from "./Icons";
import { relativeTime } from "../lib/format";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

export type RemoteAction = "fetch" | "pull" | "push" | "sync";

export interface SearchState {
  query: string;
  /** Messages (and authors, branches, SHAs), files' paths, or code added or removed. */
  mode: SearchMode;
  /** How many commits match. */
  total: number;
  /** 1-based position of the selected commit among the matches, or 0. */
  current: number;
  /** A file or code search git hasn't answered yet. */
  searching: boolean;
  /** Matching commits that aren't loaded. */
  notLoaded: number;
  truncated: boolean;
  error: string | null;
}

const MODES: { mode: SearchMode; label: string; placeholder: string; title: string }[] = [
  {
    mode: "everything",
    label: t("Everything"),
    placeholder: t("Search, or type author:, tag:, file:…"),
    title: t("Messages, authors, branches, tags, commit ids, files and code, in every branch: what's found is listed beside the history"),
  },
  { mode: "messages", label: t("Messages"), placeholder: t("Commits whose message says…"), title: t("Commits in any branch whose message (any line of it) contains this (message:)") },
  { mode: "authors", label: t("Authors"), placeholder: t("A name or an email"), title: t("Commits in any branch by someone whose name or email contains this (author:)") },
  { mode: "refs", label: t("Branches & tags"), placeholder: t("A branch's or tag's name"), title: t("Commits with a branch or tag whose name contains this, among the loaded commits (branch:, tag:)") },
  { mode: "hashes", label: t("Commit ids"), placeholder: t("The start of a commit's id"), title: t("Commits whose id starts with this (hash:)") },
  { mode: "files", label: t("Files"), placeholder: t("Commits that changed a file, like store.ts or *.psd"), title: t("Commits in any branch that changed a file whose path contains this (or matches a pattern like *.psd) (file:)") },
  { mode: "code", label: t("Code"), placeholder: t("Commits that added or removed some code"), title: t("Commits in any branch that added or removed this exact text (code:)") },
];

interface Props {
  /** Where the history starts across the window: the search box starts there too. */
  historyLeft: number | null;
  snapshot: RepoSnapshot;
  /** The remote action that is running, if any. */
  running: RemoteAction | null;
  /** How far the checked-out branch is ahead of its upstream, and behind it (a merge counts once). */
  ahead: number;
  behind: number;
  /** The same in commits, those merges brought in too, when they were counted. */
  aheadCommits?: number;
  behindCommits?: number;
  search: SearchState;
  searchInput: RefObject<HTMLInputElement | null>;
  onSearch: (query: string) => void;
  onSearchStep: (step: 1 | -1) => void;
  onSearchMode: (mode: SearchMode) => void;
  onRemote: (action: RemoteAction) => void;
  /** Open the push menu (with force push) under the given element. */
  onPushMenu: (anchor: HTMLElement) => void;
  /** When the last successful fetch finished, in milliseconds since the epoch. */
  lastFetch: number | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Team activity: who's been working on what. */
  teamOpen: boolean;
  onToggleTeam: () => void;
  /** Your forks on GitHub, when Settings shows them: open, and opening or closing them. */
  forks: { open: boolean; onToggle: () => void } | null;
  /** The Open menu: the repository on its website, in Finder or Explorer, in an editor or terminal. */
  onOpenMenu: (anchor: HTMLElement) => void;
  /** This repository's own settings. */
  onSettings: () => void;
  onClose: () => void;
}

export function Toolbar(props: Props) {
  const { snapshot, running, ahead, behind, search, searchInput } = props;
  const pushMenuButton = useRef<HTMLButtonElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  const hasRemotes = snapshot.remotes.length > 0 && !snapshot.bare;
  const onBranch = snapshot.headBranch !== null && !snapshot.bare;
  const fetchDisabled = running !== null || !hasRemotes;
  const pullDisabled = running !== null || !onBranch || !snapshot.upstream;
  const pushDisabled = running !== null || !onBranch || !hasRemotes;
  const pullTitle = !onBranch
    ? t("Check out a branch to pull")
    : !snapshot.upstream
      ? t("{0} has no upstream branch yet. Push it first.", snapshot.headBranch)
      : t("Pull {0} into {1}{2}", snapshot.upstream.name, snapshot.headBranch, behind > 0 ? `: ${describeCount(behind, props.behindCommits)}` : "");
  // Commits on both sides: a push would be refused, so the button syncs (pulls, then pushes).
  const diverged = onBranch && hasRemotes && snapshot.upstream !== null && ahead > 0 && behind > 0;
  const pushTitle = diverged
    ? t("Sync {0} with {1}: pull {2}, then push {3}", snapshot.headBranch, snapshot.upstream?.name, describeCount(behind, props.behindCommits), describeCount(ahead, props.aheadCommits))
    : !onBranch
    ? t("Check out a branch to push")
    : !hasRemotes
      ? t("This repository has no remotes")
      : snapshot.upstream
        ? t("Push {0} to {1}{2}", snapshot.headBranch, snapshot.upstream.name, ahead > 0 ? `: ${describeCount(ahead, props.aheadCommits)}` : "")
        : t("Push {0} and set its upstream", snapshot.headBranch);

  return (
    <header className="toolbar" data-tauri-drag-region style={props.historyLeft !== null ? ({ "--history-left": `${props.historyLeft}px` } as CSSProperties) : undefined}>
      <div className="toolbar-repo" data-tauri-drag-region>
        <Button
          kind="icon" className={props.sidebarOpen ? "active" : undefined}
          onClick={props.onToggleSidebar}
          title={t("{0} branches ({1}B)", props.sidebarOpen ? t("Hide") : t("Show"), modKey)}
          aria-label={t("Toggle the branches sidebar")}
          aria-pressed={props.sidebarOpen}
        >
          <SidebarIcon />
        </Button>
        {snapshot.headBranch ? (
          <span className="head-chip" title={t("Checked out branch")} data-tour="head">
            <BranchIcon size={14} />
            <span className="head-chip-name chip-text">{snapshot.headBranch}</span>
          </span>
        ) : snapshot.headCommit ? (
          <span className="head-chip detached" title={t("HEAD is detached")}>
            <CommitIcon size={14} />
            <span className="head-chip-name chip-text">{tx("detached at {0}", shortId(snapshot.headCommit))}</span>
          </span>
        ) : null}
      </div>

      <div className="search" role="search">
        <SearchIcon size={14} />
        {/* As wide as the kind chosen, not the longest one: the hidden copy of its name
            sizes the box, and the menu lies over it. */}
        <span className="search-mode-box">
          <span className="search-mode-size" aria-hidden="true">
            {MODES.find((entry) => entry.mode === search.mode)?.label}
          </span>
          <select
            className="search-mode"
            value={search.mode}
            onChange={(event) => props.onSearchMode(event.target.value as SearchMode)}
            title={MODES.find((entry) => entry.mode === search.mode)?.title}
            aria-label={t("Search in")}
          >
            {MODES.map((entry) => (
              <option key={entry.mode} value={entry.mode}>
                {entry.label}
              </option>
            ))}
          </select>
        </span>
        <input
          ref={searchInput}
          value={search.query}
          onChange={(event) => props.onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              props.onSearchStep(event.key === "ArrowUp" || (event.key === "Enter" && event.shiftKey) ? -1 : 1);
            } else if (event.key === "Escape") {
              event.stopPropagation();
              if (search.query) props.onSearch("");
              else event.currentTarget.blur();
            }
          }}
          placeholder={MODES.find((entry) => entry.mode === search.mode)?.placeholder ?? ""}
          title={`${MODES.find((entry) => entry.mode === search.mode)?.title} (${modKey}F)`}
          spellCheck={false}
          aria-label={t("Search commits")}
        />
        {search.query && (
          <>
            <span
              className="search-count"
              title={
                search.error ??
                (search.notLoaded > 0
                  ? search.notLoaded === 1
                    ? t("{0} further back matches: scroll down to load it", plural(search.notLoaded, "more commit"))
                    : t("{0} further back match: scroll down to load them", plural(search.notLoaded, "more commit"))
                  : search.mode === "refs" && snapshot.truncated
                    ? t("Only the loaded commits are searched")
                    : undefined)
              }
            >
              {search.searching
                ? t("Searching…")
                : search.error
                  ? t("Couldn't search")
                  : search.total === 0
                    ? search.notLoaded > 0
                      ? t("{0}{1} further back", search.notLoaded, search.truncated ? "+" : "")
                      : t("No matches")
                    : search.current > 0
                      ? t("{0} of {1}{2}", search.current, search.total, search.notLoaded > 0 ? "+" : "")
                      : plural(search.total, "match", "matches") + (search.notLoaded > 0 ? "+" : "")}
            </span>
            <Button
              kind="icon" size="small"
              onClick={() => props.onSearchStep(-1)}
              disabled={search.total === 0}
              title={t("Previous match (Shift+Enter)")}
              aria-label={t("Previous match")}
            >
              <ChevronUpIcon size={14} />
            </Button>
            <Button
              kind="icon" size="small"
              onClick={() => props.onSearchStep(1)}
              disabled={search.total === 0}
              title={t("Next match (Enter)")}
              aria-label={t("Next match")}
            >
              <ChevronDownIcon size={14} />
            </Button>
            <Button
              kind="icon" size="small"
              onClick={() => props.onSearch("")}
              title={t("Clear search (Esc)")}
              aria-label={t("Clear search")}
            >
              <CloseIcon size={13} />
            </Button>
          </>
        )}
      </div>

      <div className="toolbar-actions">
        <Button
          kind="tool"
          data-tour="remote"
          onClick={() => props.onRemote("fetch")}
          disabled={fetchDisabled}
          title={
            !hasRemotes
              ? t("This repository has no remotes")
              : t("Fetch from all remotes{0}", props.lastFetch ? t(" (last fetched {0})", relativeTime(props.lastFetch / 1000)) : "")
          }
        >
          <FetchIcon className={running === "fetch" ? "pulse" : undefined} />
          <span className="label">{t("Fetch")}</span>
        </Button>
        <Button kind="tool" data-tour="remote" onClick={() => props.onRemote("pull")} disabled={pullDisabled} title={pullTitle}>
          <PullIcon className={running === "pull" ? "pulse" : undefined} />
          <span className="label">{t("Pull")}</span>
          {behind > 0 && (
            <span className="count">
              <span>{behind}</span>
            </span>
          )}
        </Button>
        <div className="split-button" data-tour="remote">
          <Button kind="tool" onClick={() => props.onRemote(diverged ? "sync" : "push")} disabled={pushDisabled} title={pushTitle}>
            {diverged ? <SyncIcon className={running === "sync" ? "pulse" : undefined} /> : <PushIcon className={running === "push" ? "pulse" : undefined} />}
            <span className="label">{diverged ? t("Sync") : t("Push")}</span>
            {ahead > 0 && (
              <span className="count">
                <span>{ahead}</span>
              </span>
            )}
          </Button>
          <Button
            ref={pushMenuButton}
            kind="tool" className="menu-toggle"
            onClick={() => pushMenuButton.current && props.onPushMenu(pushMenuButton.current)}
            disabled={pushDisabled}
            title={t("More push options")}
            aria-label={t("More push options")}
          >
            <ChevronDownIcon size={14} />
          </Button>
        </div>

        <span className="toolbar-divider" />

        <Button
          kind="icon" className={props.teamOpen ? "active" : undefined}
          onClick={props.onToggleTeam}
          title={t("Team activity: who's been working on what ({0})", isMac ? "⇧⌘T" : "Ctrl+Shift+T")}
          aria-label={t("Team activity")}
          data-tour="team"
          aria-pressed={props.teamOpen}
        >
          <TeamIcon />
        </Button>
        {props.forks && (
          <Button
            kind="icon" className={props.forks.open ? "active" : undefined}
            onClick={props.forks.onToggle}
            title={t("Your forks: how far behind each is, and syncing them")}
            aria-label={t("Your forks")}
            aria-pressed={props.forks.open}
          >
            <ForkIcon />
          </Button>
        )}
        <Button
          kind="icon"
          onClick={props.onSettings}
          title={t("Settings for {0}: who you commit as, protected branches, Git LFS", snapshot.name)}
          aria-label={t("Repository settings")}
        >
          <GearIcon />
        </Button>
        <Button
          ref={openButton}
          kind="icon"
          onClick={() => openButton.current && props.onOpenMenu(openButton.current)}
          title={t("Open {0}: on its website, in {1}, in your editor or terminal", snapshot.name, isMac ? t("Finder") : t("Explorer"))}
          aria-label={t("Open the repository elsewhere")}
        >
          <ExternalLinkIcon />
        </Button>
        <Button kind="icon" onClick={props.onClose} title={t("Close repository")} aria-label={t("Close repository")}>
          <CloseIcon />
        </Button>
      </div>
    </header>
  );
}
