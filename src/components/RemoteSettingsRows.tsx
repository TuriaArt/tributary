import { useCallback, useEffect, useState } from "react";
import { remotes as listRemotes, type Action, type RemoteInfo } from "../api";
import type { SettingRow } from "./SettingsDialog";
import { Button } from "./ui/Button";
import { t } from "../lib/i18n";

/** A remote being changed: its name and addresses as typed. */
interface Editing {
  name: string;
  draft: { name: string; url: string; pushUrl: string };
}

/**
 * The repository's remotes, in its settings: each one's address (and push address), to
 * rename, point elsewhere or remove, and a form to add one.
 */
export function useRemoteRows(path: string, run: (action: Action) => Promise<boolean>): SettingRow[] {
  const [remotes, setRemotes] = useState<RemoteInfo[] | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState({ name: "", url: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    listRemotes(path)
      .then(setRemotes)
      .catch(() => setRemotes([]));
  }, [path]);
  useEffect(load, [load]);

  /** Run actions one after another, stopping at the first that fails. */
  const apply = async (actions: Action[]) => {
    setBusy(true);
    let ok = true;
    for (const action of actions) {
      if (!(await run(action))) {
        ok = false;
        break;
      }
    }
    setBusy(false);
    load();
    return ok;
  };

  if (!remotes) return [{ kind: "loading", label: t("Reading the remotes") }];

  const saveEdit = async (remote: RemoteInfo, draft: Editing["draft"]) => {
    const name = draft.name.trim();
    const actions: Action[] = [];
    // Addresses with a password or token in them show without it: unchanged, they're left alone.
    if (draft.url.trim() !== remote.url) actions.push({ kind: "setRemoteUrl", name: remote.name, url: draft.url, push: false });
    if (draft.pushUrl.trim() !== (remote.pushUrl ?? "")) actions.push({ kind: "setRemoteUrl", name: remote.name, url: draft.pushUrl, push: true });
    if (name !== remote.name) actions.push({ kind: "renameRemote", from: remote.name, to: name });
    if (actions.length === 0 || (await apply(actions))) setEditing(null);
  };

  const rows: SettingRow[] = [];
  if (remotes.length === 0) {
    rows.push({ kind: "custom", label: t("No remotes yet"), hint: t("Add one to fetch from it and push to it, like the repository on GitHub."), content: null });
  }
  for (const remote of remotes) {
    if (editing?.name === remote.name) {
      const { draft } = editing;
      const set = (change: Partial<Editing["draft"]>) => setEditing({ ...editing, draft: { ...draft, ...change } });
      rows.push({
        kind: "custom",
        label: t("Edit {0}", remote.name),
        hint: remote.hasCredentials ? t("Its address has a password or token in it, which isn't shown. Change the address to replace it.") : undefined,
        content: (
          <form
            className="remote-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveEdit(remote, draft);
            }}
          >
            <input className="text-input settings-input" value={draft.name} onChange={(event) => set({ name: event.target.value })} spellCheck={false} aria-label={t("Name")} placeholder={t("Name")} />
            <input className="text-input settings-input" value={draft.url} onChange={(event) => set({ url: event.target.value })} spellCheck={false} aria-label={t("Address")} placeholder="https://github.com/team/app.git" autoFocus />
            <input
              className="text-input settings-input"
              value={draft.pushUrl}
              onChange={(event) => set({ pushUrl: event.target.value })}
              spellCheck={false}
              aria-label={t("Push address")}
              placeholder={t("Push address (optional: the same one)")}
            />
            <div className="remote-form-buttons">
              <Button type="button" kind="outline" onClick={() => setEditing(null)} disabled={busy}>
                <span className="button-label">{t("Cancel")}</span>
              </Button>
              <Button type="submit" kind="primary" disabled={busy || !draft.name.trim() || !draft.url.trim()}>
                {t("Save")}
              </Button>
            </div>
          </form>
        ),
      });
      continue;
    }
    rows.push({
      kind: "custom",
      label: remote.name,
      hint: [remote.url, remote.pushUrl && t("Pushes to {0}", remote.pushUrl), remote.hasCredentials && t("(with a saved password or token)")].filter(Boolean).join(" · "),
      content:
        removing === remote.name ? (
          <div className="remote-buttons">
            <span className="remote-confirm">{t("Its remote branches go too.")}</span>
            <Button kind="outline" onClick={() => setRemoving(null)} disabled={busy}>
              <span className="button-label">{t("Keep")}</span>
            </Button>
            <Button
              kind="danger"
              disabled={busy}
              onClick={() => {
                setRemoving(null);
                void apply([{ kind: "removeRemote", name: remote.name }]);
              }}
            >
              {t("Remove")}
            </Button>
          </div>
        ) : (
          <div className="remote-buttons">
            <Button
              kind="outline"
              disabled={busy}
              onClick={() => setEditing({ name: remote.name, draft: { name: remote.name, url: remote.url, pushUrl: remote.pushUrl ?? "" } })}
              aria-label={t("Edit {0}", remote.name)}
            >
              <span className="button-label">{t("Edit…")}</span>
            </Button>
            <Button kind="outline" disabled={busy} onClick={() => setRemoving(remote.name)} aria-label={t("Remove {0}", remote.name)}>
              <span className="button-label">{t("Remove…")}</span>
            </Button>
          </div>
        ),
    });
  }
  const add = async () => {
    if (await apply([{ kind: "addRemote", name: adding.name, url: adding.url }])) setAdding({ name: "", url: "" });
  };
  rows.push({
    kind: "custom",
    label: t("Add a remote"),
    hint: t("Its branches show up after the next fetch."),
    content: (
      <form
        className="remote-form"
        onSubmit={(event) => {
          event.preventDefault();
          void add();
        }}
      >
        <input
          className="text-input settings-input"
          value={adding.name}
          onChange={(event) => setAdding({ ...adding, name: event.target.value })}
          placeholder={remotes.some((remote) => remote.name === "origin") ? "upstream" : "origin"}
          spellCheck={false}
          aria-label={t("New remote's name")}
        />
        <input
          className="text-input settings-input"
          value={adding.url}
          onChange={(event) => setAdding({ ...adding, url: event.target.value })}
          placeholder="https://github.com/team/app.git"
          spellCheck={false}
          aria-label={t("New remote's address")}
        />
        <div className="remote-form-buttons">
          <Button type="submit" kind="primary" disabled={busy || !adding.name.trim() || !adding.url.trim()}>
            {t("Add remote")}
          </Button>
        </div>
      </form>
    ),
  });
  return rows;
}
