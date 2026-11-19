import '../css/tailwind.css'
import React from 'react'
import { usePageContext } from 'vike-react/usePageContext'
import { I18nProvider } from '../components/Providers'
import { Sidebar } from '../components/Sidebar'
import { Topbar } from '../components/Topbar'
import { TodoProvider } from '../lib/store'

/**
 * Mise en page commune à toutes les pages (Vike applique ce composant
 * automatiquement grâce à `pages/+config.ts`).
 */
export default function LayoutDefault({ children }: { children: React.ReactNode }) {
  const pageContext = usePageContext()
  const rawId = (pageContext.routeParams as Record<string, string> | undefined)?.id
  const projectId = rawId && /^\d+$/.test(rawId) ? Number(rawId) : null

  return (
    <I18nProvider>
      <TodoProvider projectId={projectId}>
        <div className="drawer lg:drawer-open">
          <input id="main-drawer" type="checkbox" className="drawer-toggle" />

          <div className="drawer-content flex min-h-screen flex-col bg-base-200/40">
            <Topbar />
            <main className="mx-auto w-full max-w-4xl flex-1 space-y-4 p-4">{children}</main>
          </div>

          <div className="drawer-side z-20">
            <label htmlFor="main-drawer" className="drawer-overlay" aria-label="close menu" />
            <Sidebar />
          </div>
        </div>
      </TodoProvider>
    </I18nProvider>
  )
}
