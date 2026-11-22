import type { PullRequest, RequestCheck, RequestConversation, RequestDetails } from "../api";
import { requestNumber } from "./pullRequests";
import { t } from "./i18n";

/** What was known of a pull request the last time it was looked at. */
export interface RequestSeen {
  /** The comments (and reviews) seen so far, by id. */
  comments: Set<string>;
  checks: "pending" | "success" | "failure" | "cancelled" | null;
  state: RequestDetails["state"];
}

/** Where the checks stand: still running, any failed, all passed, or none ran. */
export function checksState(checks: RequestCheck[]): RequestSeen["checks"] {
  if (checks.some((check) => check.state === "pending")) return "pending";
  if (checks.some((check) => check.state === "failure")) return "failure";
  // Stopped before finishing (replaced by a newer run): no news either way.
  if (checks.some((check) => check.state === "cancelled")) return "cancelled";
  if (checks.some((check) => check.state === "success")) return "success";
  return null;
}

export function seenNow(conversation: RequestConversation, details: RequestDetails): RequestSeen {
  return { comments: new Set(conversation.comments.map((comment) => comment.id)), checks: checksState(details.checks), state: details.state };
}

/**
 * What happened on `pr` between two looks, in words, most important first: reviews and
 * comments by others (yours are left out), checks that finished or failed, and whether it
 * was merged or closed.
 */
export function describeRequestNews(pr: PullRequest, before: RequestSeen, now: RequestSeen, conversation: RequestConversation | null): string[] {
  const number = requestNumber(pr);
  const news: string[] = [];
  if (before.state !== now.state && (now.state === "merged" || now.state === "closed")) {
    news.push(now.state === "merged" ? t("{0} was merged", number) : t("{0} was closed", number));
  }
  const you = conversation?.you?.toLowerCase();
  const fresh = (conversation?.comments ?? []).filter((comment) => !before.comments.has(comment.id) && comment.author.toLowerCase() !== you);
  for (const review of fresh.filter((comment) => comment.review)) {
    news.push(
      review.review === "approved"
        ? t("{0} approved {1}", review.author, number)
        : review.review === "changesRequested"
          ? t("{0} asked for changes on {1}", review.author, number)
          : t("{0} reviewed {1}", review.author, number),
    );
  }
  const comments = fresh.filter((comment) => !comment.review);
  if (comments.length === 1) {
    const [comment] = comments;
    const where = comment.path ? ` (${comment.path.split("/").pop()})` : "";
    news.push(comment.reply ? t("{0} replied on {1}{2}", comment.author, number, where) : t("{0} commented on {1}{2}", comment.author, number, where));
  } else if (comments.length > 1) {
    const people = [...new Set(comments.map((comment) => comment.author))];
    news.push(t("{0} new comments on {1} from {2}", comments.length, number, people.length > 2 ? t("{0} and others", people.slice(0, 2).join(", ")) : people.length === 2 ? t("{0} and {1}", people[0], people[1]) : people[0]));
  }
  const gitlab = pr.forge === "gitlab";
  if (now.checks === "failure" && before.checks !== "failure") news.push(gitlab ? t("{0}'s pipeline failed", number) : t("{0}'s checks failed", number));
  else if (now.checks === "success" && before.checks === "pending") news.push(gitlab ? t("{0}'s pipeline passed", number) : t("{0}'s checks passed", number));
  return news;
}

/** Requests merged from this window: their merge isn't news. */
const mergedHere = new Set<string>();

export function noteMergedHere(repoPath: string, number: number) {
  mergedHere.add(`${repoPath}#${number}`);
}

export function wasMergedHere(repoPath: string, number: number): boolean {
  return mergedHere.has(`${repoPath}#${number}`);
}
