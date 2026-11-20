/**
 * Barre d'outils compacte au-dessus de la liste :
 *
 *   [🔍 recherche] [tri] [Filtres (2)]              [+ Nouvelle tâche]
 *
 * Les filtres détaillés (statut, priorité, étiquettes) sont repliés par
 * défaut : la liste des tâches reste visible immédiatement. Le bouton « + »
 * ouvre la popin de création.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Priority, TaskSort, TaskStatus } from '../lib/api'
import { countActiveFilters, useTodos } from '../lib/store'
import { TaskForm } from './TaskForm'
import { PRIORITIES, PRIORITY_CLASS, STATUSES, STATUS_CLASS } from './ui'

const SORTS: TaskSort[] = [
  'MANUAL',
  'DUE_ASC',
  'PRIORITY_DESC',
  'CREATED_DESC',
  'CREATED_ASC',
  'TITLE_ASC'
]

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function Toolbar({ projectId }: { projectId: number | null }) {
  const { t } = useTranslation()
  const { filters, setFilters, resetFilters, tags } = useTodos()
  const [showFilters, setShowFilters] = useState(false)
  const [creating, setCreating] = useState(false)
  const active = countActiveFilters(filters)

  // Échap ferme la popin ; « n » l'ouvre (hors champ de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
      if (e.key === 'Escape') setCreating(false)
      else if (e.key === 'n' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setCreating(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {/* Mobile : la recherche prend toute la 1re ligne, le reste tient
            sur la 2e. Desktop : tout sur une seule ligne. */}
        <label className="input input-sm w-full items-center gap-2 sm:w-auto sm:max-w-xs sm:flex-1">
          <span aria-hidden className="opacity-60">
            🔍
          </span>
          <input
            type="search"
            className="grow"
            placeholder={t('filter.search')}
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
          />
        </label>

        <select
          className="select select-sm flex-1 sm:w-auto sm:flex-none"
          value={filters.sort}
          onChange={(e) => setFilters({ sort: e.target.value as TaskSort })}
          aria-label={t('sort.label')}
        >
          {SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sort.${s}`)}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`btn btn-sm shrink-0 gap-1 ${showFilters || active ? 'btn-active' : ''}`}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((s) => !s)}
        >
          ⚙️ <span className="hidden sm:inline">{t('filter.title')}</span>
          {active > 0 && <span className="badge badge-xs badge-primary">{active}</span>}
        </button>

        <button
          type="button"
          className="btn btn-primary btn-sm shrink-0 gap-1 sm:ml-auto"
          onClick={() => setCreating(true)}
          title={t('task.new')}
        >
          ➕ <span className="hidden sm:inline">{t('task.new')}</span>
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-box bg-base-100 p-3 text-xs shadow-sm">
          <div className="flex items-center gap-1">
            <span className="opacity-60">{t('filter.status')} :</span>
            {STATUSES.map((s: TaskStatus) => (
              <button
                key={s}
                className={`badge badge-sm cursor-pointer ${
                  filters.statuses.includes(s) ? STATUS_CLASS[s] : 'badge-outline'
                }`}
                onClick={() => setFilters({ statuses: toggle(filters.statuses, s) })}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <span className="opacity-60">{t('filter.priority')} :</span>
            {PRIORITIES.map((p: Priority) => (
              <button
                key={p}
                className={`badge badge-sm cursor-pointer ${
                  filters.priorities.includes(p) ? PRIORITY_CLASS[p] : 'badge-outline'
                }`}
                onClick={() => setFilters({ priorities: toggle(filters.priorities, p) })}
              >
                {t(`priority.${p}`)}
              </button>
            ))}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              <span className="opacity-60">{t('filter.tags')} :</span>
              {tags.map((tag) => {
                const on = filters.tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    className={`badge badge-sm cursor-pointer ${on ? 'border-0 text-white' : 'badge-outline'}`}
                    style={on ? { backgroundColor: tag.color } : undefined}
                    onClick={() => setFilters({ tagIds: toggle(filters.tagIds, tag.id) })}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          )}

          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="toggle toggle-xs toggle-error"
              checked={filters.overdueOnly}
              onChange={(e) => setFilters({ overdueOnly: e.target.checked })}
            />
            {t('filter.overdueOnly')}
          </label>

          {active > 0 && (
            <button className="btn btn-ghost btn-xs ml-auto" onClick={resetFilters}>
              ✕ {t('filter.clear')}
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="modal modal-open" role="dialog">
          <div className="modal-box max-w-2xl">
            <h3 className="mb-4 text-lg font-bold">➕ {t('task.new')}</h3>
            <TaskForm projectId={projectId} onDone={() => setCreating(false)} />
          </div>
          <button
            className="modal-backdrop"
            onClick={() => setCreating(false)}
            aria-label={t('common.close')}
          />
        </div>
      )}
    </>
  )
}
