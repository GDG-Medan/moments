import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { DisplayNameGate } from './components/DisplayNameGate'
import { SiteFooter } from './components/SiteFooter'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { EventPage } from './pages/EventPage'
import { HighlightsPage } from './pages/HighlightsPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  const { user, profile, loading, configured, ensureProfile, refreshProfile } = useAuth()
  const { theme, toggleTheme } = useTheme()

  if (!configured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-slate-900 dark:text-slate-100">
        <h1 className="text-2xl font-bold">GDG Moments</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          Firebase is not configured yet. Copy{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.example</code> to{' '}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env</code> and add your
          Firebase web app keys.
        </p>
      </div>
    )
  }

  if (loading || !user) {
    return (
      <p className="px-4 py-16 text-center text-slate-600 dark:text-slate-400">
        Starting secure session…
      </p>
    )
  }

  const needsName = !profile?.display_name

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#eff6ff)] dark:bg-[radial-gradient(circle_at_top,_#0f172a,_#020617_50%,_#0b1220)]">
      <header className="border-b border-slate-200/80 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 hover:opacity-90">
            <img src="/favicon.svg" alt="" className="h-8 w-8" />
            <span className="font-bold text-slate-900 dark:text-slate-50">GDG Moments</span>
          </Link>
          <div className="flex items-center gap-3">
            {profile && (
              <p className="hidden text-sm text-slate-600 sm:block dark:text-slate-300">
                {profile.display_name} ·{' '}
                <span className="font-semibold text-slate-900 dark:text-slate-50">
                  {profile.points} pts
                </span>
              </p>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <DisplayNameGate
        open={needsName}
        onSubmit={async (name) => {
          await ensureProfile(name)
        }}
      />

      <main className="flex-1">
        {!needsName && profile && (
          <Routes>
            <Route path="/" element={<HomePage user={user} profile={profile} />} />
            <Route
              path="/e/:eventId"
              element={
                <EventPage
                  user={user}
                  profile={profile}
                  onPointsMaybeChanged={() => void refreshProfile()}
                />
              }
            />
            <Route
              path="/e/:eventId/highlights"
              element={
                <HighlightsPage
                  user={user}
                  profile={profile}
                  onPointsMaybeChanged={() => void refreshProfile()}
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </main>

      <SiteFooter />
    </div>
  )
}
