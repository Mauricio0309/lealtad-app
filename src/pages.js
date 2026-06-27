import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

const ADMIN_PASSWORD = 'lealtad2024'

// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════
const DS = {
  green900: '#052e1c', green800: '#0a5c47', green700: '#0d7a5f',
  green600: '#10a37a', green400: '#34d399', green100: '#d1fae5', green50: '#f0fdf4',
  gold500: '#f5a623', gold400: '#fbbf24', gold100: '#fef3c7',
  gray900: '#0f172a', gray700: '#334155', gray500: '#64748b',
  gray300: '#cbd5e1', gray100: '#f1f5f9', gray50: '#f8fafc', white: '#ffffff',
}

const NIVELES_DEFAULT = [
  { nombre: 'Inicio', emoji: '⭐', visitas_minimas: 0, premio_bienvenida: '' },
]

function getNivelActual(totalVisitas, niveles) {
  if (!niveles || niveles.length === 0) return NIVELES_DEFAULT[0]
  const lista = [...niveles].sort((a, b) => a.visitas_minimas - b.visitas_minimas)
  let actual = lista[0]
  for (const n of lista) { if (totalVisitas >= n.visitas_minimas) actual = n }
  return actual
}

function getSiguienteNivel(totalVisitas, niveles) {
  if (!niveles || niveles.length === 0) return null
  const lista = [...niveles].sort((a, b) => a.visitas_minimas - b.visitas_minimas)
  return lista.find(n => n.visitas_minimas > totalVisitas) || null
}

function colorNivel(nivel) {
  if (!nivel) return DS.gray500
  const colores = { 'Bronce': '#cd7f32', 'Plata': '#9ca3af', 'Oro': '#f5a623', 'Platino': '#667eea' }
  return colores[nivel.nombre] || DS.green800
}

function aplicarColorNegocio(color) {
  document.documentElement.style.setProperty('--negocio-color', color || DS.green800)
}

// ═══════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════
function inyectarEstilos() {
  if (document.getElementById('sello-styles')) return
  const s = document.createElement('style')
  s.id = 'sello-styles'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: ${DS.gray100}; color: ${DS.gray900}; -webkit-font-smoothing: antialiased; }

    .sello-topbar { background: var(--negocio-color, ${DS.green800}); padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
    .sello-topbar-brand { display: flex; align-items: center; gap: 10px; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px; color: ${DS.white}; letter-spacing: -0.02em; }
    .sello-topbar-brand .brand-name { color: ${DS.white}; }
    .sello-topbar-brand .brand-name span { color: ${DS.gold400}; }

    .s-card { background: ${DS.white}; border-radius: 16px; padding: 20px; margin: 0 16px 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04); }
    .s-section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${DS.gray500}; margin-bottom: 14px; }
    .s-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .s-stat { background: ${DS.gray50}; border-radius: 12px; padding: 14px 10px; text-align: center; }
    .s-stat-num { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 26px; color: ${DS.green800}; line-height: 1; }
    .s-stat-lbl { font-size: 10px; color: ${DS.gray500}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; }

    .s-prog-wrap { margin: 4px 0 16px; }
    .s-prog-header { display: flex; justify-content: space-between; font-size: 13px; color: ${DS.gray500}; margin-bottom: 8px; }
    .s-prog-track { height: 8px; background: ${DS.gray100}; border-radius: 999px; overflow: hidden; }
    .s-prog-fill { height: 100%; background: linear-gradient(90deg, ${DS.green700}, ${DS.green600}); border-radius: 999px; transition: width 1.2s cubic-bezier(0.34,1.56,0.64,1); }
    .s-prog-fill.gold { background: linear-gradient(90deg, ${DS.gold500}, ${DS.gold400}); box-shadow: 0 0 8px rgba(245,166,35,0.4); }

    .s-btn { width: 100%; padding: 15px; border: none; border-radius: 12px; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; transition: opacity 0.15s, transform 0.1s; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .s-btn:active { transform: scale(0.98); }
    .s-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .s-btn.primary { background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; }
    .s-btn.gold { background: ${DS.gold500}; color: ${DS.white}; }
    .s-btn.ghost { background: ${DS.gray100}; color: ${DS.gray700}; }
    .s-btn.share { background: linear-gradient(135deg, #833ab4, #fd1d1d, #fcb045); color: white; }
    .s-btn.danger { background: #fee2e2; color: #dc2626; }

    .s-input { width: 100%; padding: 13px 14px; border: 1.5px solid ${DS.gray300}; border-radius: 10px; font-family: 'Inter', sans-serif; font-size: 15px; color: ${DS.gray900}; background: ${DS.white}; transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
    .s-input:focus { border-color: ${DS.green700}; box-shadow: 0 0 0 3px rgba(13,122,95,0.1); }
    .s-input::placeholder { color: ${DS.gray300}; }
    .s-label { font-size: 13px; font-weight: 500; color: ${DS.gray700}; margin-bottom: 6px; display: block; }
    .s-field { margin-bottom: 14px; }
    .s-pw-wrap { position: relative; }
    .s-pw-wrap .s-input { padding-right: 44px; }
    .s-pw-eye { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; font-size: 18px; padding: 0; }

    .s-error { color: #dc2626; font-size: 13px; margin-top: 8px; }
    .s-success { background: ${DS.green100}; color: ${DS.green800}; border-radius: 10px; padding: 12px 14px; font-size: 14px; font-weight: 500; margin-top: 10px; display: flex; align-items: center; gap: 8px; }

    .s-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
    .s-badge.active { background: ${DS.green100}; color: ${DS.green800}; }
    .s-badge.inactive { background: ${DS.gray100}; color: ${DS.gray500}; }

    .s-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${DS.white}; border-top: 1px solid ${DS.gray100}; display: flex; box-shadow: 0 -2px 20px rgba(0,0,0,0.06); z-index: 100; padding-bottom: env(safe-area-inset-bottom); }
    .s-nav-btn { flex: 1; border: none; background: none; padding: 10px 8px 8px; cursor: pointer; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 3px; color: ${DS.gray300}; font-size: 11px; font-weight: 500; transition: color 0.15s; }
    .s-nav-btn .s-nav-icon { font-size: 22px; line-height: 1; }
    .s-nav-btn.active { color: ${DS.green800}; }

    .nivel-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 13px; font-weight: 700; font-family: 'Sora', sans-serif; }

    .sc-root { min-height: 100vh; background: ${DS.gray50}; padding-bottom: 40px; }
    .sc-hero { background: linear-gradient(145deg, ${DS.green900} 0%, var(--negocio-color, ${DS.green800}) 100%); padding: 48px 24px 80px; position: relative; overflow: hidden; }
    .sc-hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 32px; background: ${DS.gray50}; border-radius: 32px 32px 0 0; }
    .sc-hero-negocio { font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px; }
    .sc-hero-name { font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800; color: ${DS.white}; line-height: 1.1; }
    .sc-hero-sub { font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; }
    .sc-puntos-card { background: ${DS.white}; border-radius: 20px; margin: -40px 16px 16px; padding: 20px; box-shadow: 0 8px 32px rgba(0,0,0,0.1); position: relative; z-index: 1; }
    .sc-puntos-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .sc-punto-box { background: ${DS.gray50}; border-radius: 12px; padding: 16px; text-align: center; }
    .sc-punto-num { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 36px; color: ${DS.green800}; line-height: 1; }
    .sc-punto-num.gold { color: ${DS.gold500}; }
    .sc-punto-lbl { font-size: 11px; color: ${DS.gray500}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; }
    .sc-mensaje { padding: 14px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; text-align: center; margin-top: 16px; }
    .sc-mensaje.normal { background: ${DS.green50}; color: ${DS.green800}; border: 1px solid ${DS.green100}; }
    .sc-mensaje.premio { background: ${DS.gold100}; color: #92400e; border: 1px solid #fde68a; font-weight: 600; }
    .sc-mensaje.inicio { background: ${DS.gray100}; color: ${DS.gray500}; }
    .nivel-prog-track { height: 6px; background: ${DS.gray100}; border-radius: 999px; overflow: hidden; margin-top: 8px; }
    .nivel-prog-fill { height: 100%; border-radius: 999px; transition: width 1s ease; }

    .sq-root { min-height: 100vh; background: linear-gradient(160deg, ${DS.green900} 0%, var(--negocio-color, ${DS.green800}) 60%, #0d3d2e 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
    .sq-logo { margin-bottom: 32px; }
    .sq-negocio { font-size: 12px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px; }
    .sq-nombre { font-size: 30px; font-weight: 800; line-height: 1.1; margin-bottom: 8px; }
    .sq-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 36px; }
    .sq-form { width: 100%; max-width: 340px; background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.12); border-radius: 20px; padding: 28px 24px; backdrop-filter: blur(8px); }
    .sq-input { width: 100%; padding: 16px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.15); border-radius: 12px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; text-align: center; letter-spacing: 0.05em; outline: none; margin-bottom: 14px; transition: border-color 0.15s; }
    .sq-input:focus { border-color: ${DS.green400}; }
    .sq-input::placeholder { color: rgba(255,255,255,0.2); font-size: 15px; font-weight: 400; letter-spacing: 0; }
    .sq-btn { width: 100%; padding: 16px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 12px; color: ${DS.white}; font-size: 16px; font-weight: 700; font-family: 'Sora', sans-serif; cursor: pointer; box-shadow: 0 4px 20px rgba(16,163,122,0.4); transition: opacity 0.15s, transform 0.1s; }
    .sq-btn:hover { opacity: 0.92; }
    .sq-btn:active { transform: scale(0.98); }
    .sq-btn:disabled { opacity: 0.6; }

    .sbv-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green800} 0%, ${DS.green900} 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
    .sbv-logo { margin-bottom: 8px; }
    .sbv-app { font-size: 13px; color: ${DS.green400}; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 24px; }
    .sbv-bienvenido { font-size: 15px; color: rgba(255,255,255,0.5); margin-bottom: 6px; }
    .sbv-nombre { font-size: 32px; font-weight: 800; margin-bottom: 48px; line-height: 1.1; }
    .sbv-btns { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 320px; }
    .sbv-btn { padding: 18px 20px; border-radius: 14px; border: none; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 14px; transition: transform 0.1s, opacity 0.15s; text-align: left; }
    .sbv-btn:active { transform: scale(0.98); }
    .sbv-btn.primary { background: ${DS.white}; color: ${DS.green800}; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
    .sbv-btn.secondary { background: rgba(255,255,255,0.1); color: ${DS.white}; border: 1px solid rgba(255,255,255,0.2); }
    .sbv-btn-icon { font-size: 26px; flex-shrink: 0; }
    .sbv-btn-sub { font-size: 12px; font-weight: 400; opacity: 0.6; display: block; margin-top: 2px; }
    .sbv-salir { margin-top: 28px; background: none; border: none; color: rgba(255,255,255,0.3); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; }

    .s-toast-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: sFadeIn 0.2s ease; }
    .s-toast-box { background: ${DS.white}; border-radius: 24px; padding: 36px 28px; text-align: center; max-width: 300px; width: 90%; animation: sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1); }
    .s-toast-icon { font-size: 60px; display: block; margin-bottom: 14px; }
    .s-toast-title { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 800; color: ${DS.gray900}; margin-bottom: 8px; }
    .s-toast-sub { font-size: 14px; color: ${DS.gray500}; line-height: 1.5; }
    .s-toast-box.gold { background: linear-gradient(145deg, ${DS.gold100}, #fffdf5); }
    .s-toast-box.gold .s-toast-title { color: #78350f; }
    .s-toast-box.gold .s-toast-sub { color: #92400e; }
    .s-toast-hint { font-size: 12px; color: ${DS.gray300}; margin-top: 16px; }
    .s-toast-box.nivel { background: linear-gradient(145deg, #ede9fe, #f5f3ff); }
    .s-toast-box.nivel .s-toast-title { color: #4c1d95; }
    .s-toast-box.nivel .s-toast-sub { color: #5b21b6; }

    .s-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid ${DS.gray100}; }
    .s-row:last-child { border-bottom: none; padding-bottom: 0; }
    .s-row:first-child { padding-top: 0; }
    .s-row-title { font-size: 14px; font-weight: 600; color: ${DS.gray900}; }
    .s-row-sub { font-size: 12px; color: ${DS.gray500}; margin-top: 2px; }
    .s-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

    .s-login-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green800} 0%, ${DS.green900} 100%); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .s-login-card { background: ${DS.white}; border-radius: 24px; padding: 32px 28px; width: 100%; max-width: 380px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
    .s-login-logo { text-align: center; margin-bottom: 28px; }
    .s-login-app { font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800; color: ${DS.green800}; letter-spacing: -0.02em; }
    .s-login-app span { color: ${DS.gold500}; }
    .s-login-sub { font-size: 14px; color: ${DS.gray500}; margin-top: 4px; }

    .sc-search-area { padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 8px; }
    .sc-search-row { display: flex; gap: 8px; }
    .sc-search-input { flex: 1; }
    .sc-search-btn { padding: 13px 16px; background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; border: none; border-radius: 10px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; white-space: nowrap; }

    .s-chart-wrap { position: relative; height: 180px; margin-top: 8px; }
    .s-chart-wrap.donut { height: 200px; }

    .onb-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green800} 0%, ${DS.green900} 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 24px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
    .onb-step-dots { display: flex; gap: 8px; margin-bottom: 40px; }
    .onb-dot { width: 8px; height: 8px; border-radius: 50%; background: rgba(255,255,255,0.3); transition: all 0.3s; }
    .onb-dot.active { background: ${DS.green400}; width: 24px; border-radius: 4px; }
    .onb-icon { font-size: 64px; margin-bottom: 24px; }
    .onb-titulo { font-size: 26px; font-weight: 800; margin-bottom: 12px; line-height: 1.2; }
    .onb-desc { font-size: 15px; color: rgba(255,255,255,0.6); line-height: 1.6; margin-bottom: 48px; max-width: 300px; }
    .onb-btns { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 300px; }
    .onb-btn-primary { padding: 16px; border-radius: 12px; border: none; background: ${DS.white}; color: ${DS.green800}; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; cursor: pointer; }
    .onb-btn-skip { background: none; border: none; color: rgba(255,255,255,0.4); font-size: 13px; cursor: pointer; font-family: 'Inter', sans-serif; padding: 8px; }

    .kiosko-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green900}, var(--negocio-color, ${DS.green800})); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
    .kiosko-titulo { font-size: 18px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
    .kiosko-nombre { font-size: 36px; font-weight: 800; margin-bottom: 48px; }
    .kiosko-input { width: 100%; max-width: 320px; padding: 20px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 16px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 700; text-align: center; outline: none; margin-bottom: 16px; transition: border-color 0.15s; }
    .kiosko-input:focus { border-color: ${DS.green400}; }
    .kiosko-input::placeholder { color: rgba(255,255,255,0.2); font-size: 18px; font-weight: 400; }
    .kiosko-btn { width: 100%; max-width: 320px; padding: 20px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 16px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; cursor: pointer; }
    .kiosko-salir { position: fixed; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.4); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; }

    .landing-root { min-height: 100vh; background: ${DS.gray50}; }
    .landing-hero { background: linear-gradient(145deg, ${DS.green900}, var(--negocio-color, ${DS.green800})); padding: 60px 24px 80px; text-align: center; position: relative; }
    .landing-hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 40px; background: ${DS.gray50}; border-radius: 40px 40px 0 0; }
    .landing-nombre { font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800; color: ${DS.white}; margin-bottom: 8px; }
    .landing-tag { font-size: 14px; color: rgba(255,255,255,0.5); }
    .landing-premio { background: ${DS.white}; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 12px; }
    .landing-cta-btn { width: 100%; padding: 18px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 14px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; }

    @keyframes sFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sPopIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
  `
  document.head.appendChild(s)
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
function logoSVG(size = 36, color = '#ffffff') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="20" cy="20" r="18" stroke="${color}" stroke-width="2.5"/>
    <circle cx="20" cy="20" r="12" stroke="${color}" stroke-width="2"/>
    <path d="M14 20l4 4 8-8" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
}

// FIX: logo "Sello" junto sin separación
function topbarBrand() {
  return `<div class="sello-topbar-brand">
    ${logoSVG(28, '#fff')}
    <span class="brand-name">Sell<span>o</span></span>
  </div>`
}

function pwField(id, placeholder = '••••••') {
  return `<div class="s-pw-wrap"><input type="password" id="${id}" placeholder="${placeholder}" class="s-input" /><button type="button" class="s-pw-eye" onclick="var i=document.getElementById('${id}');if(i.type==='password'){i.type='text';this.textContent='🙈';}else{i.type='password';this.textContent='👁';}">👁</button></div>`
}

function errMsg(donde = '') {
  return `<p class="s-error">Sin conexión${donde ? ' al ' + donde : ''}. Verifica tu internet e intenta de nuevo.</p>`
}

function toast({ icon, title, sub, gold = false, nivel = false, autoClose = 2400, onTap = null }) {
  const el = document.createElement('div')
  el.className = 's-toast-overlay'
  const cls = gold ? 'gold' : nivel ? 'nivel' : ''
  el.innerHTML = `
    <div class="s-toast-box ${cls}">
      <span class="s-toast-icon">${icon}</span>
      <div class="s-toast-title">${title}</div>
      <div class="s-toast-sub">${sub}</div>
      ${gold ? `<div class="s-toast-hint">Toca para confirmar entrega</div>` : ''}
    </div>
  `
  document.body.appendChild(el)
  if (onTap) {
    el.addEventListener('click', () => { onTap(); el.remove() }, { once: true })
  } else {
    el.addEventListener('click', () => el.remove())
    if (autoClose) setTimeout(() => el?.remove(), autoClose)
  }
  return el
}

// FIX: cajero solo ve Cajero y Salir, sin Mi Panel
function navBarCajero() {
  return `
    <nav class="s-nav">
      <button class="s-nav-btn active" id="snav-cajero"><span class="s-nav-icon">🧾</span>Cajero</button>
      <button class="s-nav-btn" id="snav-salir"><span class="s-nav-icon">🚪</span>Salir</button>
    </nav>
  `
}

function navBarDueno(active = 'panel') {
  return `
    <nav class="s-nav">
      <button class="s-nav-btn ${active === 'panel' ? 'active' : ''}" id="snav-panel"><span class="s-nav-icon">📊</span>Mi Panel</button>
      <button class="s-nav-btn" id="snav-cajero-d"><span class="s-nav-icon">🧾</span>Cajero</button>
      <button class="s-nav-btn" id="snav-kiosko-d"><span class="s-nav-icon">🖥️</span>Kiosko</button>
      <button class="s-nav-btn" id="snav-salir"><span class="s-nav-icon">🚪</span>Salir</button>
    </nav>
    <div style="text-align:center;padding:4px 0 8px;border-top:1px solid rgba(255,255,255,0.08)">
      <button id="snav-privacidad-dueno" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:10px;cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline">Aviso de privacidad</button>
    </div>
  `
}

function initNavCajero() {
  document.getElementById('snav-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
}

function initNavDueno() {
  document.getElementById('snav-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('snav-cajero-d')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-kiosko-d')?.addEventListener('click', () => navigate('kiosko'))
  document.getElementById('snav-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
  document.getElementById('snav-privacidad-dueno')?.addEventListener('click', () => {
    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:9999'
    modal.innerHTML = `<div style="background:white;border-radius:24px 24px 0 0;padding:24px 20px 40px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#0f172a">Aviso de Privacidad — Dueños</div>
        <button id="cerrar-priv-dueno" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#64748b">Cerrar</button>
      </div>
      <div style="font-size:13px;color:#334155;line-height:1.7">
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Qué datos guardamos de tu negocio?</p>
        <p style="margin-bottom:12px">Nombre del negocio, correo electrónico y contraseña (encriptada). No guardamos datos bancarios.</p>
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Qué datos guardamos de tus clientes?</p>
        <p style="margin-bottom:12px">Solo nombre y teléfono de los clientes que se registran en tu programa. Tú eres responsable de informarles que sus datos se guardan.</p>
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Se comparten los datos?</p>
        <p style="margin-bottom:12px">No. Los datos de tu negocio y clientes son privados y no se venden ni comparten con terceros.</p>
        <p style="font-size:11px;color:#94a3b8;margin-top:16px">En cumplimiento con la LFPDPPP de México.</p>
      </div>
    </div>`
    document.body.appendChild(modal)
    modal.querySelector('#cerrar-priv-dueno')?.addEventListener('click', () => modal.remove())
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  })
}

function cargarChartJS() {
  return new Promise((resolve) => {
    if (window.Chart) { resolve(); return }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
    script.onload = resolve
    document.head.appendChild(script)
  })
}

async function renderizarGraficas(visitas, clientes) {
  await cargarChartJS()
  const hoy = new Date(); const dias7 = []; const labels7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy); d.setDate(d.getDate() - i)
    dias7.push(d.toISOString().split('T')[0])
    labels7.push(d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }))
  }
  const vpd = dias7.map(dia => (visitas||[]).filter(v => v.fecha?.startsWith(dia)).length)
  const inicioEsteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth()-1, 1).toISOString().split('T')[0]
  const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0]
  const vem = (visitas||[]).filter(v => v.fecha >= inicioEsteMes).length
  const vma = (visitas||[]).filter(v => v.fecha >= inicioMesAnt && v.fecha <= finMesAnt).length
  const nuevos = (clientes||[]).filter(c => c.total_visitas <= 1).length
  const recurrentes = (clientes||[]).filter(c => c.total_visitas > 1).length
  const total = nuevos + recurrentes

  ;['chart-barras','chart-dona','chart-meses'].forEach(id => { const c = document.getElementById(id); if (c?._chartInstance) c._chartInstance.destroy() })

  const ctxB = document.getElementById('chart-barras')
  if (ctxB) ctxB._chartInstance = new window.Chart(ctxB, {
    type: 'bar',
    data: { labels: labels7, datasets: [{ data: vpd, backgroundColor: vpd.map((_, i) => i === 6 ? DS.green700 : DS.green100), borderRadius: 6, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, color: DS.gray500 } }, y: { grid: { color: DS.gray100 }, ticks: { font: { size: 11 }, color: DS.gray500, stepSize: 1 }, beginAtZero: true } } }
  })

  const ctxD = document.getElementById('chart-dona')
  if (ctxD) {
    if (total === 0) {
      ctxD.parentElement.innerHTML = `<p style="text-align:center;color:${DS.gray500};font-size:13px;padding:40px 0">Aún no hay clientes para mostrar</p>`
    } else {
      ctxD._chartInstance = new window.Chart(ctxD, {
        type: 'doughnut',
        data: { labels: ['Recurrentes', 'Nuevos'], datasets: [{ data: [recurrentes, nuevos], backgroundColor: [DS.green700, DS.green100], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, color: DS.gray700, padding: 16 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} (${Math.round((ctx.raw/total)*100)}%)` } } } }
      })
    }
  }

  const ctxM = document.getElementById('chart-meses')
  if (ctxM) {
    const ma = new Date().toLocaleDateString('es-MX', { month: 'long' })
    const mp = new Date(new Date().getFullYear(), new Date().getMonth()-1, 1).toLocaleDateString('es-MX', { month: 'long' })
    ctxM._chartInstance = new window.Chart(ctxM, {
      type: 'bar',
      data: { labels: [mp, ma], datasets: [{ data: [vma, vem], backgroundColor: [DS.gray100, DS.green700], borderRadius: 8, borderSkipped: false }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: DS.gray100 }, ticks: { font: { size: 11 }, color: DS.gray500, stepSize: 1 }, beginAtZero: true }, y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' }, color: DS.gray700 } } } }
    })
  }
}

