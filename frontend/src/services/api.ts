import type { Recording, Transcript, MindMapData } from '../types'

const BASE = '/api'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  getRecordings: () => request<Recording[]>('/recordings'),

  getRecording: (id: number) => request<Recording>(`/recordings/${id}`),

  uploadRecording: (
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<{ id: number; message: string }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      const form = new FormData()
      form.append('file', file)
      xhr.open('POST', `${BASE}/recordings/upload`)
      if (onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        })
      }
      xhr.onload = () => {
        if (xhr.status === 200) resolve(JSON.parse(xhr.responseText))
        else reject(new Error(`Upload failed: ${xhr.status}`))
      }
      xhr.onerror = () => reject(new Error('Upload failed'))
      xhr.send(form)
    }),

  getTranscript: (id: number) => request<Transcript>(`/recordings/${id}/transcript`),

  getSummary: (id: number) =>
    request<{ summary: string }>(`/recordings/${id}/summary`, { method: 'POST' }),

  getMindMap: (id: number) =>
    request<MindMapData>(`/recordings/${id}/mindmap`, { method: 'POST' }),

  deleteRecording: (id: number) =>
    request<{ message: string }>(`/recordings/${id}`, { method: 'DELETE' }),

  audioUrl: (id: number) => `${BASE}/recordings/${id}/audio`,

  async *streamChat(
    message: string,
    recordingId: number | null
  ): AsyncGenerator<string> {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, recording_id: recordingId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || 'Chat failed')
    }
    if (!res.body) return

    const reader = res.body.getReader()
    const dec = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          if (parsed.text) yield parsed.text
          if (parsed.error) throw new Error(parsed.error)
        } catch {}
      }
    }
  },
}
