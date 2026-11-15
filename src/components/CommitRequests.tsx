import { openInBrowser } from "../lib/weblinks";
import { DetailsCard, DetailsCardButton } from "./DetailsCard";
import { PullRequestIcon } from "./Icons";
import { tone, type Mentioned } from "./MentionedIssues";
import { Button } from "./ui/Button";
import { Chip } from "./ui/Chip";

/**
 * The pull requests of a commit's details (or GitLab merge requests): those of its branches,
 * and those its message names, like a merge commit's. Each is a card, as its checks are: its
 * number (a link to it on the site) and title, its state and who opened it, and Show, which
 * shows it in the app.
 */
export function CommitRequests({ requests }: { requests: Mentioned[] }) {
  if (requests.length === 0) return null;
  const gitlab = requests.every((mention) => mention.request?.forge === "gitlab");
  const noun = gitlab ? "Merge request" : "Pull request";
  return (
    <section className="details-section details-cards commit-requests">
      <div className="details-section-head">
        <h3>{requests.length > 1 ? `${noun}s` : noun}</h3>
        <span className="details-section-note">{gitlab ? "GitLab" : "GitHub"}</span>
      </div>
      {requests.map((mention) => {
        const author = mention.request?.author;
        return (
          <DetailsCard
            key={mention.key}
            className={`request ${tone(mention.status ?? "")}`}
            icon={<PullRequestIcon size={15} />}
            title={
              <>
                <Button kind="link" className="details-card-key mono" onClick={() => mention.url && openInBrowser(mention.url)} disabled={!mention.url} data-url={mention.url ?? undefined} title={mention.url ? `Open ${mention.id} on the site` : undefined}>
                  {mention.id}
                </Button>{" "}
                {mention.title}
              </>
            }
            sub={
              <>
                {mention.status && <Chip className={`mentioned-issue-status ${tone(mention.status)}`}>{mention.status}</Chip>}
                {author && <span className="details-card-sub-text">by {author}</span>}
              </>
            }
            action={mention.onShow && <DetailsCardButton onClick={mention.onShow} icon={<PullRequestIcon size={12} />} label="Show" title={`Show ${mention.id} here, in Tributary`} />}
          />
        );
      })}
    </section>
  );
}
