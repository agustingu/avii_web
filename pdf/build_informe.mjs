#!/usr/bin/env node
/**
 * Genera pdf/informe_ejemplo.html: el informe de ejemplo del sitio público.
 *
 * Es un port 1:1 de avii_front-main/src/utils/printPrediction.ts (el generador
 * real del PDF de la app) alimentado con pdf/sample_prediction.json — una
 * respuesta real de POST /api/predict del stack local (85 m², 2 hab, 2 baños
 * en San Francisco, precio del usuario $185,000). Si printPrediction.ts cambia,
 * re-portar aquí.
 *
 * Diferencias deliberadas con el original:
 *  - Banda "INFORME DE EJEMPLO" bajo el encabezado.
 *  - El mapa es un Leaflet en vivo (mismos tiles CARTO light_all) en lugar del
 *    canvas rasterizado: aquí imprimimos con Chrome headless, sin popup.
 *  - Sin el script de window.print(); la impresión la hace Chrome.
 *
 * Uso (3 pasos, igual que la app: el mapa se rasteriza y se incrusta como imagen):
 *   node pdf/build_informe.mjs                        # → pdf/map_page.html + pdf/informe_ejemplo.html
 *   chrome --headless --screenshot=pdf/map.png --window-size=720,400 \
 *     --virtual-time-budget=20000 pdf/map_page.html   # → rasteriza el mapa
 *   chrome --headless --print-to-pdf=assets/informe-ejemplo-avii.pdf \
 *     --no-pdf-header-footer pdf/informe_ejemplo.html
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const payload = JSON.parse(readFileSync(join(here, 'sample_prediction.json'), 'utf8'))

// Parámetros con los que se corrió la consulta de ejemplo.
const filters = { habitaciones: 2, bathrooms: 2, area_m2: 85, parkings: undefined, precio_real: 185000, barrio: '' }

const SERVICE_COLORS = {
  hospital: '#dc2626', pharmacy: '#8b5cf6', school: '#3B7DC8',
  supermarket: '#16a34a', convenience_store: '#22c55e', corporate_office: '#64748b',
  recreativo: '#f59e0b', bus_station: '#0891b2', subway_station: '#0ea5e9'
}
const RECOMMENDATION_LABELS = {
  good_investment: 'Por debajo del valor de mercado',
  moderate: 'En línea con el mercado',
  poor: 'Por encima del valor de mercado'
}
const RECOMMENDATION_COLORS = { good_investment: '#10b981', moderate: '#f59e0b', poor: '#dc2626' }

const TRAVEL_TIME_BUFFER_MIN = 7
const formatTravelTimeRange = (minutes) => {
  if (!Number.isFinite(minutes)) return null
  const base = Math.max(1, Math.ceil(minutes))
  return `${base}-${base + TRAVEL_TIME_BUFFER_MIN} min`
}

// ---- buildPresentationResult (port de Map.tsx) ----
const buildPresentationResult = (payload) => {
  const estimatedValue = Number(payload?.total_price ?? 0)
  const percentiles = payload?.percentiles || {}
  const p10 = Number(percentiles.p10 ?? 0)
  const p50 = Number(percentiles.p50 ?? payload?.total_price ?? 0)
  const p90 = Number(percentiles.p90 ?? 0)
  const confidence = Number(payload?.confidence ?? 0)

  const marketPosKey = payload?.market_position || ''
  const recommendation =
    marketPosKey === 'below_market' ? 'good_investment' :
    marketPosKey === 'above_market' ? 'poor' : 'moderate'

  const marketDist = payload?.market_distribution
  const whisker_plot = marketDist?.whisker_plot && {
    min_value: Math.round(marketDist.whisker_plot.min_value),
    q1: Math.round(marketDist.whisker_plot.q1),
    median: Math.round(marketDist.whisker_plot.median),
    q3: Math.round(marketDist.whisker_plot.q3),
    max_value: Math.round(marketDist.whisker_plot.max_value)
  }
  const market_comparison = {
    neighborhood_avg_price: Math.round(marketDist?.avg_price || whisker_plot?.median || 0)
  }
  return {
    ...payload,
    confidence,
    recommendation,
    whisker_plot,
    distribution: marketDist?.distribution || [],
    market_comparison,
    market_avg_price_m2: Number(marketDist?.avg_price_per_m2 || 0),
    model_info: { warnings: payload?.warnings || [] },
    user_price: filters.precio_real,
    search_params: {
      habitaciones: filters.habitaciones,
      bathrooms: filters.bathrooms,
      area_m2: filters.area_m2,
      parkings: filters.parkings
    }
  }
}

const result = buildPresentationResult(payload)

// ---- printPrediction (port) ----
const fmt = (n) => {
  if (n == null) return '-'
  const num = Number(n)
  if (!isFinite(num)) return '-'
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
const fmtN = (n, d = 1) => {
  if (n == null) return '-'
  const num = Number(n)
  if (!isFinite(num)) return '-'
  return num.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
const fmtCompact = (n) => {
  const num = Number(n)
  if (!isFinite(num)) return '-'
  return '$' + Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(num)
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const sp = result.search_params || {}
const p = result.percentiles || {}
const md = result.market_distribution || {}
const services = md.nearby_services || []

const barrio = result.neighborhood || result.location_used || ''
const precioTotal = Number(result.total_price || 0)
const precioM2 = result.price_per_m2 || 0
const marketRef = result.market_reference_price || result.market_comparison?.neighborhood_avg_price || 0
const avgM2 = Number(result.market_avg_price_m2 || md.avg_price_per_m2 || 0)
const sampleCount = Number(md.sample_count || 0)
const confidence = Number(result.confidence)
const posText = result.market_position_text || ''
const gapPct = result.market_gap_pct
const gapValue = result.market_gap_value
const pos = result.market_position || ''
const posColor = pos === 'below_market' ? '#16a34a' : pos === 'above_market' ? '#dc2626' : '#6b7280'
const posHex14 = posColor + '24'
const distribution = result.distribution || []
const whisker = result.whisker_plot
const warnings = result.model_info?.warnings || []
const recommendation = result.recommendation
const userPrice = Number(result.user_price)
const hasUserPrice = isFinite(userPrice) && userPrice > 0

const now = new Date()
const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`
const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

const catLabels = {
  school: 'Colegio', hospital: 'Hospital', pharmacy: 'Farmacia',
  supermarket: 'Supermercado', bus_station: 'Bus', subway_station: 'Metro',
  recreativo: 'Recreativo', corporate_office: 'Oficinas', convenience_store: 'Tienda'
}

const specsData = [sp.habitaciones, sp.bathrooms, sp.parkings, sp.area_m2]
const specLabels = ['Habitaciones', 'Baños', 'Parqueos', 'm²']
const specsHtml = specsData.some(v => v != null && v !== '') ? `
  <div class="section">
    <h3>Características del Inmueble</h3>
    <div class="specs">
      ${specsData.map((v, i) => v != null && v !== '' ? `
        <div class="spec-card">
          <div class="spec-val">${esc(v)}</div>
          <div class="spec-label">${specLabels[i]}</div>
        </div>` : '').join('')}
    </div>
  </div>` : ''

let userPriceHtml = ''
if (hasUserPrice && precioTotal > 0) {
  const diff = userPrice - precioTotal
  const pct = (diff / precioTotal) * 100
  const absPct = Math.abs(pct)
  const inRange = absPct <= 5
  const isAbove = diff > 0
  const upColor = inRange ? '#6b7280' : isAbove ? '#dc2626' : '#16a34a'
  const upBg = inRange ? '#f9fafb' : isAbove ? '#fef2f2' : '#f0fdf4'
  const upLabel = inRange ? 'en línea con' : isAbove ? 'por encima del' : 'por debajo del'
  userPriceHtml = `
  <div class="userprice" style="background:${upBg};border-color:${upColor}">
    <div class="userprice-head" style="color:${upColor}">Tu precio de compra: ${fmt(userPrice)}</div>
    <div class="userprice-body">
      Está <strong style="color:${upColor}">${inRange ? '±' : ''}${fmtN(absPct, 1)}%</strong>
      ${upLabel} valor estimado (${fmt(precioTotal)})
      &nbsp;|&nbsp; Diferencia: <strong style="color:${upColor}">${diff > 0 ? '+' : '-'}${fmt(Math.abs(diff))}</strong>
    </div>
  </div>`
}

const gapHtml = (gapValue != null && gapPct != null && isFinite(Number(gapValue)) && isFinite(Number(gapPct))) ? `
  <p class="meta" style="margin:-8px 0 12px">
    ${fmt(Math.abs(Math.round(Number(gapValue))))} (${fmtN(Math.abs(Number(gapPct)), 2)}%)
    ${Number(gapValue) < 0 ? 'por debajo' : 'por encima'} del mercado
  </p>` : ''

const contextHtml = (avgM2 > 0 || (marketRef > 0 && sampleCount > 0)) ? `
  <div class="callout">
    ${avgM2 > 0
      ? `El precio promedio por m² en esta zona es <strong>${fmt(Math.round(avgM2))}/m²</strong>${sampleCount > 0 ? `, basado en ${sampleCount} propiedades comparables` : ''}.`
      : `Referencia de mercado: <strong>${fmt(marketRef)}</strong>${sampleCount > 0 ? ` (${sampleCount} comparables)` : ''}.`}
    ${md.coordinates?.radius_km ? ` Radio de análisis: ${fmtN(md.coordinates.radius_km, 1)} km.` : ''}
  </div>` : ''

const percentilesHtml = (p.p10 || p.p50 || p.p90) ? `
  <div class="section">
    <h3>Rango de Confianza${isFinite(confidence) && confidence > 0 ? ` <span class="h3-note">Confianza estimada: ${(confidence * 100).toFixed(0)}%</span>` : ''}</h3>
    <div class="percentiles">
      <div class="pct"><div class="pct-val">${fmt(p.p10)}</div><div class="pct-label">Conservador (P10)</div></div>
      <div class="pct pct-mid"><div class="pct-val">${fmt(p.p50)}</div><div class="pct-label">Probable (P50)</div></div>
      <div class="pct"><div class="pct-val">${fmt(p.p90)}</div><div class="pct-label">Optimista (P90)</div></div>
    </div>
    <p class="meta" style="margin:5px 0 0">El rango P10–P90 expresa la incertidumbre del modelo: el valor real puede ubicarse fuera de ese rango.</p>
  </div>` : ''

const interpRows = [
  { key: 'good_investment', label: RECOMMENDATION_LABELS.good_investment, range: 'Desviación < −15%' },
  { key: 'moderate', label: RECOMMENDATION_LABELS.moderate, range: '−15% a +15%' },
  { key: 'poor', label: RECOMMENDATION_LABELS.poor, range: 'Desviación > +15%' }
]
const interpHtml = `
  <div class="section">
    <h3>Referencia de Interpretación</h3>
    <table class="interp">
      ${interpRows.map((row) => {
        const active = recommendation === row.key
        const color = RECOMMENDATION_COLORS[row.key]
        return `
        <tr style="${active ? `background:${color}18` : ''}">
          <td style="width:14px"><span class="dot" style="background:${color}"></span></td>
          <td style="${active ? 'font-weight:bold' : ''}">${row.label}${active ? ' &nbsp;←&nbsp; resultado de esta consulta' : ''}</td>
          <td style="text-align:right;color:#666">${row.range}</td>
        </tr>`
      }).join('')}
    </table>
  </div>`

const warningsHtml = warnings.length ? `
  <div class="callout callout-warn">
    <strong>Advertencias del modelo:</strong> ${warnings.map((w) => esc(w)).join(' · ')}
  </div>` : ''

let histogramHtml = ''
if (distribution.length > 0) {
  const maxCount = Math.max(...distribution.map((b) => Number(b.count) || 0), 1)
  const rows = distribution.map((bin) => {
    const start = Number(bin.range_start)
    const end = Number(bin.range_end)
    const count = Number(bin.count) || 0
    const isEstimated = precioTotal >= start && precioTotal <= end
    const isUser = hasUserPrice && userPrice >= start && userPrice <= end
    const barColor = isEstimated ? '#C4714B' : '#6E7F4B'
    const marks = [
      isEstimated ? '<span style="color:#dc2626">◄ Estimado</span>' : '',
      isUser ? '<span style="color:#C4714B">◄ Tu precio</span>' : ''
    ].filter(Boolean).join(' ')
    return `
      <tr>
        <td class="hist-range">${fmtCompact(start)} – ${fmtCompact(end)}</td>
        <td class="hist-track-cell">
          <div class="hist-track"><div class="hist-bar" style="width:${Math.max(1, (count / maxCount) * 100)}%;background:${barColor}"></div></div>
        </td>
        <td class="hist-count">${count}${bin.percentage != null ? ` (${fmtN(bin.percentage, 1)}%)` : ''}</td>
        <td class="hist-mark">${marks}</td>
      </tr>`
  }).join('')

  histogramHtml = `
  <div class="section avoid-break">
    <h3>Distribución del Mercado (Histograma)</h3>
    <table class="hist">${rows}</table>
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:#6E7F4B"></span>Propiedades comparables por rango de precio</span>
      <span class="legend-item"><span class="legend-dot" style="background:#C4714B"></span>Rango donde cae el valor estimado</span>
      ${hasUserPrice ? '<span class="legend-item"><span class="legend-dot" style="background:#dc2626"></span>Marcas de posición del estimado y de tu precio</span>' : ''}
    </div>
  </div>`
}

let whiskerHtml = ''
if (whisker && isFinite(Number(whisker.min_value)) && isFinite(Number(whisker.max_value))) {
  const wMin = Number(whisker.min_value)
  const wMax = Number(whisker.max_value)
  const q1 = Number(whisker.q1)
  const q3 = Number(whisker.q3)
  const median = Number(whisker.median)
  const points = [wMin, wMax, precioTotal].concat(hasUserPrice ? [userPrice] : [])
  const domMin = Math.min(...points)
  const domMax = Math.max(...points)
  const span = domMax - domMin || 1
  const W = 660, H = 104, padX = 26, axisY = 56
  const x = (v) => padX + ((v - domMin) / span) * (W - padX * 2)

  whiskerHtml = `
  <div class="section avoid-break">
    <h3>Distribución de Precios en la Zona</h3>
    <svg class="boxplot" viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
      <line x1="${x(wMin)}" y1="${axisY}" x2="${x(wMax)}" y2="${axisY}" stroke="#9ca3af" stroke-width="2"/>
      <line x1="${x(wMin)}" y1="${axisY - 12}" x2="${x(wMin)}" y2="${axisY + 12}" stroke="#9ca3af" stroke-width="2"/>
      <line x1="${x(wMax)}" y1="${axisY - 12}" x2="${x(wMax)}" y2="${axisY + 12}" stroke="#9ca3af" stroke-width="2"/>
      <rect x="${x(q1)}" y="${axisY - 16}" width="${Math.max(1, x(q3) - x(q1))}" height="32" fill="rgba(110,127,75,0.25)" stroke="#6E7F4B" stroke-width="2"/>
      <line x1="${x(median)}" y1="${axisY - 18}" x2="${x(median)}" y2="${axisY + 18}" stroke="#ef4444" stroke-width="3"/>
      <circle cx="${x(precioTotal)}" cy="${axisY}" r="6" fill="#10b981" stroke="#059669" stroke-width="2"/>
      ${hasUserPrice ? `<polygon points="${x(userPrice)},${axisY - 24} ${x(userPrice) - 7},${axisY - 36} ${x(userPrice) + 7},${axisY - 36}" fill="#C4714B" stroke="#A85A32" stroke-width="1.5"/>` : ''}
      <text x="${padX}" y="${H - 6}" font-size="10" fill="#6b7280" text-anchor="start">${fmt(domMin)}</text>
      <text x="${W - padX}" y="${H - 6}" font-size="10" fill="#6b7280" text-anchor="end">${fmt(domMax)}</text>
    </svg>
    <div class="percentiles" style="margin-top:4px">
      <div class="pct"><div class="pct-val2">${fmt(wMin)}</div><div class="pct-label">Mínimo</div></div>
      <div class="pct"><div class="pct-val2">${fmt(q1)}</div><div class="pct-label">Q1</div></div>
      <div class="pct pct-mid"><div class="pct-val2">${fmt(median)}</div><div class="pct-label">Mediana</div></div>
      <div class="pct"><div class="pct-val2">${fmt(q3)}</div><div class="pct-label">Q3</div></div>
      <div class="pct"><div class="pct-val2">${fmt(wMax)}</div><div class="pct-label">Máximo</div></div>
    </div>
    <div class="legend">
      <span class="legend-item"><span class="legend-box" style="background:rgba(110,127,75,0.25);border-color:#6E7F4B"></span>Q1–Q3 (rango central)</span>
      <span class="legend-item"><span class="legend-line" style="background:#ef4444"></span>Mediana: ${fmt(median)}</span>
      <span class="legend-item"><span class="legend-dot" style="background:#10b981"></span>Estimado del modelo: ${fmt(precioTotal)}</span>
      ${hasUserPrice ? `<span class="legend-item"><span class="legend-tri"></span>Tu precio: ${fmt(userPrice)}</span>` : ''}
    </div>
  </div>`
}

const approxCount = services.filter((s) => String(s?.position_source || '') === 'trilaterated').length
const servicesHtml = services.length ? `
  <div class="section">
    <h3>Servicios Cercanos (${services.length})</h3>
    <table class="services">
      <thead><tr><th style="width:22px">#</th><th>Nombre</th><th>Tipo</th><th style="text-align:right">Distancia</th><th style="text-align:right">Tiempo en carro</th></tr></thead>
      <tbody>
        ${services.map((s, i) => {
          const cat = String(s.category || '').toLowerCase()
          const color = SERVICE_COLORS[cat] || '#334155'
          const approx = String(s?.position_source || '') === 'trilaterated'
          return `
          <tr class="${i % 2 === 0 ? 'even' : ''}">
            <td><span class="svc-num" style="background:${color}">${i + 1}</span></td>
            <td>${esc(s.name || '')}${approx ? '<span class="approx">*</span>' : ''}</td>
            <td style="color:#666">${catLabels[cat] || esc(s.category || '')}</td>
            <td style="color:#666;text-align:right">${s.distance_km != null ? fmtN(s.distance_km, 2) + ' km' : ''}</td>
            <td style="color:#666;text-align:right">${formatTravelTimeRange(Number(s.travel_time_min)) ?? ''}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
    <p class="meta" style="margin:5px 0 0">
      Lista completa de los servicios dentro del área de análisis. La distancia es en línea recta desde el punto consultado;
      el tiempo en carro se muestra como rango porque se calcula a partir de esa distancia y no del recorrido real ni del tráfico.
      ${approxCount > 0 ? `<br/>* ${approxCount} servicio(s) con posición aproximada (coordenada reconstruida, no medida).` : ''}
    </p>
  </div>` : ''

// ---- Mapa: Leaflet en vivo (los tiles cargan antes del print de Chrome headless)
const coords = md.coordinates
let mapHtml = ''
let mapScript = ''
if (coords && isFinite(Number(coords.lat)) && isFinite(Number(coords.lng))) {
  const radiusKm = Number(coords.radius_km || md.radius_km || 0)
  const mapServices = services
    .map((s, i) => ({
      lat: Number(s.lat), lng: Number(s.lng),
      color: SERVICE_COLORS[String(s.category || '').toLowerCase()] || '#334155',
      label: String(i + 1)
    }))
    .filter((s) => isFinite(s.lat) && isFinite(s.lng))
  const usedCats = Array.from(new Set(services.map((s) => String(s.category || '').toLowerCase()).filter(Boolean)))
  const legendHtml = usedCats.map((c) => `
    <span class="legend-item"><span class="legend-dot" style="background:${SERVICE_COLORS[c] || '#334155'}"></span>${catLabels[c] || esc(c)}</span>`).join('')

  mapHtml = `
  <div class="section avoid-break">
    <h3>Ubicación y Servicios Cercanos</h3>
    <img class="map-img" src="map.png" alt="Mapa de la zona"/>
    <div class="legend">
      <span class="legend-item"><span class="legend-dot" style="background:#5C6B43"></span>Ubicación consultada</span>
      ${radiusKm > 0 ? `<span class="legend-item"><span class="legend-ring"></span>Área de análisis (${fmtN(radiusKm, 1)} km)</span>` : ''}
      ${legendHtml}
    </div>
    <p class="meta" style="margin-top:5px">Los números del mapa corresponden a la tabla de servicios cercanos. Mapa © OpenStreetMap.</p>
  </div>`

  const mapPage = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>html,body,#map{margin:0;width:720px;height:400px}</style>
</head><body><div id="map"></div>
<script>
  const center = [${Number(coords.lat)}, ${Number(coords.lng)}]
  const map = L.map('map', { zoomControl: false, attributionControl: false, fadeAnimation: false, zoomAnimation: false }).setView(center, 15)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
  const circle = L.circle(center, { radius: ${radiusKm * 1000}, color: '#10b981', weight: 2, fillColor: '#10b981', fillOpacity: 0.06 }).addTo(map)
  const services = ${JSON.stringify(mapServices)}
  for (const s of services) {
    L.marker([s.lat, s.lng], { icon: L.divIcon({
      className: '', iconSize: [16, 16], iconAnchor: [8, 8],
      html: '<div style="width:16px;height:16px;border-radius:8px;background:' + s.color + ';color:#fff;font:bold 8px/16px Arial;text-align:center;border:1px solid #fff">' + s.label + '</div>'
    }) }).addTo(map)
  }
  L.circleMarker(center, { radius: 9, color: '#fff', weight: 2, fillColor: '#5C6B43', fillOpacity: 1 }).addTo(map)
  map.fitBounds(circle.getBounds().pad(0.05))
</script></body></html>`
  writeFileSync(join(here, 'map_page.html'), mapPage)
}

const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Avii - Informe de ejemplo</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #111; background: #fff; }

    .header { background: #2F3A26; color: #fff; padding: 14px 24px; display: flex; justify-content: space-between; align-items: center; }
    .header-brand { display: flex; align-items: center; gap: 12px; }
    .logo { background: #fff; color: #2F3A26; width: 30px; height: 30px; font-size: 17px; font-weight: bold; display: flex; align-items: center; justify-content: center; }
    .brand-name { font-size: 18px; font-weight: bold; }
    .brand-sub { font-size: 9px; opacity: 0.8; margin-top: 2px; }
    .header-date { font-size: 10px; opacity: 0.8; text-align: right; }

    .sample-banner { background: #C0663B; color: #fff; padding: 6px 24px; font-size: 10px; font-weight: bold; letter-spacing: 1.5px; }

    .content { padding: 18px 24px; }
    .barrio { font-size: 20px; font-weight: bold; margin-bottom: 4px; }
    .meta { font-size: 10px; color: #666; margin-bottom: 14px; }

    .cards { display: flex; gap: 8px; margin-bottom: 14px; }
    .card { flex: 1; background: #F2EEE1; padding: 10px 12px; border-top: 4px solid #5C6B43; }
    .card:nth-child(2) { border-top-color: #C2A46B; }
    .card:nth-child(3) { border-top-color: #7FA695; }
    .card:nth-child(4) { border-top-color: #C4714B; }
    .card-label { font-size: 9px; color: #666; margin-bottom: 3px; }
    .card-value { font-size: 17px; font-weight: bold; }
    .card-sub { font-size: 8px; color: #888; margin-top: 2px; }

    .pill { display: inline-block; padding: 4px 14px; font-size: 11px; font-weight: bold; margin-bottom: 14px; }

    .userprice { border: 1px solid; padding: 8px 12px; margin-bottom: 14px; }
    .userprice-head { font-size: 13px; font-weight: bold; }
    .userprice-body { font-size: 10px; color: #555; margin-top: 3px; }

    .callout { background: #F1EDDE; border-left: 3px solid #5C6B43; padding: 7px 10px; font-size: 10px; color: #333; margin-bottom: 14px; }
    .callout-warn { background: #fffbeb; border-left-color: #f59e0b; }
    .callout-alert { background: #fef2f2; border-left-color: #dc2626; }

    .section { margin-bottom: 14px; }
    .section h3 { font-size: 11px; font-weight: bold; margin-bottom: 7px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
    .h3-note { font-weight: normal; color: #666; font-size: 9px; float: right; }
    .avoid-break { page-break-inside: avoid; }

    .percentiles { display: flex; gap: 8px; }
    .pct { flex: 1; background: #F2EEE1; padding: 8px; text-align: center; }
    .pct-mid { background: #F1EDDE; border: 1px solid #5C6B43; }
    .pct-val { font-size: 14px; font-weight: bold; }
    .pct-val2 { font-size: 11px; font-weight: bold; }
    .pct-label { font-size: 9px; color: #666; margin-top: 2px; }

    .specs { display: flex; gap: 8px; }
    .spec-card { flex: 1; background: #F2EEE1; padding: 10px 8px; text-align: center; }
    .spec-val { font-size: 18px; font-weight: bold; }
    .spec-label { font-size: 9px; color: #666; margin-top: 2px; }

    .interp { width: 100%; border-collapse: collapse; font-size: 10px; }
    .interp td { padding: 4px 8px; border-top: 1px solid #e5e7eb; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

    .hist { width: 100%; border-collapse: collapse; font-size: 9px; }
    .hist td { padding: 2px 4px; vertical-align: middle; }
    .hist-range { white-space: nowrap; color: #444; width: 108px; }
    .hist-track-cell { width: auto; }
    .hist-track { background: #f1f5f9; height: 11px; width: 100%; }
    .hist-bar { height: 11px; }
    .hist-count { white-space: nowrap; color: #666; text-align: right; width: 74px; }
    .hist-mark { white-space: nowrap; font-weight: bold; width: 118px; }

    .boxplot { display: block; border: 1px solid #e5e7eb; }

    .map-img { width: 100%; border: 1px solid #e5e7eb; display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 9px; color: #555; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .legend-box { width: 10px; height: 8px; display: inline-block; border: 1px solid; }
    .legend-line { width: 10px; height: 2px; display: inline-block; }
    .legend-tri { width: 0; height: 0; display: inline-block; border-left: 5px solid transparent; border-right: 5px solid transparent; border-bottom: 8px solid #C4714B; }
    .legend-ring { width: 8px; height: 8px; border-radius: 50%; display: inline-block; border: 1.5px solid #10b981; background: #ecfdf5; }

    .services { width: 100%; border-collapse: collapse; font-size: 10px; }
    .services thead { display: table-header-group; }
    .services tr { page-break-inside: avoid; }
    .services th { text-align: left; padding: 4px 8px; background: #F2EEE1; font-size: 9px; color: #666; }
    .services td { padding: 4px 8px; }
    .services tr.even td { background: #f9fafb; }
    .svc-num { display: inline-block; min-width: 15px; height: 15px; line-height: 15px; padding: 0 2px; border-radius: 8px; color: #fff; font-size: 8px; font-weight: bold; text-align: center; }
    .approx { color: #b45309; font-weight: bold; }

    .legal { page-break-inside: avoid; border: 1px solid #e5e7eb; padding: 10px 12px; margin-top: 14px; }
    .legal h4 { font-size: 10px; margin-bottom: 5px; }
    .legal p, .legal li { font-size: 8px; color: #555; line-height: 1.45; }
    .legal ol { margin: 0 0 0 14px; }
    .legal li { margin-bottom: 3px; }

    .footer { border-top: 1px solid #e5e7eb; padding: 8px 24px; font-size: 9px; color: #999; display: flex; justify-content: space-between; margin-top: 8px; }

    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-brand">
      <div class="logo">A</div>
      <div>
        <div class="brand-name">Avii</div>
        <div class="brand-sub">Analisis de Inversion Inmobiliaria</div>
      </div>
    </div>
    <div class="header-date">
      ${dateStr} ${timeStr}<br/>
      Reporte estimativo - no es un avalúo
    </div>
  </div>
  <div class="sample-banner">INFORME DE EJEMPLO — generado con datos reales del mercado para un inmueble de muestra</div>

  <div class="content">
    ${barrio ? `<div class="barrio">${esc(barrio)}</div>` : ''}
    <p class="meta">
      ${result.model_version ? `Modelo: ${esc(result.model_version)}` : ''}
      ${result.location_source === 'coordinates' ? ' | Coordenadas del mapa' : result.location_source ? ' | Zona seleccionada' : ''}
    </p>

    <div class="cards">
      <div class="card">
        <div class="card-label">Precio Total Estimado</div>
        <div class="card-value">${fmt(precioTotal)}</div>
        <div class="card-sub">${esc(barrio)}</div>
      </div>
      <div class="card">
        <div class="card-label">Precio por m2</div>
        <div class="card-value">${fmt(precioM2)}</div>
        <div class="card-sub">metro cuadrado</div>
      </div>
      <div class="card">
        <div class="card-label">Referencia de Mercado</div>
        <div class="card-value">${fmt(marketRef)}</div>
        <div class="card-sub">mediana del mercado</div>
      </div>
      <div class="card">
        <div class="card-label">Tu Precio</div>
        <div class="card-value">${fmt(userPrice)}</div>
        <div class="card-sub">precio ingresado</div>
      </div>
    </div>

    ${gapHtml}
    ${userPriceHtml}

    ${posText ? `<div class="pill" style="background:${posHex14};color:${posColor}">${esc(posText)}${gapPct != null ? `  (${Number(gapPct) > 0 ? '+' : ''}${fmtN(gapPct, 1)}%)` : ''}</div>` : ''}

    ${warningsHtml}
    ${contextHtml}
    ${percentilesHtml}
    ${interpHtml}
    ${specsHtml}
    ${histogramHtml}
    ${whiskerHtml}
    ${mapHtml}
    ${servicesHtml}

    <div class="callout callout-alert">
      <strong>Este modelo puede cometer errores, como cualquier sistema de IA. Úsalo como apoyo y no como única fuente para tomar decisiones.</strong>
    </div>

    <div class="legal">
      <h4>Aviso legal y limitaciones del reporte</h4>
      <ol>
        <li><strong>Naturaleza del documento.</strong> Este reporte es una estimación estadística generada automáticamente por un modelo de inteligencia artificial a partir de datos de mercado disponibles. <strong>No constituye un avalúo, tasación, peritaje ni certificación de valor</strong>, ni una oferta, recomendación o asesoría financiera, legal, fiscal o de inversión.</li>
        <li><strong>No sustituye la debida diligencia.</strong> Antes de cualquier decisión o transacción, el usuario debe realizar su propia verificación: avalúo con profesional idóneo, inspección física del inmueble, estudio de título y registro público, y asesoría legal y financiera independiente.</li>
        <li><strong>Fuentes y vigencia.</strong> La estimación se basa en información de terceros y en datos históricos disponibles a la fecha de generación (${dateStr} ${timeStr}). Dichas fuentes pueden contener errores, estar incompletas o desactualizadas. El mercado inmobiliario cambia: el contenido de este reporte pierde vigencia con el tiempo.</li>
        <li><strong>Incertidumbre de la estimación.</strong> El rango P10–P90 refleja la incertidumbre del modelo; el valor real de una transacción puede ubicarse fuera de ese rango. Las cifras de mercado dependen de la cantidad y calidad de los comparables encontrados en la zona${sampleCount > 0 ? ` (en este reporte: ${sampleCount})` : ''}.</li>
        <li><strong>Servicios cercanos, distancias y tiempos.</strong> Las distancias son en línea recta desde el punto consultado y los tiempos de traslado son estimados a partir de esa distancia, sin considerar la ruta real, el estado de las vías ni el tráfico; por eso se presentan como rango. Algunas ubicaciones de servicios son aproximadas (coordenadas reconstruidas) y se marcan como tales.</li>
        <li><strong>Limitación de responsabilidad.</strong> Avii no garantiza la exactitud, integridad, actualidad ni idoneidad de este reporte para un fin particular, y no asume responsabilidad alguna por decisiones tomadas con base en él ni por daños o perjuicios directos, indirectos, incidentales o consecuentes derivados de su uso. El uso de la información es responsabilidad exclusiva del usuario.</li>
        <li><strong>Uso del documento.</strong> Este reporte se genera para el usuario que realizó la consulta y tiene carácter informativo. No debe presentarse ante entidades financieras, autoridades o terceros como avalúo o certificación de valor, ni reproducirse de forma parcial que altere su sentido.</li>
        <li><strong>Términos aplicables.</strong> El uso de la plataforma y de este reporte se rige por los Términos y Condiciones y la Política de Privacidad de Avii vigentes.</li>
      </ol>
    </div>
  </div>

  <div class="footer">
    <span>Avii | proyectoavii.github.io</span>
    <span>Generado el ${dateStr} a las ${timeStr}</span>
  </div>
  ${mapScript}
</body>
</html>`

const out = join(here, 'informe_ejemplo.html')
writeFileSync(out, html)
console.log('OK →', out)
