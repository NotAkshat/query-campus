import { motion } from 'motion/react'
import { downloadUrl, isDownloadable, type RagSource } from '../api'

export function DocumentCard({ source }: { source: RagSource }) {
  // College PDFs are named by their file; portal pages (e.g. timetables) by their title.
  const name = isDownloadable(source) ? decodeURIComponent(new URL(source.url).pathname.split('/').pop()!) : source.title

  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: '0 8px 20px -12px rgba(46,45,43,0.3)' }}
      className="flex items-center gap-3 rounded-2xl border border-line bg-page p-3"
    >
      <div className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg bg-line text-[10px] font-bold text-fg">
        {isDownloadable(source) ? 'PDF' : 'DOC'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg" title={name}>
          {name}
        </p>
        <p className="truncate text-xs text-muted">{new URL(source.url).hostname.replace(/^www\./, '')}</p>
      </div>
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className="rounded-full bg-line px-3 py-1.5 text-xs font-medium text-fg hover:bg-[#c9b18f]"
      >
        Open
      </a>
      {isDownloadable(source) && (
        <a
          href={downloadUrl(source.url)}
          aria-label={`Download ${name}`}
          className="rounded-full bg-fg px-3 py-1.5 text-xs font-medium text-page hover:bg-black"
        >
          Download
        </a>
      )}
    </motion.div>
  )
}
