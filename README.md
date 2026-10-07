# AVII — Sitio web público

Landing page de [AVII](https://www.instagram.com/avii.pa) — evaluación de precios
inmobiliarios en Ciudad de Panamá.

Sitio estático (HTML + CSS puros, sin build) publicado con **GitHub Pages**:
https://agustingu.github.io/avii_web/

## Estructura

```
index.html        # toda la página (una sola landing)
styles.css        # estilos — la paleta de marca vive en las variables :root
assets/           # favicon y recursos
.nojekyll         # desactiva Jekyll en GitHub Pages
```

## Desarrollo local

No necesita nada: abre `index.html` en el navegador, o sirve la carpeta:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

## Publicar cambios

GitHub Pages sirve la rama `main` (raíz). Basta con:

```bash
git add -A && git commit -m "..." && git push
```

Los cambios tardan ~1 minuto en reflejarse en la URL pública.

## Reglas de copy

- Es material de cara al público: decir **"promedio"**, nunca "mediana"
  (regla de redacción del proyecto, 2026-09-19).
- **Precio actual: $20 por consulta** (decisión del 2026-10-07). La app no se ofrece
  al público todavía — el sitio vende el servicio por contacto directo (email/Instagram)
  y no muestra los planes de suscripción del producto.
- La paleta sale del producto (`avii_front-main/src/theme.ts`); si cambia allá,
  actualizar las variables `:root` de `styles.css`.
