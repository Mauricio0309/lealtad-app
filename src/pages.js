import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

const META_VISITAS = 10
const ADMIN_PASSWORD = 'lealtad2024'

// ═══════════════════════════════════════════════════════════
// DESIGN SYSTEM
// ═══════════════════════════════════════════════════════════
const DS = {
  green900: '#052e1c', green800: '#0a5c47', green700: '#0d7a5f',
  green600: '#10a37a', green400: '#34d399', green100: '#d1fae5', green50: '#f0fdf4',
  gold500: '#f5a623', gold400: '#fbbf24', gold100: '#fef3c7',
  bronze: '#cd7f32', silver: '#9ca3af', platinum: '#667eea',
  gray900: '#0f172a', gray700: '#334155', gray500: '#64748b',
  gray300: '#cbd5e1', gray100: '#f1f5f9', gray50: '#f8fafc', white: '#ffffff',
}

// Niveles de lealtad
const NIVELES = [
  { nombre: 'Bronce',   min: 0,   max: 9,   color: '#cd7f32', emoji: '🥉' },
  { nombre: 'Plata',    min: 10,  max: 24,  color: '#9ca3af', emoji: '🥈' },
  { nombre: 'Oro',      min: 25,  max: 49,  color: '#f5a623', emoji: '🥇' },
  { nombre: 'Platino',  min: 50,  max: 999, color: '#667eea', emoji: '💎' },
]

function getNivel(totalVisitas) {
  return NIVELES.find(n => totalVisitas >= n.min && totalVisitas <= n.max) || NIVELES[0]
}

