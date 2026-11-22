import { useState } from "react";
import { runAction, type CommitRow } from "../api";
import { shortId } from "../lib/format";
import { Dialog } from "./Dialog";
import { Button } from "./ui/Button";
import { Field } from "./ui/Field";
import { t, tx } from "../lib/i18n";

interface Props {
  repoPath: string;
  target: CommitRow;
  /** The remote to offer pushing the tag to, if there is one. */
  remote: string | null;
  onCancel: () => void;
  /** `name`: the new tag, for undoing. */
  onDone: (message: string, name: string) => void;
}

/** Create a tag on a commit: annotated with a message, or lightweight without one. */
export function TagDialog({ repoPath, target, remote, onCancel, onDone }: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [push, setPush] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    const tag = name.trim();
    if (!tag || running) return;
    setRunning(true);
    setError(null);
    try {
      let result = await runAction(repoPath, { kind: "createTag", name: tag, id: target.id, message: message.trim() || null });
      if (push && remote) {
        try {
          await runAction(repoPath, { kind: "pushTag", name: tag, remote });
          result = t("{0} and pushed it to {1}", result, remote);
        } catch (e) {
          // The tag exists now; say why pushing it didn't work.
          setError(t("Created tag {0}, but pushing it failed:\n\n{1}", tag, String(e)));
          setRunning(false);
          return;
        }
      }
      onDone(result, tag);
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  };

  return (
    <Dialog
      title={t("New tag")}
      error={error}
      busy={running}
      onCancel={onCancel}
      buttons={
        <>
          <Button kind="secondary" onClick={onCancel} disabled={running}>
            {t("Cancel")}
          </Button>
          <Button kind="primary" onClick={create} disabled={running || !name.trim()}>
            {running ? t("Creating…") : t("Create tag")}
          </Button>
        </>
      }
    >
      <p>
        {tx("On {0} {1}", <span className="mono">{shortId(target.id)}</span>, target.summary)}
      </p>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <Field label={t("Name")}>
          <input
            className="text-input"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder="v1.2.0"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoFocus
          />
        </Field>
        <Field label={t("Message (optional)")}>
          <textarea
            className="text-input"
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t("With a message, the tag is annotated: it records who made it and when.")}
          />
        </Field>
        {remote && (
          <label className="checkbox">
            {tx("{0}Push it to {1}", <input type="checkbox" checked={push} onChange={(event) => setPush(event.target.checked)} />, remote)}
          </label>
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
