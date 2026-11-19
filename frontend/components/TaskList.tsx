/** Liste des tâches + ouverture de la fenêtre d'édition. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../lib/api'
import { countActiveFilters, useTodos } from '../lib/store'
import { TaskItem } from './TaskItem'
import { TaskModal } from './TaskModal'
import { EmptyState, ErrorBanner, Spinner } from './ui'

export function TaskList() {
  const { t } = useTranslation()
  const { tasks, loading, error, reload, filters } = useTodos()
  const [editingId, setEditingId] = useState<number | null>(null)

  const editing: Task | null = tasks.find((x) => x.id === editingId) ?? null

  // Les données viennent du stockage local : une erreur de synchronisation
  // ne doit JAMAIS empêcher d'afficher ni de modifier ses tâches.
  if (loading) return <Spinner />

  return (
    <>
      {error && <ErrorBanner message={error} onRetry={() => void reload()} />}

      {tasks.length === 0 ? (
        <EmptyState filtered={countActiveFilters(filters) > 0} />
      ) : (
        <>
          <p className="px-1 text-sm opacity-60">{t('task.count', { count: tasks.length })}</p>
          <ul className="space-y-2">
            {tasks.map((task) => (
              <TaskItem key={task.id} task={task} onEdit={(x) => setEditingId(x.id)} />
            ))}
          </ul>
        </>
      )}

      <TaskModal task={editing} onClose={() => setEditingId(null)} />
    </>
  )
}
