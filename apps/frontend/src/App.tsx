import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { streamQuestion } from './api'
import { loadChats, newChat, saveChats, type Chat, type Message } from './chats'
import { MessageBubble } from './components/MessageBubble'
import { Avatar } from './components/Avatar'
import { Composer } from './components/Composer'
import { Hero } from './components/Hero'
import { FollowUps } from './components/FollowUps'
import { Thinking } from './components/Thinking'
import { Sidebar } from './components/Sidebar'

const SUGGESTIONS = [
  'What documents do I need for admission?',
  'How do I apply for a scholarship?',
  'Where can I submit a grievance?',
  'How do I check the exam timetable?',
]

function App() {
  const [chats, setChats] = useState<Chat[]>(loadChats)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Chat currently waiting for an answer, and the answer message being written (null when idle)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [typingId, setTypingId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Persist when idle; saving on every streamed token would serialize all chats dozens of times a second.
  useEffect(() => {
    if (!pendingId) saveChats(chats)
  }, [chats, pendingId])

  const active = chats.find((c) => c.id === activeId) ?? null
  const messages = active?.messages ?? []
  const loading = pendingId !== null
  const lastContent = messages.at(-1)?.content

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length, lastContent])

  // Updates a chat by id, so an answer lands in the right chat even if the user switched away.
  const updateChat = (chatId: string, update: (messages: Message[]) => Message[]) =>
    setChats((prev) =>
      prev
        .map((c) => (c.id === chatId ? { ...c, messages: update(c.messages), updatedAt: Date.now() } : c))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    )

  const send = async (question: string) => {
    if (!question.trim() || loading) return

    let chatId = activeId
    if (!chatId || !active) {
      const chat = newChat(question.trim())
      chatId = chat.id
      setChats((prev) => [chat, ...prev])
      setActiveId(chat.id)
    }

    const answerId = crypto.randomUUID()
    const patchAnswer = (patch: Partial<Message> | ((m: Message) => Partial<Message>)) =>
      updateChat(chatId, (msgs) =>
        msgs.map((m) => (m.id === answerId ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) } : m)),
      )

    updateChat(chatId, (msgs) => [
      ...msgs,
      { id: crypto.randomUUID(), role: 'user', content: question },
      { id: answerId, role: 'assistant', content: '' },
    ])
    setPendingId(chatId)
    setTypingId(answerId)

    try {
      const result = await streamQuestion(question, (text) => patchAnswer((m) => ({ content: m.content + text })))
      patchAnswer({ content: result.answer, sources: result.sources, attachments: result.attachments })
    } catch (err) {
      // fetch() rejects with a TypeError on network failure; anything else carries the server's message
      const reachable = err instanceof Error && !(err instanceof TypeError)
      setTypingId(null)
      patchAnswer({
        content: reachable ? err.message : "Couldn't reach the server. Please check your connection and try again in a moment.",
        error: true,
      })
    } finally {
      setPendingId(null)
    }
  }

  const selectChat = (id: string | null) => {
    setActiveId(id)
    setSidebarOpen(false)
  }

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id))
    if (id === activeId) setActiveId(null)
  }

  const empty = messages.length === 0

  return (
    <MotionConfig reducedMotion="user">
    <div className="flex h-svh bg-page text-fg">
      <Sidebar
        chats={chats}
        activeId={activeId}
        open={sidebarOpen}
        onSelect={selectChat}
        onNew={() => selectChat(null)}
        onDelete={deleteChat}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className={`flex items-center gap-3 px-4 py-3 ${empty ? 'absolute z-20 md:hidden' : 'border-b border-line bg-page/80 backdrop-blur'}`}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chat history"
            className="rounded-full p-1.5 text-fg hover:bg-paper md:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
          {!empty && (
            <div className="flex min-w-0 items-center gap-3">
              <Avatar />
              <div className="min-w-0">
                <h1 className="truncate font-serif text-base text-fg">{active?.title}</h1>
                <p className="flex items-center gap-1.5 text-xs text-muted">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Answers from the IET DAVV website
                </p>
              </div>
            </div>
          )}
        </header>

        <div className="relative flex-1 overflow-hidden">
          {empty ? (
            <Hero suggestions={SUGGESTIONS} onPick={send} />
          ) : (
            <div ref={listRef} className="chat-bg h-full overflow-y-auto px-4 py-6">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
                {messages.map((m) =>
                  m.role === 'assistant' && !m.content && pendingId === activeId ? (
                    <Thinking key={m.id} />
                  ) : (
                    <MessageBubble key={m.id} message={m} typing={m.id === typingId} />
                  ),
                )}
                {!loading && messages.at(-1)?.role === 'assistant' && !messages.at(-1)?.error && (
                  <FollowUps asked={messages.filter((m) => m.role === 'user').map((m) => m.content)} onPick={send} />
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4">
          <Composer disabled={loading} onSubmit={send} />
        </div>
      </div>
    </div>
    </MotionConfig>
  )
}

export default App
