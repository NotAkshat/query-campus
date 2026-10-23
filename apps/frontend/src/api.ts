export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface RagSource {
  url: string
  title: string
  type: 'html' | 'pdf'
}

export function downloadUrl(documentUrl: string): string {
  return `${API_URL}/documents/download?url=${encodeURIComponent(documentUrl)}`
}

export interface RagAnswer {
  answer: string
  /** Pages the answer cites, shown as links. */
  sources: RagSource[]
  /** Documents the user asked for, shown as attachment cards. */
  attachments: RagSource[]
}

/** True for PDFs on the college site, which the backend can serve as a download. */
export function isDownloadable(source: RagSource): boolean {
  return /\.pdf$/i.test(new URL(source.url).pathname)
}

/**
 * Asks a question and streams the answer: onDelta receives text as it is generated (raw, may include
 * citation markers), and the promise resolves with the final cleaned answer and its sources.
 */
export async function streamQuestion(
  question: string,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<RagAnswer> {
  const res = await fetch(`${API_URL}/query/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
  })

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Request failed: ${res.status}`)
  }

  // Server-sent events: "event: <name>\ndata: <json>" blocks separated by a blank line.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    let end: number
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end)
      buffer = buffer.slice(end + 2)
      const event = block.match(/^event: (.*)$/m)?.[1]
      const data = JSON.parse(block.match(/^data: (.*)$/m)?.[1] ?? 'null')
      if (event === 'delta') onDelta(data.text)
      else if (event === 'done') return data as RagAnswer
      else if (event === 'error') throw new Error(data.message)
    }
  }
  throw new Error('The answer was cut off. Please try again.')
}
