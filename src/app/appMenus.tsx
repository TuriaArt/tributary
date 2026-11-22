import { open as openFile } from "@tauri-apps/plugin-dialog";
import type { Action, CommitRow, InstalledApp, RepoSnapshot } from "../api";
import { WORKTREE_ID } from "../api";
import { BranchIcon, BroomIcon, CheckIcon, CloneIcon, CloseIcon, CodeIcon, CommitIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, FetchIcon, FileHistoryIcon, FolderIcon, GearIcon, HistoryIcon, IgnoreIcon, InfoIcon, KeyboardIcon, LockIcon, NewRepoIcon, NotesIcon, PlusIcon, PullIcon, PullRequestIcon, PushIcon, RecoverIcon, RefreshIcon, SearchIcon, ShelfIcon, StashIcon, SyncIcon, TagIcon, TargetIcon, TerminalIcon, ViewIcon } from "../components/Icons";
import type { NativeMenu } from "../lib/nativeMenu";
import { isMac } from "../lib/platform";
import { newPullRequestUrl, openInBrowser, siteName, webRemote } from "../lib/weblinks";
import { splitRemoteBranch, type OpenDialog } from "../menus";
import { isSubmenu, type AppCommand, type MenuEntry } from "./appCommand";
import { REOPEN_TAB_KEYS } from "./tabMenu";
import type { Preferences } from "./usePreferences";
import { t } from "../lib/i18n";

/** One menu of the menu bar. */
export interface AppMenuDefinition {
  label: string;
  entries: MenuEntry[];
}

/** What the menu bar needs from the app. */
export interface MenuBarContext {
  /** The open repository, if any. */
  snapshot: RepoSnapshot | null;
  /** Something is running, so the repository can't be changed now. */
  running: boolean;
  /** The checked-out commit, if it's loaded. */
  head: CommitRow | undefined;
  preferences: Preferences;
  /** Branches hidden from the graph (or, while soloing, shown). */
  hiddenCount: number;
  highlightingMine: boolean;
  /** The team activity view is open. */
  teamOpen: boolean;
  /** Your forks are open (they're only in the menu when Settings shows them). */
  forksOpen: boolean;
  /** A tab was closed lately, and can be opened again. */
  canReopenTab: boolean;
  /** Whether the repository uses Git LFS locking, and Git LFS at all. */
  usesLocks: boolean;
  usesLfs: boolean;
  /** Files stored with Git LFS that weren't downloaded. */
  lfsPointers: number;
  /** The editor and terminal to open the repository in, if any are installed. */
  openApps: { editor: InstalledApp | null; terminal: InstalledApp | null };
  do: {
    open: () => void;
    clone: () => void;
    create: () => void;
    settings: () => void;
    palette: () => void;
    shortcuts: () => void;
    zoom: (step: 1 | -1 | 0) => void;
    newTab: () => void;
    closeTab: (path: string) => void;
    reopenTab: () => void;
    search: () => void;
    showAllBranches: () => void;
    highlightMine: () => void;
    team: () => void;
    /** Your forks on GitHub; absent when Settings doesn't show them. */
    forks?: () => void;
    /** The View panel, under the View button at the end of the column headings. */
    viewOptions: () => void;
    resetLayout: () => void;
    refresh: () => void;
    act: (action: Action) => void;
    dialog: (dialog: OpenDialog) => void;
    select: (id: string) => void;
    history: (directory: boolean) => void;
    lockFiles: () => void;
    reveal: () => void;
    /** Open the repository in an editor or terminal. */
    openIn: (app: InstalledApp) => void;
    diagnostics: () => void;
    /** Opens the licences of the software Tributary is made with. */
    notices: () => void;
    tours: () => void;
    /** The About window, which also checks for updates. */
    about: () => void;
  };
}

/** The Settings… command: in the app menu on macOS, at the end of the File menu elsewhere. */
export function settingsCommand(ctx: MenuBarContext): AppCommand {
  return { id: "settings", label: t("Settings…"), icon: <GearIcon />, keys: "CmdOrCtrl+,", run: ctx.do.settings };
}

/** The tab closed last, back in its place: there with or without a repository open. */
export function reopenTabCommand(ctx: MenuBarContext): AppCommand {
  return { id: "reopen-tab", label: t("Reopen Closed Tab"), icon: <HistoryIcon />, keys: REOPEN_TAB_KEYS, enabled: ctx.canReopenTab, keywords: t("restore undo close"), run: ctx.do.reopenTab };
}