// FIX: CSV con created_at como fallback
function exportarCSV(clientes, niveles, negocioNombre) {
  const headers = ['Nombre', 'Teléfono', 'Visitas totales', 'Nivel', 'Fecha registro']
  const filas = (clientes||[]).map(c => {
    const nivel = getNivelActual(c.total_visitas, niveles)
    const fechaRaw = c.fecha_registro || c.created_at
    const fecha = fechaRaw ? new Date(fechaRaw).toLocaleDateString('es-MX') : '—'
    return [c.nombre, c.telefono, c.total_visitas, `${nivel.emoji} ${nivel.nombre}`, fecha]
  })
  const csv = [headers, ...filas].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = `clientes-${negocioNombre}-${new Date().toISOString().split('T')[0]}.csv`; link.click()
  URL.revokeObjectURL(url)
}

function onboardingVisto() { return localStorage.getItem('sello_onboarding') === 'done' }
function marcarOnboardingVisto() { localStorage.setItem('sello_onboarding', 'done') }

const PASOS_ONBOARDING = [
  { icon: '🧾', titulo: 'Registra visitas en segundos', desc: 'El cajero busca al cliente por teléfono o nombre y toca "Registrar visita". Así de simple.' },
  { icon: '🏆', titulo: 'Configura tus niveles de lealtad', desc: 'Define cuántas visitas necesita un cliente para subir de nivel y qué premio recibe al llegar.' },
  { icon: '📊', titulo: 'Ve tus estadísticas en tiempo real', desc: 'Consulta cuántos clientes tienes, qué días son más concurridos y quiénes son tus clientes más fieles.' },
]

