// Imagen genérica para la vista previa de los links (WhatsApp, Facebook...):
// public/og-sello.png, 1200×630. Correr con: node generar-og.mjs
// La vista previa por negocio queda para después (la app usa rutas con #, y
// los servicios que arman la vista previa no leen lo que va después del #).
import sharp from 'sharp'

const VERDE = '#0F7B5A'
const svg = Buffer.from(`
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="${VERDE}"/>
  <circle cx="1060" cy="90" r="220" fill="#ffffff" opacity="0.06"/>
  <circle cx="140" cy="600" r="180" fill="#ffffff" opacity="0.05"/>

  <!-- Tarjeta de ejemplo -->
  <g transform="translate(700 175)">
    <rect width="400" height="280" rx="36" fill="#ffffff"/>
    <text x="36" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#5B6661">Tu tarjeta</text>
    <text x="364" y="64" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="700" fill="#17201E">2 de 5</text>
    <g transform="translate(36 110)">
      <rect x="0" width="56" height="64" rx="16" fill="${VERDE}"/>
      <path d="M14 33l9 9 19-19" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="68" width="56" height="64" rx="16" fill="${VERDE}"/>
      <path d="M82 33l9 9 19-19" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="138" y="2" width="52" height="60" rx="14" fill="none" stroke="#C9CFCC" stroke-width="3" stroke-dasharray="8 6"/>
      <rect x="206" y="2" width="52" height="60" rx="14" fill="none" stroke="#C9CFCC" stroke-width="3" stroke-dasharray="8 6"/>
      <rect x="274" y="2" width="52" height="60" rx="14" fill="none" stroke="${VERDE}" stroke-width="4"/>
      <g transform="translate(286 16)" stroke="${VERDE}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="11" width="26" height="19" rx="3"/><path d="M14 11v19M1 17h26"/>
        <path d="M14 11c-2-4-7-6-8-3s3 3 8 3c5 0 9-1 8-3s-6-1-8 3z"/>
      </g>
    </g>
    <rect x="36" y="214" width="328" height="14" rx="7" fill="#E6EAE8"/>
    <rect x="36" y="214" width="131" height="14" rx="7" fill="${VERDE}"/>
  </g>

  <!-- Texto -->
  <text x="90" y="250" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff">Programa</text>
  <text x="90" y="340" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff">de lealtad</text>
  <text x="90" y="410" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#ffffff" opacity="0.92">Junta visitas y gana premios.</text>

  <!-- Marca Sello, discreta -->
  <g transform="translate(90 500)">
    <circle cx="22" cy="22" r="20" stroke="#ffffff" stroke-width="3" fill="none"/>
    <circle cx="22" cy="22" r="13" stroke="#ffffff" stroke-width="2.5" fill="none"/>
    <path d="M15 22l5 5 9-9" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="58" y="32" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" fill="#ffffff">Hecho con Sello</text>
  </g>
</svg>
`)

await sharp(svg).png({ compressionLevel: 9 }).toFile('./public/og-sello.png')
console.log('✓ public/og-sello.png (1200×630)')
