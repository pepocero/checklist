import { ArrowRight, ClipboardCheck, Lock, RefreshCw, Share2, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import heroImage from '../assets/landing/landing-hero.png'
import homeImage from '../assets/landing/landing-home.png'
import privacyImage from '../assets/landing/landing-privacy.png'
import repetitiveImage from '../assets/landing/landing-repetitive.png'
import resetImage from '../assets/landing/landing-reset.png'
import shareImage from '../assets/landing/landing-share.png'
import travelImage from '../assets/landing/landing-travel.png'

export function LandingPage() {
  return (
    <div className="landing">
      <div className="landing-enter-bar">
        <div className="landing-enter-brand">
          <p className="landing-enter-name">CheckList</p>
          <p className="landing-enter-tag">Creador de listas de verificación</p>
        </div>
        <Link to="/app" className="btn btn-primary landing-enter-btn">
          <span className="landing-enter-label-full">Entrar a la app</span>
          <span className="landing-enter-label-short">Entrar</span>
          <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" />
        </Link>
      </div>

      <section className="landing-hero">
        <div className="landing-hero-stage">
          <img
            className="landing-hero-image"
            src={heroImage}
            alt="Maleta y checklist listos para un viaje o una rutina diaria"
          />
          <div className="landing-hero-copy">
            <p className="landing-brand">CheckList</p>
            <p className="landing-subtitle">Creador de listas de verificación</p>
            <h1>Controla lo importante sin olvidarte de nada</h1>
            <p className="landing-lead">
              Crea listas reutilizables para tareas repetitivas, viajes, salidas de casa y
              cualquier rutina que quieras hacer bien a la primera.
            </p>
            <div className="landing-hero-actions">
              <Link to="/app" className="btn btn-primary">
                <span>Entrar a la app</span>
                <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-section-copy">
          <p className="landing-kicker">Para qué sirve</p>
          <h2>Rutinas que se repiten, hechas con calma</h2>
          <p>
            Ideal cuando configuras ordenadores nuevos, preparas maletas, sales de casa o
            sigues cualquier proceso que no quieres dejar a medias.
          </p>
        </div>
        <div className="landing-uses">
          <article className="landing-use">
            <img src={repetitiveImage} alt="Escritorio preparado para una configuración repetible" />
            <h3>Tareas repetitivas</h3>
            <p>
              Monta una vez el checklist de configuración o puesta a punto y reutilízalo
              cada vez que toque empezar de cero.
            </p>
          </article>
          <article className="landing-use">
            <img src={travelImage} alt="Maleta abierta con objetos de viaje" />
            <h3>Equipaje y viajes</h3>
            <p>
              Haz la lista de lo que va en la maleta y márcalo mientras haces las maletas.
              Así no se queda nada en casa.
            </p>
          </article>
          <article className="landing-use">
            <img src={homeImage} alt="Llaves y puerta listas para salir de casa" />
            <h3>Al salir de casa</h3>
            <p>
              Luces, cocina, ventanas, llaves, cargador… una verificación rápida antes de
              cerrar la puerta.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-feature">
        <div className="landing-feature-copy">
          <ClipboardCheck size={28} strokeWidth={1.8} aria-hidden="true" />
          <h2>De texto a checklist en segundos</h2>
          <p>
            Escribe o pega un bloque de texto. Cada línea se convierte en una tarea con
            checkbox. Sin formularios eternos: pegas, guardas y empiezas a marcar.
          </p>
        </div>
        <div className="landing-feature-media">
          <img src={repetitiveImage} alt="Lista de verificación lista para usarse en el trabajo" />
        </div>
      </section>

      <section className="landing-feature reverse">
        <div className="landing-feature-copy">
          <Lock size={28} strokeWidth={1.8} aria-hidden="true" />
          <h2>Privacidad real, en tu dispositivo</h2>
          <p>
            No hay cuentas ni registros. Tus listas se guardan solo en este móvil u
            ordenador. Tú decides qué compartir y qué se queda únicamente contigo.
          </p>
        </div>
        <div className="landing-feature-media">
          <img src={privacyImage} alt="Dispositivos en un escritorio que sugieren datos privados" />
        </div>
      </section>

      <section className="landing-feature">
        <div className="landing-feature-copy">
          <RefreshCw size={28} strokeWidth={1.8} aria-hidden="true" />
          <h2>Reinicia y vuelve a usar la misma lista</h2>
          <p>
            Cuando terminas, reinicia el checklist. Se desmarcan todas las tareas y
            conservas el contenido. Perfecto para el siguiente ordenador, el próximo viaje
            o la salida de mañana.
          </p>
        </div>
        <div className="landing-feature-media">
          <img src={resetImage} alt="Checklist reiniciado listo para repetir el proceso" />
        </div>
      </section>

      <section className="landing-feature reverse">
        <div className="landing-feature-copy">
          <Share2 size={28} strokeWidth={1.8} aria-hidden="true" />
          <h2>Copia o comparte en un toque</h2>
          <p>
            Exporta la lista en texto plano, cópiala al portapapeles o ábrela con el menú
            de compartir del sistema para enviarla a otro dispositivo y pegarla en una
            lista nueva.
          </p>
        </div>
        <div className="landing-feature-media">
          <img src={shareImage} alt="Dispositivos listos para compartir una lista" />
        </div>
      </section>

      <section className="landing-feature">
        <div className="landing-feature-copy">
          <WifiOff size={28} strokeWidth={1.8} aria-hidden="true" />
          <h2>Instálala y úsala sin conexión</h2>
          <p>
            CheckList es una PWA: instálala en Windows o Android y sigue trabajando aunque
            no haya Internet. El progreso se guarda al momento en cada marca.
          </p>
        </div>
        <div className="landing-feature-media">
          <img src={heroImage} alt="CheckList disponible como aplicación instalable" />
        </div>
      </section>

      <section className="landing-closing">
        <p className="landing-brand compact">CheckList</p>
        <h2>Empieza tu primera lista de verificación</h2>
        <p>
          Rápida, clara y pensada para el día a día: menos olvidos, más control.
        </p>
        <Link to="/app" className="btn btn-primary">
          <span>Entrar a la app</span>
          <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" />
        </Link>
      </section>
    </div>
  )
}
