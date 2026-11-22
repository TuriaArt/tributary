import { useContext, useEffect, useState } from "react";
import { myIssues, type Issue } from "../../api";
import { useIssueTracker } from "../../lib/issues";
import { PullRequestsContext } from "../../lib/pullRequests";
import { openInBrowser } from "../../lib/weblinks";
import { PullRequestIcon, TargetIcon } from "../Icons";
import { t } from "../../lib/i18n";

/** Sections the sidebar can show, in its order, for its Sections menu and Settings. */
export const SIDEBAR_SECTIONS: { id: string; title: string; hint: string }[] = [
  { id: "branches", title: t("Branches"), hint: t("Yours, and the remotes' branches you haven't got") },
  { id: "pullRequests", title: t("Pull requests"), hint: t("The open ones on GitHub or GitLab") },
  { id: "issues", title: t("Issues"), hint: t("Yours, open, from the repository's issue tracker") },
  { id: "tags", title: t("Tags"), hint: "" },
  { id: "stashes", title: t("Stashes"), hint: "" },
  { id: "worktrees", title: t("Worktrees"), hint: t("When there's more than one") },
  { id: "submodules", title: t("Submodules"), hint: t("When there are some") },
  { id: "locks", title: t("Locked files"), hint: t("When the repository locks files with Git LFS") },
];

/** The open pull (or merge) requests, newest first: a click shows one in the app. */
export function useRequests() {
  return useContext(PullRequestsContext);
}

export function RequestList({ filter }: { filter: string }) {
  const lookup = useRequests();
  const list = (lookup?.list ?? []).filter((pr) => !filter || `#${pr.number} ${pr.title} ${pr.author} ${pr.branch}`.toLowerCase().includes(filter));
  return (
    <ul>
      {list.map((pr) => (
        <li key={`${pr.remote}/${pr.number}`}>
          <div
            className={`sidebar-item sidebar-request${pr.draft ? " draft" : ""}`}
            role="button"
            tabIndex={0}
            title={`#${pr.number} ${pr.title}\n${pr.draft ? t("Draft · ") : ""}${pr.author} · ${pr.branch}`}
            onClick={() => lookup?.open(pr)}
            onKeyDown={(event) => event.key === "Enter" && lookup?.open(pr)}
          >
            <span className={`sidebar-icon sidebar-request-state${pr.checks ? ` ${pr.checks}` : ""}`}>
              <PullRequestIcon size={13} />
            </span>
            <span className="sidebar-name">{pr.title}</span>
            <span className="sidebar-request-number">#{pr.number}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Your open issues in the repository's tracker (null while they're read, or with none). */
export function useMyIssues(repoPath: string, shown: boolean): { issues: Issue[] | null; error: string | null } {
  const { tracker } = useIssueTracker();
  const [found, setFound] = useState<{ key: string; issues: Issue[] | null; error: string | null }>({ key: "", issues: null, error: null });
  const key = JSON.stringify([repoPath, tracker]);
  useEffect(() => {
    if (!tracker || !shown) return;
    let current = true;
    myIssues(repoPath, tracker)
      .then((issues) => current && setFound({ key, issues: issues.filter((issue) => !issue.done), error: null }))
      .catch((e) => current && setFound({ key, issues: null, error: String(e) }));
    return () => {
      current = false;
    };
  }, [key, repoPath, tracker, shown]);
  return found.key === key ? { issues: found.issues, error: found.error } : { issues: null, error: null };
}

export function IssueList({ issues, error, filter }: { issues: Issue[]; error: string | null; filter: string }) {
  // Like "Sign in to GitHub (Settings, Accounts) to see the issues assigned to you."
  if (error) return <div className="sidebar-empty">{error}</div>;
  const list = issues.filter((issue) => !filter || `${issue.key} ${issue.title}`.toLowerCase().includes(filter));
  return (
    <ul>
      {list.map((issue) => (
        <li key={issue.key}>
          <div
            className="sidebar-item sidebar-issue"
            role="button"
            tabIndex={0}
            title={t("{0} {1}{2}\nOpens in your browser", issue.key, issue.title, issue.status ? `\n${issue.status}` : "")}
            onClick={() => openInBrowser(issue.url)}
            onKeyDown={(event) => event.key === "Enter" && openInBrowser(issue.url)}
          >
            <span className="sidebar-icon">
              <TargetIcon size={13} />
            </span>
            <span className="sidebar-name">{issue.title}</span>
            <span className="sidebar-request-number">{issue.key}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
