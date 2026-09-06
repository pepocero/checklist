# CheckList

**Creador de listas de verificación**

Aplicación web instalable (**PWA**) para crear y reutilizar checklists. Ideal para tareas repetitivas, preparar maletas, comprobar todo al salir de casa o cualquier rutina que no quieras dejar a medias.

Creada por [CarliniTools](https://carlinitools.com).

---

## Características

- **Crear listas pegando texto**: cada línea se convierte automáticamente en una tarea con checkbox
- **Progreso en tiempo real**: tareas completadas, barra de progreso y porcentaje
- **Guardado automático** en el dispositivo (IndexedDB)
- **Reiniciar lista**: desmarca todas las tareas y mantiene el contenido para reutilizarla
- **Editar listas**: nombre, añadir/editar/eliminar tareas y reordenar con drag & drop
- **Copiar y compartir** listas en texto plano
- **Eliminar listas** con confirmación
- **Aviso al completar** todas las tareas
- **Funciona sin conexión** tras instalarla
- **Sin cuentas ni servidor**: no requiere registro ni backend

---

## Cómo usarla

1. Entra en la app desde la página de bienvenida
2. Pulsa **Nueva lista**
3. Escribe un nombre y pega las tareas, **una por línea**
4. Ve marcando cada ítem mientras trabajas
5. Al completar todo, reinicia la lista o vuelve a tus listas

---

## Rutas

| Ruta | Contenido |
|---|---|
| `/` | Página de bienvenida |
| `/app` | Mis listas |
| `/nueva` | Crear lista |
| `/lista/:id` | Checklist |
| `/lista/:id/editar` | Editar lista |

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

Para que las rutas SPA funcionen al recargar, configura un rewrite a `index.html` (código `200`).

---

## Privacidad

Todos los datos se guardan **solo en el navegador/dispositivo** del usuario.

---

## Licencia

Uso interno / proyecto de [CarliniTools](https://carlinitools.com).
