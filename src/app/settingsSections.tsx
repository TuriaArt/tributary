import type { ColumnOptions } from "../components/CommitList";
import { appearanceRows } from "../components/AppearanceRows";
import { BranchIcon, ClockIcon, ColumnsIcon, ContrastIcon, DiffIcon, FetchIcon, ForkIcon, GearIcon, HistoryIcon, KeyIcon, LockIcon, SidebarIcon, TransferIcon, UserIcon } from "../components/Icons";
import { describeForkRun, type ForkSyncEvery } from "../lib/forks";
import { SshKeys } from "../components/SshKeys";
import { SIDEBAR_SECTIONS } from "../components/sidebar/WorkLists";
import { describeRun, nextRun, type ScheduleDays } from "../lib/schedule";
import type { SettingRow, SettingsSection } from "../components/SettingsDialog";
import type { GitHubStatus, GitLabStatus } from "../api";
import { GITLAB_COM, type Forge } from "./useAccounts";
import type { Theme } from "../lib/appearance";
import { FETCH_MINUTES, HISTORY_MINUTES, SCHEDULE_TIMES, ZOOM_LEVELS } from "./constants";
import type { NewCommitNotices, Preferences, ReleaseLocks, SubmoduleUpdates } from "./usePreferences";
import { Button } from "../components/ui/Button";
import { LANGUAGES, language, languageSetting, setLanguageSetting, t, type LanguageSetting } from "../lib/i18n";
import { plural } from "../lib/format";

/** The Settings section with the diff and merge tools, to open it at. */
export const DIFF_SECTION = t("Diff and merge");

interface Options {
  preferences: Preferences;
  /** Fetch the latest of every open repository now, as the schedule does. */
  onFetchLatestNow: () => void;
  /** Who's signed in to GitHub and GitLab. */
  accounts: {
    github: GitHubStatus | null;
    githubError: string | null;
    gitlab: GitLabStatus | null;
    gitlabError: string | null;
    onSignIn: (forge: Forge) => void;
    onSignOut: (forge: Forge) => void;
  };
  /** Which diff and merge tools git opens. */
  diffTools: SettingRow[];
  /** The editor and terminal "Open in …" uses. */
  apps: SettingRow[];
  /** Exporting the settings, and importing them back. */
  transfer: SettingRow[];
  /** The theme in use (for "Same as the system", the system's). */
  theme: Theme;
}

