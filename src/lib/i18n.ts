export type AppLanguage = "he" | "en";

export const LANGUAGE_COOKIE_KEY = "bookmenow-language";
export const LANGUAGE_STORAGE_KEY = "bookmenow-language";

export function parseAppLanguage(value: string | null | undefined): AppLanguage {
  return value === "en" ? "en" : "he";
}

export function getLanguageDirection(language: AppLanguage) {
  return language === "he" ? "rtl" : "ltr";
}
