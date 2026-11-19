import { Filters } from '../../components/Filters'
import { Stats } from '../../components/Stats'
import { TaskComposer } from '../../components/TaskComposer'
import { TaskList } from '../../components/TaskList'
import { useTodos } from '../../lib/store'

/** Page d'accueil : toutes les tâches, tous projets confondus. */
export default function Page() {
  const { filters } = useTodos()
  return (
    <>
      <Stats />
      <TaskComposer projectId={filters.projectId} />
      <Filters />
      <TaskList />
    </>
  )
}