/** Everything in the Settings window: the app's own settings (each repository has its own window). */
export function settingsSections({ preferences, onFetchLatestNow, accounts, diffTools, apps, transfer, theme }: Options): SettingsSection[] {
  const { reopenTabs, setReopenTabs, autoFetch, setAutoFetch, fetchMinutes, setFetchMinutes } = preferences;
  const { newCommitNotices, setNewCommitNotices, requestNotices, setRequestNotices, largeFileMB, setLargeFileMB, autoLock, setAutoLock, dense, setDense } = preferences;
  const { releaseLocks, setReleaseLocks, submoduleUpdates, setSubmoduleUpdates } = preferences;
  const { daySeparators, setDaySeparators, previews, setPreviews, profilePictures, setProfilePictures, prNumbers, setPrNumbers } = preferences;
  const { columnOptions, setColumnOptions, zoom, setZoom, hiddenSections, setHiddenSections } = preferences;
  const { historyMinutes, setHistoryMinutes, historyMaxMB, setHistoryMaxMB, historyDays, setHistoryDays } = preferences;
  const { scheduleDays, setScheduleDays, scheduleTime, setScheduleTime, scheduleRun } = preferences;
  const { forksShown, setForksShown, forksEvery, setForksEvery, forksRun } = preferences;
  const next = nextRun(scheduleDays, scheduleTime, new Date());
  const looks = appearanceRows(preferences.appearance, preferences.setAppearance, theme);
  const zoomRow: SettingRow = {
    kind: "select",
    label: t("Zoom"),
    value: String(zoom),
    options: ZOOM_LEVELS.map((level) => ({ value: String(level), label: `${Math.round(level * 100)}%` })),
    set: (value) => setZoom(Number(value)),
  };
  const sections: SettingsSection[] = [
    {
      title: t("General"),
      icon: <GearIcon size={15} />,
      rows: [
        {
          kind: "select",
          // Named in English too, so it can be found whichever language the app is in.
          label: language() === "en" ? "Language" : `${t("Language")} (Language)`,
          hint: t("The language of the app's menus, buttons and messages. Changing it reloads the window."),
          value: languageSetting(),
          options: [{ value: "system", label: t("Same as the system") }, ...LANGUAGES],
          set: (value) => setLanguageSetting(value as LanguageSetting),
        },
        {
          kind: "toggle",
          label: t("Simple mode"),
          hint: t("Get latest, your changes with their locks and Submit (commit and push in one), and what the team's working on, without branches and the commit graph. View → Simple Mode, or Full view, switches back."),
          value: preferences.simpleMode,
          set: preferences.setSimpleMode,
        },
        {
          kind: "toggle",
          label: t("Offer tours"),
          hint: t("A short guided tour when you first come across something, like locks or Simple mode. Help → Tours has them all, any time."),
          value: !preferences.toursOff,
          set: (offered) => preferences.setToursOff(!offered),
        },
        {
          kind: "toggle",
          label: t("Introduce Why Is a File Ignored…"),
          hint: t("What it does, before you choose a file (Repository → Tools)."),
          value: !preferences.skipIgnoreIntro,
          set: (shown) => preferences.setSkipIgnoreIntro(!shown),
        },
        {
          kind: "toggle",
          label: t("Reopen tabs on launch"),
          hint: t("The repositories you had open when you last quit open again."),
          value: reopenTabs,
          set: setReopenTabs,
        },
        ...apps,
        {
          kind: "select",
          label: t("Submodules after a checkout or pull"),
          hint: t("When the commit recorded for a submodule changes, git leaves the submodule where it was until it's updated."),
          value: submoduleUpdates,
          options: [
            { value: "ask", label: t("Offer to update them") },
            { value: "always", label: t("Update them") },
            { value: "never", label: t("Leave them as they are") },
          ],
          set: (value) => setSubmoduleUpdates(value as SubmoduleUpdates),
        },
      ],
    },
    {
      title: t("Appearance"),
      icon: <ContrastIcon size={15} />,
      rows: [...looks.look, zoomRow, looks.reset],
    },
    {
      title: t("Graph"),
      icon: <BranchIcon size={15} />,
      parent: t("Appearance"),
      rows: looks.graph,
    },
    {
      title: t("Commit list"),
      icon: <ColumnsIcon size={15} />,
      parent: t("Appearance"),
      rows: [
        { kind: "toggle", label: t("Compact rows"), value: dense, set: setDense },
        { kind: "toggle", label: t("Day separators"), value: daySeparators, set: setDaySeparators },
        {
          kind: "toggle",
          label: t("Pull request numbers"),
          hint: t("On branch labels, beside the icon for the pull request's checks (a spinner while they run, a tick or a cross). Without them, labels leave more room for the branch's name; the sidebar always has them."),
          value: prNumbers,
          set: setPrNumbers,
        },
        { kind: "toggle", label: t("Previews on hover"), hint: t("A commit's details when you rest the pointer on it."), value: previews, set: setPreviews },
        {
          kind: "toggle",
          label: t("Profile pictures"),
          hint: t("Looked up by email address: on GitHub or GitLab for repositories there, otherwise on Gravatar (which gets a hash of the address)."),
          value: profilePictures,
          set: setProfilePictures,
        },
        {
          kind: "toggle",
          label: t("Checks on commits"),
          hint: t("A dot on each commit for its CI on GitHub or GitLab: green when the checks passed, red when they failed, amber while they run."),
          value: columnOptions.checks !== false,
          set: (on) => setColumnOptions({ ...columnOptions, checks: on }),
        },
        {
          kind: "custom",
          label: t("Columns"),
          content: (
            <span className="settings-checks">
              {(["author", "date", "sha"] as const).map((column) => (
                <label key={column} className="checkbox">
                  <input
                    type="checkbox"
                    checked={columnOptions[column]}
                    onChange={() => setColumnOptions({ ...columnOptions, [column]: !columnOptions[column] })}
                  />
                  {column === "sha" ? "SHA" : column[0].toUpperCase() + column.slice(1)}
                </label>
              ))}
            </span>
          ),
        },
        {
          kind: "select",
          label: t("Dates"),
          value: columnOptions.dateFormat,
          options: [
            { value: "relative", label: t("Relative (“3 hours ago”)") },
            { value: "exact", label: t("Exact dates and times") },
          ],
          set: (value) => setColumnOptions({ ...columnOptions, dateFormat: value as ColumnOptions["dateFormat"] }),
          disabled: !columnOptions.date,
        },
        {
          kind: "select",
          label: t("Which date"),
          value: columnOptions.dateKind,
          options: [
            { value: "authored", label: t("When it was written") },
            { value: "committed", label: t("When it was committed") },
          ],
          set: (value) => setColumnOptions({ ...columnOptions, dateKind: value as ColumnOptions["dateKind"] }),
          disabled: !columnOptions.date,
        },
      ],
    },
    {
      title: t("Sidebar"),
      icon: <SidebarIcon size={15} />,
      parent: t("Appearance"),
      // The same switches as the menu by the sidebar's filter.
      rows: SIDEBAR_SECTIONS.map(
        (entry): SettingRow => ({
          kind: "toggle",
          label: entry.title,
          hint: entry.hint || undefined,
          value: !hiddenSections.includes(entry.id),
          set: (shown) => setHiddenSections(shown ? hiddenSections.filter((id) => id !== entry.id) : [...hiddenSections, entry.id]),
        }),
      ),
    },
    {
      title: t("Accounts"),
      icon: <UserIcon size={15} />,
      rows: [
        accountRow({
          forge: "github",
          name: "GitHub",
          error: accounts.githubError,
          known: accounts.github !== null,
          who: accounts.github?.account ? `${accounts.github.account.login}${accounts.github.account.name ? ` (${accounts.github.account.name})` : ""}` : null,
          rejected: Boolean(accounts.github?.tokenRejected),
          signedIn: t("Pull requests of private repositories show too, and Clone lists your repositories."),
          signedOut: t("Sign in to see pull requests of private repositories, pick from your repositories when cloning, and push without being asked."),
          onSignIn: accounts.onSignIn,
          onSignOut: accounts.onSignOut,
        }),
        accountRow({
          forge: "gitlab",
          name: accounts.gitlab && accounts.gitlab.host !== GITLAB_COM ? `GitLab (${accounts.gitlab.host})` : "GitLab",
          error: accounts.gitlabError,
          known: accounts.gitlab !== null,
          who: accounts.gitlab?.account ? `${accounts.gitlab.account.username}${accounts.gitlab.account.name ? ` (${accounts.gitlab.account.name})` : ""}` : null,
          rejected: Boolean(accounts.gitlab?.tokenRejected),
          signedIn: t("Merge requests of private projects show too, and Clone lists your projects."),
          signedOut: t("Sign in to gitlab.com or your company's GitLab to see merge requests of private projects, pick from your projects when cloning, and push without being asked."),
          onSignIn: accounts.onSignIn,
          onSignOut: accounts.onSignOut,
        }),
      ],
    },
    {
      title: t("Forks"),
      icon: <ForkIcon size={15} />,
      parent: t("Accounts"),
      rows: [
        {
          kind: "toggle",
          label: t("Your forks"),
          hint: t("A Forks button in the toolbar, and View → Your Forks, open your forks on GitHub: how far each one is behind the repository it was forked from, its new commits, and Sync, which brings them into the fork on GitHub, as its Sync fork button does. You need to be signed in to GitHub."),
          value: forksShown,
          set: setForksShown,
        },
        {
          kind: "select",
          label: t("Sync the forks with Auto on"),
          hint: t("While Tributary is open, and when it starts. Each fork has its Auto switch on the Forks screen. A fork whose own changes clash with its original's is left for you, and Tributary says which."),
          value: forksEvery,
          options: [
            { value: "hour", label: t("Every hour") },
            { value: "day", label: t("Every day") },
            { value: "off", label: t("Only when I press Sync") },
          ],
          set: (value) => setForksEvery(value as ForkSyncEvery),
          disabled: !forksShown,
        },
        ...(forksRun && forksShown
          ? [
              {
                kind: "custom" as const,
                label: t("Last time"),
                hint: `${new Date(forksRun.time).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}: ${describeForkRun(forksRun) ?? t("all up to date.")}`,
                content: null,
              },
            ]
          : []),
      ],
    },
    {
      title: t("SSH keys"),
      icon: <KeyIcon size={15} />,
      rows: [{ kind: "block", label: t("Your SSH keys"), content: <SshKeys /> }],
    },
    {
      title: t("Fetching"),
      icon: <FetchIcon size={15} />,
      rows: [
        {
          kind: "toggle",
          label: t("Fetch in the background"),
          hint: t("Keeps the pull and push counts current."),
          value: autoFetch,
          set: setAutoFetch,
        },
        {
          kind: "select",
          label: t("How often"),
          value: String(fetchMinutes),
          options: FETCH_MINUTES.map((minutes) => ({ value: String(minutes), label: minutes === 1 ? t("Every minute") : t("Every {0} minutes", minutes) })),
          set: (value) => setFetchMinutes(Number(value)),
          disabled: !autoFetch,
        },
        {
          kind: "select",
          label: t("New commits"),
          hint: t("When a background fetch finds new commits on main, or on the branch yours tracks."),
          value: newCommitNotices,
          options: [
            { value: "off", label: t("Don't tell me") },
            { value: "app", label: t("Show a message in Tributary") },
            { value: "system", label: t("Also notify me when Tributary is in the background") },
          ],
          set: (value) => setNewCommitNotices(value as NewCommitNotices),
          disabled: !autoFetch,
        },
        {
          kind: "select",
          label: t("Your pull requests"),
          hint: t("Reviews and comments on the pull requests you opened (or from your branches), checks that finish or fail, and merges, on GitHub and GitLab."),
          value: requestNotices,
          options: [
            { value: "off", label: t("Don't tell me") },
            { value: "app", label: t("Show a message in Tributary") },
            { value: "system", label: t("Also notify me when Tributary is in the background") },
          ],
          set: (value) => setRequestNotices(value as NewCommitNotices),
        },
      ],
    },
    {
      title: t("Fetch latest"),
      icon: <ClockIcon size={15} />,
      parent: t("Fetching"),
      rows: [
        {
          kind: "select",
          label: t("Fetch the latest of every open repository"),
          hint: t("Fetches each open tab's repository and moves your branch forward when it can without merging (never past commits of your own, or changes it would overwrite), with its Git LFS files, so a big update is waiting when you start. Tributary has to be running and the computer awake; one that was asleep catches up within an hour of the time, or waits for the next day."),
          value: scheduleDays,
          options: [
            { value: "off", label: t("Only when I fetch") },
            { value: "weekdays", label: t("On weekdays") },
            { value: "daily", label: t("Every day") },
          ],
          set: (value) => setScheduleDays(value as ScheduleDays),
        },
        {
          kind: "select",
          label: t("At"),
          hint: next ? t("Next: {0}", next.toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })) : undefined,
          value: scheduleTime,
          options: (SCHEDULE_TIMES.includes(scheduleTime) ? SCHEDULE_TIMES : [scheduleTime, ...SCHEDULE_TIMES]).map((time) => ({ value: time, label: time })),
          set: setScheduleTime,
          disabled: scheduleDays === "off",
        },
        {
          kind: "custom",
          label: t("Last time"),
          hint: scheduleRun
            ? `${new Date(scheduleRun.time).toLocaleString(undefined, { weekday: "long", hour: "2-digit", minute: "2-digit" })}: ${describeRun(scheduleRun)}.${scheduleRun.results
                .filter((result) => !result.ok)
                .map((result) => ` ${result.name}: ${result.message}`)
                .join("")}`
            : t("Not yet."),
          content: (
            <Button kind="outline" onClick={onFetchLatestNow}>
              <FetchIcon size={14} />
              <span className="button-label">{t("Fetch latest now")}</span>
            </Button>
          ),
        },
      ],
    },
    {
      title: t("Local history"),
      icon: <HistoryIcon size={15} />,
      rows: [
        {
          kind: "select",
          label: t("Keep snapshots of your changes"),
          hint: t("Every few minutes, the files you've changed but not committed are kept, so a crash or an overwrite doesn't lose your work. Repository → Local History… puts them back."),
          value: String(historyMinutes),
          options: [
            { value: "0", label: t("Never") },
            ...HISTORY_MINUTES.map((minutes) => ({ value: String(minutes), label: t("Every {0} minutes", minutes) })),
          ],
          set: (value) => setHistoryMinutes(Number(value)),
        },
        {
          kind: "select",
          label: t("Leave out files bigger than"),
          hint: t("A copy of every version of big files would fill the disk."),
          value: String(historyMaxMB),
          options: [10, 50, 200, 1000].map((mb) => ({ value: String(mb), label: mb >= 1000 ? `${mb / 1000} GB` : `${mb} MB` })),
          set: (value) => setHistoryMaxMB(Number(value)),
          disabled: historyMinutes <= 0,
        },
        {
          kind: "select",
          label: t("Keep them for"),
          value: String(historyDays),
          options: [1, 3, 7, 14, 30].map((days) => ({ value: String(days), label: days === 1 ? t("A day") : plural(days, "day") })),
          set: (value) => setHistoryDays(Number(value)),
          disabled: historyMinutes <= 0,
        },
      ],
    },
    {
      title: t("Large files and Git LFS"),
      icon: <LockIcon size={15} />,
      rows: [
        {
          kind: "select",
          label: t("Warn about big files outside Git LFS"),
          hint: t("Committed into git itself, they stay in every clone forever."),
          value: String(largeFileMB),
          options: [1, 5, 10, 25, 50, 100].map((mb) => ({ value: String(mb), label: t("Bigger than {0} MB", mb) })),
          set: (value) => setLargeFileMB(Number(value)),
        },
        {
          kind: "toggle",
          label: t("Lock files when I change them"),
          hint: t("Lockable files (like .uasset), as soon as you change one that nobody has locked."),
          value: autoLock,
          set: setAutoLock,
        },
        {
          kind: "select",
          label: t("After pushing"),
          hint: t("Your locks on the files you pushed, so your teammates can work on them. Files you're still changing keep theirs."),
          value: releaseLocks,
          options: [
            { value: "ask", label: t("Ask to release my locks") },
            { value: "always", label: t("Release my locks") },
            { value: "never", label: t("Keep my locks") },
          ],
          set: (value) => setReleaseLocks(value as ReleaseLocks),
        },
      ],
    },
    {
      title: DIFF_SECTION,
      icon: <DiffIcon size={15} />,
      rows: diffTools,
    },

    {
      title: t("Export and import"),
      icon: <TransferIcon size={15} />,
      separated: true,
      rows: transfer,
    },
  ];
  return sections;
}

