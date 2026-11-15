// A commit's checks summed up in words, for its details (CommitChecks).
import { STATE_WORDS, type RunState } from "./runGraph";

/** A check's state as the details count it: skipped ones have none. */
export type CountedState = "failure" | "pending" | "success" | "cancelled" | "skipped";

/** How the checks went, overall: failed if any did, running while any are, then passed. */
export function checksVerdict(counts: Map<CountedState, number>): RunState {
  if (counts.get("failure")) return "failure";
  if (counts.get("pending")) return "running";
  if (counts.get("success")) return "success";
  return counts.get("cancelled") ? "cancelled" : "skipped";
}

/**
 * How they went, in words: "All 22 checks passed", "13 of 20 checks passed" (the rest
 * cancelled or skipped), "1 of 7 checks failed", "2 of 7 jobs running" (GitLab's are jobs).
 */
export function checksHeadline(counts: Map<CountedState, number>, gitlab: boolean): string {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  const jobs = gitlab ? "jobs" : "checks";
  const state = checksVerdict(counts);
  if (state === "failure") return `${counts.get("failure")} of ${total} ${jobs} failed`;
  if (state === "running") return `${counts.get("pending")} of ${total} ${jobs} running`;
  if (state === "success") {
    const passed = counts.get("success") ?? 0;
    if (passed < total) return `${passed} of ${total} ${jobs} passed`;
    return total === 1 ? `The ${jobs.slice(0, -1)} passed` : `All ${total} ${jobs} passed`;
  }
  return total === 1 ? `The ${jobs.slice(0, -1)} was ${STATE_WORDS[state]}` : `All ${total} ${jobs} ${STATE_WORDS[state]}`;
}
