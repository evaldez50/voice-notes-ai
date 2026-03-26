import { useMemo } from 'react'
import type { MindMapData, MindMapNode } from '../types'

interface Props {
  data: MindMapData
}

interface PositionedNode {
  label: string
  x: number
  y: number
  px?: number
  py?: number
  level: number
  color: string
  isRoot?: boolean
}

const COLORS = [
  '#818cf8', '#a78bfa', '#f472b6', '#fb923c',
  '#34d399', '#38bdf8', '#facc15', '#f87171',
]

const W = 900
const H = 600
const CX = W / 2
const CY = H / 2

function positionNodes(tree: MindMapData): PositionedNode[] {
  const nodes: PositionedNode[] = []

  // Root
  nodes.push({ label: tree.title, x: CX, y: CY, level: 0, color: '#6366f1', isRoot: true })

  const n1 = tree.children.length
  if (n1 === 0) return nodes

  const r1 = Math.min(190, Math.max(150, n1 * 30))

  tree.children.forEach((child, i) => {
    const angle = (2 * Math.PI * i) / n1 - Math.PI / 2
    const x = CX + r1 * Math.cos(angle)
    const y = CY + r1 * Math.sin(angle)
    const color = COLORS[i % COLORS.length]

    nodes.push({ label: child.label, x, y, px: CX, py: CY, level: 1, color })

    const n2 = child.children.length
    if (n2 === 0) return

    const r2 = Math.min(130, Math.max(90, n2 * 25))
    const spread = Math.min((Math.PI * 0.7) / Math.max(n2 - 1, 1), Math.PI / 4)

    child.children.forEach((sub, j) => {
      const offset = (j - (n2 - 1) / 2) * spread
      const subAngle = angle + offset
      const sx = x + r2 * Math.cos(subAngle)
      const sy = y + r2 * Math.sin(subAngle)
      nodes.push({ label: sub.label, x: sx, y: sy, px: x, py: y, level: 2, color })
    })
  })

  return nodes
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let current = ''
  const avgChar = 7
  const charsPerLine = Math.floor(maxWidth / avgChar)

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= charsPerLine) {
      current = (current + ' ' + word).trim()
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 3)
}

export default function MindMap({ data }: Props) {
  const nodes = useMemo(() => positionNodes(data), [data])

  return (
    <div className="w-full overflow-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minHeight: 400, maxHeight: 600 }}
      >
        <defs>
          {COLORS.map((c, i) => (
            <radialGradient key={i} id={`g${i}`} cx="30%" cy="30%">
              <stop offset="0%" stopColor={c} stopOpacity="0.9" />
              <stop offset="100%" stopColor={c} stopOpacity="0.5" />
            </radialGradient>
          ))}
          <radialGradient id="groot" cx="30%" cy="30%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="1" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.8" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Lines */}
        {nodes.filter(n => n.px !== undefined).map((n, i) => (
          <line
            key={`l-${i}`}
            x1={n.px} y1={n.py} x2={n.x} y2={n.y}
            stroke={n.color}
            strokeWidth={n.level === 1 ? 2.5 : 1.5}
            strokeOpacity={n.level === 1 ? 0.6 : 0.4}
            strokeDasharray={n.level === 2 ? '4 2' : undefined}
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const isRoot = n.isRoot
          const r = isRoot ? 46 : n.level === 1 ? 34 : 26
          const lines = wrapText(n.label, r * 2 - 8)
          const colorIdx = COLORS.indexOf(n.color)
          const fillId = isRoot ? 'groot' : colorIdx >= 0 ? `g${colorIdx}` : 'groot'

          return (
            <g key={`n-${i}`}>
              {/* Outer glow ring for root */}
              {isRoot && (
                <circle
                  cx={n.x} cy={n.y} r={r + 8}
                  fill="none"
                  stroke="#6366f1"
                  strokeWidth={1}
                  strokeOpacity={0.3}
                />
              )}
              <circle
                cx={n.x} cy={n.y} r={r}
                fill={`url(#${fillId})`}
                stroke={n.color}
                strokeWidth={isRoot ? 2 : 1.5}
                strokeOpacity={0.8}
              />
              {lines.map((line, li) => {
                const totalLines = lines.length
                const lineH = isRoot ? 14 : n.level === 1 ? 12 : 10
                const offsetY = (li - (totalLines - 1) / 2) * lineH
                return (
                  <text
                    key={li}
                    x={n.x}
                    y={n.y + offsetY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={isRoot ? 12 : n.level === 1 ? 10 : 9}
                    fontWeight={isRoot ? '700' : n.level === 1 ? '600' : '400'}
                    fill="white"
                    style={{ userSelect: 'none' }}
                  >
                    {line}
                  </text>
                )
              })}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