/** An account's row: who's signed in (or why not), and a button to sign in or out. */
function accountRow({
  forge,
  name,
  error,
  known,
  who,
  rejected,
  signedIn,
  signedOut,
  onSignIn,
  onSignOut,
}: {
  forge: Forge;
  name: string;
  error: string | null;
  known: boolean;
  who: string | null;
  rejected: boolean;
  signedIn: string;
  signedOut: string;
  onSignIn: (forge: Forge) => void;
  onSignOut: (forge: Forge) => void;
}): SettingRow {
  return {
    kind: "custom",
    label: name,
    hint: error
      ? t("Couldn't check: {0}", error)
      : !known
        ? t("Checking…")
        : who
          ? t("Signed in as {0}. {1} Signing out makes git forget the token too.", who, signedIn)
          : rejected
            ? t("The token git keeps for {0} doesn't work any more. Sign in again.", name)
            : signedOut,
    content: who ? (
      <span className="settings-buttons">
        <Button kind="outline" onClick={() => onSignIn(forge)}>
          <span className="button-label">{t("Switch account…")}</span>
        </Button>
        <Button kind="outline" onClick={() => onSignOut(forge)}>
          <span className="button-label">{t("Sign out")}</span>
        </Button>
      </span>
    ) : (
      <Button kind="outline" onClick={() => onSignIn(forge)} disabled={!known && !error}>
        <span className="button-label">{rejected ? t("Sign in again…") : t("Sign in…")}</span>
      </Button>
    ),
  };
}
