import { openInBrowser } from "../lib/weblinks";
import { SectionButton, SiteChip } from "./DetailsSite";
import { PullRequestIcon } from "./Icons";
import { tone, type Mentioned } from "./MentionedIssues";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";

/**
 * The pull requests of a commit's details (or GitLab merge requests): those of its branches,
 * and those its message names, like a merge commit's. Built as its checks are: an icon in its
 * state's colour, its number (a link to it on the site) and title, and Show, which shows it in
 * the app; under them, its state and who opened it.
 */
export function CommitRequests({ requests }: { requests: Mentioned[] }) {
  if (requests.length === 0) return null;
  const gitlab = requests.every((mention) => mention.request?.forge === "gitlab");
  const noun = gitlab ? "Merge request" : "Pull request";
  return (
    <section className="details-section commit-requests">
      <div className="details-section-head">
        <h3>{requests.length > 1 ? `${noun}s` : noun}</h3>
        <SiteChip site={gitlab ? "GitLab" : "GitHub"} />
      </div>
      {requests.map((mention) => {
        const author = mention.request?.author;
        return (
          <div key={mention.key} className={`site-item commit-request ${tone(mention.status ?? "")}`}>
            <span className="site-item-icon">
              <PullRequestIcon size={14} />
            </span>
            <span className="site-item-text commit-request-title">
              <Button kind="link" className="commit-request-key mono" onClick={() => mention.url && openInBrowser(mention.url)} disabled={!mention.url} data-url={mention.url ?? undefined} title={mention.url ? `Open ${mention.id} on the site` : undefined}>
                {mention.id}
              </Button>{" "}
              {mention.title}
            </span>
            {mention.onShow && <SectionButton onClick={mention.onShow} icon={<PullRequestIcon size={12} />} label="Show" title={`Show ${mention.id} here, in Tributary`} />}
            {(mention.status || author) && (
              <span className="site-item-under commit-request-state">
                {mention.status && <Chip className={`mentioned-issue-status ${tone(mention.status)}`}>{mention.status}</Chip>}
                {author && <span>by {author}</span>}
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
