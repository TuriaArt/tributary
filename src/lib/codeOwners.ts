// Who owns a file, by the repository's CODEOWNERS, for the diff's header.
import { useEffect, useState } from "react";
import { codeOwners } from "../api";
import { joinAnd } from "./format";
import { t } from "./i18n";

/** Answers are kept this long (the file rarely changes). */
const KEEP_FOR = 60_000;
const known = new Map<string, { at: number; owners: Promise<string[]> }>();

function ownersOf(repo: string, path: string): Promise<string[]> {
  const key = `${repo}\n${path}`;
  const kept = known.get(key);
  if (kept && Date.now() - kept.at < KEEP_FOR) return kept.owners;
  const owners = codeOwners(repo, [path]).then((found) => found[0]?.owners ?? []);
  owners.catch(() => known.delete(key));
  known.set(key, { at: Date.now(), owners });
  return owners;
}

/** `path`'s owners (empty when it has none, or there's no CODEOWNERS). */
export function useCodeOwners(repo: string, path: string): string[] {
  const [owners, setOwners] = useState<string[]>([]);
  useEffect(() => {
    let current = true;
    setOwners([]);
    ownersOf(repo, path)
      .then((found) => current && setOwners(found))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [repo, path]);
  return owners;
}

/** "@art", "@art and @maya", "@art, @maya and 2 more". */
export function describeOwners(owners: string[]): string {
  if (owners.length <= 2) return joinAnd(owners);
  return t("{0}, {1} and {2} more", owners[0], owners[1], owners.length - 2);
}
