import { useCallback, useEffect, useState } from "react";
import { repoIdentity, signingSettings, type Action, type RepoIdentity, type SigningMode, type SigningSettings, type Tracker } from "../api";
import { ActivityIcon, CheckIcon, CloudIcon, FolderIcon, GlobeIcon, KeyIcon, LockIcon, MergeIcon, UserIcon } from "./Icons";
import { useRemoteRows } from "./RemoteSettingsRows";
import { useLfsSettingsRows } from "./LfsSettingsRows";
import { useSparseRows } from "./SparseSettingsRows";
import { useSpeedRows } from "./SpeedSettingsRows";
import { useIssueRows } from "./IssueSettingsRows";
import { useTemplateRows } from "./TemplateSettingsRows";
import { useUnityRows } from "./UnitySettingsRows";
import { NameList, SettingsDialog, type SettingRow, type SettingsSection } from "./SettingsDialog";
import { Button } from "./ui/Button";
import { t } from "../lib/i18n";

interface Props {
  /** The repository's folder name, and its folder. */
  name: string;
  path: string;
  /** The remote's own issues, when it has them (GitHub, GitLab). */
  automaticTracker: Tracker | null;
  protectedBranches: string[];
  setProtectedBranches: (names: string[]) => void;
  /** Runs a git action; resolves to true when it worked. */
  run: (action: Action) => Promise<boolean>;
  /** Open the Git LFS clean-up (this window closes for it). */
  onCleanUpLfs: () => void;
  onClose: () => void;
  /** The section to open at, like "Remotes". */
  section?: string;
}

/** "Maya Chen <maya@example.com>", or what's missing. */
function describe(name: string | null, email: string | null): string {
  if (name && email) return `${name} <${email}>`;
  if (name || email) return `${name ?? t("no name")} <${email ?? t("no email")}>`;
  return t("not set");
}

/**
 * One repository's own settings, from its tab's menu or the Repository menu: who commits
 * are made as here, its protected branches, and its Git LFS files.
 */
