/** Champ de saisie rapide : titre + syntaxe !priorité @date #étiquette. */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useTodos } from '../lib/store'
import { parseQuickAdd } from '../lib/quickAdd'
import { humanDate } from '../lib/dates'
import { PriorityBadge } from './ui'

export function TaskComposer({ projectId }: { projectId: number | null }) {
  const { t, i18n } = useTranslation()
  const { createTask, createTag, tags, busy } = useTodos()
  const [value, setValue] = useState('')

  const parsed = useMemo(() => parseQuickAdd(value), [value])
  const hasHints = parsed.priority || parsed.dueAt || parsed.tagNames.length > 0

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed.title) return

    // Les étiquettes citées avec # sont créées si elles n'existent pas.
    const tagIds: number[] = []
    for (const name of parsed.tagNames) {
      const existing = tags.find((tg) => tg.name.toLowerCase() === name)
      if (existing) tagIds.push(existing.id)
      else {
        const created = await createTag(name, '#64748b')
        if (created) tagIds.push(created.id)
      }
    }

    await createTask({
      title: parsed.title,
      projectId,
      priority: parsed.priority ?? 'MEDIUM',
      dueAt: parsed.dueAt,
      tagIds
    })
    setValue('')
  }

  return (
    <form onSubmit={submit} className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={t('task.newPlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button className="btn btn-primary" disabled={busy || !parsed.title}>
            ➕ {t('task.add')}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
          {hasHints ? (
            <>
              {parsed.priority && <PriorityBadge priority={parsed.priority} />}
              {parsed.dueAt && (
                <span className="badge badge-sm badge-ghost">
                  📅 {humanDate(parsed.dueAt, t, i18n.language)}
                </span>
              )}
              {parsed.tagNames.map((n) => (
                <span key={n} className="badge badge-sm badge-ghost">
                  #{n}
                </span>
              ))}
            </>
          ) : (
            <span>
              <code className="kbd kbd-xs">!urgent</code> · <code className="kbd kbd-xs">@demain</code>{' '}
              · <code className="kbd kbd-xs">@+3d</code> · <code className="kbd kbd-xs">#tag</code>
            </span>
          )}
        </div>
      </div>
    </form>
  )
}
