import { motion } from 'motion/react'

/** Small round mark for the assistant; it pulses softly while the assistant is working. */
export function Avatar({ busy = false }: { busy?: boolean }) {
  return (
    <div className="relative mt-1 h-8 w-8 shrink-0">
      {busy && (
        <motion.span
          className="absolute inset-0 rounded-full bg-accent/40"
          animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
        />
      )}
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-fg font-serif text-sm text-white">
        Q
      </span>
    </div>
  )
}
