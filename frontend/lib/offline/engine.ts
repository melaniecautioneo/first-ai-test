/**
 * MOTEUR LOCAL
 * ============
 *
 * Reproduit côté navigateur exactement ce que fait le backend Rust :
 * créer/modifier/supprimer, filtrer, trier, calculer les statistiques.
 *
 * Toutes les fonctions sont PURES : elles reçoivent un état et en renvoient un
 * nouveau, sans rien modifier sur place. C'est ce qui permet à React de
 * détecter les changements et de réafficher.
 *
 * Chaque écriture ajoute aussi une "opération" dans l'outbox (la file
 * d'attente), qui sera rejouée sur le serveur à la prochaine synchronisation.
 */
import type { Priority, Project, Stats, Tag, Task, TaskSort, TaskStatus } from '../api'
import { newOpId, type LocalState, type Op, type StoredTask } from './state'

export interface QueryInput {
  projectId: number | null
  search: string
  statuses: TaskStatus[]
  priorities: Priority[]
  tagIds: number[]
  overdueOnly: boolean
  sort: TaskSort
}

const nowIso = () => new Date().toISOString()

function takeId(state: LocalState): [number, LocalState] {
  const id = state.nextLocalId
  return [id, { ...state, nextLocalId: id - 1 }]
}

function queue(state: LocalState, op: Omit<Op, 'opId' | 'ts'>): LocalState {
  return {
    ...state,
    outbox: [...state.outbox, { ...op, opId: newOpId(), ts: nowIso() }]
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Transforme une tâche stockée en tâche "API" (avec ses étiquettes et sous-tâches). */
export function toApiTask(state: LocalState, t: StoredTask): Task {
  const overdue =
    t.status !== 'DONE' && t.dueAt !== null && new Date(t.dueAt).getTime() < Date.now()
  return {
    id: t.id,
    projectId: t.projectId,
    parentId: t.parentId,
    title: t.title,
    notes: t.notes,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt,
    overdue,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    tags: t.tagIds
      .map((id) => state.tags.find((g) => g.id === id))
      .filter((g): g is Tag => Boolean(g))
      .sort((a, b) => a.name.localeCompare(b.name)),
    subtasks: state.tasks
      .filter((s) => s.parentId === t.id)
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((s) => ({ id: s.id, title: s.title, status: s.status }))
  }
}

/** Les projets, avec leurs compteurs (comme les résolveurs Rust `taskCount`/`doneCount`). */
export function projectsWithCounts(state: LocalState): Project[] {
  return state.projects
    .filter((p) => !p.archived)
    .map((p) => ({
      ...p,
      taskCount: state.tasks.filter((t) => t.projectId === p.id).length,
      doneCount: state.tasks.filter((t) => t.projectId === p.id && t.status === 'DONE').length
    }))
}

const PRIORITY_RANK: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

/** Filtre + trie, exactement comme la requête `tasks` du backend. */
export function queryTasks(state: LocalState, q: QueryInput): Task[] {
  const search = q.search.trim().toLowerCase()
  const now = Date.now()

  const filtered = state.tasks.filter((t) => {
    if (t.parentId !== null) return false // seulement les tâches racines
    if (q.projectId !== null && t.projectId !== q.projectId) return false
    if (q.statuses.length && !q.statuses.includes(t.status)) return false
    if (q.priorities.length && !q.priorities.includes(t.priority)) return false
    if (q.tagIds.length && !q.tagIds.some((id) => t.tagIds.includes(id))) return false
    if (search) {
      const hay = `${t.title} ${t.notes ?? ''}`.toLowerCase()
      if (!hay.includes(search)) return false
    }
    if (q.overdueOnly) {
      if (t.status === 'DONE' || !t.dueAt || new Date(t.dueAt).getTime() >= now) return false
    }
    return true
  })

  const byDue = (a: StoredTask, b: StoredTask, dir: number) => {
    if (!a.dueAt && !b.dueAt) return 0
    if (!a.dueAt) return 1 // les tâches sans échéance finissent en bas
    if (!b.dueAt) return -1
    return (new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime()) * dir
  }

  const sorted = [...filtered].sort((a, b) => {
    switch (q.sort) {
      case 'CREATED_DESC':
        return b.createdAt.localeCompare(a.createdAt)
      case 'CREATED_ASC':
        return a.createdAt.localeCompare(b.createdAt)
      case 'DUE_ASC':
        return byDue(a, b, 1)
      case 'DUE_DESC':
        return byDue(a, b, -1)
      case 'PRIORITY_DESC':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byDue(a, b, 1)
      case 'TITLE_ASC':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })
      default:
        return a.position - b.position || a.id - b.id
    }
  })

  return sorted.map((t) => toApiTask(state, t))
}