/** Open, clone or create a repository: there with or without one open. */
export function startCommands(ctx: MenuBarContext): AppCommand[] {
  return [
    { id: "open", label: t("Open Repository…"), icon: <FolderIcon />, keys: "CmdOrCtrl+O", run: ctx.do.open },
    { id: "clone", label: t("Clone Repository…"), icon: <CloneIcon />, run: ctx.do.clone },
    { id: "init", label: t("New Repository…"), icon: <NewRepoIcon />, run: ctx.do.create },
  ];
}

/** The command palette, the list of keyboard shortcuts, diagnostics for bug reports, and the licences. */
export function helpCommandsFor(ctx: MenuBarContext): AppCommand[] {
  return [
    { id: "palette", label: t("Command Palette"), icon: <SearchIcon />, keys: "CmdOrCtrl+K", run: ctx.do.palette },
    { id: "shortcuts", label: t("Keyboard Shortcuts"), icon: <KeyboardIcon />, run: ctx.do.shortcuts },
    { id: "tours", label: t("Tours…"), icon: <InfoIcon />, run: ctx.do.tours },
    { id: "diagnostics", label: t("Copy Diagnostics…"), icon: <CopyIcon />, run: ctx.do.diagnostics },
    { id: "notices", label: t("Third-Party Licences…"), icon: <NotesIcon />, run: ctx.do.notices },
  ];
}

/** About Tributary, which shows the version and checks for updates: at the end of Help, or in the app menu on macOS. */
export function aboutCommandsFor(ctx: MenuBarContext): AppCommand[] {
  return [{ id: "about", label: t("About Tributary"), icon: <InfoIcon />, keywords: t("check for updates version"), run: ctx.do.about }];
}

/** On macOS these are in the app menu instead. */
const IN_APP_MENU = new Set(["about"]);

