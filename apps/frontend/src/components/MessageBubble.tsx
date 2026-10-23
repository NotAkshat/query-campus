import { memo, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { motion } from 'motion/react'
import type { Message } from '../chats'
import { Avatar } from './Avatar'
import { DocumentCard } from './DocumentCard'

/** Hides citation markers and the trailing ATTACH line from text that is still streaming in. */
function displayText(raw: string): string {
  return raw
    .replace(/\n?\s*ATTACH:[^\n]*$/i, '')
    .replace(/\n?\s*A(T(T(A(C(H)?)?)?)?)?$/, '') // a partial "ATTACH" at the very end
    .replace(/\[\d+\]/g, '')
    .replace(/[ \t]+([.,;:])/g, '$1')
}

// ~180 chars/s at 60fps; long answers speed up so the reveal never takes more than a couple of seconds.
const CHARS_PER_FRAME = 3
const CATCH_UP_FRAMES = 60

/**
 * Reveals `text` a few characters per frame, speeding up when it falls behind the stream so the
 * effect never lags far behind the real answer.
 */
function useTypewriter(text: string, enabled: boolean): string {
  // The revealed length lives in a ref so each animation loop continues where the last left off when
  // more streamed text arrives; state only triggers the re-render.
  const revealed = useRef(enabled ? 0 : text.length)
  const [count, setCount] = useState(revealed.current)

  useEffect(() => {
    if (!enabled) return
    let frame = 0
    const tick = () => {
      const c = revealed.current
      if (c >= text.length) return
      revealed.current = Math.min(text.length, c + Math.max(CHARS_PER_FRAME, Math.ceil((text.length - c) / CATCH_UP_FRAMES)))
      setCount(revealed.current)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [text, enabled])

  return enabled ? text.slice(0, count) : text
}

export const MessageBubble = memo(function MessageBubble({
  message: m,
  typing,
}: {
  message: Message
  /** Animate this message's text (the answer currently being written). */
  typing: boolean
}) {
  const text = useTypewriter(m.role === 'assistant' ? displayText(m.content) : m.content, typing)
  const caretVisible = typing && text.length < displayText(m.content).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, x: m.role === 'user' ? 16 : 0, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
      className={`flex items-start gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
    >
      {m.role === 'assistant' && <Avatar busy={typing && caretVisible} />}
      <div
        className={`max-w-[85%] rounded-3xl px-5 py-3 shadow-[0_1px_0_rgba(16,15,15,0.03)] text-sm leading-relaxed ${
          m.role === 'user'
            ? 'bg-accent text-white shadow-md shadow-accent/25'
            : m.error
              ? 'bg-red-50 text-red-800'
              : 'bg-paper text-fg'
        }`}
      >
        {m.role === 'assistant' ? (
          <div className="prose prose-sm prose-neutral max-w-none prose-p:my-1.5 prose-ul:my-1.5">
            <ReactMarkdown>{text}</ReactMarkdown>
            {caretVisible && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-muted align-middle" />}
          </div>
        ) : (
          m.content
        )}

        {m.attachments && m.attachments.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {m.attachments.map((src) => (
              <DocumentCard key={src.url} source={src} />
            ))}
          </div>
        )}

        {m.sources && m.sources.length > 0 && (
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
            <span className="text-xs font-medium text-muted">Sources</span>
            <div className="flex flex-wrap gap-2">
              {m.sources.map((src) => (
                <motion.a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  whileHover={{ y: -2 }}
                  className="flex max-w-full items-center gap-1.5 rounded-full border border-line bg-page/70 px-3 py-1 text-xs text-fg hover:border-accent hover:text-accent"
                >
                  <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 4h6v6M20 4l-9 9M10 6H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">{src.title || src.url}</span>
                </motion.a>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
})
