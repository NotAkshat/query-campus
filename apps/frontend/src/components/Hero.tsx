import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const TOPICS = ['admissions', 'fees', 'timetables', 'scholarships', 'faculty', 'syllabus', 'exam notices']
const PILLS = ['Admission documents', 'B.Tech fees', 'Class timetables', 'Scholarship forms', 'Faculty details', 'Exam notices', 'Syllabus', 'Grievance cell', 'Branches offered', 'Class coordinators']

/** Slowly drifting blurred colour blobs behind the hero. */
function Blobs() {
  const blob = (cls: string, x: number[], y: number[], dur: number) => (
    <motion.div
      aria-hidden
      className={`absolute rounded-full blur-3xl ${cls}`}
      animate={{ x, y, scale: [1, 1.15, 0.95, 1] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {blob('top-[8%] left-[12%] h-72 w-72 bg-accent/20', [0, 60, -20, 0], [0, 40, 80, 0], 18)}
      {blob('top-[30%] right-[8%] h-80 w-80 bg-soft/30', [0, -50, 20, 0], [0, 60, -30, 0], 22)}
      {blob('bottom-[6%] left-[35%] h-64 w-64 bg-sand/60', [0, 40, -40, 0], [0, -50, 20, 0], 20)}
    </div>
  )
}

/** The word after "Ask about" changes every few seconds. */
function RotatingWord() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % TOPICS.length), 2200)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="relative inline-flex h-[1.4em] min-w-[7ch] items-center justify-center overflow-hidden pb-1 align-bottom text-accent italic">
      <AnimatePresence mode="wait">
        <motion.span
          key={TOPICS[i]}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {TOPICS[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

const container = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } } }
const rise = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } } }

export function Hero({ suggestions, onPick }: { suggestions: string[]; onPick: (q: string) => void }) {
  return (
    <div className="absolute inset-0 flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-10">
      <Blobs />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-5 text-center"
      >
        <motion.span
          variants={rise}
          className="rounded-full border border-line bg-paper/70 px-3 py-1 text-xs text-muted backdrop-blur"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500 align-middle" />
          Your campus assistant, online now
        </motion.span>
        <motion.h1 variants={rise} className="font-serif text-4xl leading-tight tracking-tight text-fg sm:text-6xl">
          Ask about
          <br />
          <RotatingWord />
        </motion.h1>
        <motion.p variants={rise} className="max-w-md text-base text-muted">
          Straight answers from the IET DAVV website and timetable portal, with sources you can open.
        </motion.p>

        <motion.div variants={rise} className="mt-3 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {suggestions.map((s) => (
            <motion.button
              key={s}
              type="button"
              onClick={() => onPick(s)}
              whileHover={{ y: -4, boxShadow: '0 10px 24px -12px rgba(46,45,43,0.3)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
              className="group flex items-center justify-between gap-3 rounded-2xl bg-paper/90 px-5 py-4 text-left text-sm text-fg backdrop-blur hover:bg-[#faf8f3]"
            >
              <span>{s}</span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-fg text-page opacity-0 transition-opacity group-hover:opacity-100">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.8 }}
        className="relative z-10 mt-10 w-full max-w-3xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]"
      >
        <div className="marquee flex w-max gap-2">
          {[...PILLS, ...PILLS].map((p, k) => (
            <span key={k} className="rounded-full border border-line bg-paper/80 px-3.5 py-1.5 text-xs whitespace-nowrap text-muted">
              {p}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