async function compartirHistoria({ tipo, negocioNombre, negocioEmoji, nivelNombre, nivelEmoji, premioNombre, totalVisitas, colorNegocio, clienteNombre, faltanVisitas, sigNivelPremio }) {
  return new Promise((resolve) => {
    // Formato vertical tipo tarjeta — estilo Duolingo
    const canvas = document.createElement('canvas')
    canvas.width = 1080; canvas.height = 1920
    const ctx = canvas.getContext('2d')

    // Fondo gris muy claro
    ctx.fillStyle = '#f1f5f9'
    ctx.fillRect(0, 0, 1080, 1920)

    // Tarjeta blanca centrada con sombra simulada
    const cx = 540, cy = 960
    const cw = 860, ch = 1200
    const cx0 = cx - cw/2, cy0 = cy - ch/2

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.08)'
    ctx.beginPath()
    const sr = 48
    ctx.roundRect(cx0+8, cy0+12, cw, ch, sr)
    ctx.fill()

    // Tarjeta blanca
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.roundRect(cx0, cy0, cw, ch, sr)
    ctx.fill()

    // Franja verde superior de la tarjeta
    ctx.fillStyle = '#0a5c47'
    ctx.beginPath()
    ctx.roundRect(cx0, cy0, cw, 16, [sr, sr, 0, 0])
    ctx.fill()

    // Logo Sello — círculo verde + palomita
    const lx = cx, ly = cy0 + 110
    ctx.strokeStyle = '#0a5c47'; ctx.lineWidth = 8
    ctx.beginPath(); ctx.arc(lx, ly, 52, 0, Math.PI*2); ctx.stroke()
    ctx.beginPath(); ctx.arc(lx, ly, 36, 0, Math.PI*2); ctx.stroke()
    ctx.lineWidth = 9; ctx.lineCap = 'round'; ctx.strokeStyle = '#0a5c47'
    const lpath = ctx.beginPath()
    ctx.moveTo(lx-16, ly+2); ctx.lineTo(lx-4, ly+16); ctx.lineTo(lx+18, ly-14); ctx.stroke()

    // "Sell" + "o" dorado
    ctx.textAlign = 'center'
    ctx.fillStyle = '#0a5c47'; ctx.font = 'bold 56px Arial'
    const sellW = ctx.measureText('Sell').width
    ctx.fillText('Sell', cx - ctx.measureText('o').width/2, ly + 90)
    ctx.fillStyle = '#f5a623'
    ctx.fillText('o', cx + sellW/2 - 2, ly + 90)

    // Línea divisora
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx0+60, ly+120); ctx.lineTo(cx0+cw-60, ly+120); ctx.stroke()

    // Número grande de visitas
    ctx.fillStyle = '#f5a623'; ctx.font = 'bold 220px Arial'; ctx.textAlign = 'center'
    ctx.fillText(String(totalVisitas), cx, cy0 + 560)

    // "visitas acumuladas"
    ctx.fillStyle = '#64748b'; ctx.font = '48px Arial'
    ctx.fillText('visitas acumuladas', cx, cy0 + 630)

    // Línea divisora
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx0+60, cy0+670); ctx.lineTo(cx0+cw-60, cy0+670); ctx.stroke()

    // Texto dinámico según situación del cliente
    // Si tiene premio: "El Carlitos le regaló un café gratis a Juan"
    // Si no ha llegado: "Juan está a N visitas de ganarse un café gratis en El Carlitos"
    let textoLinea1 = ''
    let textoLinea2 = ''
    if (premioNombre) {
      textoLinea1 = `${negocioNombre} le regaló`
      textoLinea2 = `${premioNombre} a ${clienteNombre || 'un cliente'}`
    } else if (sigNivelPremio && faltanVisitas > 0) {
      textoLinea1 = `${clienteNombre || 'Cliente'} está a ${faltanVisitas} visita${faltanVisitas === 1 ? '' : 's'} de ganarse`
      textoLinea2 = `${sigNivelPremio} en ${negocioNombre}`
    } else {
      textoLinea1 = `${clienteNombre || 'Cliente'} tiene`
      textoLinea2 = `${totalVisitas} visitas en ${negocioNombre}`
    }
    ctx.fillStyle = '#0f172a'; ctx.textAlign = 'center'
    // Función para dibujar texto con wrap
    const drawWrapped = (texto, startYp, fontSize, color = '#0f172a') => {
      ctx.font = `bold ${fontSize}px Arial`; ctx.fillStyle = color
      const maxWt = cw - 120
      const wds = texto.split(' '); let ln = ''; const lns = []
      for (const w of wds) {
        const test = ln ? ln + ' ' + w : w
        if (ctx.measureText(test).width > maxWt && ln) { lns.push(ln); ln = w }
        else ln = test
      }
      if (ln) lns.push(ln)
      lns.forEach((l, i) => ctx.fillText(l, cx, startYp + i * (fontSize + 14)))
      return lns.length * (fontSize + 14)
    }
    const h1 = drawWrapped(textoLinea1, cy0 + 730, 54, '#64748b')
    drawWrapped(textoLinea2, cy0 + 730 + h1 + 10, 62, '#0f172a')
    const afterText = cy0 + 730 + h1 + 100

    // Línea divisora
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(cx0+60, cy0+1080); ctx.lineTo(cx0+cw-60, cy0+1080); ctx.stroke()

    // Fecha y negocio pie
    const fecha = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
    ctx.fillStyle = '#94a3b8'; ctx.font = '38px Arial'; ctx.textAlign = 'left'
    ctx.fillText(negocioNombre, cx0 + 60, cy0 + 1130)
    ctx.textAlign = 'right'
    ctx.fillText(fecha, cx0 + cw - 60, cy0 + 1130)
    setTimeout(() => {
      canvas.toBlob(async (blob) => {
        if (!blob) { resolve('error'); return }
        const file = new File([blob], 'sello-historia.png', { type: 'image/png' })
        const url = URL.createObjectURL(blob)
        try {
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: tipo === 'premio' ? '¡Gané un premio!' : `¡Llegué a ${nivelNombre}!`, text: `Con Sello en ${negocioNombre} 🎉` })
          } else {
            const link = document.createElement('a'); link.href = url; link.download = 'sello-historia.png'; link.click()
          }
        } catch(e) {
          // Fallback final — abrir imagen en nueva pestaña
          window.open(url, '_blank')
        }
        setTimeout(() => URL.revokeObjectURL(url), 3000)
        resolve('done')
      }, 'image/png')
    }, 100)
  })
}


// ── Pantalla de celebración al subir de nivel ─────────────
// ═══════════════════════════════════════════════════════════
// PÁGINAS
// ═══════════════════════════════════════════════════════════

export function paginaLogin() {
  inyectarEstilos()
  return `
    <div class="s-login-root">
      <div class="s-login-card">
        <div class="s-login-logo">${logoSVG(48, DS.green800)}<div class="s-login-app">Sell<span>o</span></div><div class="s-login-sub">Programa de lealtad digital</div></div>
        <div class="s-field"><label class="s-label">Correo electrónico</label><input type="email" id="email" class="s-input" placeholder="tu@correo.com" /></div>
        <div class="s-field"><label class="s-label">Contraseña</label>${pwField('password')}</div>
        <button class="s-btn primary" id="btn-login" style="margin-top:8px">Entrar</button>
        <div id="msg" style="margin-top:10px"></div>
        <button id="btn-olvide" style="background:none;border:none;color:${DS.gray500};font-size:13px;cursor:pointer;margin-top:14px;width:100%;text-align:center;font-family:'Inter',sans-serif;">¿Olvidaste tu contraseña?</button>
        <div id="msg-reset" style="margin-top:8px"></div>
        <div style="text-align:center;margin-top:12px">
          <button id="btn-privacidad-dueno" style="background:none;border:none;color:${DS.gray300};font-size:11px;cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline">Aviso de privacidad</button>
        </div>
      </div>
    </div>
  `
}

export function initLogin() {
  inyectarEstilos()
  const doLogin = async () => {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()
    const msg = document.getElementById('msg'); const btn = document.getElementById('btn-login')
    if (!email || !password) { msg.innerHTML = `<p class="s-error">Llena todos los campos</p>`; return }
    btn.disabled = true; btn.textContent = 'Verificando...'; msg.innerHTML = ''
    try {
      const { login } = await import('./auth.js')
      const negocio = await login(email, password)
      if (!negocio) { msg.innerHTML = `<p class="s-error">Correo o contraseña incorrectos</p>`; return }
      if (negocio.activo === false) { msg.innerHTML = `<p class="s-error">Esta cuenta está desactivada. Contacta al administrador.</p>`; const { logout } = await import('./auth.js'); logout(); return }
      window.location.hash = onboardingVisto() ? '#/bienvenida' : '#/onboarding'
      window.dispatchEvent(new Event('hashchange'))
    } catch (e) { msg.innerHTML = errMsg('servidor') }
    finally { btn.disabled = false; btn.textContent = 'Entrar' }
  }
  document.getElementById('btn-login').addEventListener('click', doLogin)
  document.getElementById('password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
  document.getElementById('btn-privacidad-dueno')?.addEventListener('click', () => navigate('privacidad', 'dueno'))

  // Recuperar contraseña
  document.getElementById('btn-olvide')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim()
    const msgR = document.getElementById('msg-reset')
    if (!email) { msgR.innerHTML = `<p class="s-error">Escribe tu correo arriba primero</p>`; return }
    msgR.innerHTML = `<p style="color:${DS.gray500};font-size:13px;text-align:center">Buscando...</p>`
    try {
      const { data } = await supabase.from('negocios').select('id,nombre').eq('email', email).single()
      if (!data) { msgR.innerHTML = `<p class="s-error">No encontramos una cuenta con ese correo</p>`; return }
      // Generar contraseña temporal legible y activarla directamente
      const palabras = ['cafe','mesa','luna','sol','mar','rio','pan','sal','dia','luz']
      const num = Math.floor(Math.random() * 900) + 100
      const nuevaPass = palabras[Math.floor(Math.random() * palabras.length)] + num
      await supabase.from('negocios').update({ password: nuevaPass, password_hash: nuevaPass }).eq('id', data.id)
      msgR.innerHTML = `
        <div style="background:${DS.green50};border:1.5px solid ${DS.green100};border-radius:12px;padding:16px;margin-top:4px">
          <div style="font-size:12px;color:${DS.green800};font-weight:600;margin-bottom:8px">Tu nueva contraseña temporal es:</div>
          <div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:${DS.green800};letter-spacing:0.08em;text-align:center;padding:8px 0">${nuevaPass}</div>
          <div style="font-size:11px;color:${DS.gray500};margin-top:8px;text-align:center">Escríbela arriba en "Contraseña" y entra. Cámbiala después si quieres.</div>
        </div>
      `
      // Pre-llenar el campo contraseña
      const pwField = document.getElementById('password')
      if (pwField) pwField.value = nuevaPass
    } catch (e) { msgR.innerHTML = `<p class="s-error">Sin conexión. Intenta de nuevo.</p>` }
  })
}

export function paginaOnboarding(paso = 0) {
  inyectarEstilos()
  const p = PASOS_ONBOARDING[paso]; const esUltimo = paso === PASOS_ONBOARDING.length - 1
  return `
    <div class="onb-root">
      <div class="onb-step-dots">${PASOS_ONBOARDING.map((_, i) => `<div class="onb-dot ${i===paso?'active':''}"></div>`).join('')}</div>
      <div class="onb-icon">${p.icon}</div>
      <div class="onb-titulo">${p.titulo}</div>
      <div class="onb-desc">${p.desc}</div>
      <div class="onb-btns">
        <button class="onb-btn-primary" id="onb-siguiente">${esUltimo ? '¡Empezar ahora!' : 'Siguiente →'}</button>
        ${!esUltimo ? `<button class="onb-btn-skip" id="onb-skip">Saltar</button>` : ''}
      </div>
    </div>
  `
}

export function initOnboarding(paso = 0) {
  inyectarEstilos()
  const esUltimo = paso === PASOS_ONBOARDING.length - 1
  document.getElementById('onb-siguiente')?.addEventListener('click', () => { if (esUltimo) { marcarOnboardingVisto(); navigate('bienvenida') } else navigate('onboarding', paso + 1) })
  document.getElementById('onb-skip')?.addEventListener('click', () => { marcarOnboardingVisto(); navigate('bienvenida') })
}

export async function paginaBienvenida() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    return `
      <div class="sbv-root">
        <div class="sbv-logo">${logoSVG(56, DS.white)}</div>
        <div class="sbv-app">Sello</div>
        <div class="sbv-bienvenido">Bienvenido de vuelta</div>
        <h1 class="sbv-nombre">${negocio.nombre}</h1>
        <div class="sbv-btns">
          <button class="sbv-btn primary" id="sbv-cajero"><span class="sbv-btn-icon">🧾</span><div><div>Panel Cajero</div><span class="sbv-btn-sub">Registrar visitas de clientes</span></div></button>
          <button class="sbv-btn secondary" id="sbv-panel"><span class="sbv-btn-icon">📊</span><div><div>Mi Panel</div><span class="sbv-btn-sub">Estadísticas, niveles y más</span></div></button>
          <button class="sbv-btn secondary" id="sbv-kiosko"><span class="sbv-btn-icon">🖥️</span><div><div>Modo Kiosko</div><span class="sbv-btn-sub">Pantalla completa para el mostrador</span></div></button>
        </div>
        <button class="sbv-salir" id="sbv-salir">Cerrar sesión</button>
      </div>
    `
  } catch (e) { return `<div class="s-login-root"><div class="s-login-card">${errMsg()}</div></div>` }
}

export function initBienvenida() {
  inyectarEstilos()
  document.getElementById('sbv-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('sbv-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('sbv-kiosko')?.addEventListener('click', () => navigate('kiosko'))
  document.getElementById('sbv-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
}

// ── CAJERO — sin acceso a Mi Panel ────────────────────────
export function paginaCajero() {
  inyectarEstilos()
  return `
    <div style="padding-bottom:72px">
      <div class="sello-topbar">
        ${topbarBrand()}
        <span style="font-size:13px;color:rgba(255,255,255,0.6)">Cajero</span>
      </div>
      <div class="sc-search-area">
        <div class="sc-search-row"><input type="tel" id="telefono" placeholder="Buscar por teléfono..." class="s-input sc-search-input" /><button id="buscar" class="sc-search-btn">Buscar</button></div>
        <div class="sc-search-row"><input type="text" id="nombre-buscar" placeholder="O buscar por nombre..." class="s-input sc-search-input" /><button id="buscar-nombre" class="sc-search-btn">Buscar</button></div>
      </div>
      <div id="resultado"></div>
      <div class="s-card" style="margin-top:4px">
        <div class="s-section-label">Atendidos hoy</div>
        <div id="ultimos-clientes"><p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">Cargando...</p></div>
      </div>
    </div>
    ${navBarCajero()}
  `
}

export async function initCajero() {
  inyectarEstilos(); initNavCajero()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (negocio) { const { data: nd } = await supabase.from('negocios').select('color_principal').eq('id', negocio.id).single(); if (nd?.color_principal) aplicarColorNegocio(nd.color_principal) }
  } catch (e) {}
  cargarUltimosClientes()
  document.getElementById('buscar').addEventListener('click', async () => { const t = document.getElementById('telefono').value.trim(); if (!t) return; document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono: t }) })
  document.getElementById('buscar-nombre').addEventListener('click', async () => { const n = document.getElementById('nombre-buscar').value.trim(); if (!n) return; document.getElementById('telefono').value = ''; await buscarYMostrar({ nombre: n }) })
  document.getElementById('telefono').addEventListener('keydown', async e => { if (e.key === 'Enter') { const t = document.getElementById('telefono').value.trim(); if (t) { document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono: t }) } } })
  document.getElementById('nombre-buscar').addEventListener('keydown', async e => { if (e.key === 'Enter') { const n = document.getElementById('nombre-buscar').value.trim(); if (n) { document.getElementById('telefono').value = ''; await buscarYMostrar({ nombre: n }) } } })
}

