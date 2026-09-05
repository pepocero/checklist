# Checklist de Tareas

Aplicación web instalable (PWA) para crear y reutilizar listas de tareas. Los datos se guardan solo en el dispositivo, en IndexedDB, y la app funciona sin conexión después de instalarla.

## Desarrollo

```bash
npm install
npm run dev
```

## Publicación

```bash
npm run build
npm run preview
```

Tras abrirla una vez en el navegador, se puede instalar en Windows (Edge/Chrome) y Android. El service worker deja en caché los archivos necesarios para usarla offline.
