// Saying what's wrong with a new file's name, for the warnings before committing.
import type { NameProblem } from "../api";
import { t } from "./i18n";

/** Why `problem.path` will cause trouble, in a few words, like "named like a Windows device (CON)". */
export function describeNameProblem(problem: NameProblem): string {
  // The file's own name, or one of its folders'.
  const own = problem.path.slice(problem.path.lastIndexOf("/") + 1) === problem.detail;
  const which = own ? t("its name") : t("its folder “{0}”", problem.detail);
  switch (problem.problem) {
    case "caseClash":
      return t("the same as {0} but for capitals: on Windows and macOS they're one", problem.detail);
    case "reserved":
      return t("{0} Windows keeps for devices", own ? t("a name") : t("{0} is a name", which));
    case "character":
      return t("Windows doesn't allow {0} in names", problem.detail === "\\" ? t("a backslash") : `“${problem.detail}”`);
    case "trailingDot":
      return t("{0} ends in {1}, which Windows drops", which, problem.detail.endsWith(".") ? t("a dot") : t("a space"));
    case "tooLong":
      return t("{0} characters long: inside a folder like C:\\Users\\you\\Projects, over Windows' 260", problem.detail);
  }
}
