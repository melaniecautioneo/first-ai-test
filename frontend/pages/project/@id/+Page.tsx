import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePageContext } from 'vike-react/usePageContext'
import { Filters } from '../../../components/Filters'
import { Stats } from '../../../components/Stats'
import { TaskComposer } from '../../../components/TaskComposer'
import { TaskList } from '../../../components/TaskList'
import { useTodos } from '../../../lib/store'

/** Page d'un projet : /project/3 */
export default function Page() {
  const { t } = useTranslation()
  const pageContext = usePageContext()
  const id = Number((pageContext.routeParams as Record<string, string>).id)
  const { projects, updateProject, deleteProject, loading } = useTodos()
  const project = projects.find((p) => p.id === id)
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')

  if (!project) {
    return (
      <div className="py-16 text-center opacity-60">
        {loading ? t('common.loading') : t('project.notFound')}
      </div>
    )
  }

  return (
    <>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body flex-row flex-wrap items-center gap-3 p-4">
          <span className="text-3xl">{project.emoji}</span>
          {renaming ? (
            <form
              className="flex flex-1 gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                await updateProject(project.id, { name })
                setRenaming(false)
              }}
            >
              <input
                autoFocus
                className="input input-sm flex-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <button className="btn btn-primary btn-sm">{t('task.save')}</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
                {t('task.cancel')}
              </button>
            </form>
          ) : (
            <>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{project.name}</h2>
                <p className="text-sm opacity-60">
                  {project.doneCount}/{project.taskCount} · {t('stats.done')}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setName(project.name)
                  setRenaming(true)
                }}
              >
                ✏️ {t('project.rename')}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => void updateProject(project.id, { archived: !project.archived })}
              >
                📦 {project.archived ? t('project.unarchive') : t('project.archive')}
              </button>
              <button
                className="btn btn-ghost btn-sm text-error"
                onClick={async () => {
                  if (window.confirm(t('project.deleteConfirm', { name: project.name }))) {
                    await deleteProject(project.id)
                    window.location.href = '/'
                  }
                }}
              >
                🗑️
              </button>
            </>
          )}
        </div>
      </div>

      <Stats />
      <TaskComposer projectId={project.id} />
      <Filters />
      <TaskList />
    </>
  )
}
