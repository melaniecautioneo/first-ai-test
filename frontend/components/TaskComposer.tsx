/**
 * Saisie d'une nouvelle tâche.
 *
 * Deux façons de faire, qui restent toujours d'accord entre elles :
 *   - les raccourcis écrits dans le texte : `!urgent @demain #courses`
 *   - le panneau « Détails » : statut, priorité, projet, échéance, étiquettes
 *
 * Écrire `!urgent` met à jour le sélecteur de priorité, et inversement le
 * sélecteur l'emporte si vous le changez ensuite : il n'y a qu'une seule
 * source de vérité, l'état du formulaire.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Priority, TaskStatus } from '../lib/api'
import { fromDateInput, humanDate, toDateInput } from '../lib/dates'
import { parseQuickAdd } from '../lib/quickAdd'
import { useTodos } from '../lib/store'
import { PRIORITIES, PriorityBadge, STATUSES, StatusBadge } from './ui'

export function TaskComposer({ projectId }: { projectId: number | null }) {
  const { t, i18n } = useTranslation()
  const { createTask, createTag, tags, projects, busy } = useTodos()

  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<TaskStatus>('TODO')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [project, setProject] = useState<string>(projectId ? String(projectId) : '')
  const [due, setDue] = useState('')
  const [tagIds, setTagIds] = useState<number[]>([])

  const parsed = useMemo(() => parseQuickAdd(value), [value])

  // On change de page projet -> le sélecteur suit.
  useEffect(() => {
    setProject(projectId ? String(projectId) : '')
  }, [projectId])

  // Les raccourcis tapés dans le texte alimentent les sélecteurs.
  useEffect(() => {
    if (parsed.priority) setPriority(parsed.priority)
  }, [parsed.priority])
  useEffect(() => {
    if (parsed.dueAt) setDue(toDateInput(parsed.dueAt))
  }, [parsed.dueAt])

  const selectedProject = projects.find((p) => String(p.id) === project)
  const chosenTags = tags.filter((g) => tagIds.includes(g.id))

  const reset = () => {
    setValue('')
    setStatus('TODO')
    setPriority('MEDIUM')
    setDue('')
    setTagIds([])
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parsed.title) return

    // Étiquettes : celles cochées + celles citées avec # (créées si besoin).
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
    reset()
  }

  return (
    <form onSubmit={submit} className="card bg-base-100 shadow-sm">
      <div className="card-body gap-2 p-3">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={t('task.newPlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <button
            type="button"
            className={`btn ${open ? 'btn-active' : ''}`}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? '▴' : '▾'} <span className="hidden sm:inline">{t('task.details')}</span>
          </button>
          <button className="btn btn-primary" disabled={busy || !parsed.title}>
            ➕ <span className="hidden sm:inline">{t('task.add')}</span>
          </button>
        </div>

        {open && (
          <div className="grid gap-3 rounded-box bg-base-200/60 p-3 sm:grid-cols-2 lg:grid-cols-4">
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

            <div className="sm:col-span-2 lg:col-span-4">
              <span className="label-text text-xs opacity-70">{t('task.tags')}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {tags.length === 0 && (
                  <span className="text-xs opacity-60">{t('common.none')}</span>
                )}
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
          </div>
        )}

        {/* Récapitulatif de ce qui sera enregistré. */}
        <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
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
            <span key={g.id} className="badge badge-sm border-0 text-white" style={{ backgroundColor: g.color }}>
              {g.name}
            </span>
          ))}
          {parsed.tagNames
            .filter((n) => !chosenTags.some((g) => g.name.toLowerCase() === n))
            .map((n) => (
              <span key={n} className="badge badge-sm badge-ghost">
                #{n}
              </span>
            ))}
          <span className="ml-auto hidden md:inline">
            <code className="kbd kbd-xs">!urgent</code> · <code className="kbd kbd-xs">@demain</code> ·{' '}
            <code className="kbd kbd-xs">#tag</code>
          </span>
        </div>
      </div>
    </form>
  )
}
