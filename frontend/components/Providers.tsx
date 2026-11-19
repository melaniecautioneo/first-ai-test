/**
 * Fournit la langue (i18next) et le thème daisyUI à toute l'application.
 *
 * Important pour le SSR : au premier rendu, serveur et client doivent
 * produire exactement le même HTML. On applique donc la langue/thème
 * enregistrés seulement après le montage (`useEffect`).
 */
import { useEffect, useState } from 'react'
import { I18nextProvider } from 'react-i18next'
import i18n, { detectLanguage, type LanguageCode } from '../lib/i18n'

export const THEMES = [
  'light',
  'dark',
  'cupcake',
  'nord',
  'dracula',
  'corporate',
  'synthwave'
] as const
export type Theme = (typeof THEMES)[number]
export const THEME_KEY = 'todo.theme'

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  window.localStorage.setItem(THEME_KEY, theme)
}

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>('light')
  useEffect(() => {
    const saved = window.localStorage.getItem(THEME_KEY) as Theme | null
    const initial =
      saved && THEMES.includes(saved)
        ? saved
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
    setThemeState(initial)
    applyTheme(initial)
  }, [])
  return [
    theme,
    (t: Theme) => {
      setThemeState(t)
      applyTheme(t)
    }
  ]
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [, force] = useState(0)

  useEffect(() => {
    const lang: LanguageCode = detectLanguage()
    document.documentElement.lang = lang
    if (i18n.language !== lang) {
      void i18n.changeLanguage(lang).then(() => force((n) => n + 1))
    }
    const onChange = () => force((n) => n + 1)
    i18n.on('languageChanged', onChange)
    return () => i18n.off('languageChanged', onChange)
  }, [])

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
}