async function cargarUltimosClientes() {
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual(); if (!negocio) return
    const hoy = new Date().toISOString().split('T')[0]
    const { data: visitas, error } = await supabase.from('visitas').select('cliente_id,fecha').eq('negocio_id', negocio.id).gte('fecha', hoy).order('fecha', { ascending: false }).limit(20)
    if (error) throw error
    if (!visitas || visitas.length === 0) { document.getElementById('ultimos-clientes').innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center">Ningún cliente atendido hoy</p>`; return }
    const vistos = new Set(); const ids = []
    for (const v of visitas) { if (!vistos.has(v.cliente_id)) { vistos.add(v.cliente_id); ids.push(v.cliente_id) } if (ids.length >= 5) break }
    const { data: clientes } = await supabase.from('clientes').select('id,nombre,telefono,total_visitas').in('id', ids)
    const ordenados = ids.map(id => clientes.find(c => c.id === id)).filter(Boolean)
    document.getElementById('ultimos-clientes').innerHTML = ordenados.map(c => `
      <div class="s-row" style="cursor:pointer" data-tel="${c.telefono}">
        <div><div class="s-row-title">${c.nombre}</div><div class="s-row-sub">${c.telefono}</div></div>
        <div class="s-row-actions" style="color:${DS.gray300};font-size:13px">${c.total_visitas} visitas →</div>
      </div>
    `).join('')
    document.querySelectorAll('#ultimos-clientes .s-row').forEach(row => {
      row.addEventListener('click', async () => { document.getElementById('telefono').value = row.dataset.tel; document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono: row.dataset.tel }); window.scrollTo({ top: 0, behavior: 'smooth' }) })
    })
  } catch (e) { document.getElementById('ultimos-clientes').innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center">Sin conexión</p>` }
}

async function buscarYMostrar({ telefono, nombre }) {
  const res = document.getElementById('resultado')
  res.innerHTML = `<div class="s-card"><p style="text-align:center;color:#aaa;padding:8px">Buscando...</p></div>`
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    let q = supabase.from('clientes').select('*').eq('negocio_id', negocio?.id)
    if (telefono) q = q.eq('telefono', telefono); else if (nombre) q = q.ilike('nombre', `%${nombre}%`)
    const { data, error } = await q; if (error) throw error
    if (telefono) {
      if (!data?.[0]) { res.innerHTML = `<div class="s-card"><p class="s-error" style="margin-bottom:12px">Cliente no encontrado</p><button class="s-btn primary" id="btn-nuevo">+ Registrar nuevo cliente</button></div>`; document.getElementById('btn-nuevo').addEventListener('click', () => navigate('registro', telefono)); return }
      mostrarCliente(data[0]); return
    }
    if (!data || data.length === 0) { res.innerHTML = `<div class="s-card"><p class="s-error">No se encontró ningún cliente con ese nombre</p></div>`; return }
    if (data.length === 1) { mostrarCliente(data[0]); return }
    res.innerHTML = `<div class="s-card"><div class="s-section-label">Se encontraron ${data.length} clientes</div>${data.map(c => `<div class="s-row" style="cursor:pointer" data-id="${c.id}"><div><div class="s-row-title">${c.nombre}</div><div class="s-row-sub">${c.telefono}</div></div><div style="color:${DS.gray300};font-size:13px">${c.total_visitas} visitas →</div></div>`).join('')}</div>`
    res.querySelectorAll('.s-row').forEach(row => { row.addEventListener('click', () => { const c = data.find(x => x.id === row.dataset.id); if (c) mostrarCliente(c) }) })
  } catch (e) { res.innerHTML = `<div class="s-card">${errMsg('buscar clientes')}</div>` }
}

async function mostrarCliente(data) {
  try {
    const { data: nd } = await supabase.from('negocios').select('meta_puntos,color_principal').eq('id', data.negocio_id).single()
    const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', data.negocio_id).order('visitas_minimas', { ascending: true })
    const tieneNiveles = niveles && niveles.length > 0
    const nivelActual = getNivelActual(data.total_visitas, niveles)
    const sigNivel = getSiguienteNivel(data.total_visitas, niveles)
    const nivelColor = colorNivel(nivelActual)

    // Para el cajero, el "premio" es el premio_bienvenida del siguiente nivel
    const meta = sigNivel ? sigNivel.visitas_minimas : (nd?.meta_puntos || 10)
    const visitasParaSiguiente = sigNivel ? sigNivel.visitas_minimas - data.total_visitas : 0
    const enMaximo = !sigNivel

    const res = document.getElementById('resultado')
    res.innerHTML = `
      <div class="s-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:${DS.gray900}">${data.nombre}</div>
          <div class="nivel-badge" style="background:${nivelColor}20;color:${nivelColor}">${nivelActual.emoji} ${nivelActual.nombre}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div class="s-stat"><div class="s-stat-num">${data.total_visitas}</div><div class="s-stat-lbl">Visitas totales</div></div>
          <div class="s-stat"><div class="s-stat-num">${enMaximo ? '💎' : visitasParaSiguiente}</div><div class="s-stat-lbl">${enMaximo ? 'Nivel máximo' : 'Para '+sigNivel.emoji+' '+sigNivel.nombre}</div></div>
        </div>
        ${!enMaximo ? `
        <div class="s-prog-wrap">
          <div class="s-prog-header"><span>Progreso a ${sigNivel.emoji} ${sigNivel.nombre}</span><span>${data.total_visitas}/${sigNivel.visitas_minimas}</span></div>
          <div class="s-prog-track"><div class="s-prog-fill" style="width:${Math.min(Math.round((data.total_visitas/sigNivel.visitas_minimas)*100),100)}%"></div></div>
        </div>
        ` : ''}
        <button class="s-btn primary" id="registrar" style="margin-top:4px">+ Registrar visita</button>
        <div id="msg-cajero" style="margin-top:10px"></div>
      </div>
    `

    document.getElementById('registrar').addEventListener('click', async () => {
      const btn = document.getElementById('registrar'); btn.disabled = true; btn.textContent = 'Registrando...'
      try {
        // Anti-fraude: verificar si ya tiene visita hoy
        const hoyStr = new Date().toISOString().split('T')[0]
        const { data: visitaHoy } = await supabase.from('visitas').select('id').eq('cliente_id', data.id).gte('fecha', hoyStr).limit(1).maybeSingle()
        if (visitaHoy) {
          document.getElementById('msg-cajero').innerHTML = `<div style="background:#fef3c7;border:1px solid #fde68a;border-radius:10px;padding:12px 14px;font-size:14px;color:#92400e;margin-top:4px">⏰ ${data.nombre.split(' ')[0]} ya tiene una visita registrada hoy. Vuelve mañana.</div>`
          btn.disabled = false; btn.textContent = '+ Registrar visita'; return
        }
        const { error: ev } = await supabase.from('visitas').insert({ cliente_id: data.id, negocio_id: data.negocio_id, puntos_sumados: 1 }); if (ev) throw ev
        const nv = data.total_visitas + 1
        const { error: ec } = await supabase.from('clientes').update({ puntos_actuales: nv, total_visitas: nv }).eq('id', data.id); if (ec) throw ec
        const nivelAnterior = getNivelActual(data.total_visitas, niveles)
        data.total_visitas = nv; data.puntos_actuales = nv
        const nivelNuevo = getNivelActual(nv, niveles)
        const subioDeNivel = nivelNuevo.nombre !== nivelAnterior.nombre
                const llegaANivelConPremio = !subioDeNivel && nivelNuevo.premio_bienvenida && nv === nivelNuevo.visitas_minimas
        cargarUltimosClientes()

        if (subioDeNivel || llegaANivelConPremio) {
          // Pantalla grande para el cajero — énfasis en el premio a entregar
          const el = document.createElement('div')
          el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;animation:sFadeIn 0.2s ease'
          el.innerHTML = `
            <div style="background:white;border-radius:24px;padding:32px 24px;text-align:center;max-width:340px;width:90%;animation:sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1)">
              <div style="font-size:52px;margin-bottom:10px">${nivelNuevo.emoji}</div>
              <div style="font-family:'Sora',sans-serif;font-size:13px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">¡Subió de nivel!</div>
              <div style="font-family:'Sora',sans-serif;font-size:24px;font-weight:800;color:#0f172a;margin-bottom:16px">${data.nombre.split(' ')[0]} es ahora ${nivelNuevo.nombre}</div>
              ${nivelNuevo.premio_bienvenida ? `
              <div style="background:linear-gradient(135deg,#fef3c7,#fffdf5);border:2px solid #fde68a;border-radius:16px;padding:18px;margin-bottom:16px">
                <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Entrégale ahora</div>
                <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#78350f">${nivelNuevo.premio_bienvenida}</div>
              </div>
              ` : `<div style="font-size:14px;color:#64748b;margin-bottom:16px">Nuevo nivel desbloqueado — felicítalo</div>`}
              <button id="cajero-cel-ok" style="width:100%;padding:14px;border:none;border-radius:12px;background:#0a5c47;color:white;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;cursor:pointer">${nivelNuevo.premio_bienvenida ? '✓ Premio entregado' : 'Confirmar'}</button>
            </div>
          `
          document.body.appendChild(el)
          el.querySelector('#cajero-cel-ok')?.addEventListener('click', () => {
            el.remove()
            // Guardar en localStorage para que el cliente vea su premio cuando abra la app
            if (nivelNuevo.premio_bienvenida) {
              localStorage.setItem(`sello_premio_${data.telefono}`, `Subiste a ${nivelNuevo.nombre} y ganaste: ${nivelNuevo.premio_bienvenida}`)
            }
            document.getElementById('msg-cajero').innerHTML = `<div class="s-success">${nivelNuevo.emoji} ${data.nombre.split(' ')[0]} subió a ${nivelNuevo.nombre}${nivelNuevo.premio_bienvenida ? ' — Premio entregado: ' + nivelNuevo.premio_bienvenida : ''}</div>`
          })
        } else {
          const sigNivelNuevo = getSiguienteNivel(nv, niveles)
          const faltan = sigNivelNuevo ? sigNivelNuevo.visitas_minimas - nv : 0
          toast({ icon: '✅', title: 'Visita registrada', sub: sigNivelNuevo ? `A ${data.nombre.split(' ')[0]} le faltan ${faltan} visita${faltan===1?'':'s'} para ${sigNivelNuevo.emoji} ${sigNivelNuevo.nombre}` : `${data.nombre.split(' ')[0]} alcanzo el nivel maximo` })
        }
      } catch (e) { document.getElementById('msg-cajero').innerHTML = errMsg('registrar la visita') }
      finally { btn.disabled = false; btn.textContent = '+ Registrar visita' }
    })
  } catch (e) { document.getElementById('resultado').innerHTML = `<div class="s-card">${errMsg('cargar el cliente')}</div>` }
}

export async function paginaKiosko() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (!negocio) { navigate('login'); return '<div></div>' }
    const { data: nd } = await supabase.from('negocios').select('nombre,color_principal').eq('id', negocio.id).single()
    if (nd?.color_principal) aplicarColorNegocio(nd.color_principal)
    return `
      <div class="kiosko-root">
        <button class="kiosko-salir" id="kiosko-salir">✕ Salir</button>
        ${logoSVG(48, 'rgba(255,255,255,0.4)')}
        <div class="kiosko-titulo" style="margin-top:16px">Bienvenido a</div>
        <div class="kiosko-nombre">${nd?.nombre || negocio.nombre}</div>
        <input type="tel" id="kiosko-tel" class="kiosko-input" placeholder="Tu teléfono" />
        <div style="font-size:14px;color:rgba(255,255,255,0.3);margin-bottom:12px">o busca por nombre</div>
        <input type="text" id="kiosko-nombre" class="kiosko-input" style="font-size:20px;margin-bottom:16px" placeholder="Tu nombre" />
        <button class="kiosko-btn" id="kiosko-entrar">Registrar mi visita →</button>
        <div id="kiosko-msg" style="margin-top:20px;font-size:14px;color:rgba(255,255,255,0.5)"></div>
      </div>
    `
  } catch (e) { return `<div class="kiosko-root">${errMsg()}</div>` }
}

