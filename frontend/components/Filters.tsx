/** Barre de filtres : recherche, statut, priorité, étiquettes, tri. */
import { useTranslation } from 'react-i18next'
import { countActiveFilters, useTodos } from '../lib/store'
import type { Priority, TaskSort, TaskStatus } from '../lib/api'
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

export function Filters() {
  const { t } = useTranslation()
  const { filters, setFilters, resetFilters, tags } = useTodos()
  const active = countActiveFilters(filters)

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="input input-sm flex-1 min-w-48 items-center gap-2">
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
            className="select select-sm w-48"
            value={filters.sort}
            onChange={(e) => setFilters({ sort: e.target.value as TaskSort })}
          >
            {SORTS.map((s) => (
              <option key={s} value={s}>
                {t('sort.label')} : {t(`sort.${s}`)}
              </option>
            ))}
          </select>

          <label className="label cursor-pointer gap-2 text-sm">
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-error"
              checked={filters.overdueOnly}
              onChange={(e) => setFilters({ overdueOnly: e.target.checked })}
            />
            {t('filter.overdueOnly')}
          </label>

          {active > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={resetFilters}>
              ✕ {t('filter.clear')} ({active})
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
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
        </div>
      </div>
    </div>
  )
}
