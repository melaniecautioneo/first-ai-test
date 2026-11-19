/** Barre du haut : menu mobile, titre de page, langue, thème. */
import { useTranslation } from 'react-i18next'
import { usePageContext } from 'vike-react/usePageContext'
import { LANGUAGES, setLanguage, type LanguageCode } from '../lib/i18n'
import { isCurrent, projectIdFromUrl } from '../lib/links'
import { useTodos } from '../lib/store'
import { THEMES, useTheme, type Theme } from './Providers'
import { SyncBadge } from './SyncBadge'

export function Topbar() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  const { projects, busy } = useTodos()
  const pageContext = usePageContext()

  const projectId = projectIdFromUrl(pageContext)
  const project = projects.find((p) => p.id === projectId)

  const heading = project
    ? `${project.emoji} ${project.name}`
    : isCurrent(pageContext.urlPathname, '/settings')
      ? t('settings.title')
      : t('nav.allTasks')

  return (
    <div className="navbar sticky top-0 z-10 border-b border-base-300 bg-base-100/90 backdrop-blur">
      <div className="flex-none lg:hidden">
        <label htmlFor="main-drawer" className="btn btn-ghost btn-square" aria-label="menu">
          ☰
        </label>
      </div>

      <div className="flex-1 px-2">
        <h1 className="truncate text-lg font-semibold">{heading}</h1>
        {busy && <span className="loading loading-spinner loading-xs ml-2 opacity-60" />}
      </div>

      <div className="flex flex-none gap-1">
        <SyncBadge />
        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-sm">
            {LANGUAGES.find((l) => l.code === i18n.language)?.flag ?? '🌐'}
            <span className="hidden sm:inline">{i18n.language.toUpperCase()}</span>
          </button>
          <ul tabIndex={0} className="menu dropdown-content z-30 w-44 rounded-box bg-base-100 p-2 shadow">
            {LANGUAGES.map((l) => (
              <li key={l.code}>
                <button
                  className={i18n.language === l.code ? 'menu-active' : ''}
                  onClick={() => setLanguage(l.code as LanguageCode)}
                >
                  {l.flag} {l.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="dropdown dropdown-end">
          <button tabIndex={0} className="btn btn-ghost btn-sm">
            🎨 <span className="hidden sm:inline">{theme}</span>
          </button>
          <ul tabIndex={0} className="menu dropdown-content z-30 w-44 rounded-box bg-base-100 p-2 shadow">
            {THEMES.map((th) => (
              <li key={th}>
                <button
                  className={theme === th ? 'menu-active' : ''}
                  onClick={() => setTheme(th as Theme)}
                >
                  {th}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
