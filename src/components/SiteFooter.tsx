import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export function SiteFooter() {
  const { theme } = useTheme()
  const logo =
    theme === 'dark'
      ? '/logo-gdg-professional-horizontal-dark.png'
      : '/logo-gdg-professional-horizontal-light.png'

  return (
    <footer className="mt-auto border-t border-slate-200/80 bg-white/70 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4">
        <Link to="/" aria-label="GDG Medan home">
          <img src={logo} alt="GDG Medan" className="h-7 w-auto opacity-90" />
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Built for Google Developer Groups communities
        </p>
      </div>
    </footer>
  )
}
