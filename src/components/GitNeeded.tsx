import { installCommandLineTools } from "../api";
import type { GitInstallState } from "../app/useGitInstall";
import { isMac, isWindows } from "../lib/platform";
import { openInBrowser } from "../lib/weblinks";
import { RefreshIcon, WarningIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

const GIT_FOR_WINDOWS = "https://git-scm.com/download/win";
const GIT_DOWNLOADS = "https://git-scm.com/downloads";

/** This computer, as people call it. */
const computer = isMac ? t("this Mac") : t("this PC");

/** The button that gets git on this system, if there's one to press. */
function GetGit({ install }: { install: GitInstallState }) {
  if (isMac && install.install?.needsCommandLineTools)
    return (
      <Button kind="primary" onClick={() => installCommandLineTools().catch(() => openInBrowser(GIT_DOWNLOADS))}>
        {t("Install the Command Line Tools")}
      </Button>
    );
  if (isWindows)
    return (
      <Button kind="primary" onClick={() => openInBrowser(GIT_FOR_WINDOWS)} data-url={GIT_FOR_WINDOWS}>
        {t("Get Git for Windows")}
      </Button>
    );
  if (isMac)
    return (
      <Button kind="primary" onClick={() => openInBrowser(GIT_DOWNLOADS)} data-url={GIT_DOWNLOADS}>
        {t("Get git")}
      </Button>
    );
  return null;
}

function CheckAgain({ install, className = "secondary-button" }: { install: GitInstallState; className?: string }) {
  return (
    <button className={className} onClick={() => void install.lookAgain().catch(() => {})} disabled={install.checking}>
      <RefreshIcon size={13} className={install.checking ? "spin" : undefined} />
      <span className="button-label">{install.checking ? t("Checking…") : t("Check again")}</span>
    </button>
  );
}

/** How to get git here, in a sentence. */
function howTo(install: GitInstallState): string {
  if (isMac && install.install?.needsCommandLineTools)
    return t("Apple's Command Line Tools bring it: install them (it takes a few minutes), or install git with Homebrew (brew install git).");
  if (isMac) return t("Install it from git-scm.com, or with Homebrew (brew install git).");
  if (isWindows) return t("Install Git for Windows (the standard options are fine), then come back.");
  return t("Install it with your package manager, like sudo apt install git or sudo dnf install git.");
}

/** On the start screen: Tributary can't do much without git, so this comes first. */
export function GitNeededCard({ install }: { install: GitInstallState }) {
  return (
    <section className="git-needed" role="alert">
      <div className="git-needed-head">
        <WarningIcon size={16} />
        <strong>{t("Tributary needs git")}</strong>
      </div>
      <p>
        {tx("It runs your own git for everything it does, so cloning, committing and syncing work just as they do on the command line, and git isn't installed on {0}. {1}", computer, howTo(install))}
      </p>
      <div className="git-needed-buttons">
        <GetGit install={install} />
        <CheckAgain install={install} />
      </div>
    </section>
  );
}

/** Over a repository: what's missing, and the same ways to fix it. */
export function GitNeededBanner({ install }: { install: GitInstallState }) {
  return (
    <div className="notice-banner git-needed-banner" role="alert">
      <WarningIcon size={14} />
      <span>{tx("git isn't installed on {0}, so changes, syncing and everything else that runs git can't work yet. {1}", computer, howTo(install))}</span>
      <GetGit install={install} />
      <CheckAgain install={install} className="notice-action" />
    </div>
  );
}

/** git is there, but older than everything needs. */
export function GitOldNote({ install }: { install: GitInstallState }) {
  return (
    <p className="git-old">
      {tx("git {0} works, but checking a merge before doing it needs git 2.38 or newer. {1}", install.install?.version, <Button kind="link" onClick={() => openInBrowser(isWindows ? GIT_FOR_WINDOWS : GIT_DOWNLOADS)} data-url={isWindows ? GIT_FOR_WINDOWS : GIT_DOWNLOADS}>
        {t("Get a newer git")}
      </Button>)}
    </p>
  );
}