/** File, View, Repository and Help, with every command and its shortcut. */
export function appMenus(ctx: MenuBarContext): AppMenuDefinition[] {
  const { snapshot, preferences } = ctx;
  const { previews, setPreviews, profilePictures, setProfilePictures, fetchMinutes, autoFetch, setAutoFetch } = preferences;
  const { zoom, sidebarOpen, setSidebarOpen, activityOpen, setActivityOpen } = preferences;
  const { firstParentOnly, setFirstParentOnly, daySeparators, setDaySeparators, dense, setDense, simpleMode, setSimpleMode } = preferences;
  const run = ctx.do;
  const fileCommands = startCommands(ctx);
  const settings = settingsCommand(ctx);
  const helpCommands = helpCommandsFor(ctx);
  const aboutCommands = aboutCommandsFor(ctx);
  const zoomCommands: AppCommand[] = [
    { id: "zoom-in", label: t("Zoom In"), keys: "CmdOrCtrl+=", run: () => run.zoom(1) },
    { id: "zoom-out", label: t("Zoom Out"), keys: "CmdOrCtrl+-", run: () => run.zoom(-1) },
    { id: "zoom-reset", label: t("Actual Size (now {0}%)", Math.round(zoom * 100)), keys: "CmdOrCtrl+0", run: () => run.zoom(0) },
  ];
  const settingCommands: AppCommand[] = [
    { id: "previews", label: t("Previews on Hover"), checked: previews, run: () => setPreviews(!previews) },
    { id: "pictures", label: t("Profile Pictures (GitHub, GitLab, Gravatar)"), checked: profilePictures, run: () => setProfilePictures(!profilePictures) },
    { id: "auto-fetch", label: t("Fetch Every {0}", fetchMinutes === 1 ? t("Minute") : t("{0} Minutes", fetchMinutes)), checked: autoFetch, run: () => setAutoFetch(!autoFetch) },
  ];

  /** The menu bar: on macOS the system's own, elsewhere one in the tab bar. */
  const menus = (): AppMenuDefinition[] => {
    if (!snapshot) {
      return [
        { label: t("File"), entries: [...fileCommands, reopenTabCommand(ctx), ...(isMac ? [] : ["-" as const, settings])] },
        { label: t("View"), entries: [...settingCommands, "-", ...zoomCommands] },
        { label: t("Help"), entries: [...helpCommands, "-", ...aboutCommands] },
      ];
    }
    const hasRemotes = snapshot.remotes.length > 0 && !snapshot.bare;
    const canChange = !snapshot.bare && !ctx.running;
    const remote = webRemote(snapshot);
    const prBranch = snapshot.headBranch && snapshot.upstream ? splitRemoteBranch(snapshot.upstream.name, snapshot.remotes).branch : null;
    const prUrl = remote && prBranch ? newPullRequestUrl(remote, prBranch) : null;
    const head = ctx.head;
    return [
      {
        label: t("File"),
        entries: [
          { id: "new-tab", label: t("New Tab"), keys: "CmdOrCtrl+T", icon: <PlusIcon />, run: run.newTab },
          reopenTabCommand(ctx),
          ...fileCommands,
          "-",
          { id: "close-tab", label: t("Close Tab"), keys: "CmdOrCtrl+W", icon: <CloseIcon />, run: () => run.closeTab(snapshot.path) },
          ...(isMac ? [] : ["-" as const, settings]),
        ],
      },
      {
        label: t("View"),
        entries: [
          { id: "simple-mode", label: t("Simple Mode"), checked: simpleMode, run: () => setSimpleMode(!simpleMode) },
          "-",
          { id: "search", label: t("Search Commits"), keys: "CmdOrCtrl+F", icon: <SearchIcon />, run: run.search },
          { id: "go-to-commit", label: t("Go to Commit…"), keys: "CmdOrCtrl+G", icon: <CommitIcon />, keywords: t("jump sha hash tag date day"), run: () => run.dialog({ kind: "goToCommit" }) },
          helpCommands[0],
          "-",
          { id: "sidebar", label: t("Branches Sidebar"), keys: "CmdOrCtrl+B", checked: sidebarOpen, run: () => setSidebarOpen(!sidebarOpen) },
          { id: "activity", label: t("Activity"), keys: "CmdOrCtrl+Shift+L", checked: activityOpen, run: () => setActivityOpen(!activityOpen) },
          "-",
          { id: "first-parent", label: t("Only {0}'s Own History", snapshot.headBranch ?? "HEAD"), checked: firstParentOnly, run: () => setFirstParentOnly(!firstParentOnly) },
          { id: "show-all", label: t("Show All Branches"), enabled: ctx.hiddenCount > 0, run: run.showAllBranches },
          { id: "mine", label: t("Highlight My Commits"), checked: ctx.highlightingMine, enabled: Boolean(snapshot.user), run: run.highlightMine },
          { id: "team", label: t("Team Activity"), keys: "CmdOrCtrl+Shift+T", checked: ctx.teamOpen, run: run.team },
          ...(run.forks ? [{ id: "forks", label: t("Your Forks"), checked: ctx.forksOpen, keywords: t("fork sync upstream original github"), run: run.forks }] : []),
          "-",
          { id: "view-options", label: t("View Options…"), keys: "CmdOrCtrl+Shift+O", icon: <ViewIcon />, keywords: t("theme accent graph columns rows appearance look"), run: run.viewOptions },
          { id: "day-separators", label: t("Day Separators"), checked: daySeparators, run: () => setDaySeparators(!daySeparators) },
          { id: "dense", label: t("Compact Rows"), checked: dense, run: () => setDense(!dense) },
          ...settingCommands.slice(0, 2),
          "-",
          ...zoomCommands,
          "-",
          { id: "reset-layout", label: t("Reset Column and Panel Sizes"), run: run.resetLayout },
        ],
      },
      {
        label: t("Repository"),
        entries: [
          { id: "refresh", label: t("Refresh"), keys: "CmdOrCtrl+R", icon: <RefreshIcon />, run: run.refresh },
          { id: "fetch", label: t("Fetch"), icon: <FetchIcon />, enabled: hasRemotes && canChange, run: () => run.act({ kind: "fetch" }) },
          { id: "pull", label: t("Pull"), icon: <PullIcon />, enabled: hasRemotes && canChange && Boolean(snapshot.upstream), run: () => run.act({ kind: "pull" }) },
          { id: "push", label: t("Push"), icon: <PushIcon />, enabled: hasRemotes && canChange && Boolean(snapshot.headBranch), run: () => run.act({ kind: "push", force: false }) },
          { id: "sync", label: t("Sync (Pull, Then Push)"), icon: <SyncIcon />, keywords: t("pull push both diverged"), enabled: hasRemotes && canChange && Boolean(snapshot.upstream), run: () => run.act({ kind: "sync" }) },
          { id: "force-push", label: t("Force Push…"), icon: <PushIcon />, danger: true, enabled: hasRemotes && canChange && Boolean(snapshot.headBranch), run: () => run.dialog({ kind: "forcePush" }) },
          "-",
          { id: "commit", label: t("Commit…"), icon: <PlusIcon />, enabled: Boolean(snapshot.worktree) && canChange, run: () => run.select(WORKTREE_ID) },
          { id: "stash", label: t("Stash Changes…"), icon: <StashIcon />, enabled: Boolean(snapshot.worktree) && canChange, run: () => run.dialog({ kind: "stash" }) },
          { id: "shelves", label: t("Shelves…"), icon: <ShelfIcon />, run: () => run.dialog({ kind: "shelves" }) },
          { id: "local-history", label: t("Local History…"), icon: <HistoryIcon />, run: () => run.dialog({ kind: "localHistory" }) },
          "-",
          {
            id: "branches-menu",
            label: t("Branches"),
            icon: <BranchIcon />,
            entries: [
              { id: "new-branch", label: t("New Branch…"), icon: <BranchIcon />, enabled: Boolean(head) && canChange, run: () => head && run.dialog({ kind: "newBranch", target: head }) },
              { id: "new-tag", label: t("New Tag…"), icon: <TagIcon />, enabled: Boolean(head) && canChange, run: () => head && run.dialog({ kind: "tag", target: head }) },
              { id: "new-worktree", label: t("New Worktree…"), icon: <FolderIcon />, enabled: Boolean(head) && canChange, run: () => head && run.dialog({ kind: "newWorktree", start: head }) },
              ...(prUrl
                ? [{ id: "pull-request", label: remote?.host === "gitlab" ? t("Create Merge Request…") : t("Create Pull Request…"), icon: <PullRequestIcon />, run: () => run.dialog({ kind: "createPullRequest", branch: prBranch!, local: snapshot.headBranch, url: prUrl }) }]
                : []),
              "-",
              { id: "prune", label: t("Prune Branches…"), icon: <BroomIcon />, enabled: canChange, run: () => run.dialog({ kind: "prune" }) },
              { id: "restore", label: t("Restore Branch…"), icon: <HistoryIcon />, enabled: canChange, run: () => run.dialog({ kind: "restore" }) },
            ],
          },
          {
            id: "history-menu",
            label: t("History"),
            icon: <FileHistoryIcon />,
            entries: [
              { id: "file-history", label: t("File History…"), icon: <FileHistoryIcon />, run: () => run.history(false) },
              { id: "folder-history", label: t("Folder History…"), icon: <FolderIcon />, run: () => run.history(true) },
              "-",
              { id: "recover", label: t("Recover Commits…"), icon: <RecoverIcon />, run: () => run.dialog({ kind: "recover" }) },
              {
                id: "bisect",
                label: t("Find What Broke (Bisect)…"),
                icon: <TargetIcon />,
                keywords: t("bisect bug regression good bad"),
                enabled: canChange && Boolean(snapshot.headCommit) && !snapshot.bisect,
                run: () => run.dialog({ kind: "bisect" }),
              },
              {
                id: "apply-patch",
                label: t("Apply Patch…"),
                icon: <DownloadIcon />,
                enabled: canChange,
                run: async () => {
                  const file = await openFile({ multiple: false, directory: false, title: t("Apply a patch"), filters: [{ name: "Patch", extensions: ["patch", "diff", "mbox", "eml"] }] });
                  if (typeof file === "string") run.dialog({ kind: "applyPatch", file });
                },
              },
            ],
          },
          {
            id: "lfs-menu",
            label: t("Git LFS"),
            icon: <LockIcon />,
            entries: [
              ...(ctx.usesLocks ? [{ id: "lock-files", label: t("Lock Files…"), icon: <LockIcon />, enabled: canChange, run: run.lockFiles }] : []),
              ...(ctx.lfsPointers > 0
                ? [{ id: "download-lfs", label: t("Download Git LFS Files"), icon: <DownloadIcon />, enabled: canChange, run: () => run.act({ kind: "downloadLfsFiles" }) }]
                : []),
              ...(ctx.usesLocks || ctx.usesLfs
                ? [{ id: "prune-lfs", label: t("Clean Up Git LFS Files…"), icon: <BroomIcon />, enabled: canChange, run: () => run.dialog({ kind: "pruneLfs" }) }]
                : []),
            ],
          },
          {
            id: "tools-menu",
            label: t("Tools"),
            icon: <SearchIcon />,
            entries: [
              { id: "project-setup", label: t("Check Project Setup…"), icon: <CheckIcon />, run: () => run.dialog({ kind: "projectSetup" }) },
              { id: "repo-size", label: t("What Makes It Big…"), icon: <BroomIcon />, run: () => run.dialog({ kind: "repoSize" }) },
              {
                id: "ignore-reason",
                label: t("Why Is a File Ignored…"),
                icon: <IgnoreIcon />,
                run: () => run.dialog({ kind: "ignoreReason", file: null }),
              },
            ],
          },
          "-",
          {
            id: "open-menu",
            label: t("Open"),
            icon: <ExternalLinkIcon />,
            entries: [
              ...(remote ? [{ id: "open-web", label: t("Open on {0}", siteName(remote)), icon: <ExternalLinkIcon />, run: () => openInBrowser(remote.url) }] : []),
              { id: "reveal", label: isMac ? t("Show in Finder") : t("Show in Explorer"), icon: <FolderIcon />, run: run.reveal },
              ...(ctx.openApps.editor
                ? [{ id: "open-editor", label: t("Open in {0}", ctx.openApps.editor.name), icon: <CodeIcon />, run: () => ctx.openApps.editor && run.openIn(ctx.openApps.editor) }]
                : []),
              ...(ctx.openApps.terminal
                ? [{ id: "open-terminal", label: t("Open in {0}", ctx.openApps.terminal.name), icon: <TerminalIcon />, run: () => ctx.openApps.terminal && run.openIn(ctx.openApps.terminal) }]
                : []),
            ],
          },
          { id: "repo-settings", label: t("Repository Settings…"), icon: <GearIcon />, run: () => run.dialog({ kind: "repoSettings" }) },
          "-",
          settingCommands[2],
        ],
      },
      { label: t("Help"), entries: [...helpCommands, "-", ...aboutCommands] },
    ];
  };
  return menus();
}

