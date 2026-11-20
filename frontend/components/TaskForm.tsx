/**
 * Formulaire de création d'une tâche, affiché dans une popin.
 *
 * Deux façons de saisir, toujours d'accord entre elles :
 *   - les raccourcis dans le titre : `!urgent @demain #courses`
 *   - les champs : statut, priorité, projet, échéance, étiquettes
 *
 * Écrire `!urgent` déplace le sélecteur de priorité : l'état du formulaire
 * reste la seule source de vérité.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Priority, TaskStatus } from '../lib/api'
import { fromDateInput, humanDate, toDateInput } from '../lib/dates'
import { parseQuickAdd } from '../lib/quickAdd'
import { useTodos } from '../lib/store'
import { PRIORITIES, PriorityBadge, STATUSES, StatusBadge } from './ui'

export function TaskForm({
  projectId,
  onDone
}: {
  projectId: number | null
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const { createTask, createTag, tags, projects, busy } = useTodos()
  const titleRef = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState('')
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [project, setProject] = useState<string>(projectId ? String(projectId) : '')
  const [due, setDue] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])

  const parsed = useMemo(() => parseQuickAdd(value), [value])

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  // Les raccourcis tapés dans le titre alimentent les champs.
  useEffect(() => {
    if (parsed.priority) setPriority(parsed.priority)
  }, [parsed.priority])
  useEffect(() => {
    if (parsed.dueAt) setDue(toDateInput(parsed.dueAt))
  }, [parsed.dueAt])

  const selectedProject = projects.find((p) => String(p.id) === project)
  const chosenTags = tags.filter((g) => tagIds.includes(g.id))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed.title) return

    // Étiquettes cochées + celles citées avec # (créées si besoin).
    const ids = [...tagIds]
    for (const name of parsed.tagNames) {
      const existing = tags.find((tg) => tg.name.toLowerCase() === name)
      if (existing) {
        if (!ids.includes(existing.id)) ids.push(existing.id)
      } else {
        const created = await createTag(name, '#64748b')
        if (created && !ids.includes(created.id)) ids.push(created.id)
      }
    }

    await createTask({
      title: parsed.title,
      projectId: project ? Number(project) : null,
      status,
      priority,
      dueAt: due ? fromDateInput(due) : null,
      tagIds: ids
    })
    onDone()
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <input
        ref={titleRef}
        className="input input-lg w-full"
        placeholder={t('task.newPlaceholder')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />

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
                className={`badge badge-sm cursor-pointer ${on ? 'border-0 text-white' : 'badge-outline'}`}
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

      {/* Récapitulatif de ce qui sera enregistré. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-base-300 pt-3 text-xs opacity-70">
        <PriorityBadge priority={priority} />
        {status !== 'TODO' && <StatusBadge status={status} />}
        {due && (
          <span className="badge badge-sm badge-ghost">
            📅 {humanDate(fromDateInput(due) ?? due, t, i18n.language)}
          </span>
        )}
        {selectedProject && (
          <span className="badge badge-sm badge-ghost">
            {selectedProject.emoji} {selectedProject.name}
          </span>
        )}
        {chosenTags.map((g) => (
          <span
            key={g.id}
            className="badge badge-sm border-0 text-white"
            style={{ backgroundColor: g.color }}
          >
            {g.name}
          </span>
        ))}
        <span className="ml-auto hidden md:inline">
          <code className="kbd kbd-xs">!urgent</code> · <code className="kbd kbd-xs">@demain</code> ·{' '}
          <code className="kbd kbd-xs">#tag</code>
        </span>
      </div>

      <div className="modal-action mt-0">
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          {t('task.cancel')}
        </button>
        <button className="btn btn-primary" disabled={busy || !parsed.title}>
          ➕ {t('task.add')}
        </button>
      </div>
    </form>
  )
}
