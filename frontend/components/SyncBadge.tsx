/** Pastille d'état de la synchronisation (hors ligne / en attente / à jour). */
import { useTranslation } from 'react-i18next'
import { useTodos } from '../lib/store'

const DOT: Record<string, string> = {
  disabled: 'bg-base-content/30',
  offline: 'bg-warning',
  syncing: 'bg-info animate-pulse',
  synced: 'bg-success',
  error: 'bg-error'
}

export function SyncBadge() {
  const { t } = useTranslation()
  const { sync, syncNow } = useTodos()

  const label = t(`sync.${sync.status}`)
  const title = sync.pending > 0 ? t('sync.pending', { count: sync.pending }) : t('sync.upToDate')

  // En mode local (aucun serveur configuré), le compteur n'aurait pas de sens
  // pour l'utilisateur : la file est conservée en silence, au cas où un
  // backend serait branché plus tard.
  const showCount = sync.enabled && sync.pending > 0

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm gap-2"
      title={sync.enabled ? `${label} — ${title}` : label}
      onClick={() => void syncNow()}
      disabled={!sync.enabled}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${DOT[sync.status]}`} />
      <span className="hidden text-xs font-normal sm:inline">{label}</span>
      {showCount && <span className="badge badge-xs badge-warning">{sync.pending}</span>}
    </button>
  )
}
