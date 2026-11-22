import { useEffect, useMemo, useState } from "react";
import { thirdPartyNotices } from "../api";
import { openInBrowser } from "../lib/weblinks";
import { parseNotices, searchNotices, type NoticePackage } from "../lib/notices";
import { Dialog } from "./Dialog";
import { ExternalLinkIcon, SearchIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

/** Tributary's own entry, first in the list. */
const OWN = "tributary";

/**
 * The licences of everything Tributary is made with, laid out like Settings: the packages
 * on the left (with a search), the chosen one's licence on the right. Tributary's own
 * licence comes first.
 */
export function LicencesDialog({ onClose }: { onClose: () => void }) {
  const [packages, setPackages] = useState<NoticePackage[] | null>(null);
  const [own, setOwn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState(OWN);

  useEffect(() => {
    let live = true;
    thirdPartyNotices()
      .then((found) => {
        if (!live) return;
        setPackages(parseNotices(found.notices));
        setOwn(found.license);
      })
      .catch((e) => live && setError(String(e)));
    return () => {
      live = false;
    };
  }, []);

  const shown = useMemo(() => searchNotices(packages ?? [], query), [packages, query]);
  const selected = chosen === OWN ? null : (packages?.find((entry) => key(entry) === chosen) ?? null);

  return (
    <Dialog
      title={t("Third-party licences")}
      className="settings-window licences-window"
      closable
      error={error}
      onCancel={onClose}
      buttons={
        <Button kind="secondary" onClick={onClose} autoFocus>
          {t("Done")}
        </Button>
      }
    >
      <div className="settings">
        <nav className="settings-nav licences-nav" aria-label={t("Packages")}>
          <label className="licences-search">
            <SearchIcon size={13} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search packages or licences")} aria-label={t("Search packages or licences")} spellCheck={false} />
          </label>
          {!query && (
            <button className={`settings-tab${chosen === OWN ? " selected" : ""}`} onClick={() => setChosen(OWN)}>
              <span className="settings-tab-text">
                <span>{t("Tributary")}</span>
                <span className="settings-tab-subtitle">{"MIT License"}</span>
              </span>
            </button>
          )}
          {packages === null && !error && <p className="licences-empty">{t("Reading the licences…")}</p>}
          {packages !== null && shown.length === 0 && <p className="licences-empty">{tx("No package matches “{0}”.", query)}</p>}
          {shown.map((entry) => (
            <button key={key(entry)} className={`settings-tab${chosen === key(entry) ? " selected" : ""}`} onClick={() => setChosen(key(entry))} title={`${entry.name} ${entry.version}`}>
              <span className="settings-tab-text">
                <span className="licences-name">{entry.name}</span>
                <span className="settings-tab-subtitle">
                  {entry.version} · {entry.license}
                </span>
              </span>
            </button>
          ))}
        </nav>
        <section className="settings-panel licences-panel">
          {selected ? (
            <>
              <h3>
                {selected.name}
                <span className="settings-panel-subtitle">
                  {tx("Version {0} · {1}", selected.version, selected.license)}
                </span>
              </h3>
              <Button kind="link" className="licences-home" onClick={() => openInBrowser(selected.home)} data-url={selected.home}>
                <ExternalLinkIcon size={12} />
                <span>{selected.home.replace(/^https?:\/\//, "")}</span>
              </Button>
              {selected.texts.length === 0 ? (
                <p className="licences-note">{tx("This package doesn't come with a licence file: its licence is the standard text of {0}.", selected.license)}</p>
              ) : (
                selected.texts.map((text, index) => (
                  <pre key={index} className="licences-text">
                    {text}
                  </pre>
                ))
              )}
            </>
          ) : (
            <>
              <h3>
                {tx("Tributary{0}", <span className="settings-panel-subtitle">{"MIT License"}</span>)}
              </h3>
              <p className="licences-note">
                {tx("Tributary is free and open source, under the MIT License below.{0}", packages && t(" It's made with {0} open-source packages, each under its own licence: they're listed on the left.", packages.length))}
              </p>
              {own ? <pre className="licences-text">{own}</pre> : <p className="licences-note">{t("The licence text wasn't installed with this copy: it's the LICENSE file in Tributary's source code.")}</p>}
            </>
          )}
        </section>
      </div>
    </Dialog>
  );
}

const key = (entry: NoticePackage) => `${entry.name}@${entry.version}`;
