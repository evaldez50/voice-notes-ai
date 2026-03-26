import type { Recording } from '../types'

interface Props {
  recording: Recording
  selected: boolean
  onClick: () => void
  onDelete: () => void
}

function fmtDuration(secs: number | null) {
  if (!secs) return '--:--'
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function RecordingCard({ recording, selected, onClick, onDelete }: Props) {
  const title = recording.title || recording.original_name

  return (
    <div
      onClick={onClick}
      className={`
        group relative rounded-xl p-3 cursor-pointer transition-all border
        ${selected
          ? 'bg-brand-900/50 border-brand-500/70 shadow-lg shadow-brand-500/10'
          : 'bg-gray-900/50 border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'
        }
      `}
    >
      {/* Delete button */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-600 hover:text-red-400 text-xs p-1"
        title="Eliminar"
      >
        ✕
      </button>

      <div className="flex items-start gap-2.5">
        <div className={`text-xl flex-shrink-0 mt-0.5 ${selected ? 'text-brand-400' : 'text-gray-500'}`}>
          {recording.transcribed ? '🎙️' : '⏳'}
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium truncate leading-tight ${selected ? 'text-brand-100' : 'text-gray-200'}`}>
            {title}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {fmtDate(recording.created_at)} · {fmtDuration(recording.duration)} · {fmtSize(recording.file_size)}
          </p>
          {!recording.transcribed && (
            <span className="inline-block text-[10px] bg-yellow-900/50 text-yellow-400 border border-yellow-800/50 rounded px-1.5 py-0.5 mt-1">
              Transcribiendo...
            </span>
          )}
          {recording.language && (
            <span className="inline-block text-[10px] bg-gray-800 text-gray-500 rounded px-1.5 py-0.5 mt-1 ml-1">
              {recording.language.toUpperCase()}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
