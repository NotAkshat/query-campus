import { useRef, useState, type FormEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import { askQuestion, type RagSource } from './api'

interface Message {
  role: 'user' | 'assistant'
  content: string
  sources?: RagSource[]
  error?: boolean
}

const SUGGESTIONS = [
  'What documents do I need for admission?',
  'How do I apply for a scholarship?',
  'Where can I submit a grievance?',
  'How do I check the exam timetable?',
]

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const send = async (question: string) => {
    if (!question.trim() || loading) return

    setMessages((prev) => [...prev, { role: 'user', content: question }])
    setInput('')
    setLoading(true)

    try {
      const result = await askQuestion(question)
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: result.answer, sources: result.sources },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Couldn't reach the server. Make sure the backend is running and try again.",
          error: true,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 50)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }

  return (
    <div className="flex h-svh flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 px-6 py-4 dark:border-neutral-800">
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Query Campus</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Ask anything about IET DAVV — no more digging through the website.
        </p>
      </header>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-neutral-900 text-neutral-50 dark:bg-neutral-100 dark:text-neutral-900'
                    : m.error
                      ? 'border border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300'
                      : 'border border-neutral-200 bg-white text-neutral-800 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200'
                }`}
              >
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}

                {m.sources && m.sources.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-neutral-200 pt-2 dark:border-neutral-800">
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Sources</span>
                    {m.sources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {s.title || s.url}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
                Thinking…
              </div>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={onSubmit} className="border-t border-neutral-200 p-4 dark:border-neutral-800">
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about admissions, exams, fees, timetables…"
            className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-900 outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-medium text-neutral-50 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}

export default App
