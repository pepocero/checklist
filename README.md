# Checklist de Tareas

Aplicación web instalable (**PWA**) para crear y reutilizar listas de tareas o checklists.

Pensada para trabajos repetitivos: por ejemplo, preparar y configurar ordenadores nuevos. Creas la lista una vez, la marcas mientras trabajas y, al terminar, la reinicias para el siguiente equipo.

Creada por [CarliniTools](https://carlinitools.com).

---

## Características

- **Crear listas pegando texto**: cada línea se convierte automáticamente en una tarea con checkbox
- **Progreso en tiempo real**: tareas completadas, barra de progreso y porcentaje
- **Guardado automático** en el dispositivo (IndexedDB)
- **Reiniciar lista**: desmarca todas las tareas y mantiene el contenido para reutilizarla
- **Editar listas**: nombre, añadir/editar/eliminar tareas y reordenar con drag & drop
- **Eliminar listas** con confirmación
- **Aviso al completar** todas las tareas
- **Funciona sin conexión** tras instalarla
- **Sin cuentas ni servidor**: no requiere registro, backend, Supabase ni Firebase

---

## Cómo usarla

1. Pulsa **Nueva lista**
2. Escribe un nombre (por ejemplo: *Configuración ordenador nuevo*)
3. Pega o escribe las tareas, **una por línea**
4. Guarda y ve marcando cada ítem mientras trabajas
5. Al completar todo, reinicia la lista o vuelve a tus listas

### Ejemplo de tareas

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

## Tecnologías

| Tecnología | Uso |
|---|---|
| React + TypeScript | Interfaz |
| Vite | Build y desarrollo |
| IndexedDB (`idb`) | Almacenamiento local |
| vite-plugin-pwa | Manifest, service worker y modo offline |
| React Router | Navegación |
| @dnd-kit | Reordenar tareas |

---

## Instalación local

```bash
npm install
npm run dev
```

Abrirá la app en el navegador (por defecto `http://localhost:5173`).

### Build de producción

```bash
npm run build
npm run preview
```

La salida queda en `dist/`.

---

## Despliegue (Cloudflare Pages)

| Campo | Valor |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Root directory | `/` (vacío) |

No uses `npm run dev` ni Wrangler para este proyecto: es una app estática generada por Vite.

Para que las rutas SPA (`/lista/...`) funcionen al recargar, configura un rewrite a `index.html` (código `200`).

---

## Instalar como aplicación

Tras abrirla al menos una vez en un navegador compatible:

- **Windows (Edge/Chrome)**: instalar desde el icono de la barra de direcciones o el aviso de la propia app
- **Android**: *Añadir a la pantalla de inicio*

Después podrás abrirla sin Internet; los datos siguen en el dispositivo.

---

## Privacidad

Todos los datos se guardan **solo en el navegador/dispositivo** del usuario. No hay sincronización en la nube ni envío de información a un servidor de la aplicación.

---

## Licencia

Uso interno / proyecto de [CarliniTools](https://carlinitools.com).
