import { getCompletionPercent } from '../utils/progress'

interface ChecklistProgressProps {
  completed: number
  total: number
  compact?: boolean
}

export function ChecklistProgress({
  completed,
  total,
  compact = false,
}: ChecklistProgressProps) {
  const percent = getCompletionPercent(completed, total)

  return (
    <div className={`progress ${compact ? 'compact' : ''}`}>
      <div className="progress-meta">
        <span>
          {completed} / {total} {compact ? 'tareas completadas' : 'completadas'}
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
