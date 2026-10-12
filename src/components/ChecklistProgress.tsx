import { getCompletionPercent } from '../utils/progress'

interface ChecklistProgressProps {
  completed: number
  total: number
  compact?: boolean
  sectionCount?: number
}

export function ChecklistProgress({
  completed,
  total,
  compact = false,
  sectionCount = 0,
}: ChecklistProgressProps) {
  const percent = getCompletionPercent(completed, total)
  const taskLabel = total === 1 ? 'tarea' : 'tareas'
  const sectionLabel =
    sectionCount > 0
      ? ` · ${sectionCount} ${sectionCount === 1 ? 'sección' : 'secciones'}`
      : ''

  return (
    <div className={`progress ${compact ? 'compact' : ''}`}>
      <div className="progress-meta">
        <span>
          {completed} / {total} {taskLabel}
          {compact ? '' : sectionLabel}
          {compact ? ' completadas' : ''}
        </span>
        <strong>{percent}%</strong>
      </div>
      <div
        className="progress-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`${percent} por ciento completado`}
      >
        <span className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
