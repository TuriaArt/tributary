import { useCallback, useEffect, useRef, useState } from "react";
import { forkStatus, gitHubForks, syncFork, type Fork, type Forks, type ForkStatus, type ForkSync } from "../api";
import { barWidth, forkKey, onForkSyncNews, outcomeText, parentKey, shortCount, synced, type ForkSyncEvery } from "../lib/forks";
import { relativeTime } from "../lib/format";
import { Avatar } from "./Avatar";
import { CheckIcon, ChevronRightIcon, CloseIcon, ForkIcon, RefreshIcon, WarningIcon } from "./Icons";
import { Loader } from "./Loader";
import { Button } from "./ui/Button";
import { Switch } from "./ui/Switch";
import { locale, t, tx } from "../lib/i18n";

/** How many forks are compared with their originals at once. */
const AT_ONCE = 4;
/** The longest bar, in pixels, for the fork with the most commits. */
const BAR = 40;

/** A fork's comparison with its original: being read, read, or why it couldn't be. */
type Compared = { status: ForkStatus | null; error: string | null };
/** A fork's sync: running, or how it went. */
type Synced = { running: true } | { running: false; sync: ForkSync | null; error: string | null };

interface Props {
  /** The forks that sync by themselves, as "owner/name", and changing them. */
  auto: string[];
  setAuto: (auto: string[]) => void;
  /** How often those sync, from Settings. */
  every: ForkSyncEvery;
  /** Sign in to GitHub. */
  onSignIn: () => void;
  openUrl: (url: string) => void;
  onClose: () => void;
}

const seconds = (iso: string | null | undefined) => (iso ? Date.parse(iso) / 1000 : NaN);
/** A count in words, with its thousands apart: 2,195. */
const many = (count: number) => count.toLocaleString(locale() ?? "en-US");
/** Whether a sync brought the original's commits in. */
const synced_ = (sync: ForkSync) => synced(sync.outcome);

/**
 * Your forks on GitHub, in place of the history: how far each is behind the repository it
 * was forked from, the original's new commits, and Sync, for one or all of them. Syncing is
 * GitHub's own Sync fork, done on GitHub. A fork's Auto switch has it synced by itself.
 */
