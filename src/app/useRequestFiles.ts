import { useEffect, useMemo, useState } from "react";
import { compareCommits, type Comparison, type RequestDetails } from "../api";

/** A pull request's files, read here from its two commits, and how to open their changes. */
export interface RequestFiles {
  /** Changes with the pull request's commits: diffs from one aren't shown for another. */
  key: string | null;
  /** The files it changes since it split from the branch it goes into, once read. */
  comparison: Comparison | null;
  error: string | null;
  /** The site didn't say which commits it's between. */
  unknown: boolean;
  /** Its commits aren't in this repository yet: a fetch brings them. */
  missing: boolean;
}

/**
 * The files a pull request changes, as its site lists them: what its branch changed since
 * it split from the one it goes into. Read here, from its two commits (`details`' base and
 * head), once both are in the repository.
 */
export function useRequestFiles(repoPath: string, details: RequestDetails | null, hasCommit: (id: string) => boolean): RequestFiles {
  const baseSha = details?.baseSha ?? null;
  const headSha = details?.headSha ?? null;
  const missing = Boolean(baseSha && headSha && !(hasCommit(baseSha) && hasCommit(headSha)));
  const key = baseSha && headSha && !missing ? JSON.stringify([repoPath, baseSha, headSha]) : null;
  const [loaded, setLoaded] = useState<{ key: string; comparison: Comparison | null; error: string | null } | null>(null);

  useEffect(() => {
    if (!key || !baseSha || !headSha) return;
    let current = true;
    compareCommits(repoPath, baseSha, headSha, true)
      .then((comparison) => current && setLoaded({ key, comparison, error: null }))
      .catch((e) => current && setLoaded({ key, comparison: null, error: String(e) }));
    return () => {
      current = false;
    };
    // `key` covers the repository and the two commits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const shown = loaded && loaded.key === key ? loaded : null;
  return useMemo(
    () => ({ key, comparison: shown?.comparison ?? null, error: shown?.error ?? null, unknown: Boolean(details && (!baseSha || !headSha)), missing }),
    [key, shown, details, baseSha, headSha, missing],
  );
}
