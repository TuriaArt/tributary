import { useState } from "react";
import type { RepoSnapshot } from "../api";
import { Dialog } from "./Dialog";
import { TypeToConfirm } from "./Safety";
import { Button } from "./ui/Button";

interface Props {
  snapshot: RepoSnapshot;
  /** The checked-out branch, when it's protected: its name must be typed to go ahead. */
  protectedName?: string | null;
  /** Why it's asked for, when something stopped for it (a sync, into a rewritten branch). */
  reason?: string;
  onCancel: () => void;
  /** Go ahead: the dialog closes, and the push runs with its progress bar, like any push. */
  onPush: () => void;
}

/** Asks for confirmation before `git push --force-with-lease`. */
export function ForcePushDialog({ snapshot, protectedName, reason, onCancel, onPush }: Props) {
  const [typed, setTyped] = useState("");
  const confirmed = !protectedName || typed.trim() === protectedName;
  const branch = snapshot.headBranch ?? "HEAD";
  const target = snapshot.upstream?.name ?? `${snapshot.remotes.includes("origin") ? "origin" : (snapshot.remotes[0] ?? "the remote")}/${branch}`;

  return (
    <Dialog
      title={`Force push ${branch}?`}
      onCancel={onCancel}
      buttons={
        <>
          <Button kind="secondary" onClick={onCancel} autoFocus={!protectedName}>
            Cancel
          </Button>
          <Button kind="danger" onClick={onPush} disabled={!confirmed}>
            Force push
          </Button>
        </>
      }
    >
      {/* Why it's asked for (Sync stopped for it), above what it does. */}
      {reason && <div className="dialog-warning force-push-reason">{reason}</div>}
      <p>
        <strong>{target}</strong> will be replaced with your local <strong>{branch}</strong>.
      </p>
      <ul className="dialog-consequences">
        <li className="danger">Commits on {target} that aren't in your {branch} will be removed from it.</li>
        <li>
          It's a safe force push (<code>--force-with-lease</code>): it stops if someone else pushed to {target}{" "}
          since you last fetched.
        </li>
      </ul>
      {protectedName && <TypeToConfirm name={protectedName} value={typed} onChange={setTyped} />}
    </Dialog>
  );
}
