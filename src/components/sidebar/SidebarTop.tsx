import { EyeOffIcon, SearchIcon } from "../Icons";
import { Button } from "../ui/Button";
import { plural } from "../../lib/format";
import { t } from "../../lib/i18n";

/** The box that narrows the sidebar to what matches. Esc empties it. */
export function SidebarFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="sidebar-filter">
      <SearchIcon size={13} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onChange("");
          }
        }}
        placeholder={t("Filter the sidebar")}
        spellCheck={false}
        aria-label={t("Filter the sidebar")}
      />
    </div>
  );
}

/** How many branches are hidden from the graph, or shown alone, with a way to show them all. */
export function VisibilityBar({ count, soloing, onShowAll }: { count: number; soloing: boolean; onShowAll: () => void }) {
  return (
    <div className="sidebar-visibility">
      <EyeOffIcon size={13} />
      <span>{soloing ? t("Showing only {0}", count === 1 ? t("one branch") : plural(count, "branch", "branches")) : t("{0} hidden", count)}</span>
      <Button kind="link" onClick={onShowAll}>
        {t("Show all")}
      </Button>
    </div>
  );
}
