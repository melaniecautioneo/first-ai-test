/**
 * Liens internes et "base URL".
 *
 * En local le site est servi à la racine (`/`), mais sur GitHub Pages il vit
 * sous `/<nom-du-depot>/`. Vite expose ce préfixe dans
 * `import.meta.env.BASE_URL` ; tous les liens doivent passer par `href()`,
 * sinon ils pointent à côté une fois le site publié.
 */
export const BASE_URL: string = import.meta.env.BASE_URL || '/'

/** `href('/settings')` -> `/settings` en local, `/mon-depot/settings` publié. */
export function href(path: string): string {
  const clean = path.startsWith('/') ? path.slice(1) : path
  return BASE_URL.endsWith('/') ? BASE_URL + clean : `${BASE_URL}/${clean}`
}

/** Chemin interne (sans le préfixe) tel que Vike le fournit, pour comparer. */
export function isCurrent(urlPathname: string, path: string): boolean {
  const strip = (p: string) => {
    const base = BASE_URL.replace(/\/$/, '')
    const withoutQuery = p.split('?')[0]
    const out = base && withoutQuery.startsWith(base) ? withoutQuery.slice(base.length) : withoutQuery
    return out === '' ? '/' : out.replace(/\/$/, '') || '/'
  }
  return strip(urlPathname) === strip(path)
}

/**
 * Lit l'id de projet dans l'URL (`/project?id=5`).
 * Accepte les ids négatifs : ce sont les projets créés hors ligne.
 */
export function projectIdFromUrl(pageContext: {
  urlParsed?: { search?: Record<string, string> }
}): number | null {
  const raw = pageContext.urlParsed?.search?.id
  if (!raw || !/^-?\d+$/.test(raw)) return null
  return Number(raw)
}