export function initKiosko() {
  inyectarEstilos()
  document.getElementById('kiosko-salir')?.addEventListener('click', () => navigate('bienvenida'))
  const doRegistrar = async () => {
    const telefono = document.getElementById('kiosko-tel').value.trim()
    const nombre = document.getElementById('kiosko-nombre').value.trim()
    if (!telefono && !nombre) { document.getElementById('kiosko-msg').textContent = 'Escribe tu teléfono o nombre'; return }
    const msg = document.getElementById('kiosko-msg'); const btn = document.getElementById('kiosko-entrar')
    btn.disabled = true; btn.textContent = 'Procesando...'; msg.textContent = ''
    try {
      const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
      const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', negocio.id).order('visitas_minimas', { ascending: true })
      let cliente = null
      if (telefono) {
        const { data } = await supabase.from('clientes').select('*').eq('telefono', telefono).eq('negocio_id', negocio.id).single()
        cliente = data
      } else {
        const { data } = await supabase.from('clientes').select('*').ilike('nombre', `%${nombre}%`).eq('negocio_id', negocio.id).limit(1).single()
        cliente = data
      }
      if (!cliente) {
        if (telefono) { navigate('registro-cliente', `${negocio.id}/${telefono}`); return }
        msg.textContent = 'No se encontró ese nombre. Intenta con el teléfono.'; btn.disabled = false; btn.textContent = 'Registrar mi visita →'; return
      }
      const nivelAnterior = getNivelActual(cliente.total_visitas, niveles)
      // Anti-fraude: 1 visita por día
      const hoyK = new Date().toISOString().split('T')[0]
      const { data: visitaHoyK } = await supabase.from('visitas').select('id').eq('cliente_id', cliente.id).gte('fecha', hoyK + 'T00:00:00').lte('fecha', hoyK + 'T23:59:59').maybeSingle()
      if (visitaHoyK) {
        msg.innerHTML = `<div style="background:#fef3c7;border:1.5px solid #fde68a;border-radius:12px;padding:16px;text-align:center;color:#92400e"><strong>Ya tienes tu visita de hoy registrada.</strong><br><span style="font-size:13px">Vuelve mañana para seguir acumulando.</span></div>`
        btn.disabled = false; btn.textContent = 'Registrar mi visita →'; return
      }
      await supabase.from('visitas').insert({ cliente_id: cliente.id, negocio_id: negocio.id, puntos_sumados: 1 })
      const nv = cliente.total_visitas + 1
      await supabase.from('clientes').update({ puntos_actuales: nv, total_visitas: nv }).eq('id', cliente.id)
      const nivelNuevo = getNivelActual(nv, niveles)
      const subioDeNivel = nivelNuevo.nombre !== nivelAnterior.nombre
      const llegaANivelConPremio = !subioDeNivel && nivelNuevo.premio_bienvenida && nv === nivelNuevo.visitas_minimas
      const sigNivel = getSiguienteNivel(nv, niveles)
      if (subioDeNivel || llegaANivelConPremio) {
        // Pantalla celebración grande en kiosko — el cliente ve lo que ganó
        const el = document.createElement('div')
        el.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;z-index:9999;animation:sFadeIn 0.2s ease'
        el.innerHTML = `
          <div style="background:white;border-radius:24px;padding:36px 28px;text-align:center;max-width:340px;width:90%;animation:sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1)">
            <div style="font-size:60px;margin-bottom:10px">${nivelNuevo.emoji}</div>
            <div style="font-family:'Sora',sans-serif;font-size:26px;font-weight:800;color:#0f172a;margin-bottom:6px">¡Subiste a ${nivelNuevo.nombre}!</div>
            ${nivelNuevo.premio_bienvenida ? `
            <div style="background:linear-gradient(135deg,#fef3c7,#fffdf5);border:2px solid #fde68a;border-radius:16px;padding:18px;margin:14px 0">
              <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px">Ganaste</div>
              <div style="font-family:'Sora',sans-serif;font-size:22px;font-weight:800;color:#78350f">${nivelNuevo.premio_bienvenida}</div>
              <div style="font-size:13px;color:#92400e;margin-top:6px">Muéstraselo al cajero para reclamarlo</div>
            </div>
            ` : `<div style="font-size:14px;color:#64748b;margin:14px 0">¡Nuevo nivel desbloqueado!</div>`}
            <button id="kiosko-cel-ok" style="width:100%;padding:14px;border:none;border-radius:12px;background:#0a5c47;color:white;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;cursor:pointer">¡Entendido!</button>
          </div>
        `
        document.body.appendChild(el)
        el.querySelector('#kiosko-cel-ok')?.addEventListener('click', () => el.remove())
      } else {
        const faltan = sigNivel ? sigNivel.visitas_minimas - nv : 0
        toast({ icon: nivelNuevo.emoji, title: `¡Hola ${cliente.nombre.split(' ')[0]}!`, sub: sigNivel ? `Visita registrada. Faltan ${faltan} para ${sigNivel.emoji} ${sigNivel.nombre}${sigNivel.premio_bienvenida ? ' y ganar: '+sigNivel.premio_bienvenida : ''}.` : '¡Nivel máximo! 💎', autoClose: 3000 })
      }
      document.getElementById('kiosko-tel').value = ''
      document.getElementById('kiosko-nombre').value = ''
    } catch (e) { msg.textContent = 'Sin conexión. Intenta de nuevo.' }
    finally { btn.disabled = false; btn.textContent = 'Registrar mi visita →' }
  }
  document.getElementById('kiosko-entrar')?.addEventListener('click', doRegistrar)
  document.getElementById('kiosko-tel')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegistrar() })
}

export function paginaRegistro(telefono = '') {
  inyectarEstilos()
  return `
    <div style="padding-bottom:72px">
      <div class="sello-topbar">${topbarBrand()}<span style="font-size:13px;color:rgba(255,255,255,0.6)">Nuevo cliente</span></div>
      <div class="s-card" style="margin-top:16px">
        <div class="s-section-label">Registrar cliente</div>
        <div class="s-field"><label class="s-label">Nombre</label><input type="text" id="nombre" class="s-input" placeholder="Nombre del cliente" /></div>
        <div class="s-field"><label class="s-label">Teléfono</label><input type="tel" id="tel" value="${telefono}" class="s-input" placeholder="10 dígitos" /></div>
        <button class="s-btn primary" id="guardar" style="margin-top:8px">Guardar cliente</button>
        <div id="msg" style="margin-top:10px"></div>
      </div>
    </div>
    ${navBarCajero()}
  `
}

export function initRegistro() {
  inyectarEstilos(); initNavCajero()
  document.getElementById('guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim(); const telefono = document.getElementById('tel').value.trim()
    const msg = document.getElementById('msg'); const btn = document.getElementById('guardar')
    if (!nombre || !telefono) { msg.innerHTML = `<p class="s-error">Llena todos los campos</p>`; return }
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
      const { data: nuevoCliente, error } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocio?.id, puntos_actuales: 1, total_visitas: 1 }).select().single()
      if (error) throw error
      // Registrar primera visita automáticamente
      if (nuevoCliente) {
        await supabase.from('visitas').insert({ cliente_id: nuevoCliente.id, negocio_id: negocio?.id, puntos_sumados: 1 })
      }
      msg.innerHTML = `<div class="s-success">✓ Cliente registrado — primera visita sumada automáticamente</div>`
      setTimeout(() => navigate('cajero'), 1500)
    } catch (e) { msg.innerHTML = errMsg('guardar el cliente') }
    finally { btn.disabled = false; btn.textContent = 'Guardar cliente' }
  })
}

function isAdminAuth() { return sessionStorage.getItem('admin_auth') === 'ok' }

export async function paginaAdmin() {
  inyectarEstilos()
  if (!isAdminAuth()) {
    return `
      <div class="s-login-root">
        <div class="s-login-card">
          <div class="s-login-logo">${logoSVG(48, DS.green800)}<div class="s-login-app">Sell<span>o</span></div><div class="s-login-sub">Panel de administrador</div></div>
          <div class="s-field"><label class="s-label">Contraseña de administrador</label>${pwField('admin-password')}</div>
          <button class="s-btn primary" id="btn-admin-login" style="margin-top:8px">Entrar</button>
          <div id="msg-admin" style="margin-top:10px"></div>
        </div>
      </div>
    `
  }
  try {
    const { data: negocios } = await supabase.from('negocios').select('*')
    const { data: clientes } = await supabase.from('clientes').select('*')
    const { data: visitas } = await supabase.from('visitas').select('*')
    const filas = (negocios || []).map(n => {
      const cn = (clientes||[]).filter(c => c.negocio_id === n.id).length
      const vn = (visitas||[]).filter(v => v.negocio_id === n.id).length
      return `
        <div class="s-row">
          <div>
            <div class="s-row-title">${n.emoji_negocio || '🏪'} ${n.nombre}</div>
            <div class="s-row-sub">${n.email} · ${cn} clientes · ${vn} visitas</div>
          </div>
          <div class="s-row-actions">
            <span class="s-badge ${n.activo ? 'active' : 'inactive'}">${n.activo ? 'Activo' : 'Inactivo'}</span>
            <button class="btn-toggle-negocio" data-id="${n.id}" data-activo="${n.activo}"
              style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;background:${n.activo?'#fee2e2':'#d1fae5'};color:${n.activo?'#dc2626':'#059669'}">
              ${n.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn-descargar-qr" data-id="${n.id}" data-nombre="${n.nombre}"
              style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;background:${DS.green800};color:white;font-weight:600">⬇ QR</button>
            <button class="btn-limpiar-negocio" data-id="${n.id}" data-nombre="${n.nombre}"
              style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;background:#fee2e2;color:#dc2626;font-weight:600">🗑 Datos</button>
          </div>
        </div>
      `
    }).join('')
    return `
      <div>
        <div class="sello-topbar">
          ${topbarBrand()}
          <button id="btn-admin-logout" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
        </div>
        <div class="s-card" style="margin-top:16px">
          <div class="s-stats">
            <div class="s-stat"><div class="s-stat-num">${(negocios||[]).length}</div><div class="s-stat-lbl">Negocios</div></div>
            <div class="s-stat"><div class="s-stat-num">${(clientes||[]).length}</div><div class="s-stat-lbl">Clientes</div></div>
            <div class="s-stat"><div class="s-stat-num">${(visitas||[]).length}</div><div class="s-stat-lbl">Visitas</div></div>
          </div>
        </div>
        <div class="s-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div class="s-section-label" style="margin-bottom:0">Negocios</div>
            <button id="btn-nuevo-negocio" style="background:${DS.green800};color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">+ Nuevo</button>
          </div>
          <div id="form-negocio" style="display:none;background:${DS.gray50};padding:16px;border-radius:12px;margin-bottom:16px">
            <div class="s-field"><label class="s-label">Nombre del negocio</label><input type="text" id="nuevo-nombre" class="s-input" placeholder="Ej: Café El Sol" /></div>
            <div class="s-field"><label class="s-label">Correo electrónico</label><input type="email" id="nuevo-email" class="s-input" placeholder="cafe@correo.com" /></div>
            <div class="s-field"><label class="s-label">Contraseña</label>${pwField('nuevo-password', 'Contraseña para el dueño')}</div>
            <button id="btn-guardar-negocio" class="s-btn primary" style="margin-top:8px">Guardar negocio</button>
            <div id="msg-negocio" style="margin-top:10px"></div>
          </div>
          ${filas || '<p style="color:#aaa;text-align:center;font-size:14px">No hay negocios aún</p>'}
        </div>
        <canvas id="qr-canvas" style="display:none"></canvas>
      </div>
    `
  } catch (e) { return `<div class="sello-topbar">${topbarBrand()}</div><div class="s-card">${errMsg('cargar datos')}</div>` }
}

