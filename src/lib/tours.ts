import { t } from "./i18n";
// Guided tours: short walks through the app that point at the real thing, one topic at a
// time. Getting started runs the first time someone new opens a repository; the others are
// offered once, when you first reach their features, and Help → Tours has them all.

export type TourId = "start" | "team" | "lfs" | "safety" | "simple";

/** What a stop needs on screen first. */
export type TourPrep = "sidebar";

export interface TourStop {
  /** What it points at (a `data-tour` name), or null for a stop about something not on screen. */
  target: string | null;
  title: string;
  text: string;
  /** Skipped when its target isn't there (otherwise it's shown in the middle). */
  optional?: boolean;
  prepare?: TourPrep;
}

export interface Tour {
  id: TourId;
  title: string;
  /** What it covers, for Help → Tours and its offer. */
  summary: string;
  stops: TourStop[];
}

export const TOURS: Tour[] = [
  {
    id: "start",
    title: t("Getting started"),
    summary: t("The graph, your changes, and sending them to the team"),
    stops: [
      {
        target: "graph",
        title: t("The graph"),
        text: t("Every branch and commit, newest at the top. Click a commit to see what it changed; right-click it for what you can do with it."),
      },
      {
        target: "current-branch",
        optional: true,
        title: t("Your branch"),
        text: t("The branch you're on glows. Double-click another branch's label to switch to it, or drag one onto another to merge or rebase."),
      },
      {
        target: "changes",
        optional: true,
        title: t("Your changes"),
        text: t("Files you've changed but not committed. Click here to pick what goes in, write what you did, and commit."),
      },
      {
        target: "remote",
        title: t("Fetch, Pull and Push"),
        text: t("Fetch checks what the team has sent, Pull brings it into your branch, and Push sends your commits. The numbers say how many are waiting."),
      },
      {
        target: "section-branches",
        optional: true,
        prepare: "sidebar",
        title: t("Branches, and more"),
        text: t("Your branches, the remote's, tags, stashes and locked files. Click one to find it in the graph."),
      },
      {
        target: null,
        title: t("Everything, from the keyboard"),
        text: "Ctrl+K (⌘K on a Mac) opens the command palette: every command and branch, by typing a few letters. Help → Tours has the other tours, any time.",
      },
    ],
  },
  {
    id: "team",
    title: t("Working with a team"),
    summary: t("Who's working on what, locks, and sharing unfinished work"),
    stops: [
      {
        target: "team",
        title: t("Team activity"),
        text: t("Who's been working on what lately: everyone's days, the files changed most, the branches being worked on, and who holds which locks."),
      },
      {
        target: "section-locks",
        optional: true,
        prepare: "sidebar",
        title: t("Locked files"),
        text: t("Files someone's working on, so nobody else changes them at the same time. Right-click one of yours to lock it, or to let go of your lock."),
      },
      {
        target: "elsewhere",
        optional: true,
        title: t("Also changed elsewhere"),
        text: t("Files you're changing that someone changed on another branch too. Click to see who: better to talk before you both spend a day on it."),
      },
      {
        target: "menu-repository",
        title: t("Shelves"),
        text: t("Repository → Shelves shares unfinished work without a branch, for a review or a second pair of eyes. Anyone can open a shelf into their own copy."),
      },
      {
        target: null,
        title: t("Fetch latest overnight"),
        text: t("Settings → Fetching → Fetch latest can fetch every open repository at a set time and move each branch forward when it can without merging, Git LFS files and all, so a big update is waiting in the morning."),
      },
    ],
  },
  {
    id: "lfs",
    title: t("Big files and Git LFS"),
    summary: t("Art, audio and video without slowing everyone down"),
    stops: [
      {
        target: "lfs-bar",
        optional: true,
        title: t("Files not downloaded yet"),
        text: t("Files stored with Git LFS that are still small stand-ins: Download them gets the real ones."),
      },
      {
        target: "changes",
        optional: true,
        title: t("Big files are flagged"),
        text: t("Big files that aren't stored with Git LFS are flagged before you commit them, with a button to store them there from now on."),
      },
      {
        target: "menu-repository",
        title: t("Check the project's setup"),
        text: t("Repository → Tools → Check Project Setup looks over how an Unreal or Unity project is set up for git (what's ignored, what Git LFS stores, what's lockable) with a fix for each problem."),
      },
      {
        target: "menu-repository",
        title: t("What makes it big"),
        text: t("Repository → Tools → What Makes It Big shows the biggest files in all of the history, and can move them into Git LFS."),
      },
      {
        target: null,
        title: t("Room on the disk"),
        text: t("Before downloading Git LFS files, Tributary checks they'll fit, and says so instead of stopping halfway."),
      },
    ],
  },
  {
    id: "safety",
    title: t("Safety nets"),
    summary: t("Undo, your actions, and getting lost work back"),
    stops: [
      {
        target: null,
        title: t("Undo"),
        text: t("After most things you do, the message at the bottom of the window has Undo: a commit, a checkout, a merge, a deleted branch."),
      },
      {
        target: "activity",
        title: t("Your actions"),
        text: t("Activity → Your actions lists what you did here, each with Undo for as long as it's safe, and every git command Tributary ran."),
      },
      {
        target: "menu-repository",
        title: t("Local history"),
        text: t("Your uncommitted work is kept every few minutes. Repository → Local History puts files back as they were."),
      },
      {
        target: "menu-repository",
        title: t("Branches are backed up"),
        text: t("Branches Tributary deletes, rewrites or force-pushes are kept for 30 days: Repository → Branches → Restore Branch puts them back, and History → Recover Commits finds lost ones."),
      },
    ],
  },
  {
    id: "simple",
    title: t("Simple mode"),
    summary: t("Get latest, submit your changes, and see the team"),
    stops: [
      {
        target: "simple-changes",
        title: t("My changes"),
        text: t("Tick the files to send, say what you changed, and Submit: they're committed and sent to the team in one go. Lock a file so nobody else changes it meanwhile."),
      },
      {
        target: "simple-latest",
        title: t("Get latest"),
        text: t("How many updates the team has sent, and from whom. One button brings them in, Git LFS files and all."),
      },
      {
        target: "simple-team",
        title: t("The team"),
        text: t("Who's working on which locked files, and what's been done lately."),
      },
      {
        target: "simple-header",
        title: t("Shelves, history and the full view"),
        text: t("Share unfinished work on a shelf, put files back from your local history, or switch to the full view, with branches and the graph."),
      },
    ],
  },
];

export const tourById = (id: TourId): Tour => TOURS.find((tour) => tour.id === id) ?? TOURS[0];

/** The stops to show: optional ones only when what they point at is there. */
export function shownStops(tour: Tour, present: (target: string) => boolean): TourStop[] {
  return tour.stops.filter((stop) => !stop.optional || (stop.target !== null && present(stop.target)));
}

/** What's known about the open repository, to offer the tours that fit. */
export interface TourFacts {
  /** In Simple mode (its own tour), or the full view. */
  simple: boolean;
  /** How many people committed lately. */
  people: number;
  /** Whether it uses Git LFS, or its locks. */
  usesLfs: boolean;
  /** How many things you've done here. */
  actions: number;
}

/**
 * The tour to offer now: the first that fits and hasn't been offered or taken. Getting
 * started first; in Simple mode, only its own.
 */
export function tourToOffer(facts: TourFacts, seen: TourId[]): TourId | null {
  const fits: [TourId, boolean][] = facts.simple
    ? [["simple", true]]
    : [
        ["start", true],
        ["team", facts.people >= 2],
        ["lfs", facts.usesLfs],
        ["safety", facts.actions >= 1],
      ];
  return fits.find(([id, fit]) => fit && !seen.includes(id))?.[0] ?? null;
}
