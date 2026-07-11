import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import esErrors from "./locales/es/errors.json";
import enErrors from "./locales/en/errors.json";

export const SUPPORTED_LANGUAGES = ["es", "en"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: SupportedLanguage = "es";

function detectLanguage(): SupportedLanguage {
  if (typeof navigator === "undefined" || !navigator.language) {
    return DEFAULT_LANGUAGE;
  }

  const shortLang = navigator.language.slice(0, 2).toLowerCase();
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(shortLang)
    ? (shortLang as SupportedLanguage)
    : DEFAULT_LANGUAGE;
}

if (!i18next.isInitialized) {
  i18next.use(initReactI18next).init({
    lng: detectLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    ns: ["errors"],
    defaultNS: "errors",
    resources: {
      es: { errors: esErrors },
      en: { errors: enErrors },
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
  });
}

export default i18next;
