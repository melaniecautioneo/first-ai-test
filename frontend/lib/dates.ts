/** Helpers de dates : affichage lisible et conversion vers/depuis <input type="date">. */

import type { TFunction } from 'i18next'

export function toDateInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** "2026-03-04" -> ISO UTC à 12h00 (évite les surprises de fuseau horaire). */
export function fromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).toISOString()
}

export function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export function daysUntil(iso: string): number {
  const diff = startOfDay(new Date(iso)).getTime() - startOfDay(new Date()).getTime()
  return Math.round(diff / 86_400_000)
}

/** "Aujourd'hui", "Demain", "Il y a 3 j", ou une date courte localisée. */
export function humanDate(iso: string, t: TFunction, locale: string): string {
  const n = daysUntil(iso)
  if (n === 0) return t('date.today')
  if (n === 1) return t('date.tomorrow')
  if (n === -1) return t('date.yesterday')
  if (n > 1 && n <= 7) return t('date.inDays', { count: n })
  if (n < -1 && n >= -7) return t('date.daysAgo', { count: Math.abs(n) })
  return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
}

export function fullDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}
