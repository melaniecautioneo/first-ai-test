/**
 * Popin de tâche — UNE seule pour la création et la modification.
 *
 * Pourquoi une seule : avant, la création et l'édition étaient deux
 * formulaires distincts, et la popin d'édition ne reprenait pas les codes
 * graphiques du tableau de bord. Ici, les deux modes partagent la même mise
 * en page et réutilisent les composants de la liste (`DueDate`,
 * `PriorityDot`, `TagPill`, bandeau de couleur du projet) : ce qu'on voit
 * dans la popin ressemble à ce qu'on verra dans la liste.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Priority, Task, TaskStatus } from '../lib/api'
import { fromDateInput, fullDate, toDateInput } from '../lib/dates'
import { parseQuickAdd } from '../lib/quickAdd'
import { useTodos } from '../lib/store'
import { DueDate, PRIORITIES, PriorityDot, STATUSES, TagPill } from './ui'

export function TaskDialog({
  task,
  projectId,
  onClose
}: {
  /** Fournie = modification ; absente = création. */
  task?: Task | null
  projectId: number | null
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const { createTask, updateTask, deleteTask, toggleTask, createTag, tags, projects, busy } =
    useTodos()
  const titleRef = useRef<HTMLInputElement>(null)
  const editing = Boolean(task)

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'TODO')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'MEDIUM')
  const [project, setProject] = useState<string>(
    task?.projectId != null ? String(task.projectId) : projectId != null ? String(projectId) : ''
  )
  const [due, setDue] = useState(toDateInput(task?.dueAt ?? null))
  const [tagIds, setTagIds] = useState<number[]>(task?.tags.map((g) => g.id) ?? [])
  const [newSubtask, setNewSubtask] = useState('')

  // En création seulement : `!urgent @demain #tag` pilote les champs.
  // En modification on ne touche pas au titre, sinon un titre contenant
  // « # » ou « ! » serait amputé.
  const parsed = useMemo(
    () => (editing ? null : parseQuickAdd(title)),
    [title, editing]
  )
  const effectiveTitle = (parsed ? parsed.title : title).trim()

  useEffect(() => {
    titleRef.current?.focus()
  }, [])
  useEffect(() => {
    if (parsed?.priority) setPriority(parsed.priority)
  }, [parsed?.priority])
  useEffect(() => {
    if (parsed?.dueAt) setDue(toDateInput(parsed.dueAt))
  }, [parsed?.dueAt])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const selectedProject = projects.find((p) => String(p.id) === project)
  const chosenTags = tags.filter((g) => tagIds.includes(g.id))
  const dueIso = due ? fromDateInput(due) : null
  const overdue = Boolean(dueIso && status !== 'DONE' && new Date(dueIso).getTime() < Date.now())

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!effectiveTitle) return

    const ids = [...tagIds]
    for (const name of parsed?.tagNames ?? []) {
      const existing = tags.find((tg) => tg.name.toLowerCase() === name)
      if (existing) {
        if (!ids.includes(existing.id)) ids.push(existing.id)
      } else {
        const created = await createTag(name, '#64748b')
        if (created && !ids.includes(created.id)) ids.push(created.id)
      }
    }

    if (task) {
      await updateTask(task.id, {
        title: effectiveTitle,
        notes,
        status,
        priority,
        dueAt: dueIso,
        clearDueAt: !due,
        projectId: project ? Number(project) : null,
        clearProject: !project,
        tagIds: ids
      })
    } else {
      await createTask({
        title: effectiveTitle,
        notes: notes || null,
        projectId: project ? Number(project) : null,
        status,
        priority,
        dueAt: dueIso,
        tagIds: ids
      })
    }
    onClose()
  }

  const addSubtask = async () => {
    if (!task || !newSubtask.trim()) return
    await createTask({
      title: newSubtask.trim(),
      parentId: task.id,
      projectId: task.projectId
    })
    setNewSubtask('')
  }

  return (
    <div className="modal modal-open" role="dialog">
      <div className="modal-box max-w-2xl p-0">
        {/* En-tête : même bandeau de couleur de projet que dans la liste. */}
        <div className="flex items-start gap-3 border-b border-base-300 p-4">
          <div
            className="project-stripe self-stretch"
            style={{ backgroundColor: selectedProject?.color ?? 'transparent' }}
          />
          {task && (
            <input
              type="checkbox"
              className="checkbox checkbox-primary mt-1"
              checked={status === 'DONE'}
              onChange={() => {
                setStatus(status === 'DONE' ? 'TODO' : 'DONE')
              }}
              aria-label={t('status.DONE')}
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs tracking-wide uppercase opacity-50">
              {editing ? t('task.edit') : t('task.new')}
            </p>
            <input
              ref={titleRef}
              className={`input input-ghost w-full px-0 text-lg font-medium focus:px-3 ${
                status === 'DONE' ? 'task-done-title' : ''
              }`}
              placeholder={t('task.newPlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 p-4">
          <label className="form-control">
            <span className="label-text text-xs opacity-70">{t('task.notes')}</span>
            <textarea
              className="textarea h-20 w-full"
              placeholder={t('task.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.status')}</span>
              <select
                className="select select-sm w-full"
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
                className="select select-sm w-full"
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
              <span className="label-text text-xs opacity-70">{t('task.project')}</span>
              <select
                className="select select-sm w-full"
                value={project}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">{t('nav.inbox')}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span className="label-text text-xs opacity-70">{t('task.due')}</span>
              <input
                type="date"
                className="input input-sm w-full"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </label>
          </div>

          <div>
            <span className="label-text text-xs opacity-70">{t('task.tags')}</span>
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.length === 0 && <span className="text-xs opacity-60">{t('common.none')}</span>}
              {tags.map((tag) => {
                const on = tagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    className={`rounded-full border px-2 py-0.5 text-xs transition ${
                      on ? 'text-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{
                      color: on ? '#fff' : tag.color,
                      borderColor: tag.color,
                      backgroundColor: on ? tag.color : 'transparent'
                    }}
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

          {task && (
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
                      type="button"
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
                <button type="button" className="btn btn-sm" onClick={() => void addSubtask()}>
                  ➕
                </button>
              </div>
            </div>
          )}

          {/* Aperçu : exactement le rendu de la liste. */}
          <div className="rounded-box bg-base-200/60 p-3">
            <p className="mb-2 text-xs tracking-wide uppercase opacity-50">
              {t('task.preview')}
            </p>
            <div className="flex items-start gap-3">
              <div
                className="project-stripe self-stretch"
                style={{ backgroundColor: selectedProject?.color ?? 'transparent' }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-3">
                  <span
                    className={`min-w-0 flex-1 font-medium break-words ${
                      status === 'DONE' ? 'task-done-title' : ''
                    }`}
                  >
                    {effectiveTitle || t('task.newPlaceholder')}
                  </span>
                  {dueIso && (
                    <DueDate dueAt={dueIso} overdue={overdue} done={status === 'DONE'} />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-70">
                  <PriorityDot priority={priority} />
                  {status === 'IN_PROGRESS' && (
                    <span className="font-medium text-primary">▶ {t('status.IN_PROGRESS')}</span>
                  )}
                  {selectedProject && (
                    <span>
                      {selectedProject.emoji} {selectedProject.name}
                    </span>
                  )}
                  {chosenTags.map((g) => (
                    <TagPill key={g.id} tag={g} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {task && (
            <p className="text-xs opacity-50">
              {t('task.created', { date: fullDate(task.createdAt, i18n.language) })}
              {task.completedAt &&
                ` · ${t('task.completedOn', { date: fullDate(task.completedAt, i18n.language) })}`}
            </p>
          )}

          <div className="modal-action mt-0">
            {task && (
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm mr-auto"
                onClick={() => {
                  if (window.confirm(t('task.deleteConfirm', { title: task.title }))) {
                    void deleteTask(task.id)
                    onClose()
                  }
                }}
              >
                🗑️ {t('task.delete')}
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {t('task.cancel')}
            </button>
            <button className="btn btn-primary" disabled={busy || !effectiveTitle}>
              {editing ? t('task.save') : `➕ ${t('task.add')}`}
            </button>
          </div>
        </form>
      </div>
      <button className="modal-backdrop" onClick={onClose} aria-label={t('common.close')} />
    </div>
  )
}
