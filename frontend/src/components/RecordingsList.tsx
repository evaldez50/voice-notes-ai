import { useEffect, useState, useCallback } from 'react'
import type { Recording } from '../types'
import { api } from '../services/api'
import RecordingCard from './RecordingCard'
import UploadArea from './UploadArea'

interface Props {
  selectedId: number | null
  onSelect: (r: Recording | null) => void
}

export default function RecordingsList({ selectedId, onSelect }: Props) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.getRecordings()
      setRecordings(data)
    } catch {
      // silently ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Poll every 5s to catch transcription completions
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const handleDelete = useCallback(
    async (r: Recording) => {
      if (!confirm(`¿Eliminar "${r.title || r.original_name}"?`)) return
      try {
        await api.deleteRecording(r.id)
        if (selectedId === r.id) onSelect(null)
        await load()
      } catch (e: any) {
        alert(`Error: ${e.message}`)
      }
    },
    [selectedId, onSelect, load]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h1 className="text-base font-semibold text-white flex items-center gap-2">
            🎙️ Voice Notes AI
          </h1>
          <p className="text-[11px] text-gray-500">{recordings.length} grabación{recordings.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={() => onSelect(null)}
          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
            selectedId === null
              ? 'bg-brand-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Chatear con todas las grabaciones"
        >
          Todas
        </button>
      </div>

      {/* Upload */}
      <div className="py-3">
        <UploadArea onUploaded={load} />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-2 pb-4">
        {loading ? (
          <div className="text-center py-8 text-gray-600 text-sm">Cargando...</div>
        ) : recordings.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            <p className="text-3xl mb-2">📂</p>
            <p>Sin grabaciones</p>
            <p className="text-xs mt-1">Sube un archivo de audio del reloj</p>
          </div>
        ) : (
          recordings.map((r) => (
            <RecordingCard
              key={r.id}
              recording={r}
              selected={selectedId === r.id}
              onClick={() => onSelect(r)}
              onDelete={() => handleDelete(r)}
            />
          ))
        )}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-gray-800">
        <p className="text-[10px] text-gray-600 text-center">
          Samsung Watch Ultra → Galaxy Wearable → Transferir → Subir aquí
        </p>
      </div>
    </div>
  )
}
