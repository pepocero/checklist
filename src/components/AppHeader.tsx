import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface AppHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
}

export function AppHeader({ title, subtitle, backTo }: AppHeaderProps) {
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
    </header>
  )
}
