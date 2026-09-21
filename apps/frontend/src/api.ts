const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export interface RagSource {
  url: string
  title: string
}

export interface RagAnswer {
  answer: string
  sources: RagSource[]
}

export async function askQuestion(question: string): Promise<RagAnswer> {
  const res = await fetch(`${API_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`)
  }

  return res.json()
}
