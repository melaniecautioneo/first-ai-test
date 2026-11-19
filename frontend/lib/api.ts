/**
 * Petit client GraphQL maison (aucune librairie) + toutes les requêtes
 * utilisées par l'application.
 *
 * Pourquoi pas Apollo/urql ? Pour un premier projet, 30 lignes de `fetch`
 * sont plus faciles à lire et à déboguer. On pourra brancher urql plus tard
 * sans toucher aux composants, puisque tout passe par ce fichier.
 */

/**
 * Adresse de l'API GraphQL.
 *
 * `VITE_API_URL=""` (chaîne vide) = mode 100 % local : l'application ne tente
 * aucun appel réseau et stocke tout dans le navigateur. C'est le réglage
 * utilisé pour la version publiée sur GitHub Pages, qui n'a pas de backend.
 */
const RAW_API_URL = import.meta.env.VITE_API_URL as string | undefined
export const API_URL = (RAW_API_URL ?? 'http://localhost:8080/graphql').trim()
export const SYNC_ENABLED = API_URL !== ''

export class GraphQLError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GraphQLError'
  }
}

export async function gql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    })
  } catch {
    throw new GraphQLError('network')
  }
  if (!res.ok) throw new GraphQLError(`HTTP ${res.status}`)
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (json.errors?.length) throw new GraphQLError(json.errors.map((e) => e.message).join(' | '))
  return json.data as T
}

// ---------------------------------------------------------------------------
// Types (miroir du schéma Rust)
// ---------------------------------------------------------------------------

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type TaskSort =
  | 'MANUAL'
  | 'CREATED_DESC'
  | 'CREATED_ASC'
  | 'DUE_ASC'
  | 'DUE_DESC'
  | 'PRIORITY_DESC'
  | 'TITLE_ASC'

export interface Tag {
  id: number
  name: string
  color: string
}

export interface Project {
  id: number
  name: string
  color: string
  emoji: string
  archived: boolean
  taskCount: number
  doneCount: number
}

export interface Task {
  id: number
  projectId: number | null
  parentId: number | null
  title: string
  notes: string | null
  status: TaskStatus
  priority: Priority
  dueAt: string | null
  overdue: boolean
  createdAt: string
  completedAt: string | null
  tags: Tag[]
  subtasks: SubTask[]
}

export interface SubTask {
  id: number
  title: string
  status: TaskStatus
}

export interface Stats {
  total: number
  todo: number
  inProgress: number
  done: number
  overdue: number
  dueToday: number
  completedThisWeek: number
}

export interface TaskFilter {
  projectId?: number | null
  status?: TaskStatus[] | null
  priority?: Priority[] | null
  tagIds?: number[] | null
  search?: string | null
  overdueOnly?: boolean
  rootsOnly?: boolean
}

// ---------------------------------------------------------------------------
// Fragments & requêtes
// ---------------------------------------------------------------------------

const TASK_FIELDS = `
  id projectId parentId title notes status priority dueAt overdue createdAt completedAt
  tags { id name color }
  subtasks { id title status }
`

const PROJECT_FIELDS = `id name color emoji archived taskCount doneCount`

export const api = {
  /** Récupère TOUT (projets, étiquettes, tâches à plat) pour la synchronisation. */
  pull: () =>
    gql<{
      projects: Project[]
      tags: Tag[]
      tasks: {
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
        tags: { id: number }[]
      }[]
    }>(
      `query Pull {
         projects(includeArchived: true) { ${PROJECT_FIELDS} }
         tags { id name color }
         tasks(filter: { rootsOnly: false }, sort: MANUAL, limit: 1000) {
           id projectId parentId title notes status priority dueAt position
           createdAt updatedAt completedAt
           tags { id }
         }
       }`
    ),

  bootstrap: (filter: TaskFilter, sort: TaskSort) =>
    gql<{ projects: Project[]; tags: Tag[]; tasks: Task[]; stats: Stats }>(
      `query Bootstrap($filter: TaskFilter, $sort: TaskSort!, $statsProject: Int) {
         projects { ${PROJECT_FIELDS} }
         tags { id name color }
         tasks(filter: $filter, sort: $sort) { ${TASK_FIELDS} }
         stats(projectId: $statsProject) {
           total todo inProgress done overdue dueToday completedThisWeek
         }
       }`,
      { filter, sort, statsProject: filter.projectId ?? null }
    ),

  tasks: (filter: TaskFilter, sort: TaskSort) =>
    gql<{ tasks: Task[]; stats: Stats }>(
      `query Tasks($filter: TaskFilter, $sort: TaskSort!, $statsProject: Int) {
         tasks(filter: $filter, sort: $sort) { ${TASK_FIELDS} }
         stats(projectId: $statsProject) {
           total todo inProgress done overdue dueToday completedThisWeek
         }
       }`,
      { filter, sort, statsProject: filter.projectId ?? null }
    ),

  projects: () =>
    gql<{ projects: Project[] }>(`query { projects { ${PROJECT_FIELDS} } }`),

  createTask: (input: Record<string, unknown>) =>
    gql<{ createTask: Task }>(
      `mutation Create($input: TaskInput!) { createTask(input: $input) { ${TASK_FIELDS} } }`,
      { input }
    ),

  updateTask: (id: number, patch: Record<string, unknown>) =>
    gql<{ updateTask: Task }>(
      `mutation Update($id: Int!, $patch: TaskPatch!) {
         updateTask(id: $id, patch: $patch) { ${TASK_FIELDS} }
       }`,
      { id, patch }
    ),

  toggleTask: (id: number) =>
    gql<{ toggleTask: Task }>(
      `mutation Toggle($id: Int!) { toggleTask(id: $id) { ${TASK_FIELDS} } }`,
      { id }
    ),

  deleteTask: (id: number) =>
    gql<{ deleteTask: boolean }>(`mutation Del($id: Int!) { deleteTask(id: $id) }`, { id }),

  deleteCompleted: (projectId: number | null) =>
    gql<{ deleteCompletedTasks: number }>(
      `mutation Clean($projectId: Int) { deleteCompletedTasks(projectId: $projectId) }`,
      { projectId }
    ),

  createProject: (input: { name: string; color?: string; emoji?: string }) =>
    gql<{ createProject: Project }>(
      `mutation NewProject($input: ProjectInput!) {
         createProject(input: $input) { ${PROJECT_FIELDS} }
       }`,
      { input }
    ),

  updateProject: (id: number, patch: Record<string, unknown>) =>
    gql<{ updateProject: Project }>(
      `mutation EditProject($id: Int!, $patch: ProjectPatch!) {
         updateProject(id: $id, patch: $patch) { ${PROJECT_FIELDS} }
       }`,
      { id, patch }
    ),

  deleteProject: (id: number) =>
    gql<{ deleteProject: boolean }>(`mutation DelProject($id: Int!) { deleteProject(id: $id) }`, {
      id
    }),

  createTag: (name: string, color: string) =>
    gql<{ createTag: Tag }>(
      `mutation NewTag($name: String!, $color: String) {
         createTag(name: $name, color: $color) { id name color }
       }`,
      { name, color }
    ),

  deleteTag: (id: number) =>
    gql<{ deleteTag: boolean }>(`mutation DelTag($id: Int!) { deleteTag(id: $id) }`, { id })
}
