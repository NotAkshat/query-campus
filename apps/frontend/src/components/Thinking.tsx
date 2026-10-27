import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from './Avatar'

const STEPS = ['Searching the college website…', 'Reading the best matches…', 'Writing your answer…']
// Shown if nothing has arrived after a while: the free server may have been asleep and is waking up.
const SLOW_MESSAGE = 'Still working. The server may be waking up, this can take up to a minute…'
const SLOW_AFTER_MS = 9_000

/** Shown while the assistant has not started writing: status text changes and a shimmer runs under it. */
export function Thinking() {
  const [i, setI] = useState(0)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1600)
    const slowTimer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => {
      clearInterval(t)
      clearTimeout(slowTimer)
    }
  }, [])
  const text = slow ? SLOW_MESSAGE : STEPS[i]
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3"
      aria-label="Thinking"
    >
      <Avatar busy />
      <div className="relative overflow-hidden rounded-3xl bg-paper px-5 py-3 text-sm text-muted">
        <AnimatePresence mode="wait">
          <motion.span
            key={text}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="block"
          >
            {text}
          </motion.span>
        </AnimatePresence>
        <motion.span
          aria-hidden
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          animate={{ x: ['-100%', '400%'] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    </motion.div>
  )
}
