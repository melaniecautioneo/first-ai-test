/**
 * ÉTAT LOCAL (mode hors ligne)
 * ===========================
 *
 * Toute l'application lit et écrit d'abord ICI, dans le navigateur
 * (localStorage). Le serveur Rust n'est plus indispensable : il devient un
 * endroit où l'on *synchronise* les données quand il est joignable.
 *
 * Avantages : l'app démarre instantanément, fonctionne dans le métro, et peut
 * être hébergée sur GitHub Pages (qui ne sait servir que des fichiers).
 */
import type { Priority, Project, Tag, TaskStatus } from '../api'

export const STORAGE_KEY = 'todo.state.v1'
export const STATE_VERSION = 1

/** Une tâche telle qu'elle est stockée (à plat, avec des ids d'étiquettes). */
export interface StoredTask {
  id: number
  projectId: number | null
  parentId: number | null
  title: string
  notes: string | null
  status: TaskStatus
  priority: Priority
  dueAt: string | null
  position: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  tagIds: number[]
}

/** Une modification en attente d'envoi au serveur. */
export interface Op {
  /** Identifiant de l'opération (pour le dédoublonnage). */
  opId: string
  /** Horodatage de création, l'ordre de rejeu est l'ordre chronologique. */
  ts: string
  kind:
    | 'project.create'
    | 'project.update'
    | 'project.delete'
    | 'tag.create'
    | 'tag.delete'
    | 'task.create'
    | 'task.update'
    | 'task.delete'
  /** L'id local (souvent négatif) de l'entité concernée. */
  entityId: number
  payload: Record<string, unknown>
}

export interface LocalState {
  version: number
  projects: Project[]
  tags: Tag[]
  tasks: StoredTask[]
  outbox: Op[]
  /** Compteur d'ids locaux : -1, -2, -3… (le serveur, lui, utilise du positif). */
  nextLocalId: number
  lastSyncAt: string | null
}

export const EMPTY_STATE: LocalState = {
  version: STATE_VERSION,
  projects: [],
  tags: [],
  tasks: [],
  outbox: [],
  nextLocalId: -1,
  lastSyncAt: null
}

/** Un id négatif = créé hors ligne, jamais vu par le serveur. */
export const isLocalId = (id: number) => id < 0

export function newOpId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// ---------------------------------------------------------------------------
// Persistance
// ---------------------------------------------------------------------------

export function loadState(): LocalState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalState
    if (parsed.version !== STATE_VERSION) return null // migration future
    return { ...EMPTY_STATE, ...parsed }
  } catch {
    return null // données corrompues : on repart proprement
  }
}

export function saveState(state: LocalState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota dépassé : on ignore plutôt que de casser l'application.
    console.warn('[todo] impossible d’écrire dans localStorage')
  }
}

export function clearState(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
}

// ---------------------------------------------------------------------------
// Jeu de démonstration (même contenu que le seed du backend Rust)
// ---------------------------------------------------------------------------

export function demoState(): LocalState {
  const now = new Date()
  const iso = (d: Date) => d.toISOString()
  const day = (offset: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + offset)
    d.setHours(17, 0, 0, 0)
    return iso(d)
  }

  const projects: Project[] = [
    { id: -1, name: 'Travail', color: '#570df8', emoji: '💼', archived: false, taskCount: 0, doneCount: 0 },
    { id: -2, name: 'Perso', color: '#37cdbe', emoji: '🏡', archived: false, taskCount: 0, doneCount: 0 },
    { id: -3, name: 'Apprentissage', color: '#f59e0b', emoji: '📚', archived: false, taskCount: 0, doneCount: 0 }
  ]

  const tags: Tag[] = [
    { id: -4, name: 'urgent', color: '#ef4444' },
    { id: -5, name: 'réunion', color: '#3b82f6' },
    { id: -6, name: 'idée', color: '#a855f7' },
    { id: -7, name: 'courses', color: '#22c55e' }
  ]

  const raw: [string, number, TaskStatus, Priority, number | null, number[]][] = [
    ['Préparer la revue de sprint', -1, 'IN_PROGRESS', 'HIGH', 1, [-5]],
    ['Répondre aux e-mails clients', -1, 'TODO', 'URGENT', 0, [-4]],
    ['Mettre à jour la documentation API', -1, 'TODO', 'MEDIUM', 5, []],
    ['Corriger le bug de connexion', -1, 'DONE', 'URGENT', -2, [-4]],
    ['Faire les courses', -2, 'TODO', 'LOW', 2, [-7]],
    ['Réserver le billet de train', -2, 'TODO', 'MEDIUM', -1, []],
    ['Appeler le garage', -2, 'DONE', 'LOW', -3, []],
    ['Finir le chapitre sur GraphQL', -3, 'IN_PROGRESS', 'MEDIUM', 3, [-6]],
    ['Exercices Rust : ownership', -3, 'TODO', 'HIGH', 7, [-6]]
  ]

  let id = -8
  const tasks: StoredTask[] = raw.map(([title, projectId, status, priority, due, tagIds], i) => ({
    id: id--,
    projectId,
    parentId: null,
    title,
    notes: null,
    status,
    priority,
    dueAt: due === null ? null : day(due),
    position: i,
    createdAt: iso(now),
    updatedAt: iso(now),
    completedAt: status === 'DONE' ? iso(new Date(now.getTime() - 86_400_000)) : null,
    tagIds
  }))

  const parent = tasks[0].id
  ;['Rassembler les métriques', 'Écrire les slides', 'Répéter la démo'].forEach((title, i) => {
    tasks.push({
      id: id--,
      projectId: -1,
      parentId: parent,
      title,
      notes: null,
      status: 'TODO',
      priority: 'MEDIUM',
      dueAt: null,
      position: i,
      createdAt: iso(now),
      updatedAt: iso(now),
      completedAt: null,
      tagIds: []
    })
  })

  return {
    ...EMPTY_STATE,
    projects,
    tags,
    tasks,
    nextLocalId: id,
    // Le jeu de démo n'est PAS envoyé au serveur : l'outbox reste vide.
    outbox: []
  }
}
