import { useEffect, useRef, useState } from 'react'
import type { Segment, Transcript } from '../types'
import { api } from '../services/api'

interface Props {
  recordingId: number
  currentTime?: number
  onSeek?: (time: number) => void
}

function fmtTime(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export default function TranscriptViewer({ recordingId, currentTime = 0, onSeek }: Props) {
  const [transcript, setTranscript] = useState<Transcript | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const activeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    api.getTranscript(recordingId)
      .then(setTranscript)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [recordingId])

  // Find the active segment
  const activeIdx = transcript?.segments.findIndex(
    (s, i) => {
      const next = transcript.segments[i + 1]
      return currentTime >= s.start && (!next || currentTime < next.start)
    }
  ) ?? -1

  // Auto-scroll to active segment
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeIdx])

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
      Cargando transcripción...
    </div>
  )

  if (error) return (
    <div className="text-red-400 text-sm p-4">{error}</div>
  )

  if (!transcript?.segments?.length) return (
    <div className="text-gray-500 text-sm p-4 text-center">
      {transcript?.text ? (
        <p className="text-gray-300 text-sm leading-relaxed">{transcript.text}</p>
      ) : (
        'Sin segmentos de transcripción disponibles.'
      )}
    </div>
  )

  return (
    <div className="space-y-1 p-4">
      {transcript.segments.map((seg, i) => {
        const isActive = i === activeIdx
        return (
          <div
            key={i}
            ref={isActive ? activeRef : undefined}
            className={`
              flex gap-3 rounded-lg p-2.5 cursor-pointer transition-all group
              ${isActive
                ? 'bg-brand-900/60 border border-brand-500/40'
                : 'hover:bg-gray-800/50 border border-transparent'
              }
            `}
            onClick={() => onSeek?.(seg.start)}
          >
            <span
              className={`text-xs font-mono flex-shrink-0 mt-0.5 tabular-nums
                ${isActive ? 'text-brand-400' : 'text-gray-600 group-hover:text-gray-400'}`}
            >
              {fmtTime(seg.start)}
            </span>
            <p className={`text-sm leading-relaxed ${isActive ? 'text-white' : 'text-gray-300'}`}>
              {seg.text}
            </p>
          </div>
        )
      })}
    </div>
  )
}
