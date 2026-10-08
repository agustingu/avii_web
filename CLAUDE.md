# CLAUDE.md

Guía para Claude Code al trabajar en este repo. Este sitio es parte del proyecto
AVII: la carpeta madre `avii_net` (fuera de este repo) tiene el CLAUDE.md
principal del stack; estas reglas lo heredan y lo detallan para el sitio público.

## Qué es esto

Sitio público de AVII (evaluación de precios inmobiliarios, Ciudad de Panamá).
Landing estática HTML+CSS **sin build**, servida por GitHub Pages en
**https://proyectoavii.github.io/** desde `main` (el nombre del repo
`<org>.github.io` hace que sirva en la raíz). Push a `main` = deploy en ~1 min.

```
index.html   # toda la página
styles.css   # paleta de marca en :root (copiada de avii_front-main/src/theme.ts — sincronizar a mano)
assets/      # favicon + informe-ejemplo-avii.pdf
pdf/         # generador del PDF de ejemplo (pipeline en README.md)
```

## Reglas de copy (obligatorias — decisiones del dueño)

- **"Promedio", nunca "mediana"** en todo texto del sitio (regla del proyecto,
  2026-09-19). Excepción: el PDF de ejemplo replica el informe real de la app,
  que sigue diciendo "mediana del mercado" — ahí se mantiene.
- **Precio: $20 por consulta, sin suscripciones** (2026-10-07). NO reintroducir
  los planes Personal/Profesional/Comercial del producto: el sitio vende el
  servicio por contacto directo, la app no se ofrece al público todavía.
- **Entrega: 24 horas**, no "minutos" (2026-10-07).
- **Contacto**: `aviipanama@gmail.com` e Instagram `@avii.pa` (enlace limpio
  `https://www.instagram.com/avii.pa`, sin tokens `?stkn=`).
- Idioma: español, público general de Panamá.
- Pendiente: botón de WhatsApp Business (`wa.me/507XXXXXXXX` con mensaje
  prellenado) como contacto principal cuando el dueño tenga el número.

## PDF de ejemplo (assets/informe-ejemplo-avii.pdf)

- Es un **port 1:1 de `avii_front-main/src/utils/printPrediction.ts`**
  (`pdf/build_informe.mjs`) alimentado con una respuesta real de `/api/predict`
  (`pdf/sample_prediction.json`). Si el template de la app cambia, re-portar.
- **No quitar**: la banda "INFORME DE EJEMPLO", el disclosure de IA ni el aviso
  legal de 8 puntos (mismo criterio que el PDF real: no recortar al editar).
- Mapa con tiles de **OpenStreetMap**, no CARTO: CARTO exige API key fuera del
  navegador ("API KEY REQUIRED" en headless). Mantener la atribución OSM.
- Regeneración: 3 pasos documentados en README.md (node + 2 pasadas de Chrome
  headless; el mapa se rasteriza aparte porque Leaflet necesita `setView` antes
  de añadir capas y los tiles no pintan en print-to-pdf directo).

## Verificación visual

- Chrome headless impone **500px de ancho mínimo de ventana**: un "screenshot
  móvil" a 390px sale recortado a la derecha y parece overflow sin serlo. Para
  layout móvil real, cargar la página dentro de un iframe de 390px
  (`--allow-file-access-from-files`) y medir/capturar ahí.

## Seguridad del repo (configurada 2026-10-07 — no aflojar)

- `main` protegida: sin force-push ni borrado (incluye admins), historia
  lineal, push restringido a `agustingu`.
- Secret scanning + push protection activos; GitHub Actions a solo lectura.
- La organización `proyectoavii` **exige 2FA** a todo miembro.
- El token de `gh` local tiene scopes mínimos (`gist, read:org, repo`): los
  cambios de configuración de la organización **fallan en silencio** por API
  (responde 200 sin aplicar) — hacerlos en la web de GitHub.
- Todo el stack es nivel gratuito de GitHub **porque el repo es público**; no
  volverlo privado (rompería Pages y las protecciones gratuitas).