export function initAdmin() {
  inyectarEstilos()
  if (!isAdminAuth()) {
    document.getElementById('btn-admin-login')?.addEventListener('click', () => {
      const pw = document.getElementById('admin-password').value; const msg = document.getElementById('msg-admin')
      if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth', 'ok'); navigate('admin') }
      else msg.innerHTML = `<p class="s-error">Contraseña incorrecta</p>`
    })
    document.getElementById('admin-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('btn-admin-login').click() })
    return
  }
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => { sessionStorage.removeItem('admin_auth'); navigate('admin') })
  document.getElementById('btn-nuevo-negocio')?.addEventListener('click', () => { const f = document.getElementById('form-negocio'); f.style.display = f.style.display === 'none' ? 'block' : 'none' })
  document.getElementById('btn-guardar-negocio')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevo-nombre').value.trim()
    const email = document.getElementById('nuevo-email').value.trim()
    const password = document.getElementById('nuevo-password').value.trim()
    const msg = document.getElementById('msg-negocio')
    if (!nombre || !email || !password) { msg.innerHTML = `<p class="s-error">Llena todos los campos</p>`; return }
    msg.innerHTML = `<p style="color:#aaa;text-align:center">Guardando...</p>`
    try {
      const { error } = await supabase.from('negocios').insert({ nombre, email, password, password_hash: password, activo: true, meta_puntos: 10 })
      if (error) throw error
      msg.innerHTML = `<div class="s-success">✓ Negocio creado. El dueño puede entrar ahora.</div>`
      setTimeout(() => navigate('admin'), 1500)
    } catch (e) { msg.innerHTML = errMsg('guardar el negocio') }
  })
  document.querySelectorAll('.btn-toggle-negocio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const act = btn.dataset.activo === 'true'; btn.textContent = '...'; btn.disabled = true
      try { const { error } = await supabase.from('negocios').update({ activo: !act }).eq('id', btn.dataset.id); if (error) throw error; navigate('admin') }
      catch (e) { btn.textContent = act ? 'Desactivar' : 'Activar'; btn.disabled = false; alert('Sin conexión.') }
    })
  })
  document.querySelectorAll('.btn-descargar-qr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = `${window.location.origin}/#/negocio/${btn.dataset.id}`
      const canvas = document.getElementById('qr-canvas')
      await QRCode.toCanvas(canvas, url, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      const cf = document.createElement('canvas'); cf.width = canvas.width; cf.height = canvas.height + 50
      const ctx = cf.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cf.width, cf.height)
      ctx.drawImage(canvas, 0, 0); ctx.fillStyle = '#000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'
      ctx.fillText(btn.dataset.nombre, canvas.width / 2, canvas.height + 35)
      const link = document.createElement('a'); link.download = `QR-${btn.dataset.nombre}.png`; link.href = cf.toDataURL('image/png'); link.click()
    })
  })
  // Botón limpiar datos de prueba
  document.querySelectorAll('.btn-limpiar-negocio').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar TODOS los clientes y visitas de "${btn.dataset.nombre}"? Esto no se puede deshacer.`)) return
      btn.disabled = true; btn.textContent = '...'
      try {
        const { data: cls } = await supabase.from('clientes').select('id').eq('negocio_id', btn.dataset.id)
        const ids = (cls||[]).map(c => c.id)
        if (ids.length > 0) {
          await supabase.from('visitas').delete().in('cliente_id', ids)
          await supabase.from('canjes').delete().in('cliente_id', ids)
          await supabase.from('clientes').delete().eq('negocio_id', btn.dataset.id)
        }
        await supabase.from('visitas').delete().eq('negocio_id', btn.dataset.id)
        alert(`✓ Datos de "${btn.dataset.nombre}" eliminados.`)
        navigate('admin')
      } catch (e) { alert('Sin conexión.'); btn.disabled = false; btn.textContent = '🗑 Datos' }
    })
  })
}

export async function paginaCliente(telefono) {
  inyectarEstilos()
  try {
    // Fix: usar maybeSingle y order para evitar error si teléfono en dos negocios
    const { data: clientes_encontrados } = await supabase.from('clientes').select('*, negocios(id,nombre,meta_puntos,color_principal,emoji_negocio,descripcion)').eq('telefono', telefono).order('total_visitas', { ascending: false })
    const data = clientes_encontrados?.[0] || null
    const error = !data ? { message: 'No encontrado' } : null
    if (error) throw error
    if (!data) return `<div style="min-height:100vh;background:${DS.gray50};display:flex;align-items:center;justify-content:center"><div class="s-card" style="text-align:center"><p style="color:${DS.gray500}">No encontrado</p></div></div>`
    const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', data.negocios?.id || data.negocio_id).order('visitas_minimas', { ascending: true })
    const { data: historial } = await supabase.from('visitas').select('fecha').eq('cliente_id', data.id).order('fecha', { ascending: false }).limit(8)
    const colorNegocio = data.negocios?.color_principal || DS.green800
    const emojiNegocio = data.negocios?.emoji_negocio || '☕'
    const negocioNombre = data.negocios?.nombre || 'Programa de Lealtad'
    aplicarColorNegocio(colorNegocio)
    const tieneNiveles = niveles && niveles.length > 0
    const nivelActual = getNivelActual(data.total_visitas, niveles)
    const sigNivel = getSiguienteNivel(data.total_visitas, niveles)
    const nivelColor = colorNivel(nivelActual)
    let nivelProgPct = 0
    if (sigNivel) {
      const rango = sigNivel.visitas_minimas - (nivelActual.visitas_minimas || 0)
      const avance = data.total_visitas - (nivelActual.visitas_minimas || 0)
      nivelProgPct = rango > 0 ? Math.min(Math.round((avance / rango) * 100), 100) : 0
    } else {
      nivelProgPct = 100
    }
    const _h = new Date().getHours()
    const saludo = _h < 12 ? 'Buenos días' : _h < 19 ? 'Buenas tardes' : 'Buenas noches'
    const esNivelInicial = nivelActual.visitas_minimas === 0
    const filasHistorial = (historial||[]).map(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
      return `<div class="s-row"><div class="s-row-title" style="font-weight:400;font-size:13px;color:${DS.gray700}">Visita registrada</div><div style="font-size:12px;color:${DS.gray500}">${fecha}</div></div>`
    }).join('')

    return `
      <div style="min-height:100vh;background:${DS.gray50};padding-bottom:40px">

        <!-- Header minimalista -->
        <div style="background:${DS.white};border-bottom:1px solid ${DS.gray100};padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:10px">
            ${logoSVG(22, DS.green800)}
            <span style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:${DS.green800}">Sell<span style="color:${DS.gold500}">o</span></span>
          </div>
          <span style="font-size:12px;color:${DS.gray500}">${emojiNegocio} ${negocioNombre}</span>
        </div>

        <!-- Hero negocio -->
        <div style="background:var(--negocio-color,${DS.green800});padding:28px 20px 56px;position:relative;overflow:hidden">
          <div style="position:absolute;top:-30px;right:-30px;width:160px;height:160px;background:rgba(255,255,255,0.06);border-radius:50%"></div>
          <div style="position:absolute;bottom:-40px;left:-20px;width:120px;height:120px;background:rgba(255,255,255,0.04);border-radius:50%"></div>

          <div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:4px">${negocioNombre}</div>
          <div style="font-family:'Sora',sans-serif;font-size:26px;font-weight:800;color:${DS.white};line-height:1.1">${saludo}, ${data.nombre?.split(' ')[0] || 'Cliente'}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.55);margin-top:4px">Aquí está tu progreso</div>
        </div>

        <!-- Tarjeta principal flotante -->
        <div style="margin:-28px 16px 14px;background:${DS.white};border-radius:20px;box-shadow:0 8px 32px rgba(0,0,0,0.10);padding:20px;position:relative;z-index:1">

          <!-- Nivel actual -->
          ${tieneNiveles ? `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div style="background:${nivelColor}18;border-radius:10px;padding:8px 12px;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;color:${nivelColor}">${nivelActual.emoji} ${nivelActual.nombre}</div>
            ${!sigNivel ? `<div style="font-size:11px;color:${DS.gold500};font-weight:700">💎 Máximo</div>` : ''}
          </div>
          ` : `<div style="font-size:12px;color:${DS.gray500};text-align:center;padding:8px 0;margin-bottom:8px">Sin niveles configurados aún</div>`}

          <!-- Número grande de visitas -->
          <div style="text-align:center;padding:20px 0 16px">
            <div style="font-family:'Sora',sans-serif;font-size:72px;font-weight:800;color:${DS.green800};line-height:1">${data.total_visitas}</div>
            <div style="font-size:13px;color:${DS.gray500};margin-top:4px">visitas acumuladas</div>
            <div style="font-size:11px;color:${DS.gray300};margin-top:2px">Las visitas nunca se pierden</div>
          </div>

          <!-- Barra de progreso con hitos — solo si hay siguiente nivel -->
          ${sigNivel ? `
          <div style="margin-bottom:16px">
            <div style="display:flex;justify-content:flex-end;font-size:11px;color:${DS.gray500};margin-bottom:6px">
              <span>${data.total_visitas}/${sigNivel.visitas_minimas}</span>
            </div>
            <div style="height:8px;background:${DS.gray100};border-radius:999px;overflow:hidden;margin-bottom:10px">
              <div style="height:100%;width:${nivelProgPct}%;background:${nivelColor};border-radius:999px"></div>
            </div>
            <div style="font-size:12px;color:${DS.gray500};text-align:right">${sigNivel.visitas_minimas - data.total_visitas} visita${sigNivel.visitas_minimas - data.total_visitas === 1 ? '' : 's'} para ${sigNivel.emoji} ${sigNivel.nombre}</div>
          </div>
          ` : ''}

          <!-- Premio próximo destacado -->
          ${sigNivel && sigNivel.premio_bienvenida ? `
          <div style="background:linear-gradient(135deg,${DS.gold100},#fffdf5);border:1.5px solid #fde68a;border-radius:14px;padding:14px 16px;text-align:center">
            <div style="font-size:10px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px">Tu próximo premio</div>
            <div style="font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:#78350f">${sigNivel.premio_bienvenida}</div>
            <div style="font-size:11px;color:#92400e;margin-top:3px">Faltan ${sigNivel.visitas_minimas - data.total_visitas} visita${sigNivel.visitas_minimas - data.total_visitas === 1 ? '' : 's'}</div>
          </div>
          ` : !sigNivel ? `
          <div style="background:linear-gradient(135deg,${DS.gold100},#fffdf5);border:1.5px solid #fde68a;border-radius:14px;padding:14px 16px;text-align:center">
            <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#78350f">🏆 Nivel máximo alcanzado</div>
            <div style="font-size:12px;color:#92400e;margin-top:3px">Eres ${nivelActual.emoji} ${nivelActual.nombre}</div>
          </div>
          ` : ''}

          <!-- Banner premio ganado (aparece cuando el cajero registró subida de nivel) -->
          <div id="banner-premio-ganado" style="display:none;background:linear-gradient(135deg,#fef3c7,#fffdf5);border:2px solid #fde68a;border-radius:14px;padding:16px;text-align:center;margin-top:12px">
            <div style="font-size:11px;color:#92400e;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">🎉 ¡Felicidades!</div>
            <div id="banner-premio-texto" style="font-family:'Sora',sans-serif;font-size:17px;font-weight:800;color:#78350f"></div>
            <div style="font-size:12px;color:#92400e;margin-top:4px">Muéstraselo al cajero para reclamarlo</div>
            <button id="banner-cerrar" style="margin-top:10px;padding:8px 16px;border:none;border-radius:8px;background:#f5a623;color:white;font-family:'Sora',sans-serif;font-size:12px;font-weight:700;cursor:pointer">Entendido</button>
          </div>

          <!-- Botón compartir — siempre verde, texto según situación -->
          <button id="btn-compartir-nivel" style="width:100%;margin-top:14px;padding:13px;border:none;border-radius:12px;background:${DS.green800};color:white;font-family:'Sora',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px">
            Compartir mi progreso
          </button>

        </div>

        <!-- Tarjeta mostrar al cajero -->
        <div style="margin:0 16px 14px;background:${DS.white};border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${DS.gray500};margin-bottom:14px">Muestra al cajero</div>
          <div style="font-family:'Sora',sans-serif;font-size:36px;font-weight:800;color:${DS.gray900};line-height:1">${data.nombre || 'Cliente'}</div>
          <div style="font-size:16px;color:${DS.gray500};margin-top:6px;letter-spacing:0.03em">${data.telefono}</div>
          <div style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;background:${nivelColor}18;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:700;color:${nivelColor}">${nivelActual.emoji} ${nivelActual.nombre} · ${data.total_visitas} visitas</div>
        </div>

        <!-- Historial -->
        ${historial && historial.length > 0 ? `
        <div style="margin:0 16px;background:${DS.white};border-radius:16px;padding:20px;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
          <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${DS.gray500};margin-bottom:4px">Historial</div>
          ${filasHistorial}
        </div>
        ` : ''}
      </div>
    `
  } catch (e) { return `<div style="min-height:100vh;background:${DS.gray50};display:flex;align-items:center;justify-content:center"><div class="s-card">${errMsg()}</div></div>` }
}

export async function initCliente(telefono) {
  inyectarEstilos()
  try {
    const { data } = await supabase.from('clientes').select('*, negocios(nombre,color_principal,emoji_negocio)').eq('telefono', telefono).single()
    const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', data?.negocio_id).order('visitas_minimas', { ascending: true })
    const nivelActual = getNivelActual(data?.total_visitas || 0, niveles)
    // Premio: si ya tiene nivel con premio úsalo, si no usa el del siguiente nivel para motivar
    const premioParaCompartir = nivelActual.premio_bienvenida || ''
    const datosCompartir = { negocioNombre: data?.negocios?.nombre || '', negocioEmoji: data?.negocios?.emoji_negocio || '☕', colorNegocio: data?.negocios?.color_principal || DS.green800, nivelNombre: nivelActual.nombre, nivelEmoji: nivelActual.emoji, totalVisitas: data?.total_visitas || 0, clienteNombre: data?.nombre?.split(' ')[0] || '', premioNombre: premioParaCompartir, sigNivelNombre: sigNivel?.nombre || '', sigNivelPremio: sigNivel?.premio_bienvenida || '', faltanVisitas: sigNivel ? sigNivel.visitas_minimas - (data?.total_visitas || 0) : 0 }

    // Banner de premio ganado — se activa desde localStorage cuando el cajero registró subida
    const key = `sello_premio_${telefono}`
    const premioGuardado = localStorage.getItem(key)
    if (premioGuardado) {
      const banner = document.getElementById('banner-premio-ganado')
      const texto = document.getElementById('banner-premio-texto')
      if (banner && texto) {
        texto.textContent = premioGuardado
        banner.style.display = 'block'
        document.getElementById('banner-cerrar')?.addEventListener('click', () => {
          localStorage.removeItem(key)
          banner.style.display = 'none'
        })
      }
    }

    // Botón compartir
    document.getElementById('btn-compartir-nivel')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-compartir-nivel')
      if (!btn) return
      btn.disabled = true; btn.textContent = 'Generando...'
      try {
        await compartirHistoria({ ...datosCompartir, tipo: 'nivel' })
      } catch(err) { console.error('compartir:', err) }
      btn.disabled = false; btn.textContent = 'Compartir mi progreso'
    })
  } catch (e) { console.error('initCliente:', e) }
}

export async function paginaQRNegocio(negocioId) {
  inyectarEstilos()
  try {
    const { data: negocio, error } = await supabase.from('negocios').select('*').eq('id', negocioId).single()
    if (error) throw error
    if (!negocio) return `<div class="sq-root"><h1>No encontrado</h1></div>`
    aplicarColorNegocio(negocio.color_principal)
    return `
      <div class="sq-root">
        <div class="sq-logo">
          ${negocio.logo_url ? `<img src="${negocio.logo_url}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,0.3)" onerror="this.style.display='none'" id="logo-negocio-qr" />` : logoSVG(52, DS.white)}
        </div>
        <div class="sq-negocio">Programa de lealtad</div>
        <h1 class="sq-nombre">${negocio.emoji_negocio || '☕'} ${negocio.nombre}</h1>
        <p class="sq-sub">${negocio.descripcion || 'Acumula visitas y sube de nivel'}</p>
        <div class="sq-form">
          <label style="font-size:13px;color:rgba(255,255,255,0.5);display:block;text-align:left;margin-bottom:8px">Tu número de teléfono</label>
          <input type="tel" id="tel-negocio" class="sq-input" placeholder="10 dígitos" />
          <button class="sq-btn" id="btn-entrar">Entrar →</button>
          <div id="msg-negocio" style="margin-top:12px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center"></div>
        </div>
      </div>
    `
  } catch (e) { return `<div class="sq-root"><div class="sq-form">${errMsg()}</div></div>` }
}

export function initQRNegocio(negocioId) {
  inyectarEstilos()
  const doEntrar = async () => {
    const telefono = document.getElementById('tel-negocio').value.trim(); if (!telefono) return
    const msg = document.getElementById('msg-negocio'); const btn = document.getElementById('btn-entrar')
    msg.textContent = 'Buscando...'; btn.disabled = true
    try {
      const { data } = await supabase.from('clientes').select('id').eq('telefono', telefono).eq('negocio_id', negocioId).maybeSingle()
      if (data) navigate('cliente', telefono)
      else navigate('registro-cliente', `${negocioId}/${telefono}`)
    } catch (e) { msg.innerHTML = errMsg(); btn.disabled = false }
  }
  document.getElementById('btn-entrar')?.addEventListener('click', doEntrar)
  document.getElementById('tel-negocio')?.addEventListener('keydown', e => { if (e.key === 'Enter') doEntrar() })
}

export function paginaRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  return `
    <div class="sq-root">
      <div class="sq-logo">${logoSVG(52, DS.white)}</div>
      <h1 class="sq-nombre">Bienvenido 👋</h1>
      <p class="sq-sub">Regístrate para acumular visitas y subir de nivel</p>
      <div class="sq-form">
        <label style="font-size:13px;color:rgba(255,255,255,0.5);display:block;text-align:left;margin-bottom:8px">Tu nombre</label>
        <input type="text" id="nombre-cliente" class="sq-input" placeholder="¿Cómo te llamas?" style="margin-bottom:12px" />
        <label style="font-size:13px;color:rgba(255,255,255,0.5);display:block;text-align:left;margin-bottom:8px">Teléfono</label>
        <input type="tel" id="tel-cliente" class="sq-input" value="${telefono}" readonly style="opacity:0.5;margin-bottom:16px" />
        <button class="sq-btn" id="btn-registrar-cliente">Registrarme →</button>
        <p style="font-size:11px;color:rgba(255,255,255,0.35);margin-top:12px;text-align:center;line-height:16px">
          Al registrarte aceptas nuestro
          <span id="link-privacidad" style="text-decoration:underline;cursor:pointer;color:rgba(255,255,255,0.5)">aviso de privacidad</span>
        </p>
        <div id="msg-registro" style="margin-top:8px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center"></div>
      </div>
    </div>
  `
}

export function initRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  document.getElementById('link-privacidad')?.addEventListener('click', () => {
    const modal = document.createElement('div')
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:9999;animation:sFadeIn 0.2s ease'
    modal.innerHTML = `
      <div style="background:white;border-radius:24px 24px 0 0;padding:24px 20px 40px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#0f172a">Aviso de Privacidad</div>
          <button id="cerrar-privacidad" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#64748b">Cerrar</button>
        </div>
        <div style="font-size:13px;color:#334155;line-height:1.7">
          <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Qué datos guardamos?</p>
          <p style="margin-bottom:12px">Solo tu nombre y número de teléfono. Nada más.</p>
          <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Para qué se usan?</p>
          <p style="margin-bottom:12px">Únicamente para identificarte en el programa de lealtad y registrar tus visitas. No se venden ni se comparten con terceros.</p>
          <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Puedo eliminar mis datos?</p>
          <p style="margin-bottom:12px">Sí. Solicítalo directamente en el negocio donde te registraste.</p>
          <p style="font-size:11px;color:#94a3b8;margin-top:16px">En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.</p>
        </div>
      </div>
    `
    document.body.appendChild(modal)
    modal.querySelector('#cerrar-privacidad')?.addEventListener('click', () => modal.remove())
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
  })
  document.getElementById('btn-registrar-cliente').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-cliente').value.trim()
    const msg = document.getElementById('msg-registro'); const btn = document.getElementById('btn-registrar-cliente')
    if (!nombre) { msg.innerHTML = `<p style="color:#f87171">Escribe tu nombre</p>`; return }
    btn.disabled = true; btn.textContent = 'Registrando...'
    try {
      const { error } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocioId, puntos_actuales: 0, total_visitas: 0 })
      if (error) {
        // Si el teléfono ya existe (duplicado), ir directo a su perfil
        if (error.code === '23505' || error.message?.includes('duplicate') || error.message?.includes('unique')) {
          navigate('cliente', telefono); return
        }
        throw error
      }
      navigate('cliente', telefono)
    } catch (e) { msg.innerHTML = errMsg('registrarte'); btn.disabled = false; btn.textContent = 'Registrarme →' }
  })
}


// ── AVISO DE PRIVACIDAD ────────────────────────────────────
export function paginaPrivacidad(tipo = 'cliente') {
  inyectarEstilos()
  const esDueno = tipo === 'dueno'
  return `
    <div style="min-height:100vh;background:${DS.gray50};padding-bottom:40px">
      <div style="background:${DS.green800};padding:14px 20px;display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:10px">
          ${logoSVG(22, DS.white)}
          <span style="font-family:'Sora',sans-serif;font-weight:800;font-size:16px;color:${DS.white}">Sell<span style="color:${DS.gold400}">o</span></span>
        </div>
        <button id="btn-privacidad-back" style="background:rgba(255,255,255,0.15);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">← Volver</button>
      </div>
      <div class="s-card" style="margin-top:16px">
        <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:${DS.gray900};margin-bottom:4px">Aviso de Privacidad</div>
        <div style="font-size:12px;color:${DS.gray500};margin-bottom:20px">Última actualización: ${new Date().toLocaleDateString('es-MX', {year:'numeric',month:'long',day:'numeric'})}</div>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Responsable</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:16px;line-height:1.6">
          Sello (en adelante "Sello") es el responsable del uso y protección de tus datos personales, en cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.
        </p>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Datos que recopilamos</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:16px;line-height:1.6">
          Recopilamos únicamente: <strong>nombre</strong> y <strong>número de teléfono</strong>. Estos datos son proporcionados voluntariamente por el usuario al registrarse en el programa de lealtad de un negocio afiliado a Sello.
        </p>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Finalidad</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:16px;line-height:1.6">
          Tus datos se utilizan exclusivamente para: identificarte en el programa de lealtad, registrar tus visitas al negocio y mostrarte tu progreso y nivel. No se usan para publicidad de terceros ni se venden a ninguna empresa.
        </p>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Transferencia de datos</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:16px;line-height:1.6">
          Tus datos son accesibles únicamente por el negocio donde te registraste y por Sello como plataforma. No se comparten con terceros salvo obligación legal.
        </p>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Derechos ARCO</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:16px;line-height:1.6">
          Tienes derecho a Acceder, Rectificar, Cancelar u Oponerte al uso de tus datos personales. Para ejercerlos, solicítalo directamente en el negocio donde te registraste o comunícate con el administrador de Sello a través de lealtad-app.vercel.app.
        </p>

        <div style="font-size:14px;font-weight:600;color:${DS.gray900};margin-bottom:6px">Seguridad</div>
        <p style="font-size:13px;color:${DS.gray500};margin-bottom:4px;line-height:1.6">
          Tus datos se almacenan en servidores seguros (Supabase) con cifrado en tránsito. Solo el negocio afiliado y el administrador de Sello tienen acceso.
        </p>
      </div>
    </div>
  `
}

export function initPrivacidad() {
  inyectarEstilos()
  document.getElementById('btn-privacidad-back')?.addEventListener('click', () => window.history.back())
}

export async function paginaLanding(negocioId) {
  inyectarEstilos()
  try {
    const { data: negocio, error } = await supabase.from('negocios').select('*').eq('id', negocioId).single()
    if (error) throw error
    if (!negocio) return `<div style="padding:40px;text-align:center">No encontrado</div>`
    aplicarColorNegocio(negocio.color_principal)
    const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', negocioId).order('visitas_minimas', { ascending: true })
    const { data: clientes } = await supabase.from('clientes').select('id').eq('negocio_id', negocioId)
    const { data: visitas } = await supabase.from('visitas').select('id').eq('negocio_id', negocioId)
    const filasNiveles = (niveles||[]).filter(n => n.premio_bienvenida).map(n => `
      <div class="landing-premio">
        <div style="font-size:28px">${n.emoji}</div>
        <div>
          <div style="font-size:15px;font-weight:600;color:${DS.gray900}">${n.nombre}</div>
          <div style="font-size:12px;color:${DS.gray500};margin-top:2px">Desde ${n.visitas_minimas} visitas · Premio: ${n.premio_bienvenida}</div>
        </div>
      </div>
    `).join('')
    return `
      <div class="landing-root">
        <div class="landing-hero">
          ${negocio.logo_url ? `<img src="${negocio.logo_url}" style="width:80px;height:80px;border-radius:20px;object-fit:cover;border:3px solid rgba(255,255,255,0.3);margin-bottom:16px" onerror="this.style.display='none'" />` : `<div style="margin-bottom:16px">${logoSVG(40, 'rgba(255,255,255,0.5)')}</div>`}
          <div style="font-size:40px;margin-bottom:8px">${negocio.emoji_negocio || '☕'}</div>
          <div class="landing-nombre">${negocio.nombre}</div>
          <div class="landing-tag">${negocio.descripcion || 'Programa de lealtad digital'}</div>
        </div>
        <div style="padding:24px 16px 0;margin-top:-20px;position:relative;z-index:1">
          <h2 style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:${DS.gray900};margin-bottom:16px">⭐ Niveles y premios</h2>
          ${filasNiveles || `<div class="landing-premio"><div>🏆</div><div><div style="font-size:15px;font-weight:600">Sube de nivel y gana premios</div></div></div>`}
        </div>
        <div style="margin:24px 16px">
          <button class="landing-cta-btn" id="landing-registrar">Registrarme en el programa →</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:0 16px 32px">
          <div style="background:white;border-radius:14px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)"><div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:${DS.green800}">${(clientes||[]).length}</div><div style="font-size:12px;color:${DS.gray500};margin-top:4px">Clientes registrados</div></div>
          <div style="background:white;border-radius:14px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)"><div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:${DS.green800}">${(visitas||[]).length}</div><div style="font-size:12px;color:${DS.gray500};margin-top:4px">Visitas registradas</div></div>
        </div>
        <div style="text-align:center;padding:0 16px 32px;font-size:12px;color:${DS.gray300}">Powered by <strong style="color:${DS.green800}">Sello</strong></div>
      </div>
    `
  } catch (e) { return `<div style="padding:40px;text-align:center">${errMsg()}</div>` }
}

export function initLanding(negocioId) {
  inyectarEstilos()
  document.getElementById('landing-registrar')?.addEventListener('click', () => navigate('negocio', negocioId))
}

// ── PANEL DUEÑO — solo niveles, sin premios separados ─────
export async function paginaDueno() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    const { data: nd, error: e0 } = await supabase.from('negocios').select('*').eq('id', negocio.id).single(); if (e0) throw e0
    if (nd?.activo === false) { const { logout } = await import('./auth.js'); logout(); return '<div></div>' }
    aplicarColorNegocio(nd?.color_principal)
    const { data: clientes } = await supabase.from('clientes').select('*').eq('negocio_id', negocio.id)
    const { data: visitas } = await supabase.from('visitas').select('*').eq('negocio_id', negocio.id)
    const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', negocio.id).order('visitas_minimas', { ascending: true })
    const hoy = new Date().toISOString().split('T')[0]
    const vhoy = (visitas||[]).filter(v => v.fecha && v.fecha.startsWith(hoy)).length
    const top5 = [...(clientes||[])].sort((a, b) => b.total_visitas - a.total_visitas).slice(0, 5)
    const landingUrl = `${window.location.origin}/#/landing/${negocio.id}`

    const filasClientes = top5.map(c => {
      const nivel = getNivelActual(c.total_visitas, niveles); const nc = colorNivel(nivel)
      return `<div class="s-row"><div><div class="s-row-title">${c.nombre}</div><div class="s-row-sub">${c.telefono}</div></div><div style="display:flex;align-items:center;gap:8px"><div class="nivel-badge" style="background:${nc}20;color:${nc};font-size:11px;padding:3px 8px">${nivel.emoji} ${nivel.nombre}</div><div style="font-size:13px;color:${DS.gray500}">${c.total_visitas}</div></div></div>`
    }).join('')

    const filasNiveles = (niveles||[]).map(n => `
      <div class="s-row">
        <div>
          <div class="s-row-title">${n.emoji} ${n.nombre}</div>
          <div class="s-row-sub">Desde ${n.visitas_minimas} visitas${n.premio_bienvenida ? ' · Premio: ' + n.premio_bienvenida : ' · Sin premio'}</div>
        </div>
        <div class="s-row-actions">
          <button class="btn-editar-nivel" data-id="${n.id}" data-nombre="${n.nombre}" data-emoji="${n.emoji}" data-visitas="${n.visitas_minimas}" data-premio="${n.premio_bienvenida||''}"
            style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;background:${DS.gray100};color:${DS.gray700};font-weight:600">✏️</button>
          <button class="btn-eliminar-nivel" data-id="${n.id}" data-nombre="${n.nombre}"
            style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;background:#fee2e2;color:#dc2626;font-weight:600">🗑</button>
        </div>
      </div>
    `).join('')

    return `
      <div style="padding-bottom:72px">
        <div class="sello-topbar">${topbarBrand()}<span style="font-size:13px;color:rgba(255,255,255,0.6)">${(nd?.nombre || negocio.nombre).substring(0,20)}</span></div>

        <!-- Resumen -->
        <div class="s-card" style="margin-top:16px">
          <div class="s-section-label">Resumen</div>
          <div class="s-stats">
            <div class="s-stat"><div class="s-stat-num">${(clientes||[]).length}</div><div class="s-stat-lbl">Clientes</div></div>
            <div class="s-stat"><div class="s-stat-num" style="color:${DS.gold500}">${vhoy}</div><div class="s-stat-lbl">Hoy</div></div>
            <div class="s-stat"><div class="s-stat-num">${(visitas||[]).length}</div><div class="s-stat-lbl">Visitas</div></div>
          </div>
        </div>

        <!-- Distribución de niveles -->
        ${(() => {
          const nivelesOrdenados = [...(niveles||[])].sort((a,b) => a.visitas_minimas - b.visitas_minimas)
          if (nivelesOrdenados.length === 0) return ''
          const dist = nivelesOrdenados.map(n => {
            const count = (clientes||[]).filter(c => getNivelActual(c.total_visitas, nivelesOrdenados).nombre === n.nombre).length
            return `<div class="s-stat"><div class="s-stat-num" style="font-size:20px">${n.emoji} ${count}</div><div class="s-stat-lbl">${n.nombre}</div></div>`
          }).join('')
          return `<div class="s-card"><div class="s-section-label">Clientes por nivel</div><div class="s-stats" style="grid-template-columns:repeat(${Math.min(nivelesOrdenados.length,4)},1fr)">${dist}</div></div>`
        })()}

        <!-- Gráficas -->
        <div class="s-card"><div class="s-section-label">Visitas — últimos 7 días</div><div class="s-chart-wrap"><canvas id="chart-barras"></canvas></div></div>
        <div class="s-card"><div class="s-section-label">Este mes vs mes anterior</div><div class="s-chart-wrap"><canvas id="chart-meses"></canvas></div></div>
        <div class="s-card"><div class="s-section-label">Clientes nuevos vs recurrentes</div><div class="s-chart-wrap donut"><canvas id="chart-dona"></canvas></div></div>

        <!-- Personalización -->
        <div class="s-card">
          <div class="s-section-label">Personalización</div>

          <div class="s-field"><label class="s-label">Emoji del negocio</label><input type="text" id="input-emoji" class="s-input" value="${nd?.emoji_negocio||'☕'}" placeholder="☕" style="font-size:24px;text-align:center" /></div>
          <div class="s-field">
            <label class="s-label">Color principal</label>
            <div style="display:flex;gap:10px;align-items:center">
              <input type="color" id="input-color" value="${nd?.color_principal||DS.green800}" style="width:48px;height:48px;border:none;border-radius:10px;cursor:pointer;padding:2px" />
<span style="font-size:13px;color:${DS.gray500}">Lo ven tus clientes cuando escanean el QR</span>
            </div>
          </div>
          <div class="s-field"><label class="s-label">Descripción corta</label><input type="text" id="input-descripcion" class="s-input" value="${nd?.descripcion||''}" placeholder="Ej: El mejor café de Chetumal" /></div>
          <button id="btn-guardar-personalizacion" class="s-btn primary" style="margin-top:4px">Guardar personalización</button>
          <div id="msg-personalizacion" style="margin-top:10px"></div>
        </div>

        <!-- Niveles de lealtad — sistema unificado -->
        <div class="s-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="s-section-label" style="margin-bottom:0">Niveles de lealtad</div>
            <button id="btn-nuevo-nivel" style="background:${DS.green800};color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">+ Nuevo nivel</button>
          </div>
          <p style="font-size:12px;color:${DS.gray500};margin-bottom:6px">Cada nivel tiene un premio que se entrega cuando el cliente llega a las visitas necesarias.</p>
          <div style="background:${DS.green50};border:1px solid ${DS.green100};border-radius:8px;padding:8px 12px;margin-bottom:14px;font-size:11px;color:${DS.green800}">Las visitas son <strong>acumuladas</strong> — el cliente nunca las pierde aunque pase tiempo sin venir. Configura niveles alcanzables para que los clientes vean progreso desde la primera visita.</div>
          <div id="form-nivel" style="display:none;background:${DS.gray50};padding:16px;border-radius:12px;margin-bottom:14px">
            <input type="hidden" id="nivel-editando-id" value="" />
            <div style="display:grid;grid-template-columns:90px 1fr;gap:10px">
              <div class="s-field">
                <label class="s-label">Emoji</label>
                <input type="text" id="nivel-emoji" class="s-input" placeholder="🥉" style="font-size:22px;text-align:center" maxlength="4" />
              </div>
              <div class="s-field"><label class="s-label">Nombre del nivel</label><input type="text" id="nivel-nombre" class="s-input" placeholder="Ej: Bronce, VIP, Estrella..." /></div>
            </div>
            <div class="s-field"><label class="s-label">Visitas mínimas para este nivel</label><input type="number" id="nivel-visitas" class="s-input" placeholder="Ej: 0, 10, 25, 50..." min="0" /></div>
            <div class="s-field">
  <label class="s-label">Premio al llegar a este nivel (opcional)</label>
  <input type="text" id="nivel-premio" class="s-input" placeholder="ej: café gratis, 10% de descuento en su comida, corte gratis..." />
  <div style="font-size:11px;color:#64748b;margin-top:6px;line-height:1.5">
    Escribe el premio que recibirá el cliente. Ej: <strong>café gratis</strong>, <strong>10% de descuento en su comida</strong>, <strong>corte gratis</strong>.<br>
    <span style="color:#94a3b8">Evita usar "tu" o "tu compra" — en la imagen que comparten tus clientes puede verse extraño.</span><br>
    <span style="color:#0a5c47;font-weight:600">Recomendamos tener mínimo 3 niveles distintos para una mejor experiencia del cliente.</span>
  </div>
</div>
            <button id="btn-guardar-nivel" class="s-btn primary" style="margin-top:8px">Guardar nivel</button>
            <div id="msg-nivel" style="margin-top:10px"></div>
          </div>
          <div id="lista-niveles">${filasNiveles || `<p style="color:#aaa;font-size:13px;text-align:center;padding:16px 0">No hay niveles configurados. Agrega el primero con "+ Nuevo nivel"</p>`}</div>
        </div>

        <!-- Exportar CSV -->
        <div class="s-card">
          <div class="s-section-label">Exportar datos</div>
          <p style="font-size:13px;color:${DS.gray500};margin-bottom:14px">Descarga la lista completa de tus clientes en Excel</p>
          <button id="btn-exportar-csv" style="background:${DS.green800};color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px">⬇ Descargar clientes (.csv)</button>
          <div id="msg-exportar" style="margin-top:10px"></div>
        </div>

        <!-- Landing pública -->
        <div class="s-card">
          <div class="s-section-label">Tu página pública</div>
          <p style="font-size:13px;color:${DS.gray500};margin-bottom:12px">Comparte en Instagram o WhatsApp para que tus clientes vean los niveles y premios.</p>
          <div style="background:${DS.gray50};border-radius:10px;padding:12px 14px;font-size:12px;color:${DS.gray700};word-break:break-all;margin-bottom:12px;border:1px solid ${DS.gray100}">${landingUrl}</div>
          <div style="display:flex;gap:8px">
            <button id="btn-copiar-landing" style="flex:1;padding:10px;background:${DS.gray100};color:${DS.gray700};border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">📋 Copiar link</button>
            <button id="btn-ver-landing" style="flex:1;padding:10px;background:${DS.green800};color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">👁 Ver página</button>
          </div>
          <div id="msg-landing" style="margin-top:8px"></div>
        </div>

        <!-- Top clientes -->
        <div class="s-card">
          <div class="s-section-label">Clientes más frecuentes</div>
          ${filasClientes || `<p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">Aún no hay clientes</p>`}
        </div>
      </div>
      ${navBarDueno('panel')}
    `
  } catch (e) { return `<div class="sello-topbar">${topbarBrand()}</div><div class="s-card">${errMsg('cargar tu panel')}</div>` }
}

export async function initDueno(negocioId) {
  inyectarEstilos(); initNavDueno()

  // Gráficas
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    const { data: visitas } = await supabase.from('visitas').select('fecha').eq('negocio_id', negocio.id)
    const { data: clientes } = await supabase.from('clientes').select('total_visitas').eq('negocio_id', negocio.id)
    await renderizarGraficas(visitas, clientes)
  } catch (e) {}

  // Personalización
  document.getElementById('btn-guardar-personalizacion')?.addEventListener('click', async () => {
    const emoji = document.getElementById('input-emoji').value.trim()
    const color = document.getElementById('input-color').value
    const descripcion = document.getElementById('input-descripcion').value.trim()
    const msg = document.getElementById('msg-personalizacion'); const btn = document.getElementById('btn-guardar-personalizacion')
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      const { error } = await supabase.from('negocios').update({ emoji_negocio: emoji, color_principal: color, descripcion }).eq('id', negocioId)
      if (error) throw error
      aplicarColorNegocio(color)
      msg.innerHTML = `<div class="s-success">✓ Personalización guardada</div>`
      btn.textContent = 'Actualizar personalización'
      setTimeout(() => { msg.innerHTML = '' }, 2500)
    } catch (e) { msg.innerHTML = errMsg('guardar') }
    finally { btn.disabled = false }
  })

  // Niveles
  document.getElementById('btn-nuevo-nivel')?.addEventListener('click', () => {
    const f = document.getElementById('form-nivel')
    if (!f) return
    const isHidden = f.style.display === 'none' || f.style.display === ''
    if (isHidden) {
      document.getElementById('nivel-editando-id').value = ''
      document.getElementById('nivel-emoji').value = ''
      document.getElementById('nivel-nombre').value = ''
      document.getElementById('nivel-visitas').value = ''
      document.getElementById('nivel-premio').value = ''
      document.getElementById('msg-nivel').innerHTML = ''
      document.getElementById('btn-guardar-nivel').textContent = 'Guardar nivel'
      f.style.display = 'block'
      setTimeout(() => { document.getElementById('nivel-emoji')?.focus() }, 80)
    } else {
      f.style.display = 'none'
    }
  })

  document.getElementById('btn-guardar-nivel')?.addEventListener('click', async () => {
    const id = document.getElementById('nivel-editando-id').value
    const emojiVal = document.getElementById('nivel-emoji').value.trim()
    const nombre = document.getElementById('nivel-nombre').value.trim()
    const visitasVal = document.getElementById('nivel-visitas').value
    const visitas = parseInt(visitasVal)
    const premio = document.getElementById('nivel-premio').value.trim()
    const msg = document.getElementById('msg-nivel'); const btn = document.getElementById('btn-guardar-nivel')

    // Validación campos obligatorios
    if (!emojiVal || !nombre || visitasVal === '' || isNaN(visitas) || visitas < 0) {
      msg.innerHTML = `<p class="s-error">Llena emoji, nombre y visitas mínimas</p>`; return
    }
    // Validación: no duplicar visitas mínimas
    const { data: nivelesExistentes } = await supabase.from('niveles').select('id,visitas_minimas,nombre').eq('negocio_id', negocioId)
    const duplicado = (nivelesExistentes||[]).find(n => n.visitas_minimas === visitas && n.id !== id)
    if (duplicado) {
      msg.innerHTML = `<p class="s-error">Ya existe el nivel "${duplicado.nombre}" con ${visitas} visitas. Usa un número diferente.</p>`; return
    }
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      if (id) {
        const { error } = await supabase.from('niveles').update({ emoji: emojiVal, nombre, visitas_minimas: visitas, premio_bienvenida: premio }).eq('id', id)
        if (error) throw error
      } else {
        const { data: ordenData } = await supabase.from('niveles').select('orden').eq('negocio_id', negocioId).order('orden', { ascending: false }).limit(1)
        const orden = (ordenData?.[0]?.orden || 0) + 1
        const { error } = await supabase.from('niveles').insert({ negocio_id: negocioId, emoji: emojiVal, nombre, visitas_minimas: visitas, premio_bienvenida: premio, orden })
        if (error) throw error
      }
      msg.innerHTML = `<div class="s-success">✓ Nivel guardado</div>`
      setTimeout(() => navigate('dueno'), 1000)
    } catch (e) { msg.innerHTML = errMsg('guardar el nivel'); btn.disabled = false; btn.textContent = 'Guardar nivel' }
  })

  document.querySelectorAll('.btn-editar-nivel').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = document.getElementById('form-nivel'); f.style.display = 'block'
      document.getElementById('nivel-editando-id').value = btn.dataset.id
      document.getElementById('nivel-emoji').value = btn.dataset.emoji
      document.getElementById('nivel-nombre').value = btn.dataset.nombre
      document.getElementById('nivel-visitas').value = btn.dataset.visitas
      document.getElementById('nivel-premio').value = btn.dataset.premio
      document.getElementById('btn-guardar-nivel').textContent = 'Actualizar nivel'
      f.scrollIntoView({ behavior: 'smooth' })
    })
  })

  document.querySelectorAll('.btn-eliminar-nivel').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar el nivel "${btn.dataset.nombre}"?`)) return
      btn.disabled = true; btn.textContent = '...'
      try { const { error } = await supabase.from('niveles').delete().eq('id', btn.dataset.id); if (error) throw error; navigate('dueno') }
      catch (e) { alert('Sin conexión.'); btn.disabled = false; btn.textContent = '🗑' }
    })
  })

  // CSV
  document.getElementById('btn-exportar-csv')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-exportar-csv'); const msg = document.getElementById('msg-exportar')
    btn.textContent = 'Preparando...'; btn.disabled = true
    try {
      const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
      const { data: clientes } = await supabase.from('clientes').select('*').eq('negocio_id', negocio.id)
      const { data: nd } = await supabase.from('negocios').select('nombre').eq('id', negocio.id).single()
      const { data: niveles } = await supabase.from('niveles').select('*').eq('negocio_id', negocio.id)
      exportarCSV(clientes, niveles, nd?.nombre || 'negocio')
      msg.innerHTML = `<div class="s-success">✓ Archivo descargado</div>`
      setTimeout(() => { msg.innerHTML = '' }, 3000)
    } catch (e) { msg.innerHTML = errMsg('descargar') }
    finally { btn.textContent = '⬇ Descargar clientes (.csv)'; btn.disabled = false }
  })



  // Landing
  document.getElementById('btn-copiar-landing')?.addEventListener('click', () => {
    const url = `${window.location.origin}/#/landing/${negocioId}`
    navigator.clipboard.writeText(url).then(() => {
      const msg = document.getElementById('msg-landing')
      msg.innerHTML = `<div class="s-success">✓ Link copiado</div>`
      setTimeout(() => { msg.innerHTML = '' }, 2000)
    })
  })
  document.getElementById('btn-ver-landing')?.addEventListener('click', () => navigate('landing', negocioId))
}
