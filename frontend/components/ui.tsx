/** Petits composants d'affichage réutilisables (badges, états vides…). */
import { useTranslation } from 'react-i18next'
import { API_URL, type Priority, type Tag, type TaskStatus } from '../lib/api'
import { humanDate } from '../lib/dates'

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

export function DueBadge({ dueAt, overdue }: { dueAt: string; overdue: boolean }) {
  const { t, i18n } = useTranslation()
  return (
    <span
      className={`badge badge-sm gap-1 ${overdue ? 'badge-error' : 'badge-ghost'}`}
      title={new Date(dueAt).toLocaleString(i18n.language)}
    >
      <span aria-hidden>📅</span>
      {humanDate(dueAt, t, i18n.language)}
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
