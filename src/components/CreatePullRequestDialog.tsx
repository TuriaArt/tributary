import { useEffect, useState } from "react";
import { createPullRequest, newRequestInfo, type NewRequestInfo, type PullRequest } from "../api";
import { plural } from "../lib/format";
import { requestNoun, suggestRequest } from "../lib/pullRequests";
import { Dialog } from "./Dialog";
import { Loader } from "./Loader";
import { MarkdownField } from "./MarkdownField";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { t, tx } from "../lib/i18n";

interface Props {
  repoPath: string;
  /** The branch's name on the remote, and the local branch (if there is one). */
  branch: string;
  local: string | null;
  /** The local branch is the checked-out one, so it can be pushed from here. */
  checkedOut: boolean;
  /** The site's own page for opening it, when there is one. */
  browserUrl: string | null;
  onCancel: () => void;
  onCreated: (pr: PullRequest) => void;
  openUrl: (url: string) => void;
  /** Push the checked-out branch; resolves to whether it worked. */
  push: () => Promise<boolean>;
  /** Open Settings at the GitHub section, to sign in. */
  signIn: () => void;
}

/** Whether the site can be asked for `owner`'s review: people, and on GitHub teams (not email addresses). */
function canAsk(owner: string, forge: NewRequestInfo["forge"]): boolean {
  return owner.startsWith("@") && (forge === "github" || !owner.includes("/"));
}

/**
 * Open a pull request (or a GitLab merge request) for a branch without leaving the app:
 * its title and description (suggested from its commits), the branch to merge it into,
 * and whether it's a draft. Without a token for the site, it's opened in the browser.
 */
