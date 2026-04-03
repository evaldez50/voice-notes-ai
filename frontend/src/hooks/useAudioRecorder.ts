import { useState, useRef, useCallback } from 'react'

interface AudioRecorderState {
  isRecording: boolean
  error: string | null
}

export function useAudioRecorder() {
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    error: null,
  })
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const start = useCallback(async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start()
      recorderRef.current = recorder
      setState({ isRecording: true, error: null })
    } catch {
      setState({
        isRecording: false,
        error: 'No se pudo acceder al micrófono. Verifica los permisos.',
      })
    }
  }, [])

  const stop = useCallback((): Promise<File> => {
    return new Promise((resolve, reject) => {
      const recorder = recorderRef.current
      if (!recorder) {
        reject(new Error('No hay grabación activa'))
        return
      }

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File(
          [blob],
          `voice-note-${Date.now()}.webm`,
          { type: 'audio/webm' }
        )
        recorder.stream.getTracks().forEach((t) => t.stop())
        setState({ isRecording: false, error: null })
        resolve(file)
      }

      recorder.stop()
    })
  }, [])

  return { ...state, start, stop }
}
