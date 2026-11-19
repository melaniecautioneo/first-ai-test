/**
 * SYNCHRONISATION
 * ===============
 *
 * Principe, en trois temps :
 *
 *   1. REJOUER  — on envoie au serveur, dans l'ordre, les modifications faites
 *                 hors ligne (la file d'attente « outbox »).
 *   2. REMAPPER — une création hors ligne a un id négatif (-12) ; le serveur
 *                 lui en attribue un vrai (42). On remplace partout -12 par 42.
 *   3. RELIRE   — une fois la file vide, on récupère l'état du serveur, qui
 *                 fait désormais autorité.
 *
 * RÈGLE IMPORTANTE : cette fonction ne renvoie JAMAIS un état tout fait.
 * Elle renvoie un « compte rendu » (ce qui a été envoyé, la table des ids,
 * les données relues) que le magasin applique à son état COURANT. Sinon, une
 * modification faite par l'utilisateur pendant l'appel réseau serait écrasée
 * par un état figé au début de la synchro.
 */
import { api, API_URL, GraphQLError, SYNC_ENABLED, type Project, type Tag } from '../api'
import type { LocalState, Op, StoredTask } from './state'

export type SyncStatus = 'disabled' | 'offline' | 'syncing' | 'synced' | 'error'

/** Table de correspondance id local (négatif) -> id serveur (positif). */
export type IdMap = Map<number, number>

interface ServerTask {
  id: number
  projectId: number | null
  parentId: number | null
  title: string
  notes: string | null
  status: StoredTask['status']
  priority: StoredTask['priority']
  dueAt: string | null
  position: number
  createdAt: string
  updatedAt: string
  completedAt: string | null
  tags: { id: number }[]
}

interface PullData {
  projects: Project[]
  tags: Tag[]
  tasks: ServerTask[]
}

/** Compte rendu d'un cycle de synchronisation. */
export interface SyncOutcome {
  status: SyncStatus
  /** Opérations refusées par le serveur et abandonnées (entité déjà supprimée…). */
  dropped: number
  idMap: IdMap
  /** Identifiants des opérations effectivement envoyées. */
  flushed: Set<string>
  /** État du serveur, si on a pu le relire. */
  pulled: PullData | null
  message?: string
}

const EMPTY_OUTCOME = (status: SyncStatus): SyncOutcome => ({
  status,
  dropped: 0,
  idMap: new Map(),
  flushed: new Set(),
  pulled: null
})

const mapId = (m: IdMap, id: number | null | undefined): number | null => {
  if (id === null || id === undefined) return null
  return m.get(id) ?? id
}

/** Le serveur répond-il ? (timeout court pour ne pas bloquer l'interface) */
export async function pingApi(timeoutMs = 2500): Promise<boolean> {
  if (!SYNC_ENABLED) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{__typename}' }),
      signal: ctrl.signal
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// 1. Rejouer la file d'attente
// ---------------------------------------------------------------------------

/** Traduit les ids locaux présents dans la charge utile d'une opération. */
function mapPayload(m: IdMap, payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...payload }
  if ('projectId' in out && typeof out.projectId === 'number') out.projectId = mapId(m, out.projectId)
  if ('parentId' in out && typeof out.parentId === 'number') out.parentId = mapId(m, out.parentId)
  if (Array.isArray(out.tagIds)) out.tagIds = (out.tagIds as number[]).map((id) => mapId(m, id))
  return out
}

async function replay(op: Op, m: IdMap): Promise<void> {
  const serverId = mapId(m, op.entityId)
  const payload = mapPayload(m, op.payload)
  // Un id encore négatif = l'entité n'existe pas côté serveur : rien à faire.
  const unknown = serverId === null || serverId < 0

  switch (op.kind) {
    case 'project.create': {
      const r = await api.createProject(payload as { name: string; color?: string; emoji?: string })
      m.set(op.entityId, r.createProject.id)
      return
    }
    case 'project.update':
      if (unknown) return
      await api.updateProject(serverId!, payload)
      return
    case 'project.delete':
      if (unknown) return
      await api.deleteProject(serverId!)
      return
    case 'tag.create': {
      const r = await api.createTag(String(payload.name), String(payload.color ?? '#64748b'))
      m.set(op.entityId, r.createTag.id)
      return
    }
    case 'tag.delete':
      if (unknown) return
      await api.deleteTag(serverId!)
      return
    case 'task.create': {
      const r = await api.createTask(payload)
      m.set(op.entityId, r.createTask.id)
      return
    }
    case 'task.update':
      if (unknown) return
      await api.updateTask(serverId!, payload)
      return
    case 'task.delete':
      if (unknown) return
      await api.deleteTask(serverId!)
      return
  }
}

