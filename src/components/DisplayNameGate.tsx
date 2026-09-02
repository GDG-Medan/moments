type Props = {
  open: boolean
  initialName?: string
  onSubmit: (displayName: string) => Promise<void>
}

export function DisplayNameGate({ open, initialName = '', onSubmit }: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <form
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onSubmit={async (e) => {
          e.preventDefault()
          const form = new FormData(e.currentTarget)
          const name = String(form.get('display_name') ?? '')
          await onSubmit(name)
        }}
      >
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
          GDG Moments
        </p>
        <h2 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">
          What should we call you?
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Pick a display name before you create or join an event room.
        </p>
        <label
          className="mt-5 block text-sm font-medium text-slate-700 dark:text-slate-300"
          htmlFor="display_name"
        >
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          defaultValue={initialName}
          required
          maxLength={40}
          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          placeholder="Alex from GDG Medan"
          autoFocus
        />
        <button
          type="submit"
          className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-500"
        >
          Continue
        </button>
      </form>
    </div>
  )
}
