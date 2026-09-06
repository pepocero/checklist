import { ArrowLeft, Home } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface AppHeaderProps {
  title: string
  subtitle?: string
  backTo?: string
  homeTo?: string
}

export function AppHeader({ title, subtitle, backTo, homeTo }: AppHeaderProps) {
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
        {homeTo ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Ir a la página principal"
            title="Página principal"
            onClick={() => {
              void navigate(homeTo)
            }}
          >
            <Home size={22} strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </header>
  )
}
