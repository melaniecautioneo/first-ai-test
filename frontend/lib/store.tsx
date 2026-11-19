/**
 * Le "cerveau" de l'application — version LOCAL-FIRST (hors ligne d'abord).
 *
 * Avant : chaque action partait sur le réseau ; sans serveur, l'app était
 * inutilisable.
 * Maintenant : chaque action modifie d'abord l'état local (instantané, marche
 * dans le métro), est enregistrée dans localStorage, puis part vers le serveur
 * quand celui-ci est joignable.
 *
 *   composant -> useTodos() -> moteur local -> localStorage
 *                                   |
 *                                   +--> file d'attente --> serveur Rust
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  SYNC_ENABLED,
  type Priority,
  type Project,
  type Stats,
  type Tag,
  type Task,
  type TaskSort,
  type TaskStatus
} from './api'
import * as engine from './offline/engine'
import { demoState, EMPTY_STATE, loadState, saveState, type LocalState } from './offline/state'
import {
  applyOutcome,
  pingApi,
  syncNow as runSyncCycle,
  type SyncStatus
} from './offline/sync'

export interface Filters {
  projectId: number | null
  search: string
  statuses: TaskStatus[]
  priorities: Priority[]
  tagIds: number[]
  overdueOnly: boolean
  sort: TaskSort
}

export const EMPTY_FILTERS: Filters = {
  projectId: null,
  search: '',
  statuses: [],
  priorities: [],
  tagIds: [],
  overdueOnly: false,
  sort: 'MANUAL'
}

export function countActiveFilters(f: Filters): number {
  return (
    (f.search.trim() ? 1 : 0) +
    (f.statuses.length ? 1 : 0) +
    (f.priorities.length ? 1 : 0) +
    (f.tagIds.length ? 1 : 0) +
    (f.overdueOnly ? 1 : 0)
  )
}

export interface SyncInfo {
  status: SyncStatus
  /** Nombre de modifications pas encore envoyées au serveur. */
  pending: number
  lastSyncAt: string | null
  enabled: boolean
}

interface TodoContextValue {
  projects: Project[]
  tags: Tag[]
  tasks: Task[]
  stats: Stats | null
  filters: Filters
  loading: boolean
  busy: boolean
  error: string | null
  sync: SyncInfo
  syncNow: () => Promise<void>
  setFilters: (patch: Partial<Filters>) => void
  resetFilters: () => void
  reload: () => Promise<void>
  createTask: (input: Record<string, unknown>) => Promise<void>
  updateTask: (id: number, patch: Record<string, unknown>) => Promise<void>
  toggleTask: (id: number) => Promise<void>
  deleteTask: (id: number) => Promise<void>
  deleteCompleted: (projectId: number | null) => Promise<number>
  createProject: (input: { name: string; color?: string; emoji?: string }) => Promise<Project>
  updateProject: (id: number, patch: Record<string, unknown>) => Promise<void>
  deleteProject: (id: number) => Promise<void>
  createTag: (name: string, color: string) => Promise<Tag | null>
  deleteTag: (id: number) => Promise<void>
  /** Efface les données du navigateur et recharge le jeu de démonstration. */
  resetLocalData: () => void
}

const TodoContext = createContext<TodoContextValue | null>(null)

