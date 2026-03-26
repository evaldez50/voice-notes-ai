import { useState, useEffect, useRef } from 'react'
import type { Recording, MindMapData, ViewMode } from './types'
import { api } from './services/api'
import RecordingsList from './components/RecordingsList'
import ChatInterface from './components/ChatInterface'
import AudioPlayer from './components/AudioPlayer'
import TranscriptViewer from './components/TranscriptViewer'
import MindMap from './components/MindMap'

export default function App() {
  const [selected, setSelected] = useState<Recording | null>(null)
  const [view, setView] = useState<ViewMode>('chat')
  const [mindmap, setMindmap] = useState<MindMapData | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  const [loadingMM, setLoadingMM] = useState(false)
  const [loadingSum, setLoadingSum] = useState(false)
  const [audioTime, setAudioTime] = useState(0)
  const [seekTo, setSeekTo] = useState<number | undefined>()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Reset when selection changes
  useEffect(() => {
    setMindmap(null)
    setSummary(null)
    setView('chat')
    setAudioTime(0)
    setSeekTo(undefined)
  }, [selected?.id])

  const handleViewMindMap = async () => {
    if (!selected || !selected.transcribed) return
    setView('mindmap')
    if (mindmap) return
    setLoadingMM(true)
    try {
      const data = await api.getMindMap(selected.id)
      setMindmap(data)
    } catch (e: any) {
      alert(`Error al generar mapa mental: ${e.message}`)
    } finally {
      setLoadingMM(false)
    }
  }

  const handleViewSummary = async () => {
    if (!selected || !selected.transcribed) return
    setView('summary')
    if (summary) return
    setLoadingSum(true)
    try {
      const { summary: s } = await api.getSummary(selected.id)
      setSummary(s)
    } catch (e: any) {
      alert(`Error al generar resumen: ${e.message}`)
    } finally {
      setLoadingSum(false)
    }
  }

  const tabs: { id: ViewMode; label: string; icon: string; disabled?: boolean }[] = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'transcript', label: 'Transcripción', icon: '📝', disabled: !selected?.transcribed },
    { id: 'summary', label: 'Resumen', icon: '📋', disabled: !selected?.transcribed },
    { id: 'mindmap', label: 'Mapa Mental', icon: '🗺️', disabled: !selected?.transcribed },
  ]

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          flex-shrink-0 border-r border-gray-800 transition-all duration-300 overflow-hidden
          ${sidebarOpen ? 'w-72' : 'w-0'}
        `}
      >
        <div className="w-72 h-full overflow-hidden">
          <RecordingsList
            selectedId={selected?.id ?? null}
            onSelect={(r) => setSelected(r)}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 flex-shrink-0 bg-gray-950/80 backdrop-blur">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="text-gray-500 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-800"
            title="Toggle sidebar"
          >
            ☰
          </button>

          {/* Tab bar */}
          <div className="flex gap-1 flex-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.disabled) return
                  if (tab.id === 'mindmap') { handleViewMindMap(); return }
                  if (tab.id === 'summary') { handleViewSummary(); return }
                  setView(tab.id)
                }}
                disabled={tab.disabled}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${view === tab.id
                    ? 'bg-brand-600 text-white shadow shadow-brand-500/20'
                    : tab.disabled
                      ? 'text-gray-700 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }
                `}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {selected && (
            <div className="text-xs text-gray-500 truncate max-w-xs hidden md:block">
              {selected.title || selected.original_name}
            </div>
          )}
        </header>

        {/* Audio player (when recording selected) */}
        {selected && (
          <div className="px-5 py-4 border-b border-gray-800/50 flex-shrink-0 bg-gray-950/60">
            <AudioPlayer
              recordingId={selected.id}
              onTimeUpdate={setAudioTime}
              seekTo={seekTo}
            />
          </div>
        )}

        {/* View content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'chat' && (
            <div className="h-full flex flex-col">
              <ChatInterface
                recordingId={selected?.id ?? null}
                recordingTitle={selected?.title || selected?.original_name}
              />
            </div>
          )}

          {view === 'transcript' && selected && (
            <TranscriptViewer
              recordingId={selected.id}
              currentTime={audioTime}
              onSeek={(t) => setSeekTo(t)}
            />
          )}

          {view === 'summary' && (
            <div className="p-6 max-w-3xl">
              {loadingSum ? (
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Generando resumen con IA...
                </div>
              ) : summary ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <h2 className="text-xl font-bold text-white mb-4">
                    📋 Resumen: {selected?.title || 'Grabación'}
                  </h2>
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-6">
                    <p className="text-gray-200 leading-relaxed whitespace-pre-wrap text-sm">
                      {summary}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Selecciona una grabación transcrita para ver el resumen.
                </div>
              )}
            </div>
          )}

          {view === 'mindmap' && (
            <div className="p-6">
              {loadingMM ? (
                <div className="flex items-center gap-3 text-gray-400">
                  <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                  Generando mapa mental con IA...
                </div>
              ) : mindmap ? (
                <div>
                  <h2 className="text-xl font-bold text-white mb-4">
                    🗺️ Mapa Mental: {mindmap.title}
                  </h2>
                  <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl overflow-hidden">
                    <MindMap data={mindmap} />
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 text-sm">
                  Selecciona una grabación transcrita para ver el mapa mental.
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
