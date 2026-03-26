import { useEffect, useRef, useState } from 'react'
import { api } from '../services/api'

interface Props {
  recordingId: number
  onTimeUpdate?: (time: number) => void
  seekTo?: number
}

export default function AudioPlayer({ recordingId, onTimeUpdate, seekTo }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)

  const url = api.audioUrl(recordingId)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.src = url
    audio.load()
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
  }, [url])

  useEffect(() => {
    if (seekTo !== undefined && audioRef.current) {
      audioRef.current.currentTime = seekTo
    }
  }, [seekTo])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    playing ? a.pause() : a.play()
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = Number(e.target.value)
    if (audioRef.current) audioRef.current.currentTime = t
    setCurrentTime(t)
  }

  const changeSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2]
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length]
    setSpeed(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const skip = (delta: number) => {
    if (audioRef.current) audioRef.current.currentTime += delta
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-4 space-y-3">
      <audio
        ref={audioRef}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onTimeUpdate={() => {
          const t = audioRef.current?.currentTime ?? 0
          setCurrentTime(t)
          onTimeUpdate?.(t)
        }}
      />

      {/* Progress bar */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 appearance-none bg-gray-700 rounded-full cursor-pointer accent-brand-500"
        />
        <div className="flex justify-between text-xs text-gray-500 tabular-nums">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => skip(-15)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
          title="−15s"
        >
          ↺ 15
        </button>

        <button
          onClick={togglePlay}
          className="w-12 h-12 rounded-full bg-brand-600 hover:bg-brand-500 transition-colors flex items-center justify-center text-white text-xl shadow-lg shadow-brand-500/20"
        >
          {playing ? '⏸' : '▶'}
        </button>

        <button
          onClick={() => skip(15)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
          title="+15s"
        >
          15 ↻
        </button>

        <button
          onClick={changeSpeed}
          className="text-xs text-gray-400 hover:text-brand-400 transition-colors bg-gray-800 px-2 py-1 rounded font-mono"
          title="Velocidad"
        >
          {speed}×
        </button>
      </div>
    </div>
  )
}
