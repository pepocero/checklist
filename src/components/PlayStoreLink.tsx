import { Smartphone } from 'lucide-react'
import { PLAY_STORE_URL } from '../constants/store'

interface PlayStoreLinkProps {
  className?: string
  label?: string
  shortLabel?: string
}

export function PlayStoreLink({
  className = 'btn btn-ghost',
  label = 'Google Play',
  shortLabel,
}: PlayStoreLinkProps) {
  return (
    <a
      href={PLAY_STORE_URL}
      className={className}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Descargar Checklist en Google Play"
      title="Descargar en Google Play"
    >
      <Smartphone size={18} strokeWidth={2.3} aria-hidden="true" />
      {shortLabel ? (
        <>
          <span className="landing-enter-label-full">{label}</span>
          <span className="landing-enter-label-short">{shortLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </a>
  )
}
