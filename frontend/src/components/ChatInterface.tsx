import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from '../types'
import { api } from '../services/api'
import { useVoiceInput } from '../hooks/useVoice'
import { useTTS } from '../hooks/useTTS'

interface Props {
  recordingId: number | null
  recordingTitle?: string
}

export default function ChatInterface({ recordingId, recordingTitle }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { isListening, interim, start: startVoice, stop: stopVoice } = useVoiceInput()
  const { isSpeaking, speak, stop: stopSpeech } = useTTS()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: Date.now() }
      setMessages((m) => [...m, userMsg])
      setInput('')
      setLoading(true)

      let aiText = ''
      const aiMsg: ChatMessage = { role: 'assistant', content: '', timestamp: Date.now() }

      try {
        setMessages((m) => [...m, { ...aiMsg }])
        for await (const chunk of api.streamChat(text.trim(), recordingId)) {
          aiText += chunk
          setMessages((m) => {
            const copy = [...m]
            copy[copy.length - 1] = { ...aiMsg, content: aiText }
            return copy
          })
        }
        // Speak the response
        if (ttsEnabled && aiText) {
          speak(aiText)
        }
      } catch (e: any) {
        setMessages((m) => {
          const copy = [...m]
          copy[copy.length - 1] = {
            ...aiMsg,
            content: `❌ Error: ${e.message}`,
          }
          return copy
        })
      } finally {
        setLoading(false)
      }
    },
    [loading, recordingId, ttsEnabled, speak]
  )

  const handleVoice = () => {
    if (isListening) {
      stopVoice()
    } else {
      startVoice((text) => {
        setInput(text)
        sendMessage(text)
      })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const quickQuestions = [
    '¿De qué trata esta grabación?',
    '¿Qué decisiones se tomaron?',
    '¿Cuáles son los puntos más importantes?',
    '¿En qué minuto se mencionó [tema]?',
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 flex-shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-white">
            {recordingId ? `💬 ${recordingTitle || 'Grabación'}` : '💬 Todas las grabaciones'}
          </h2>
          <p className="text-xs text-gray-500">
            {recordingId ? 'Pregunta sobre esta grabación' : 'Pregunta sobre cualquier grabación'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSpeaking && (
            <button
              onClick={stopSpeech}
              className="text-xs text-brand-400 hover:text-red-400 transition-colors flex items-center gap-1"
              title="Detener voz"
            >
              <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse inline-block" />
              Hablando...
            </button>
          )}
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            className={`text-xs px-2 py-1 rounded-lg transition-colors ${
              ttsEnabled ? 'bg-brand-900 text-brand-400' : 'bg-gray-800 text-gray-500'
            }`}
            title={ttsEnabled ? 'Desactivar voz' : 'Activar voz'}
          >
            {ttsEnabled ? '🔊' : '🔇'}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
              title="Limpiar chat"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div>
              <p className="text-5xl mb-3">🎤</p>
              <p className="text-gray-400 text-sm font-medium">¿Sobre qué quieres saber?</p>
              <p className="text-gray-600 text-xs mt-1">Escribe o habla para hacer una pregunta</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-md w-full">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-gray-800/80 hover:bg-gray-700/80 border border-gray-700 rounded-xl px-3 py-2.5 text-gray-300 hover:text-white transition-all text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-brand-600 text-white rounded-br-sm'
                  : 'bg-gray-800/80 text-gray-100 rounded-bl-sm border border-gray-700/50'
              }`}
            >
              {msg.role === 'assistant' && msg.content === '' && loading ? (
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
              {msg.role === 'assistant' && msg.content && ttsEnabled && !isSpeaking && (
                <button
                  onClick={() => speak(msg.content)}
                  className="mt-2 text-[10px] text-gray-600 hover:text-brand-400 transition-colors"
                  title="Repetir en voz"
                >
                  🔊 Repetir
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        {isListening && (
          <div className="flex items-center gap-2 mb-2 text-xs text-brand-400">
            <div className="flex gap-0.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-0.5 h-3 bg-brand-400 animate-wave rounded-full"
                  style={{ animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
            {interim || 'Escuchando...'}
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta algo... (Enter para enviar)"
            rows={1}
            disabled={loading || isListening}
            className="flex-1 bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 resize-none focus:outline-none focus:border-brand-500/60 transition-colors disabled:opacity-50"
            style={{ minHeight: 44, maxHeight: 120 }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
          />
          <button
            onClick={handleVoice}
            disabled={loading}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              isListening
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 animate-pulse'
                : 'bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white'
            }`}
            title={isListening ? 'Detener grabación' : 'Hablar pregunta'}
          >
            🎤
          </button>
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className="p-3 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all flex-shrink-0 shadow-lg shadow-brand-500/20"
            title="Enviar"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}
