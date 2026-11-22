import type { Lock } from "../api";
import { baseName } from "../lib/paths";
import { CloseIcon, UnlockIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  /** Your locks on files you've just pushed. */
  locks: Lock[];
  busy: boolean;
  onRelease: () => void;
  onKeep: () => void;
  /** Release them now, and from now on without asking. */
  onAlways: () => void;
}

/** After a push: offers to release your locks on the files you pushed, so your teammates can work on them. */
export function LockReleaseBanner({ locks, busy, onRelease, onKeep, onAlways }: Props) {
  const names = locks.map((lock) => baseName(lock.path));
  const what =
    locks.length === 1
      ? t("the lock on {0}", names[0])
      : t("the locks on {0} files ({1}{2})", locks.length, names.slice(0, 3).join(", "), locks.length > 3 ? ", …" : "");
  return (
    <div className="notice-banner info" role="status">
      <UnlockIcon size={14} />
      <span>
        {locks.length === 1
          ? tx("You pushed your changes but still hold {0}. Release it so your teammates can work on it?", what)
          : tx("You pushed your changes but still hold {0}. Release them so your teammates can work on them?", what)}
      </span>
      <Button kind="link" onClick={onAlways} disabled={busy} title={t("Release them now, and after every push from now on (Settings, Large files and Git LFS)")}>
        {t("Always")}
      </Button>
      <button className="notice-action" onClick={onRelease} disabled={busy}>
        <span className="button-label">{tx("Release {0}", locks.length === 1 ? "lock" : "locks")}</span>
      </button>
      <Button kind="icon" onClick={onKeep} aria-label={t("Keep them")} title={t("Keep them")}>
        <CloseIcon size={14} />
      </Button>
    </div>
  );
}
