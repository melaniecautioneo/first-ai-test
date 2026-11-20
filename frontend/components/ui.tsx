/** Petits composants d'affichage réutilisables (badges, états vides…). */
import { useTranslation } from 'react-i18next'
import { type Priority, type Tag, type TaskStatus } from '../lib/api'
import { daysUntil, humanDate } from '../lib/dates'

export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
export const STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'DONE']

export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: 'badge-ghost',
  MEDIUM: 'badge-info',
  HIGH: 'badge-warning',
  URGENT: 'badge-error'
}

export const STATUS_CLASS: Record<TaskStatus, string> = {
  TODO: 'badge-ghost',
  IN_PROGRESS: 'badge-primary',
  DONE: 'badge-success'
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const { t } = useTranslation()
  return (
    <span className={`badge badge-sm ${PRIORITY_CLASS[priority]}`}>
      {t(`priority.${priority}`)}
    </span>
  )
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const { t } = useTranslation()
  return <span className={`badge badge-sm ${STATUS_CLASS[status]}`}>{t(`status.${status}`)}</span>
}

/**
 * L'échéance d'une tâche dans la liste.
 *
 * Volontairement PAS un `badge` : la date est l'information qu'on cherche en
 * premier quand on balaie une liste. Elle est donc alignée à droite, en
 * texte, et seule l'urgence lui donne une couleur (et un fond si elle est
 * dépassée). Tout le reste — priorité, statut, étiquettes — est relégué à la
 * ligne méta, en plus petit.
 */
export function DueDate({
  dueAt,
  overdue,
  done
}: {
  dueAt: string
  overdue: boolean
  done: boolean
}) {
  const { t, i18n } = useTranslation()
  const soon = !done && !overdue && daysUntil(dueAt) === 0

  const tone = done
    ? 'opacity-40'
    : overdue
      ? 'rounded bg-error/10 px-1.5 py-0.5 font-semibold text-error'
      : soon
        ? 'font-medium text-warning'
        : 'opacity-60'

  return (
    <span
      className={`shrink-0 text-xs whitespace-nowrap tabular-nums ${tone}`}
      title={new Date(dueAt).toLocaleString(i18n.language)}
    >
      <span aria-hidden>{overdue ? '⚠️' : '📅'}</span> {humanDate(dueAt, t, i18n.language)}
    </span>
  )
}

const PRIORITY_DOT: Record<Priority, string> = {
  LOW: 'bg-base-content/30',
  MEDIUM: 'bg-info',
  HIGH: 'bg-warning',
  URGENT: 'bg-error'
}

/**
 * Priorité en pastille de couleur. Le mot n'apparaît que pour « haute » et
 * « urgente » : afficher « moyenne » sur les trois quarts des tâches ne dit
 * rien et encombre la lecture.
 */
export function PriorityDot({ priority }: { priority: Priority }) {
  const { t } = useTranslation()
  const loud = priority === 'HIGH' || priority === 'URGENT'
  return (
    <span className="inline-flex items-center gap-1" title={t(`priority.${priority}`)}>
      <span className={`inline-block h-2 w-2 rounded-full ${PRIORITY_DOT[priority]}`} />
      {loud && (
        <span className={priority === 'URGENT' ? 'text-error' : 'text-warning'}>
          {t(`priority.${priority}`)}
        </span>
      )}
    </span>
  )
}

/** Étiquette en contour coloré : se distingue des pastilles pleines. */
export function TagPill({ tag }: { tag: Tag }) {
  return (
    <span
      className="rounded-full border px-1.5 text-xs whitespace-nowrap"
      style={{ color: tag.color, borderColor: tag.color }}
    >
      {tag.name}
    </span>
  )
}

export function TagChip({ tag, onRemove }: { tag: Tag; onRemove?: () => void }) {
  return (
    <span
      className="badge badge-sm gap-1 border-0 text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
      {onRemove && (
        <button type="button" className="opacity-70 hover:opacity-100" onClick={onRemove}>
          ✕
        </button>
      )}
    </span>
  )
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation()

  // Opérations refusées par le serveur pendant une synchro : c'est un
  // avertissement, pas une panne — l'application reste utilisable.
  const dropped = message.startsWith('sync.dropped:')
  const text = dropped
    ? t('sync.dropped', { count: Number(message.split(':')[1]) || 0 })
    : message === 'network'
      ? t('sync.offlineHint')
      : t('error.generic', { message })

  return (
    <div className={`alert my-4 ${dropped ? 'alert-warning' : 'alert-error'}`}>
      <span>
        {!dropped && <strong>{t('error.title')} — </strong>}
        {text}
      </span>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          {t('common.retry')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useTranslation()
  return (
    <div className="py-16 text-center opacity-60">
      <div className="text-5xl">{filtered ? '🔍' : '🎉'}</div>
      <p className="mt-3">{filtered ? t('task.emptyFiltered') : t('task.empty')}</p>
    </div>
  )
}

export function Spinner() {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-center gap-3 py-16 opacity-60">
      <span className="loading loading-spinner loading-md" />
      {t('common.loading')}
    </div>
  )
}
