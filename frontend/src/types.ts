export interface Recording {
  id: number
  filename: string
  original_name: string
  duration: number | null
  file_size: number
  created_at: string
  transcribed: boolean
  transcription: string | null
  language: string | null
  title: string | null
  summary: string | null
  tasks_count: number
}

export interface Segment {
  start: number
  end: number
  text: string
}

export interface Transcript {
  text: string | null
  segments: Segment[]
  language: string | null
  duration: number | null
}

export interface MindMapNode {
  label: string
  children: MindMapNode[]
}

export interface MindMapData {
  title: string
  children: MindMapNode[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export type ViewMode = 'chat' | 'transcript' | 'mindmap' | 'summary'
