import { describe, expect, it } from "vitest";
import { checksHeadline, checksVerdict, type CountedState } from "./checkSummary";

const counts = (entries: [CountedState, number][]) => new Map(entries);

describe("a commit's checks in words", () => {
  it("says all passed only when every one did", () => {
    expect(checksHeadline(counts([["success", 22]]), false)).toBe("All 22 checks passed");
    expect(checksHeadline(counts([["success", 1]]), false)).toBe("The check passed");
    // Some cancelled (replaced by a newer run) or skipped: not all of them passed.
    expect(checksHeadline(counts([["success", 13], ["cancelled", 6], ["skipped", 1]]), false)).toBe("13 of 20 checks passed");
    expect(checksVerdict(counts([["success", 13], ["cancelled", 6]]))).toBe("success");
  });

  it("puts failed ones first, then running ones", () => {
    expect(checksHeadline(counts([["failure", 1], ["pending", 1], ["success", 5]]), false)).toBe("1 of 7 checks failed");
    expect(checksHeadline(counts([["pending", 2], ["success", 5]]), true)).toBe("2 of 7 jobs running");
    expect(checksVerdict(counts([["failure", 1], ["pending", 3]]))).toBe("failure");
  });

  it("says when none of them ran", () => {
    expect(checksHeadline(counts([["cancelled", 3]]), false)).toBe("All 3 checks cancelled");
    expect(checksHeadline(counts([["skipped", 1]]), true)).toBe("The job was skipped");
  });
});
