import { useState, useCallback } from 'react'

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false)

  const speak = useCallback((text: string, lang = 'es-ES') => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()

    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = lang
    utt.rate = 0.95
    utt.pitch = 1.0
    utt.volume = 1.0

    // Try to use a natural-sounding voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(
      (v) => v.lang.startsWith(lang.split('-')[0]) && v.localService
    )
    if (preferred) utt.voice = preferred

    utt.onstart = () => setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)

    window.speechSynthesis.speak(utt)
  }, [])

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return { isSpeaking, speak, stop }
}