export function RepoSettingsDialog({ name, path, automaticTracker, protectedBranches, setProtectedBranches, run, onCleanUpLfs, onClose, section }: Props) {
  const [identity, setIdentity] = useState<RepoIdentity | null>(null);
  const [draft, setDraft] = useState({ name: "", email: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    repoIdentity(path)
      .then((found) => {
        setIdentity(found);
        setDraft({ name: found.localName ?? "", email: found.localEmail ?? "" });
      })
      .catch(() => setIdentity({ localName: null, localEmail: null, globalName: null, globalEmail: null }));
  }, [path]);
  useEffect(load, [load]);

  const lfsRows = useLfsSettingsRows({ path, run, onCleanUp: onCleanUpLfs });
  const signingRows = useSigningRows(path, run);
  const remoteRows = useRemoteRows(path, run);
  const unityRows = useUnityRows(path, run);
  const sparseRows = useSparseRows(path, run);
  const speedRows = useSpeedRows(path, run);
  const issueRows = useIssueRows(path, automaticTracker);
  const templateRows = useTemplateRows(path, run);
  const own = Boolean(identity?.localName || identity?.localEmail);
  const usual = identity ? describe(identity.globalName, identity.globalEmail) : "…";
  const changed = identity !== null && (draft.name.trim() !== (identity.localName ?? "") || draft.email.trim() !== (identity.localEmail ?? ""));
  const save = async (name: string, email: string) => {
    setSaving(true);
    await run({ kind: "setIdentity", name, email });
    setSaving(false);
    load();
  };

  const sections: SettingsSection[] = [
    {
      title: t("Commits"),
      icon: <UserIcon size={15} />,
      rows: [
        {
          kind: "custom",
          label: own ? t("Here you commit as {0}", describe(identity!.localName, identity!.localEmail)) : t("Here you commit as yourself: {0}", usual),
          hint: own
            ? t("Only in this repository. Everywhere else: {0}.", usual)
            : t("Your usual name and email, from git. To commit as someone else here (your work address, say), enter them below."),
          content: own ? (
            <Button kind="outline" onClick={() => save("", "")} disabled={saving}>
              <span className="button-label">{t("Use my usual one")}</span>
            </Button>
          ) : null,
        },
        {
          kind: "custom",
          label: t("Name"),
          content: (
            <input
              className="text-input settings-input"
              value={draft.name}
              placeholder={identity?.globalName ?? t("Your name")}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              // Until what's set here is read, as reading it fills these in over what was typed.
              disabled={identity === null}
              spellCheck={false}
              aria-label={t("Name for commits in this repository")}
            />
          ),
        },
        {
          kind: "custom",
          label: t("Email"),
          content: (
            <input
              className="text-input settings-input"
              value={draft.email}
              placeholder={identity?.globalEmail ?? "you@example.com"}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
              disabled={identity === null}
              spellCheck={false}
              autoCapitalize="off"
              aria-label={t("Email for commits in this repository")}
            />
          ),
        },
        {
          kind: "custom",
          label: "",
          content: (
            <Button
              kind="primary"
              onClick={() => save(draft.name, draft.email)}
              disabled={saving || !changed || !draft.name.trim() || !draft.email.trim()}
            >
              {own ? t("Save") : t("Use for this repository")}
            </Button>
          ),
        },
        ...templateRows,
      ],
    },
    {
      title: t("Signing"),
      icon: <KeyIcon size={15} />,
      rows: signingRows,
    },
    {
      title: t("Remotes"),
      icon: <GlobeIcon size={15} />,
      rows: remoteRows,
    },
    {
      title: t("Issues"),
      icon: <CheckIcon size={15} />,
      rows: issueRows,
    },
    {
      title: t("Branches"),
      icon: <LockIcon size={15} />,
      rows: [
        {
          kind: "custom",
          label: t("Protected branches"),
          hint: t("Can't be deleted; rebasing, hard resetting or force pushing them needs their name typed."),
          content: <NameList names={protectedBranches} onChange={setProtectedBranches} placeholder={t("Add a branch")} />,
        },
      ],
    },
    {
      title: t("Folders"),
      icon: <FolderIcon size={15} />,
      rows: sparseRows,
    },
    {
      title: t("Speed"),
      icon: <ActivityIcon size={15} />,
      rows: speedRows,
    },
    {
      title: t("Git LFS"),
      icon: <CloudIcon size={15} />,
      rows: lfsRows,
    },
    ...(unityRows ? [{ title: t("Unity"), icon: <MergeIcon size={15} />, rows: unityRows }] : []),
  ];
  return <SettingsDialog title={t("Settings for {0}", name)} sections={sections} initial={section} onClose={onClose} />;
}

const FORMATS: Record<string, string> = { openpgp: "GPG", ssh: "SSH", x509: "X.509" };

/** How commits are signed with git's usual settings, in words. */
function describeUsual(settings: SigningSettings): string {
  if (!settings.signs) return t("not signed");
  return t("signed with {0}{1}", FORMATS[settings.format] ?? settings.format, settings.key ? ` (${baseKeyName(settings.key)})` : "");
}

function baseKeyName(key: string): string {
  return key.slice(Math.max(key.lastIndexOf("/"), key.lastIndexOf("\\")) + 1);
}

