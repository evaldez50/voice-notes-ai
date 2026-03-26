import { useState, useCallback, useRef } from 'react'
import { api } from '../services/api'

interface Props {
  onUploaded: () => void
}

export default function UploadArea({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const upload = useCallback(
    async (file: File) => {
      setUploading(true)
      setProgress(0)
      setStatus(`Subiendo ${file.name}...`)
      try {
        await api.uploadRecording(file, setProgress)
        setStatus('✅ Subido. Transcribiendo...')
        onUploaded()
        setTimeout(() => setStatus(''), 4000)
      } catch (e: any) {
        setStatus(`❌ Error: ${e.message}`)
        setTimeout(() => setStatus(''), 5000)
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [onUploaded]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) upload(file)
    },
    [upload]
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
    e.target.value = ''
  }

  return (
    <div className="px-3 pb-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all
          ${dragging ? 'border-brand-500 bg-brand-900/30' : 'border-gray-700 hover:border-brand-500/60 hover:bg-gray-800/40'}
          ${uploading ? 'pointer-events-none' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".m4a,.mp3,.wav,.ogg,.aac,.flac,.mp4"
          onChange={handleChange}
          className="hidden"
        />
        {uploading ? (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">{status}</div>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div
                className="bg-brand-500 h-1.5 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-brand-400">{progress}%</div>
          </div>
        ) : (
          <>
            <div className="text-2xl mb-1">📁</div>
            <p className="text-xs text-gray-400">
              Arrastra audio o <span className="text-brand-400">elige archivo</span>
            </p>
            <p className="text-[10px] text-gray-600 mt-1">M4A · MP3 · WAV · AAC</p>
          </>
        )}
      </div>
      {status && !uploading && (
        <p className="text-xs text-center mt-2 text-gray-400">{status}</p>
      )}
    </div>
  )
}
