// Team activity as cards: the period's commits up top with a graph of each day, a card for
// each person with their own graph in their colour, and a card for each branch.
import { plural, relativeTime } from "../../lib/format";
import { baseName } from "../../lib/paths";
import { change, dayLabel, labelledDays, perDay, previousPerDay, rhythm, withoutRemote } from "../../lib/team";
import { Avatar } from "../Avatar";
import { BranchIcon, LockIcon } from "../Icons";
import { AreaTrend } from "./AreaTrend";
import { DayTip, Divergence, Overlap, RingedAvatar, YouTag, type TeamData } from "./parts";
import { HotspotsCard, KindBar, KindsCard, LinesCard, PunchCard, RequestsCard } from "./TeamStats";
import { Chip } from "../ui/Chip";
import { t, tx } from "../../lib/i18n";

export function TeamCards({ team, work, requests, days, now, colorOf, isYou, yoursOn, lockOwners, tip, onShowBranch, onShowPerson }: TeamData) {
  const today = days[days.length - 1];
  const people = team.people.map((person) => ({ person, color: colorOf(person.email), daily: perDay(person.times, days) }));
  const totals = days.map((_, index) => people.reduce((sum, entry) => sum + entry.daily[index], 0));
  const total = team.people.reduce((sum, person) => sum + person.commits, 0);
  const busiestDay = totals.reduce((best, count, index) => (count > totals[best] ? index : best), 0);
  // Everyone's graph has the same scale, so they compare.
  const busiestPerson = Math.max(1, ...people.flatMap((entry) => entry.daily));
  const scale = Math.max(1, ...team.branches.flatMap((branch) => [branch.ahead, branch.behind]));
  const labelled = labelledDays(days.length);
  const at = (index: number) => `${(index / Math.max(1, days.length - 1)) * 100}%`;
  // The period before, as long, to compare with.
  const before = previousPerDay(team.previous, days);
  const changed = change(total, team.previous.length);
  const allTimes = team.people.flatMap((person) => person.times);
  const nameOf = (email: string) => team.people.find((person) => person.email.toLowerCase() === email)?.name ?? email;
  const workOf = (email: string) => work?.people.find((entry) => entry.email === email.toLowerCase());

  return (
    <div className="team-cards">
      <section className="team-hero">
        <div className="team-hero-summary">
          <div className="team-hero-figure">
            <span className="team-hero-number">{total.toLocaleString()}</span>
            <span className="team-hero-text">
              <span>
                {tx("commits in the last {0} days{1}", team.days, changed !== null && (
                  <span className={`team-change ${changed > 0 ? "up" : changed < 0 ? "down" : ""}`} title={t("{0} in the {1} days before", plural(team.previous.length, "commit"), team.days)}>
                    {tx("{0}{1}% vs the {2} days before", changed > 0 ? "+" : changed < 0 ? "−" : "", Math.abs(changed), team.days)}
                  </span>
                ))}
              </span>
              <span className="muted">
                {tx("{0} on {1}{2}", team.mainCommits.toLocaleString(), <span className="mono">{team.main}</span>, team.branches.length > 0 && t(", {0} on {1}", (total - team.mainCommits).toLocaleString(), plural(team.branches.length, "branch", "branches")))}
              </span>
            </span>
          </div>
          <div className="team-hero-people">
            {people.slice(0, 8).map(({ person, color }) => (
              <RingedAvatar key={person.email} person={person} color={color} size={30} />
            ))}
            {people.length > 8 && <span className="team-hero-more">+{people.length - 8}</span>}
          </div>
        </div>
        <div className="team-hero-chart">
          <div className="team-hero-chart-head">
            <span>{t("Commits per day")}</span>
            {totals[busiestDay] > 0 && (
              <span className="muted">
                {tx("Busiest: {0}, {1}", dayLabel(days[busiestDay], today), plural(totals[busiestDay], "commit"))}
              </span>
            )}
          </div>
          <AreaTrend
            values={totals}
            ghost={before}
            top={Math.max(1, ...totals, ...before)}
            color="var(--accent)"
            height={112}
            label={t("Commits per day over the last {0} days", team.days)}
            tip={tip}
            describe={(index) => (
              <>
                <DayTip label={dayLabel(days[index], today)} entries={people.map((entry) => ({ ...entry, count: entry.daily[index] }))} />
                <span className="team-tip-row muted">
                  {tx("{0}the period before{1}", <span className="team-ghost-key" />, <span className="team-tip-value">{before[index]}</span>)}
                </span>
              </>
            )}
          />
          <div className="team-area-axis" aria-hidden="true">
            {days.map((day, index) =>
              labelled(index) ? (
                <span key={day} className={day === today ? "today" : undefined} style={{ left: at(index) }}>
                  {dayLabel(day, today)}
                </span>
              ) : null,
            )}
          </div>
        </div>
      </section>

      {(work || (requests && requests.length > 0)) && (
        <div className="team-panels">
          {work && work.kinds.length > 0 && <KindsCard work={work} tip={tip} />}
          {work && <LinesCard work={work} days={days} today={today} tip={tip} />}
          {work && work.hotspots.length > 0 && <HotspotsCard work={work} nameOf={nameOf} colorOf={colorOf} tip={tip} />}
          <PunchCard times={allTimes} tip={tip} />
          {requests && requests.length > 0 && <RequestsCard requests={requests} since={team.since} />}
        </div>
      )}

      <h3 className="team-section-title">{t("People")}</h3>
      <ul className="team-card-grid">
        {people.map(({ person, color, daily }) => (
          <li key={person.email}>
            <button className="team-person-card" onClick={() => onShowPerson(person)} title={t("Highlight {0}'s commits", person.name)}>
              <span className="team-person-card-head">
                <RingedAvatar person={person} color={color} size={36} />
                <span className="team-person-card-name">
                  <span>
                    {person.name}
                    {isYou(person.email) && <YouTag />}
                  </span>
                  <span className="muted">{tx("last {0}", relativeTime(person.latest, now / 1000))}</span>
                </span>
                <span className="team-person-card-count">
                  {person.commits.toLocaleString()}
                  <span className="muted">{person.commits === 1 ? "commit" : "commits"}</span>
                </span>
              </span>
              <AreaTrend
                values={daily}
                top={busiestPerson}
                color={color}
                height={52}
                label={t("{0}'s commits per day", person.name)}
                tip={tip}
                describe={(index) => <strong>{`${dayLabel(days[index], today)} · ${plural(daily[index], "commit")}`}</strong>}
              />
              <span className="team-rhythm">
                <span>
                  {tx("Active on {0} {1}", <strong>{rhythm(daily).active}</strong>, rhythm(daily).active === 1 ? "day" : "days")}
                </span>
                <span>
                  {tx("{0} in a row at most", <strong>{rhythm(daily).streak}</strong>)}
                </span>
                {workOf(person.email) && (workOf(person.email)?.added ?? 0) + (workOf(person.email)?.removed ?? 0) > 0 && (
                  <span>
                    <span className="added">+{workOf(person.email)?.added.toLocaleString()}</span> <span className="removed">−{workOf(person.email)?.removed.toLocaleString()}</span>
                  </span>
                )}
              </span>
              {workOf(person.email) && <KindBar kinds={workOf(person.email)?.kinds ?? []} tip={tip} />}
              <span className="team-chips">
                {person.branches.slice(0, 3).map((branch) => (
                  <Chip key={branch} className="team-branch-chip">
                    {withoutRemote(branch)}
                  </Chip>
                ))}
                {person.branches.length > 3 && <span className="muted">+{person.branches.length - 3}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {team.branches.length > 0 && (
        <>
          <h3 className="team-section-title">{t("Branches in progress")}</h3>
          <ul className="team-card-grid">
            {team.branches.map((branch) => (
              <li key={branch.name}>
                <button className="team-branch-card" onClick={() => onShowBranch(branch)} title={t("Highlight {0}'s history", branch.name)}>
                  <span className="team-branch-card-head">
                    <BranchIcon size={14} />
                    <span className="team-branch-card-name mono">{withoutRemote(branch.name)}</span>
                    <span className="muted">{relativeTime(branch.latest, now / 1000)}</span>
                  </span>
                  <Divergence branch={branch} main={team.main} scale={scale} labels />
                  <span className="team-branch-card-foot">
                    <span className="team-avatars">
                      {branch.people.slice(0, 4).map((person) => (
                        <Avatar key={person.email} name={person.name} email={person.email} size={20} color={colorOf(person.email)} />
                      ))}
                    </span>
                    <span className="muted">
                      {plural(branch.times.length, "commit")} · {plural(branch.files, "file")}
                    </span>
                    <Overlap files={yoursOn(branch)} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {lockOwners && lockOwners.length > 0 && (
        <>
          <h3 className="team-section-title">{t("Locked files")}</h3>
          <ul className="team-card-grid">
            {lockOwners.map(([owner, held]) => (
              <li key={owner} className="team-lock-card">
                <span className="team-lock-card-head">
                  <LockIcon size={14} />
                  {held[0].mine ? `${owner} (you)` : owner}
                  <span className="muted">{plural(held.length, "file")}</span>
                </span>
                <span className="team-lock-card-files mono" title={held.map((lock) => lock.path).join("\n")}>
                  {held
                    .slice(0, 5)
                    .map((lock) => baseName(lock.path))
                    .join("\n")}
                  {held.length > 5 && t("\nand {0} more", held.length - 5)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
