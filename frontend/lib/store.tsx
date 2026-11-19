/**
 * Le "cerveau" de l'application côté navigateur.
 *
 * Un seul contexte React contient : les données (projets, étiquettes,
 * tâches, statistiques), les filtres courants, et toutes les actions.
 * Les composants ne font jamais de `fetch` eux-mêmes : ils appellent
 * `useTodos()`.
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
  api,
  type Priority,
  type Project,
  type Stats,
  type Tag,
  type Task,
  type TaskFilter,
  type TaskSort,
  type TaskStatus
} from './api'

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

interface TodoContextValue {
  projects: Project[]
  tags: Tag[]
  tasks: Task[]
  stats: Stats | null
  filters: Filters
  loading: boolean
  busy: boolean
  error: string | null
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
}

const TodoContext = createContext<TodoContextValue | null>(null)

function toApiFilter(f: Filters): TaskFilter {
  return {
    projectId: f.projectId,
    search: f.search.trim() || null,
    status: f.statuses.length ? f.statuses : null,
    priority: f.priorities.length ? f.priorities : null,
    tagIds: f.tagIds.length ? f.tagIds : null,
    overdueOnly: f.overdueOnly,
    rootsOnly: true
  }
}

export function TodoProvider({
  children,
  projectId = null
}: {
  children: React.ReactNode
  projectId?: number | null
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [filtersState, setFiltersState] = useState<Filters>({ ...EMPTY_FILTERS, projectId })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firstLoad = useRef(true)

  // La page /project/@id change l'URL sans démonter le provider.
  useEffect(() => {
    setFiltersState((f) => (f.projectId === projectId ? f : { ...f, projectId }))
  }, [projectId])

  // Recherche : on attend 250 ms de calme avant d'interroger le serveur.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(filtersState.search), 250)
    return () => clearTimeout(id)
  }, [filtersState.search])

  const queryFilters = useMemo(
    () => ({ ...filtersState, search: debouncedSearch }),
    [
      debouncedSearch,
      filtersState.projectId,
      filtersState.statuses,
      filtersState.priorities,
      filtersState.tagIds,
      filtersState.overdueOnly,
      filtersState.sort
    ]
  )

  const describeError = (e: unknown) =>
    e instanceof Error && e.message === 'network' ? 'network' : String((e as Error)?.message ?? e)

  const load = useCallback(async () => {
    try {
      setError(null)
      const f = toApiFilter(queryFilters)
      if (firstLoad.current) {
        const data = await api.bootstrap(f, queryFilters.sort)
        setProjects(data.projects)
        setTags(data.tags)
        setTasks(data.tasks)
        setStats(data.stats)
        firstLoad.current = false
      } else {
        const data = await api.tasks(f, queryFilters.sort)
        setTasks(data.tasks)
        setStats(data.stats)
      }
    } catch (e) {
      setError(describeError(e))
    } finally {
      setLoading(false)
    }
  }, [queryFilters])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const refreshProjects = useCallback(async () => {
    try {
      const { projects } = await api.projects()
      setProjects(projects)
    } catch {
      /* non bloquant */
    }
  }, [])

  /** Enveloppe commune aux mutations : drapeau `busy` + rechargement + erreurs. */
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { projects?: boolean } = {}): Promise<T | null> => {
      setBusy(true)
      try {
        const result = await fn()
        await load()
        if (opts.projects) await refreshProjects()
        return result
      } catch (e) {
        setError(describeError(e))
        return null
      } finally {
        setBusy(false)
      }
    },
    [load, refreshProjects]
  )

  const value: TodoContextValue = {
    projects,
    tags,
    tasks,
    stats,
    filters: filtersState,
    loading,
    busy,
    error,
    setFilters: (patch) => setFiltersState((f) => ({ ...f, ...patch })),
    resetFilters: () =>
      setFiltersState((f) => ({ ...EMPTY_FILTERS, projectId: f.projectId, sort: f.sort })),
    reload: load,
    createTask: async (input) => {
      await run(() => api.createTask(input), { projects: true })
    },
    updateTask: async (id, patch) => {
      await run(() => api.updateTask(id, patch), { projects: true })
    },
    toggleTask: async (id) => {
      // Mise à jour optimiste : la case se coche tout de suite,
      // le serveur confirme juste après.
      setTasks((ts) =>
        ts.map((t) =>
          t.id === id ? { ...t, status: t.status === 'DONE' ? 'TODO' : 'DONE' } : t
        )
      )
      await run(() => api.toggleTask(id), { projects: true })
    },
    deleteTask: async (id) => {
      setTasks((ts) => ts.filter((t) => t.id !== id))
      await run(() => api.deleteTask(id), { projects: true })
    },
    deleteCompleted: async (pid) => {
      const res = await run(() => api.deleteCompleted(pid), { projects: true })
      return res?.deleteCompletedTasks ?? 0
    },
    createProject: async (input) => {
      const res = await run(() => api.createProject(input), { projects: true })
      return res!.createProject
    },
    updateProject: async (id, patch) => {
      await run(() => api.updateProject(id, patch), { projects: true })
    },
    deleteProject: async (id) => {
      await run(() => api.deleteProject(id), { projects: true })
    },
    createTag: async (name, color) => {
      const res = await run(() => api.createTag(name, color))
      if (res) setTags((prev) => [...prev.filter((t) => t.id !== res.createTag.id), res.createTag])
      return res?.createTag ?? null
    },
    deleteTag: async (id) => {
      await run(() => api.deleteTag(id))
      setTags((prev) => prev.filter((t) => t.id !== id))
    }
  }

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodos(): TodoContextValue {
  const ctx = useContext(TodoContext)
  if (!ctx) throw new Error('useTodos() doit être utilisé dans <TodoProvider>')
  return ctx
}
