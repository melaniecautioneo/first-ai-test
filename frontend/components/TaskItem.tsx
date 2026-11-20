/**
 * Une tâche dans la liste.
 *
 * Hiérarchie visuelle en trois niveaux, pour que l'œil trouve vite :
 *   1. le TITRE, et l'ÉCHÉANCE alignée à droite (la colonne de dates se lit
 *      verticalement d'un coup d'œil) ;
 *   2. la ligne méta en petit et estompé : priorité, statut, projet,
 *      sous-tâches ;
 *   3. les étiquettes, en contour coloré.
 *
 * Avant, tout était rendu avec le même composant `badge` : rien ne
 * ressortait et la date se perdait au milieu des autres pastilles.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Task } from '../lib/api'
import { href } from '../lib/links'
import { useTodos } from '../lib/store'
import { DueDate, PriorityDot, TagPill } from './ui'

export function TaskItem({ task, onEdit }: { task: Task; onEdit: (t: Task) => void }) {
  const { t } = useTranslation()
  const { toggleTask, updateTask, deleteTask, projects } = useTodos()
  const [showSubtasks, setShowSubtasks] = useState(false)

  const done = task.status === 'DONE'
  const running = task.status === 'IN_PROGRESS'
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

        {/* Grille : sur grand écran la date occupe une colonne à droite (on
            lit les échéances verticalement) ; sur mobile elle passe sous le
            titre, sinon le titre se retrouve écrasé sur trois lignes. */}
        <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-3 sm:grid-cols-[1fr_auto]">
          <button
            className={`text-left font-medium break-words hover:underline sm:col-start-1 sm:row-start-1 ${
              done ? 'task-done-title' : ''
            }`}
            onClick={() => onEdit(task)}
          >
            {task.title}
          </button>

          {task.dueAt && (
            <div className="mt-0.5 sm:col-start-2 sm:row-start-1 sm:mt-0 sm:justify-self-end">
              <DueDate dueAt={task.dueAt} overdue={task.overdue} done={done} />
            </div>
          )}

          {task.notes && (
            <p className="mt-1 line-clamp-2 text-sm opacity-60 sm:col-span-2">{task.notes}</p>
          )}

          {/* Niveau 2 : la ligne méta, discrète */}
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70 sm:col-span-2">
            <PriorityDot priority={task.priority} />

            {running && (
              <span className="font-medium text-primary">▶ {t('status.IN_PROGRESS')}</span>
            )}

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

            {/* Niveau 3 : étiquettes */}
            {task.tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </div>

          {showSubtasks && task.subtasks.length > 0 && (
            <ul className="mt-2 space-y-1 border-l border-base-300 pl-3 sm:col-span-2">
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

        {/* Largeur figée : sans cela, les tâches terminées (sans bouton
            « démarrer ») décalent la colonne de dates et on perd la lecture
            verticale. */}
        <div className="flex w-[5.5rem] shrink-0 justify-end gap-1">
          {!done && (
            <button
              className="btn btn-ghost btn-xs"
              title={t('status.IN_PROGRESS')}
              onClick={() =>
                void updateTask(task.id, { status: running ? 'TODO' : 'IN_PROGRESS' })
              }
            >
              {running ? '⏸️' : '▶️'}
            </button>
          )}
          <button
            className="btn btn-ghost btn-xs"
            title={t('task.edit')}
            onClick={() => onEdit(task)}
          >
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
