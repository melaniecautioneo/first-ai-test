/**
 * Analyse de la saisie rapide.
 *
 *   "Appeler le client !urgent @demain #téléphone"
 *
 *   !low | !medium | !high | !urgent   -> priorité  (aussi !1 !2 !3 !4)
 *   @today|@aujourdhui|@tomorrow|@demain|@+3d|@2026-01-15  -> échéance
 *   #étiquette                         -> étiquette (créée si besoin)
 *
 * Les mots-clés existent en français et en anglais.
 */
import type { Priority } from './api'

export interface ParsedInput {
  title: string
  priority: Priority | null
  dueAt: string | null
  tagNames: string[]
}

const PRIORITY_WORDS: Record<string, Priority> = {
  '1': 'LOW',
  '2': 'MEDIUM',
  '3': 'HIGH',
  '4': 'URGENT',
  low: 'LOW',
  basse: 'LOW',
  medium: 'MEDIUM',
  moyenne: 'MEDIUM',
  high: 'HIGH',
  haute: 'HIGH',
  urgent: 'URGENT',
  urgente: 'URGENT'
}

function atUtcNoon(d: Date): string {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)).toISOString()
}

function parseDateToken(raw: string): string | null {
  const token = raw.toLowerCase().replace(/[’']/g, '')
  const today = new Date()

  if (['today', 'aujourdhui', 'auj'].includes(token)) return atUtcNoon(today)
  if (['tomorrow', 'demain'].includes(token)) {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return atUtcNoon(d)
  }
  if (['monday', 'lundi'].includes(token)) return nextWeekday(1)
  if (['friday', 'vendredi'].includes(token)) return nextWeekday(5)

  const rel = token.match(/^\+(\d+)([dj]?)$/) // @+3d / @+3j
  if (rel) {
    const d = new Date(today)
    d.setDate(d.getDate() + Number(rel[1]))
    return atUtcNoon(d)
  }

  const iso = token.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3], 12)).toISOString()

  const fr = token.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/) // 04/03 ou 04/03/2026
  if (fr) {
    const year = fr[3] ? +fr[3] : today.getFullYear()
    return new Date(Date.UTC(year, +fr[2] - 1, +fr[1], 12)).toISOString()
  }
  return null
}

function nextWeekday(target: number): string {
  const d = new Date()
  const delta = (target - d.getDay() + 7) % 7 || 7
  d.setDate(d.getDate() + delta)
  return atUtcNoon(d)
}

export function parseQuickAdd(input: string): ParsedInput {
  const result: ParsedInput = { title: '', priority: null, dueAt: null, tagNames: [] }
  const words: string[] = []

  for (const word of input.split(/\s+/)) {
    if (word.startsWith('!') && word.length > 1) {
      const p = PRIORITY_WORDS[word.slice(1).toLowerCase()]
      if (p) {
        result.priority = p
        continue
      }
    }
    if (word.startsWith('@') && word.length > 1) {
      const d = parseDateToken(word.slice(1))
      if (d) {
        result.dueAt = d
        continue
      }
    }
    if (word.startsWith('#') && word.length > 1) {
      result.tagNames.push(word.slice(1).toLowerCase())
      continue
    }
    words.push(word)
  }

  result.title = words.join(' ').trim()
  return result
}
