import { useEffect, useState } from "react";
import { publishRelease, releaseNotes, type ReleaseNotes } from "../api";
import { copyText } from "../lib/clipboard";
import { plural } from "../lib/format";
import { issueKeys, issueUrl, useIssueTracker } from "../lib/issues";
import { releaseMarkdown } from "../lib/releaseNotes";
import { Dialog } from "./Dialog";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

/**
 * Release notes for a tag: the changes since an earlier tag (pull requests by title, and
 * commits made on the main line), the issues they mention and who made them, as Markdown
 * to edit, copy, or publish as a release on GitHub or GitLab.
 */
export function ReleaseNotesDialog({
  repoPath,
  tag,
  site,
  onClose,
  notify,
  openUrl,
}: {
  repoPath: string;
  tag: string;
  /** "GitHub" or "GitLab" when the repository is on one (to publish there), or null. */
  site: string | null;
  onClose: () => void;
  notify: (text: string) => void;
  openUrl: (url: string) => void;
}) {
  const { tracker, remote } = useIssueTracker();
  const [notes, setNotes] = useState<ReleaseNotes | null>(null);
  const [from, setFrom] = useState<string | null | undefined>(undefined);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setError(null);
    releaseNotes(repoPath, tag, from)
      .then((found) => {
        if (!current) return;
        setNotes(found);
        // Issue keys like FEAST-12 (pull request numbers are already there).
        const own = tracker && (tracker.kind === "jira" || tracker.kind === "linear") ? tracker : null;
        const keys = own ? [...new Set(found.items.flatMap((item) => issueKeys(`${item.title}\n${item.body}`, own)))] : [];
        setText(releaseMarkdown(found, keys.map((key) => ({ key, url: own ? issueUrl(key, own, remote) : null }))));
      })
      .catch((e) => current && setError(String(e)));
    return () => {
      current = false;
    };
  }, [repoPath, tag, from, tracker, remote]);

  const publish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const url = await publishRelease(repoPath, tag, tag, text);
      setPublished(url || null);
      notify(t("Published {0} on {1}", tag, site));
    } catch (e) {
      setError(String(e));
    }
    setPublishing(false);
  };

  return (
    <Dialog
      title={t("Release notes for {0}", tag)}
      error={error}
      busy={publishing}
      wide
      onCancel={onClose}
      buttons={
        <>
          <Button kind="secondary" onClick={onClose}>
            {t("Close")}
          </Button>
          <span className="spacer" />
          <Button
            kind="outline"
            disabled={!notes}
            onClick={() => {
              void copyText(text);
              notify(t("Copied the release notes"));
            }}
          >
            <span className="button-label">{t("Copy as Markdown")}</span>
          </Button>
          {site &&
            (published ? (
              <Button kind="primary" onClick={() => openUrl(published)} data-url={published}>
                {tx("Open on {0}", site)}
              </Button>
            ) : (
              <Button kind="primary" disabled={!notes || publishing} onClick={() => void publish()} title={t("Publish {0} as a release on {1} (push the tag first)", tag, site)}>
                {publishing ? t("Publishing…") : t("Publish on {0}", site)}
              </Button>
            ))}
        </>
      }
    >
      {!notes ? (
        !error && <p className="muted">{t("Reading the history…")}</p>
      ) : (
        <div className="dialog-form">
          <div className="release-range">
            <span>{t("Since")}</span>
            <select
              className="text-input mono"
              value={from === undefined ? (notes.from ?? "") : (from ?? "")}
              onChange={(event) => setFrom(event.target.value || null)}
              aria-label={t("Since")}
            >
              {notes.earlier.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="">{t("the first commit")}</option>
            </select>
            <span className="muted">
              {tx("{0} from {1}", plural(notes.items.length, "change"), plural(notes.commits, "commit"))}
            </span>
          </div>
          <textarea className="text-input mono release-text" rows={14} value={text} onChange={(event) => setText(event.target.value)} spellCheck />
        </div>
      )}
    </Dialog>
  );
}