/** Signing commits in this repository: as git usually does, never, or with a GPG or SSH key. */
function useSigningRows(path: string, run: (action: Action) => Promise<boolean>): SettingRow[] {
  const [settings, setSettings] = useState<SigningSettings | null>(null);
  const [draft, setDraft] = useState<{ mode: SigningMode; key: string }>({ mode: "usual", key: "" });
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    signingSettings(path)
      .then((found) => {
        setSettings(found);
        setDraft({ mode: found.mode, key: found.mode === "gpg" || found.mode === "ssh" ? (found.key ?? "") : "" });
      })
      .catch(() => setSettings(null));
  }, [path]);
  useEffect(load, [load]);
  if (!settings) return [{ kind: "loading", label: t("Reading the settings") }];

  const keys = settings.keys.filter((key) => key.format === draft.mode);
  const changed = draft.mode !== settings.mode || ((draft.mode === "gpg" || draft.mode === "ssh") && draft.key.trim() !== (settings.key ?? ""));
  const save = async () => {
    setSaving(true);
    await run({ kind: "setSigning", mode: draft.mode, key: draft.key.trim() || null });
    setSaving(false);
    load();
  };
  const usual = describeUsual(settings);
  const now =
    settings.mode === "usual"
      ? t("Commits here are {0}, as git is set up everywhere", usual)
      : settings.mode === "off"
        ? t("Commits here aren't signed")
        : t("Commits here are signed with {0}{1}", settings.mode === "gpg" ? "GPG" : "SSH", settings.key ? ` (${baseKeyName(settings.key)})` : "");
  const rows: SettingRow[] = [
    {
      kind: "custom",
      label: now,
      hint: t("Signed commits show as verified on GitHub and GitLab once the key is added to your account there."),
      content: null,
    },
    {
      kind: "custom",
      label: t("Sign commits"),
      content: (
        <select
          className="settings-select"
          value={draft.mode}
          onChange={(event) => {
            const mode = event.target.value as SigningMode;
            const first = settings.keys.find((key) => key.format === mode);
            setDraft({ mode, key: mode === "ssh" ? (first?.id ?? "") : "" });
          }}
          aria-label={t("How to sign commits in this repository")}
        >
          <option value="usual">{t("As usual (")}{usual})</option>
          <option value="off">{t("Don't sign them here")}</option>
          <option value="gpg">{t("With a GPG key")}</option>
          <option value="ssh">{t("With an SSH key")}</option>
        </select>
      ),
    },
  ];
  if (draft.mode === "gpg" || draft.mode === "ssh") {
    const listed = keys.some((key) => key.id === draft.key);
    rows.push({
      kind: "custom",
      label: t("Key"),
      hint:
        draft.mode === "gpg"
          ? keys.length === 0
            ? t("No GPG keys found: make one with gpg --gen-key, or enter its id.")
            : t("Without one chosen, GPG uses the key for the email you commit with.")
          : keys.length === 0
            ? t("No SSH keys found in ~/.ssh: enter the path of the public key (.pub) to sign with.")
            : t("The public key (.pub) of the SSH key to sign with."),
      content: (
        <div className="signing-key">
          {keys.length > 0 && (
            <select
              className="settings-select"
              value={listed ? draft.key : draft.key ? "other" : ""}
              onChange={(event) => setDraft({ ...draft, key: event.target.value === "other" ? " " : event.target.value })}
              aria-label={t("Key to sign with")}
            >
              {draft.mode === "gpg" && <option value="">{t("The key for my email")}</option>}
              {keys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.label}
                </option>
              ))}
              <option value="other">{t("Another…")}</option>
            </select>
          )}
          {(keys.length === 0 || (!listed && draft.key !== "")) && (
            <input
              className="text-input settings-input"
              value={draft.key.trimStart()}
              placeholder={draft.mode === "gpg" ? t("Key id, like 3AA5C34371567BD2") : "~/.ssh/id_ed25519.pub"}
              onChange={(event) => setDraft({ ...draft, key: event.target.value })}
              spellCheck={false}
              autoCapitalize="off"
              aria-label={t("Key to sign with")}
              autoFocus={keys.length > 0}
            />
          )}
        </div>
      ),
    });
  }
  rows.push({
    kind: "custom",
    label: "",
    content: (
      <Button kind="primary" onClick={() => void save()} disabled={saving || !changed || (draft.mode === "ssh" && !draft.key.trim())}>
        {t("Use for this repository")}
      </Button>
    ),
  });
  return rows;
}
