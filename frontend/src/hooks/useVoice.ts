import { useState, useCallback, useRef } from 'react'

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

export function useVoiceInput(lang = 'es-ES') {
  const [isListening, setIsListening] = useState(false)
  const [interim, setInterim] = useState('')
  const recRef = useRef<SpeechRecognition | null>(null)

  const start = useCallback(
    (onFinal: (text: string) => void) => {
      const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
      if (!SR) {
        alert('Reconocimiento de voz no disponible. Usa Chrome o Edge.')
        return
      }
      const rec = new SR()
      rec.lang = lang
      rec.continuous = false
      rec.interimResults = true

      rec.onresult = (e) => {
        const last = e.results[e.results.length - 1]
        const text = last[0].transcript
        setInterim(text)
        if (last.isFinal) {
          onFinal(text)
          setInterim('')
          setIsListening(false)
        }
      }
      rec.onend = () => setIsListening(false)
      rec.onerror = () => {
        setIsListening(false)
        setInterim('')
      }

      rec.start()
      recRef.current = rec
      setIsListening(true)
    },
    [lang]
  )

  const stop = useCallback(() => {
    recRef.current?.stop()
    setIsListening(false)
    setInterim('')
  }, [])

  return { isListening, interim, start, stop }
}
