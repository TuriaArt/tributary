import { useEffect, useState } from "react";
import { asAppError, myIssues, runAction, type Action, type AppError, type CommitRow, type Issue } from "../api";
import { branchNameFor, useIssueTracker } from "../lib/issues";
import { Dialog } from "./Dialog";
import { CommitRef } from "./ResetDialog";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { t, tx } from "../lib/i18n";

interface Props {
  repoPath: string;
  target: CommitRow;
  /** False when checking out isn't possible (a bare repository). */
  canCheckout: boolean;
  onCancel: () => void;
  onDone: (message: string) => void;
}

/** Asks for a name, then creates a branch at `target`, optionally checking it out. */
export function NewBranchDialog({ repoPath, target, canCheckout, onCancel, onDone }: Props) {
  const [name, setName] = useState("");
  const [checkout, setCheckout] = useState(canCheckout);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  // Your open issues in the repository's tracker, to name the branch after one.
  const { tracker } = useIssueTracker();
  const [issues, setIssues] = useState<Issue[] | null>(null);
  const [issuesNote, setIssuesNote] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  useEffect(() => {
    if (!tracker) return;
    let current = true;
    myIssues(repoPath, tracker)
      .then((found) => current && setIssues(found))
      .catch((e) => current && setIssuesNote(String(e)));
    return () => {
      current = false;
    };
  }, [repoPath, tracker]);

  const run = async (action: Action) => {
    setRunning(true);
    setError(null);
    try {
      onDone(await runAction(repoPath, action));
    } catch (e) {
      setError(asAppError(e));
      setRunning(false);
    }
  };
  const createAction = (): Action => ({ kind: "createBranch", name: name.trim(), id: target.id, checkout });
  const create = () => {
    if (name.trim() && !running) run(createAction());
  };
  // Checking out failed because of uncommitted changes: offer to stash them around it.
  const inTheWay = checkout && error?.kind?.kind === "changesInTheWay" ? error.kind : null;
  const stashRetry = inTheWay
    ? {
        label: t("Stash changes and retry"),
        onClick: () => run({ kind: "stashAndRetry", action: createAction(), includeUntracked: inTheWay.untracked }),
      }
    : null;

  return (
    <Dialog
      title={t("New branch")}
      error={error?.message ?? null}
      errorAction={stashRetry}
      busy={running}
      onCancel={onCancel}
      buttons={
        <>
          <Button kind="secondary" onClick={onCancel} disabled={running}>
            {t("Cancel")}
          </Button>
          <Button kind="primary" onClick={create} disabled={running || !name.trim()}>
            {running ? t("Creating…") : t("Create branch")}
          </Button>
        </>
      }
    >
      <p>
        {tx("Starting at {0}", <CommitRef commit={target} />)}
      </p>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        {tracker && (
          <Field label={t("From an issue")}>
            {issues && issues.length > 0 ? (
              <select
                className="settings-select"
                value={issue}
                onChange={(event) => {
                  const chosen = issues.find((each) => each.key === event.target.value);
                  setIssue(event.target.value);
                  if (chosen) setName(branchNameFor(chosen));
                }}
              >
                <option value="">{t("None: name it yourself")}</option>
                {issues.map((each) => (
                  <option key={each.key} value={each.key}>
                    {each.key} {each.title}
                    {each.status ? ` (${each.status})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <span className="field-note">{issuesNote ?? (issues ? t("No open issues are assigned to you.") : t("Looking for your issues…"))}</span>
            )}
          </Field>
        )}
        <Field label={t("Name")}>
          <input
            className="text-input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="feature/my-change"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoFocus
          />
        </Field>
        <label className="checkbox">
          {tx("{0}Check out the new branch", <input
            type="checkbox"
            checked={checkout}
            disabled={!canCheckout}
            onChange={(event) => setCheckout(event.target.checked)}
          />)}
        </label>
      </form>
    </Dialog>
  );
}
