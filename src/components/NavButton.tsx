import { Link } from 'react-router-dom'

type Props = {
  to: string
  children: string
}

export function NavButton({ to, children }: Props) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
    >
      {children}
    </Link>
  )
}
