import { useState, useCallback, useEffect } from 'react'
import { api } from '../services/api'
import { useAudioRecorder } from '../hooks/useAudioRecorder'
import { useVoiceInput } from '../hooks/useVoice'
import { useTTS } from '../hooks/useTTS'

type WatchState = 'idle' | 'recording' | 'uploading' | 'asking' | 'speaking' | 'error'

export default function WatchLayout() {
  const [watchState, setWatchState] = useState<WatchState>('idle')
  const [statusText, setStatusText] = useState('Listo')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const { isRecording, start: startRec, stop: stopRec } = useAudioRecorder()
  const { isListening, start: startVoice, stop: stopVoice } = useVoiceInput()
  const { isSpeaking, speak, stop: stopSpeech } = useTTS()

  // When TTS finishes, go back to idle
  useEffect(() => {
    if (watchState === 'speaking' && !isSpeaking) {
      setWatchState('idle')
      setStatusText('Listo')
    }
  }, [isSpeaking, watchState])

  const handleRecordToggle = useCallback(async () => {
    if (watchState === 'recording') {
      setWatchState('uploading')
      setStatusText('Subiendo...')
      try {
        const file = await stopRec()
        await api.uploadRecording(file)
        setStatusText('¡Guardado!')
        setWatchState('idle')
        setTimeout(() => setStatusText('Listo'), 2000)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error al subir'
        setErrorMsg(msg)
        setWatchState('error')
        setTimeout(() => { setWatchState('idle'); setStatusText('Listo'); setErrorMsg(null) }, 3000)
      }
    } else if (watchState === 'idle') {
      try {
        await startRec()
        setWatchState('recording')
        setStatusText('Grabando...')
      } catch {
        setErrorMsg('Sin acceso al mic')
        setWatchState('error')
        setTimeout(() => { setWatchState('idle'); setStatusText('Listo'); setErrorMsg(null) }, 3000)
      }
    }
  }, [watchState, startRec, stopRec])

  const handleAsk = useCallback(() => {
    if (watchState === 'speaking') {
      stopSpeech()
      setWatchState('idle')
      setStatusText('Listo')
      return
    }
    if (watchState === 'asking') {
      stopVoice()
      setWatchState('idle')
      setStatusText('Listo')
      return
    }
    if (watchState !== 'idle') return

    setWatchState('asking')
    setStatusText('Escuchando...')
    startVoice(async (text) => {
      setStatusText('Pensando...')
      let answer = ''
      try {
        for await (const chunk of api.streamChat(text, null)) {
          answer += chunk
        }
        setWatchState('speaking')
        setStatusText('Respondiendo...')
        speak(answer)
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Error en consulta'
        setErrorMsg(msg)
        setWatchState('error')
        setTimeout(() => { setWatchState('idle'); setStatusText('Listo'); setErrorMsg(null) }, 3000)
      }
    })
  }, [watchState, startVoice, stopVoice, stopSpeech, speak])

  const recIcon = watchState === 'recording' ? '⏹' : '🎙️'
  const askIcon = watchState === 'asking' ? '👂' : watchState === 'speaking' ? '⏹' : '🔊'

  const recActive = watchState === 'recording'
  const askActive = watchState === 'asking' || watchState === 'speaking'
  const isError = watchState === 'error'
  const isBusy = watchState === 'uploading'

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white select-none px-2">
      {/* Status indicator */}
      <div
        className={`text-[10px] font-medium mb-4 px-2 py-0.5 rounded-full transition-colors ${
          isError
            ? 'bg-red-900/60 text-red-300'
            : recActive
              ? 'bg-red-900/60 text-red-300'
              : isBusy
                ? 'bg-yellow-900/60 text-yellow-300'
                : askActive
                  ? 'bg-brand-900/60 text-brand-300'
                  : 'bg-gray-800 text-gray-400'
        }`}
      >
        {isError ? (errorMsg ?? 'Error') : statusText}
      </div>

      {/* Record button — large, primary */}
      <button
        onClick={handleRecordToggle}
        disabled={isBusy || watchState === 'asking' || watchState === 'speaking'}
        className={`
          w-16 h-16 rounded-full text-2xl flex items-center justify-center
          transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg mb-3
          ${recActive
            ? 'bg-red-600 shadow-red-500/40 animate-pulse'
            : 'bg-brand-600 shadow-brand-500/30 hover:bg-brand-500'
          }
        `}
        aria-label={recActive ? 'Detener grabación' : 'Iniciar grabación'}
      >
        {recIcon}
      </button>

      {/* Record label */}
      <p className="text-[10px] text-gray-500 mb-5">
        {recActive ? 'Toca para detener' : 'Grabar nota'}
      </p>

      {/* Ask button — smaller, secondary */}
      <button
        onClick={handleAsk}
        disabled={isBusy || watchState === 'recording'}
        className={`
          w-10 h-10 rounded-full text-base flex items-center justify-center
          transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed shadow-md
          ${askActive
            ? 'bg-purple-600 shadow-purple-500/40 animate-pulse'
            : 'bg-gray-700 hover:bg-gray-600'
          }
        `}
        aria-label={askActive ? 'Cancelar consulta' : 'Hacer consulta por voz'}
      >
        {askIcon}
      </button>

      {/* Ask label */}
      <p className="text-[10px] text-gray-500 mt-2">
        {askActive ? 'Toca para cancelar' : 'Preguntar'}
      </p>

      {/* Upload spinner */}
      {isBusy && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-950/70 rounded-full pointer-events-none">
          <div className="w-5 h-5 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
