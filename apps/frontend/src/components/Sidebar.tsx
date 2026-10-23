import { AnimatePresence, motion } from 'motion/react'
import type { Chat } from '../chats'

function relativeTime(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString()
}

export function Sidebar({
  chats,
  activeId,
  open,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: {
  chats: Chat[]
  activeId: string | null
  open: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={onClose} aria-hidden />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-paper transition-transform md:static md:z-auto md:w-64 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="whitespace-nowrap px-1 font-serif text-lg text-fg">Query Campus</span>
          <button
            type="button"
            onClick={onNew}
            className="whitespace-nowrap rounded-full bg-fg px-4 py-1.5 text-xs font-medium text-page hover:bg-black"
          >
            + New chat
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Chat history">
          {chats.length === 0 ? (
            <p className="px-2 py-4 text-xs text-muted">Your chats will appear here.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              <AnimatePresence initial={false}>
              {chats.map((c) => (
                <motion.li
                  key={c.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.25 }}
                  className="group relative"
                >
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={c.id === activeId ? 'page' : undefined}
                    className={`w-full rounded-2xl px-3 py-2 pr-9 text-left ${
                      c.id === activeId ? 'bg-line text-fg' : 'text-fg/80 hover:bg-line/50'
                    }`}
                  >
                    <span className="block truncate text-sm">{c.title}</span>
                    <span className="block text-[11px] text-muted">{relativeTime(c.updatedAt)}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete chat: ${c.title}`}
                    className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full p-1.5 text-muted opacity-100 hover:bg-line hover:text-fg md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
                    </svg>
                  </button>
                </motion.li>
              ))}
              </AnimatePresence>
            </ul>
          )}
        </nav>

        <p className="border-t border-line px-4 py-3 text-[11px] text-muted">
          Chats are saved in this browser only.
        </p>
      </aside>
    </>
  )
}
