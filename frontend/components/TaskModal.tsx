/** Fenêtre d'édition complète d'une tâche (daisyUI modal). */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Priority, Task, TaskStatus } from '../lib/api'
import { fromDateInput, fullDate, toDateInput } from '../lib/dates'
import { useTodos } from '../lib/store'
import { PRIORITIES, STATUSES } from './ui'

export function TaskModal({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { updateTask, deleteTask, createTask, toggleTask, projects, tags, busy } = useTodos()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [due, setDue] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [tagIds, setTagIds] = useState<number[]>([])
  const [newSubtask, setNewSubtask] = useState('')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setNotes(task.notes ?? '')
    setStatus(task.status)
    setPriority(task.priority)
    setDue(toDateInput(task.dueAt))
    setProjectId(task.projectId ? String(task.projectId) : '')
    setTagIds(task.tags.map((tg) => tg.id))
    setNewSubtask('')
  }, [task])

  if (!task) return null

  const save = async () => {
    await updateTask(task.id, {
      title,
      notes,
      status,
      priority,
      dueAt: due ? fromDateInput(due) : null,
      clearDueAt: !due,
      projectId: projectId ? Number(projectId) : null,
      clearProject: !projectId,
      tagIds
    })
    onClose()
  }

  const addSubtask = async () => {
    if (!newSubtask.trim()) return
    await createTask({
      title: newSubtask.trim(),
      parentId: task.id,
      projectId: task.projectId
    })
    setNewSubtask('')
  }

  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-2xl">
        <h3 className="mb-4 text-lg font-bold">{t('task.edit')}</h3>

        <div className="grid gap-3">
          <label className="form-control">
            <span className="label-text text-xs opacity-70">{t('task.title')}</span>
            <input className="input w-full" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="form-control">
            <span className="label-text text-xs opacity-70">{t('task.notes')}</span>
            <textarea
              className="textarea h-24 w-full"
              placeholder={t('task.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.status')}</span>
              <select
                className="select w-full"
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(`status.${s}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.priority')}</span>
              <select
                className="select w-full"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.due')}</span>
              <input
                type="date"
                className="input w-full"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>

            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.project')}</span>
              <select
                className="select w-full"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
              >
                <option value="">{t('nav.inbox')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <span className="label-text text-xs opacity-70">{t('task.tags')}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.length === 0 && <span className="text-sm opacity-60">{t('common.none')}</span>}
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`badge cursor-pointer ${on ? 'border-0 text-white' : 'badge-outline'}`}
                    style={on ? { backgroundColor: tag.color } : undefined}
                    onClick={() =>
                      setTagIds((ids) =>
                        ids.includes(tag.id) ? ids.filter((i) => i !== tag.id) : [...ids, tag.id]
                      )
                    }
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <span className="label-text text-xs opacity-70">{t('task.subtasks')}</span>
            <ul className="mt-1 space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs"
                    checked={s.status === 'DONE'}
                    onChange={() => void toggleTask(s.id)}
                  />
                  <span className={`flex-1 ${s.status === 'DONE' ? 'task-done-title' : ''}`}>
                    {s.title}
                  </span>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    onClick={() => void deleteTask(s.id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                className="input input-sm flex-1"
                placeholder={t('task.subtaskPlaceholder')}
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void addSubtask()
                  }
                }}
              />
              <button className="btn btn-sm" onClick={() => void addSubtask()} disabled={busy}>
                ➕
              </button>
            </div>
          </div>

          <p className="text-xs opacity-50">
            {t('task.created', { date: fullDate(task.createdAt, i18n.language) })}
            {task.completedAt &&
              ` · ${t('task.completedOn', { date: fullDate(task.completedAt, i18n.language) })}`}
          </p>
        </div>

        <div className="modal-action">
          <button
            className="btn btn-error btn-outline btn-sm mr-auto"
            onClick={() => {
              if (window.confirm(t('task.deleteConfirm', { title: task.title }))) {
                void deleteTask(task.id)
                onClose()
              }
            }}
          >
            🗑️ {t('task.delete')}
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            {t('task.cancel')}
          </button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !title.trim()}>
            {t('task.save')}
          </button>
        </div>
      </div>
      <button className="modal-backdrop" onClick={onClose} aria-label={t('common.close')} />
    </div>
  )
}
