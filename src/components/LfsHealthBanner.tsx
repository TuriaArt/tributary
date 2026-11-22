import type { LfsHealth } from "../api";
import { baseName } from "../lib/paths";
import { plural } from "../lib/format";
import { CloseIcon, WarningIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t } from "../lib/i18n";

interface Props {
  health: LfsHealth;
  busy: boolean;
  onDownload: () => void;
  onSetUp: () => void;
  /** Open the Git LFS website, to install it. */
  onGetLfs: () => void;
  onDismiss: () => void;
}

/** What to say about `health`, and which button fixes it. */
export function describeLfsHealth(health: LfsHealth): { text: string; fix: "install" | "setUp" | "download" } {
  if (health.notInstalled)
    return {
      text: t("This repository stores files with Git LFS, which isn't installed. Until it is, those files are small pointer files, and files can't be locked."),
      fix: "install",
    };
  if (health.notSetUp)
    return { text: t("Git LFS is installed but git isn't set up to use it, so files stored with it are small pointer files."), fix: "setUp" };
  const names = health.examples.map(baseName);
  const more = health.pointers - names.length;
  const list = more > 0 ? t("{0} and {1} more", names.join(", "), more.toLocaleString()) : names.join(", ");
  return {
    text: health.pointers === 1
      ? t("{0} stored with Git LFS hasn't been downloaded{1}.", plural(health.pointers, "file"), list ? ` (${list})` : "")
      : t("{0} stored with Git LFS haven't been downloaded{1}.", plural(health.pointers, "file"), list ? ` (${list})` : ""),
    fix: "download",
  };
}

/** Says when Git LFS files are missing here, and offers to fix it. */
export function LfsHealthBanner({ health, busy, onDownload, onSetUp, onGetLfs, onDismiss }: Props) {
  const { text, fix } = describeLfsHealth(health);
  return (
    <div className="notice-banner" role="status" data-tour="lfs-bar">
      <WarningIcon size={14} />
      <span>{text}</span>
      {fix === "install" && (
        <button className="notice-action" onClick={onGetLfs}>
          <span className="button-label">{t("Get Git LFS")}</span>
        </button>
      )}
      {fix === "setUp" && (
        <button className="notice-action" onClick={onSetUp} disabled={busy} title={t("Runs git lfs install (once for this computer), then downloads the files")}>
          <span className="button-label">{t("Set up Git LFS")}</span>
        </button>
      )}
      {fix === "download" && (
        <button className="notice-action" onClick={onDownload} disabled={busy} title={t("git lfs pull")}>
          <span className="button-label">{t("Download them")}</span>
        </button>
      )}
      <Button kind="icon" onClick={onDismiss} aria-label={t("Dismiss")} title={t("Dismiss")}>
        <CloseIcon size={14} />
      </Button>
    </div>
  );
}