function getSiguienteNivel(totalVisitas) {
  const idx = NIVELES.findIndex(n => totalVisitas >= n.min && totalVisitas <= n.max)
  return NIVELES[idx + 1] || null
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

    .sello-topbar { background: ${DS.green800}; padding: 16px 20px; display: flex; align-items: center; justify-content: space-between; }
    .sello-topbar-brand { display: flex; align-items: center; gap: 10px; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px; color: ${DS.white}; letter-spacing: -0.02em; }
    .sello-topbar-brand span { color: ${DS.gold400}; }

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
    .s-btn.primary { background: ${DS.green800}; color: ${DS.white}; }
    .s-btn.primary:hover { background: ${DS.green700}; }
    .s-btn.gold { background: ${DS.gold500}; color: ${DS.white}; }
    .s-btn.ghost { background: ${DS.gray100}; color: ${DS.gray700}; }

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

    .s-badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
    .s-badge.active { background: ${DS.green100}; color: ${DS.green800}; }
    .s-badge.inactive { background: ${DS.gray100}; color: ${DS.gray500}; }

    .s-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${DS.white}; border-top: 1px solid ${DS.gray100}; display: flex; box-shadow: 0 -2px 20px rgba(0,0,0,0.06); z-index: 100; padding-bottom: env(safe-area-inset-bottom); }
    .s-nav-btn { flex: 1; border: none; background: none; padding: 10px 8px 8px; cursor: pointer; font-family: 'Inter', sans-serif; display: flex; flex-direction: column; align-items: center; gap: 3px; color: ${DS.gray300}; font-size: 11px; font-weight: 500; transition: color 0.15s; }
    .s-nav-btn .s-nav-icon { font-size: 22px; line-height: 1; }
    .s-nav-btn.active { color: ${DS.green800}; }

    /* Vista cliente */
    .sc-root { min-height: 100vh; background: ${DS.gray50}; padding-bottom: 40px; }
    .sc-hero { background: linear-gradient(145deg, ${DS.green900} 0%, ${DS.green800} 100%); padding: 48px 24px 80px; position: relative; overflow: hidden; }
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

    /* Nivel badge */
    .nivel-badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; font-family: 'Sora', sans-serif; }

    /* QR landing */
    .sq-root { min-height: 100vh; background: linear-gradient(160deg, ${DS.green900} 0%, ${DS.green800} 60%, #0d3d2e 100%); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 20px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
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

    /* Bienvenida */
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

    /* Toast */
    .s-toast-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: sFadeIn 0.2s ease; }
    .s-toast-box { background: ${DS.white}; border-radius: 24px; padding: 36px 28px; text-align: center; max-width: 300px; width: 90%; animation: sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1); }
    .s-toast-icon { font-size: 60px; display: block; margin-bottom: 14px; }
    .s-toast-title { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 800; color: ${DS.gray900}; margin-bottom: 8px; }
    .s-toast-sub { font-size: 14px; color: ${DS.gray500}; line-height: 1.5; }
    .s-toast-box.gold { background: linear-gradient(145deg, ${DS.gold100}, #fffdf5); }
    .s-toast-box.gold .s-toast-title { color: #78350f; }
    .s-toast-box.gold .s-toast-sub { color: #92400e; }
    .s-toast-hint { font-size: 12px; color: ${DS.gray300}; margin-top: 16px; }

    /* Rows */
    .s-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid ${DS.gray100}; }
    .s-row:last-child { border-bottom: none; padding-bottom: 0; }
    .s-row:first-child { padding-top: 0; }
    .s-row-title { font-size: 14px; font-weight: 600; color: ${DS.gray900}; }
    .s-row-sub { font-size: 12px; color: ${DS.gray500}; margin-top: 2px; }
    .s-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }

    /* Login */
    .s-login-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green800} 0%, ${DS.green900} 100%); display: flex; align-items: center; justify-content: center; padding: 24px; }
    .s-login-card { background: ${DS.white}; border-radius: 24px; padding: 32px 28px; width: 100%; max-width: 380px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
    .s-login-logo { text-align: center; margin-bottom: 28px; }
    .s-login-app { font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 800; color: ${DS.green800}; letter-spacing: -0.02em; }
    .s-login-app span { color: ${DS.gold500}; }
    .s-login-sub { font-size: 14px; color: ${DS.gray500}; margin-top: 4px; }

    /* Cajero */
    .sc-search-area { padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 8px; }
    .sc-search-row { display: flex; gap: 8px; }
    .sc-search-input { flex: 1; }
    .sc-search-btn { padding: 13px 16px; background: ${DS.green800}; color: ${DS.white}; border: none; border-radius: 10px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; white-space: nowrap; }
    .sc-search-btn:hover { background: ${DS.green700}; }

    /* Charts */
    .s-chart-wrap { position: relative; height: 180px; margin-top: 8px; }
    .s-chart-wrap.donut { height: 200px; }

    /* Onboarding */
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

    /* Kiosko */
    .kiosko-root { min-height: 100vh; background: linear-gradient(145deg, ${DS.green900}, ${DS.green800}); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; font-family: 'Sora', sans-serif; color: ${DS.white}; text-align: center; }
    .kiosko-titulo { font-size: 18px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
    .kiosko-nombre { font-size: 36px; font-weight: 800; margin-bottom: 48px; }
    .kiosko-input { width: 100%; max-width: 320px; padding: 20px; background: rgba(255,255,255,0.1); border: 2px solid rgba(255,255,255,0.2); border-radius: 16px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 700; text-align: center; outline: none; margin-bottom: 16px; transition: border-color 0.15s; }
    .kiosko-input:focus { border-color: ${DS.green400}; }
    .kiosko-input::placeholder { color: rgba(255,255,255,0.2); font-size: 18px; font-weight: 400; }
    .kiosko-btn { width: 100%; max-width: 320px; padding: 20px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 16px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 24px rgba(16,163,122,0.4); }
    .kiosko-salir { position: fixed; top: 16px; right: 16px; background: rgba(255,255,255,0.1); border: none; color: rgba(255,255,255,0.4); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: 'Inter', sans-serif; }

    /* Landing pública */
    .landing-root { min-height: 100vh; background: ${DS.gray50}; font-family: 'Inter', sans-serif; }
    .landing-hero { background: linear-gradient(145deg, ${DS.green900}, ${DS.green800}); padding: 60px 24px 80px; text-align: center; position: relative; }
    .landing-hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 40px; background: ${DS.gray50}; border-radius: 40px 40px 0 0; }
    .landing-nombre { font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800; color: ${DS.white}; margin-bottom: 8px; }
    .landing-tag { font-size: 14px; color: rgba(255,255,255,0.5); }
    .landing-premios { display: flex; flex-direction: column; gap: 12px; padding: 0 16px; margin-top: -20px; }
    .landing-premio { background: ${DS.white}; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
    .landing-premio-icon { font-size: 28px; }
    .landing-premio-nombre { font-size: 15px; font-weight: 600; color: ${DS.gray900}; }
    .landing-premio-visitas { font-size: 12px; color: ${DS.gray500}; margin-top: 2px; }
    .landing-cta { margin: 24px 16px; }
    .landing-cta-btn { width: 100%; padding: 18px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 14px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 20px rgba(16,163,122,0.3); }
    .landing-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 16px 32px; }
    .landing-stat { background: ${DS.white}; border-radius: 14px; padding: 20px; text-align: center; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .landing-stat-num { font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800; color: ${DS.green800}; }
    .landing-stat-lbl { font-size: 12px; color: ${DS.gray500}; margin-top: 4px; }

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

function pwField(id, placeholder = '••••••') {
  return `
    <div class="s-pw-wrap">
      <input type="password" id="${id}" placeholder="${placeholder}" class="s-input" />
      <button type="button" class="s-pw-eye" onclick="
        var i=document.getElementById('${id}');
        if(i.type==='password'){i.type='text';this.textContent='🙈';}
        else{i.type='password';this.textContent='👁';}
      ">👁</button>
    </div>
  `
}

function errMsg(donde = '') {
  return `<p class="s-error">Sin conexión${donde ? ' al ' + donde : ''}. Verifica tu internet e intenta de nuevo.</p>`
}

function toast({ icon, title, sub, gold = false, autoClose = 2400, onTap = null }) {
  const el = document.createElement('div')
  el.className = 's-toast-overlay'
  el.innerHTML = `
    <div class="s-toast-box ${gold ? 'gold' : ''}">
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

function navBar(active = 'cajero') {
  return `
    <nav class="s-nav">
      <button class="s-nav-btn ${active === 'cajero' ? 'active' : ''}" id="snav-cajero">
        <span class="s-nav-icon">🧾</span>Cajero
      </button>
      <button class="s-nav-btn ${active === 'panel' ? 'active' : ''}" id="snav-panel">
        <span class="s-nav-icon">📊</span>Mi Panel
      </button>
      <button class="s-nav-btn ${active === 'salir' ? 'active' : ''}" id="snav-salir">
        <span class="s-nav-icon">🚪</span>Salir
      </button>
    </nav>
  `
}

function initNav() {
  document.getElementById('snav-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('snav-salir')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js'); logout()
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
  const hoy = new Date()
  const dias7 = []; const labels7 = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    dias7.push(key)
    labels7.push(d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }))
  }
  const visitasPorDia = dias7.map(dia => (visitas||[]).filter(v => v.fecha?.startsWith(dia)).length)

  const inicioEsteMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0]
  const inicioMesAnt = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1).toISOString().split('T')[0]
  const finMesAnt = new Date(hoy.getFullYear(), hoy.getMonth(), 0).toISOString().split('T')[0]
  const visitasEsteMes = (visitas||[]).filter(v => v.fecha >= inicioEsteMes).length
  const visitasMesAnt = (visitas||[]).filter(v => v.fecha >= inicioMesAnt && v.fecha <= finMesAnt).length

  const nuevos = (clientes||[]).filter(c => c.total_visitas <= 1).length
  const recurrentes = (clientes||[]).filter(c => c.total_visitas > 1).length
  const total = nuevos + recurrentes

  ;['chart-barras', 'chart-dona', 'chart-meses'].forEach(id => {
    const c = document.getElementById(id); if (c?._chartInstance) c._chartInstance.destroy()
  })

  const ctxB = document.getElementById('chart-barras')
  if (ctxB) ctxB._chartInstance = new window.Chart(ctxB, {
    type: 'bar',
    data: { labels: labels7, datasets: [{ data: visitasPorDia, backgroundColor: visitasPorDia.map((_, i) => i === 6 ? DS.green700 : DS.green100), borderRadius: 6, borderSkipped: false }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw} visitas` } } }, scales: { x: { grid: { display: false }, ticks: { font: { size: 11 }, color: DS.gray500 } }, y: { grid: { color: DS.gray100 }, ticks: { font: { size: 11 }, color: DS.gray500, stepSize: 1 }, beginAtZero: true } } }
  })

  const ctxD = document.getElementById('chart-dona')
  if (ctxD) ctxD._chartInstance = new window.Chart(ctxD, {
    type: 'doughnut',
    data: { labels: ['Recurrentes', 'Nuevos'], datasets: [{ data: total === 0 ? [1, 0] : [recurrentes, nuevos], backgroundColor: [DS.green700, DS.green100], borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, color: DS.gray700, padding: 16 } }, tooltip: { callbacks: { label: ctx => ` ${ctx.raw} clientes (${total > 0 ? Math.round((ctx.raw/total)*100) : 0}%)` } } } }
  })

  const ctxM = document.getElementById('chart-meses')
  if (ctxM) {
    const mesActual = new Date().toLocaleDateString('es-MX', { month: 'long' })
    const mesAnterior = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('es-MX', { month: 'long' })
    ctxM._chartInstance = new window.Chart(ctxM, {
      type: 'bar',
      data: { labels: [mesAnterior, mesActual], datasets: [{ data: [visitasMesAnt, visitasEsteMes], backgroundColor: [DS.gray100, DS.green700], borderRadius: 8, borderSkipped: false }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw} visitas` } } }, scales: { x: { grid: { color: DS.gray100 }, ticks: { font: { size: 11 }, color: DS.gray500, stepSize: 1 }, beginAtZero: true }, y: { grid: { display: false }, ticks: { font: { size: 12, weight: '600' }, color: DS.gray700 } } } }
    })
  }
}

// ── Exportar CSV ───────────────────────────────────────────
function exportarCSV(clientes, negocioNombre) {
  const headers = ['Nombre', 'Teléfono', 'Visitas totales', 'Puntos actuales', 'Nivel', 'Fecha registro']
  const filas = (clientes || []).map(c => {
    const nivel = getNivel(c.total_visitas)
    const fecha = c.fecha_registro ? new Date(c.fecha_registro).toLocaleDateString('es-MX') : '—'
    return [c.nombre, c.telefono, c.total_visitas, c.puntos_actuales, nivel.nombre, fecha]
  })
  const csv = [headers, ...filas].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `clientes-${negocioNombre}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

// ── Onboarding visto? ──────────────────────────────────────
function onboardingVisto() {
  return localStorage.getItem('sello_onboarding') === 'done'
}
function marcarOnboardingVisto() {
  localStorage.setItem('sello_onboarding', 'done')
}

// ═══════════════════════════════════════════════════════════
// PÁGINAS
// ═══════════════════════════════════════════════════════════

// ── LOGIN ──────────────────────────────────────────────────
export function paginaLogin() {
  inyectarEstilos()
  return `
    <div class="s-login-root">
      <div class="s-login-card">
        <div class="s-login-logo">
          ${logoSVG(48, DS.green800)}
          <div class="s-login-app">Sell<span>o</span></div>
          <div class="s-login-sub">Programa de lealtad digital</div>
        </div>
        <div class="s-field"><label class="s-label">Correo electrónico</label><input type="email" id="email" class="s-input" placeholder="tu@correo.com" /></div>
        <div class="s-field"><label class="s-label">Contraseña</label>${pwField('password')}</div>
        <button class="s-btn primary" id="btn-login" style="margin-top:8px">Entrar</button>
        <div id="msg" style="margin-top:10px"></div>
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
      if (negocio.activo === false) {
        msg.innerHTML = `<p class="s-error">Esta cuenta está desactivada. Contacta al administrador.</p>`
        const { logout } = await import('./auth.js'); logout(); return
      }
      // Si no ha visto el onboarding, mostrarlo
      if (!onboardingVisto()) {
        window.location.hash = '#/onboarding'
      } else {
        window.location.hash = '#/bienvenida'
      }
      window.dispatchEvent(new Event('hashchange'))
    } catch (e) { msg.innerHTML = errMsg('servidor') }
    finally { btn.disabled = false; btn.textContent = 'Entrar' }
  }
  document.getElementById('btn-login').addEventListener('click', doLogin)
  document.getElementById('password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })
}

// ── ONBOARDING ─────────────────────────────────────────────
const PASOS_ONBOARDING = [
  { icon: '🧾', titulo: 'Registra visitas en segundos', desc: 'El cajero busca al cliente por teléfono o nombre y toca "Registrar visita". Así de simple.' },
  { icon: '🏆', titulo: 'Configura tus premios', desc: 'Define cuántas visitas necesita un cliente para ganar. Café gratis, descuentos, lo que quieras.' },
  { icon: '📊', titulo: 'Ve tus estadísticas', desc: 'Consulta cuántos clientes tienes, qué días son más concurridos y quiénes son tus clientes más fieles.' },
]

export function paginaOnboarding(paso = 0) {
  inyectarEstilos()
  const p = PASOS_ONBOARDING[paso]
  const esUltimo = paso === PASOS_ONBOARDING.length - 1
  const dots = PASOS_ONBOARDING.map((_, i) => `<div class="onb-dot ${i === paso ? 'active' : ''}"></div>`).join('')
  return `
    <div class="onb-root">
      <div class="onb-step-dots">${dots}</div>
      <div class="onb-icon">${p.icon}</div>
      <div class="onb-titulo">${p.titulo}</div>
      <div class="onb-desc">${p.desc}</div>
      <div class="onb-btns">
        <button class="onb-btn-primary" id="onb-siguiente">
          ${esUltimo ? '¡Empezar ahora!' : 'Siguiente →'}
        </button>
        ${!esUltimo ? `<button class="onb-btn-skip" id="onb-skip">Saltar</button>` : ''}
      </div>
    </div>
  `
}

export function initOnboarding(paso = 0) {
  inyectarEstilos()
  const esUltimo = paso === PASOS_ONBOARDING.length - 1
  document.getElementById('onb-siguiente')?.addEventListener('click', () => {
    if (esUltimo) {
      marcarOnboardingVisto()
      navigate('bienvenida')
    } else {
      navigate('onboarding', paso + 1)
    }
  })
  document.getElementById('onb-skip')?.addEventListener('click', () => {
    marcarOnboardingVisto()
    navigate('bienvenida')
  })
}

// ── BIENVENIDA ─────────────────────────────────────────────
export async function paginaBienvenida() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    return `
      <div class="sbv-root">
        <div class="sbv-logo">${logoSVG(56, DS.white)}</div>
        <div class="sbv-app">Sello</div>
        <div class="sbv-bienvenido">Bienvenido de vuelta</div>
        <h1 class="sbv-nombre">${negocio.nombre}</h1>
        <div class="sbv-btns">
          <button class="sbv-btn primary" id="sbv-cajero">
            <span class="sbv-btn-icon">🧾</span>
            <div><div>Panel Cajero</div><span class="sbv-btn-sub">Registrar visitas de clientes</span></div>
          </button>
          <button class="sbv-btn secondary" id="sbv-panel">
            <span class="sbv-btn-icon">📊</span>
            <div><div>Mi Panel</div><span class="sbv-btn-sub">Estadísticas, premios y más</span></div>
          </button>
          <button class="sbv-btn secondary" id="sbv-kiosko">
            <span class="sbv-btn-icon">🖥️</span>
            <div><div>Modo Kiosko</div><span class="sbv-btn-sub">Pantalla completa para el mostrador</span></div>
          </button>
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

// ── CAJERO ─────────────────────────────────────────────────
export function paginaCajero() {
  inyectarEstilos()
  return `
    <div style="padding-bottom:72px">
      <div class="sello-topbar">
        <div class="sello-topbar-brand">${logoSVG(28, '#fff')} Sell<span>o</span></div>
        <span style="font-size:13px;color:rgba(255,255,255,0.6)">Cajero</span>
      </div>
      <div class="sc-search-area">
        <div class="sc-search-row">
          <input type="tel" id="telefono" placeholder="Buscar por teléfono..." class="s-input sc-search-input" />
          <button id="buscar" class="sc-search-btn">Buscar</button>
        </div>
        <div class="sc-search-row">
          <input type="text" id="nombre-buscar" placeholder="O buscar por nombre..." class="s-input sc-search-input" />
          <button id="buscar-nombre" class="sc-search-btn">Buscar</button>
        </div>
      </div>
      <div id="resultado"></div>
      <div class="s-card" style="margin-top:4px">
        <div class="s-section-label">Atendidos hoy</div>
        <div id="ultimos-clientes"><p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">Cargando...</p></div>
      </div>
    </div>
    ${navBar('cajero')}
  `
}

export function initCajero() {
  inyectarEstilos(); initNav(); cargarUltimosClientes()
  document.getElementById('buscar').addEventListener('click', async () => {
    const t = document.getElementById('telefono').value.trim()
    if (!t) return; document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono: t })
  })
  document.getElementById('buscar-nombre').addEventListener('click', async () => {
    const n = document.getElementById('nombre-buscar').value.trim()
    if (!n) return; document.getElementById('telefono').value = ''; await buscarYMostrar({ nombre: n })
  })
  document.getElementById('telefono').addEventListener('keydown', async e => {
    if (e.key === 'Enter') { const t = document.getElementById('telefono').value.trim(); if (t) { document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono: t }) } }
  })
  document.getElementById('nombre-buscar').addEventListener('keydown', async e => {
    if (e.key === 'Enter') { const n = document.getElementById('nombre-buscar').value.trim(); if (n) { document.getElementById('telefono').value = ''; await buscarYMostrar({ nombre: n }) } }
  })
}

async function cargarUltimosClientes() {
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual(); if (!negocio) return
    const hoy = new Date().toISOString().split('T')[0]
    const { data: visitas, error } = await supabase.from('visitas').select('cliente_id,fecha').eq('negocio_id', negocio.id).gte('fecha', hoy).order('fecha', { ascending: false }).limit(20)
    if (error) throw error
    if (!visitas || visitas.length === 0) { document.getElementById('ultimos-clientes').innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center">Ningún cliente atendido hoy</p>`; return }
    const vistos = new Set(); const ids = []
    for (const v of visitas) { if (!vistos.has(v.cliente_id)) { vistos.add(v.cliente_id); ids.push(v.cliente_id) } if (ids.length >= 5) break }
    const { data: clientes, error: e2 } = await supabase.from('clientes').select('id,nombre,telefono,total_visitas').in('id', ids)
    if (e2) throw e2
    const ordenados = ids.map(id => clientes.find(c => c.id === id)).filter(Boolean)
    document.getElementById('ultimos-clientes').innerHTML = ordenados.map(c => `
      <div class="s-row" style="cursor:pointer" data-tel="${c.telefono}">
        <div><div class="s-row-title">${c.nombre}</div><div class="s-row-sub">${c.telefono}</div></div>
        <div class="s-row-actions" style="color:${DS.gray300};font-size:13px">${c.total_visitas} visitas →</div>
      </div>
    `).join('')
    document.querySelectorAll('#ultimos-clientes .s-row').forEach(row => {
      row.addEventListener('click', async () => {
        document.getElementById('telefono').value = row.dataset.tel
        document.getElementById('nombre-buscar').value = ''
        await buscarYMostrar({ telefono: row.dataset.tel })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    })
  } catch (e) {
    document.getElementById('ultimos-clientes').innerHTML = `<p style="color:#aaa;font-size:13px;text-align:center">Sin conexión</p>`
  }
}

async function buscarYMostrar({ telefono, nombre }) {
  const res = document.getElementById('resultado')
  res.innerHTML = `<div class="s-card"><p style="text-align:center;color:#aaa;padding:8px">Buscando...</p></div>`
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    let q = supabase.from('clientes').select('*').eq('negocio_id', negocio?.id)
    if (telefono) q = q.eq('telefono', telefono)
    else if (nombre) q = q.ilike('nombre', `%${nombre}%`)
    const { data, error } = await q; if (error) throw error
    if (telefono) {
      if (!data?.[0]) {
        res.innerHTML = `<div class="s-card"><p class="s-error" style="margin-bottom:12px">Cliente no encontrado</p><button class="s-btn primary" id="btn-nuevo">+ Registrar nuevo cliente</button></div>`
        document.getElementById('btn-nuevo').addEventListener('click', () => navigate('registro', telefono)); return
      }
      mostrarCliente(data[0]); return
    }
    if (!data || data.length === 0) { res.innerHTML = `<div class="s-card"><p class="s-error">No se encontró ningún cliente con ese nombre</p></div>`; return }
    if (data.length === 1) { mostrarCliente(data[0]); return }
    res.innerHTML = `<div class="s-card"><div class="s-section-label">Se encontraron ${data.length} clientes</div>${data.map(c => `
      <div class="s-row" style="cursor:pointer" data-id="${c.id}">
        <div><div class="s-row-title">${c.nombre}</div><div class="s-row-sub">${c.telefono}</div></div>
        <div style="color:${DS.gray300};font-size:13px">${c.total_visitas} visitas →</div>
      </div>`).join('')}</div>`
    res.querySelectorAll('.s-row').forEach(row => { row.addEventListener('click', () => { const c = data.find(x => x.id === row.dataset.id); if (c) mostrarCliente(c) }) })
  } catch (e) { res.innerHTML = `<div class="s-card">${errMsg('buscar clientes')}</div>` }
}

async function mostrarCliente(data) {
  try {
    const { data: nd, error: e1 } = await supabase.from('negocios').select('meta_puntos').eq('id', data.negocio_id).single(); if (e1) throw e1
    const { data: premios, error: e2 } = await supabase.from('premios').select('*').eq('negocio_id', data.negocio_id).eq('activo', true); if (e2) throw e2
    const meta = nd?.meta_puntos || META_VISITAS
    const ciclo = data.puntos_actuales % meta
    const pct = Math.min(Math.round((ciclo / meta) * 100), 100)
    const nivel = getNivel(data.total_visitas)
    const res = document.getElementById('resultado')
    res.innerHTML = `
      <div class="s-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:${DS.gray900}">${data.nombre}</div>
          <div class="nivel-badge" style="background:${nivel.color}20;color:${nivel.color}">${nivel.emoji} ${nivel.nombre}</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div class="s-stat"><div class="s-stat-num">${data.total_visitas}</div><div class="s-stat-lbl">Visitas totales</div></div>
          <div class="s-stat"><div class="s-stat-num" id="ciclo-display">${ciclo}/${meta}</div><div class="s-stat-lbl">Para el premio</div></div>
        </div>
        <div class="s-prog-wrap">
          <div class="s-prog-header"><span>Progreso al premio</span><span id="prog-label">${ciclo}/${meta}</span></div>
          <div class="s-prog-track"><div class="s-prog-fill" id="prog-fill" style="width:${pct}%"></div></div>
        </div>
        <button class="s-btn primary" id="registrar" style="margin-top:4px">+ Registrar visita</button>
        <div id="msg-cajero" style="margin-top:10px"></div>
      </div>
    `
    document.getElementById('registrar').addEventListener('click', async () => {
      const btn = document.getElementById('registrar')
      btn.disabled = true; btn.textContent = 'Registrando...'
      try {
        const { error: ev } = await supabase.from('visitas').insert({ cliente_id: data.id, negocio_id: data.negocio_id, puntos_sumados: 1 }); if (ev) throw ev
        const nv = data.total_visitas + 1; const na = data.puntos_actuales + 1
        const { error: ec } = await supabase.from('clientes').update({ puntos_actuales: na, total_visitas: nv }).eq('id', data.id); if (ec) throw ec
        data.puntos_actuales = na; data.total_visitas = nv
        const nc = na % meta; const np = Math.min(Math.round((nc / meta) * 100), 100)
        document.getElementById('ciclo-display').textContent = `${nc}/${meta}`
        document.getElementById('prog-label').textContent = `${nc}/${meta}`
        document.getElementById('prog-fill').style.width = np + '%'
        cargarUltimosClientes()
        if (na > 0 && na % meta === 0) {
          if (premios && premios.length > 0) {
            const p = premios.find(x => x.puntos_requeridos === meta) || premios[0]
            toast({ icon: '🏆', title: '¡Premio desbloqueado!', sub: `Entrega: ${p.nombre}`, gold: true,
              onTap: async () => {
                try { await supabase.from('canjes').insert({ cliente_id: data.id, premio_id: p.id, fecha: new Date().toISOString() }) } catch (_) {}
                document.getElementById('msg-cajero').innerHTML = `<div class="s-success">✓ Premio "${p.nombre}" entregado y registrado</div>`
              }
            })
          } else {
            toast({ icon: '✅', title: 'Ciclo completado', sub: 'No hay premios activos configurados.' })
          }
        } else {
          toast({ icon: '✅', title: 'Visita registrada', sub: `Faltan ${meta - nc} visita${meta - nc === 1 ? '' : 's'} para el premio` })
        }
      } catch (e) { document.getElementById('msg-cajero').innerHTML = errMsg('registrar la visita') }
      finally { btn.disabled = false; btn.textContent = '+ Registrar visita' }
    })
  } catch (e) { document.getElementById('resultado').innerHTML = `<div class="s-card">${errMsg('cargar el cliente')}</div>` }
}

// ── MODO KIOSKO ────────────────────────────────────────────
export async function paginaKiosko() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) { navigate('login'); return '<div></div>' }
    return `
      <div class="kiosko-root">
        <button class="kiosko-salir" id="kiosko-salir">✕ Salir</button>
        ${logoSVG(48, 'rgba(255,255,255,0.4)')}
        <div class="kiosko-titulo" style="margin-top:16px">Bienvenido a</div>
        <div class="kiosko-nombre">${negocio.nombre}</div>
        <input type="tel" id="kiosko-tel" class="kiosko-input" placeholder="Tu teléfono" />
        <button class="kiosko-btn" id="kiosko-entrar">Registrar mi visita →</button>
        <div id="kiosko-msg" style="margin-top:20px;font-size:14px;color:rgba(255,255,255,0.5)"></div>
      </div>
    `
  } catch (e) { return `<div class="kiosko-root"><div>${errMsg()}</div></div>` }
}

