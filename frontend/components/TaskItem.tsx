/** Une tâche dans la liste : case à cocher, badges, sous-tâches, actions. */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../lib/api'
import { href } from '../lib/links'
import { useTodos } from '../lib/store'
import { DueBadge, PriorityBadge, StatusBadge, TagChip } from './ui'

export function TaskItem({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { t } = useTranslation()
  const { toggleTask, updateTask, deleteTask, projects } = useTodos()
  const [showSubtasks, setShowSubtasks] = useState(false)

  const done = task.status === 'DONE'
  const project = projects.find((p) => p.id === task.projectId)
  const subDone = task.subtasks.filter((s) => s.status === 'DONE').length

  return (
    <li className="task-enter card bg-base-100 shadow-sm transition hover:shadow-md">
      <div className="card-body flex-row items-start gap-3 p-3">
        <div
          className="project-stripe self-stretch"
          style={{ backgroundColor: project?.color ?? 'transparent' }}
        />

        <input
          type="checkbox"
          className="checkbox checkbox-primary mt-0.5"
          checked={done}
          onChange={() => void toggleTask(task.id)}
          aria-label={task.title}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className={`text-left font-medium hover:underline ${done ? 'task-done-title' : ''}`}
              onClick={() => onEdit(task)}
            >
              {task.title}
            </button>
            {task.dueAt && <DueBadge dueAt={task.dueAt} overdue={task.overdue} />}
            <PriorityBadge priority={task.priority} />
            {task.status === 'IN_PROGRESS' && <StatusBadge status={task.status} />}
            {task.tags.map((tag) => (
              <TagChip key={tag.id} tag={tag} />
            ))}
          </div>

          {task.notes && (
            <p className="mt-1 line-clamp-2 text-sm opacity-60">{task.notes}</p>
          )}

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs opacity-60">
            {project && (
              <a href={href(`/project?id=${project.id}`)} className="hover:underline">
                {project.emoji} {project.name}
              </a>
            )}
            {task.subtasks.length > 0 && (
              <button className="hover:underline" onClick={() => setShowSubtasks((s) => !s)}>
                {showSubtasks ? '▾' : '▸'}{' '}
                {t('task.subtaskProgress', { done: subDone, total: task.subtasks.length })}
              </button>
            )}
          </div>

          {showSubtasks && task.subtasks.length > 0 && (
            <ul className="mt-2 space-y-1 border-l border-base-300 pl-3">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={s.status === 'DONE'}
                    onChange={() => void toggleTask(s.id)}
                  />
                  <span className={s.status === 'DONE' ? 'task-done-title' : ''}>{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          {!done && (
            <button
              className="btn btn-ghost btn-xs"
              title={t('status.IN_PROGRESS')}
              onClick={() =>
                void updateTask(task.id, {
                  status: task.status === 'IN_PROGRESS' ? 'TODO' : 'IN_PROGRESS'
                })
              }
            >
              {task.status === 'IN_PROGRESS' ? '⏸️' : '▶️'}
            </button>
          )}
          <button className="btn btn-ghost btn-xs" title={t('task.edit')} onClick={() => onEdit(task)}>
            ✏️
          </button>
          <button
            className="btn btn-ghost btn-xs text-error"
            title={t('task.delete')}
            onClick={() => {
              if (window.confirm(t('task.deleteConfirm', { title: task.title })))
                void deleteTask(task.id)
            }}
          >
            🗑️
          </button>
        </div>
      </div>
    </li>
  )
}
