import { fullRefName, type Action, type RepoSnapshot } from "../api";
import type { Command } from "../components/CommandPalette";
import {
  ActivityIcon,
  BranchIcon,
  CloudIcon,
  EyeIcon,
  EyeOffIcon,
  GearIcon,
  MergeIcon,
  RebaseIcon,
  SidebarIcon,
  UserIcon,
  ViewIcon,
} from "../components/Icons";
import { splitRemoteBranch } from "../menus";
import { commandsIn, shortcutLabel } from "./appCommand";
import type { AppMenuDefinition } from "./appMenus";
import type { Focus } from "./constants";
import type { Preferences } from "./usePreferences";
import { t } from "../lib/i18n";

/** What the command palette needs from the app. */
export interface PaletteContext {
  menus: AppMenuDefinition[];
  snapshot: RepoSnapshot;
  tabs: { path: string; name: string }[];
  canChange: boolean;
  /** Local branch names, to know which remote branches can be checked out. */
  localBranches: Set<string>;
  /** The checked-out branch, or "HEAD". */
  branchLabel: string;
  /** Something is highlighted. */
  focused: boolean;
  preferences: Preferences;
  run: (action: Action, options?: { quiet?: boolean }) => void;
  switchTab: (path: string) => void;
  setFocus: (focus: Focus | null) => void;
  setHidden: (names: string[], hidden: boolean) => void;
  openSettings: () => void;
  highlightMine: () => void;
}

/** Everything the command palette can do: the menu bar's commands, plus one for each branch and tab. */
export function paletteCommands(ctx: PaletteContext): Command[] {
  const { menus, snapshot, tabs, canChange, localBranches, branchLabel, preferences } = ctx;
  const { activityOpen, setActivityOpen, sidebarOpen, setSidebarOpen, dense, setDense } = preferences;
  const run = (action: Action, options?: { quiet?: boolean }) => ctx.run(action, options);
  const list: Command[] = [];
  const seen = new Set<string>();
  const add = (command: Command, enabled = true) => {
    if (!enabled || seen.has(command.id)) return;
    seen.add(command.id);
    list.push(command);
  };
  for (const m of menus) {
    for (const entry of commandsIn(m.entries)) {
      if (entry.enabled === false) continue;
      const label = entry.checked === undefined ? entry.label : `${entry.checked ? t("Turn off") : t("Turn on")}: ${entry.label}`;
      add({ id: entry.id, label, icon: entry.icon, keywords: entry.keywords, group: m.label === "Repository" ? t("Repository") : m.label === "View" ? t("View") : undefined, shortcut: entry.keys && shortcutLabel(entry.keys), run: entry.run });
    }
  }
  for (const tab of tabs) {
    if (tab.path !== snapshot.path) add({ id: `tab:${tab.path}`, label: t("Switch to {0}", tab.name), group: t("Tab"), run: () => ctx.switchTab(tab.path) });
  }
  if (snapshot.worktree && canChange) {
    add({ id: "stage-all", label: t("Stage all changes"), group: t("Changes"), run: () => run({ kind: "stageAll" }, { quiet: true }) });
    add({ id: "unstage-all", label: t("Unstage all changes"), group: t("Changes"), run: () => run({ kind: "unstageAll" }, { quiet: true }) });
  }
  if (snapshot.operation && snapshot.operation.kind !== "other" && canChange) {
    add({ id: "continue", label: t("Continue the {0}", snapshot.operation.kind), group: t("In progress"), run: () => run({ kind: "continueOperation" }) });
    add({ id: "abort", label: t("Abort the {0}", snapshot.operation.kind), group: t("In progress"), run: () => run({ kind: "abortOperation" }) });
  }
  for (const commit of snapshot.commits) {
    for (const ref of commit.refs) {
      if (ref.kind === "branch" && !ref.current && canChange) {
        add({ id: `checkout:${ref.name}`, label: t("Check out {0}", ref.name), icon: <BranchIcon />, group: t("Branch"), run: () => run({ kind: "checkoutBranch", name: ref.name }) });
      }
      if (ref.kind === "remote" && canChange) {
        const { branch } = splitRemoteBranch(ref.name, snapshot.remotes);
        if (!localBranches.has(branch)) {
          add({ id: `track:${ref.name}`, label: t("Check out {0} (tracking {1})", branch, ref.name), icon: <CloudIcon />, group: t("Branch"), run: () => run({ kind: "checkoutRemoteBranch", name: ref.name }) });
        }
      }
      if ((ref.kind === "branch" || ref.kind === "remote" || ref.kind === "tag") && !ref.current) {
        if (canChange && snapshot.headBranch && !snapshot.operation) {
          add({ id: `merge:${ref.name}`, label: t("Merge {0} into {1}", ref.name, branchLabel), icon: <MergeIcon />, group: t("Branch"), run: () => run({ kind: "merge", target: ref.name }) });
          add({ id: `rebase:${ref.name}`, label: t("Rebase {0} onto {1}", branchLabel, ref.name), icon: <RebaseIcon />, group: t("Branch"), run: () => run({ kind: "rebase", onto: ref.name }) });
        }
        add({ id: `focus:${ref.name}`, label: t("Highlight {0}'s history", ref.name), icon: <EyeIcon />, group: t("View"), run: () => ctx.setFocus({ kind: "history", name: ref.name, commitId: commit.id }) });
        const name = fullRefName(ref);
        if (name) add({ id: `hide:${name}`, label: t("Hide {0}", ref.name), icon: <EyeOffIcon />, group: t("View"), run: () => ctx.setHidden([name], true) });
      }
    }
  }
  for (const ref of snapshot.hiddenRefs) {
    const name = fullRefName(ref);
    if (name) add({ id: `show:${name}`, label: t("Show {0}", ref.name), icon: <EyeIcon />, group: t("View"), run: () => ctx.setHidden([name], false) });
  }
  add({ id: "settings", label: t("Settings…"), icon: <GearIcon />, shortcut: shortcutLabel("CmdOrCtrl+,"), run: ctx.openSettings });
  if (ctx.focused) add({ id: "unfocus", label: t("Stop highlighting"), icon: <EyeIcon />, group: t("View"), run: () => ctx.setFocus(null) });
  add({ id: "activity", label: activityOpen ? t("Hide activity") : t("Show activity"), icon: <ActivityIcon />, group: t("View"), run: () => setActivityOpen(!activityOpen) });
  add({ id: "mine", label: t("Highlight my commits"), icon: <UserIcon />, group: t("View"), run: ctx.highlightMine }, Boolean(snapshot.user));
  add({ id: "sidebar", label: sidebarOpen ? t("Hide branches sidebar") : t("Show branches sidebar"), icon: <SidebarIcon />, group: t("View"), run: () => setSidebarOpen(!sidebarOpen) });
  add({ id: "dense", label: dense ? t("Normal rows") : t("Compact rows"), icon: <ViewIcon />, group: t("View"), run: () => setDense(!dense) });
  return list;
}
