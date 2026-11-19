import vikeReact from 'vike-react/config'
import type { Config } from 'vike/types'
import LayoutDefault from '../layouts/LayoutDefault'

// Configuration globale de Vike (s'applique à toutes les pages).
export default {
  Layout: LayoutDefault,
  title: 'Tâches — Todo',
  description: 'Gestionnaire de tâches : Vike + React + daisyUI + i18next / Rust + GraphQL + SQLite',
  // Langue du HTML rendu par le serveur. Elle doit correspondre à
  // DEFAULT_LANGUAGE (lib/i18n.ts) : le serveur rend en français, donc
  // <html lang="fr">. Le navigateur la corrige si l'utilisateur change
  // de langue (voir I18nProvider).
  lang: 'fr',
  extends: vikeReact,
  // Rendu serveur activé (SSR) en développement.
  ssr: true,
  // Pré-rendu : `npm run build` écrit des fichiers HTML statiques, ce qui
  // permet d'héberger le site sur GitHub Pages (qui ne fait tourner
  // aucun serveur).
  prerender: true
} satisfies Config
