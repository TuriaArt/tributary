import type { ReactNode } from "react";
import type { CommitRow, HiddenRef } from "../api";
import type { FoundCommit } from "../api/generated";
import type { Search, SearchMode } from "../app/useSearch";
import { plural, relativeTime, shortId } from "../lib/format";
import { BranchIcon, CloseIcon, CodeIcon, CommitIcon, FolderIcon, TagIcon, UserIcon } from "./Icons";
import { Button } from "./ui/Button";
import { t, tx } from "../lib/i18n";

/** How many of each kind are listed before Show all. */
const SHOWN = 3;

/** `text` with each place `query` is in it marked. */
function marked(text: string, query: string): ReactNode {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + query.length)}</mark>
      {marked(text.slice(at + query.length), query)}
    </>
  );
}

interface Group {
  kind: SearchMode;
  title: string;
  /** How many there are ("3", "2000+"), or null while it's being searched. */
  count: string | null;
  rows: ReactNode[];
}

/** A branch or tag whose name matched, and the commit it's on. */
interface RefFound {
  name: string;
  tag: boolean;
  commit: string;
}

/** The branches and tags whose names contain `query`: the loaded commits' and the hidden ones. */
function refsMatching(commits: CommitRow[], hidden: HiddenRef[], query: string): RefFound[] {
  const needle = query.toLowerCase();
  const found = new Map<string, RefFound>();
  const add = (name: string, kind: string, commit: string) => {
    if ((kind === "branch" || kind === "remote" || kind === "tag") && name.toLowerCase().includes(needle) && !found.has(name)) found.set(name, { name, tag: kind === "tag", commit });
  };
  for (const commit of commits) for (const ref of commit.refs) add(ref.name, ref.kind, commit.id);
  for (const ref of hidden) add(ref.name, ref.kind, ref.commit);
  return [...found.values()];
}

/**
 * What a search of everything found, by kind, in the sidebar's place: a few of each, Show all
 * to search that kind alone, and the history beside it with the matches lit.
 */
export function SearchResults({
  everything,
  commits,
  hiddenRefs,
  onGo,
  onKind,
  onClose,
}: {
  everything: NonNullable<Search["everything"]>;
  commits: CommitRow[];
  hiddenRefs: HiddenRef[];
  /** Select a commit in the history (loading older history to reach it). */
  onGo: (id: string) => void;
  /** Search one kind for `text`. */
  onKind: (kind: SearchMode, text: string) => void;
  onClose: () => void;
}) {
  const { query, found } = everything;
  const overview = found?.overview ?? null;
  const code = found?.code ?? null;
  const refs = refsMatching(commits, hiddenRefs, query);
  const count = (length: number, truncated = false) => `${length}${truncated ? "+" : ""}`;
  const commitRows = (list: FoundCommit[], icon: ReactNode) =>
    list.map((commit) => (
      <button key={commit.id} className="search-result" onClick={() => onGo(commit.id)} title={`${commit.summary}\n${commit.author}, ${relativeTime(commit.time)} · ${shortId(commit.id)}`}>
        <span className="search-result-icon">{icon}</span>
        <span className="search-result-text button-label">{marked(commit.summary, query)}</span>
        <span className="search-result-meta">{relativeTime(commit.time)}</span>
      </button>
    ));

  const groups: Group[] = [
    {
      kind: "messages",
      title: t("Messages"),
      count: overview ? count(overview.messages.commits.length, overview.messages.truncated) : null,
      rows: overview ? commitRows(overview.messages.commits, <CommitIcon size={14} />) : [],
    },
    {
      kind: "refs",
      title: t("Branches and tags"),
      count: String(refs.length),
      rows: refs.map((ref) => (
        <button key={ref.name} className="search-result" onClick={() => onGo(ref.commit)}>
          <span className="search-result-icon">{ref.tag ? <TagIcon size={14} /> : <BranchIcon size={14} />}</span>
          <span className="search-result-text button-label mono">{marked(ref.name, query)}</span>
        </button>
      )),
    },
    {
      kind: "authors",
      title: t("Authors"),
      count: overview ? String(overview.authors.length) : null,
      rows: (overview?.authors ?? []).map((author) => (
        <button key={author.email + author.name} className="search-result" onClick={() => onKind("authors", author.email)} title={t("Their commits: {0} <{1}>", author.name, author.email)}>
          <span className="search-result-icon">
            <UserIcon size={14} />
          </span>
          <span className="search-result-text button-label">
            {marked(author.name, query)} <span className="search-result-meta">{marked(author.email, query)}</span>
          </span>
          <span className="search-result-meta">{plural(author.commits, "commit")}</span>
        </button>
      )),
    },
    {
      kind: "hashes",
      title: t("Commit ids"),
      count: overview ? String(overview.hashes.commits.length) : null,
      rows: overview ? commitRows(overview.hashes.commits, <CommitIcon size={14} />) : [],
    },
    {
      kind: "files",
      title: t("Files"),
      count: overview ? String(overview.files.length) : null,
      rows: (overview?.files ?? []).map((file) => (
        <button key={file.path} className="search-result" onClick={() => onKind("files", file.path)} title={t("The commits that changed {0}", file.path)}>
          <span className="search-result-icon">
            <FolderIcon size={14} />
          </span>
          <span className="search-result-text button-label mono">{marked(file.path, query)}</span>
          <span className="search-result-meta">{plural(file.commits, "commit")}</span>
        </button>
      )),
    },
    {
      kind: "code",
      title: t("Code"),
      count: code ? count(code.commits.length, code.truncated) : null,
      rows: code ? commitRows(code.commits, <CodeIcon size={14} />) : [],
    },
  ];
  const shown = groups.filter((group) => group.count === null || group.rows.length > 0);
  const none = groups.filter((group) => group.count !== null && group.rows.length === 0);
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <aside className="search-results" aria-label={t("What \"{0}\" matches", query)}>
      <header className="search-results-head">
        <span className="search-results-total">
          {tx("{0} for “{1}”", everything.searching && total === 0 ? t("Searching…") : plural(total, "result"), query)}
        </span>
        <Button kind="icon" onClick={onClose} title={t("Close the results (Esc in the search box)")} aria-label={t("Close the results")}>
          <CloseIcon size={13} />
        </Button>
      </header>
      <div className="search-results-groups">
        {shown.map((group) => (
          <section key={group.kind} className="search-results-group" aria-label={group.title}>
            <h3 className="search-results-title">
              <span>{group.title}</span>
              <span className="search-results-count">{group.count ?? t("searching…")}</span>
              {group.rows.length > SHOWN && (
                <button className="search-results-all" onClick={() => onKind(group.kind, query)} title={t("Search {0} alone, with the history showing just those", group.title.toLowerCase())}>
                  <span className="button-label">{tx("Show all {0}", group.rows.length)}</span>
                </button>
              )}
            </h3>
            {group.rows.slice(0, SHOWN)}
          </section>
        ))}
        {none.length > 0 && (
          <p className="search-results-none">
            {tx("Nothing in {0}", none.map((group) => group.title.toLowerCase()).join(", "))}
          </p>
        )}
      </div>
    </aside>
  );
}