export function CreatePullRequestDialog({ repoPath, branch, local, checkedOut, browserUrl, onCancel, onCreated, openUrl, push, signIn }: Props) {
  const [info, setInfo] = useState<NewRequestInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [base, setBase] = useState("");
  const [draft, setDraft] = useState(false);
  const [pushFirst, setPushFirst] = useState(true);
  // The owners of the files it changes to ask for a review: those the site can ask.
  const [reviewers, setReviewers] = useState<string[]>([]);
  const [running, setRunning] = useState<"push" | "create" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    newRequestInfo(repoPath, branch, local)
      .then((found) => {
        if (!current) return;
        setInfo(found);
        const suggested = suggestRequest(branch, found.commits);
        setTitle(suggested.title);
        setBody(suggested.body);
        setBase(found.base ?? found.bases.find((name) => name !== branch) ?? "");
        setReviewers(found.owners.filter((owner) => canAsk(owner, found.forge)));
      })
      .catch((e) => current && setLoadError(String(e)));
    return () => {
      current = false;
    };
  }, [repoPath, branch, local]);

  const noun = requestNoun(info?.forge);
  const site = info?.forge === "gitlab" ? "GitLab" : "GitHub";
  const unpushed = info ? (info.onRemote ? info.unpushed : Math.max(info.unpushed, 1)) : 0;
  // A branch not on the remote yet can only be opened once it's pushed.
  const mustPush = Boolean(info && !info.onRemote);
  const willPush = Boolean(info && checkedOut && unpushed > 0 && (pushFirst || mustPush));
  const blocked = mustPush && !checkedOut;
  const canCreate = Boolean(info?.signedIn && title.trim() && base && base !== branch && !blocked && running === null);

  const create = async () => {
    if (!canCreate) return;
    setError(null);
    if (willPush) {
      setRunning("push");
      if (!(await push())) {
        setRunning(null);
        setError(t("Couldn't push {0}: see the message in the window.", local));
        return;
      }
    }
    setRunning("create");
    try {
      onCreated(await createPullRequest(repoPath, { branch, base, title: title.trim(), body, draft, reviewers }));
    } catch (e) {
      setError(String(e));
      setRunning(null);
    }
  };

  const browserButton = browserUrl && (
    <Button kind="secondary" onClick={() => openUrl(browserUrl)} disabled={running !== null} data-url={browserUrl}>
      {tx("Open on {0} instead", site)}
    </Button>
  );

  if (loadError) {
    return (
      <Dialog
        title={t("New pull request")}
        error={loadError}
        onCancel={onCancel}
        buttons={
          <>
            <Button kind="secondary" onClick={onCancel}>
              {t("Close")}
            </Button>
            {browserUrl && (
              <Button kind="primary" onClick={() => openUrl(browserUrl)} data-url={browserUrl}>
                {t("Open in the browser")}
              </Button>
            )}
          </>
        }
      >
        <p>{t("Couldn't get ready to open it here.")}</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={t("New {0}", noun)}
      error={error}
      busy={running !== null}
      wide
      className="request-dialog"
      onCancel={onCancel}
      buttons={
        <>
          {browserButton}
          <span className="spacer" />
          <Button kind="secondary" onClick={onCancel} disabled={running !== null}>
            {t("Cancel")}
          </Button>
          <Button kind="primary" onClick={() => void create()} disabled={!canCreate}>
            {running === "push" ? t("Pushing {0}…", local) : running === "create" ? t("Opening…") : `${willPush ? t("Push and open") : t("Open")} ${noun}`}
          </Button>
        </>
      }
    >
      {!info ? (
        <Loader size={56} title={t("Reading its commits")} />
      ) : (
        <form
          className="dialog-form"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <div className="request-branches">
            <span className="request-branch mono" title={`${info.remote}/${branch}`}>
              {branch}
            </span>
            <span className="request-into">{t("into")}</span>
            <select className="text-input mono request-base" value={base} onChange={(event) => setBase(event.target.value)} aria-label={t("The branch to merge it into")}>
              {info.bases
                .filter((name) => name !== branch)
                .map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
            </select>
            {info.commits.length > 0 && <span className="request-commits">{plural(info.commits.length, "commit")}</span>}
          </div>
          <Field label={t("Title")}>
            <input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus spellCheck />
          </Field>
          <Field label={t("Description")}>
            <MarkdownField
              className="request-body"
              rows={8}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("What it changes and why, how to try it…")}
            />
          </Field>
          <label className="checkbox">
            {tx("{0}Draft: not ready for review yet", <input type="checkbox" checked={draft} onChange={(event) => setDraft(event.target.checked)} />)}
          </label>
          {info.owners.length > 0 && (
            <div className="request-owners" role="group" aria-label={t("Ask for reviews")}>
              <span className="request-owners-label">{t("Ask the owners of the files it changes to review (CODEOWNERS):")}</span>
              <div className="request-owner-list">
                {info.owners.slice(0, 12).map((owner) => {
                  const askable = canAsk(owner, info.forge);
                  return (
                    <label
                      key={owner}
                      className="checkbox"
                      title={askable ? undefined : info.forge === "gitlab" && owner.includes("/") ? t("GitLab can't ask a group") : t("Only people with an account can be asked")}
                    >
                      <input
                        type="checkbox"
                        disabled={!askable}
                        checked={reviewers.includes(owner)}
                        onChange={(event) => setReviewers((now) => (event.target.checked ? [...now, owner] : now.filter((name) => name !== owner)))}
                      />
                      <span className="mono">{owner}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          {checkedOut && unpushed > 0 && (
            <label className="checkbox">
              <input type="checkbox" checked={pushFirst || mustPush} disabled={mustPush} onChange={(event) => setPushFirst(event.target.checked)} />
              {mustPush ? t("Push {0} to {1} first (it isn't there yet)", local, info.remote) : t("Push {0}'s {1} first", local, plural(unpushed, "new commit"))}
            </label>
          )}
          {!checkedOut && local && unpushed > 0 && (
            <p className="dialog-note-line">
              {mustPush
                ? t("{0} isn't on {1} yet: check it out and push it first.", local, info.remote)
                : t("{0} of {1} aren't pushed yet, so they won't be part of it until you push them.", plural(unpushed, "commit"), local)}
            </p>
          )}
          {!info.signedIn && (
            <p className="dialog-note-line request-sign-in">
              {info.forge === "github" ? (
                <>
                  {tx("To open it from here, sign in to GitHub. {0}", <Button type="button" kind="link" onClick={signIn}>
                    {t("Sign in…")}
                  </Button>)}
                </>
              ) : (
                t("Git has no token for this GitLab server yet (pushing or fetching once signs in): open it on GitLab instead.")
              )}
            </p>
          )}
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}