// ---------------------------------------------------------------------------
// 2. Remapper les ids dans tout l'état local
// ---------------------------------------------------------------------------

export function remapState(state: LocalState, m: IdMap): LocalState {
  if (m.size === 0) return state
  const id = (x: number | null) => (x === null ? null : (m.get(x) ?? x))

  return {
    ...state,
    projects: state.projects.map((p) => ({ ...p, id: id(p.id) as number })),
    tags: state.tags.map((g) => ({ ...g, id: id(g.id) as number })),
    tasks: state.tasks.map((t) => ({
      ...t,
      id: id(t.id) as number,
      projectId: id(t.projectId),
      parentId: id(t.parentId),
      tagIds: t.tagIds.map((x) => id(x) as number)
    })),
    outbox: state.outbox.map((op) => ({
      ...op,
      entityId: id(op.entityId) as number,
      payload: mapPayload(m, op.payload)
    }))
  }
}

// ---------------------------------------------------------------------------
// 3. Appliquer le compte rendu à l'état COURANT
// ---------------------------------------------------------------------------

export function applyOutcome(state: LocalState, outcome: SyncOutcome): LocalState {
  // Rien n'a été envoyé (serveur injoignable) : on ne touche à rien.
  if (outcome.flushed.size === 0 && outcome.idMap.size === 0 && !outcome.pulled) return state

  const remapped = remapState(state, outcome.idMap)
  const outbox = remapped.outbox.filter((o) => !outcome.flushed.has(o.opId))

  // On n'adopte l'état du serveur QUE si plus rien n'est en attente.
  // Sinon des modifications toutes fraîches seraient perdues.
  if (outcome.pulled && outbox.length === 0) {
    const tasks: StoredTask[] = outcome.pulled.tasks.map((t) => ({
      id: t.id,
      projectId: t.projectId,
      parentId: t.parentId,
      title: t.title,
      notes: t.notes,
      status: t.status,
      priority: t.priority,
      dueAt: t.dueAt,
      position: t.position,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      completedAt: t.completedAt,
      tagIds: t.tags.map((g) => g.id)
    }))
    return {
      ...remapped,
      projects: outcome.pulled.projects,
      tags: outcome.pulled.tags,
      tasks,
      outbox: [],
      lastSyncAt: new Date().toISOString()
    }
  }

  return { ...remapped, outbox }
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------

export async function syncNow(state: LocalState): Promise<SyncOutcome> {
  if (!SYNC_ENABLED) return EMPTY_OUTCOME('disabled')
  if (!(await pingApi())) return EMPTY_OUTCOME('offline')

  const idMap: IdMap = new Map()
  const flushed = new Set<string>()
  let dropped = 0

  for (const op of state.outbox) {
    try {
      await replay(op, idMap)
      flushed.add(op.opId)
    } catch (e) {
      if (e instanceof GraphQLError && e.message === 'network') {
        // Réseau coupé en plein vol : on garde le reste pour plus tard.
        return { status: 'offline', dropped, idMap, flushed, pulled: null }
      }
      // Erreur métier (entité déjà supprimée côté serveur, etc.) :
      // on abandonne CETTE opération et on continue.
      dropped += 1
      flushed.add(op.opId)
    }
  }

  try {
    const pulled = await api.pull()
    return { status: 'synced', dropped, idMap, flushed, pulled }
  } catch (e) {
    return {
      status: 'error',
      dropped,
      idMap,
      flushed,
      pulled: null,
      message: (e as Error).message
    }
  }
}
