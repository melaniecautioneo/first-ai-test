import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { API_URL } from '../../lib/api'
import { LANGUAGES, setLanguage, type LanguageCode } from '../../lib/i18n'
import { useTodos } from '../../lib/store'
import { THEMES, useTheme, type Theme } from '../../components/Providers'
import { TagChip } from '../../components/ui'

const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#64748b']

/** Réglages : langue, thème, étiquettes, maintenance. */
export default function Page() {
  const { t, i18n } = useTranslation()
  const [theme, setTheme] = useTheme()
  const { tags, createTag, deleteTag, deleteCompleted, busy, sync, syncNow, resetLocalData } =
    useTodos()
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(TAG_COLORS[0])
  const [message, setMessage] = useState<string | null>(null)

  /** Télécharge une sauvegarde JSON des données du navigateur. */
  const exportJson = () => {
    const raw = window.localStorage.getItem('todo.state.v1') ?? '{}'
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `todo-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">🌍 {t('settings.language')}</h2>
          <div className="join">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                className={`btn join-item btn-sm ${i18n.language === l.code ? 'btn-primary' : ''}`}
                onClick={() => setLanguage(l.code as LanguageCode)}
              >
                {l.flag} {l.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">🎨 {t('settings.theme')}</h2>
          <div className="flex flex-wrap gap-2">
            {THEMES.map((th) => (
              <button
                key={th}
                data-theme={th}
                className={`btn btn-sm ${theme === th ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                onClick={() => setTheme(th as Theme)}
              >
                {th}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">🏷️ {t('tag.manage')}</h2>
          <div className="flex flex-wrap gap-2">
            {tags.length === 0 && <span className="text-sm opacity-60">{t('common.none')}</span>}
            {tags.map((tag) => (
              <TagChip
                key={tag.id}
                tag={tag}
                onRemove={() => {
                  if (window.confirm(t('tag.deleteConfirm', { name: tag.name })))
                    void deleteTag(tag.id)
                }}
              />
            ))}
          </div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!tagName.trim()) return
              await createTag(tagName.trim(), tagColor)
              setTagName('')
            }}
          >
            <input
              className="input input-sm w-48"
              placeholder={t('tag.name')}
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
            />
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                className={`h-5 w-5 rounded-full ${tagColor === c ? 'ring-2 ring-base-content ring-offset-2' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setTagColor(c)}
              />
            ))}
            <button className="btn btn-sm btn-primary" disabled={busy || !tagName.trim()}>
              {t('tag.new')}
            </button>
          </form>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">🧹 {t('settings.cleanup')}</h2>
          <button
            className="btn btn-outline btn-error btn-sm w-fit"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm(t('settings.deleteCompletedConfirm'))) return
              const n = await deleteCompleted(null)
              setMessage(t('settings.deletedCount', { count: n }))
            }}
          >
            {t('settings.deleteCompleted')}
          </button>
          {message && <p className="text-sm opacity-70">{message}</p>}
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">🔄 {t('sync.title')}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <span className="badge badge-lg">{t(`sync.${sync.status}`)}</span>
            <span className="text-sm opacity-70">
              {sync.pending > 0 ? t('sync.pending', { count: sync.pending }) : t('sync.upToDate')}
            </span>
            <button
              className="btn btn-sm"
              disabled={!sync.enabled || sync.status === 'syncing'}
              onClick={() => void syncNow()}
            >
              {t('sync.now')}
            </button>
          </div>
          <p className="text-xs opacity-60">
            {t('sync.last', {
              date: sync.lastSyncAt
                ? new Date(sync.lastSyncAt).toLocaleString(i18n.language)
                : t('sync.never')
            })}
          </p>
          {!sync.enabled && <p className="text-xs opacity-60">{t('sync.localOnly')}</p>}
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 p-4">
          <h2 className="card-title text-base">💾 {t('data.title')}</h2>
          <p className="text-sm opacity-70">{t('data.storage')}</p>
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-sm" onClick={exportJson}>
              ⬇️ {t('data.export')}
            </button>
            <button
              className="btn btn-outline btn-error btn-sm"
              onClick={() => {
                if (window.confirm(t('data.resetConfirm'))) resetLocalData()
              }}
            >
              ♻️ {t('data.reset')}
            </button>
          </div>
        </div>
      </section>

      <section className="card bg-base-100 shadow-sm">
        <div className="card-body gap-1 p-4">
          <h2 className="card-title text-base">🔌 {t('settings.api')}</h2>
          <code className="text-sm opacity-80">{API_URL || '—'}</code>
          <p className="text-xs opacity-60">{t('settings.apiHint')}</p>
        </div>
      </section>
    </div>
  )
}
