import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface AppHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  actions?: ReactNode
}

export function AppHeader({ title, subtitle, backTo, actions }: AppHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="app-header">
      <div className="app-header-main">
        {backTo ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Volver"
            title="Volver"
            onClick={() => {
              void navigate(backTo)
            }}
          >
            <ArrowLeft size={22} strokeWidth={2.2} />
          </button>
        ) : null}
        <div className="app-header-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="app-header-actions">{actions}</div> : null}
    </header>
  )
}
