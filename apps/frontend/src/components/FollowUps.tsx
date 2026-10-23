import { motion } from 'motion/react'

const IDEAS = [
  'What are the B.Tech fees?',
  'Which B.E. branches does IET DAVV offer?',
  'How do I apply for a scholarship?',
  'Where can I submit a grievance?',
  'What documents do I need for admission?',
  'Who is the HOD of Applied Science?',
]

/** A few ready questions below the latest answer, skipping ones already asked. */
export function FollowUps({ asked, onPick }: { asked: string[]; onPick: (q: string) => void }) {
  const ideas = IDEAS.filter((q) => !asked.includes(q)).slice(0, 3)
  if (ideas.length === 0) return null
  return (
    <motion.div
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } } }}
      className="flex flex-wrap gap-2 pl-11"
    >
      <span className="w-full text-xs text-muted">You could also ask</span>
      {ideas.map((q) => (
        <motion.button
          key={q}
          type="button"
          onClick={() => onPick(q)}
          variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.97 }}
          className="rounded-full border border-line bg-paper px-3.5 py-1.5 text-xs text-fg hover:border-fg"
        >
          {q}
        </motion.button>
      ))}
    </motion.div>
  )
}
