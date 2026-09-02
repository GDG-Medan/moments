type Props = {
  caption: string
  hashtags: string[]
  onCaptionChange: (value: string) => void
  onGenerate: () => void
  generating: boolean
}

export function CaptionPanel({
  caption,
  hashtags,
  onCaptionChange,
  onGenerate,
  generating,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">AI caption</p>
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating}
          className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60 dark:bg-[#FFD700] dark:text-slate-900"
        >
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>
      <textarea
        value={caption}
        onChange={(e) => onCaptionChange(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-blue-500 focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
        placeholder="Your caption will appear here"
      />
      {hashtags.length > 0 && (
        <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
          {hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ')}
        </p>
      )}
    </div>
  )
}
