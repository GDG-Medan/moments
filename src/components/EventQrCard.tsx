import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'

type Props = {
  eventId: string
  title: string
  defaultOpen?: boolean
}

export function EventQrCard({ eventId, title, defaultOpen = false }: Props) {
  const joinUrl = `${window.location.origin}/e/${eventId}`
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState<'link' | 'code' | null>(null)

  async function copy(kind: 'link' | 'code', value: string) {
    await navigator.clipboard.writeText(value)
    setCopied(kind)
    window.setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">Invite / Scan to join</h3>
          <p className="mt-0.5 font-mono text-lg font-bold tracking-[0.3em] text-[#B45309] dark:text-[#FFD700]">
            {eventId}
          </p>
        </div>
        <span className="text-sm text-slate-500 dark:text-slate-400">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">{title}</p>
          <div className="mt-3 flex justify-center rounded-xl bg-white p-3 dark:bg-slate-100">
            <QRCodeSVG value={joinUrl} size={160} includeMargin />
          </div>
          <p className="mt-3 break-all text-center text-xs text-slate-500 dark:text-slate-400">{joinUrl}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => void copy('code', eventId)}
            >
              {copied === 'code' ? 'Copied code' : 'Copy code'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => void copy('link', joinUrl)}
            >
              {copied === 'link' ? 'Copied link' : 'Copy join link'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
