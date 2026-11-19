/** Tuiles de statistiques + barre d'avancement. */
import { useTranslation } from 'react-i18next'
import { useTodos } from '../lib/store'

export function Stats() {
  const { t } = useTranslation()
  const { stats } = useTodos()
  if (!stats) return null

  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0

  const tiles = [
    { label: t('stats.todo'), value: stats.todo, cls: '' },
    { label: t('stats.inProgress'), value: stats.inProgress, cls: 'text-primary' },
    { label: t('stats.dueToday'), value: stats.dueToday, cls: 'text-warning' },
    { label: t('stats.overdue'), value: stats.overdue, cls: 'text-error' },
    { label: t('stats.completedThisWeek'), value: stats.completedThisWeek, cls: 'text-success' }
  ]

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-box bg-base-200 px-3 py-2">
              <div className="text-xs opacity-60">{tile.label}</div>
              <div className={`text-2xl font-bold ${tile.cls}`}>{tile.value}</div>
            </div>
          ))}
        </div>
        <div>
          <div className="mb-1 flex justify-between text-xs opacity-70">
            <span>{t('stats.progress')}</span>
            <span>
              {stats.done}/{stats.total} · {pct}%
            </span>
          </div>
          <progress className="progress progress-primary w-full" value={pct} max={100} />
        </div>
      </div>
    </div>
  )
}
