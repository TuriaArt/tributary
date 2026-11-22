// Commit signatures, in words.
import type { CommitSignature } from "../api";
import { t } from "./i18n";

const KINDS: Record<CommitSignature["kind"], string> = { gpg: "GPG", ssh: "SSH", x509: "X.509" };

/** A signature's mark ("Verified"), how it looks, and what it means. */
export function describeSignature(signature: CommitSignature): { label: string; tone: "good" | "neutral" | "warning" | "bad"; detail: string } {
  const kind = KINDS[signature.kind];
  const by = signature.signer ? t(" by {0}", signature.signer) : "";
  const key = signature.key ? t(" ({0} key {1})", kind, signature.key) : ` (${kind})`;
  switch (signature.status) {
    case "good":
      return { label: t("Verified"), tone: "good", detail: t("Signed{0}{1}, and the signature checks out.", by, key) };
    case "untrusted":
      return { label: t("Signed"), tone: "neutral", detail: t("A good signature{0}{1}, but the key isn't trusted on this computer.", by, key) };
    case "expired":
      return { label: t("Signed, expired"), tone: "warning", detail: t("A good signature{0}{1}, but the key or the signature has expired.", by, key) };
    case "revoked":
      return { label: t("Signed, key revoked"), tone: "bad", detail: t("Signed{0}{1} with a key that has been revoked.", by, key) };
    case "bad":
      return { label: t("Bad signature"), tone: "bad", detail: t("The signature{0} doesn't match the commit: it was changed after it was signed.", key) };
    case "unchecked":
      return {
        label: t("Signed"),
        tone: "neutral",
        detail:
          signature.kind === "ssh"
            ? t("Signed with an SSH key. Git checks SSH signatures against a list of allowed signers (gpg.ssh.allowedSignersFile), which isn't set up here.")
            : t("Signed{0}, but the key isn't on this computer, so it couldn't be checked.", key),
      };
  }
}
