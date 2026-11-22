import { afterEach, describe, expect, it } from "vitest";
import ru from "../locales/ru.json";
import ruPlurals from "../locales/ru-plurals.json";
import { plural } from "./format";
import { pluralWord, russianForm, t, useLanguageForTests } from "./i18n";

afterEach(() => useLanguageForTests("en"));

describe("t", () => {
  it("fills in the values, and leaves English as it is", () => {
    expect(t("{0} of {1}{2}", 3, 7, "+")).toBe("3 of 7+");
  });

  it("translates into Russian", () => {
    useLanguageForTests("ru");
    expect(t("{0} of {1}{2}", 3, 7, "+")).toBe("3 из 7+");
    expect(t("Not in the dictionary {0}", 1)).toBe("Not in the dictionary 1");
  });
});

describe("plurals", () => {
  it("picks the Russian form by the number", () => {
    expect([1, 2, 5, 11, 21, 22, 25, 111, 1.5].map(russianForm)).toEqual([0, 1, 2, 2, 0, 1, 2, 2, 1]);
  });

  it("counts things in either language", () => {
    expect(plural(3, "branch", "branches")).toBe("3 branches");
    useLanguageForTests("ru");
    expect(pluralWord(1, "commit")).toBe("коммит");
    expect(pluralWord(3, "commit")).toBe("коммита");
    expect(pluralWord(12, "commit")).toBe("коммитов");
  });

  it("has three forms for every word", () => {
    for (const forms of Object.values(ruPlurals)) expect(forms).toHaveLength(3);
  });
});

describe("the Russian translation", () => {
  it("only uses values its English has", () => {
    for (const [english, russian] of Object.entries(ru as Record<string, string>)) {
      const has = new Set(english.match(/\{\d+\}/g) ?? []);
      for (const used of russian.match(/\{\d+\}/g) ?? []) expect(has, `${english} → ${russian}`).toContain(used);
    }
  });
});