export function TodoProvider({
  children,
  projectId = null
}: {
  children: React.ReactNode
  projectId?: number | null
}) {
  // `null` tant que le navigateur n'a pas lu localStorage. Indispensable :
  // le rendu serveur (SSR) et le premier rendu client doivent être
  // identiques, sinon React signale une erreur d'hydratation.
  const [state, setState] = useState<LocalState | null>(null)
  const [filtersState, setFiltersState] = useState<Filters>({ ...EMPTY_FILTERS, projectId })
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SYNC_ENABLED ? 'offline' : 'disabled')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stateRef = useRef<LocalState | null>(null)
  const syncing = useRef(false)
  const syncTimer = useRef<number | undefined>(undefined)

  // ---- Chargement initial (navigateur uniquement) ------------------------
  //
  // Règle importante : on ne charge le jeu de DÉMONSTRATION que si l'on ne
  // peut pas récupérer de vraies données. Sinon, l'utilisateur modifierait
  // des tâches de démo qui n'existent pas côté serveur : ces modifications
  // seraient impossibles à synchroniser, donc perdues.
  useEffect(() => {
    const saved = loadState()
    if (saved) {
      stateRef.current = saved
      setState(saved)
      return
    }
    if (!SYNC_ENABLED) {
      const demo = demoState()
      stateRef.current = demo
      setState(demo)
      return
    }
    // Un serveur est configuré : on part d'un état vide, la synchronisation
    // qui suit le remplira. S'il est injoignable, on bascule sur la démo.
    let cancelled = false
    const empty: LocalState = { ...EMPTY_STATE }
    stateRef.current = empty
    setState(empty)
    void pingApi().then((reachable) => {
      if (cancelled || reachable) return
      const demo = demoState()
      stateRef.current = demo
      setState(demo)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // ---- Persistance : à chaque changement, on réécrit localStorage --------
  useEffect(() => {
    if (!state) return
    stateRef.current = state
    saveState(state)
  }, [state])

  useEffect(() => {
    setFiltersState((f) => (f.projectId === projectId ? f : { ...f, projectId }))
  }, [projectId])

  // Recherche : on attend 250 ms de calme avant de recalculer la liste.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filtersState.search), 250)
    return () => clearTimeout(id)
  }, [filtersState.search])

  // ---- Synchronisation ----------------------------------------------------
  const runSync = useCallback(async () => {
    if (!SYNC_ENABLED || syncing.current) return
    const before = stateRef.current
    if (!before) return

    syncing.current = true
    setSyncStatus('syncing')
    try {
      const outcome = await runSyncCycle(before)
      // On applique le compte rendu à l'état COURANT (pas à `before`) :
      // l'utilisateur a pu cocher une case pendant l'appel réseau.
      const current = stateRef.current ?? before
      const next = applyOutcome(current, outcome)
      stateRef.current = next
      setState(next)
      setSyncStatus(outcome.status)
      setError(outcome.dropped > 0 ? `sync.dropped:${outcome.dropped}` : null)
    } catch (e) {
      setSyncStatus('error')
      setError(String((e as Error)?.message ?? e))
    } finally {
      syncing.current = false
    }
  }, [])

  // Synchro au démarrage, au retour du réseau, et toutes les 60 s.
  const ready = state !== null
  useEffect(() => {
    if (!SYNC_ENABLED || !ready) return
    void runSync()
    const onOnline = () => void runSync()
    window.addEventListener('online', onOnline)
    const interval = window.setInterval(() => void runSync(), 60_000)
    return () => {
      window.removeEventListener('online', onOnline)
      window.clearInterval(interval)
    }
  }, [ready, runSync])

  /** Applique une modification locale, puis programme l'envoi (débounce 1,2 s). */
  const mutate = useCallback(
    (fn: (s: LocalState) => LocalState) => {
      const current = stateRef.current
      if (!current) return
      setBusy(true)
      const next = fn(current)
      stateRef.current = next
      setState(next)
      setBusy(false)
      if (SYNC_ENABLED) {
        window.clearTimeout(syncTimer.current)
        syncTimer.current = window.setTimeout(() => void runSync(), 1200)
      }
    },
    [runSync]
  )

  // ---- Données dérivées (filtrage/tri/stats faits en local) ---------------
  const projects = useMemo(() => (state ? engine.projectsWithCounts(state) : []), [state])

  const tags = useMemo(
    () => (state ? [...state.tags].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [state]
  )

  const tasks = useMemo(
    () => (state ? engine.queryTasks(state, { ...filtersState, search: debouncedSearch }) : []),
    [
      state,
      debouncedSearch,
      filtersState.projectId,
      filtersState.statuses,
      filtersState.priorities,
      filtersState.tagIds,
      filtersState.overdueOnly,
      filtersState.sort
    ]
  )

  const stats = useMemo(
    () => (state ? engine.computeStats(state, filtersState.projectId) : null),
    [state, filtersState.projectId]
  )

  const value: TodoContextValue = {
    projects,
    tags,
    tasks,
    stats,
    filters: filtersState,
    loading: state === null,
    busy,
    error,
    sync: {
      status: syncStatus,
      pending: state?.outbox.length ?? 0,
      lastSyncAt: state?.lastSyncAt ?? null,
      enabled: SYNC_ENABLED
    },
    syncNow: runSync,
    setFilters: (patch) => setFiltersState((f) => ({ ...f, ...patch })),
    resetFilters: () =>
      setFiltersState((f) => ({ ...EMPTY_FILTERS, projectId: f.projectId, sort: f.sort })),
    reload: runSync,
    createTask: async (input) => {
      mutate((s) => engine.createTask(s, input as Parameters<typeof engine.createTask>[1]).state)
    },
    updateTask: async (id, patch) => {
      mutate((s) => engine.updateTask(s, id, patch))
    },
    toggleTask: async (id) => {
      mutate((s) => engine.toggleTask(s, id))
    },
    deleteTask: async (id) => {
      mutate((s) => engine.deleteTask(s, id))
    },
    deleteCompleted: async (pid) => {
      let count = 0
      mutate((s) => {
        const r = engine.deleteCompleted(s, pid)
        count = r.count
        return r.state
      })
      return count
    },
    createProject: async (input) => {
      let created: Project | null = null
      mutate((s) => {
        const r = engine.createProject(s, input)
        created = r.project
        return r.state
      })
      return created!
    },
    updateProject: async (id, patch) => {
      mutate((s) => engine.updateProject(s, id, patch))
    },
    deleteProject: async (id) => {
      mutate((s) => engine.deleteProject(s, id))
    },
    createTag: async (name, color) => {
      let created: Tag | null = null
      mutate((s) => {
        const r = engine.createTag(s, name, color)
        created = r.tag
        return r.state
      })
      return created
    },
    deleteTag: async (id) => {
      mutate((s) => engine.deleteTag(s, id))
    },
    resetLocalData: () => {
      const fresh = demoState()
      stateRef.current = fresh
      setState(fresh)
      setError(null)
    }
  }

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodos(): TodoContextValue {
  const ctx = useContext(TodoContext)
  if (!ctx) throw new Error('useTodos() doit être utilisé dans <TodoProvider>')
  return ctx
}
