/**
 * Ligne de statistiques compacte (plus de grosse carte : la liste des
 * tâches doit rester visible dès l'ouverture).
 *
 * Les compteurs sont cliquables : ils appliquent le filtre correspondant.
 */
import { useTranslation } from 'react-i18next'
import type { TaskStatus } from '../lib/api'
import { useTodos } from '../lib/store'

export function Stats() {
  const { t } = useTranslation()
  const { stats, filters, setFilters } = useTodos()
  if (!stats) return null

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0
  const onlyStatus = (s: TaskStatus) => filters.statuses.length === 1 && filters.statuses[0] === s

  const byStatus = (s: TaskStatus) => () =>
    setFilters({ overdueOnly: false, statuses: onlyStatus(s) ? [] : [s] })

  const counters = [
    { key: 'todo', value: stats.todo, cls: '', on: onlyStatus('TODO'), onClick: byStatus('TODO') },
    {
      key: 'inProgress',
      value: stats.inProgress,
      cls: 'text-primary',
      on: onlyStatus('IN_PROGRESS'),
      onClick: byStatus('IN_PROGRESS')
    },
    {
      key: 'dueToday',
      value: stats.dueToday,
      cls: 'text-warning',
      on: false,
      onClick: () => setFilters({ sort: 'DUE_ASC', overdueOnly: false }),
      hideIfZero: true
    },
    {
      key: 'overdue',
      value: stats.overdue,
      cls: 'text-error',
      on: filters.overdueOnly,
      onClick: () => setFilters({ overdueOnly: !filters.overdueOnly, statuses: [] }),
      hideIfZero: true
    }
  ]

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm">
      {counters
        .filter((c) => !(c.hideIfZero && c.value === 0))
        .map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={c.onClick}
            title={t(`stats.${c.key}`)}
            className={`rounded px-1 transition hover:bg-base-300 ${c.on ? 'bg-base-300 font-medium' : ''}`}
          >
            <span className={`font-semibold ${c.cls}`}>{c.value}</span>{' '}
            <span className="opacity-60">{t(`stats.${c.key}`).toLowerCase()}</span>
          </button>
        ))}

      <div className="ml-auto flex items-center gap-2" title={t('stats.progress')}>
        <progress className="progress progress-primary h-1.5 w-20" value={pct} max={100} />
        <span className="tabular-nums opacity-60">
          {stats.done}/{stats.total}
        </span>
      </div>
    </div>
  )
}
