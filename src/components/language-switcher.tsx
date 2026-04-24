"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LANGUAGE_COOKIE_KEY,
  LANGUAGE_STORAGE_KEY,
  type AppLanguage,
  getLanguageDirection,
  parseAppLanguage,
} from "@/lib/i18n";


function applyLanguageToDocument(language: AppLanguage) {
  const direction = getLanguageDirection(language);
  document.documentElement.lang = language;
  document.documentElement.dir = direction;
  document.body.setAttribute("dir", direction);
}
type LanguageSwitcherProps = {
  initialLanguage?: AppLanguage;
};

export function LanguageSwitcher({ initialLanguage = "he" }: LanguageSwitcherProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === "undefined") {
      return initialLanguage;
    }

    const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return parseAppLanguage(storedLanguage ?? document.documentElement.lang);
  });

  useEffect(() => {
    applyLanguageToDocument(language);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${language}; path=/; max-age=31536000; samesite=lax`;
  }, [language]);
  function handleLanguageChange(nextLanguage: AppLanguage) {
    if (nextLanguage === language) {
      return;
    }
    applyLanguageToDocument(nextLanguage);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    document.cookie = `${LANGUAGE_COOKIE_KEY}=${nextLanguage}; path=/; max-age=31536000; samesite=lax`;

    setLanguage(nextLanguage);
    router.refresh();
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/95 p-1 shadow-sm">
      <button
        type="button"
        onClick={() => handleLanguageChange("he")}
        aria-label={language === "he" ? "מעבר לעברית" : "Switch to Hebrew"}
        aria-pressed={language === "he"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
          language === "he"
            ? "bg-[var(--color-primary-light)] text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <span aria-hidden>🇮🇱</span>
      </button>

      <button
        type="button"
        onClick={() => handleLanguageChange("en")}
        aria-label={language === "he" ? "מעבר לאנגלית" : "Switch to English"}
        aria-pressed={language === "en"}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
          language === "en"
            ? "bg-[var(--color-primary-light)] text-white shadow-sm"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <span aria-hidden>🇬🇧</span>
      </button>
    </div>
  );
}
