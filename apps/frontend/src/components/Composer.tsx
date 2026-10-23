import { useState } from 'react'

/** The question box: a pill-shaped input with a round send button. */
export function Composer({ disabled, onSubmit }: { disabled: boolean; onSubmit: (value: string) => void }) {
  const [value, setValue] = useState('')
  const canSend = !disabled && value.trim().length > 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSend) return
    onSubmit(value.trim())
    setValue('')
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-line bg-paper py-1.5 pr-1.5 pl-5 shadow-sm transition-shadow focus-within:border-fg/60 focus-within:shadow-[0_0_0_4px_rgba(232,90,79,0.2)]"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask about admissions, fees, timetables…"
        aria-label="Your question"
        className="min-w-0 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-muted"
      />
      <button
        type="submit"
        disabled={!canSend}
        aria-label="Send question"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg text-page transition-all enabled:hover:scale-105 enabled:active:scale-95 disabled:opacity-25"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </form>
  )
}