export function initKiosko() {
  inyectarEstilos()
  document.getElementById('kiosko-salir')?.addEventListener('click', () => navigate('bienvenida'))

  const doRegistrar = async () => {
    const telefono = document.getElementById('kiosko-tel').value.trim()
    if (!telefono) return
    const msg = document.getElementById('kiosko-msg')
    const btn = document.getElementById('kiosko-entrar')
    btn.disabled = true; btn.textContent = 'Procesando...'
    msg.textContent = ''

    try {
      const { getNegocioActual } = await import('./auth.js')
      const negocio = getNegocioActual()

      const { data: nd } = await supabase.from('negocios').select('meta_puntos').eq('id', negocio.id).single()
      const meta = nd?.meta_puntos || META_VISITAS

      const { data: cliente } = await supabase.from('clientes').select('*').eq('telefono', telefono).eq('negocio_id', negocio.id).single()

      if (!cliente) {
        // Cliente nuevo — navegar a registro
        navigate('registro-cliente', `${negocio.id}/${telefono}`)
        return
      }

      // Registrar visita
      await supabase.from('visitas').insert({ cliente_id: cliente.id, negocio_id: negocio.id, puntos_sumados: 1 })
      const nuevosActuales = cliente.puntos_actuales + 1
      await supabase.from('clientes').update({ puntos_actuales: nuevosActuales, total_visitas: cliente.total_visitas + 1 }).eq('id', cliente.id)

      const nuevoCiclo = nuevosActuales % meta
      const nivel = getNivel(cliente.total_visitas + 1)

      if (nuevosActuales > 0 && nuevosActuales % meta === 0) {
        toast({ icon: '🎉', title: `¡Hola ${cliente.nombre.split(' ')[0]}!`, sub: `¡Ganaste un premio! Díselo al cajero 🏆`, gold: true, autoClose: 4000 })
      } else {
        toast({ icon: nivel.emoji, title: `¡Hola ${cliente.nombre.split(' ')[0]}!`, sub: `Visita registrada. Te faltan ${meta - nuevoCiclo} para el premio.`, autoClose: 3000 })
      }

      // Limpiar campo
      document.getElementById('kiosko-tel').value = ''
    } catch (e) { msg.textContent = 'Sin conexión. Intenta de nuevo.' }
    finally { btn.disabled = false; btn.textContent = 'Registrar mi visita →' }
  }

  document.getElementById('kiosko-entrar')?.addEventListener('click', doRegistrar)
  document.getElementById('kiosko-tel')?.addEventListener('keydown', e => { if (e.key === 'Enter') doRegistrar() })
}

