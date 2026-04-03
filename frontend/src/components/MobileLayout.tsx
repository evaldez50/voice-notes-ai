import { useState, useCallback, useEffect, useRef } from 'react'
import type { Recording, ChatMessage } from '../types'
import { api } from '../services/api'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVoiceInput } from '../hooks/useVoice'
import { useTTS } from '../hooks/useTTS'
import RecordingCard from './RecordingCard'

type MobileTab = 'record' | 'notes' | 'chat'

export default function MobileLayout() {
  const [activeTab, setActiveTab] = useState<MobileTab>('record')

  // ── Recordings state ──────────────────────────────────────────────────
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loadingRecs, setLoadingRecs] = useState(true)
  const [selectedRec, setSelectedRec] = useState<Recording | null>(null)

  const loadRecordings = useCallback(async () => {
    try {
      const data = await api.getRecordings()
      setRecordings(data)
    } catch {
      // ignore
    } finally {
      setLoadingRecs(false)
    }
  }, [])

  useEffect(() => {
    loadRecordings()
    const id = setInterval(loadRecordings, 5000)
    return () => clearInterval(id)
  }, [loadRecordings])

  // ── Record tab state ───────────────────────────────────────────────────
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [uploadMsg, setUploadMsg] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { isRecording, error: recError, start: startRec, stop: stopRec } = useAudioRecorder()

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      try {
        const file = await stopRec()
        setUploadProgress(0)
        setUploadMsg('Subiendo...')
        await api.uploadRecording(file, (pct) => setUploadProgress(pct))
        setUploadMsg('¡Nota guardada!')
        setUploadProgress(null)
        await loadRecordings()
        setTimeout(() => setUploadMsg(null), 2500)
      } catch (e: unknown) {
        setUploadMsg(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
        setUploadProgress(null)
        setTimeout(() => setUploadMsg(null), 3000)
      }
    } else {
      setUploadMsg(null)
      await startRec()
    }
  }, [isRecording, startRec, stopRec, loadRecordings])

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploadProgress(0)
      setUploadMsg('Subiendo archivo...')
      try {
        await api.uploadRecording(file, (pct) => setUploadProgress(pct))
        setUploadMsg('¡Archivo subido!')
        setUploadProgress(null)
        await loadRecordings()
        setTimeout(() => setUploadMsg(null), 2500)
      } catch (e: unknown) {
        setUploadMsg(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
        setUploadProgress(null)
        setTimeout(() => setUploadMsg(null), 3000)
      }
    },
    [loadRecordings]
  )

  // ── Chat tab state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { isListening, interim, start: startVoice, stop: stopVoice } = useVoiceInput()
  const { isSpeaking, speak, stop: stopSpeech } = useTTS()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatLoading])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || chatLoading) return
      const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
      setMessages((m) => [...m, userMsg])
      setChatInput('')
      setChatLoading(true)

      const aiMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }
      let aiText = ''

      try {
        setMessages((m) => [...m, { ...aiMsg }])
        for await (const chunk of api.streamChat(text.trim(), selectedRec?.id ?? null)) {
          aiText += chunk
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { ...aiMsg, content: aiText }
            return copy
          })
        }
        if (ttsEnabled && aiText) speak(aiText)
      } catch (e: unknown) {
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = { ...aiMsg, content: `❌ ${e instanceof Error ? e.message : 'Error'}` }
          return copy
        })
      } finally {
        setChatLoading(false)
      }
    },
    [chatLoading, selectedRec, ttsEnabled, speak]
  )

  const handleVoiceChat = () => {
    if (isListening) { stopVoice(); return }
    startVoice((text) => { setChatInput(text); sendMessage(text) })
  }

  // ── Delete recording ───────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (r: Recording) => {
      if (!confirm(`¿Eliminar "${r.title || r.original_name}"?`)) return
      try {
        await api.deleteRecording(r.id)
        if (selectedRec?.id === r.id) setSelectedRec(null)
        await loadRecordings()
      } catch (e: unknown) {
        alert(`Error: ${e instanceof Error ? e.message : 'desconocido'}`)
      }
    },
    [selectedRec, loadRecordings]
  )

  // ── Tabs config ────────────────────────────────────────────────────────
  const tabs: { id: MobileTab; icon: string; label: string }[] = [
    { id: 'record', icon: '🎙️', label: 'Grabar' },
    { id: 'notes', icon: '📋', label: 'Notas' },
    { id: 'chat', icon: '💬', label: 'Chat' },
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white overflow-hidden">
      {/* App header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950/90 backdrop-blur">
        <h1 className="text-sm font-bold text-white">🎙️ Voice Notes AI</h1>
        <span className="text-[10px] text-gray-500">{recordings.length} nota{recordings.length !== 1 ? 's' : ''}</span>
      </header>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {/* ── TAB: GRABAR ────────────────────────────────────────── */}
        {activeTab === 'record' && (
          <div className="flex flex-col items-center justify-center min-h-full gap-6 px-6 py-8">
            {/* Big record button */}
            <button
              onClick={handleRecordToggle}
              disabled={uploadProgress !== null}
              className={`
                w-28 h-28 rounded-full text-5xl flex items-center justify-center
                transition-all active:scale-95 disabled:opacity-40 shadow-2xl
                ${isRecording
                  ? 'bg-red-600 shadow-red-500/40 animate-pulse'
                  : 'bg-brand-600 shadow-brand-500/30 hover:bg-brand-500'
                }
              `}
            >
              {isRecording ? '⏹' : '🎙️'}
            </button>

            <p className="text-sm text-gray-400">
              {isRecording ? 'Grabando... toca para detener' : 'Toca para grabar una nota'}
            </p>

            {recError && (
              <p className="text-xs text-red-400 text-center">{recError}</p>
            )}

            {/* Upload progress */}
            {uploadProgress !== null && (
              <div className="w-full max-w-xs">
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {uploadMsg && (
              <p className={`text-sm text-center ${uploadMsg.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
                {uploadMsg}
              </p>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3 w-full max-w-xs">
              <div className="flex-1 h-px bg-gray-800" />
              <span className="text-xs text-gray-600">o</span>
              <div className="flex-1 h-px bg-gray-800" />
            </div>

            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isRecording || uploadProgress !== null}
              className="flex items-center gap-2 px-5 py-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-40 rounded-2xl text-sm text-gray-300 transition-colors"
            >
              📁 Subir archivo de audio
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*,.m4a,.webm,.ogg,.wav,.mp3,.aac"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileUpload(file)
                e.target.value = ''
              }}
            />

            <p className="text-[10px] text-gray-600 text-center max-w-xs">
              Samsung Watch Ultra → Galaxy Wearable → Transferir → Subir aquí
            </p>
          </div>
        )}

        {/* ── TAB: NOTAS ─────────────────────────────────────────── */}
        {activeTab === 'notes' && (
          <div className="px-4 pt-4 pb-24 space-y-2">
            {loadingRecs ? (
              <div className="flex justify-center py-12 text-gray-600 text-sm">Cargando...</div>
            ) : recordings.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center gap-2">
                <p className="text-4xl">📂</p>
                <p className="text-gray-500 text-sm">Sin notas grabadas</p>
                <button
                  onClick={() => setActiveTab('record')}
                  className="mt-3 text-xs text-brand-400 hover:text-brand-300"
                >
                  Grabar primera nota →
                </button>
              </div>
            ) : (
              recordings.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setSelectedRec(r)
                    setActiveTab('chat')
                  }}
                >
                  <RecordingCard
                    recording={r}
                    selected={selectedRec?.id === r.id}
                    onClick={() => { setSelectedRec(r); setActiveTab('chat') }}
                    onDelete={() => handleDelete(r)}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* ── TAB: CHAT ──────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full" style={{ minHeight: 'calc(100vh - 112px)' }}>
            {/* Chat context indicator */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800/50 flex-shrink-0">
              <p className="text-xs text-gray-500">
                {selectedRec
                  ? `📎 ${selectedRec.title || selectedRec.original_name}`
                  : '💬 Todas las notas'}
              </p>
              <div className="flex items-center gap-2">
                {selectedRec && (
                  <button
                    onClick={() => setSelectedRec(null)}
                    className="text-[10px] text-gray-600 hover:text-gray-400"
                  >
                    ✕ quitar filtro
                  </button>
                )}
                <button
                  onClick={() => setTtsEnabled((v) => !v)}
                  className={`text-xs px-2 py-0.5 rounded-lg transition-colors ${
                    ttsEnabled ? 'bg-brand-900 text-brand-400' : 'bg-gray-800 text-gray-500'
                  }`}
                >
                  {ttsEnabled ? '🔊' : '🔇'}
                </button>
                {isSpeaking && (
                  <button onClick={stopSpeech} className="text-[10px] text-brand-400 hover:text-red-400">
                    ⏹
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-8">
                  <p className="text-4xl">💬</p>
                  <p className="text-gray-400 text-sm">Pregunta sobre tus notas</p>
                  <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                    {['¿Qué tareas tengo pendientes?', '¿Cuál es el resumen de hoy?'].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-gray-800/80 hover:bg-gray-700 border border-gray-700 rounded-xl px-3 py-2.5 text-gray-300 text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-gray-800/80 text-gray-100 rounded-bl-sm border border-gray-700/50'
                    }`}
                  >
                    {msg.role === 'assistant' && msg.content === '' && chatLoading ? (
                      <div className="flex gap-1 items-center h-5">
                        {[0, 1, 2].map((n) => (
                          <div
                            key={n}
                            className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse"
                            style={{ animationDelay: `${n * 0.15}s` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-gray-800 flex-shrink-0 bg-gray-950">
              {isListening && (
                <div className="flex items-center gap-2 mb-2 text-xs text-brand-400">
                  <div className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
                  {interim || 'Escuchando...'}
                </div>
              )}
              <div className="flex gap-2 items-end">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput) } }}
                  placeholder="Pregunta algo..."
                  rows={1}
                  disabled={chatLoading || isListening}
                  className="flex-1 bg-gray-800/80 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-brand-500/60 disabled:opacity-50"
                  style={{ minHeight: 42, maxHeight: 100 }}
                  onInput={(e) => {
                    const t = e.currentTarget
                    t.style.height = 'auto'
                    t.style.height = Math.min(t.scrollHeight, 100) + 'px'
                  }}
                />
                <button
                  onClick={handleVoiceChat}
                  disabled={chatLoading}
                  className={`p-2.5 rounded-xl transition-all flex-shrink-0 ${
                    isListening
                      ? 'bg-red-600 text-white animate-pulse'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
                  }`}
                >
                  🎤
                </button>
                <button
                  onClick={() => sendMessage(chatInput)}
                  disabled={chatLoading || !chatInput.trim()}
                  className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white transition-all flex-shrink-0"
                >
                  ➤
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 flex border-t border-gray-800 bg-gray-950/95 backdrop-blur">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-brand-400'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  )
}
