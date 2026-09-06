import type { ReactNode } from 'react'

interface ActionBarProps {
  children: ReactNode
  ariaLabel?: string
}

export function ActionBar({ children, ariaLabel = 'Acciones' }: ActionBarProps) {
  return (
    <div className="action-bar" role="toolbar" aria-label={ariaLabel}>
      {children}
    </div>
  )
}
