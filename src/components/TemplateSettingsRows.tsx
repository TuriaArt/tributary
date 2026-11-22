import { useCallback, useEffect, useState } from "react";
import { commitTemplate, type Action, type CommitTemplate } from "../api";
import { TEMPLATE_CHANGED } from "./worktree/CommitBox";
import type { SettingRow } from "./SettingsDialog";
import { Button } from "./ui/Button";
import { t } from "../lib/i18n";

/**
 * The message new commits start from here: git's commit.template. A team's shared one shows
 * as where it comes from; one written here is kept for this repository only.
 */
export function useTemplateRows(path: string, run: (action: Action) => Promise<boolean>): SettingRow[] {
  const [template, setTemplate] = useState<CommitTemplate | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => {
    commitTemplate(path)
      .then((found) => {
        setTemplate(found);
        setText(found.ours ? (found.text ?? "") : "");
      })
      .catch(() => setTemplate({ text: null, file: null, ours: false }));
  }, [path]);
  useEffect(load, [load]);

  const save = async (value: string) => {
    setSaving(true);
    await run({ kind: "setCommitTemplate", text: value });
    setSaving(false);
    load();
    window.dispatchEvent(new Event(TEMPLATE_CHANGED));
  };
  const shared = template?.file && !template.ours ? template : null;
  const changed = template !== null && text !== (template.ours ? (template.text ?? "") : "");

  return [
    {
      kind: "custom",
      label: t("Message template"),
      hint: shared
        ? t("New commits start from your team's template, {0}. Write one here to use your own in this repository instead.", shared.file)
        : t("New commits here start from this. Lines starting with # are left out, as with git. The branch's Jira or Linear issue key goes in front of the summary by itself."),
      content: (
        <textarea
          className="text-input settings-input template-input"
          value={text}
          placeholder={shared?.text ?? t("FEAST-: \n\nWhy:\n\nHow to test:")}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          spellCheck={false}
          aria-label={t("Commit message template")}
        />
      ),
    },
    {
      kind: "custom",
      label: "",
      content: (
        <span className="settings-buttons">
          <Button kind="primary" onClick={() => save(text)} disabled={saving || !changed || !text.trim()}>
            {t("Save template")}
          </Button>
          {template?.ours && (
            <Button kind="outline" onClick={() => save("")} disabled={saving}>
              <span className="button-label">{t("Remove")}</span>
            </Button>
          )}
        </span>
      ),
    },
  ];
}