export function computeStats(state: LocalState, projectId: number | null): Stats {
  const scope = projectId === null ? state.tasks : state.tasks.filter((t) => t.projectId === projectId)
  const now = Date.now()
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)
  const weekAgo = now - 7 * 86_400_000

  const due = (t: StoredTask) => (t.dueAt ? new Date(t.dueAt).getTime() : null)

  return {
    total: scope.length,
    todo: scope.filter((t) => t.status === 'TODO').length,
    inProgress: scope.filter((t) => t.status === 'IN_PROGRESS').length,
    done: scope.filter((t) => t.status === 'DONE').length,
    overdue: scope.filter((t) => {
      const d = due(t)
      return t.status !== 'DONE' && d !== null && d < now
    }).length,
    dueToday: scope.filter((t) => {
      const d = due(t)
      return t.status !== 'DONE' && d !== null && d >= now && d <= endOfDay.getTime()
    }).length,
    completedThisWeek: scope.filter(
      (t) => t.completedAt !== null && new Date(t.completedAt).getTime() >= weekAgo
    ).length
  }
}

// ---------------------------------------------------------------------------
// Écriture — projets
// ---------------------------------------------------------------------------

export function createProject(
  state: LocalState,
  input: { name: string; color?: string; emoji?: string }
): { state: LocalState; project: Project } {
  const [id, s1] = takeId(state)
  const project: Project = {
    id,
    name: input.name.trim(),
    color: input.color ?? '#570df8',
    emoji: input.emoji ?? '📁',
    archived: false,
    taskCount: 0,
    doneCount: 0
  }
  const s2 = { ...s1, projects: [...s1.projects, project] }
  return {
    state: queue(s2, { kind: 'project.create', entityId: id, payload: { ...input, name: project.name } }),
    project
  }
}

export function updateProject(
  state: LocalState,
  id: number,
  patch: Record<string, unknown>
): LocalState {
  const s1 = {
    ...state,
    projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p))
  }
  return queue(s1, { kind: 'project.update', entityId: id, payload: patch })
}

export function deleteProject(state: LocalState, id: number): LocalState {
  const s1 = {
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    // Suppression en cascade, comme la contrainte ON DELETE CASCADE en SQL.
    tasks: state.tasks.filter((t) => t.projectId !== id)
  }
  return queue(s1, { kind: 'project.delete', entityId: id, payload: {} })
}

// ---------------------------------------------------------------------------
// Écriture — étiquettes
// ---------------------------------------------------------------------------

export function createTag(
  state: LocalState,
  name: string,
  color: string
): { state: LocalState; tag: Tag } {
  const clean = name.trim().toLowerCase()
  const existing = state.tags.find((g) => g.name === clean)
  if (existing) return { state, tag: existing }

  const [id, s1] = takeId(state)
  const tag: Tag = { id, name: clean, color }
  const s2 = { ...s1, tags: [...s1.tags, tag] }
  return {
    state: queue(s2, { kind: 'tag.create', entityId: id, payload: { name: clean, color } }),
    tag
  }
}

export function deleteTag(state: LocalState, id: number): LocalState {
  const s1 = {
    ...state,
    tags: state.tags.filter((g) => g.id !== id),
    tasks: state.tasks.map((t) =>
      t.tagIds.includes(id) ? { ...t, tagIds: t.tagIds.filter((x) => x !== id) } : t
    )
  }
  return queue(s1, { kind: 'tag.delete', entityId: id, payload: {} })
}

// ---------------------------------------------------------------------------
// Écriture — tâches
// ---------------------------------------------------------------------------

