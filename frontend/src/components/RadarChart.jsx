import React from 'react'

export default function RadarChart({ scores }) {
  const defaultScores = {
    technical_skills: 80,
    problem_solving: 75,
    communication: 85,
    domain_knowledge: 70
  }

  const activeScores = { ...defaultScores, ...scores }

  const size = 220
  const center = size / 2
  const maxVal = 100
  const radius = 80

  // 4 Axes: Up, Right, Down, Left
  // Angle: index * 90 degrees (converted to radians)
  // Index 0: Up (0 deg) -> x = center, y = center - scale
  // Index 1: Right (90 deg) -> x = center + scale, y = center
  // Index 2: Down (180 deg) -> x = center, y = center + scale
  // Index 3: Left (270 deg) -> x = center - scale, y = center

  const getCoordinates = (index, value) => {
    const scale = (value / maxVal) * radius
    switch (index) {
      case 0: return { x: center, y: center - scale }
      case 1: return { x: center + scale, y: center }
      case 2: return { x: center, y: center + scale }
      case 3: return { x: center - scale, y: center }
      default: return { x: center, y: center }
    }
  }

  const p0 = getCoordinates(0, activeScores.technical_skills)
  const p1 = getCoordinates(1, activeScores.problem_solving)
  const p2 = getCoordinates(2, activeScores.communication)
  const p3 = getCoordinates(3, activeScores.domain_knowledge)

  const polygonPath = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} L ${p3.x} ${p3.y} Z`

  // Concentric background grid lines
  const gridLevels = [25, 50, 75, 100]

  return (
    <div className="radar-chart-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1rem auto' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        {/* Background Concentric diamonds */}
        {gridLevels.map((lvl) => {
          const pt0 = getCoordinates(0, lvl)
          const pt1 = getCoordinates(1, lvl)
          const pt2 = getCoordinates(2, lvl)
          const pt3 = getCoordinates(3, lvl)
          return (
            <polygon
              key={lvl}
              points={`${pt0.x},${pt0.y} ${pt1.x},${pt1.y} ${pt2.x},${pt2.y} ${pt3.x},${pt3.y}`}
              fill="none"
              stroke="var(--border)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          )
        })}

        {/* Core Axis Lines */}
        <line x1={center} y1={center - radius} x2={center} y2={center + radius} stroke="var(--border)" strokeWidth="1" />
        <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="var(--border)" strokeWidth="1" />

        {/* Shaded Candidate Skill Polygon */}
        <polygon
          points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
          fill="rgba(59, 130, 246, 0.25)"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{ transition: 'all 0.5s ease-out' }}
        />

        {/* Data points nodes */}
        <circle cx={p0.x} cy={p0.y} r="4" fill="var(--accent)" />
        <circle cx={p1.x} cy={p1.y} r="4" fill="var(--accent)" />
        <circle cx={p2.x} cy={p2.y} r="4" fill="var(--accent)" />
        <circle cx={p3.x} cy={p3.y} r="4" fill="var(--accent)" />

        {/* Text Labels */}
        <text x={center} y={center - radius - 10} textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="600">
          TECHNICAL SKILLS ({activeScores.technical_skills}%)
        </text>
        <text x={center + radius + 10} y={center + 4} textAnchor="start" fill="var(--text)" fontSize="10" fontWeight="600">
          PROBLEM SOLVING ({activeScores.problem_solving}%)
        </text>
        <text x={center} y={center + radius + 16} textAnchor="middle" fill="var(--text)" fontSize="10" fontWeight="600">
          COMMUNICATION ({activeScores.communication}%)
        </text>
        <text x={center - radius - 10} y={center + 4} textAnchor="end" fill="var(--text)" fontSize="10" fontWeight="600">
          DOMAIN KNOWLEDGE ({activeScores.domain_knowledge}%)
        </text>
      </svg>
    </div>
  )
}