// ── REGISTRO CAJERO ────────────────────────────────────────
export function paginaRegistro(telefono = '') {
  inyectarEstilos()
  return `
    <div style="padding-bottom:72px">
      <div class="sello-topbar">
        <div class="sello-topbar-brand">${logoSVG(28, '#fff')} Sell<span>o</span></div>
        <span style="font-size:13px;color:rgba(255,255,255,0.6)">Nuevo cliente</span>
      </div>
      <div class="s-card" style="margin-top:16px">
        <div class="s-section-label">Registrar cliente</div>
        <div class="s-field"><label class="s-label">Nombre</label><input type="text" id="nombre" class="s-input" placeholder="Nombre del cliente" /></div>
        <div class="s-field"><label class="s-label">Teléfono</label><input type="tel" id="tel" value="${telefono}" class="s-input" placeholder="10 dígitos" /></div>
        <button class="s-btn primary" id="guardar" style="margin-top:8px">Guardar cliente</button>
        <div id="msg" style="margin-top:10px"></div>
      </div>
    </div>
    ${navBar('cajero')}
  `
}

export function initRegistro() {
  inyectarEstilos(); initNav()
  document.getElementById('guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim()
    const telefono = document.getElementById('tel').value.trim()
    const msg = document.getElementById('msg'); const btn = document.getElementById('guardar')
    if (!nombre || !telefono) { msg.innerHTML = `<p class="s-error">Llena todos los campos</p>`; return }
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
      const { error } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocio?.id, puntos_actuales: 0, total_visitas: 0 })
      if (error) throw error
      msg.innerHTML = `<div class="s-success">✓ Cliente registrado correctamente</div>`
      setTimeout(() => navigate('cajero'), 1500)
    } catch (e) { msg.innerHTML = errMsg('guardar el cliente') }
    finally { btn.disabled = false; btn.textContent = 'Guardar cliente' }
  })
}

