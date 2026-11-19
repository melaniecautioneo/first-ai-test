import vikeReact from 'vike-react/config'
import type { Config } from 'vike/types'
import LayoutDefault from '../layouts/LayoutDefault'

// Configuration globale de Vike (s'applique à toutes les pages).
export default {
  Layout: LayoutDefault,
  title: 'Tâches — Todo',
  description: 'Gestionnaire de tâches : Vike + React + daisyUI + i18next / Rust + GraphQL + SQLite',
  extends: vikeReact,
  // Rendu serveur activé (SSR) : le HTML arrive déjà construit,
  // les données sont ensuite chargées côté client via GraphQL.
  ssr: true
} satisfies Config
