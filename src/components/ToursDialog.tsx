import { useThemeColors } from "../app/useAppearance";
import { withAlpha } from "../lib/colors";
import { TOURS, type TourId } from "../lib/tours";
import { Dialog } from "./Dialog";
import { CheckIcon } from "./Icons";
import { TOUR_LOOKS } from "./TourOverlay";
import type { CSSProperties } from "react";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

interface Props {
  /** The tours taken (finished or skipped). */
  done: TourId[];
  /** Whether tours are offered when you reach something new. */
  offered: boolean;
  setOffered: (offered: boolean) => void;
  /** A repository is open (tours walk through one). */
  canStart: boolean;
  onStart: (id: TourId) => void;
  onClose: () => void;
}

/** Help → Tours: every guided tour, to take (again) any time, and whether they're offered. */
export function ToursDialog({ done, offered, setOffered, canStart, onStart, onClose }: Props) {
  const { lanes } = useThemeColors();
  return (
    <Dialog
      title={t("Tours")}
      wide
      className="tours-dialog"
      onCancel={onClose}
      buttons={
        <>
          <label className="checkbox tours-offered">
            {tx("{0}Offer a tour when I come across something new", <input type="checkbox" checked={offered} onChange={(event) => setOffered(event.target.checked)} />)}
          </label>
          <span className="spacer" />
          <Button kind="secondary" onClick={onClose}>
            {t("Close")}
          </Button>
        </>
      }
    >
      <p className="dialog-note-line">
        {canStart ? t("Short walks through Tributary that point at the real thing, a few stops each.") : t("Open a repository first: the tours walk through one.")}
      </p>
      <ul className="tours-list">
        {TOURS.map((tour) => {
          const color = lanes[TOUR_LOOKS[tour.id].lane % lanes.length];
          return (
            <li key={tour.id} style={{ "--tour-color": color, "--tour-soft": withAlpha(color, 0.16) } as CSSProperties}>
              <span className="tour-offer-tile">{TOUR_LOOKS[tour.id].icon(16)}</span>
              <span className="tours-text">
                <strong>{tour.title}</strong>
                <span>
                  {tx("{0} · {1} stops", tour.summary, tour.stops.length)}
                </span>
              </span>
              {done.includes(tour.id) && (
                <span className="tours-done" title={t("Taken")}>
                  <CheckIcon size={13} />
                </span>
              )}
              <Button kind="outline" disabled={!canStart} onClick={() => onStart(tour.id)}>
                <span className="button-label">{done.includes(tour.id) ? t("Again") : t("Start")}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
