import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from './Avatar'

const STEPS = ['Searching the college website…', 'Reading the best matches…', 'Writing your answer…']

/** Shown while the assistant has not started writing: status text changes and a shimmer runs under it. */
export function Thinking() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 1600)
    return () => clearInterval(t)
  }, [])
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
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="block"
          >
            {STEPS[i]}
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