// ── ADMIN ──────────────────────────────────────────────────
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
      const cn = (clientes||[]).filter(c=>c.negocio_id===n.id).length
      const vn = (visitas||[]).filter(v=>v.negocio_id===n.id).length
      return `
        <div class="s-row">
          <div><div class="s-row-title">${n.nombre}</div><div class="s-row-sub">${n.email} · ${cn} clientes · ${vn} visitas</div></div>
          <div class="s-row-actions">
            <span class="s-badge ${n.activo ? 'active' : 'inactive'}">${n.activo ? 'Activo' : 'Inactivo'}</span>
            <button class="btn-toggle-negocio" data-id="${n.id}" data-activo="${n.activo}"
              style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;background:${n.activo?'#fee2e2':'#d1fae5'};color:${n.activo?'#dc2626':'#059669'}">
              ${n.activo?'Desactivar':'Activar'}
            </button>
            <button class="btn-descargar-qr" data-id="${n.id}" data-nombre="${n.nombre}"
              style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;background:${DS.green800};color:white;font-weight:600">⬇ QR</button>
          </div>
        </div>
      `
    }).join('')
    return `
      <div>
        <div class="sello-topbar">
          <div class="sello-topbar-brand">${logoSVG(28,'#fff')} Sell<span>o</span></div>
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
            <div class="s-field"><label class="s-label">Contraseña</label>${pwField('nuevo-password','Contraseña para el dueño')}</div>
            <button id="btn-guardar-negocio" class="s-btn primary" style="margin-top:8px">Guardar negocio</button>
            <div id="msg-negocio" style="margin-top:10px"></div>
          </div>
          ${filas || '<p style="color:#aaa;text-align:center;font-size:14px">No hay negocios aún</p>'}
        </div>
        <canvas id="qr-canvas" style="display:none"></canvas>
      </div>
    `
  } catch (e) { return `<div class="sello-topbar"><div class="sello-topbar-brand">Sello</div></div><div class="s-card">${errMsg('cargar datos')}</div>` }
}

export function initAdmin() {
  inyectarEstilos()
  if (!isAdminAuth()) {
    document.getElementById('btn-admin-login')?.addEventListener('click', () => {
      const pw = document.getElementById('admin-password').value; const msg = document.getElementById('msg-admin')
      if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth','ok'); navigate('admin') }
      else msg.innerHTML = `<p class="s-error">Contraseña incorrecta</p>`
    })
    document.getElementById('admin-password')?.addEventListener('keydown', e => { if (e.key==='Enter') document.getElementById('btn-admin-login').click() })
    return
  }
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => { sessionStorage.removeItem('admin_auth'); navigate('admin') })
  document.getElementById('btn-nuevo-negocio')?.addEventListener('click', () => { const f=document.getElementById('form-negocio'); f.style.display=f.style.display==='none'?'block':'none' })
  document.getElementById('btn-guardar-negocio')?.addEventListener('click', async () => {
    const nombre=document.getElementById('nuevo-nombre').value.trim(); const email=document.getElementById('nuevo-email').value.trim(); const password=document.getElementById('nuevo-password').value.trim(); const msg=document.getElementById('msg-negocio')
    if (!nombre||!email||!password){msg.innerHTML=`<p class="s-error">Llena todos los campos</p>`;return}
    msg.innerHTML=`<p style="color:#aaa;text-align:center">Guardando...</p>`
    try { const{error}=await supabase.from('negocios').insert({nombre,email,password,password_hash:password,activo:true,meta_puntos:10}); if(error)throw error; msg.innerHTML=`<div class="s-success">✓ Negocio creado correctamente</div>`; setTimeout(()=>navigate('admin'),1500) }
    catch(e){msg.innerHTML=errMsg('guardar el negocio')}
  })
  document.querySelectorAll('.btn-toggle-negocio').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const act=btn.dataset.activo==='true'; btn.textContent='...'; btn.disabled=true
      try{const{error}=await supabase.from('negocios').update({activo:!act}).eq('id',btn.dataset.id);if(error)throw error;navigate('admin')}
      catch(e){btn.textContent=act?'Desactivar':'Activar';btn.disabled=false;alert('Sin conexión.')}
    })
  })
  document.querySelectorAll('.btn-descargar-qr').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const url=`${window.location.origin}/#/negocio/${btn.dataset.id}`; const canvas=document.getElementById('qr-canvas')
      await QRCode.toCanvas(canvas,url,{width:400,margin:2,color:{dark:'#000000',light:'#ffffff'}})
      const cf=document.createElement('canvas'); cf.width=canvas.width; cf.height=canvas.height+50; const ctx=cf.getContext('2d')
      ctx.fillStyle='#fff'; ctx.fillRect(0,0,cf.width,cf.height); ctx.drawImage(canvas,0,0); ctx.fillStyle='#000'; ctx.font='bold 22px Arial'; ctx.textAlign='center'; ctx.fillText(btn.dataset.nombre,canvas.width/2,canvas.height+35)
      const link=document.createElement('a'); link.download=`QR-${btn.dataset.nombre}.png`; link.href=cf.toDataURL('image/png'); link.click()
    })
  })
}