export function ForksView({ auto, setAuto, every, onSignIn, openUrl, onClose }: Props) {
  const [list, setList] = useState<{ forks: Forks | null; error: string | null } | null>(null);
  const [compared, setCompared] = useState<Record<string, Compared>>({});
  const [syncs, setSyncs] = useState<Record<string, Synced>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  // Sync all running: its button stays pressed until the last fork is done.
  const [syncingAll, setSyncingAll] = useState(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const compare = useCallback(async (fork: Fork) => {
    const key = forkKey(fork);
    try {
      const status = await forkStatus(fork);
      if (alive.current) setCompared((all) => ({ ...all, [key]: { status, error: null } }));
    } catch (error) {
      if (alive.current) setCompared((all) => ({ ...all, [key]: { status: null, error: String(error) } }));
    }
  }, []);

  // Your forks, then each one's comparison, a few at a time.
  useEffect(() => {
    let current = true;
    setList(null);
    setCompared({});
    setSyncs({});
    gitHubForks()
      .then(async (forks) => {
        if (!current) return;
        setList({ forks, error: null });
        const queue = [...forks.forks];
        const worker = async () => {
          for (let fork = queue.shift(); fork && current; fork = queue.shift()) await compare(fork);
        };
        await Promise.all(Array.from({ length: AT_ONCE }, worker));
      })
      .catch((error) => current && setList({ forks: null, error: String(error) }));
    return () => {
      current = false;
    };
  }, [round, compare]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.querySelector('[role="menu"], [role="dialog"], [aria-modal="true"]')) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const sync = useCallback(
    async (fork: Fork) => {
      const key = forkKey(fork);
      setSyncs((all) => ({ ...all, [key]: { running: true } }));
      try {
        const result = await syncFork(fork);
        // Still syncing until it's compared again, so its old counts never show as behind.
        if (alive.current && synced(result.outcome)) await compare(fork);
        if (alive.current) setSyncs((all) => ({ ...all, [key]: { running: false, sync: result, error: null } }));
      } catch (error) {
        if (alive.current) setSyncs((all) => ({ ...all, [key]: { running: false, sync: null, error: String(error) } }));
      }
    },
    [compare],
  );

  // The automatic sync, while the screen is open: its forks show as if their Sync was pressed.
  useEffect(
    () =>
      onForkSyncNews((news) => {
        if (!alive.current) return;
        const key = forkKey(news.fork);
        if (news.kind === "compared") setCompared((all) => ({ ...all, [key]: { status: news.status, error: null } }));
        else if (news.kind === "syncing") setSyncs((all) => ({ ...all, [key]: { running: true } }));
        else {
          const done = () => alive.current && setSyncs((all) => ({ ...all, [key]: { running: false, sync: news.sync, error: news.error } }));
          if (news.sync && synced(news.sync.outcome)) void compare(news.fork).then(done);
          else done();
        }
      }),
    [compare],
  );

  const forks = list?.forks?.forks ?? [];
  // Behind their originals; and of those, the ones worth syncing: not while one is, nor again
  // after it didn't sync (until the forks are looked at again).
  const behind = forks.filter((fork) => (compared[forkKey(fork)]?.status?.new ?? 0) > 0);
  const toSync = behind.filter((fork) => {
    const sync = syncs[forkKey(fork)];
    const failed = sync && !sync.running && (sync.error !== null || (sync.sync !== null && !synced(sync.sync.outcome)));
    return !sync?.running && !failed;
  });
  const most = Math.max(1, ...forks.map((fork) => Math.max(compared[forkKey(fork)]?.status?.new ?? 0, compared[forkKey(fork)]?.status?.own ?? 0)));
  const syncingAny = Object.values(syncs).some((entry) => entry.running);
  const syncAll = async () => {
    setSyncingAll(true);
    try {
      for (const fork of toSync) {
        if (!alive.current) return;
        await sync(fork);
      }
    } finally {
      if (alive.current) setSyncingAll(false);
    }
  };
  const setAutoFor = (fork: Fork, on: boolean) => {
    const key = forkKey(fork);
    setAuto(on ? [...auto.filter((name) => name !== key), key] : auto.filter((name) => name !== key));
  };
  const reading = forks.some((fork) => !compared[forkKey(fork)]);

  let body;
  if (!list) {
    body = <Loader size={88} title={t("Looking for your forks")} />;
  } else if (list.error) {
    body = (
      <div className="diff-message">
        <strong>{t("Couldn't list your forks")}</strong>
        <span>{list.error}</span>
      </div>
    );
  } else if (!list.forks?.signedIn) {
    body = (
      <div className="diff-message">
        <strong>{t("Sign in to GitHub to see your forks")}</strong>
        <span>{t("Tributary asks GitHub which of your repositories are forks, and syncs them there.")}</span>
        <Button kind="primary" onClick={onSignIn}>
          {t("Sign in to GitHub")}
        </Button>
      </div>
    );
  } else if (forks.length === 0) {
    body = <div className="diff-message muted">{t("You have no forks on GitHub. When you fork a repository there, it shows here.")}</div>;
  } else {
    const often = every === "off" ? t("Auto is off in Settings → Forks") : t("The ones with Auto on sync every {0} while Tributary is open", every);
    body = (
      <>
        <div className="forks-top">
          <p className="forks-summary">
            {forks.length === 1 ? t("1 fork of yours on GitHub") : t("{0} forks of yours on GitHub", forks.length)}
            {reading ? t(" · comparing them with their originals…") : ` · ${behind.length === 0 ? t("all up to date") : behind.length === 1 ? t("1 behind its original") : t("{0} behind their originals", behind.length)}`}
            {` · ${often}.`}
          </p>
          <Button kind="primary" disabled={toSync.length === 0 || syncingAny || syncingAll} aria-busy={syncingAll} onClick={() => void syncAll()}>
            <RefreshIcon size={14} className={syncingAll ? "spin" : undefined} />
            <span className="button-label">{syncingAll ? t("Syncing…") : toSync.length > 1 ? t("Sync {0} behind", toSync.length) : t("Sync")}</span>
          </Button>
        </div>
        <div className="forks-table">
          <div className="forks-row forks-head" aria-hidden="true">
            <span>{t("Fork")}</span>
            <span className="forks-head-bars">{t("Its own · New")}</span>
            <span className="forks-updated">{t("Updated")}</span>
            <span>{t("Auto")}</span>
            <span />
          </div>
          <div className="forks-list" role="list" aria-label={t("Your forks")}>
            {forks.map((fork) => (
              <ForkRow
                key={forkKey(fork)}
                fork={fork}
                compared={compared[forkKey(fork)]}
                synced={syncs[forkKey(fork)]}
                most={most}
                open={open === forkKey(fork)}
                auto={auto.includes(forkKey(fork))}
                onToggle={() => setOpen((shown) => (shown === forkKey(fork) ? null : forkKey(fork)))}
                onAuto={(on) => setAutoFor(fork, on)}
                onSync={() => void sync(fork)}
                openUrl={openUrl}
              />
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <section className="diff-view forks-view" aria-label={t("Your forks")}>
      <header className="diff-header">
        <div className="diff-title">
          <ForkIcon size={14} />
          <span className="team-title">{t("Your forks")}</span>
        </div>
        <Button kind="icon" onClick={() => setRound((n) => n + 1)} disabled={!list || syncingAny || syncingAll} title={t("Look again")} aria-label={t("Look at your forks again")}>
          <RefreshIcon />
        </Button>
        <Button kind="icon" onClick={onClose} title={t("Close (Esc)")} aria-label={t("Close your forks")}>
          <CloseIcon />
        </Button>
      </header>
      <div className="diff-body forks-body">{body}</div>
    </section>
  );
}

interface RowProps {
  fork: Fork;
  compared: Compared | undefined;
  synced: Synced | undefined;
  /** The most commits any fork has new or of its own, for the bars' lengths. */
  most: number;
  open: boolean;
  auto: boolean;
  onToggle: () => void;
  onAuto: (on: boolean) => void;
  onSync: () => void;
  openUrl: (url: string) => void;
}

/** One fork: its name and original, its branch, its own and new commits, and Sync; opened, the new commits. */
function ForkRow({ fork, compared, synced, most, open, auto, onToggle, onAuto, onSync, openUrl }: RowProps) {
  const status = compared?.status ?? null;
  const name = forkKey(fork);
  const compareUrl = `${fork.url}/compare/${encodeURIComponent(fork.branch)}...${encodeURIComponent(fork.parent.owner)}:${encodeURIComponent(fork.parent.branch)}`;
  const result = synced && !synced.running ? synced : null;
  const clashed = result?.sync?.outcome === "conflict";

  let action;
  if (synced?.running)
    action = (
      <span className="forks-note forks-state">
        {tx("{0}Syncing…", <RefreshIcon size={12} className="spin" />)}
      </span>
    );
  else if (result?.error || (result?.sync && !synced_(result.sync) && result.sync.outcome !== "upToDate"))
    action = (
      <button
        className="forks-state bad"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t("{0}: what to do about {1}", clashed ? t("Clashes") : t("Couldn't sync"), name)}
        title={open ? undefined : t("See what to do")}
      >
        <WarningIcon size={12} />
        <span className="button-label">{clashed ? t("Clashes") : t("Couldn't sync")}</span>
      </button>
    );
  else if (result?.sync && synced_(result.sync))
    action = (
      <span className="forks-note forks-state good">
        {tx("{0}Synced", <CheckIcon size={12} />)}
      </span>
    );
  else if (status && status.new > 0)
    action = (
      <Button kind="secondary" onClick={onSync} aria-label={t("Sync {0}", name)}>
        {t("Sync")}
      </Button>
    );
  else if (status) action = <span className="forks-note">{t("Up to date")}</span>;
  else action = <span className="forks-note">{compared?.error ? "" : "…"}</span>;

  return (
    <div className={`forks-item${open ? " open" : ""}`} role="listitem" aria-label={name}>
      <div className="forks-row">
        <button className="forks-name" aria-expanded={open} onClick={onToggle} title={open ? t("Hide the new commits") : t("See the new commits")}>
          <ChevronRightIcon size={12} className="forks-chevron" />
          <span className="forks-names">
            <span className="forks-repo">{fork.name}</span>
            <span className="forks-from" title={`${fork.branch} from ${parentKey(fork)}`}>
              {tx("{0} from {1}", <code className="forks-branch">{fork.branch}</code>, <b>{parentKey(fork)}</b>)}
            </span>
          </span>
        </button>
        {status ? (
          <span className="forks-bars" role="img" aria-label={t("{0} of its own, {1} new", status.own, status.new)} title={t("{0} of its own, {1} new", status.own, status.new)}>
            <span className="forks-half own">
              {status.own > 0 && (
                <>
                  <span className="forks-count">{shortCount(status.own)}</span>
                  <span className="forks-bar own" style={{ width: barWidth(status.own, most, BAR) }} />
                </>
              )}
            </span>
            <span className="forks-mid" />
            <span className="forks-half">
              {status.new > 0 && (
                <>
                  <span className="forks-bar new" style={{ width: barWidth(status.new, most, BAR) }} />
                  <span className="forks-count">{shortCount(status.new)}</span>
                </>
              )}
            </span>
          </span>
        ) : (
          <span className="forks-note">{compared?.error ? t("Couldn't compare") : t("Comparing…")}</span>
        )}
        <span className="forks-note forks-updated">{fork.pushed ? relativeTime(seconds(fork.pushed)) : ""}</span>
        <Switch on={auto} onChange={onAuto} label={t("Sync {0} by itself", name)} />
        <span className="forks-action">{action}</span>
      </div>
      {open && (
        <div className="forks-detail">
          {compared?.error && <p className="forks-problem">{compared.error}</p>}
          {result?.error && <p className="forks-problem">{result.error}</p>}
          {result?.sync && synced_(result.sync) && <p className="forks-done">{outcomeText(result.sync)}.</p>}
          {result?.sync && (result.sync.outcome === "conflict" || result.sync.outcome === "refused") && (
            <p className="forks-problem">
              {clashed
                ? t("GitHub couldn't sync it by itself: its own commits change the same lines as the original's. Sync it on GitHub, where you can choose what to do, or merge the original into it in a clone.")
                : result.sync.message}{" "}
              <Button kind="link" onClick={() => openUrl(fork.url)}>
                {t("Open it on GitHub")}
              </Button>
            </p>
          )}
          {status && (
            <>
              <h4 className="forks-detail-title">
                {status.new === 0
                  ? t("It has all of {0}'s commits on {1}.", parentKey(fork), fork.parent.branch)
                  : `${status.new === 1 ? t("1 new commit") : t("{0} new commits", many(status.new))} from ${parentKey(fork)}${
                      status.own === 0
                        ? t(": it has none of its own, so it moves straight on to them.")
                        : clashed
                          ? t(": it has {0} of its own, which clash with them.", many(status.own))
                          : t(": it has {0} of its own, so syncing adds a merge commit, unless they clash.", many(status.own))
                    }`}
              </h4>
              {status.commits.map((commit) => (
                <div className="forks-commit" key={commit.id}>
                  <Avatar name={commit.author} email={commit.email} size={20} />
                  <span className="forks-commit-summary">{commit.summary}</span>
                  <span className="forks-note">{commit.date ? relativeTime(seconds(commit.date)) : ""}</span>
                </div>
              ))}
              {status.new > status.commits.length && (
                <p className="forks-more">
                  {status.commits.length > 0 && <>{tx("and {0} more ·", many(status.new - status.commits.length))}{" "}</>}
                  <Button kind="link" onClick={() => openUrl(compareUrl)}>
                    {t("See them on GitHub")}
                  </Button>
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
