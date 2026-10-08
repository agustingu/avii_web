# AVII — Sitio web público

Landing page de [AVII](https://www.instagram.com/avii.pa) — evaluación de precios
inmobiliarios en Ciudad de Panamá.

Sitio estático (HTML + CSS puros, sin build) publicado con **GitHub Pages**:
https://proyectoavii.github.io/

Repo: `proyectoavii/proyectoavii.github.io` (organización `proyectoavii`; el nombre
`<org>.github.io` es lo que hace que el sitio se sirva en la raíz, sin subruta).

## Estructura

```
index.html        # toda la página (una sola landing)
styles.css        # estilos — la paleta de marca vive en las variables :root
assets/           # favicon, informe-ejemplo-avii.pdf y demás recursos
pdf/              # generador del informe de ejemplo (ver abajo)
.nojekyll         # desactiva Jekyll en GitHub Pages
```

## Informe PDF de ejemplo

`assets/informe-ejemplo-avii.pdf` es el PDF que el sitio enlaza en la sección
"Ejemplo". Se genera con `pdf/build_informe.mjs`, un **port 1:1 de
`avii_front-main/src/utils/printPrediction.ts`** (el generador real del informe
de la app) alimentado con `pdf/sample_prediction.json` — una respuesta real de
`POST /api/predict` del stack local. Si el template de la app cambia, re-portar.

Regenerar (nota: los tiles del mapa son OpenStreetMap porque CARTO exige API key
fuera del navegador; la nota de atribución del informe lo refleja):

```bash
node pdf/build_informe.mjs
chrome --headless=new --screenshot=pdf/map.png --window-size=720,400 \
  --hide-scrollbars --virtual-time-budget=25000 \
  --run-all-compositor-stages-before-draw pdf/map_page.html
chrome --headless --print-to-pdf=assets/informe-ejemplo-avii.pdf \
  --no-pdf-header-footer pdf/informe_ejemplo.html
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
