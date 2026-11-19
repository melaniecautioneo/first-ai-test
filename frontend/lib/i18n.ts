import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from '../locales/en.json'
import fr from '../locales/fr.json'

export const LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' }
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

/**
 * Langue utilisée pour le rendu serveur ET pour le premier rendu client.
 * Indispensable : si le serveur rendait "fr" et le client "en", React
 * signalerait une erreur d'hydratation. On change de langue seulement
 * APRÈS le montage (voir `I18nProvider`).
 */
export const DEFAULT_LANGUAGE: LanguageCode = 'fr'
export const STORAGE_KEY = 'todo.lang'

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      fr: { translation: fr },
      en: { translation: en }
    },
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    interpolation: { escapeValue: false }, // React échappe déjà
    react: { useSuspense: false }
  })
}

/** Langue préférée : localStorage, sinon celle du navigateur. */
export function detectLanguage(): LanguageCode {
  if (typeof window === 'undefined') return DEFAULT_LANGUAGE
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved && LANGUAGES.some((l) => l.code === saved)) return saved as LanguageCode
  const nav = window.navigator.language.slice(0, 2).toLowerCase()
  return (LANGUAGES.find((l) => l.code === nav)?.code ?? DEFAULT_LANGUAGE) as LanguageCode
}

export function setLanguage(code: LanguageCode) {
  window.localStorage.setItem(STORAGE_KEY, code)
  void i18n.changeLanguage(code)
  document.documentElement.lang = code
}

export default i18n
