// The app's words in the language chosen in Settings → General → Language.
//
// Text is written in English in the code and looked up, as it is, in the translation of
// the language in use (src/locales/<language>.json); anything not translated yet shows in
// English. `{0}`, `{1}`, … in the text stand for the values passed after it.
//
// The language is read once, when the app starts: changing it reloads the window, so text
// worked out ahead of time (in constants, say) follows too.
import { createElement, Fragment, type ReactNode } from "react";
import ru from "../locales/ru.json";
import ruPlurals from "../locales/ru-plurals.json";

/** A language the app is translated into. */
export type Language = "en" | "ru";
/** The Language setting: one of the languages, or whichever the system uses. */
export type LanguageSetting = "system" | Language;

/** The languages offered in Settings, each named in itself. */
export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ru", label: "Русский" },
];

const STORAGE_KEY = "tributary.language";

const TRANSLATIONS: Record<Language, Record<string, string>> = { en: {}, ru };
/** For each English noun, its Russian forms for 1, 2–4 and 5 or more (one, few, many). */
const PLURALS: Record<Language, Record<string, string[]>> = { en: {}, ru: ruPlurals };

/** The Language setting as stored. */
export function languageSetting(): LanguageSetting {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const value = raw === null ? null : (JSON.parse(raw) as unknown);
    return value === "en" || value === "ru" || value === "system" ? value : "system";
  } catch {
    return "system";
  }
}

/** The language the system uses, when the app has a translation for it; otherwise English. */
export function systemLanguage(): Language {
  const languages = typeof navigator === "undefined" ? [] : (navigator.languages ?? [navigator.language]);
  for (const tag of languages) {
    const base = (tag ?? "").toLowerCase().split("-")[0];
    if (base === "ru" || base === "be" || base === "uk" || base === "kk") return "ru";
    if (base === "en") return "en";
  }
  return "en";
}

function resolve(setting: LanguageSetting): Language {
  return setting === "system" ? systemLanguage() : setting;
}

let current: Language = resolve(languageSetting());

/** The language the app is showing. */
export function language(): Language {
  return current;
}

/** The locale for dates and numbers: the system's in English, so they look as they always have. */
export function locale(): string | undefined {
  return current === "en" ? undefined : current;
}

/** Choose the language, and reload the window so everything shows in it. */
export function setLanguageSetting(setting: LanguageSetting, reload = true): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // Storage can be unavailable; the choice just won't survive a restart.
  }
  const next = resolve(setting);
  if (next === current) return;
  current = next;
  if (reload && typeof location !== "undefined") location.reload();
}

/** For tests: show `language` without storing it. */
export function useLanguageForTests(language: Language): void {
  current = language;
}

function lookup(text: string): string {
  return TRANSLATIONS[current][text] || text;
}

/** `text` in the language in use, with `{0}`, `{1}`, … replaced by `values`. */
export function t(text: string, ...values: unknown[]): string {
  const translated = lookup(text);
  if (values.length === 0) return translated;
  return translated.replace(/\{(\d+)\}/g, (match, index: string) => {
    const value = values[Number(index)];
    return value === undefined ? match : String(value);
  });
}

/** Like {@link t}, for a sentence with parts of the page in it (a branch name in bold, say). */
export function tx(text: string, ...parts: ReactNode[]): ReactNode {
  const pieces = lookup(text).split(/\{(\d+)\}/);
  const children: ReactNode[] = [];
  pieces.forEach((piece, index) => {
    if (index % 2 === 1) children.push(parts[Number(piece)]);
    else if (piece) children.push(piece);
  });
  return createElement(Fragment, null, ...children);
}

/** Which of the forms of a Russian noun goes with `count`: 0 for 1, 1 for 2–4, 2 for 5 or more. */
export function russianForm(count: number): 0 | 1 | 2 {
  const whole = Math.abs(Math.trunc(count));
  if (whole !== Math.abs(count)) return 1;
  const tens = whole % 100;
  const ones = whole % 10;
  if (tens >= 11 && tens <= 14) return 2;
  if (ones === 1) return 0;
  if (ones >= 2 && ones <= 4) return 1;
  return 2;
}

/**
 * The word for `count` of something, given its English singular and plural ("commit",
 * "commits"), in the language in use.
 */
export function pluralWord(count: number, word: string, pluralWordEn = `${word}s`): string {
  const forms = PLURALS[current][word];
  if (forms) return forms[current === "ru" ? russianForm(count) : count === 1 ? 0 : 1] ?? forms[forms.length - 1];
  const translated = lookup(count === 1 ? word : pluralWordEn);
  return translated;
}
