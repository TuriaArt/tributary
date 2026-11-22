import type { Bisect, CommitRow } from "../api";
import { plural, shortId } from "../lib/format";
import { SearchIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  bisect: Bisect;
  /** The commit being tested: the one checked out. */
  testing: { id: string; commit: CommitRow | undefined } | null;
  /** The first bad commit, once found (when it's loaded). */
  found: CommitRow | undefined;
  busy: boolean;
  onMark: (verdict: "good" | "bad" | "skip") => void;
  onStop: () => void;
  onShow: (id: string) => void;
}

/** "Is this commit good or bad?" while bisecting, and the first bad commit once it's found. */
export function BisectBar({ bisect, testing, found, busy, onMark, onStop, onShow }: Props) {
  const back = bisect.start ? (/^[0-9a-f]{40}$/.test(bisect.start) ? shortId(bisect.start) : bisect.start) : null;
  const stop = (
    <Button kind="secondary" onClick={onStop} disabled={busy} title={back ? t("Stop, and go back to {0}", back) : t("Stop bisecting")}>
      {bisect.found ? t("Done") : t("Stop")}
    </Button>
  );
  if (bisect.found) {
    return (
      <div className="operation-bar bisect-bar found" role="status">
        <SearchIcon size={14} />
        <span className="operation-text">
          {tx("{0} {1} {2} is the first bad commit.", <span className="operation-title">{t("Found it:")}</span>, <Button kind="link" className="mono" onClick={() => onShow(bisect.found!)}>
            {shortId(bisect.found)}
          </Button>, found ? <>“{found.summary}”</> : null)}
        </span>
        <span className="operation-buttons">
          <Button kind="primary" onClick={() => onShow(bisect.found!)}>
            {t("Show it")}
          </Button>
          {stop}
        </span>
      </div>
    );
  }
  const ready = bisect.bad !== null && bisect.good.length > 0;
  return (
    <div className="operation-bar bisect-bar" role="status">
      <SearchIcon size={14} />
      <span className="operation-text">
        {ready && testing ? (
          <>
            {tx("{0} test {1}{2}, then say whether it's good or bad.{3}", <span className="operation-title">{t("Bisecting:")}</span>, <Button kind="link" className="mono" onClick={() => onShow(testing.id)}>
              {shortId(testing.id)}
            </Button>, testing.commit && <> “{testing.commit.summary}”</>, bisect.left !== null && (
              <span className="bisect-left">
                {" "}{tx("{0} could be the one{1}.", plural(bisect.left, "commit"), bisect.steps !== null ? t(", about {0} to go", plural(bisect.steps + 1, "test")) : "")}
              </span>
            ))}
          </>
        ) : (
          <>
            {tx("{0} mark a commit that works and one that doesn't (from their menus) to start.", <span className="operation-title">{t("Bisecting:")}</span>)}
          </>
        )}
      </span>
      <span className="operation-buttons">
        {ready && (
          <>
            <button className="bisect-button good" onClick={() => onMark("good")} disabled={busy} title={t("It works: the problem came later")}>
              {t("Good")}
            </button>
            <button className="bisect-button bad" onClick={() => onMark("bad")} disabled={busy} title={t("It's broken: the problem is here or earlier")}>
              {t("Bad")}
            </button>
            <Button kind="secondary" onClick={() => onMark("skip")} disabled={busy} title={t("Can't tell (it doesn't build, say): try another one")}>
              {t("Skip")}
            </Button>
          </>
        )}
        {stop}
      </span>
    </div>
  );
}
