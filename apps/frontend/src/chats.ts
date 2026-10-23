import type { RagSource } from './api'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: RagSource[]
  attachments?: RagSource[]
  error?: boolean
}

export interface Chat {
  id: string
  title: string
  messages: Message[]
  updatedAt: number
}

const STORAGE_KEY = 'query-campus.chats'

// History lives in this browser only. Storage can be unavailable (private mode, blocked site data),
// so every access is guarded and the app keeps working in memory.
export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const chats = raw ? (JSON.parse(raw) as Chat[]) : []
    // Chats saved before messages had ids
    for (const c of chats) for (const m of c.messages) m.id ??= crypto.randomUUID()
    return chats
  } catch {
    return []
  }
}

export function saveChats(chats: Chat[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
  } catch {
    // storage full or blocked; history just won't persist
  }
}

export function newChat(firstQuestion: string): Chat {
  const title = firstQuestion.length > 60 ? `${firstQuestion.slice(0, 57)}…` : firstQuestion
  return { id: crypto.randomUUID(), title, messages: [], updatedAt: Date.now() }
}