// ── VISTA CLIENTE con niveles e historial ──────────────────
export async function paginaCliente(telefono) {
  inyectarEstilos()
  try {
    const { data, error } = await supabase.from('clientes').select('*, negocios(nombre,meta_puntos)').eq('telefono', telefono).single()
    if (error) throw error
    if (!data) return `<div class="sc-root"><div class="sc-hero"><div class="sc-hero-name">No encontrado</div></div></div>`

    // Historial de visitas
    const { data: historial } = await supabase.from('visitas').select('fecha').eq('cliente_id', data.id).order('fecha', { ascending: false }).limit(10)

    const meta = data.negocios?.meta_puntos || META_VISITAS
    const ciclo = data.puntos_actuales % meta
    const pct = data.puntos_actuales === 0 ? 0 : Math.min(Math.round((ciclo/meta)*100),100)
    const tienePremio = data.puntos_actuales > 0 && data.puntos_actuales % meta === 0
    const nivel = getNivel(data.total_visitas)
    const sigNivel = getSiguienteNivel(data.total_visitas)

    let mensajeProgreso
    if (data.puntos_actuales === 0) mensajeProgreso = `Empieza a visitar para acumular visitas ☕`
    else if (tienePremio) mensajeProgreso = `🏆 ¡Tienes un premio disponible! Muéstraselo al cajero.`
    else mensajeProgreso = `Te falta${meta-ciclo===1?'':'n'} <strong>${meta-ciclo}</strong> visita${meta-ciclo===1?'':'s'} para tu próximo premio`

    const filasHistorial = (historial || []).map(v => {
      const fecha = new Date(v.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      return `<div class="s-row"><div class="s-row-title" style="font-weight:400;font-size:13px">📍 Visita registrada</div><div style="font-size:12px;color:${DS.gray500}">${fecha}</div></div>`
    }).join('')

    return `
      <div class="sc-root">
        <div class="sc-hero">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            ${logoSVG(28, 'rgba(255,255,255,0.6)')}
            <span style="font-size:13px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.1em">Sello</span>
          </div>
          <div class="sc-hero-negocio">${data.negocios?.nombre || 'Programa de Lealtad'}</div>
          <div class="sc-hero-name">Hola, ${data.nombre?.split(' ')[0] || 'Cliente'} 👋</div>
          <div class="sc-hero-sub">Aquí está tu progreso</div>
        </div>

        <div class="sc-puntos-card">
          <!-- Nivel -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div class="nivel-badge" style="background:${nivel.color}20;color:${nivel.color};font-size:14px">${nivel.emoji} ${nivel.nombre}</div>
            ${sigNivel ? `<div style="font-size:12px;color:${DS.gray500}">Siguiente: ${sigNivel.emoji} ${sigNivel.nombre} (${sigNivel.min} visitas)</div>` : `<div style="font-size:12px;color:${DS.gold500}">💎 Nivel máximo</div>`}
          </div>

          <div class="sc-puntos-grid">
            <div class="sc-punto-box"><div class="sc-punto-num">${data.total_visitas}</div><div class="sc-punto-lbl">Visitas totales</div></div>
            <div class="sc-punto-box"><div class="sc-punto-num ${tienePremio?'gold':''}">${ciclo}/${meta}</div><div class="sc-punto-lbl">Para el premio</div></div>
          </div>
          <div class="s-prog-header"><span style="font-size:13px;color:${DS.gray500}">Progreso al premio</span><span style="font-size:13px;font-weight:600;color:${DS.green800}">${pct}%</span></div>
          <div class="s-prog-track" style="height:12px"><div class="${'s-prog-fill'+(tienePremio?' gold':'')}" id="lc-fill" style="width:0%"></div></div>
          <div class="sc-mensaje ${tienePremio?'premio':data.puntos_actuales===0?'inicio':'normal'}" style="margin-top:16px">${mensajeProgreso}</div>
        </div>

        <div class="s-card">
          <div class="s-section-label">Tu código QR</div>
          <div style="text-align:center">
            <div id="qrcode" style="display:inline-block;padding:14px;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.08)"></div>
            <p style="font-size:12px;color:${DS.gray500};margin-top:10px">Muéstralo al cajero para sumar visitas</p>
          </div>
        </div>

        ${historial && historial.length > 0 ? `
        <div class="s-card">
          <div class="s-section-label">Historial de visitas</div>
          ${filasHistorial}
        </div>
        ` : ''}
      </div>
    `
  } catch (e) {
    return `<div class="sc-root"><div class="sc-hero"><div class="sc-hero-name">Error de conexión</div></div><div class="s-card">${errMsg()}</div></div>`
  }
}

export function initCliente(telefono) {
  inyectarEstilos()
  setTimeout(() => {
    const fill = document.getElementById('lc-fill'); const header = document.querySelector('.s-prog-header span:last-child')
    if (fill && header) { const pct = parseInt(header.textContent) || 0; setTimeout(() => { fill.style.width = pct + '%' }, 80) }
  }, 100)
  const qrDiv = document.getElementById('qrcode')
  if (qrDiv) {
    QRCode.toCanvas(document.createElement('canvas'), `${window.location.origin}/#/cliente/${telefono}`,
      { width: 180, margin: 1, color: { dark: DS.green900, light: '#ffffff' } },
      (err, canvas) => { if (!err) qrDiv.appendChild(canvas) })
  }
}

// ── QR NEGOCIO ─────────────────────────────────────────────
export async function paginaQRNegocio(negocioId) {
  inyectarEstilos()
  try {
    const { data: negocio, error } = await supabase.from('negocios').select('*').eq('id', negocioId).single()
    if (error) throw error
    if (!negocio) return `<div class="sq-root"><h1>No encontrado</h1></div>`
    return `
      <div class="sq-root">
        <div class="sq-logo">${logoSVG(52, DS.white)}</div>
        <div class="sq-negocio">Programa de lealtad</div>
        <h1 class="sq-nombre">${negocio.nombre}</h1>
        <p class="sq-sub">Acumula visitas y gana premios exclusivos</p>
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
      const { data, error } = await supabase.from('clientes').select('*').eq('telefono', telefono).eq('negocio_id', negocioId).single()
      if (error && error.code !== 'PGRST116') throw error
      if (data) navigate('cliente', telefono)
      else navigate('registro-cliente', `${negocioId}/${telefono}`)
    } catch (e) { msg.innerHTML = errMsg(); btn.disabled = false }
  }
  document.getElementById('btn-entrar')?.addEventListener('click', doEntrar)
  document.getElementById('tel-negocio')?.addEventListener('keydown', e => { if (e.key==='Enter') doEntrar() })
}

// ── REGISTRO DESDE QR ──────────────────────────────────────
export function paginaRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  return `
    <div class="sq-root">
      <div class="sq-logo">${logoSVG(52, DS.white)}</div>
      <h1 class="sq-nombre">Bienvenido 👋</h1>
      <p class="sq-sub">Regístrate para acumular visitas y ganar premios</p>
      <div class="sq-form">
        <label style="font-size:13px;color:rgba(255,255,255,0.5);display:block;text-align:left;margin-bottom:8px">Tu nombre</label>
        <input type="text" id="nombre-cliente" class="sq-input" placeholder="¿Cómo te llamas?" style="margin-bottom:12px" />
        <label style="font-size:13px;color:rgba(255,255,255,0.5);display:block;text-align:left;margin-bottom:8px">Teléfono</label>
        <input type="tel" id="tel-cliente" class="sq-input" value="${telefono}" readonly style="opacity:0.5;margin-bottom:16px" />
        <button class="sq-btn" id="btn-registrar-cliente">Registrarme →</button>
        <div id="msg-registro" style="margin-top:12px;font-size:13px;color:rgba(255,255,255,0.4);text-align:center"></div>
      </div>
    </div>
  `
}

export function initRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  document.getElementById('btn-registrar-cliente').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-cliente').value.trim()
    const msg = document.getElementById('msg-registro'); const btn = document.getElementById('btn-registrar-cliente')
    if (!nombre) { msg.innerHTML = `<p style="color:#f87171">Escribe tu nombre</p>`; return }
    btn.disabled = true; btn.textContent = 'Registrando...'
    try {
      const { error } = await supabase.from('clientes').insert({ nombre, telefono, negocio_id: negocioId, puntos_actuales: 0, total_visitas: 0 })
      if (error) throw error
      navigate('cliente', telefono)
    } catch (e) { msg.innerHTML = errMsg('registrarte'); btn.disabled = false; btn.textContent = 'Registrarme →' }
  })
}

// ── LANDING PÚBLICA ────────────────────────────────────────
export async function paginaLanding(negocioId) {
  inyectarEstilos()
  try {
    const { data: negocio, error } = await supabase.from('negocios').select('*').eq('id', negocioId).single()
    if (error) throw error
    if (!negocio) return `<div class="landing-root"><div class="landing-hero"><div class="landing-nombre">No encontrado</div></div></div>`

    const { data: premios } = await supabase.from('premios').select('*').eq('negocio_id', negocioId).eq('activo', true)
    const { data: clientes } = await supabase.from('clientes').select('id').eq('negocio_id', negocioId)
    const { data: visitas } = await supabase.from('visitas').select('id').eq('negocio_id', negocioId)

    const filasPremios = (premios || []).map(p => `
      <div class="landing-premio">
        <div class="landing-premio-icon">🏆</div>
        <div>
          <div class="landing-premio-nombre">${p.nombre}</div>
          <div class="landing-premio-visitas">Gánalo con ${p.puntos_requeridos} visitas</div>
        </div>
      </div>
    `).join('')

    return `
      <div class="landing-root">
        <div class="landing-hero">
          <div style="margin-bottom:16px">${logoSVG(40, 'rgba(255,255,255,0.5)')}</div>
          <div class="landing-nombre">${negocio.nombre}</div>
          <div class="landing-tag">Programa de lealtad digital · Powered by Sello</div>
        </div>

        <div style="padding:24px 16px 8px;margin-top:-20px;position:relative;z-index:1">
          <h2 style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:${DS.gray900};margin-bottom:16px">Premios disponibles</h2>
        </div>
        <div class="landing-premios">
          ${filasPremios || `<div class="landing-premio"><div class="landing-premio-icon">🎁</div><div><div class="landing-premio-nombre">Premios por definir</div><div class="landing-premio-visitas">Próximamente</div></div></div>`}
        </div>

        <div class="landing-cta" style="margin-top:24px">
          <button class="landing-cta-btn" id="landing-registrar">Registrarme en el programa →</button>
        </div>

        <div class="landing-stats" style="margin-top:16px">
          <div class="landing-stat">
            <div class="landing-stat-num">${(clientes||[]).length}</div>
            <div class="landing-stat-lbl">Clientes registrados</div>
          </div>
          <div class="landing-stat">
            <div class="landing-stat-num">${(visitas||[]).length}</div>
            <div class="landing-stat-lbl">Visitas registradas</div>
          </div>
        </div>

        <div style="text-align:center;padding:24px 16px;font-size:12px;color:${DS.gray300}">
          Powered by <strong style="color:${DS.green800}">Sello</strong> · Programa de lealtad digital
        </div>
      </div>
    `
  } catch (e) { return `<div class="landing-root"><div class="landing-hero"><div class="landing-nombre">Error de conexión</div></div></div>` }
}

export function initLanding(negocioId) {
  inyectarEstilos()
  document.getElementById('landing-registrar')?.addEventListener('click', () => {
    navigate('negocio', negocioId)
  })
}

// ── PANEL DUEÑO ────────────────────────────────────────────
export async function paginaDueno() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) { window.location.hash='#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    const { data: nd, error: e0 } = await supabase.from('negocios').select('*').eq('id', negocio.id).single(); if (e0) throw e0
    if (nd?.activo === false) { const { logout } = await import('./auth.js'); logout(); return '<div></div>' }
    const meta = nd?.meta_puntos || 10
    const { data: clientes } = await supabase.from('clientes').select('*').eq('negocio_id', negocio.id)
    const { data: visitas } = await supabase.from('visitas').select('*').eq('negocio_id', negocio.id)
    const { data: premios } = await supabase.from('premios').select('*').eq('negocio_id', negocio.id)
    const premioIds = (premios||[]).map(p=>p.id)
    const { data: canjes } = premioIds.length > 0
      ? await supabase.from('canjes').select('*,premios(nombre),clientes(nombre)').in('premio_id',premioIds).order('fecha',{ascending:false}).limit(10)
      : { data: [] }

    const hoy = new Date().toISOString().split('T')[0]
    const vhoy = (visitas||[]).filter(v=>v.fecha&&v.fecha.startsWith(hoy)).length
    const top5 = [...(clientes||[])].sort((a,b)=>b.total_visitas-a.total_visitas).slice(0,5)

    const filasClientes = top5.map(c => {
      const nivel = getNivel(c.total_visitas)
      return `
        <div class="s-row">
          <div>
            <div class="s-row-title">${c.nombre}</div>
            <div class="s-row-sub">${c.telefono}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="nivel-badge" style="background:${nivel.color}20;color:${nivel.color};font-size:11px;padding:3px 8px">${nivel.emoji} ${nivel.nombre}</div>
            <div style="font-size:13px;color:${DS.gray500}">${c.total_visitas}</div>
          </div>
        </div>
      `
    }).join('')

    const filasPremios = (premios||[]).map(p=>`
      <div class="s-row">
        <div><div class="s-row-title">${p.nombre}</div><div class="s-row-sub">Se gana a las ${p.puntos_requeridos} visitas</div></div>
        <div class="s-row-actions">
          <span class="s-badge ${p.activo?'active':'inactive'}">${p.activo?'Activo':'Inactivo'}</span>
          <button class="btn-toggle-premio" data-id="${p.id}" data-activo="${p.activo}"
            style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:12px;font-weight:600;background:${DS.gray100};color:${DS.gray700}">
            ${p.activo?'Desactivar':'Activar'}
          </button>
          <button class="btn-eliminar-premio" data-id="${p.id}" data-nombre="${p.nombre}"
            style="padding:6px 10px;border-radius:8px;border:none;cursor:pointer;font-size:13px;background:#fee2e2;color:#dc2626;font-weight:600">🗑</button>
        </div>
      </div>
    `).join('')

    const filasCanjes = (canjes||[]).length===0
      ? `<p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">No hay premios entregados aún</p>`
      : (canjes||[]).map(c=>{
          const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'short'}) : '—'
          return `<div class="s-row"><div><div class="s-row-title">${c.premios?.nombre||'Premio'}</div><div class="s-row-sub">${c.clientes?.nombre||'—'} · ${fecha}</div></div><span style="font-size:12px;color:#059669;font-weight:600">✓ Entregado</span></div>`
        }).join('')

    // Landing URL
    const landingUrl = `${window.location.origin}/#/landing/${negocio.id}`

    return `
      <div style="padding-bottom:72px">
        <div class="sello-topbar">
          <div class="sello-topbar-brand">${logoSVG(28,'#fff')} Sell<span>o</span></div>
          <span style="font-size:13px;color:rgba(255,255,255,0.6)">${nd?.nombre||negocio.nombre}</span>
        </div>

        <!-- Resumen -->
        <div class="s-card" style="margin-top:16px">
          <div class="s-section-label">Resumen</div>
          <div class="s-stats">
            <div class="s-stat"><div class="s-stat-num">${(clientes||[]).length}</div><div class="s-stat-lbl">Clientes</div></div>
            <div class="s-stat"><div class="s-stat-num" style="color:${DS.gold500}">${vhoy}</div><div class="s-stat-lbl">Hoy</div></div>
            <div class="s-stat"><div class="s-stat-num">${(visitas||[]).length}</div><div class="s-stat-lbl">Total</div></div>
          </div>
        </div>

        <!-- Dashboard -->
        <div class="s-card">
          <div class="s-section-label">Visitas — últimos 7 días</div>
          <div class="s-chart-wrap"><canvas id="chart-barras"></canvas></div>
        </div>
        <div class="s-card">
          <div class="s-section-label">Este mes vs mes anterior</div>
          <div class="s-chart-wrap"><canvas id="chart-meses"></canvas></div>
        </div>
        <div class="s-card">
          <div class="s-section-label">Clientes nuevos vs recurrentes</div>
          <div class="s-chart-wrap donut"><canvas id="chart-dona"></canvas></div>
        </div>

        <!-- Premios -->
        <div class="s-card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <div class="s-section-label" style="margin-bottom:0">Premios</div>
            <button id="btn-nuevo-premio" style="background:${DS.green800};color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">+ Nuevo</button>
          </div>
          <p style="font-size:12px;color:${DS.gray300};margin-bottom:14px">Visitas necesarias se configuran por premio</p>
          <div id="form-premio" style="display:none;background:${DS.gray50};padding:16px;border-radius:12px;margin-bottom:14px">
            <div class="s-field"><label class="s-label">Nombre del premio</label><input type="text" id="nombre-premio" class="s-input" placeholder="Ej: Café gratis, Descuento 20%..." /></div>
            <div class="s-field"><label class="s-label">¿A cuántas visitas se gana?</label><input type="number" id="visitas-premio" class="s-input" value="${meta}" min="1" /></div>
            <button id="btn-guardar-premio" class="s-btn primary" style="margin-top:8px">Guardar premio</button>
            <div id="msg-premio" style="margin-top:10px"></div>
          </div>
          <div id="lista-premios">${filasPremios||`<p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">No hay premios configurados aún</p>`}</div>
        </div>

        <!-- Exportar CSV -->
        <div class="s-card">
          <div class="s-section-label">Exportar datos</div>
          <p style="font-size:13px;color:${DS.gray500};margin-bottom:14px">Descarga la lista completa de tus clientes en Excel</p>
          <button id="btn-exportar-csv" style="background:${DS.green800};color:white;border:none;padding:12px 20px;border-radius:10px;cursor:pointer;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px">
            ⬇ Descargar clientes (.csv)
          </button>
          <div id="msg-exportar" style="margin-top:10px"></div>
        </div>

        <!-- Landing pública -->
        <div class="s-card">
          <div class="s-section-label">Tu página pública</div>
          <p style="font-size:13px;color:${DS.gray500};margin-bottom:12px">Comparte este link en Instagram, WhatsApp o donde quieras. Tus clientes pueden ver los premios y registrarse sin escanear el QR.</p>
          <div style="background:${DS.gray50};border-radius:10px;padding:12px 14px;font-size:13px;color:${DS.gray700};word-break:break-all;margin-bottom:12px;border:1px solid ${DS.gray100}">
            ${landingUrl}
          </div>
          <div style="display:flex;gap:8px">
            <button id="btn-copiar-landing" style="flex:1;padding:10px;background:${DS.gray100};color:${DS.gray700};border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
              📋 Copiar link
            </button>
            <button id="btn-ver-landing" style="flex:1;padding:10px;background:${DS.green800};color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600">
              👁 Ver página
            </button>
          </div>
          <div id="msg-landing" style="margin-top:8px"></div>
        </div>

        <!-- Canjes -->
        <div class="s-card">
          <div class="s-section-label">Últimos premios entregados</div>
          ${filasCanjes}
        </div>

        <!-- Top clientes con niveles -->
        <div class="s-card">
          <div class="s-section-label">Clientes más frecuentes</div>
          ${filasClientes||`<p style="color:#aaa;font-size:13px;text-align:center;padding:8px 0">Aún no hay clientes</p>`}
        </div>
      </div>
      ${navBar('panel')}
    `
  } catch (e) {
    return `<div class="sello-topbar"><div class="sello-topbar-brand">Sello</div></div><div class="s-card">${errMsg('cargar tu panel')}</div>`
  }
}

export async function initDueno(negocioId) {
  inyectarEstilos(); initNav()

  // Gráficas
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    const { data: visitas } = await supabase.from('visitas').select('fecha').eq('negocio_id', negocio.id)
    const { data: clientes } = await supabase.from('clientes').select('total_visitas').eq('negocio_id', negocio.id)
    await renderizarGraficas(visitas, clientes)
  } catch (e) { /* opcional */ }

  // Exportar CSV
  document.getElementById('btn-exportar-csv')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-exportar-csv'); const msg = document.getElementById('msg-exportar')
    btn.textContent = 'Preparando...'; btn.disabled = true
    try {
      const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
      const { data: clientes } = await supabase.from('clientes').select('*').eq('negocio_id', negocio.id)
      const { data: nd } = await supabase.from('negocios').select('nombre').eq('id', negocio.id).single()
      exportarCSV(clientes, nd?.nombre || 'negocio')
      msg.innerHTML = `<div class="s-success">✓ Archivo descargado correctamente</div>`
      setTimeout(() => { msg.innerHTML = '' }, 3000)
    } catch (e) { msg.innerHTML = errMsg('descargar') }
    finally { btn.textContent = '⬇ Descargar clientes (.csv)'; btn.disabled = false }
  })

  // Landing pública
  document.getElementById('btn-copiar-landing')?.addEventListener('click', () => {
    const url = `${window.location.origin}/#/landing/${negocioId}`
    navigator.clipboard.writeText(url).then(() => {
      const msg = document.getElementById('msg-landing')
      msg.innerHTML = `<div class="s-success">✓ Link copiado al portapapeles</div>`
      setTimeout(() => { msg.innerHTML = '' }, 2000)
    })
  })
  document.getElementById('btn-ver-landing')?.addEventListener('click', () => {
    navigate('landing', negocioId)
  })

  // Premios
  document.getElementById('btn-nuevo-premio')?.addEventListener('click', () => {
    const f = document.getElementById('form-premio'); const open = f.style.display!=='none'
    if (!open) document.getElementById('nombre-premio').value = ''
    f.style.display = open?'none':'block'
  })
  document.getElementById('btn-guardar-premio')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-premio').value.trim()
    const visitas = parseInt(document.getElementById('visitas-premio').value)
    const msg = document.getElementById('msg-premio'); const btn = document.getElementById('btn-guardar-premio')
    if (!nombre||!visitas||visitas<1){msg.innerHTML=`<p class="s-error">Llena todos los campos correctamente</p>`;return}
    btn.disabled=true;btn.textContent='Guardando...'
    try {
      const{error}=await supabase.from('premios').insert({negocio_id:negocioId,nombre,puntos_requeridos:visitas,activo:true})
      if(error)throw error
      msg.innerHTML=`<div class="s-success">✓ Premio creado</div>`
      setTimeout(()=>navigate('dueno'),1000)
    } catch(e){msg.innerHTML=errMsg('guardar el premio');btn.disabled=false;btn.textContent='Guardar premio'}
  })
  document.querySelectorAll('.btn-toggle-premio').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      const act=btn.dataset.activo==='true'
      try{const{error}=await supabase.from('premios').update({activo:!act}).eq('id',btn.dataset.id);if(error)throw error;navigate('dueno')}
      catch(e){alert('Sin conexión.')}
    })
  })
  document.querySelectorAll('.btn-eliminar-premio').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      if(!confirm(`¿Eliminar el premio "${btn.dataset.nombre}"? Esta acción no se puede deshacer.`))return
      btn.disabled=true;btn.textContent='...'
      try{const{error}=await supabase.from('premios').delete().eq('id',btn.dataset.id);if(error)throw error;navigate('dueno')}
      catch(e){alert('Sin conexión.');btn.disabled=false;btn.textContent='🗑'}
    })
  })
}
