# CheckList

### Creador de listas de verificación

![CheckList](src/assets/landing/landing-hero.png)

# Controla lo importante sin olvidarte de nada

Crea listas reutilizables para tareas repetitivas, viajes, salidas de casa y cualquier rutina que quieras hacer bien a la primera.

Creada por [CarliniTools](https://carlinitools.com).

---

## Para qué sirve

### Rutinas que se repiten, hechas con calma

Ideal cuando configuras ordenadores nuevos, preparas maletas, sales de casa o sigues cualquier proceso que no quieres dejar a medias.

| Tareas repetitivas | Equipaje y viajes | Al salir de casa |
| :---: | :---: | :---: |
| ![Tareas repetitivas](src/assets/landing/landing-repetitive.png) | ![Equipaje y viajes](src/assets/landing/landing-travel.png) | ![Al salir de casa](src/assets/landing/landing-home.png) |
| Monta una vez el checklist de configuración o puesta a punto y reutilízalo cada vez que toque empezar de cero. | Haz la lista de lo que va en la maleta y márcalo mientras haces las maletas. Así no se queda nada en casa. | Luces, cocina, ventanas, llaves, cargador… una verificación rápida antes de cerrar la puerta. |

---

## De texto a checklist en segundos

![De texto a checklist](src/assets/landing/landing-repetitive.png)

Escribe o pega un bloque de texto. Cada línea se convierte en una tarea con checkbox. Sin formularios eternos: pegas, guardas y empiezas a marcar.

---

## Privacidad real, en tu dispositivo

![Privacidad](src/assets/landing/landing-privacy.png)

No hay cuentas ni registros. Tus listas se guardan solo en este móvil u ordenador. Tú decides qué compartir y qué se queda únicamente contigo.

---

## Reinicia y vuelve a usar la misma lista

![Reiniciar lista](src/assets/landing/landing-reset.png)

Cuando terminas, reinicia el checklist. Se desmarcan todas las tareas y conservas el contenido. Perfecto para el siguiente ordenador, el próximo viaje o la salida de mañana.

---

## Copia o comparte en un toque

![Compartir](src/assets/landing/landing-share.png)

Exporta la lista en texto plano, cópiala al portapapeles o ábrela con el menú de compartir del sistema para enviarla a otro dispositivo y pegarla en una lista nueva.

---

## Instálala y úsala sin conexión

![PWA offline](src/assets/landing/landing-hero.png)

CheckList es una PWA: instálala en Windows o Android y sigue trabajando aunque no haya Internet. El progreso se guarda al momento en cada marca.

---

## Empieza tu primera lista de verificación

**CheckList** — rápida, clara y pensada para el día a día: menos olvidos, más control.

---

## Cómo usarla

1. Entra en la app desde la página de bienvenida
2. Pulsa **Nueva lista**
3. Escribe un nombre y pega las tareas, **una por línea**
4. Ve marcando cada ítem mientras trabajas
5. Al completar todo, reinicia la lista o vuelve a tus listas

### Ejemplo

```text
Outlook
Teams
Probar la cámara
Authenticator
OneDrive
Red ethernet
Wifi
VPN
Impresora
Escáner
```

---

## Desarrollo local

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Despliegue (Cloudflare Pages)

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | `/` (vacío) |

Para las rutas SPA, configura un rewrite a `index.html` (código `200`).

### Notificaciones en segundo plano (Web Push)

Los recordatorios con la app cerrada usan un Worker de Cloudflare (`worker/`) con cron cada minuto.

1. Crear el namespace KV:
   ```bash
   cd worker
   npx wrangler kv namespace create REMINDERS
   ```
   Copia el `id` en `worker/wrangler.jsonc`.

2. Generar claves VAPID:
   ```bash
   cd worker
   npm run vapid
   ```

3. Guardar secretos del Worker:
   ```bash
   npx wrangler secret put VAPID_PUBLIC_KEY
   npx wrangler secret put VAPID_PRIVATE_KEY
   ```

4. Desplegar el Worker:
   ```bash
   npx wrangler deploy
   ```

5. En Cloudflare Pages → Settings → Environment variables:
   - `VITE_PUSH_API_URL` = URL del Worker (ej. `https://checklist-reminders.xxx.workers.dev`)
   - `VITE_VAPID_PUBLIC_KEY` = clave pública generada

6. Vuelve a desplegar Pages para que el frontend tome las variables.

En local, crea `.env` en la raíz del proyecto con esas mismas variables.

---

## Stack

React · TypeScript · Vite · IndexedDB · PWA · React Router · @dnd-kit · Cloudflare Workers (Web Push)

---

## Licencia

Proyecto de [CarliniTools](https://carlinitools.com).