/** The entries without those that go in the app menu, and without the separators left at the end. */
function withoutAppMenuCommands(entries: MenuEntry[]): MenuEntry[] {
  const kept = entries.filter((entry) => entry === "-" || isSubmenu(entry) || !IN_APP_MENU.has(entry.id));
  while (kept[kept.length - 1] === "-") kept.pop();
  return kept;
}

/** Menu entries as macOS menu items, submenus included (and left out when empty). */
function nativeItems(entries: MenuEntry[]): NativeMenu["items"] {
  const items: NativeMenu["items"] = [];
  let separated = false;
  for (const entry of entries) {
    if (entry === "-") {
      separated = items.length > 0;
      continue;
    }
    if (isSubmenu(entry)) {
      const inside = nativeItems(entry.entries);
      if (inside.length === 0) continue;
      items.push({ submenu: entry.label, items: inside, separated });
    } else {
      items.push({ id: entry.id, label: entry.label, accelerator: entry.keys, enabled: entry.enabled ?? true, checked: entry.checked, separated });
    }
    separated = false;
  }
  return items;
}

/** The menus as macOS shows them: the app menu first, Edit after File and Window before Help. */
export function nativeMenusFor(menus: AppMenuDefinition[]): NativeMenu[] {
  return [
    { label: t("Tributary"), items: [{ id: "about", label: t("About Tributary") }, { system: "Separator" }, { id: "settings", label: t("Settings…"), accelerator: "CmdOrCtrl+," }, { system: "Separator" }, { system: "Services" }, { system: "Separator" }, { system: "Hide" }, { system: "HideOthers" }, { system: "ShowAll" }, { system: "Separator" }, { system: "Quit" }] },
    ...menus.flatMap((m, index): NativeMenu[] => {
      const menu = { label: m.label, items: nativeItems(withoutAppMenuCommands(m.entries)) };
      if (index === 0) {
        return [menu, { label: t("Edit"), items: [{ system: "Undo" }, { system: "Redo" }, { system: "Separator" }, { system: "Cut" }, { system: "Copy" }, { system: "Paste" }, { system: "SelectAll" }] }];
      }
      if (m.label === "Help") return [{ label: t("Window"), items: [{ system: "Minimize" }, { system: "Maximize" }, { system: "Fullscreen" }] }, menu];
      return [menu];
    }),
  ];
}
