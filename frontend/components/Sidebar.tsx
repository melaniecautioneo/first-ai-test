/** Barre latérale : navigation, projets, création de projet. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageContext } from 'vike-react/usePageContext'
import { href, isCurrent } from '../lib/links'
import { useTodos } from '../lib/store'

const COLORS = ['#570df8', '#f000b8', '#37cdbe', '#f59e0b', '#22c55e', '#ef4444', '#3b82f6']
const EMOJIS = ['📁', '💼', '🏡', '📚', '🚀', '🎯', '🛠️', '🎨', '💡', '🧘']

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { projects, createProject, busy } = useTodos()
  const pageContext = usePageContext()
  const current = pageContext.urlPathname

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

  const link = (path: string) => (isCurrent(current, path) ? 'menu-active font-semibold' : '')

  return (
    <aside className="flex h-full w-72 flex-col gap-2 bg-base-200 p-4">
      <a href={href('/')} className="mb-2 flex items-center gap-2 px-2 text-xl font-bold">
        <span aria-hidden>✅</span>
        {t('app.title')}
      </a>

      <ul className="menu w-full gap-0.5 rounded-box p-0">
        <li>
          <a href={href('/')} className={link('/')} onClick={onNavigate}>
            🏠 {t('nav.dashboard')}
          </a>
        </li>
        <li>
          <a href={href('/settings')} className={link('/settings')} onClick={onNavigate}>
            ⚙️ {t('nav.settings')}
          </a>
        </li>
      </ul>

      <div className="divider my-1 text-xs opacity-60">{t('nav.projects')}</div>

      <ul className="menu w-full flex-1 gap-0.5 overflow-y-auto rounded-box p-0">
        {projects.length === 0 && (
          <li className="px-3 py-2 text-sm opacity-60">{t('project.empty')}</li>
        )}
        {projects.map((p) => {
          const path = `/project?id=${p.id}`
          const pct = p.taskCount ? Math.round((p.doneCount / p.taskCount) * 100) : 0
          return (
            <li key={p.id}>
              <a href={href(path)} className={link(path)} onClick={onNavigate}>
                <span aria-hidden>{p.emoji}</span>
                <span className="flex-1 truncate">{p.name}</span>
                <span className="badge badge-sm" style={{ backgroundColor: p.color, color: '#fff', border: 0 }}>
                  {pct}%
                </span>
              </a>
            </li>
          )
        })}
      </ul>

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
                className={`h-5 w-5 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-base-content' : ''}`}
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