export function createTask(
  state: LocalState,
  input: {
    title: string
    notes?: string | null
    projectId?: number | null
    parentId?: number | null
    priority?: Priority
    status?: TaskStatus
    dueAt?: string | null
    tagIds?: number[]
  }
): { state: LocalState; task: StoredTask } {
  const [id, s1] = takeId(state)
  const ts = nowIso()
  const status = input.status ?? 'TODO'
  const siblings = s1.tasks.filter((t) => (t.projectId ?? null) === (input.projectId ?? null))
  const task: StoredTask = {
    id,
    projectId: input.projectId ?? null,
    parentId: input.parentId ?? null,
    title: input.title.trim(),
    notes: input.notes?.trim() ? input.notes : null,
    status,
    priority: input.priority ?? 'MEDIUM',
    dueAt: input.dueAt ?? null,
    position: siblings.length ? Math.max(...siblings.map((t) => t.position)) + 1 : 0,
    createdAt: ts,
    updatedAt: ts,
    completedAt: status === 'DONE' ? ts : null,
    tagIds: input.tagIds ?? []
  }
  const s2 = { ...s1, tasks: [...s1.tasks, task] }
  return {
    state: queue(s2, { kind: 'task.create', entityId: id, payload: { ...input, title: task.title } }),
    task
  }
}

/** `patch` suit la même sémantique que `TaskPatch` côté Rust. */
export function updateTask(
  state: LocalState,
  id: number,
  patch: Record<string, unknown>
): LocalState {
  const ts = nowIso()
  const tasks = state.tasks.map((t) => {
    if (t.id !== id) return t
    const next: StoredTask = { ...t, updatedAt: ts }
    if (typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim()
    if (typeof patch.notes === 'string') next.notes = patch.notes.trim() ? patch.notes : null
    if (typeof patch.priority === 'string') next.priority = patch.priority as Priority
    if (patch.clearProject) next.projectId = null
    else if (typeof patch.projectId === 'number') next.projectId = patch.projectId
    if (patch.clearDueAt) next.dueAt = null
    else if (typeof patch.dueAt === 'string') next.dueAt = patch.dueAt
    if (typeof patch.status === 'string') {
      const s = patch.status as TaskStatus
      next.completedAt = s === 'DONE' ? (t.completedAt ?? ts) : null
      next.status = s
    }
    if (Array.isArray(patch.tagIds)) next.tagIds = patch.tagIds as number[]
    return next
  })
  return queue({ ...state, tasks }, { kind: 'task.update', entityId: id, payload: patch })
}

/**
 * La bascule est traduite en `task.update` avec un statut ABSOLU.
 * Pourquoi : une opération rejouée deux fois doit donner le même résultat.
 * Un "toggle" rejoué deux fois reviendrait à l'état de départ — un bug.
 */
export function toggleTask(state: LocalState, id: number): LocalState {
  const current = state.tasks.find((t) => t.id === id)
  if (!current) return state
  const status: TaskStatus = current.status === 'DONE' ? 'TODO' : 'DONE'
  return updateTask(state, id, { status })
}

export function deleteTask(state: LocalState, id: number): LocalState {
  const ids = new Set<number>([id])
  // Les sous-tâches partent avec le parent.
  state.tasks.filter((t) => t.parentId === id).forEach((t) => ids.add(t.id))
  const s1 = { ...state, tasks: state.tasks.filter((t) => !ids.has(t.id)) }
  let out = s1
  for (const removed of ids) {
    out = queue(out, { kind: 'task.delete', entityId: removed, payload: {} })
  }
  return out
}

export function deleteCompleted(
  state: LocalState,
  projectId: number | null
): { state: LocalState; count: number } {
  const targets = state.tasks.filter(
    (t) => t.status === 'DONE' && (projectId === null || t.projectId === projectId)
  )
  let out = state
  for (const t of targets) out = deleteTask(out, t.id)
  return { state: out, count: targets.length }
}

export function reorderTask(state: LocalState, id: number, afterId: number | null): LocalState {
  const task = state.tasks.find((t) => t.id === id)
  if (!task) return state
  let position: number
  if (afterId === null) {
    position = Math.min(...state.tasks.map((t) => t.position), 0) - 1
  } else {
    const after = state.tasks.find((t) => t.id === afterId)
    if (!after) return state
    const next = state.tasks
      .filter((t) => t.position > after.position && t.id !== id)
      .sort((a, b) => a.position - b.position)[0]
    position = next ? (after.position + next.position) / 2 : after.position + 1
  }
  const tasks = state.tasks.map((t) => (t.id === id ? { ...t, position } : t))
  return queue({ ...state, tasks }, { kind: 'task.update', entityId: id, payload: { position } })
}
