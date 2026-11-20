import { Stats } from '../../components/Stats'
import { TaskList } from '../../components/TaskList'
import { Toolbar } from '../../components/Toolbar'
import { useTodos } from '../../lib/store'

/** Page d'accueil : toutes les tâches, tous projets confondus. */
export default function Page() {
  const { filters } = useTodos()
  return (
    <>
      <Stats />
      <Toolbar projectId={filters.projectId} />
      <TaskList />
    </>
  )
}
