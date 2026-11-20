/**
 * Barre latérale : navigation, projets, création de projet.
 *
 * Objectif de présentation : qu'on VOIE que les lignes sont cliquables, sans
 * avoir à les survoler au hasard.
 *   - chaque ligne est une zone arrondie qui réagit au survol (fond + léger
 *     décalage) et au clavier (anneau de focus) ;
 *   - un chevron « › » apparaît au survol ;
 *   - la page courante est nettement marquée (fond plein, texte gras,
 *     barre d'accent à gauche) ;
 *   - un projet affiche son avancement, pas juste un pourcentage isolé.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageContext } from 'vike-react/usePageContext'
import { href, isCurrent, projectIdFromUrl } from '../lib/links'
import { useTodos } from '../lib/store'

const COLORS = ['#570df8', '#f000b8', '#37cdbe', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6']
const EMOJIS = ['📁', '💼', '🏡', '📚', '🚀', '🎯', '🛠️', '🎨', '💡', '🧘']

/** Classes communes à toutes les lignes cliquables du menu. */
const ROW =
  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ' +
  'hover:bg-base-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none'

const ROW_ACTIVE = 'bg-base-100 font-semibold shadow-sm'

/** Petit chevron qui apparaît au survol : signale « ceci mène quelque part ». */
function Chevron() {
  return (
    <span
      aria-hidden
      className="w-2 shrink-0 text-base-content/40 opacity-0 transition-opacity group-hover:opacity-100"
    >
      ›
    </span>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { projects, createProject, busy } = useTodos()
  const pageContext = usePageContext()
  const current = pageContext.urlPathname
  // `isCurrent` ignore la query : sans cet id, TOUS les projets seraient
  // marqués actifs dès qu'on est sur une page projet.
  const currentProjectId = projectIdFromUrl(pageContext)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [emoji, setEmoji] = useState(EMOJIS[0])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    await createProject({ name: name.trim(), color, emoji })
    setName('')
    setOpen(false)
  }

  const rowClass = (path: string) => `${ROW} ${isCurrent(current, path) ? ROW_ACTIVE : ''}`

  return (
    <aside className="flex h-full w-72 flex-col gap-1 bg-base-200 p-3">
      <a
        href={href('/')}
        className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xl font-bold transition-colors hover:bg-base-300"
      >
        <span aria-hidden>✅</span>
        {t('app.title')}
      </a>

      <nav className="flex flex-col gap-0.5">
        {[
          { path: '/', icon: '🏠', label: t('nav.dashboard') },
          { path: '/settings', icon: '⚙️', label: t('nav.settings') }
        ].map((item) => {
          const active = isCurrent(current, item.path)
          return (
            <a
              key={item.path}
              href={href(item.path)}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={rowClass(item.path)}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 left-0 w-1 rounded-full bg-primary"
                />
              )}
              <span aria-hidden className="w-5 text-center">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              <Chevron />
            </a>
          )
        })}
      </nav>

      <div className="mt-3 mb-1 flex items-center justify-between px-3">
        <span className="text-xs font-semibold tracking-wide uppercase opacity-50">
          {t('nav.projects')}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          title={t('project.new')}
          aria-label={t('project.new')}
          onClick={() => setOpen(true)}
        >
          ＋
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
        {projects.length === 0 && (
          <p className="px-3 py-2 text-sm opacity-60">{t('project.empty')}</p>
        )}
        {projects.map((p) => {
          const path = `/project?id=${p.id}`
          const active = currentProjectId === p.id
          const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0
          return (
            <a
              key={p.id}
              href={href(path)}
              onClick={onNavigate}
              title={`${p.name} — ${p.doneCount}/${p.taskCount}`}
              className={`${ROW} ${active ? ROW_ACTIVE : ''}`}
            >
              <span
                aria-hidden
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm"
                style={{ backgroundColor: `${p.color}26` }}
              >
                {p.emoji}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate">{p.name}</span>
                <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-base-300">
                  <span
                    className="block h-full rounded-full transition-[width]"
                    style={{ width: `${pct}%`, backgroundColor: p.color }}
                  />
                </span>
              </span>

              <span className="shrink-0 text-xs tabular-nums opacity-50">
                {p.doneCount}/{p.taskCount}
              </span>
              <Chevron />
            </a>
          )
        })}
      </div>

      {open ? (
        <form onSubmit={submit} className="rounded-box bg-base-100 p-3 shadow">
          <input
            autoFocus
            className="input input-sm w-full"
            placeholder={t('project.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                className={`btn btn-xs ${emoji === e ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setEmoji(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={`h-5 w-5 rounded-full ${color === c ? 'ring-2 ring-base-content ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary btn-sm flex-1" disabled={busy || !name.trim()}>
              {t('project.create')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              {t('task.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-outline btn-sm" onClick={() => setOpen(true)}>
          ➕ {t('project.new')}
        </button>
      )}
    </aside>
  )
}
