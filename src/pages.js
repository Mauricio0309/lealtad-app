import QRCode from 'qrcode'
import { isAuthRetryableFetchError, isAuthSessionMissingError, isAuthWeakPasswordError } from '@supabase/supabase-js'
import { supabase } from './supabase.js'
import { navigate, getPage } from './router.js'
import { getUsuarioIdLocal } from './auth.js'

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

function aplicarColorNegocio(color) {
  const c = color || DS.green800
  document.documentElement.style.setProperty('--negocio-color', c)
  // Texto que se lee SOBRE ese color (botones, sellos, avatar): blanco u oscuro.
  document.documentElement.style.setProperty('--negocio-texto', textoSobreColor(c))
  // El color usado COMO texto sobre blanco (números): el suyo, u oscuro si es muy claro.
  document.documentElement.style.setProperty('--negocio-tinta', tintaSobreBlanco(c))
}

// Para texto sobre fondo blanco: el color del negocio si contrasta 4.5:1; si
// es muy claro (color libre), casi negro.
function tintaSobreBlanco(hex) {
  return textoSobreColor(hex) === '#ffffff' ? hex : '#1c2b25'
}

// Blanco si contrasta al menos 4.5:1 con el color; si no, casi negro.
function textoSobreColor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''))
  if (!m) return '#ffffff'
  const canal = i => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  const lum = 0.2126 * canal(0) + 0.7152 * canal(2) + 0.0722 * canal(4)
  return 1.05 / (lum + 0.05) >= 4.5 ? '#ffffff' : '#1c2b25'
}

// ═══════════════════════════════════════════════════════════
// ESTILOS
// ═══════════════════════════════════════════════════════════
function inyectarEstilos() {
  if (document.getElementById('sello-styles')) return
  const s = document.createElement('style')
  s.id = 'sello-styles'
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #f1f7f4; color: ${DS.gray900}; -webkit-font-smoothing: antialiased; }

    .sello-topbar { background: var(--negocio-color, ${DS.green800}); padding: calc(16px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) 16px calc(20px + env(safe-area-inset-left)); display: flex; align-items: center; justify-content: space-between; }
    .sello-topbar-brand { display: flex; align-items: center; gap: 10px; font-family: 'Sora', sans-serif; font-weight: 800; font-size: 20px; color: var(--negocio-texto, ${DS.white}); letter-spacing: -0.02em; }
    .sello-topbar-brand .brand-name { color: var(--negocio-texto, ${DS.white}); }
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
    .s-btn.primary { background: var(--negocio-color, ${DS.green800}); color: var(--negocio-texto, ${DS.white}); }
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

    .s-nav { position: fixed; bottom: 0; left: 0; right: 0; background: ${DS.white}; border-top: 1px solid ${DS.gray100}; display: flex; box-shadow: 0 -2px 20px rgba(0,0,0,0.06); z-index: 100; padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
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


    .sc-search-area { padding: 16px 16px 8px; display: flex; flex-direction: column; gap: 8px; }
    .sc-search-row { display: flex; gap: 8px; }
    .sc-search-input { flex: 1; }
    .sc-search-btn { padding: 13px 16px; background: var(--negocio-color, ${DS.green800}); color: var(--negocio-texto, ${DS.white}); border: none; border-radius: 10px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; white-space: nowrap; }

    .s-chart-wrap { position: relative; height: 180px; margin-top: 8px; }
    .s-chart-wrap.donut { height: 200px; }



    .landing-root { min-height: 100vh; background: ${DS.gray50}; }
    .landing-hero { background: linear-gradient(145deg, ${DS.green900}, var(--negocio-color, ${DS.green800})); padding: calc(60px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) 80px calc(24px + env(safe-area-inset-left)); text-align: center; position: relative; }
    .landing-hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 40px; background: ${DS.gray50}; border-radius: 40px 40px 0 0; }
    .landing-nombre { font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800; color: ${DS.white}; margin-bottom: 8px; }
    .landing-tag { font-size: 14px; color: rgba(255,255,255,0.5); }
    .landing-premio { background: ${DS.white}; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 12px; }
    .landing-cta-btn { width: 100%; padding: 18px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 14px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; }

    .cj-main { padding: 20px 16px 8px; }
    .cj-cobre { width: 100%; min-height: 38vh; border: none; border-radius: 24px; background: var(--negocio-color, ${DS.green800}); color: var(--negocio-texto, ${DS.white}); font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 800; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s, opacity 0.15s; }
    .cj-cobre:active { transform: scale(0.98); }
    .cj-cobre:disabled { opacity: 0.6; cursor: wait; }
    .cj-cobre-icon { font-size: 56px; line-height: 1; }
    .cj-aviso { margin-top: 12px; border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.4; }
    .cj-aviso.aviso { background: ${DS.gold100}; border: 1px solid #fde68a; color: #92400e; }
    .cj-aviso.ok { background: ${DS.green100}; color: ${DS.green800}; }
    .cj-pend-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
    .cj-pend-head .s-section-label { margin-bottom: 0; }
    .cj-contador { font-size: 13px; font-weight: 600; color: ${DS.gray700}; }
    .cj-fila { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 0; background: none; border: none; border-bottom: 1px solid ${DS.gray100}; text-align: left; cursor: pointer; font-family: 'Inter', sans-serif; }
    .cj-fila:last-child { border-bottom: none; padding-bottom: 0; }
    .cj-fila .s-row-title, .cj-fila .s-row-sub { display: block; }
    .cj-fila-ver { font-size: 13px; font-weight: 600; color: var(--negocio-tinta, var(--negocio-color, ${DS.green800})); white-space: nowrap; }
    .cj-vacio { color: #aaa; font-size: 13px; text-align: center; padding: 8px 0; }
    .cj-qr { position: fixed; inset: 0; z-index: 200; background: ${DS.white}; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: calc(24px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left)); text-align: center; }
    .cj-qr[hidden] { display: none; }
    .cj-qr-titulo { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; color: ${DS.gray900}; }
    .cj-qr-sub { font-size: 15px; color: ${DS.gray500}; margin-top: 4px; }
    .cj-qr-tiempo-lbl { font-size: 12px; color: ${DS.gray500}; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 8px; }
    .cj-qr-tiempo { font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 800; color: ${DS.gray900}; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .cj-qr-botones { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 10px; }
    .cj-exito { position: fixed; inset: 0; z-index: 300; background: ${DS.green600}; color: ${DS.white}; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: calc(24px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left)); text-align: center; font-family: 'Sora', sans-serif; animation: sFadeIn 0.2s ease; }
    .cj-exito[hidden] { display: none; }
    .cj-exito.premio { background: linear-gradient(160deg, ${DS.gold400}, ${DS.gold500}); color: #422006; }
    .cj-exito-centro { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
    .cj-exito-icono { width: 112px; height: 112px; border-radius: 50%; background: rgba(255,255,255,0.22); display: flex; align-items: center; justify-content: center; font-size: 64px; line-height: 1; margin-bottom: 12px; animation: sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1); }
    .cj-exito-titulo { font-size: 36px; font-weight: 800; line-height: 1.1; }
    .cj-exito-quien { font-size: 28px; font-weight: 800; line-height: 1.2; }
    .cj-exito-texto { font-size: 20px; font-weight: 600; opacity: 0.9; }
    .cj-exito-puntos { font-size: 56px; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; margin-top: 8px; }
    .cj-exito-listo { width: 100%; max-width: 420px; height: 72px; border: none; border-radius: 20px; background: ${DS.white}; color: ${DS.green800}; font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .cj-exito-listo:active { transform: scale(0.98); }
    .cj-manual-acceso { text-align: center; padding: 4px 16px 8px; }
    .cj-manual-enlace { min-height: 44px; padding: 8px 12px; background: none; border: none; font-family: 'Inter', sans-serif; font-size: 13px; color: ${DS.gray500}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .cj-manual { position: fixed; inset: 0; z-index: 250; background: ${DS.white}; overflow-y: auto; padding: calc(24px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
    .cj-manual[hidden] { display: none; }
    .cj-manual-caja { max-width: 420px; margin: 0 auto; }
    .cj-manual .cl-btn { margin-top: 0; }
    .cj-exito.premio .cj-exito-listo { color: #78350f; }
    .cj-canjear { width: 100%; height: 72px; margin-top: 12px; border: 2px solid var(--negocio-color, ${DS.green800}); border-radius: 20px; background: ${DS.white}; color: var(--negocio-tinta, var(--negocio-color, ${DS.green800})); font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s; }
    .cj-canjear:active { transform: scale(0.98); }
    .cj-canje { position: fixed; inset: 0; z-index: 250; background: ${DS.white}; overflow-y: auto; display: flex; padding: calc(24px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
    .cj-canje[hidden] { display: none; }
    .cj-canje-caja { width: 100%; max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; text-align: center; }
    .cj-canje-casillas { display: flex; justify-content: center; gap: 12px; margin: 24px 0 12px; }
    .cj-canje-casilla { width: 64px; height: 80px; border: 2px solid ${DS.gray300}; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 800; color: ${DS.gray900}; font-variant-numeric: tabular-nums; }
    .cj-canje-casilla.llena { border-color: var(--negocio-color, ${DS.green800}); }
    .cj-canje-casillas.error .cj-canje-casilla { border-color: #dc2626; }
    .cj-canje-casillas.sacudir { animation: cjSacudir 0.35s ease; }
    .cj-canje-msg { min-height: 48px; font-size: 16px; line-height: 1.4; color: ${DS.gray700}; }
    .cj-canje-msg.error { color: #b91c1c; font-weight: 600; }
    .cj-teclado { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: auto; padding-top: 12px; }
    .cj-tecla { height: 68px; border: none; border-radius: 16px; background: ${DS.gray100}; color: ${DS.gray900}; font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 700; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .cj-tecla:active { background: ${DS.gray300}; }
    .cj-tecla:disabled { opacity: 0.4; cursor: not-allowed; }
    .cj-tecla.vacia { visibility: hidden; }
    .cj-canje-pie { margin-top: 12px; }
    .cj-canje-ficha { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 6px; padding: 16px 0; }
    .cj-canje-premio-lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${DS.gray500}; }
    .cj-canje-premio { font-family: 'Sora', sans-serif; font-size: 32px; font-weight: 800; line-height: 1.15; color: ${DS.gray900}; }
    .cj-canje-quien { font-family: 'Sora', sans-serif; font-size: 34px; font-weight: 800; line-height: 1.15; color: ${DS.gray900}; margin-top: 24px; }
    .cj-canje-tel { font-family: 'Sora', sans-serif; font-size: 34px; font-weight: 800; color: ${DS.gray700}; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .cj-canje-alerta { margin-top: 24px; border-radius: 14px; padding: 14px 16px; background: ${DS.gold100}; border: 1px solid #fde68a; color: #92400e; font-size: 17px; font-weight: 700; }
    .cj-canje-confirmar { width: 100%; height: 72px; border: none; border-radius: 20px; background: ${DS.green600}; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
    .cj-canje-confirmar:active { transform: scale(0.98); }
    .cj-canje-confirmar:disabled { opacity: 0.6; cursor: wait; }
    @keyframes cjSacudir { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }

    .cl-root { min-height: 100vh; background: ${DS.white}; color: ${DS.gray900}; font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .cl-root.gris { background: #F5F6F8; }
    .cl-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding: calc(16px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); }
    /* 4E: identidad del negocio al frente; Sello pequeño arriba y pie discreto. */
    .cl-sello-top { display: flex; align-items: center; gap: 6px; min-height: 20px; font-size: 12px; font-weight: 600; color: #94a3b8; }
    .cl-marca { display: flex; align-items: center; gap: 12px; margin-top: 14px; min-width: 0; }
    .cl-marca-texto { min-width: 0; }
    .cl-marca-nombre { display: block; font-size: 17px; font-weight: 700; line-height: 1.25; color: ${DS.gray900}; overflow-wrap: anywhere; }
    .cl-marca-mensaje { display: block; font-size: 15px; line-height: 1.35; color: ${DS.gray500}; margin-top: 2px; overflow-wrap: anywhere; }
    .cl-marca.grande { gap: 16px; margin-top: 18px; }
    .cl-marca.grande .cl-marca-nombre { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
    .cl-avatar { position: relative; flex-shrink: 0; width: 40px; height: 40px; border-radius: 50%; background: var(--negocio-color, #2B4ACB); color: var(--negocio-texto, ${DS.white}); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; overflow: hidden; }
    .cl-marca.grande .cl-avatar { width: 76px; height: 76px; font-size: 34px; }
    .cl-avatar.con-logo { border-radius: 22%; background: ${DS.white}; box-shadow: inset 0 0 0 1px rgba(15,23,42,0.08); }
    .cl-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: ${DS.white}; }
    .cl-pie-sello { text-align: center; font-size: 12px; color: #94a3b8; margin-top: 20px; }
    .cl-cuerpo { flex: 1; display: flex; flex-direction: column; justify-content: center; padding: 32px 0 24px; }
    .cl-cuerpo.arriba { justify-content: flex-start; padding-top: 24px; }
    .cl-acciones { display: flex; flex-direction: column; }
    .cl-cargando { text-align: center; font-size: 16px; color: ${DS.gray500}; }
    .cl-titulo { font-size: 40px; font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; color: ${DS.gray900}; }
    .cl-sub { font-size: 18px; line-height: 1.4; color: ${DS.gray500}; margin-top: 10px; }
    .cl-digitos { font-weight: 700; color: ${DS.gray900}; font-variant-numeric: tabular-nums; letter-spacing: 0.04em; }
    .cl-campo { margin-top: 20px; }
    .cl-label { display: block; font-size: 15px; font-weight: 600; color: ${DS.gray700}; margin-bottom: 8px; }
    .cl-input-wrap { display: flex; align-items: center; height: 60px; padding: 0 16px; border: 2px solid ${DS.gray300}; border-radius: 16px; background: ${DS.white}; transition: border-color 0.15s; }
    .cl-input-wrap:focus-within { border-color: var(--negocio-color, #2B4ACB); }
    .cl-input-wrap.error { border-color: #dc2626; }
    .cl-prefijo { font-size: 22px; font-weight: 600; color: ${DS.gray500}; padding-right: 12px; margin-right: 12px; border-right: 1.5px solid ${DS.gray100}; }
    .cl-input { flex: 1; min-width: 0; height: 100%; border: none; outline: none; background: transparent; font-family: inherit; font-size: 22px; color: ${DS.gray900}; }
    .cl-input::placeholder { color: ${DS.gray300}; }
    .cl-error-campo { color: #dc2626; font-size: 15px; margin-top: 6px; }
    .cl-aviso { margin-bottom: 14px; border-radius: 16px; padding: 14px 16px; font-size: 16px; line-height: 1.4; background: #fef2f2; color: #b91c1c; }
    .cl-btn { width: 100%; height: 62px; border: none; border-radius: 20px; background: var(--negocio-color, #2B4ACB); color: var(--negocio-texto, ${DS.white}); font-family: inherit; font-size: 20px; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s, opacity 0.15s; }
    .cl-btn:active { transform: scale(0.98); }
    .cl-btn:disabled { opacity: 0.6; cursor: wait; }
    .cl-btn.secundario { background: ${DS.gray100}; color: ${DS.gray900}; }
    .cl-cuerpo .cl-btn { margin-top: 28px; }
    .cl-enlace { width: 100%; min-height: 48px; margin-top: 8px; background: none; border: none; font-family: inherit; font-size: 17px; font-weight: 600; color: ${DS.gray500}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .cl-privacidad { font-size: 14px; line-height: 1.5; color: ${DS.gray500}; text-align: center; margin-top: 16px; }
    .cl-privacidad button { background: none; border: none; font: inherit; color: ${DS.gray700}; text-decoration: underline; padding: 12px 4px; margin: -12px -4px; cursor: pointer; }
    .cl-estado-icono { width: 72px; height: 72px; border-radius: 50%; background: ${DS.gray100}; display: flex; align-items: center; justify-content: center; font-size: 34px; margin-bottom: 24px; }
    .cl-exito-icono { width: 72px; height: 72px; border-radius: 50%; background: var(--negocio-color, #2B4ACB); color: var(--negocio-texto, #ffffff); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; animation: sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1); }
    .cl-listo { margin-top: 20px; border-radius: 20px; padding: 18px; background: ${DS.gold100}; border: 2px solid #fde68a; color: #78350f; font-size: 18px; font-weight: 800; line-height: 1.35; text-align: center; }
    .cl-tarjeta { background: ${DS.white}; border-radius: 24px; padding: 24px 20px; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04); }
    .cl-progreso { display: flex; align-items: baseline; justify-content: center; gap: 8px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .cl-progreso-num { font-size: 64px; line-height: 1; color: var(--negocio-tinta, var(--negocio-color, #2B4ACB)); }
    .cl-progreso-meta { font-size: 32px; color: ${DS.gray300}; }
    .cl-progreso-lbl { text-align: center; font-size: 15px; color: ${DS.gray500}; margin-top: 6px; }
    .cl-sellos { display: grid; gap: 10px; justify-items: center; margin-top: 22px; }
    .cl-sello { width: 100%; max-width: 52px; aspect-ratio: 1; border-radius: 50%; border: 2px dashed ${DS.gray300}; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .cl-sello.lleno { border: none; background: var(--negocio-color, #2B4ACB); color: var(--negocio-texto, #ffffff); }
    .cl-sello.nuevo { animation: clSelloNuevo 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.4s both; }
    .cl-sello.nuevo svg { animation: sPopIn 0.3s ease-out 0.9s both; }
    @keyframes clSelloNuevo {
      0% { background-color: transparent; box-shadow: inset 0 0 0 2px ${DS.gray300}; transform: scale(0.85); }
      60% { transform: scale(1.12); }
      100% { background-color: var(--negocio-color, #2B4ACB); box-shadow: inset 0 0 0 0 transparent; transform: scale(1); }
    }
    @media (prefers-reduced-motion: reduce) {
      .cl-sello.nuevo, .cl-sello.nuevo svg, .cl-exito-icono, .cj-canje-casillas.sacudir { animation: none; }
    }
    .cl-cuerpo .cl-btn.cl-canjear-btn { margin-top: 14px; height: 68px; font-size: 22px; }
    .cl-exito-icono.emoji { font-size: 36px; line-height: 1; }
    .cl-canje-lbl { text-align: center; font-size: 15px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${DS.gray500}; }
    .cl-canje-codigo { text-align: center; font-size: clamp(64px, 24vw, 104px); font-weight: 800; line-height: 1; letter-spacing: 0.12em; padding-left: 0.12em; color: ${DS.gray900}; font-variant-numeric: tabular-nums; margin-top: 10px; }
    .cl-canje-tiempo { text-align: center; font-size: 24px; font-weight: 700; color: ${DS.gray700}; font-variant-numeric: tabular-nums; margin-top: 16px; }
    .cl-canje-tiempo.poco { color: #b91c1c; }
    .cl-canje-instr { text-align: center; font-size: 26px; font-weight: 800; line-height: 1.2; color: ${DS.gray900}; margin-top: 28px; }
    .cl-canje-premio { text-align: center; font-size: 17px; line-height: 1.4; color: ${DS.gray500}; margin-top: 6px; }
    .cl-premio { background: ${DS.white}; border-radius: 24px; padding: 20px; margin-top: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .cl-premio-lbl { font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: ${DS.gray500}; }
    .cl-premio-nombre { font-size: 22px; font-weight: 800; line-height: 1.25; margin-top: 6px; color: ${DS.gray900}; }
    .cl-premio-falta { font-size: 16px; color: ${DS.gray500}; margin-top: 4px; }

    /* Ajuste visual del cliente: solo dentro de .cl-root (la captura manual
       del mesero usa las mismas clases y no cambia).
       Botones y campos ~15 % más chicos y un poco más de aire entre bloques. */
    .cl-root .cl-cuerpo { padding: 36px 0 28px; }
    .cl-root .cl-cuerpo.arriba { padding-top: 28px; }
    .cl-root .cl-sub { margin-top: 12px; }
    .cl-root .cl-campo { margin-top: 24px; }
    .cl-root .cl-label { font-size: 14px; margin-bottom: 8px; }
    .cl-root .cl-input-wrap { height: 51px; padding: 0 14px; border-radius: 14px; }
    .cl-root .cl-input { font-size: 19px; }
    .cl-root .cl-prefijo { font-size: 19px; padding-right: 10px; margin-right: 10px; }
    .cl-root .cl-error-campo { font-size: 14px; }
    .cl-root .cl-btn { height: 53px; border-radius: 17px; font-size: 17px; }
    .cl-root .cl-cuerpo .cl-btn.cl-canjear-btn { height: 58px; font-size: 19px; margin-top: 16px; }
    .cl-root .cl-enlace { min-height: 44px; margin-top: 10px; font-size: 15px; }
    .cl-root .cl-aviso { font-size: 15px; margin-bottom: 16px; }
    .cl-root .cl-listo { margin-top: 24px; }
    .cl-root .cl-premio { margin-top: 18px; }
    .cl-root .cl-privacidad { margin-top: 22px; }
    /* "¡Ganaste 1 punto!" y "¡Disfruta tu premio!" (la celebración) se quedan grandes. */
    .cl-root.celebra .cl-btn { height: 62px; border-radius: 20px; font-size: 20px; }
    .cl-root.celebra .cl-cuerpo .cl-btn.cl-canjear-btn { height: 68px; font-size: 22px; margin-top: 14px; }
    /* Tarjeta de progreso: un tono muy suave del color del negocio (9 % sobre
       blanco). Los textos de adentro usan grises más oscuros para leerse bien. */
    .cl-root .cl-tarjeta { margin-top: 28px; background: ${DS.white}; background: color-mix(in srgb, var(--negocio-color, #2B4ACB) 9%, ${DS.white}); }
    .cl-root .cl-progreso-meta { color: ${DS.gray500}; }
    .cl-root .cl-progreso-lbl { color: ${DS.gray700}; }
    .cl-pie-sello a { color: inherit; text-decoration: none; }
    .cl-pie-sello a:hover, .cl-pie-sello a:focus-visible { text-decoration: underline; text-underline-offset: 3px; }

    @keyframes sFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes sPopIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }
  `
  document.head.appendChild(s)
}

// ═══════════════════════════════════════════════════════════
// ESTILOS DEL DUEÑO (login, bienvenida, panel, personalización, términos)
// Ordenado y claro, con calidez: fondo con un tinte suave del verde de Sello,
// tarjetas blancas con borde fino y color con significado:
//   verde  = lo positivo (▲, regresaron, premios)
//   ámbar  = lo que requiere atención (dejaron de venir, alerta de mesero)
//   color del negocio = botones y detalles del panel (verde de Sello si no hay).
// Login, bienvenida y términos usan siempre el verde de Sello (.ow-sello).
// Todo va dentro de .ow para no cambiar las pantallas del mesero ni del cliente.
// html.ow-pagina pinta el fondo de la página mientras se dibuja una pantalla
// del dueño, para que nunca se vea blanco entre una y otra.
// ═══════════════════════════════════════════════════════════
const VERDE_SELLO = '#0a5c47'

function inyectarEstilosDueno() {
  inyectarEstilos()
  document.documentElement.classList.add('ow-pagina')
  if (document.getElementById('sello-styles-dueno')) return
  const s = document.createElement('style')
  s.id = 'sello-styles-dueno'
  s.textContent = `
    html.ow-pagina, html.ow-pagina body { background: #f1f7f4; }
    .ow, .ow-hoja-fondo, .ow-lg-fondo {
      --ow-fondo: #f1f7f4; --ow-superficie: #ffffff; --ow-borde: #dbe8e1;
      --ow-texto: #1c2b25; --ow-texto-2: #4d5f57; --ow-texto-3: #7b8a83;
      --ow-sello: ${VERDE_SELLO}; --ow-sello-suave: #e2f1ea;
      --ow-acento: var(--negocio-color, ${VERDE_SELLO});
      --ow-acento-texto: var(--negocio-texto, #ffffff);
      /* Colores con significado: verde = crecimiento, ámbar = oportunidad,
         gris azulado = información. Nunca rojo para malas noticias. */
      --ow-ok: #0d7a5f; --ow-ok-suave: #e3f3ec;
      --ow-atencion: #a45a06; --ow-atencion-suave: #fdf3e1; --ow-atencion-borde: #f3d9a8;
      --ow-info: #475b70; --ow-info-suave: #eef2f6; --ow-info-borde: #d6dee8;
      --ow-mal: #8f4d05;
      color: var(--ow-texto); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased;
    }
    .ow { min-height: 100vh; background: var(--ow-fondo); }
    .ow.ow-sello { --ow-acento: var(--ow-sello); --ow-acento-texto: #ffffff; }
    .ow *:focus-visible { outline: 2px solid var(--ow-acento); outline-offset: 2px; }

    .ow-logo { display: inline-flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 800; letter-spacing: -0.01em; color: var(--ow-sello); }
    .ow-logo svg { flex-shrink: 0; }
    .ow-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(14px + env(safe-area-inset-top)) calc(20px + env(safe-area-inset-right)) 14px calc(20px + env(safe-area-inset-left)); background: var(--ow-superficie); border-bottom: 1px solid var(--ow-borde); }
    .ow-cab-negocio { font-size: 14px; font-weight: 500; color: var(--ow-texto-2); max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ow-cuerpo { max-width: 640px; margin: 0 auto; padding: 12px calc(16px + env(safe-area-inset-right)) calc(96px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); }

    .ow-tabs { display: flex; gap: 6px; padding: 4px; margin: 4px 0 20px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; }
    .ow-tab { flex: 1; min-height: 42px; padding: 8px 10px; background: none; border: none; border-radius: 9px; font: inherit; font-size: 15px; font-weight: 600; color: var(--ow-texto-2); cursor: pointer; transition: background 0.15s, color 0.15s; }
    .ow-tab[aria-selected="true"] { background: var(--ow-acento); color: var(--ow-acento-texto); }
    .ow [role="tabpanel"][hidden] { display: none; }

    .ow-tarjeta { background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; padding: 20px; margin-bottom: 16px; }
    .ow-titulo-sec { font-size: 15px; font-weight: 700; margin-bottom: 14px; }
    .ow-seccion { margin-bottom: 28px; }
    .ow-seccion-titulo { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    .ow-seccion-sub { font-size: 14px; color: var(--ow-texto-2); margin: 2px 0 12px; }
    .ow-seccion .ow-tarjeta { margin-bottom: 0; }
    .ow-h1 { font-size: 24px; font-weight: 700; letter-spacing: -0.015em; line-height: 1.25; }
    .ow-h2 { font-size: 18px; font-weight: 700; line-height: 1.3; }
    .ow-sub { font-size: 15px; color: var(--ow-texto-2); margin-top: 6px; }
    .ow-nota { color: var(--ow-texto-3); font-weight: 400; }
    .ow-ayuda { font-size: 13px; color: var(--ow-texto-2); margin-top: 6px; }

    /* Tarjeta principal del Resumen: verde Sello sólido, texto blanco. */
    .ow-principal { background: #0F7B5A; border-color: #0F7B5A; color: #ffffff; padding: 22px 20px; }
    .ow-principal-lbl { font-size: 15px; font-weight: 500; color: #ffffff; }
    .ow-principal-num { font-size: 52px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; font-variant-numeric: tabular-nums; color: #ffffff; margin: 2px 0 8px; }
    .ow-principal-sub { font-size: 16px; font-weight: 600; color: #ffffff; }
    .ow-principal-sub .ow-nota { color: rgba(255,255,255,0.85); font-weight: 500; }
    .ow-principal-desde { margin-top: 4px; font-size: 13px; color: #ffffff; opacity: 0.85; }
    .ow-principal .ow-enlace { color: #ffffff; }
    .ow-principal .ow-enlace:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
    /* Fila de Logros bajo la tarjeta principal (dorado solo en medallas y barra). */
    .ow-lgfila { display: flex; align-items: center; gap: 14px; width: 100%; margin-bottom: 16px; padding: 14px 16px; background: var(--ow-superficie); border: 1px solid #EFE6CC; border-radius: 12px; font: inherit; color: var(--ow-texto); text-align: left; cursor: pointer; }
    .ow-lgfila:focus-visible { outline: 3px solid #0F7B5A; outline-offset: 2px; }
    .ow-medallas { display: flex; flex-shrink: 0; padding-left: 8px; }
    .ow-medalla { width: 30px; height: 30px; margin-left: -8px; border-radius: 50%; background: #F6EED6; border: 2px solid #B8902F; box-shadow: 0 0 0 2px var(--ow-superficie); color: #7A5C12; font-size: 11px; font-weight: 800; line-height: 1; display: flex; align-items: center; justify-content: center; font-variant-numeric: tabular-nums; }
    .ow-lgfila-centro { flex: 1; min-width: 0; }
    .ow-lgfila-linea { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
    .ow-lgfila-titulo { font-size: 15px; font-weight: 600; }
    .ow-lgfila-falta { flex-shrink: 0; font-size: 13px; font-weight: 600; color: #6B5A2E; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .ow-lgfila-barra { display: block; margin-top: 8px; height: 6px; border-radius: 3px; background: #DDE5E0; overflow: hidden; }
    .ow-lgfila-barra span { display: block; height: 100%; border-radius: 3px; background: #B8902F; }
    .ow-lgfila-flecha { flex-shrink: 0; font-size: 24px; line-height: 1; color: #9aa59f; }
    .ow-primer { display: block; margin-top: 8px; font-size: 12px; color: #6B7670; }
    /* Gráfica "Clientes en tu programa" */
    .ow-gc-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .ow-gc-sub { margin-top: 2px; font-size: 13px; color: var(--ow-texto-2); }
    .ow-gc-total { flex-shrink: 0; font-size: 32px; font-weight: 800; line-height: 1; letter-spacing: -0.02em; color: #2563EB; font-variant-numeric: tabular-nums; }
    .ow-gc-chips { display: flex; gap: 2px; margin: 6px 0 6px -2px; }
    .ow-gc-chip { min-height: 44px; padding: 0 2px; border: none; background: none; font: inherit; cursor: pointer; }
    .ow-gc-chip span { display: inline-flex; align-items: center; min-height: 32px; padding: 0 12px; border-radius: 999px; font-size: 14px; font-weight: 600; color: var(--ow-texto-2); }
    .ow-gc-chip[aria-pressed="true"] span { background: #E8EFFD; color: #1E4FC2; }
    .ow-gc-chip:focus-visible { outline: none; }
    .ow-gc-chip:focus-visible span { outline: 2px solid #1E4FC2; outline-offset: 2px; }
    .ow-gc-svg { display: block; width: 100%; height: auto; }
    .ow-gc-fechas { display: flex; justify-content: space-between; margin-top: 6px; font-size: 12px; color: var(--ow-texto-3); }
    .ow-gc-esq { height: 140px; margin: 0; }

    .ow-cifras { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; margin-bottom: 16px; }
    .ow-cifras.dos { grid-template-columns: repeat(2, 1fr); }
    .ow-cifra { min-width: 0; padding: 18px 14px; border-left: 1px solid var(--ow-borde); }
    .ow-cifra:first-child { border-left: none; }
    .ow-cifra-num { font-size: 28px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .ow-cifra-num.positivo { color: var(--ow-ok); }
    .ow-cifra-de { font-size: 13px; font-weight: 500; color: var(--ow-texto-3); letter-spacing: 0; }
    .ow-cifra-lbl { font-size: 13px; line-height: 1.3; color: var(--ow-texto-2); margin-top: 6px; }
    .ow-cambio { display: inline-block; font-size: 12px; font-weight: 600; margin-top: 8px; color: var(--ow-texto-3); font-variant-numeric: tabular-nums; }
    .ow-cambio.sube { color: var(--ow-ok); }
    .ow-cambio.baja { color: var(--ow-texto-3); }  /* nunca rojo ni alarma */

    .ow-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin-bottom: 16px; padding: 18px 20px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .ow-fila:disabled { cursor: default; }
    .ow-fila.atencion { background: var(--ow-atencion-suave); border-color: var(--ow-atencion-borde); }
    .ow-fila.atencion .ow-fila-num, .ow-fila.atencion .ow-fila-ver { color: var(--ow-atencion); }
    .ow-fila-titulo { display: block; font-weight: 700; }
    .ow-fila-sub { display: block; font-size: 13px; color: var(--ow-texto-2); margin-top: 2px; }
    .ow-fila-der { display: flex; align-items: baseline; gap: 10px; flex-shrink: 0; }
    .ow-fila-num { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .ow-fila-ver { font-size: 14px; font-weight: 600; color: var(--ow-texto-2); }

    .ow-tabla-wrap { overflow-x: auto; }
    .ow-tabla { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
    .ow-tabla th { padding: 0 0 10px 12px; border-bottom: 1px solid var(--ow-borde); font-size: 12px; font-weight: 600; color: var(--ow-texto-2); text-align: right; white-space: nowrap; }
    .ow-tabla td { padding: 12px 0 12px 12px; border-bottom: 1px solid var(--ow-borde); text-align: right; vertical-align: top; }
    .ow-tabla th:first-child, .ow-tabla td:first-child { padding-left: 0; text-align: left; }
    .ow-tabla tbody tr:last-child td { border-bottom: none; padding-bottom: 0; }
    .ow-persona { font-weight: 600; }
    .ow-revisar { display: inline-block; margin-top: 6px; padding: 2px 8px; border-radius: 6px; background: var(--ow-atencion-suave); border: 1px solid var(--ow-atencion-borde); font-size: 12px; font-weight: 600; color: var(--ow-atencion); text-align: left; }

    .ow-vacio { padding: 14px 16px; border-radius: 10px; background: var(--ow-info-suave); font-size: 14px; color: var(--ow-info); }
    .ow-vacio-tarjeta { background: var(--ow-sello-suave); border-color: #c7e3d6; }
    .ow-pasos { list-style: none; display: flex; flex-direction: column; gap: 16px; margin: 18px 0 20px; }
    .ow-pasos li { display: flex; gap: 12px; }
    .ow-paso-num { flex-shrink: 0; width: 26px; height: 26px; border-radius: 50%; background: var(--ow-sello); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: #ffffff; }
    .ow-paso-titulo { font-weight: 700; }
    .ow-paso-desc { display: block; font-size: 14px; color: var(--ow-texto-2); }

    .ow-btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 46px; padding: 10px 16px; border: 1px solid transparent; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: filter 0.15s, background 0.15s; }
    .ow-btn.primario { background: var(--ow-acento); color: var(--ow-acento-texto); }
    .ow-btn.primario:hover { filter: brightness(1.08); }
    .ow-btn.secundario { background: var(--ow-superficie); color: var(--ow-texto); border-color: var(--ow-borde); }
    .ow-btn.secundario:hover { background: var(--ow-fondo); }
    .ow-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .ow-btn.chico { width: auto; min-height: 36px; padding: 6px 12px; font-size: 14px; }
    .ow-btn + .ow-btn { margin-top: 10px; }
    .ow-botones { display: flex; gap: 10px; }
    .ow-botones .ow-btn + .ow-btn { margin-top: 0; }
    .ow-enlace { display: inline-block; min-height: 40px; padding: 8px 0; background: none; border: none; font: inherit; font-size: 14px; font-weight: 500; color: var(--ow-texto-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; text-align: left; }

    .ow-campo { margin-bottom: 18px; }
    .ow-campo:last-of-type { margin-bottom: 20px; }
    .ow-label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 6px; }
    .ow-input { width: 100%; height: 46px; padding: 0 12px; border: 1px solid var(--ow-borde); border-radius: 10px; background: #ffffff; font: inherit; font-size: 16px; color: var(--ow-texto); outline: none; transition: border-color 0.15s, box-shadow 0.15s; }
    .ow-input:focus { border-color: var(--ow-acento); box-shadow: 0 0 0 3px var(--ow-sello-suave); }
    .ow-input::placeholder { color: #a9b6b0; }
    .ow-pesos { position: relative; }
    .ow-pesos span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ow-texto-3); }
    .ow-pesos .ow-input { padding-left: 26px; }
    .ow-clave { position: relative; }
    .ow-clave .ow-input { padding-right: 84px; }
    .ow-clave button { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); min-height: 32px; padding: 4px 10px; background: none; border: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--ow-sello); cursor: pointer; }
    .ow-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .ow-chip { min-height: 32px; padding: 4px 10px; border: 1px solid var(--ow-borde); border-radius: 8px; background: var(--ow-fondo); font: inherit; font-size: 13px; color: var(--ow-texto-2); cursor: pointer; }
    .ow-chip:hover { border-color: var(--ow-acento); color: var(--ow-texto); }
    .ow-agregar { display: flex; gap: 8px; }
    .ow-agregar .ow-input { flex: 1; min-width: 0; }
    .ow-agregar .ow-btn { width: auto; }
    .ow-lista-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-lista-fila:last-child { border-bottom: none; }
    .ow-url { padding: 10px 12px; border: 1px solid var(--ow-borde); border-radius: 10px; background: var(--ow-fondo); font-size: 13px; color: var(--ow-texto-2); word-break: break-all; margin-bottom: 12px; }
    .ow-separador { height: 1px; background: var(--ow-borde); margin: 20px 0; }

    .ow-msg-ok { margin-top: 10px; font-size: 14px; font-weight: 500; color: var(--ow-ok); }
    .ow-msg-error { margin-top: 10px; font-size: 14px; color: var(--ow-mal); }
    .ow .s-error { margin-top: 10px; font-size: 14px; color: var(--ow-mal); }
    .ow .s-success { display: block; margin-top: 10px; padding: 0; background: none; font-size: 14px; font-weight: 500; color: var(--ow-ok); }

    .ow-colores { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
    .ow-color { width: 38px; height: 38px; padding: 0; border: 3px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 1px var(--ow-borde); cursor: pointer; }
    .ow-color[aria-checked="true"] { box-shadow: 0 0 0 2px var(--ow-texto); }
    .ow-color-libre { display: flex; align-items: center; gap: 10px; margin: -6px 0 6px; }
    .ow-color-libre input[type="color"] { -webkit-appearance: none; appearance: none; flex-shrink: 0; width: 38px; height: 38px; padding: 0; border: 3px solid #ffffff; border-radius: 50%; background: none; box-shadow: 0 0 0 1px var(--ow-borde); cursor: pointer; }
    .ow-color-libre input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
    .ow-color-libre input[type="color"]::-webkit-color-swatch { border: none; border-radius: 50%; }
    .ow-color-libre input[type="color"]::-moz-color-swatch { border: none; border-radius: 50%; }
    .ow-color-libre input[type="color"].activo { box-shadow: 0 0 0 2px var(--ow-texto); }
    .ow-color-libre input[type="color"]:focus-visible { outline: 2px solid var(--ow-texto); outline-offset: 3px; }
    .ow-color-libre .ow-label { margin: 0; }
    .ow-vista { padding: 16px; border: 1px solid var(--ow-borde); border-radius: 12px; background: #f5f6f8; margin-bottom: 20px; }
    .ow-vista-sellotop { display: flex; align-items: center; gap: 4px; font-size: 10px; font-weight: 600; color: #94a3b8; }
    .ow-vista-marca { display: flex; align-items: center; gap: 10px; margin-top: 10px; }
    .ow-vista-nombre { display: block; font-size: 16px; font-weight: 800; line-height: 1.25; overflow-wrap: anywhere; }
    .ow-vista-mensaje { display: block; font-size: 13px; color: var(--ow-texto-2); overflow-wrap: anywhere; }
    .ow-vista-avatar { position: relative; flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%; background: var(--vista-color); color: var(--vista-texto, #ffffff); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; overflow: hidden; }
    .ow-vista-avatar.con-logo { border-radius: 22%; background: #ffffff; box-shadow: inset 0 0 0 1px rgba(15,23,42,0.08); }
    .ow-vista-avatar img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #ffffff; }
    .ow-vista-pie { text-align: center; font-size: 10px; color: #94a3b8; margin-top: 10px; }
    .ow-logo-fila { display: flex; align-items: center; gap: 14px; }
    .ow-logo-fila .ow-vista-avatar { width: 64px; height: 64px; font-size: 26px; }
    .ow-logo-acciones { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; }
    .ow-logo-acciones .ow-enlace { min-height: 36px; padding: 6px 0; }
    .ow-cuenta { float: right; font-weight: 500; color: var(--ow-texto-3); font-variant-numeric: tabular-nums; }
    .ow-vista-saludo { font-size: 18px; font-weight: 700; margin-top: 12px; }
    .ow-vista-tarjeta { margin-top: 10px; padding: 16px; border-radius: 12px; background: #ffffff; text-align: center; }
    .ow-vista-num { font-size: 34px; font-weight: 800; color: var(--vista-tinta, var(--vista-color)); font-variant-numeric: tabular-nums; }
    .ow-vista-meta { font-size: 18px; font-weight: 700; color: #cbd5e1; }
    .ow-vista-sellos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; justify-items: center; margin-top: 12px; }
    .ow-vista-sello { width: 100%; max-width: 30px; aspect-ratio: 1; border: 1.5px dashed #cbd5e1; border-radius: 50%; }
    .ow-vista-sello.lleno { border: none; background: var(--vista-color); }
    .ow-vista-premio { margin-top: 10px; padding: 12px 16px; border-radius: 12px; background: #ffffff; font-size: 14px; font-weight: 600; }
    .ow-vista-premio span { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--ow-texto-3); }

    .ow-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; background: var(--ow-superficie); border-top: 1px solid var(--ow-borde); padding: 0 env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
    .ow-nav button { position: relative; flex: 1; min-height: 54px; background: none; border: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--ow-texto-3); cursor: pointer; }
    .ow-nav button[aria-current="page"] { color: var(--ow-acento); }
    .ow-nav button[aria-current="page"]::before { content: ''; position: absolute; top: -1px; left: 30%; right: 30%; height: 3px; border-radius: 0 0 3px 3px; background: var(--ow-acento); }

    .ow-hoja-fondo { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: flex-end; justify-content: center; background: rgba(16,32,26,0.4); }
    .ow-hoja { width: 100%; max-width: 560px; max-height: 80vh; overflow-y: auto; padding: 20px calc(20px + env(safe-area-inset-right)) calc(28px + env(safe-area-inset-bottom)) calc(20px + env(safe-area-inset-left)); background: #ffffff; border-radius: 14px 14px 0 0; }
    .ow-hoja-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    @media (min-width: 600px) { .ow-hoja-fondo { align-items: center; } .ow-hoja { border-radius: 14px; } }

    .ow-esq { background: #dfece6; border-radius: 12px; animation: owPulso 1.6s ease-in-out infinite; }
    @keyframes owPulso { 50% { opacity: 0.6; } }

    .ow-centro { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: calc(28px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(28px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); }
    .ow-caja { width: 100%; max-width: 400px; padding: 28px 24px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 14px; }
    .ow-caja-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .ow-legal { max-width: 400px; margin-top: 18px; font-size: 13px; color: var(--ow-texto-3); text-align: center; }
    .ow-legal a { color: var(--ow-sello); font-weight: 500; text-underline-offset: 3px; }
    .ow-progreso { display: flex; gap: 6px; margin-bottom: 10px; }
    .ow-progreso span { flex: 1; height: 4px; border-radius: 2px; background: var(--ow-sello-suave); }
    .ow-progreso span.hecho { background: var(--ow-sello); }
    .ow-paso-de { font-size: 13px; font-weight: 600; color: var(--ow-sello); margin-bottom: 6px; }
    .ow-paso-cambio { transition: opacity 0.15s ease; }
    .ow-paso-cambio.saliendo { opacity: 0; }
    .ow-texto-legal h2 { font-size: 15px; font-weight: 700; margin: 22px 0 6px; }
    .ow-texto-legal p { font-size: 14px; color: var(--ow-texto-2); }

    .ow-tabs .ow-tab { flex: 1 1 auto; padding: 8px 6px; font-size: 14px; white-space: nowrap; }
    .ow-mesero-fila { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 12px; padding: 14px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-mesero-fila:first-child { padding-top: 0; }
    .ow-mesero-fila:last-of-type { border-bottom: none; }
    .ow-mesero-info { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .ow-estado { flex-shrink: 0; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
    .ow-estado.activo { background: var(--ow-ok-suave); color: var(--ow-ok); }
    .ow-estado.inactivo { background: #eef1ef; color: var(--ow-texto-3); }
    .ow-mesero-acciones { display: flex; gap: 8px; }
    .ow-mesero-acciones .ow-btn + .ow-btn { margin-top: 0; }
    .ow-texto-atencion { color: var(--ow-atencion); }
    .ow-btn.ow-btn-atencion { background: var(--ow-atencion); color: #ffffff; }
    .ow-aviso-unico { margin-bottom: 14px; padding: 10px 12px; border: 1px solid var(--ow-atencion-borde); border-radius: 10px; background: var(--ow-atencion-suave); font-size: 14px; }
    /* 4F: el aviso de la contraseña se queda a la vista aunque la hoja se desplace. */
    .ow-aviso-fijo { position: sticky; top: -20px; z-index: 1; box-shadow: 0 -20px 0 #ffffff; }
    .ow-credencial { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; padding: 14px 16px; border: 1px solid var(--ow-borde); border-radius: 12px; background: var(--ow-fondo); }
    .ow-credencial-lbl { display: block; font-size: 12px; font-weight: 600; color: var(--ow-texto-2); }
    .ow-credencial-valor { font-weight: 500; word-break: break-all; }
    .ow-contrasena { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 22px; font-weight: 700; letter-spacing: 0.04em; user-select: all; word-break: break-all; }
    .ow-cifra-num.sin-corte { white-space: nowrap; }

    /* 6: visitas recientes y anular visita */
    .ow-visita { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-visita:last-of-type { border-bottom: none; }
    .ow-visita-info { min-width: 0; }
    .ow-visita-linea { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 8px; }
    .ow-visita-dato { font-size: 13px; color: var(--ow-texto-2); margin-top: 3px; font-variant-numeric: tabular-nums; }
    .ow-visita.anulada .ow-persona { color: var(--ow-texto-3); text-decoration: line-through; }
    .ow-visita .ow-btn { flex-shrink: 0; }
    .ow-origen { padding: 1px 7px; border-radius: 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; background: #eef1ef; color: var(--ow-texto-2); }
    .ow-origen.manual { background: var(--ow-atencion-suave); color: var(--ow-atencion); }
    .ow-textarea { height: auto; min-height: 84px; padding: 10px 12px; resize: vertical; line-height: 1.4; }
    /* Panel v2: encabezado con el negocio, menú ☰ y equipo por persona */
    .ow-cab-id { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .ow-cab-logo { width: 40px; height: 40px; font-size: 18px; }
    .ow-cab-textos { min-width: 0; }
    .ow-cab-hola { font-size: 13px; color: var(--ow-texto-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ow-cab-titulo { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; }
    .ow-menu-caja { position: relative; flex-shrink: 0; }
    .ow-menu-btn { width: 44px; height: 44px; border: 1px solid var(--ow-borde); border-radius: 10px; background: var(--ow-superficie); font: inherit; font-size: 20px; line-height: 1; color: var(--ow-texto); cursor: pointer; }
    .ow-menu { position: absolute; right: 0; top: calc(100% + 6px); z-index: 200; min-width: 210px; padding: 6px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; box-shadow: 0 10px 30px rgba(16,32,26,0.14); }
    .ow-menu button { display: block; width: 100%; min-height: 44px; padding: 8px 12px; border: none; border-radius: 8px; background: none; font: inherit; font-size: 15px; font-weight: 500; color: var(--ow-texto); text-align: left; cursor: pointer; }
    .ow-menu button:hover, .ow-menu button:focus-visible { background: var(--ow-fondo); }
    .ow-eq-persona { padding: 12px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-eq-persona:first-of-type { padding-top: 0; }
    .ow-eq-persona:last-of-type { border-bottom: none; padding-bottom: 0; }
    .ow-eq-linea { font-size: 15px; color: var(--ow-texto-2); font-variant-numeric: tabular-nums; }
    .ow-eq-aviso { margin-top: 8px; padding: 8px 12px; border-radius: 8px; background: var(--ow-atencion-suave); border: 1px solid var(--ow-atencion-borde); font-size: 14px; color: var(--ow-atencion); }
    .ow-resumen-visita { margin-bottom: 16px; padding: 12px 14px; border: 1px solid var(--ow-borde); border-radius: 10px; background: var(--ow-fondo); font-size: 14px; }

    /* 5A: panel del administrador de Sello */
    .ow-admin-cab { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
    .ow-admin-cab .ow-btn { width: auto; flex-shrink: 0; }
    .ow-negocio-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1 1 220px; }
    .ow-negocio-info .ow-persona { overflow-wrap: anywhere; }
    .ow-negocio-datos { font-size: 13px; color: var(--ow-texto-2); overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }

    /* Selector de periodo (ow-seg) */
    .ow-seg { display: flex; gap: 4px; padding: 3px; background: var(--ow-fondo); border: 1px solid var(--ow-borde); border-radius: 10px; }
    .ow-seg button { flex: 1; min-height: 38px; padding: 6px 8px; background: none; border: none; border-radius: 8px; font: inherit; font-size: 14px; font-weight: 600; color: var(--ow-texto-2); cursor: pointer; white-space: nowrap; }
    .ow-seg button[aria-pressed="true"] { background: var(--ow-superficie); color: var(--ow-texto); box-shadow: 0 0 0 1px var(--ow-borde); }
    .ow-seg button.apagado { color: var(--ow-texto-3); font-weight: 500; }
    .ow-seg.chico { display: inline-flex; }
    .ow-seg.chico button { flex: 0 0 auto; min-height: 32px; padding: 4px 12px; font-size: 13px; }
    /* Resumen (Fase B) */
    .ow-principal-arranque { font-size: 21px; font-weight: 700; line-height: 1.25; letter-spacing: -0.01em; color: #ffffff; margin-bottom: 4px; }
    .ow-periodo-cab { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 8px 0 10px; }
    .ow-fila.atencion .ow-fila-titulo { color: var(--ow-atencion); }
    .ow-fila.info { background: var(--ow-info-suave); border-color: var(--ow-info-borde); }
    .ow-fila.info .ow-fila-titulo, .ow-fila.info .ow-fila-ver { color: var(--ow-info); }
    .ow-act { list-style: none; margin: 0; padding: 0; }
    .ow-act-fila { display: flex; align-items: baseline; gap: 10px; padding: 10px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-act-fila:first-child { padding-top: 0; }
    .ow-act-fila:last-child { border-bottom: none; padding-bottom: 0; }
    .ow-act-punto { flex-shrink: 0; width: 8px; height: 8px; border-radius: 50%; background: var(--ow-ok); transform: translateY(-1px); }
    .ow-act-punto.nuevo { background: var(--ow-info); }
    .ow-act-punto.canje { background: var(--ow-atencion); }
    .ow-act-texto { flex: 1; min-width: 0; font-size: 15px; color: var(--ow-texto-2); overflow-wrap: anywhere; }
    .ow-act-texto strong { color: var(--ow-texto); font-weight: 600; }
    .ow-act-hora { flex-shrink: 0; font-size: 13px; color: var(--ow-texto-3); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .ow-barras { display: flex; align-items: stretch; gap: 12px; height: 150px; }
    .ow-barra-col { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: center; }
    .ow-barra-num { font-size: 13px; font-weight: 700; color: var(--ow-texto); font-variant-numeric: tabular-nums; }
    .ow-barra-pista { flex: 1; width: 100%; max-width: 56px; display: flex; align-items: flex-end; margin-top: 4px; border-bottom: 1px solid var(--ow-borde); }
    .ow-barra { width: 100%; border-radius: 6px 6px 0 0; background: #8fcdb3; }
    .ow-barra.actual { background: var(--ow-ok); }
    .ow-barra-lbl { margin-top: 6px; font-size: 12px; color: var(--ow-texto-3); white-space: nowrap; }
    .ow-oculto { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

    /* Fase C: logros. Celebración en verde Sello (texto blanco): pantalla
       completa en celular; en computadora, tarjeta de 420px sobre el panel
       oscurecido. Encima de todo, también de las burbujas de ayuda. */
    .ow-festejo { position: fixed; inset: 0; z-index: 10002; display: flex; background: #0F7B5A; color: #ffffff; animation: owFestejoFondo 0.3s ease-out both; }
    .ow-festejo-tarjeta { position: relative; flex: 1; display: flex; flex-direction: column; overflow-y: auto; background: #0F7B5A; animation: owFestejoEntra 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) both; }
    .ow-festejo-cont { margin: auto; width: 100%; max-width: 420px; padding: calc(28px + env(safe-area-inset-top)) calc(24px + env(safe-area-inset-right)) calc(16px + env(safe-area-inset-bottom)) calc(24px + env(safe-area-inset-left)); display: flex; flex-direction: column; align-items: center; text-align: center; }
    .ow-confeti { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; pointer-events: none; }
    .ow-festejo-etiqueta { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }
    .ow-festejo-num { margin-top: 6px; font-size: 116px; font-weight: 800; line-height: 1; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
    .ow-festejo-num.largo { font-size: 100px; }
    .ow-festejo-titulo { margin-top: 12px; font-size: 26px; font-weight: 800; line-height: 1.2; letter-spacing: -0.01em; text-wrap: balance; overflow-wrap: anywhere; }
    .ow-festejo-sub { margin-top: 10px; max-width: 340px; font-size: 16px; line-height: 1.4; opacity: 0.92; text-wrap: pretty; }
    .ow-festejo-vista { margin: 22px 0 0; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .ow-festejo-mini { width: 150px; height: 266px; border-radius: 14px; overflow: hidden; background: rgba(255,255,255,0.14); box-shadow: 0 10px 28px rgba(0,0,0,0.22); }
    .ow-festejo-mini.cargando { animation: owFestejoPulso 1.4s ease-in-out infinite; }
    .ow-festejo-mini img { display: block; width: 100%; height: 100%; object-fit: cover; }
    .ow-festejo-vista figcaption { font-size: 13px; opacity: 0.85; }
    .ow-festejo-compartir { margin-top: 22px; width: 100%; height: 54px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; border: none; border-radius: 14px; background: #ffffff; color: #0F7B5A; font: inherit; font-size: 17px; font-weight: 800; cursor: pointer; }
    .ow-festejo-compartir svg { width: 20px; height: 20px; flex-shrink: 0; }
    .ow-festejo-compartir:disabled { opacity: 0.8; cursor: default; }
    .ow-festejo-despues { margin-top: 6px; min-height: 44px; padding: 8px 20px; border: none; border-radius: 10px; background: none; color: #ffffff; font: inherit; font-size: 16px; font-weight: 600; cursor: pointer; }
    .ow-festejo-pista { font-size: 13px; opacity: 0.8; }
    .ow-festejo-nota { min-height: 18px; margin-top: 6px; font-size: 13px; }
    .ow-festejo-nota:empty { display: none; }
    .ow-festejo-compartir:focus-visible, .ow-festejo-despues:focus-visible { outline: 3px solid #ffffff; outline-offset: 3px; }
    @media (min-width: 600px) {
      .ow-festejo { align-items: center; justify-content: center; padding: 24px; background: rgba(8,20,15,0.55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
      .ow-festejo-tarjeta { flex: 0 1 420px; max-height: calc(100vh - 48px); border-radius: 24px; box-shadow: 0 24px 60px rgba(0,0,0,0.3); }
      .ow-festejo-cont { padding: 32px 28px 20px; }
    }
    @media (max-height: 760px) {
      .ow-festejo-num { font-size: 92px; }
      .ow-festejo-num.largo { font-size: 80px; }
      .ow-festejo-mini { width: 120px; height: 213px; }
    }
    @keyframes owFestejoFondo { from { opacity: 0; } to { opacity: 1; } }
    @keyframes owFestejoEntra { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: none; } }
    @keyframes owFestejoPulso { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }

    /* Pantalla "Logros": cuadrícula de los 14 hitos. */
    .ow-lg-fondo { position: fixed; inset: 0; z-index: 9999; display: flex; background: #ffffff; }
    .ow-lg { flex: 1; display: flex; flex-direction: column; min-height: 0; background: #ffffff; color: #1c2b25; }
    .ow-lg-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: calc(16px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 14px calc(20px + env(safe-area-inset-left)); border-bottom: 1px solid #e6eeea; }
    .ow-lg-titulo { font-size: 24px; font-weight: 800; letter-spacing: -0.01em; line-height: 1.2; }
    .ow-lg-cuenta { margin-top: 2px; font-size: 14px; color: #4d5f57; font-variant-numeric: tabular-nums; }
    .ow-lg-cerrar { flex-shrink: 0; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 50%; background: #F2F4F3; color: #1c2b25; cursor: pointer; }
    .ow-lg-cerrar:focus-visible { outline: 3px solid #0F7B5A; outline-offset: 2px; }
    .ow-lg-cuerpo { flex: 1; overflow-y: auto; padding: 16px calc(16px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(16px + env(safe-area-inset-left)); }
    .ow-lg-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .ow-lg-t { position: relative; display: flex; flex-direction: column; align-items: flex-start; min-height: 136px; padding: 14px; border: none; border-radius: 16px; font: inherit; color: inherit; text-align: left; }
    .ow-lg-t.ok { background: #FFFFFF; border: 1px solid #E9D9A6; cursor: pointer; transition: transform 0.15s; }
    .ow-lg-t.ok:active { transform: scale(0.98); }
    .ow-lg-t.ok:focus-visible { outline: 3px solid #0F7B5A; outline-offset: 2px; }
    .ow-lg-t.bloq { background: #F2F4F3; }
    .ow-lg-cifra { display: flex; align-items: center; gap: 6px; }
    .ow-lg-medalla { width: 18px; height: 18px; flex-shrink: 0; }
    .ow-lg-sec { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #1c2b25; }
    .ow-lg-seccion + .ow-lg-seccion { margin-top: 24px; }
    .ow-lg-num { font-size: 40px; font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; color: #0F7B5A; font-variant-numeric: tabular-nums; }
    .ow-lg-t.bloq .ow-lg-num { color: #98a59e; }
    .ow-lg-nombre { margin-top: 4px; padding-right: 4px; font-size: 14px; font-weight: 600; line-height: 1.3; }
    .ow-lg-t.bloq .ow-lg-nombre { color: #4d5f57; }
    .ow-lg-pie { display: block; margin-top: auto; padding-top: 12px; width: 100%; }
    .ow-lg-fecha { font-size: 12px; color: #4d5f57; }
    .ow-lg-icono { position: absolute; top: 14px; right: 14px; width: 20px; height: 20px; color: #0F7B5A; }
    .ow-lg-barra { display: block; height: 6px; border-radius: 3px; background: #DDE5E0; overflow: hidden; }
    .ow-lg-barra span { display: block; height: 100%; border-radius: 3px; background: #B8902F; }
    .ow-lg-falta { display: block; margin-top: 6px; font-size: 12px; color: #4d5f57; font-variant-numeric: tabular-nums; }
    .ow-lg-esq { min-height: 136px; border-radius: 16px; background: #eef2f0; animation: owPulso 1.6s ease-in-out infinite; }
    @media (min-width: 600px) {
      .ow-lg-fondo { align-items: center; justify-content: center; padding: 24px; background: rgba(8,20,15,0.45); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
      .ow-lg { flex: 0 1 720px; max-height: calc(100vh - 48px); border-radius: 24px; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.25); }
      .ow-lg-cab { padding: 20px 20px 16px 24px; }
      .ow-lg-cuerpo { padding: 20px 24px 24px; }
      .ow-lg-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    }

    @media (prefers-reduced-motion: reduce) {
      .ow-esq { animation: none; }
      .ow-paso-cambio, .ow-tab, .ow-btn, .ow-input { transition: none; }
      .ow-festejo, .ow-festejo-tarjeta, .ow-festejo-mini.cargando, .ow-lg-esq { animation: none; }
      .ow-lg-t.ok { transition: none; }
    }
  `
  document.head.appendChild(s)
}

// Logo de Sello (el mismo de la app) con su nombre.
function logoSelloHTML(tam = 26) {
  return `<span class="ow-logo">${logoSVG(tam, VERDE_SELLO)}<span>Sello</span></span>`
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

// Contraseña con botón de texto "Mostrar / Ocultar" (login).
function pwField(id, placeholder = '••••••') {
  return `<div class="ow-clave"><input type="password" id="${id}" placeholder="${placeholder}" class="ow-input" autocomplete="current-password" /><button type="button" aria-label="Mostrar contraseña" onclick="var i=document.getElementById('${id}');var v=i.type==='password';i.type=v?'text':'password';this.textContent=v?'Ocultar':'Mostrar';this.setAttribute('aria-label',v?'Ocultar contraseña':'Mostrar contraseña')">Mostrar</button></div>`
}

function errMsg(donde = '') {
  return `<p class="s-error">Sin conexión${donde ? ' al ' + donde : ''}. Verifica tu internet e intenta de nuevo.</p>`
}

// Correo de contacto de Sello (términos, aviso de privacidad y errores que
// necesitan ayuda).
const CORREO_CONTACTO = 'misellocontacto@gmail.com'

// ── Errores de Supabase Auth ──
// Antes, cualquier "no" de Auth (contraseña corta, repetida, enlace vencido)
// se mostraba como "Sin conexión". Ahora "Sin conexión" es solo cuando de
// verdad no hubo respuesta: sin señal o fetch fallido (AuthRetryableFetchError
// con status 0). Un 502/503/504 es el servidor, no el internet.
const PIDE_ENLACE_NUEVO = 'Pide uno nuevo con "¿Olvidaste tu contraseña?".'
function esSinConexion(e) {
  if (navigator.onLine === false) return true
  if (isAuthRetryableFetchError(e) && !e.status) return true
  return /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '')
}
// recuperacion = true: se está guardando la contraseña desde el enlace del correo.
function mensajeErrorAuth(e, { recuperacion = false, otro = 'No pudimos completar la acción. Intenta de nuevo.' } = {}) {
  if (esSinConexion(e)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (isAuthRetryableFetchError(e)) return 'El servidor no respondió. Intenta de nuevo en un momento.'
  const codigo = e?.code || ''
  const texto = `${codigo} ${e?.message || ''}`
  if (codigo === 'same_password' || /should be different/i.test(texto)) return 'Esa ya es tu contraseña. Escribe una distinta.'
  if (codigo === 'weak_password' || isAuthWeakPasswordError(e)) {
    const razones = e?.reasons || []
    if (razones.includes('pwned')) return 'Esa contraseña aparece en filtraciones conocidas. Elige otra.'
    if (razones.includes('characters')) return 'Esa contraseña es muy simple. Combina mayúsculas, minúsculas y números.'
    return `Esa contraseña es muy corta. Usa al menos ${CONTRASENA_MIN} caracteres.`
  }
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found'].includes(codigo)) return `El enlace venció o ya se usó. ${PIDE_ENLACE_NUEVO}`
  if (codigo === 'reauthentication_needed') return 'Por seguridad, sal, vuelve a entrar y cámbiala de nuevo.'
  if (isAuthSessionMissingError(e) || ['session_not_found', 'session_expired', 'bad_jwt', 'refresh_token_not_found', 'refresh_token_already_used'].includes(codigo) || e?.status === 401 || e?.status === 403) {
    return recuperacion ? `Tu sesión para cambiar la contraseña ya no es válida. ${PIDE_ENLACE_NUEVO}` : 'Tu sesión ya no es válida. Sal y vuelve a entrar.'
  }
  if (codigo === 'over_email_send_rate_limit') return 'Ya te enviamos un correo hace poco. Espera unos minutos y revisa tu bandeja (también spam).'
  if (codigo === 'over_request_rate_limit' || e?.status === 429) return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.'
  if (codigo === 'user_banned') return MENSAJE_CUENTA_DESACTIVADA
  if (codigo === 'email_address_invalid') return 'Revisa el correo: no parece válido.'
  return otro
}

// Error que Supabase deja en la URL cuando el enlace del correo no sirve
// (#error=access_denied&error_code=otp_expired&...).
export function mensajeErrorEnlace(codigo) {
  return codigo === 'otp_expired'
    ? `El enlace para cambiar tu contraseña venció o ya se usó. ${PIDE_ENLACE_NUEVO}`
    : `Ese enlace no funcionó. ${PIDE_ENLACE_NUEVO}`
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

// Barra inferior del Cajero. El mesero solo ve Cajero y Salir. El dueño
// además ve "Mi panel" para volver a Resumen / Personalización / Equipo sin
// cerrar sesión. Ya respeta el área segura de abajo del iPhone (.s-nav).
// El rol solo cambia lo que se ve: el servidor decide los permisos.
function navBarCajero(esDueno = false) {
  return `
    <nav class="s-nav" aria-label="Secciones">
      ${esDueno ? `<button class="s-nav-btn" id="snav-panel-c"><span class="s-nav-icon" aria-hidden="true">📊</span>Mi panel</button>` : ''}
      <button class="s-nav-btn active" id="snav-cajero" aria-current="page"><span class="s-nav-icon" aria-hidden="true">🧾</span>Cajero</button>
      <button class="s-nav-btn" id="snav-salir"${esDueno ? '' : ' data-confirmar="1"'}><span class="s-nav-icon" aria-hidden="true">🚪</span>Salir</button>
    </nav>
  `
}

// El mesero entra una sola vez y su sesión se queda guardada: salir por
// accidente lo obliga a pedir otra vez su correo y contraseña. Por eso
// "Salir" pregunta antes. Resuelve true = salir, false = quedarse.
function confirmarSalidaMesero() {
  inyectarEstilosDueno()
  return new Promise(resolver => {
    const hoja = document.createElement('div')
    hoja.className = 'ow-hoja-fondo'
    hoja.innerHTML = `<div class="ow-hoja" role="alertdialog" aria-modal="true" aria-labelledby="salir-texto">
      <p class="ow-h2" id="salir-texto" style="margin-bottom:20px">Si sales, tendrás que volver a escribir tu correo y contraseña. ¿Salir de todos modos?</p>
      <button class="ow-btn primario" id="salir-quedarme">Quedarme</button>
      <button class="ow-btn secundario" id="salir-si">Salir</button>
    </div>`
    const terminar = salir => { hoja.remove(); document.removeEventListener('keydown', alTeclear); resolver(salir) }
    const alTeclear = e => { if (e.key === 'Escape') terminar(false) }
    document.addEventListener('keydown', alTeclear)
    hoja.addEventListener('click', e => { if (e.target === hoja) terminar(false) })
    hoja.querySelector('#salir-quedarme').addEventListener('click', () => terminar(false))
    hoja.querySelector('#salir-si').addEventListener('click', () => terminar(true))
    document.body.appendChild(hoja)
    hoja.querySelector('#salir-quedarme').focus()
  })
}

// Barra inferior del dueño: solo texto, sin íconos. Va dentro de .ow.
// "Salir" vive en el menú ☰ del encabezado.
function navBarDueno(active = 'panel') {
  return `
    <nav class="ow-nav" aria-label="Secciones">
      <button id="snav-panel"${active === 'panel' ? ' aria-current="page"' : ''}>Mi panel</button>
      <button id="snav-cajero-d">Cajero</button>
      <button id="snav-admin" hidden>Admin</button>
    </nav>
  `
}

function initNavCajero() {
  document.getElementById('snav-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-panel-c')?.addEventListener('click', () => { cerrarTiempoRealCajero(); navigate('dueno') })
  const salir = document.getElementById('snav-salir')
  salir?.addEventListener('click', async () => {
    if (salir.dataset.confirmar && !(await confirmarSalidaMesero())) return
    cerrarTiempoRealCajero()
    const { logout } = await import('./auth.js')
    logout()
  })
}

function initNavDueno() {
  document.getElementById('snav-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('snav-cajero-d')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
  // 5A: "Admin" solo aparece si el servidor dice que esta cuenta es administradora.
  const btnAdmin = document.getElementById('snav-admin')
  if (btnAdmin) {
    btnAdmin.addEventListener('click', () => navigate('admin'))
    import('./auth.js').then(({ esAdmin }) => esAdmin()).then(si => { if (si && btnAdmin.isConnected) btnAdmin.hidden = false })
  }
}

// Marcas de "ya lo vio" POR USUARIO en este celular: "<clave>:<user_id>".
// Antes eran de todo el celular y un mesero nuevo en un celular usado nunca
// veía sus ayudas. La primera vez, la clave vieja (sin usuario) pasa al
// primer usuario que entra y se borra: él no vuelve a ver lo que ya cerró y
// los siguientes empiezan de cero. Sin usuario conocido devuelve null y no
// se guarda nada en el celular (solo cuenta la sesión).
function clavePorUsuario(base) {
  const uid = getUsuarioIdLocal()
  if (!uid) return null
  const clave = `${base}:${uid}`
  try {
    const vieja = localStorage.getItem(base)
    if (vieja !== null) {
      if (localStorage.getItem(clave) === null) localStorage.setItem(clave, vieja)
      localStorage.removeItem(base)
    }
  } catch (e) {}
  return clave
}

function onboardingVisto() {
  const clave = clavePorUsuario('sello_onboarding')
  try { return !!clave && localStorage.getItem(clave) === 'done' } catch (e) { return false }
}
function marcarOnboardingVisto() {
  const clave = clavePorUsuario('sello_onboarding')
  try { if (clave) localStorage.setItem(clave, 'done') } catch (e) {}
}

// Bienvenida del dueño en 3 pasos. También se muestran en el panel mientras
// el negocio no tiene clientes.
const PASOS_ONBOARDING = [
  { titulo: 'Elige tu premio y tu meta', desc: 'Por ejemplo: un café gratis a las 10 visitas. Lo cambias cuando quieras en Mi panel → Personalización.' },
  { titulo: 'Da de alta a tus meseros', desc: 'Cada mesero entra a Sello desde su celular con su propia cuenta. Agrega sus números en Equipo → Números del personal para que no ganen puntos.' },
  { titulo: 'Haz una visita de prueba', desc: 'Toca "Cobré una cuenta", escanea el QR con tu celular y suma tu primer punto. Así verás lo mismo que tus clientes.' },
]

// ── Pantalla de celebración al subir de nivel ─────────────
// ═══════════════════════════════════════════════════════════
// PÁGINAS
// ═══════════════════════════════════════════════════════════

// Entrada para dueños y meseros. La línea legal lleva a #/terminos.
export function paginaLogin() {
  inyectarEstilosDueno()
  return `
    <div class="ow ow-sello">
      <div class="ow-centro">
        <div class="ow-caja">
          <div class="ow-caja-cab">${logoSelloHTML()}</div>
          <h1 class="ow-h1" id="login-titulo">¡Hola de nuevo!</h1>
          <p class="ow-sub" id="login-sub" style="margin-bottom:24px">Entra con tu correo para ver tu negocio o cobrar en caja.</p>
          <div class="ow-campo" id="campo-email"><label class="ow-label" for="email">Correo</label><input type="email" id="email" class="ow-input" placeholder="tu@correo.com" autocomplete="email" /></div>
          <div class="ow-campo"><label class="ow-label" for="password" id="login-label-clave">Contraseña</label>${pwField('password')}</div>
          <button class="ow-btn primario" id="btn-login">Entrar</button>
          <div id="msg"></div>
          <button class="ow-enlace" id="btn-olvide" style="margin-top:8px">¿Olvidaste tu contraseña?</button>
          <div id="msg-reset"></div>
        </div>
        <p class="ow-legal">Al usar tu cuenta aceptas los <a href="#/terminos">Términos y el Aviso de privacidad</a>.</p>
      </div>
    </div>
  `
}

// Una sola suscripción para todas las veces que se pinta "Entrar" (antes se
// sumaba una nueva en cada visita).
let alRecuperarContrasena = null
let suscritoRecuperacion = false

// Mensaje en rojo de "Entrar" para una cuenta ('cuenta') o un negocio
// ('negocio') desactivados. salida = { motivo, email } (ver auth.js).
// Deja el correo escrito y borra solo la contraseña. El mensaje sigue aunque
// "Entrar" se vuelva a dibujar (está guardado en sessionStorage) y se quita
// en cuanto la persona escribe o toca algo de la caja.
function mostrarMotivoSalida(salida) {
  const msg = document.getElementById('msg')
  if (!msg || !salida?.motivo) return
  const email = document.getElementById('email')
  const password = document.getElementById('password')
  if (email && salida.email && !email.value) email.value = salida.email
  if (password) password.value = ''
  const texto = salida.motivo === 'negocio' ? MENSAJE_NEGOCIO_DESACTIVADO : MENSAJE_CUENTA_DESACTIVADA
  msg.innerHTML = `<p class="s-error" role="alert" data-motivo-salida>${texto}</p>`
  const caja = msg.closest('.ow-caja') || msg.parentElement
  const quitar = () => {
    caja.removeEventListener('input', quitar)
    caja.removeEventListener('pointerdown', quitar)
    import('./auth.js').then(({ olvidarMotivoSalida }) => olvidarMotivoSalida())
    if (msg.querySelector('[data-motivo-salida]')) msg.innerHTML = ''
  }
  caja.addEventListener('input', quitar)
  caja.addEventListener('pointerdown', quitar)
}

// recuperacion = true: se llegó con el enlace de "restablecer contraseña".
// errorEnlace: código que Supabase dejó en la URL si el enlace no sirvió
// (p. ej. 'otp_expired'); se explica en rojo.
export function initLogin({ recuperacion = false, errorEnlace = null } = {}) {
  inyectarEstilos()
  let recoveryMode = false
  const $ = id => document.getElementById(id)
  const textoBoton = () => (recoveryMode ? 'Guardar contraseña' : 'Entrar')
  // Modo "nueva contraseña": la sesión de recuperación ya dice de quién es la
  // cuenta, así que no se pide el correo (antes era obligatorio escribirlo).
  const ponerModo = (recuperar) => {
    recoveryMode = recuperar
    const password = $('password')
    // style.display y no "hidden": .ow-enlace define su propio display.
    if ($('campo-email')) $('campo-email').style.display = recuperar ? 'none' : ''
    if ($('btn-olvide')) $('btn-olvide').style.display = recuperar ? 'none' : ''
    if ($('login-titulo')) $('login-titulo').textContent = recuperar ? 'Nueva contraseña' : '¡Hola de nuevo!'
    if ($('login-sub')) $('login-sub').textContent = recuperar
      ? `Escribe tu nueva contraseña. Mínimo ${CONTRASENA_MIN} caracteres.`
      : 'Entra con tu correo para ver tu negocio o cobrar en caja.'
    if ($('login-label-clave')) $('login-label-clave').textContent = recuperar ? 'Nueva contraseña' : 'Contraseña'
    if ($('btn-login')) $('btn-login').textContent = textoBoton()
    if (password) {
      password.value = ''
      password.placeholder = recuperar ? `Mínimo ${CONTRASENA_MIN} caracteres` : '••••••'
      password.autocomplete = recuperar ? 'new-password' : 'current-password'
    }
  }
  const activarRecuperacion = () => {
    ponerModo(true)
    if ($('msg')) $('msg').innerHTML = ''
    $('password')?.focus()
  }
  alRecuperarContrasena = activarRecuperacion
  if (!suscritoRecuperacion) {
    suscritoRecuperacion = true
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') alRecuperarContrasena?.()
    })
  }
  if (recuperacion) activarRecuperacion()
  // El enlace del correo venció o ya se usó: se dice eso, no "sin conexión".
  if (!recuperacion && errorEnlace && $('msg')) {
    $('msg').innerHTML = `<p class="s-error" role="alert">${mensajeErrorEnlace(errorEnlace)}</p>`
  }
  // Hay un intento o una sesión que terminó por cuenta o negocio
  // desactivados: se explica en rojo (también si "Entrar" se redibujó).
  if (!recuperacion && !errorEnlace) {
    import('./auth.js').then(({ leerMotivoSalida }) => {
      const salida = leerMotivoSalida()
      if (salida && !recoveryMode) mostrarMotivoSalida(salida)
    })
  }

  // Guarda la nueva contraseña con la sesión de recuperación del enlace.
  const guardarNueva = async (password, msg) => {
    if (password.length < CONTRASENA_MIN) {
      msg.innerHTML = `<p class="s-error" role="alert">Esa contraseña es muy corta. Usa al menos ${CONTRASENA_MIN} caracteres.</p>`
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
    } catch (e) {
      console.error('Error al guardar la nueva contraseña:', e?.code || e?.name || e?.message)
      const texto = mensajeErrorAuth(e, { recuperacion: true, otro: 'No pudimos guardar tu contraseña. Intenta de nuevo.' })
      // Sesión de recuperación inválida: se vuelve al formulario normal para
      // poder pedir otro enlace desde aquí mismo.
      if (isAuthSessionMissingError(e) || e?.status === 401 || e?.status === 403) ponerModo(false)
      msg.innerHTML = `<p class="s-error" role="alert">${texto}</p>`
      return
    }
    const { getPerfilActual } = await import('./auth.js')
    const perfil = await getPerfilActual()
    window.location.hash = perfil?.role === 'owner' ? '#/bienvenida' : '#/cajero'
    window.dispatchEvent(new Event('hashchange'))
  }

  const doLogin = async () => {
    const email = $('email').value.trim()
    const password = $('password').value.trim()
    const msg = $('msg'); const btn = $('btn-login')
    if (recoveryMode ? !password : (!email || !password)) {
      msg.innerHTML = `<p class="s-error">${recoveryMode ? 'Escribe tu nueva contraseña.' : 'Llena todos los campos'}</p>`
      return
    }
    btn.disabled = true; btn.textContent = recoveryMode ? 'Guardando...' : 'Verificando...'; msg.innerHTML = ''
    try {
      if (recoveryMode) { await guardarNueva(password, msg); return }
      const { login, getPerfilActual, olvidarMotivoSalida, leerMotivoSalida } = await import('./auth.js')
      // Un intento nuevo olvida el motivo anterior; login() lo vuelve a
      // guardar si la cuenta o el negocio siguen desactivados.
      olvidarMotivoSalida()
      const negocio = await login(email, password)
      if (!negocio) { msg.innerHTML = `<p class="s-error">Correo o contraseña incorrectos</p>`; return }
      if (negocio.admin) { window.location.hash = '#/admin'; window.dispatchEvent(new Event('hashchange')); return }
      // login() ya cerró la sesión sin cambiar de pantalla: el mensaje se queda.
      if (negocio.desactivado) { mostrarMotivoSalida(leerMotivoSalida() || { motivo: negocio.desactivado, email }); return }
      const perfil = await getPerfilActual()
      if (perfil?.role === 'mesero') { window.location.hash = '#/cajero'; window.dispatchEvent(new Event('hashchange')); return }
      window.location.hash = onboardingVisto() ? '#/bienvenida' : '#/onboarding'
      window.dispatchEvent(new Event('hashchange'))
    } catch (e) {
      console.error('Error al entrar:', e?.code || e?.name || e?.message)
      msg.innerHTML = `<p class="s-error" role="alert">${mensajeErrorAuth(e, { otro: 'No pudimos entrar. Intenta de nuevo.' })}</p>`
    } finally { btn.disabled = false; btn.textContent = textoBoton() }
  }
  document.getElementById('btn-login').addEventListener('click', doLogin)
  document.getElementById('password')?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin() })

  // Recuperar contraseña
  document.getElementById('btn-olvide')?.addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim()
    const msgR = document.getElementById('msg-reset')
    if (!email) { msgR.innerHTML = `<p class="s-error">Escribe tu correo arriba primero</p>`; return }
    msgR.innerHTML = `<p style="color:${DS.gray500};font-size:13px;text-align:center">Enviando instrucciones...</p>`
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      msgR.innerHTML = `<p class="s-success">Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña.</p>`
    } catch (e) {
      msgR.innerHTML = `<p class="s-error" role="alert">${mensajeErrorAuth(e, { otro: 'No pudimos enviar el correo. Intenta de nuevo.' })}</p>`
    }
  })
}

// Contenido de un paso de la bienvenida (solo esta parte cambia entre pasos).
function pasoOnboardingHTML(i) {
  const p = PASOS_ONBOARDING[i]; const total = PASOS_ONBOARDING.length; const esUltimo = i === total - 1
  return `
    <div class="ow-progreso" aria-hidden="true">${PASOS_ONBOARDING.map((_, k) => `<span class="${k <= i ? 'hecho' : ''}"></span>`).join('')}</div>
    <div class="ow-paso-de">Paso ${i + 1} de ${total}</div>
    <h1 class="ow-h1">${p.titulo}</h1>
    <p class="ow-sub" style="margin-bottom:28px">${p.desc}</p>
    <button class="ow-btn primario" id="onb-siguiente">${esUltimo ? '¡Empecemos!' : 'Siguiente'}</button>
    ${!esUltimo ? `<button class="ow-btn secundario" id="onb-skip">Lo veo después</button>` : ''}`
}

export function paginaOnboarding(paso = 0) {
  inyectarEstilosDueno()
  const i = Math.min(Math.max(0, Number(paso) || 0), PASOS_ONBOARDING.length - 1)
  return `
    <div class="ow ow-sello">
      <div class="ow-centro">
        <div class="ow-caja">
          <div class="ow-caja-cab">${logoSelloHTML()}</div>
          <div class="ow-paso-cambio" id="onb-contenido" aria-live="polite">${pasoOnboardingHTML(i)}</div>
        </div>
      </div>
    </div>
  `
}

// Al pasar de paso NO se vuelve a dibujar la pantalla (eso dejaba un parpadeo
// blanco): solo cambia el contenido del paso con un fundido de 150 ms, y la
// URL se actualiza sin disparar el cambio de página.
export function initOnboarding(paso = 0) {
  inyectarEstilosDueno()
  const contenido = document.getElementById('onb-contenido')
  if (!contenido) return
  let actual = Math.min(Math.max(0, Number(paso) || 0), PASOS_ONBOARDING.length - 1)
  let cambiando = false
  const sinMovimiento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  const terminar = () => { marcarOnboardingVisto(); navigate('bienvenida') }

  function irA(i) {
    if (cambiando) return
    cambiando = true
    const pintar = () => {
      actual = i
      contenido.innerHTML = pasoOnboardingHTML(i)
      try { history.replaceState(null, '', `#/onboarding/${i}`) } catch (e) {}
      contenido.classList.remove('saliendo')
      contenido.querySelector('h1')?.focus?.()
      cambiando = false
    }
    if (sinMovimiento) return pintar()
    contenido.classList.add('saliendo')
    setTimeout(pintar, 150)
  }

  contenido.addEventListener('click', e => {
    const id = e.target.closest('button')?.id
    if (id === 'onb-siguiente') {
      if (actual >= PASOS_ONBOARDING.length - 1) terminar()
      else irA(actual + 1)
    } else if (id === 'onb-skip') {
      terminar()
    }
  })
}

export async function paginaBienvenida() {
  inyectarEstilosDueno()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    return `
      <div class="ow ow-sello">
        <div class="ow-centro">
          <div class="ow-caja">
            <div class="ow-caja-cab">${logoSelloHTML()}</div>
            <p class="ow-sub" style="margin:0 0 2px">${saludoPorHora()}</p>
            <h1 class="ow-h1">${esc(negocio.nombre)}</h1>
            <p class="ow-sub" style="margin-bottom:24px">¿Qué hacemos hoy?</p>
            <button class="ow-btn primario" id="sbv-cajero">Cobrar en caja</button>
            <button class="ow-btn secundario" id="sbv-panel">Ver cómo va mi negocio</button>
            <button class="ow-enlace" id="sbv-salir" style="margin-top:14px">Cerrar sesión</button>
          </div>
        </div>
      </div>
    `
  } catch (e) { return `<div class="ow ow-sello"><div class="ow-centro"><div class="ow-caja">${errMsg()}</div></div></div>` }
}

export function initBienvenida() {
  inyectarEstilosDueno()
  document.getElementById('sbv-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('sbv-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('sbv-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
}

// ── CAJERO — "Cobré una cuenta" genera un QR de un solo uso ──
// El servidor decide todo (límite, caducidad); la pantalla solo muestra.
// Cada visita a #/cajero abre una "sesión"; al salir de la pantalla o al
// volver a pintarla, la sesión anterior apaga su reloj y sus listeners.
let cajeroSesion = 0

// Tiempo real (2F): un solo canal abierto a la vez. Los ids de códigos cuyo
// aviso ya se mostró se guardan en memoria y en localStorage (con su hora)
// para no repetirlo al ponerse al día ni al recargar la app. Se olvidan a
// los 10 minutos: la búsqueda al ponerse al día solo mira los últimos 5.
const CLAVE_AVISOS_VISTOS = 'sello_avisos_vistos'
const avisosVistos = new Map() // id del código → ms en que se mostró
let canalCajero = null

function podarAvisosVistos() {
  const limite = Date.now() - 10 * 60 * 1000
  for (const [id, hora] of avisosVistos) if (!(hora > limite)) avisosVistos.delete(id)
}

function cargarAvisosVistos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_AVISOS_VISTOS) || '{}')
    for (const [id, hora] of Object.entries(guardados)) {
      if (!avisosVistos.has(id) && typeof hora === 'number') avisosVistos.set(id, hora)
    }
  } catch (e) {}
  podarAvisosVistos()
}

function marcarAvisoVisto(id) {
  avisosVistos.set(id, Date.now())
  podarAvisosVistos()
  try { localStorage.setItem(CLAVE_AVISOS_VISTOS, JSON.stringify(Object.fromEntries(avisosVistos))) } catch (e) {}
}

function cerrarTiempoRealCajero() {
  if (canalCajero) supabase.removeChannel(canalCajero)
  canalCajero = null
}

// Si el servidor rechaza al Cajero porque el negocio o la cuenta ya no están
// activos, se va a "Entrar" con el motivo en lugar de dejar al mesero con un
// aviso. "Acceso denegado" también sale por otras causas, así que se confirma
// con el servidor antes de cerrar la sesión.
let revisandoDesactivacion = false
async function salirSiDesactivadoCajero(error) {
  const m = error?.message || ''
  if (revisandoDesactivacion || !(m.includes('NEGOCIO_INACTIVO') || m.includes('Acceso denegado'))) return
  revisandoDesactivacion = true
  try {
    const { motivoDesactivacion, logout } = await import('./auth.js')
    const motivo = m.includes('NEGOCIO_INACTIVO') ? 'negocio' : await motivoDesactivacion()
    if (motivo && getPage() === 'cajero') { cerrarTiempoRealCajero(); await logout(motivo) }
  } catch (e) {} finally { revisandoDesactivacion = false }
}

function mensajeCajero(error, max) {
  const m = error?.message || ''
  salirSiDesactivadoCajero(error)
  if (navigator.onLine === false || /Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (m.includes('LIMITE_CODIGOS')) {
    const tope = max ?? error?.details?.match(/de (\d+)/)?.[1]
    return `Ya tienes ${tope ? tope + ' códigos activos' : 'el máximo de códigos activos'}. Cancela uno para generar otro.`
  }
  if (m.includes('NEGOCIO_INACTIVO')) return 'El negocio está desactivado. Habla con el dueño.'
  if (m.includes('Acceso denegado')) return 'Tu sesión ya no es válida. Sal y vuelve a entrar.'
  if (m.includes('CODIGO_USADO')) return '✓ El cliente ya usó este código.'
  if (m.includes('CODIGO_CADUCADO')) return 'Ese código ya caducó.'
  if (m.includes('CODIGO_CANCELADO')) return 'Ese código ya estaba cancelado.'
  if (m.includes('CODIGO_NO_ENCONTRADO')) return 'Ese código ya no está disponible.'
  return 'Algo salió mal. Intenta de nuevo.'
}

// ═══════════════════════════════════════════════════════════
// AYUDAS DE PRIMERA VEZ (4F) — mesero y dueño; el cliente no tiene.
// Una burbuja corta señala el elemento real (resaltado suave) la primera vez
// que está a la vista. Una a la vez. "Entendido" (o tocar el elemento) la da
// por vista; "Saltar todo" da por vistas todas las de esa pantalla.
// Se recuerdan en localStorage POR USUARIO ("sello_ayudas_vistas:<user_id>",
// ver clavePorUsuario); si falla, al menos no se repiten en la sesión.
// No tapan los botones de "proteger" (se coloca arriba, abajo o más allá).
// ═══════════════════════════════════════════════════════════
const CLAVE_AYUDAS = 'sello_ayudas_vistas'
// Vistas en esta sesión, de UN usuario. Si entra otra persona sin recargar
// la app (Salir → Entrar), se empieza de cero.
const ayudasEnSesion = new Set()
let ayudasEnSesionUsuario = null

function ayudasDeSesion() {
  const uid = getUsuarioIdLocal()
  if (uid !== ayudasEnSesionUsuario) {
    ayudasEnSesion.clear()
    ayudasEnSesionUsuario = uid
  }
  return ayudasEnSesion
}

function leerAyudasVistas() {
  const sesion = ayudasDeSesion()
  const clave = clavePorUsuario(CLAVE_AYUDAS)
  try {
    const lista = clave ? JSON.parse(localStorage.getItem(clave) || '[]') : []
    return new Set([...(Array.isArray(lista) ? lista : []), ...sesion])
  } catch (e) { return new Set(sesion) }
}
function marcarAyudasVistas(ids) {
  const sesion = ayudasDeSesion()
  ids.forEach(id => sesion.add(id))
  const clave = clavePorUsuario(CLAVE_AYUDAS)
  try { if (clave) localStorage.setItem(clave, JSON.stringify([...leerAyudasVistas()])) } catch (e) {}
}
// "Ver ayuda otra vez" (Personalización): a este usuario, en este celular,
// le vuelven a salir todas.
function reiniciarAyudas() {
  ayudasDeSesion().clear()
  const clave = clavePorUsuario(CLAVE_AYUDAS)
  try { if (clave) localStorage.removeItem(clave) } catch (e) {}
  ayudasMotor.ocultar()
}

const AYUDAS_MESERO = [
  { id: 'mesero-cobre', elemento: '#cj-cobre', texto: 'Tócalo al cobrar y muéstrale el código al cliente.',
    proteger: ['#cj-canjear', '.s-nav'] },
  { id: 'mesero-qr', elemento: '#cj-qr:not([hidden]) #cj-qr-canvas', texto: 'El cliente lo escanea con su cámara. Verás verde cuando sume.',
    proteger: ['#cj-qr-cerrar', '#cj-qr-cancelar'] },
  { id: 'mesero-exito', elemento: '#cj-exito:not([hidden]) .cj-exito-quien', texto: 'Confirma que nombre y últimos 4 dígitos sean de quien tienes enfrente.',
    proteger: ['#cj-exito-listo'] },
  { id: 'mesero-canje', elemento: '#cj-canje:not([hidden]) #cj-canje-casillas', texto: 'Pídele al cliente su código de 4 dígitos y escríbelo aquí.',
    proteger: ['#cj-teclado', '#cj-canje [data-canje]'] },
]
const AYUDAS_DUENO = [
  { id: 'dueno-ventas', elemento: '#dn-ventas', texto: 'Estimado: visitas de clientes que regresaron por lo que gasta un cliente.',
    proteger: ['.ow-tabs', '.ow-nav'] },
  { id: 'dueno-ticket', elemento: '#prog-ticket', texto: 'Opcional. Con esto calculamos tus ventas estimadas.',
    proteger: ['#btn-guardar-ventas', '.ow-nav'] },
  { id: 'dueno-excluidos', elemento: '#excl-tel', texto: 'Agrega tu número y el de tu equipo: no ganan puntos.',
    proteger: ['#btn-agregar-excl', '.ow-nav'] },
]

function inyectarEstilosAyudas() {
  if (document.getElementById('sello-styles-ayudas')) return
  const s = document.createElement('style')
  s.id = 'sello-styles-ayudas'
  s.textContent = `
    .ay-resalte { position: fixed; z-index: 10000; pointer-events: none; border-radius: 12px; box-shadow: 0 0 0 3px rgba(255,255,255,0.95), 0 0 0 7px rgba(10,92,71,0.35); }
    .ay-burbuja { position: fixed; z-index: 10001; width: min(320px, calc(100vw - 32px)); padding: 14px 16px 12px; background: #ffffff; color: #0f172a; border-radius: 14px; box-shadow: 0 10px 30px rgba(15,23,42,0.18), 0 0 0 1px rgba(15,23,42,0.06); font-family: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
    .ay-burbuja:focus { outline: none; }
    .ay-texto { font-size: 16px; line-height: 1.4; font-weight: 500; }
    .ay-botones { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
    .ay-entendido { min-height: 44px; padding: 8px 18px; border: none; border-radius: 10px; background: var(--negocio-color, #0a5c47); color: var(--negocio-texto, #ffffff); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
    .ay-saltar { min-height: 44px; padding: 8px 4px; border: none; background: none; font: inherit; font-size: 14px; color: #64748b; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .ay-entendido:focus-visible, .ay-saltar:focus-visible { outline: 2px solid #0f172a; outline-offset: 2px; }
  `
  document.head.appendChild(s)
}

// Un solo motor para toda la app: cada pantalla le dice su raíz y su lista.
const ayudasMotor = (() => {
  let raizId = null, lista = [], tic = null, actual = null, pausaHasta = 0
  let burbuja = null, resalte = null, focoAntes = null

  const propios = n => n === burbuja || n === resalte || burbuja?.contains(n)

  // ¿Está el elemento completo en pantalla y sin nada encima (otra pantalla u hoja)?
  function aLaVista(el) {
    if (!el || !el.isConnected || el.getClientRects().length === 0) return false
    const r = el.getBoundingClientRect()
    if (r.width < 8 || r.height < 8) return false
    if (r.top < 0 || r.left < 0 || r.bottom > window.innerHeight || r.right > window.innerWidth) return false
    const arriba = (document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) || []).find(n => !propios(n))
    return !!arriba && (arriba === el || el.contains(arriba))
  }

  const cruce = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

  // Prueba arriba y abajo del elemento (y más allá de los botones protegidos)
  // y se queda con la posición que menos tape.
  function colocar() {
    const el = actual && document.querySelector(actual.elemento)
    if (!el || !burbuja) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth, vh = window.innerHeight
    const w = burbuja.offsetWidth, h = burbuja.offsetHeight, m = 12
    const protegidos = (actual.proteger || []).flatMap(sel => [...document.querySelectorAll(sel)])
      .filter(p => p.getClientRects().length > 0).map(p => p.getBoundingClientRect())
    const left = Math.min(Math.max(16, r.left + r.width / 2 - w / 2), Math.max(16, vw - w - 16))
    const candidatos = [r.bottom + m, r.top - m - h]
    // Abajo, saltando los protegidos que estorben; y lo mismo hacia arriba.
    for (const dir of [1, -1]) {
      let top = dir > 0 ? r.bottom + m : r.top - m - h
      for (let i = 0; i < 6; i++) {
        const choca = protegidos.find(p => cruce(p, { left, right: left + w, top, bottom: top + h }) > 0)
        if (!choca) break
        top = dir > 0 ? choca.bottom + m : choca.top - m - h
        candidatos.push(top)
      }
    }
    let mejor = null
    for (const t of candidatos) {
      const top = Math.min(Math.max(8, t), vh - h - 8)
      const caja = { left, right: left + w, top, bottom: top + h }
      const tapa = cruce(caja, r) * 3 + protegidos.reduce((s, p) => s + cruce(caja, p) * 3, 0) + Math.abs(top - t)
      if (!mejor || tapa < mejor.tapa) mejor = { top, tapa }
    }
    burbuja.style.left = `${Math.round(left)}px`
    burbuja.style.top = `${Math.round(mejor.top)}px`
    const radio = getComputedStyle(el).borderRadius
    Object.assign(resalte.style, {
      left: `${r.left - 2}px`, top: `${r.top - 2}px`, width: `${r.width + 4}px`, height: `${r.height + 4}px`,
      borderRadius: radio && radio !== '0px' ? radio : '10px',
    })
  }

  function ocultar(devolverFoco = false) {
    const el = actual && document.querySelector(actual.elemento)
    if (el) { el.removeAttribute('aria-describedby'); el.removeEventListener('click', alTocarElemento, true) }
    burbuja?.remove(); resalte?.remove()
    burbuja = resalte = null
    document.removeEventListener('keydown', alTeclear)
    window.removeEventListener('scroll', colocar, true)
    window.removeEventListener('resize', colocar)
    if (devolverFoco && burbuja === null && focoAntes?.isConnected) { try { focoAntes.focus({ preventScroll: true }) } catch (e) {} }
    actual = null; focoAntes = null
  }

  function cerrar(todas) {
    if (!actual) return
    marcarAyudasVistas(todas ? lista.map(a => a.id) : [actual.id])
    ocultar(true)
    pausaHasta = Date.now() + 1200   // nunca dos seguidas de golpe
  }
  function alTocarElemento() { cerrar(false) }   // usar el elemento también cuenta como "visto"
  function alTeclear(e) { if (e.key === 'Escape') cerrar(false) }

  function mostrar(ayuda, el) {
    inyectarEstilosAyudas()
    actual = ayuda
    resalte = document.createElement('div'); resalte.className = 'ay-resalte'; resalte.setAttribute('aria-hidden', 'true')
    burbuja = document.createElement('div')
    burbuja.className = 'ay-burbuja'
    burbuja.setAttribute('role', 'dialog'); burbuja.setAttribute('aria-modal', 'false')
    burbuja.setAttribute('aria-label', 'Ayuda'); burbuja.tabIndex = -1
    burbuja.innerHTML = `<p class="ay-texto" id="ay-texto" aria-live="polite">${esc(ayuda.texto)}</p>
      <div class="ay-botones"><button type="button" class="ay-saltar">Saltar todo</button><button type="button" class="ay-entendido">Entendido</button></div>`
    document.body.append(resalte, burbuja)
    burbuja.querySelector('.ay-entendido').addEventListener('click', () => cerrar(false))
    burbuja.querySelector('.ay-saltar').addEventListener('click', () => cerrar(true))
    el.setAttribute('aria-describedby', 'ay-texto')
    el.addEventListener('click', alTocarElemento, true)
    document.addEventListener('keydown', alTeclear)
    window.addEventListener('scroll', colocar, true)
    window.addEventListener('resize', colocar)
    colocar()
    // El foco va a la burbuja (lectores de pantalla), salvo si está escribiendo.
    const activo = document.activeElement
    if (!activo || !/^(INPUT|TEXTAREA|SELECT)$/.test(activo.tagName)) {
      focoAntes = activo
      try { burbuja.querySelector('.ay-entendido').focus({ preventScroll: true }) } catch (e) {}
    }
  }

  function revisar() {
    if (!raizId || !document.getElementById(raizId)) { detener(); return }
    if (actual) {
      // Si el elemento se fue (cambió la pantalla), se esconde sin darla por vista.
      if (!aLaVista(document.querySelector(actual.elemento))) ocultar()
      else colocar()
      return
    }
    if (Date.now() < pausaHasta || document.visibilityState !== 'visible') return
    const vistas = leerAyudasVistas()
    for (const a of lista) {
      if (vistas.has(a.id)) continue
      const el = document.querySelector(a.elemento)
      if (aLaVista(el)) { mostrar(a, el); return }
    }
  }

  function detener() { clearInterval(tic); tic = null; ocultar(); raizId = null; lista = [] }

  return {
    // Se llama al abrir cada pantalla; reemplaza lo de la pantalla anterior.
    activar(id, ayudas) {
      detener()
      raizId = id; lista = ayudas
      pausaHasta = Date.now() + 800   // que la pantalla termine de dibujarse
      tic = setInterval(revisar, 400)
    },
    pendiente: id => !leerAyudasVistas().has(id),
    ocultar: () => ocultar(),
  }
})()

// rol = 'owner' muestra "Mi panel" en la barra de abajo; el mesero no lo ve.
export function paginaCajero(rol = 'mesero') {
  inyectarEstilos()
  return `
    <div id="cj-root" style="padding-bottom:calc(72px + env(safe-area-inset-bottom))">
      <div class="sello-topbar">
        ${topbarBrand()}
        <span style="font-size:13px;color:rgba(255,255,255,0.6)">Cajero</span>
      </div>
      <div class="cj-main">
        <button class="cj-cobre" id="cj-cobre"><span class="cj-cobre-icon">🧾</span>Cobré una cuenta</button>
        <button class="cj-canjear" id="cj-canjear"><span aria-hidden="true">🎁</span>Canjear premio</button>
        <div id="cj-msg"></div>
      </div>
      <div class="s-card">
        <div class="cj-pend-head"><div class="s-section-label">Códigos pendientes</div><div class="cj-contador" id="cj-contador"></div></div>
        <div id="cj-lista"><p class="cj-vacio">Cargando...</p></div>
      </div>
      <div class="cj-manual-acceso"><button type="button" class="cj-manual-enlace" id="cj-manual-abrir">Captura manual</button></div>
      <div class="cj-manual" id="cj-manual" hidden>
        <div class="cj-manual-caja">
          <div class="cj-qr-titulo">Captura manual</div>
          <div class="cj-qr-sub">Solo si el cliente no puede escanear.</div>
          <div class="cl-campo">
            <label class="cl-label" for="cj-manual-tel">Teléfono del cliente</label>
            <div class="cl-input-wrap" id="cj-manual-tel-wrap"><span class="cl-prefijo">+52</span><input class="cl-input" id="cj-manual-tel" type="tel" inputmode="numeric" autocomplete="off" enterkeyhint="next" placeholder="10 dígitos" /></div>
            <p class="cl-error-campo" id="cj-manual-tel-error" role="alert" hidden></p>
          </div>
          <div class="cl-campo">
            <label class="cl-label" for="cj-manual-nombre">Primer nombre (solo si es nuevo)</label>
            <div class="cl-input-wrap" id="cj-manual-nombre-wrap"><input class="cl-input" id="cj-manual-nombre" type="text" autocomplete="off" autocapitalize="words" enterkeyhint="done" maxlength="30" placeholder="Ana" /></div>
            <p class="cl-error-campo" id="cj-manual-nombre-error" role="alert" hidden></p>
          </div>
          <div id="cj-manual-msg" style="margin-top:16px"></div>
          <button class="cl-btn" id="cj-manual-sumar">Sumar punto</button>
          <button class="cl-enlace" id="cj-manual-cerrar">Cancelar</button>
        </div>
      </div>
      <div class="cj-canje" id="cj-canje" role="dialog" aria-label="Canjear premio" hidden>
        <div class="cj-canje-caja" id="cj-canje-caja"></div>
      </div>
      <div class="cj-qr" id="cj-qr" hidden>
        <div>
          <div class="cj-qr-titulo">Escanea con tu cámara</div>
          <div class="cj-qr-sub">y suma tu punto</div>
        </div>
        <div>
          <canvas id="cj-qr-canvas"></canvas>
          <div class="cj-qr-tiempo-lbl">Caduca en</div>
          <div class="cj-qr-tiempo" id="cj-qr-tiempo"></div>
        </div>
        <div class="cj-qr-botones">
          <button class="s-btn ghost" id="cj-qr-cerrar">Cerrar</button>
          <button class="s-btn danger" id="cj-qr-cancelar">Cancelar código</button>
        </div>
      </div>
      <div class="cj-exito" id="cj-exito" role="alert" hidden></div>
    </div>
    ${navBarCajero(rol === 'owner')}
  `
}

export async function initCajero() {
  inyectarEstilos(); initNavCajero()
  const sesion = ++cajeroSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === cajeroSesion && !!$('cj-root')
  const estado = { codigos: [], max: null, abierto: null, creando: false, wakeLock: null, usuarioId: null }
  const avisos = { cola: [], actual: null, temporizador: null }
  let canal = null

  const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
  if (!vigente()) return
  if (!negocio?.id) {
    $('cj-cobre').disabled = true
    $('cj-msg').innerHTML = `<div class="cj-aviso aviso">Tu sesión ya no es válida. Sal y vuelve a entrar.</div>`
    return
  }
  ayudasMotor.activar('cj-root', AYUDAS_MESERO)

  const restante = c => new Date(c.expira_en).getTime() - Date.now()
  const formatoTiempo = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
  const hora = iso => new Date(iso).toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  const avisar = (texto, tipo = 'aviso') => { $('cj-msg').innerHTML = texto ? `<div class="cj-aviso ${tipo}">${texto}</div>` : '' }

  function pintarLista() {
    actualizarSondeo()
    const activos = estado.codigos.length
    $('cj-contador').textContent = estado.max ? `${activos} de ${estado.max} activos` : ''
    $('cj-lista').innerHTML = activos === 0
      ? `<p class="cj-vacio">No hay códigos pendientes</p>`
      : estado.codigos.map(c => `
        <button class="cj-fila" data-id="${c.id}">
          <span><span class="s-row-title">Cuenta de las ${hora(c.creado_en)}</span><span class="s-row-sub" data-tiempo="${c.id}">Caduca en ${formatoTiempo(restante(c))}</span></span>
          <span class="cj-fila-ver">Ver QR</span>
        </button>`).join('')
  }

  // Mantiene la pantalla encendida mientras el QR está a la vista (si el navegador lo permite).
  async function mantenerPantalla(encendida) {
    try {
      if (encendida && !estado.wakeLock && 'wakeLock' in navigator) {
        estado.wakeLock = await navigator.wakeLock.request('screen')
        estado.wakeLock.addEventListener('release', () => { estado.wakeLock = null })
      }
      if (!encendida && estado.wakeLock) await estado.wakeLock.release()
    } catch (e) { estado.wakeLock = null }
  }

  async function mostrarQR(c) {
    estado.abierto = c
    // El id del negocio va en la URL para que el celular del cliente elija su token (2E).
    const url = `${location.origin}${location.pathname}#/c/${negocio.id}/${c.codigo}`
    const lado = Math.floor(Math.min(window.innerWidth - 48, window.innerHeight * 0.55, 420))
    $('cj-qr-tiempo').textContent = formatoTiempo(restante(c))
    $('cj-qr').hidden = false
    try {
      await QRCode.toCanvas($('cj-qr-canvas'), url, { width: lado, margin: 2, errorCorrectionLevel: 'L' })
    } catch (e) {
      console.error('Error al dibujar el QR:', e)
      cerrarQR(); avisar('No se pudo mostrar el QR. Intenta de nuevo.')
      return
    }
    mantenerPantalla(true)
  }

  function cerrarQR() {
    estado.abierto = null
    $('cj-qr').hidden = true
    mantenerPantalla(false)
  }

  function quitar(id) {
    estado.codigos = estado.codigos.filter(c => c.id !== id)
    pintarLista()
  }

  async function cargarPendientes() {
    try {
      const { data, error } = await supabase.rpc('mis_codigos_pendientes')
      if (!vigente()) return
      if (error) throw error
      estado.codigos = data.codigos; estado.max = data.max_activos
      // Si el QR abierto ya no está pendiente (el cliente lo usó o caducó), se cierra.
      if (estado.abierto && !estado.codigos.some(c => c.id === estado.abierto.id)) cerrarQR()
      pintarLista()
    } catch (e) {
      console.error('Error al cargar los códigos pendientes:', e)
      if (vigente()) $('cj-lista').innerHTML = `<p class="cj-vacio">${mensajeCajero(e, estado.max)}</p>`
    }
  }

  async function cobre() {
    if (estado.creando) return
    const btn = $('cj-cobre')
    estado.creando = true; btn.disabled = true; avisar('')
    try {
      const { data, error } = await supabase.rpc('crear_codigo')
      if (!vigente()) return
      if (error) throw error
      const c = { id: data.id, codigo: data.codigo, expira_en: data.expira_en, creado_en: new Date().toISOString() }
      estado.codigos.unshift(c); estado.max = data.max_activos
      pintarLista()
      await mostrarQR(c)
    } catch (e) {
      if (!vigente()) return
      avisar(mensajeCajero(e, estado.max))
      if (e?.message?.includes('LIMITE_CODIGOS')) cargarPendientes()
    } finally {
      estado.creando = false; btn.disabled = false
    }
  }

  async function cancelar() {
    const c = estado.abierto; const btn = $('cj-qr-cancelar')
    if (!c || btn.disabled) return
    btn.disabled = true
    try {
      const { data, error } = await supabase.rpc('cancelar_codigo', { p_codigo_id: c.id })
      if (!vigente()) return
      if (error) throw error
      estado.max = data.max_activos
      cerrarQR(); quitar(c.id)
      avisar('Código cancelado. Ya puedes generar otro.', 'ok')
    } catch (e) {
      if (!vigente()) return
      const m = e?.message || ''
      // Si ya no estaba activo, se quita de la lista de todos modos.
      if (/CODIGO_(USADO|CADUCADO|CANCELADO|NO_ENCONTRADO)/.test(m)) { cerrarQR(); quitar(c.id) }
      avisar(mensajeCajero(e, estado.max), m.includes('CODIGO_USADO') ? 'ok' : 'aviso')
    } finally {
      btn.disabled = false
    }
  }

  // ── Avisos "sumó su punto" (2F) ──
  // Llegan por tiempo real o al ponerse al día; se muestran de uno en uno.
  // El normal se cierra solo a los 6 s; el de premio solo con "Listo".
  function encolarAviso(fila, origen) {
    if (!fila?.reclamado_en || avisosVistos.has(fila.id)) return
    if (avisos.actual?.id === fila.id || avisos.cola.some(f => f.id === fila.id)) return
    // Solo diagnóstico (no se muestra): por dónde llegó y cuánto tardó.
    // Depende de que el reloj del celular esté bien puesto.
    const segundos = ((Date.now() - new Date(fila.reclamado_en).getTime()) / 1000).toFixed(1)
    console.info(`[Sello] Aviso por ${origen}: ${segundos} s desde reclamado_en (código ${fila.id})`)
    avisos.cola.push(fila)
    if (!avisos.actual) siguienteAviso()
  }

  function siguienteAviso() {
    clearTimeout(avisos.temporizador)
    const fila = avisos.cola.shift()
    avisos.actual = fila || null
    const el = $('cj-exito')
    if (!el) return
    if (!fila) { el.hidden = true; el.innerHTML = ''; return }
    marcarAvisoVisto(fila.id)
    // El aviso de canje (Fase 3) es verde como el normal, aunque al cliente
    // todavía le alcance para otro premio.
    const premio = fila.aviso_premio_listo === true && !fila.canje
    const quien = `${esc(fila.aviso_nombre || 'Cliente')} (···${esc(fila.aviso_ultimos4 || '····')})`
    const puntos = fila.aviso_puntos != null && fila.aviso_meta != null ? `${fila.aviso_puntos}/${fila.aviso_meta}` : ''
    const manual = fila.manual ? ' · captura manual' : ''
    el.className = `cj-exito${premio ? ' premio' : ''}`
    el.innerHTML = fila.canje
      ? `<div class="cj-exito-centro">
          <div class="cj-exito-icono">🎁</div>
          <div class="cj-exito-titulo">¡Premio entregado!</div>
          <div class="cj-exito-quien">${quien}</div>
          <div class="cj-exito-texto">${esc(fila.premio_texto || '')}</div>
          ${puntos ? `<div class="cj-exito-texto">Ahora lleva ${puntos}</div>` : ''}
        </div>
        <button class="cj-exito-listo" id="cj-exito-listo">Listo</button>`
      : premio
      ? `<div class="cj-exito-centro">
          <div class="cj-exito-icono">🎁</div>
          <div class="cj-exito-titulo">¡Le toca premio!</div>
          <div class="cj-exito-quien">${quien}</div>
          <div class="cj-exito-texto">completó su tarjeta${manual}</div>
          ${puntos ? `<div class="cj-exito-puntos">${puntos}</div>` : ''}
        </div>
        <button class="cj-exito-listo" id="cj-exito-listo">Listo</button>`
      : `<div class="cj-exito-centro">
          <div class="cj-exito-icono">✓</div>
          <div class="cj-exito-quien">${quien}</div>
          <div class="cj-exito-texto">sumó su punto${manual}</div>
          ${puntos ? `<div class="cj-exito-puntos">${puntos}</div>` : ''}
        </div>
        <button class="cj-exito-listo" id="cj-exito-listo">Listo</button>`
    el.hidden = false
    $('cj-exito-listo').addEventListener('click', siguienteAviso)
    try { navigator.vibrate?.(premio ? [150, 80, 150] : 150) } catch (e) {}
    // La primera vez sale una ayuda sobre esta pantalla: no se cierra sola
    // para que dé tiempo de leerla (se cierra con "Listo").
    if (!premio && !ayudasMotor.pendiente('mesero-exito')) avisos.temporizador = setTimeout(() => { if (vigente()) siguienteAviso() }, 6000)
  }

  // Un código propio cambió: si se reclamó o se canceló, deja de estar pendiente.
  function alCambiarCodigo(fila, origen) {
    if (!fila?.id || !(fila.reclamado_en || fila.cancelado_en)) return
    if (estado.abierto?.id === fila.id) cerrarQR()
    quitar(fila.id)
    if (fila.reclamado_en) encolarAviso(fila, origen)
  }

  // Red de seguridad para que el aviso llegue en 1-3 s aunque Realtime tarde:
  // cada 3 s pregunta por los códigos pendientes que ya conoce (por id).
  // Solo corre con códigos activos y con la pantalla visible.
  const sondeo = { intervalo: null, enCurso: false }

  function actualizarSondeo() {
    const debeCorrer = vigente() && estado.codigos.length > 0
    if (debeCorrer && !sondeo.intervalo) sondeo.intervalo = setInterval(sondear, 3000)
    if (!debeCorrer && sondeo.intervalo) { clearInterval(sondeo.intervalo); sondeo.intervalo = null }
  }

  async function sondear() {
    if (!vigente()) { actualizarSondeo(); return }
    if (document.hidden || sondeo.enCurso) return
    const ids = estado.codigos.map(c => c.id)
    if (!ids.length) { actualizarSondeo(); return }
    sondeo.enCurso = true
    try {
      const { data, error } = await supabase
        .from('codigos')
        .select('id, reclamado_en, cancelado_en, aviso_nombre, aviso_ultimos4, aviso_puntos, aviso_meta, aviso_premio_listo')
        .in('id', ids)
      if (!vigente()) return
      if (error) throw error
      for (const fila of data || []) alCambiarCodigo(fila, 'consulta de respaldo')
    } catch (e) {
      console.error('Error en la consulta de respaldo de códigos:', e)
    } finally {
      sondeo.enCurso = false
    }
  }

  // Para no perder avisos (señal caída, pantalla apagada): códigos propios
  // reclamados en los últimos 5 minutos que aún no se mostraron.
  async function buscarReclamados() {
    if (!estado.usuarioId) return
    try {
      const desde = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const { data, error } = await supabase
        .from('codigos')
        .select('id, reclamado_en, cancelado_en, aviso_nombre, aviso_ultimos4, aviso_puntos, aviso_meta, aviso_premio_listo')
        .eq('creado_por', estado.usuarioId)
        .gte('reclamado_en', desde)
        .order('reclamado_en', { ascending: true })
      if (!vigente()) return
      if (error) throw error
      for (const fila of data || []) alCambiarCodigo(fila, 'búsqueda al ponerse al día')
    } catch (e) {
      console.error('Error al buscar códigos reclamados:', e)
    }
  }

  function ponerseAlDia() {
    cargarPendientes()
    buscarReclamados()
  }

  async function conectarTiempoReal() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!vigente()) return
      estado.usuarioId = session?.user?.id || null
      if (!estado.usuarioId) return
      // Si quedó un canal de una visita anterior a esta pantalla, se cierra antes.
      cerrarTiempoRealCajero()
      // Nombre único por sesión: así nunca se reutiliza un canal que se está cerrando.
      canal = supabase
        .channel(`cajero-${estado.usuarioId}-${sesion}`)
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'codigos', filter: `creado_por=eq.${estado.usuarioId}` },
          payload => { if (vigente()) alCambiarCodigo(payload.new, 'Realtime') })
        .subscribe(status => {
          // Al conectar y al reconectar se revisa lo que pudo llegar mientras no había conexión.
          if (status === 'SUBSCRIBED' && vigente()) ponerseAlDia()
        })
      canalCajero = canal
    } catch (e) {
      console.error('Error al conectar el tiempo real:', e)
    }
  }

  // Cada segundo: contadores y, al caducar, el código desaparece solo.
  const reloj = setInterval(() => {
    if (!vigente()) { limpiar(); return }
    const vencidos = estado.codigos.filter(c => restante(c) <= 0)
    if (vencidos.length) {
      if (estado.abierto && vencidos.some(c => c.id === estado.abierto.id)) {
        cerrarQR(); avisar('El código caducó. Genera otro si el cliente aún no escanea.')
      }
      estado.codigos = estado.codigos.filter(c => restante(c) > 0)
      pintarLista()
      return
    }
    if (estado.abierto) $('cj-qr-tiempo').textContent = formatoTiempo(restante(estado.abierto))
    for (const c of estado.codigos) {
      const el = document.querySelector(`[data-tiempo="${c.id}"]`)
      if (el) el.textContent = `Caduca en ${formatoTiempo(restante(c))}`
    }
  }, 1000)

  // Al volver a la app (o recuperar señal) se recargan los pendientes y se
  // muestran los avisos que no llegaron por tiempo real.
  const alVolver = () => {
    if (document.visibilityState !== 'visible') return
    ponerseAlDia()
    if (estado.abierto) mantenerPantalla(true)
  }
  document.addEventListener('visibilitychange', alVolver)
  window.addEventListener('online', alVolver)

  function limpiar() {
    clearInterval(reloj)
    clearInterval(sondeo.intervalo); sondeo.intervalo = null
    clearTimeout(avisos.temporizador)
    document.removeEventListener('visibilitychange', alVolver)
    window.removeEventListener('online', alVolver)
    document.removeEventListener('keydown', teclaFisicaCanje)
    clearInterval(canje.relojBloqueo)
    mantenerPantalla(false)
    if (canal) {
      supabase.removeChannel(canal)
      if (canalCajero === canal) canalCajero = null
      canal = null
    }
  }

  // ── Captura manual (2H): el cliente no pudo escanear ──
  // Mismas reglas que el QR, pero se registra como "manual" con el mesero que
  // la hizo, y cada mesero tiene un tope diario (lo decide el servidor).
  const manual = { enviando: false }

  function errorManual(campo, texto) {
    const wrap = $(`cj-manual-${campo}-wrap`); const el = $(`cj-manual-${campo}-error`)
    if (!wrap || !el) return
    wrap.classList.toggle('error', !!texto)
    el.textContent = texto || ''
    el.hidden = !texto
  }
  const avisarManual = texto => { $('cj-manual-msg').innerHTML = texto ? `<div class="cl-aviso" role="alert">${texto}</div>` : '' }

  function abrirManual() {
    $('cj-manual-tel').value = ''; $('cj-manual-nombre').value = ''
    errorManual('tel', ''); errorManual('nombre', ''); avisarManual('')
    $('cj-manual').hidden = false
    setTimeout(() => $('cj-manual-tel')?.focus(), 50)
  }
  const cerrarManual = () => { $('cj-manual').hidden = true }

  function mensajeManual(e) {
    const m = e?.message || ''
    if (m.includes('YA_SUMO_HOY')) return 'Este cliente ya sumó hoy.'
    if (m.includes('NUMERO_EXCLUIDO')) return 'Este número no gana puntos.'
    if (m.includes('LIMITE_MANUALES')) {
      return e?.details === 'desactivada'
        ? 'La captura manual está desactivada en este negocio. Pide al cliente que escanee el código.'
        : 'Llegaste al tope de capturas manuales de hoy. Pide al cliente que escanee el código.'
    }
    return mensajeCajero(e, estado.max)
  }

  async function sumarManual() {
    if (manual.enviando) return
    // Si pegaron el número con lada (52… o 521…), se queda con los 10 dígitos.
    let digitos = $('cj-manual-tel').value.replace(/\D/g, '')
    if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2)
    else if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3)
    const nombre = $('cj-manual-nombre').value.trim()
    errorManual('tel', ''); errorManual('nombre', ''); avisarManual('')
    if (digitos.length !== 10) { errorManual('tel', 'Escribe los 10 dígitos del número.'); return }

    const btn = $('cj-manual-sumar')
    manual.enviando = true; btn.disabled = true; btn.textContent = 'Sumando...'
    try {
      const { data, error } = await supabase.rpc('visita_manual', { p_telefono: digitos, p_nombre: nombre || null })
      if (!vigente()) return
      if (error) throw error
      cerrarManual()
      // Mismo aviso verde (o dorado) que el QR, marcado como captura manual.
      encolarAviso({
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        reclamado_en: new Date().toISOString(),
        aviso_nombre: data.nombre, aviso_ultimos4: data.ultimos4,
        aviso_puntos: data.puntos, aviso_meta: data.meta,
        aviso_premio_listo: data.premio_listo === true,
        manual: true,
      }, 'captura manual')
    } catch (e) {
      if (!vigente()) return
      const m = e?.message || ''
      if (m.includes('TELEFONO_INVALIDO')) errorManual('tel', 'Revisa el número: deben ser 10 dígitos.')
      else if (m.includes('NOMBRE_INVALIDO')) errorManual('nombre', 'Es cliente nuevo: escribe su primer nombre.')
      else { console.error('Error en la captura manual:', e); avisarManual(mensajeManual(e)) }
    } finally {
      manual.enviando = false
      if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Sumar punto' }
    }
  }

  $('cj-manual-abrir').addEventListener('click', abrirManual)
  $('cj-manual-cerrar').addEventListener('click', cerrarManual)
  $('cj-manual-sumar').addEventListener('click', sumarManual)
  $('cj-manual-tel').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); errorManual('tel', '') })
  $('cj-manual-tel').addEventListener('keydown', e => { if (e.key === 'Enter') $('cj-manual-nombre').focus() })
  $('cj-manual-nombre').addEventListener('input', () => errorManual('nombre', ''))
  $('cj-manual-nombre').addEventListener('keydown', e => { if (e.key === 'Enter') sumarManual() })

  // ── Canje del premio (Fase 3): la llave del mesero ──
  // El mesero escribe el código de 4 dígitos que le muestra el cliente, ve el
  // premio, el nombre y los últimos 4 dígitos, y confirma la entrega.
  // Todo lo decide el servidor: si el código existe, si sigue vigente, si el
  // cliente tiene los puntos y cuántos intentos fallidos lleva el mesero.
  const canje = { digitos: '', consultando: false, confirmando: false, ficha: null, bloqueoHasta: 0, relojBloqueo: null }
  const canjeAbierto = () => $('cj-canje') && !$('cj-canje').hidden
  const bloqueadoCanje = () => canje.bloqueoHasta > Date.now()

  function mensajeCanje(texto, tipo = '') {
    const el = $('cj-canje-msg')
    if (!el) return
    el.className = `cj-canje-msg ${tipo}`
    el.textContent = texto || ''
  }

  function pintarCasillas(error = false) {
    const el = $('cj-canje-casillas')
    if (!el) return
    el.innerHTML = [0, 1, 2, 3].map(i =>
      `<span class="cj-canje-casilla${i < canje.digitos.length ? ' llena' : ''}">${canje.digitos[i] || ''}</span>`).join('')
    el.classList.toggle('error', error)
    // La sacudida se reinicia en cada error, aunque el anterior siga en pantalla.
    el.classList.remove('sacudir')
    if (error) { void el.offsetWidth; el.classList.add('sacudir') }
  }

  function activarTeclado(activo) {
    document.querySelectorAll('#cj-teclado .cj-tecla').forEach(b => { b.disabled = !activo })
  }

  function pintarTeclado() {
    const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'borrar']
    $('cj-canje-caja').innerHTML = `
      <div class="cj-qr-titulo">Canjear premio</div>
      <div class="cj-qr-sub">Escribe el código que te muestra el cliente</div>
      <div class="cj-canje-casillas" id="cj-canje-casillas" aria-live="polite"></div>
      <div class="cj-canje-msg" id="cj-canje-msg" role="status"></div>
      <div class="cj-teclado" id="cj-teclado">
        ${teclas.map(t => t === ''
          ? '<span class="cj-tecla vacia" aria-hidden="true"></span>'
          : `<button type="button" class="cj-tecla" data-tecla="${t}"${t === 'borrar' ? ' aria-label="Borrar"' : ''}>${t === 'borrar' ? '⌫' : t}</button>`).join('')}
      </div>
      <button type="button" class="s-btn ghost cj-canje-pie" data-canje="cerrar">Cerrar</button>`
    pintarCasillas()
  }

  function pintarFicha() {
    const f = canje.ficha
    $('cj-canje-caja').innerHTML = `
      <div class="cj-canje-ficha">
        <div class="cj-canje-premio-lbl">Premio</div>
        <div class="cj-canje-premio">${esc(f.premio)}</div>
        <div class="cj-canje-quien">${esc(f.nombre || 'Cliente')}</div>
        <div class="cj-canje-tel">···${esc(f.ultimos4 || '····')}</div>
        <div class="cj-canje-alerta">Confírmalo solo si ves al cliente</div>
      </div>
      <div class="cj-canje-msg error" id="cj-canje-msg" role="alert"></div>
      <button type="button" class="cj-canje-confirmar" id="cj-canje-confirmar" data-canje="confirmar">Confirmar entrega</button>
      <button type="button" class="s-btn ghost cj-canje-pie" data-canje="cerrar">Cancelar</button>`
  }

  function abrirCanje() {
    canje.digitos = ''; canje.ficha = null
    pintarTeclado()
    $('cj-canje').hidden = false
    document.addEventListener('keydown', teclaFisicaCanje)
    // Si el mesero sigue bloqueado por intentos fallidos, el teclado sigue apagado.
    if (bloqueadoCanje()) bloquearCanje((canje.bloqueoHasta - Date.now()) / 1000)
  }

  function cerrarCanje() {
    $('cj-canje').hidden = true
    canje.digitos = ''; canje.ficha = null
    document.removeEventListener('keydown', teclaFisicaCanje)
  }

  // Tras 5 códigos incorrectos seguidos, el servidor bloquea 5 minutos.
  function bloquearCanje(segundos) {
    canje.bloqueoHasta = Date.now() + Math.max(1, Number(segundos) || 300) * 1000
    clearInterval(canje.relojBloqueo)
    const tic = () => {
      const ms = canje.bloqueoHasta - Date.now()
      if (ms <= 0 || !vigente()) {
        clearInterval(canje.relojBloqueo); canje.relojBloqueo = null
        if (vigente() && canjeAbierto() && !canje.ficha) { activarTeclado(true); mensajeCanje('') }
        return
      }
      if (canjeAbierto() && !canje.ficha) {
        activarTeclado(false)
        mensajeCanje(`Demasiados códigos incorrectos. Espera ${formatoTiempo(ms)} para intentar de nuevo.`, 'error')
      }
    }
    canje.relojBloqueo = setInterval(tic, 1000)
    tic()
  }

  function teclear(t) {
    if (canje.ficha || canje.consultando || bloqueadoCanje()) return
    if (t === 'borrar') canje.digitos = canje.digitos.slice(0, -1)
    else if (/^[0-9]$/.test(t) && canje.digitos.length < 4) canje.digitos += t
    else return
    mensajeCanje('')
    pintarCasillas()
    // Al cuarto dígito se busca solo: un toque menos para el mesero.
    if (canje.digitos.length === 4) consultarCanje()
  }

  // Teclado físico (tablet o computadora en caja). Enter NO confirma la entrega:
  // confirmar siempre es un toque a propósito en el botón.
  function teclaFisicaCanje(e) {
    if (!canjeAbierto()) return
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); teclear(e.key) }
    else if (e.key === 'Backspace') { e.preventDefault(); teclear('borrar') }
    else if (e.key === 'Escape') cerrarCanje()
  }

  async function consultarCanje() {
    canje.consultando = true
    activarTeclado(false); mensajeCanje('Buscando...')
    try {
      const { data, error } = await supabase.rpc('consultar_canje', { p_codigo: canje.digitos })
      if (!vigente() || !canjeAbierto()) return
      if (error) throw error
      if (data?.estado === 'pendiente') { canje.ficha = data; pintarFicha(); return }
      canje.digitos = ''; pintarCasillas(true)
      if (data?.estado === 'entregado') return mensajeCanje('Ese premio ya se entregó.', 'error')
      if (data?.estado === 'cancelado') return mensajeCanje('El cliente canceló ese código. Pídele que genere otro.', 'error')
      if (data?.estado === 'caducado') return mensajeCanje('Ese código caducó. Pídele al cliente que genere otro.', 'error')
      if (data?.bloqueado_segundos > 0) return bloquearCanje(data.bloqueado_segundos)
      const quedan = Number(data?.intentos_restantes)
      // Solo se avisa de los intentos cuando ya quedan pocos.
      mensajeCanje(quedan > 0 && quedan <= 2
        ? `Código incorrecto. ${quedan === 1 ? 'Te queda 1 intento.' : `Te quedan ${quedan} intentos.`}`
        : 'Código incorrecto. Revísalo con el cliente.', 'error')
    } catch (e) {
      if (!vigente() || !canjeAbierto()) return
      canje.digitos = ''; pintarCasillas(true)
      if (e?.message?.includes('DEMASIADOS_INTENTOS')) return bloquearCanje(Number(e?.details) || 300)
      console.error('Error al consultar el canje:', e)
      mensajeCanje(mensajeCajero(e, estado.max), 'error')
    } finally {
      canje.consultando = false
      if (vigente() && !canje.ficha && !bloqueadoCanje()) activarTeclado(true)
    }
  }

  async function confirmarCanje() {
    const f = canje.ficha; const btn = $('cj-canje-confirmar')
    if (!f || canje.confirmando || !btn) return
    canje.confirmando = true; btn.disabled = true; btn.textContent = 'Confirmando...'
    try {
      const { data, error } = await supabase.rpc('confirmar_canje', { p_canje_id: f.canje_id })
      if (!vigente()) return
      if (error) throw error
      cerrarCanje()
      encolarAviso({
        id: `canje-${f.canje_id}`,
        reclamado_en: new Date().toISOString(),
        canje: true,
        premio_texto: data.premio,
        aviso_nombre: data.nombre, aviso_ultimos4: data.ultimos4,
        aviso_puntos: data.puntos, aviso_meta: data.meta,
      }, 'canje')
    } catch (e) {
      if (!vigente()) return
      const m = e?.message || ''
      const texto = m.includes('CANJE_YA_ENTREGADO') ? 'Este premio ya se entregó.'
        : m.includes('CANJE_CANCELADO') ? 'El cliente canceló este código.'
        : m.includes('CANJE_CADUCADO') ? 'El código caducó. Pídele al cliente que genere otro.'
        : m.includes('PUNTOS_INSUFICIENTES') ? 'El cliente ya no tiene los puntos para este premio.'
        : m.includes('CANJE_NO_ENCONTRADO') ? 'Ese código ya no está disponible.'
        : mensajeCajero(e, estado.max)
      mensajeCanje(texto, 'error')
      // Si el canje ya no se puede entregar, reintentar no sirve: se quita el botón.
      // (Con un error de red sí se puede reintentar: confirmar dos veces nunca
      // descuenta dos veces, la segunda responde "ya se entregó".)
      if (/CANJE_|PUNTOS_INSUFICIENTES/.test(m)) btn.remove()
      console.error('Error al confirmar el canje:', e)
    } finally {
      canje.confirmando = false
      if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Confirmar entrega' }
    }
  }

  $('cj-canjear').addEventListener('click', abrirCanje)
  $('cj-canje').addEventListener('click', e => {
    const tecla = e.target.closest('[data-tecla]')
    if (tecla && !tecla.disabled) return teclear(tecla.dataset.tecla)
    const accion = e.target.closest('[data-canje]')?.dataset.canje
    if (accion === 'cerrar') cerrarCanje()
    else if (accion === 'confirmar') confirmarCanje()
  })

  $('cj-cobre').addEventListener('click', cobre)
  $('cj-qr-cancelar').addEventListener('click', cancelar)
  $('cj-qr-cerrar').addEventListener('click', () => { cerrarQR(); cargarPendientes() })
  $('cj-lista').addEventListener('click', e => {
    const fila = e.target.closest('.cj-fila')
    const c = fila && estado.codigos.find(x => x.id === fila.dataset.id)
    if (c) mostrarQR(c)
  })

  cargarAvisosVistos()
  cargarPendientes()
  conectarTiempoReal()
  try {
    const { data: nd } = await supabase.from('negocios').select('color_principal').eq('id', negocio.id).single()
    if (vigente() && nd?.color_principal) aplicarColorNegocio(nd.color_principal)
  } catch (e) {}
}

// QR fijo del mostrador (#/negocio/<id>): solo para CONSULTAR. Si el teléfono
// ya está recordado muestra la tarjeta; si no, "Pide tu código al pagar"
// (decisión 4 del plan). No registra clientes ni pide números.
export function paginaQRNegocio() {
  inyectarEstilos()
  return `<div id="cl-app">${cargandoCliente(true)}</div>`
}

export function initQRNegocio(negocioId) {
  return initTarjeta(negocioId, { desdeMostrador: true })
}

function abrirAvisoPrivacidadCliente() {
  const modal = document.createElement('div')
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:flex-end;justify-content:center;z-index:9999;animation:sFadeIn 0.2s ease'
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:24px 20px calc(40px + env(safe-area-inset-bottom));width:100%;max-width:480px;max-height:80vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-family:'Sora',sans-serif;font-size:16px;font-weight:800;color:#0f172a">Aviso de Privacidad</div>
        <button id="cerrar-privacidad" style="background:#f1f5f9;border:none;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:13px;color:#64748b">Cerrar</button>
      </div>
      <div style="font-size:13px;color:#334155;line-height:1.7">
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Qué datos guardamos?</p>
        <p style="margin-bottom:12px">Solo tu nombre y número de teléfono. Nada más.</p>
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Para qué se usan?</p>
        <p style="margin-bottom:12px">Únicamente para identificarte en el programa de lealtad y registrar tus visitas. No se venden ni se comparten con terceros.</p>
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Puedo ver o eliminar mis datos?</p>
        <p style="margin-bottom:12px">Sí. Escríbenos a <a href="mailto:${CORREO_CONTACTO}" style="color:#0a5c47;font-weight:600">${CORREO_CONTACTO}</a> para pedir acceso a tus datos o que los borremos. También puedes pedirlo en el negocio donde te registraste.</p>
        <p style="font-weight:600;color:#0f172a;margin-bottom:6px">¿Dudas?</p>
        <p style="margin-bottom:12px">Escríbenos a <a href="mailto:${CORREO_CONTACTO}" style="color:#0a5c47;font-weight:600">${CORREO_CONTACTO}</a>.</p>
        <p style="font-size:11px;color:#94a3b8;margin-top:16px">En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) de México.</p>
      </div>
    </div>
  `
  document.body.appendChild(modal)
  modal.querySelector('#cerrar-privacidad')?.addEventListener('click', () => modal.remove())
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
}


// ═══════════════════════════════════════════════════════════
// CLIENTE: reclamar el punto (#/c/<negocio>/<codigo>) y tarjeta (#/tarjeta/<negocio>)
// ═══════════════════════════════════════════════════════════
const AZUL_RESPALDO = '#2B4ACB'

// Igual que en el cajero: cada pantalla del cliente abre una "sesión" y las
// respuestas que llegan tarde de una sesión anterior se ignoran.
let clienteSesion = 0

function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}

// El token que recuerda al cliente vive en su teléfono, uno por negocio.
// localStorage puede fallar (modo privado, datos bloqueados): todo va en try/catch.
const claveToken = negocioId => `sello_token_${negocioId}`
function leerToken(negocioId) { try { return localStorage.getItem(claveToken(negocioId)) } catch (e) { return null } }
function guardarToken(negocioId, token) { try { localStorage.setItem(claveToken(negocioId), token) } catch (e) {} }
function borrarToken(negocioId) { try { localStorage.removeItem(claveToken(negocioId)) } catch (e) {} }

function sinInternet(error) {
  return navigator.onLine === false || /Failed to fetch|NetworkError|Load failed/i.test(error?.message || '')
}

function palomitaSVG(size = 18, color = '#ffffff') {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

// ── Identidad del negocio (4E) ──
// El negocio es el protagonista (logo o inicial en su color, nombre y su
// mensaje de agradecimiento); Sello va pequeño arriba y en un pie discreto.
// Pie "Hecho con Sello": para el plan Pro bastará con decidir aquí, por
// negocio, si se muestra (por ejemplo con un campo del negocio).
const MOSTRAR_PIE_SELLO = true
// A dónde lleva "Hecho con Sello". Vacía = texto sin enlace (se ve igual).
// Solo se acepta una dirección https://.
const SELLO_URL = ''
function piSelloHTML() {
  if (!MOSTRAR_PIE_SELLO) return ''
  const url = /^https:\/\/[^\s"'<>]+$/.test(SELLO_URL) ? SELLO_URL : ''
  return url
    ? `<p class="cl-pie-sello"><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Hecho con Sello</a></p>`
    : `<p class="cl-pie-sello">Hecho con Sello</p>`
}

// El logo llega como ruta del bucket público "logos" (la valida el servidor);
// aquí se vuelve a revisar la forma antes de armar la URL.
const RUTA_LOGO = /^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,64}\.(png|jpe?g|webp)$/
function urlLogo(ruta) {
  if (!ruta || !RUTA_LOGO.test(ruta)) return null
  return supabase.storage.from('logos').getPublicUrl(ruta).data?.publicUrl || null
}
function inicialNegocio(nombre) {
  const letra = Array.from(String(nombre || '').trim())[0]
  return letra ? letra.toLocaleUpperCase('es-MX') : ''
}
// Logo del negocio; si no tiene (o no carga), un círculo con su inicial en su color.
function avatarNegocioHTML(nombre, url) {
  const ini = esc(inicialNegocio(nombre))
  if (!url) return `<span class="cl-avatar" aria-hidden="true">${ini}</span>`
  return `<span class="cl-avatar con-logo" aria-hidden="true">${ini}<img src="${esc(url)}" alt="" decoding="async" onerror="this.parentNode.classList.remove('con-logo');this.remove()"></span>`
}

// grande = tarjeta y pantallas de éxito: logo grande y mensaje de agradecimiento.
// celebra = "¡Ganaste 1 punto!" y "¡Disfruta tu premio!": sus botones no se achican.
function pantallaCliente({ negocio = null, cuerpo, acciones = '', gris = false, arriba = false, grande = false, celebra = false }) {
  const mensaje = grande ? String(negocio?.mensaje_gracias || '').trim() : ''
  return `
    <div class="cl-root${gris ? ' gris' : ''}${celebra ? ' celebra' : ''}">
      <div class="cl-wrap">
        <div class="cl-sello-top">${logoSVG(14, '#94a3b8')}<span>Sello</span></div>
        ${negocio?.nombre ? `<div class="cl-marca${grande ? ' grande' : ''}">
          ${avatarNegocioHTML(negocio.nombre, urlLogo(negocio.logo))}
          <span class="cl-marca-texto"><span class="cl-marca-nombre">${esc(negocio.nombre)}</span>${mensaje ? `<span class="cl-marca-mensaje">${esc(mensaje)}</span>` : ''}</span>
        </div>` : ''}
        <div class="cl-cuerpo${arriba ? ' arriba' : ''}">${cuerpo}</div>
        ${acciones ? `<div class="cl-acciones">${acciones}</div>` : ''}
        ${piSelloHTML()}
      </div>
    </div>
  `
}

function pantallaEstadoCliente({ negocio = null, icono, titulo, sub = '', acciones = '' }) {
  return pantallaCliente({
    negocio,
    cuerpo: `<div class="cl-estado-icono" aria-hidden="true">${icono}</div><h1 class="cl-titulo">${titulo}</h1>${sub ? `<p class="cl-sub">${sub}</p>` : ''}`,
    acciones,
  })
}

const cargandoCliente = (gris = false) => pantallaCliente({ cuerpo: '<p class="cl-cargando">Cargando...</p>', gris })

// Según la hora del celular del cliente.
function saludoPorHora(fecha = new Date()) {
  const h = fecha.getHours()
  if (h >= 5 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

// Tarjeta con los datos de reclamar_codigo o de tarjeta_por_token.
// modo = 'punto': arriba va "¡Ganaste 1 punto!" en lugar del saludo, y el
// sello recién ganado se llena con una animación.
// modo = 'premio': arriba va "¡Disfruta tu premio!" (el mesero acaba de
// entregarlo) y la tarjeta ya muestra los puntos que le quedan.
// Si completó la meta, aparece el botón "Canjear mi premio" (#cl-canjear);
// quien pinta la tarjeta conecta ese botón con iniciarCanje.
function tarjetaClienteHTML(negocio, t, modo = null) {
  const meta = Math.max(1, Number(t.meta) || 10)
  const puntos = Math.max(0, Number(t.puntos) || 0)
  const faltan = Math.max(0, meta - puntos)
  const nuevo = modo === 'punto' && puntos <= meta ? puntos - 1 : -1
  const sellos = meta <= 30
    ? Array.from({ length: meta }, (_, i) => {
        const lleno = i < puntos
        const contenido = i === meta - 1 ? '🎁' : lleno ? palomitaSVG(18, 'currentColor') : ''
        return `<span class="cl-sello${lleno ? ' lleno' : ''}${i === nuevo ? ' nuevo' : ''}">${contenido}</span>`
      }).join('')
    : ''
  const cabecera = modo === 'punto'
    ? `<div class="cl-exito-icono">${palomitaSVG(40, 'currentColor')}</div>
       <h1 class="cl-titulo">¡Ganaste 1 punto!</h1>
       <p class="cl-sub">${esc(t.nombre)}, ya llevas ${puntos} de ${meta}.</p>`
    : modo === 'premio'
    ? `<div class="cl-exito-icono emoji" aria-hidden="true">🎁</div>
       <h1 class="cl-titulo">¡Disfruta tu premio!</h1>
       <p class="cl-sub">${t.premio_entregado ? `${esc(t.premio_entregado)}. ` : ''}Ahora llevas ${puntos} de ${meta}.</p>`
    : `<h1 class="cl-titulo">${saludoPorHora()}, ${esc(t.nombre)}</h1>
       <p class="cl-sub">${negocio?.nombre ? 'Tu tarjeta de puntos' : 'Tu tarjeta en este negocio'}</p>`
  return pantallaCliente({
    negocio, gris: true, arriba: true, grande: true, celebra: modo === 'punto' || modo === 'premio',
    cuerpo: `
      ${cabecera}
      ${t.premio_listo ? `<div class="cl-listo">🎉 ¡Ya completaste tu meta!</div>
        <button class="cl-btn cl-canjear-btn" id="cl-canjear">Canjear mi premio</button>` : ''}
      <div class="cl-tarjeta">
        <div class="cl-progreso" aria-label="${puntos} de ${meta} puntos"><span class="cl-progreso-num">${puntos}</span><span class="cl-progreso-meta">/ ${meta}</span></div>
        <div class="cl-progreso-lbl">puntos</div>
        ${sellos ? `<div class="cl-sellos" style="grid-template-columns:repeat(${Math.min(meta, 5)},1fr)">${sellos}</div>` : ''}
      </div>
      <div class="cl-premio">
        <div class="cl-premio-lbl">TU PREMIO</div>
        <div class="cl-premio-nombre">${esc(t.premio || 'Pregúntale al mesero por tu premio')}</div>
        <div class="cl-premio-falta">${t.premio_listo ? '¡Ya es tuyo!' : faltan === 1 ? 'Te falta 1 para tu premio' : `Te faltan ${faltan} visitas`}</div>
      </div>
      <p class="cl-privacidad"><button type="button" id="cl-privacidad">Aviso de privacidad</button></p>
    `,
  })
}

export function paginaReclamar() {
  inyectarEstilos()
  return `<div id="cl-app">${cargandoCliente()}</div>`
}

export async function initReclamar(negocioId, codigo) {
  inyectarEstilos()
  aplicarColorNegocio(AZUL_RESPALDO)
  const sesion = ++clienteSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === clienteSesion && !!$('cl-app')
  const pintar = html => { if (vigente()) $('cl-app').innerHTML = html }
  let negocio = null
  let enCurso = false

  const ESTADOS = {
    usado: { icono: '🧾', titulo: 'Este código ya se usó', sub: 'Si aún no sumaste, pídele uno nuevo al mesero.' },
    caducado: { icono: '⏱️', titulo: 'Este código ya no sirve', sub: 'Pídele uno nuevo al mesero.' },
    cancelado: { icono: '⏱️', titulo: 'Este código ya no sirve', sub: 'Pídele uno nuevo al mesero.' },
    invalido: { icono: '🔍', titulo: 'No encontramos este código', sub: 'Pídele uno nuevo al mesero.' },
  }

  // Pantalla final sin nada que hacer; si el teléfono ya tiene tarjeta, ofrece verla.
  function mostrarEstado(estado) {
    const conTarjeta = !!leerToken(negocioId)
    pintar(pantallaEstadoCliente({
      negocio, ...estado,
      acciones: conTarjeta ? `<button class="cl-btn secundario" id="cl-ver-tarjeta">Ver mi tarjeta</button>` : '',
    }))
    $('cl-ver-tarjeta')?.addEventListener('click', () => navigate('tarjeta', negocioId))
  }

  function mostrarReintentar(titulo) {
    pintar(pantallaEstadoCliente({
      negocio, icono: '📶', titulo, sub: 'Revisa tu señal e intenta de nuevo.',
      acciones: `<button class="cl-btn" id="cl-reintentar">Reintentar</button>`,
    }))
    $('cl-reintentar')?.addEventListener('click', cargar)
  }

  const avisar = texto => { const el = $('cl-aviso'); if (el) el.innerHTML = texto ? `<div class="cl-aviso" role="alert">${texto}</div>` : '' }

  function errorCampo(campo, texto) {
    const wrap = $(`cl-${campo}-wrap`); const el = $(`cl-${campo}-error`)
    if (!wrap || !el) return
    wrap.classList.toggle('error', !!texto)
    el.textContent = texto || ''
    el.hidden = !texto
  }

  function mostrarConfirmacion(cliente) {
    pintar(pantallaCliente({
      negocio,
      cuerpo: `<h1 class="cl-titulo">${saludoPorHora()}, ¿eres ${esc(cliente.nombre)}?</h1>
        <p class="cl-sub">Tu número termina en <span class="cl-digitos">···${esc(cliente.ultimos4)}</span></p>`,
      acciones: `<div id="cl-aviso"></div>
        <button class="cl-btn" id="cl-sumar">Sí, sumar mi punto</button>
        <button class="cl-enlace" id="cl-no-soy">No soy yo</button>`,
    }))
    $('cl-sumar')?.addEventListener('click', () => reclamar({ p_token: leerToken(negocioId) }, $('cl-sumar'), 'confirmacion'))
    $('cl-no-soy')?.addEventListener('click', mostrarFormulario)
  }

  function mostrarFormulario() {
    pintar(pantallaCliente({
      negocio, arriba: true,
      cuerpo: `
        <h1 class="cl-titulo">Suma tu punto</h1>
        <p class="cl-sub">Solo la primera vez.</p>
        <div class="cl-campo">
          <label class="cl-label" for="cl-tel">Tu número de WhatsApp</label>
          <div class="cl-input-wrap" id="cl-tel-wrap"><span class="cl-prefijo">+52</span><input class="cl-input" id="cl-tel" type="tel" inputmode="numeric" autocomplete="tel-national" enterkeyhint="next" placeholder="10 dígitos" /></div>
          <p class="cl-error-campo" id="cl-tel-error" role="alert" hidden></p>
        </div>
        <div class="cl-campo">
          <label class="cl-label" for="cl-nombre">Tu primer nombre</label>
          <div class="cl-input-wrap" id="cl-nombre-wrap"><input class="cl-input" id="cl-nombre" type="text" autocomplete="given-name" autocapitalize="words" enterkeyhint="done" maxlength="30" placeholder="Ana" /></div>
          <p class="cl-error-campo" id="cl-nombre-error" role="alert" hidden></p>
        </div>
        <div style="margin-top:24px" id="cl-aviso"></div>
        <button class="cl-btn" id="cl-guardar" style="margin-top:0">Guardar mi punto</button>
        <p class="cl-privacidad">Guardamos tu número solo para llevar tus puntos. <button type="button" id="cl-privacidad">Aviso de privacidad</button></p>
      `,
    }))
    const tel = $('cl-tel'); const nombre = $('cl-nombre'); const btn = $('cl-guardar')
    if (!tel) return
    tel.addEventListener('input', () => { tel.value = tel.value.replace(/\D/g, ''); errorCampo('tel', '') })
    nombre.addEventListener('input', () => errorCampo('nombre', ''))
    tel.addEventListener('keydown', e => { if (e.key === 'Enter') nombre.focus() })
    nombre.addEventListener('keydown', e => { if (e.key === 'Enter') guardar() })
    btn.addEventListener('click', guardar)
    $('cl-privacidad')?.addEventListener('click', abrirAvisoPrivacidadCliente)

    function guardar() {
      // Si pegaron el número con lada (52… o 521…), se queda con los 10 dígitos.
      let digitos = tel.value.replace(/\D/g, '')
      if (digitos.length === 12 && digitos.startsWith('52')) digitos = digitos.slice(2)
      else if (digitos.length === 13 && digitos.startsWith('521')) digitos = digitos.slice(3)
      const nom = nombre.value.trim()
      let ok = true
      if (digitos.length !== 10) { errorCampo('tel', 'Escribe los 10 dígitos de tu número.'); ok = false }
      if (!nom) { errorCampo('nombre', 'Escribe tu primer nombre.'); ok = false }
      if (!ok) return
      reclamar({ p_telefono: digitos, p_nombre: nom }, btn, 'formulario')
    }
  }

  function mostrarExito(data) {
    const id = data.negocio_id || negocioId
    // La URL pasa a ser la de la tarjeta: si recarga o vuelve después, ve su tarjeta
    // en vez de un código ya usado.
    try { history.replaceState(null, '', `#/tarjeta/${id}`) } catch (e) {}
    pintar(tarjetaClienteHTML(negocio, data, 'punto'))
    $('cl-privacidad')?.addEventListener('click', abrirAvisoPrivacidadCliente)
    $('cl-canjear')?.addEventListener('click', () => iniciarCanje(id, negocio))
    // Esta pantalla ya es la tarjeta: al volver a la app se recarga como tarjeta.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      document.removeEventListener('visibilitychange', alVolver)
      if (vigente()) initTarjeta(id, { hayTarjeta: true })
    }
    document.addEventListener('visibilitychange', alVolver)
  }

  function manejarError(e, desde) {
    const m = e?.message || ''
    if (sinInternet(e)) return avisar('Necesitas internet para sumar tu punto.')
    if (m.includes('CODIGO_USADO')) return mostrarEstado(ESTADOS.usado)
    if (m.includes('CODIGO_CADUCADO') || m.includes('CODIGO_CANCELADO')) return mostrarEstado(ESTADOS.caducado)
    if (m.includes('CODIGO_INVALIDO') || m.includes('NEGOCIO_INACTIVO')) return mostrarEstado(ESTADOS.invalido)
    if (m.includes('YA_SUMO_HOY')) return mostrarEstado({ icono: '🙌', titulo: 'Ya sumaste hoy', sub: '¡Vuelve mañana!' })
    if (m.includes('NUMERO_EXCLUIDO')) {
      if (desde === 'formulario') return avisar('Este número no puede sumar puntos aquí.')
      return mostrarEstado({ icono: '🚫', titulo: 'Este número no puede sumar puntos aquí' })
    }
    // Con token, el servidor responde TELEFONO_INVALIDO si el token ya no sirve
    // (no encontró al cliente y no venía teléfono): se pide el número.
    if (desde === 'confirmacion' && /TOKEN_INVALIDO|TELEFONO_INVALIDO/.test(m)) {
      borrarToken(negocioId)
      return mostrarFormulario()
    }
    if (m.includes('TELEFONO_INVALIDO')) return errorCampo('tel', 'Revisa tu número: deben ser 10 dígitos.')
    if (m.includes('NOMBRE_INVALIDO')) return errorCampo('nombre', 'Escribe solo tu primer nombre, con letras.')
    console.error('Error al reclamar el código:', e)
    avisar('Algo salió mal. Intenta de nuevo.')
  }

  async function reclamar(params, btn, desde) {
    if (enCurso || !btn) return
    enCurso = true; btn.disabled = true; avisar('')
    const texto = btn.textContent; btn.textContent = 'Sumando...'
    try {
      const { data, error } = await supabase.rpc('reclamar_codigo', {
        p_codigo: codigo, p_token: null, p_telefono: null, p_nombre: null, ...params,
      })
      if (!vigente()) return
      if (error) throw error
      guardarToken(data.negocio_id || negocioId, data.token)
      mostrarExito(data)
    } catch (e) {
      if (vigente()) manejarError(e, desde)
    } finally {
      enCurso = false
      if (btn.isConnected) { btn.disabled = false; btn.textContent = texto }
    }
  }

  async function cargar() {
    pintar(cargandoCliente())
    try {
      const { data, error } = await supabase.rpc('ver_codigo', { p_codigo: codigo, p_token: leerToken(negocioId) })
      if (!vigente()) return
      if (error) throw error
      negocio = data?.negocio || null
      aplicarColorNegocio(negocio?.color_principal || AZUL_RESPALDO)
      if (data?.estado !== 'valido') return mostrarEstado(ESTADOS[data?.estado] || ESTADOS.invalido)
      // NUNCA se suma solo por el token: siempre un toque de confirmación.
      if (data.cliente) mostrarConfirmacion(data.cliente)
      else mostrarFormulario()
    } catch (e) {
      if (!vigente()) return
      console.error('Error al ver el código:', e)
      mostrarReintentar(sinInternet(e) ? 'Necesitas internet para sumar tu punto' : 'No pudimos abrir tu código')
    }
  }

  cargar()
}

export function paginaTarjeta() {
  inyectarEstilos()
  return `<div id="cl-app">${cargandoCliente(true)}</div>`
}

// La tarjeta se carga al abrirse y otra vez cada que la app vuelve al primer plano.
// hayTarjeta = true: ya hay una tarjeta en pantalla (la de "¡Ganaste 1 punto!"),
// así que se recarga sin pasar por "Cargando...".
// desdeMostrador = true: viene del QR fijo; sin tarjeta dice "Pide tu código al pagar".
export async function initTarjeta(negocioId, { hayTarjeta = false, desdeMostrador = false } = {}) {
  inyectarEstilos()
  if (!hayTarjeta) aplicarColorNegocio(AZUL_RESPALDO)
  const sesion = ++clienteSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === clienteSesion && !!$('cl-app')
  const pintar = html => { if (vigente()) $('cl-app').innerHTML = html }
  let mostrando = hayTarjeta
  let pedido = 0

  const sinTarjeta = async () => {
    mostrando = false
    if (!desdeMostrador) {
      return pintar(pantallaEstadoCliente({
        icono: '📷', titulo: 'Escanea el código al pagar', sub: 'para ver tu tarjeta.',
      }))
    }
    // En el mostrador se muestra el nombre del negocio (sin datos de clientes).
    let negocio = null
    try {
      const { data } = await supabase.rpc('public_get_business', { p_business_id: negocioId })
      negocio = data || null
    } catch (e) {}
    if (!vigente() || mostrando) return
    aplicarColorNegocio(negocio?.color_principal || AZUL_RESPALDO)
    pintar(pantallaEstadoCliente({
      negocio, icono: '🧾', titulo: 'Pide tu código al pagar', sub: 'Escanéalo con tu cámara y suma tu punto.',
    }))
  }

  async function cargar() {
    const token = leerToken(negocioId)
    if (!token) return sinTarjeta()
    const mio = ++pedido
    if (!mostrando) pintar(cargandoCliente(true))
    try {
      const { data, error } = await supabase.rpc('tarjeta_por_token', { p_token: token })
      if (!vigente() || mio !== pedido) return
      if (error) throw error
      // El token guardado para este negocio debe ser de una tarjeta de este negocio.
      if (data?.negocio?.id && data.negocio.id !== negocioId) throw new Error('TOKEN_INVALIDO')
      aplicarColorNegocio(data.negocio?.color_principal || AZUL_RESPALDO)
      pintar(tarjetaClienteHTML(data.negocio, data))
      $('cl-privacidad')?.addEventListener('click', abrirAvisoPrivacidadCliente)
      $('cl-canjear')?.addEventListener('click', () => iniciarCanje(negocioId, data.negocio, { desdeMostrador }))
      mostrando = true
    } catch (e) {
      if (!vigente() || mio !== pedido) return
      const m = e?.message || ''
      if (m.includes('TOKEN_INVALIDO')) { borrarToken(negocioId); return sinTarjeta() }
      if (m.includes('NEGOCIO_INACTIVO')) return sinTarjeta()
      // Sin señal al volver a la app: se queda la última tarjeta en pantalla.
      if (mostrando && sinInternet(e)) return
      mostrando = false
      console.error('Error al cargar la tarjeta:', e)
      pintar(pantallaEstadoCliente({
        icono: '📶',
        titulo: sinInternet(e) ? 'Necesitas internet para ver tu tarjeta' : 'No pudimos abrir tu tarjeta',
        sub: 'Revisa tu señal e intenta de nuevo.',
        acciones: `<button class="cl-btn" id="cl-reintentar">Reintentar</button>`,
      }))
      $('cl-reintentar')?.addEventListener('click', cargar)
    }
  }

  // Al salir de la pantalla, el listener se quita solo en el siguiente cambio.
  const alVolver = () => {
    if (!vigente()) { document.removeEventListener('visibilitychange', alVolver); return }
    if (document.visibilityState === 'visible') cargar()
  }
  document.addEventListener('visibilitychange', alVolver)

  cargar()
}

// ── Canje del premio (Fase 3): la llave del cliente ──
// El cliente toca "Canjear mi premio" y ve un código de 4 dígitos (5 minutos,
// un solo uso) para mostrárselo al mesero. Su celular pregunta cada ~3 s si
// el mesero ya confirmó la entrega.
// Abre su propia "sesión" de cliente: la tarjeta de abajo deja de recargarse
// sola mientras el código está en pantalla, y al terminar se vuelve a abrir.
// Si vuelve a tocar "Canjear" con un código vigente, el servidor devuelve el
// mismo código (no crea otro).
async function iniciarCanje(negocioId, negocio, opcionesTarjeta = {}) {
  const sesion = ++clienteSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === clienteSesion && !!$('cl-app')
  const pintar = html => { if (vigente()) $('cl-app').innerHTML = html }
  const token = leerToken(negocioId)
  // limite: momento (reloj del celular) en que caduca. Se calcula con los
  // segundos que dice el servidor, así no importa si la hora del celular está mal.
  let canje = null // { codigo, premio, limite }
  let terminado = false
  let consultando = false
  let reloj = null
  let sondeo = null
  let wakeLock = null

  const formato = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
  const avisar = texto => { const el = $('cl-aviso'); if (el) el.innerHTML = texto ? `<div class="cl-aviso" role="alert">${texto}</div>` : '' }

  // Pantalla encendida mientras el código está a la vista (si el navegador lo permite):
  // el cliente sostiene el celular frente al mesero y no debe apagarse.
  async function mantenerPantalla(encendida) {
    try {
      if (encendida && !wakeLock && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen')
        wakeLock.addEventListener('release', () => { wakeLock = null })
      }
      if (!encendida && wakeLock) await wakeLock.release()
    } catch (e) { wakeLock = null }
  }

  function limpiar() {
    clearInterval(reloj); clearInterval(sondeo); reloj = null; sondeo = null
    document.removeEventListener('visibilitychange', alVolver)
    mantenerPantalla(false)
  }

  function alVolver() {
    if (!vigente()) return limpiar()
    if (document.visibilityState !== 'visible') return
    mantenerPantalla(true)
    consultarEstado()
  }

  const verTarjeta = () => { terminado = true; limpiar(); if (vigente()) initTarjeta(negocioId, opcionesTarjeta) }

  function mostrarAviso({ icono, titulo, sub = '', reintentar = false, otroCodigo = false }) {
    terminado = true; limpiar()
    pintar(pantallaEstadoCliente({
      negocio, icono, titulo, sub,
      acciones: `${reintentar ? '<button class="cl-btn" id="cl-reintentar">Reintentar</button>' : ''}
        ${otroCodigo ? '<button class="cl-btn" id="cl-otro-codigo">Generar otro código</button>' : ''}
        <button class="${reintentar || otroCodigo ? 'cl-enlace' : 'cl-btn secundario'}" id="cl-ver-tarjeta">Ver mi tarjeta</button>`,
    }))
    $('cl-reintentar')?.addEventListener('click', () => iniciarCanje(negocioId, negocio, opcionesTarjeta))
    $('cl-otro-codigo')?.addEventListener('click', () => iniciarCanje(negocioId, negocio, opcionesTarjeta))
    $('cl-ver-tarjeta')?.addEventListener('click', verTarjeta)
  }

  const caducado = () => mostrarAviso({
    icono: '⏱️', titulo: 'Tu código caducó',
    sub: 'Tus puntos siguen ahí. Genera otro cuando estés con el mesero.', otroCodigo: true,
  })

  function mostrarCodigo() {
    pintar(pantallaCliente({
      negocio,
      cuerpo: `
        <p class="cl-canje-lbl">Tu código</p>
        <p class="cl-canje-codigo" aria-label="Código ${esc(canje.codigo.split('').join(' '))}">${esc(canje.codigo)}</p>
        <p class="cl-canje-tiempo" id="cl-canje-tiempo">${formato(canje.limite - Date.now())}</p>
        <h1 class="cl-canje-instr">Muéstraselo al mesero</h1>
        <p class="cl-canje-premio">${esc(canje.premio)}</p>`,
      acciones: `<div id="cl-aviso"></div>
        <button class="cl-btn secundario" id="cl-canje-cancelar">Cancelar</button>`,
    }))
    $('cl-canje-cancelar')?.addEventListener('click', cancelar)
    reloj = setInterval(tic, 1000)
    sondeo = setInterval(consultarEstado, 3000)
    document.addEventListener('visibilitychange', alVolver)
    mantenerPantalla(true)
  }

  // Cada segundo: cuenta regresiva. Al llegar a 0 se pregunta una última vez
  // al servidor (el mesero pudo confirmar justo antes) y luego se da por caducado.
  function tic() {
    if (!vigente()) return limpiar()
    if (terminado) return
    const ms = canje.limite - Date.now()
    const el = $('cl-canje-tiempo')
    if (el) { el.textContent = formato(ms); el.classList.toggle('poco', ms < 60 * 1000) }
    if (ms <= 0 && !consultando) consultarEstado(true)
  }

  async function consultarEstado(final = false) {
    if (!vigente()) return limpiar()
    if (terminado || consultando || !canje || (!final && document.hidden)) return
    consultando = true
    try {
      const { data, error } = await supabase.rpc('estado_canje', { p_token: token, p_codigo: canje.codigo })
      if (!vigente() || terminado) return
      if (error) throw error
      if (data?.estado === 'entregado') return entregado(data)
      if (data?.estado === 'caducado') return caducado()
      if (data?.estado === 'cancelado') return verTarjeta()
      // Sigue pendiente: se ajusta la cuenta regresiva a lo que dice el servidor.
      const seg = Number(data?.segundos_restantes)
      if (Number.isFinite(seg)) canje.limite = Date.now() + seg * 1000
      if (final && seg <= 0) caducado()
    } catch (e) {
      if (!vigente() || terminado) return
      const m = e?.message || ''
      if (m.includes('TOKEN_INVALIDO')) { borrarToken(negocioId); return verTarjeta() }
      if (m.includes('CANJE_NO_ENCONTRADO')) return verTarjeta()
      // Sin señal: se reintenta en la siguiente vuelta; al llegar a 0, se da por caducado.
      if (final) return caducado()
      if (!sinInternet(e)) console.error('Error al consultar el canje:', e)
    } finally {
      consultando = false
    }
  }

  // El mesero confirmó: "¡Disfruta tu premio!" sobre la tarjeta ya actualizada.
  async function entregado(data) {
    terminado = true; limpiar()
    try { navigator.vibrate?.([120, 60, 120]) } catch (e) {}
    try {
      const { data: t, error } = await supabase.rpc('tarjeta_por_token', { p_token: token })
      if (!vigente()) return
      if (error) throw error
      pintar(tarjetaClienteHTML(t.negocio, { ...t, premio_entregado: data?.premio || canje.premio }, 'premio'))
      $('cl-privacidad')?.addEventListener('click', abrirAvisoPrivacidadCliente)
      $('cl-canjear')?.addEventListener('click', () => iniciarCanje(negocioId, t.negocio, opcionesTarjeta))
      // Esta pantalla ya es la tarjeta: al volver a la app se recarga como tarjeta normal.
      const alVolverTarjeta = () => {
        if (document.visibilityState !== 'visible') return
        document.removeEventListener('visibilitychange', alVolverTarjeta)
        if (vigente()) initTarjeta(negocioId, { ...opcionesTarjeta, hayTarjeta: true })
      }
      document.addEventListener('visibilitychange', alVolverTarjeta)
    } catch (e) {
      if (!vigente()) return
      // Sin la tarjeta nueva (sin señal): al menos la celebración.
      pintar(pantallaEstadoCliente({
        negocio, icono: '🎁', titulo: '¡Disfruta tu premio!', sub: esc(data?.premio || canje.premio),
        acciones: '<button class="cl-btn" id="cl-ver-tarjeta">Ver mi tarjeta</button>',
      }))
      $('cl-ver-tarjeta')?.addEventListener('click', verTarjeta)
    }
  }

  async function cancelar() {
    const btn = $('cl-canje-cancelar')
    if (!btn || btn.disabled || terminado) return
    btn.disabled = true; btn.textContent = 'Cancelando...'; avisar('')
    try {
      const { error } = await supabase.rpc('cancelar_canje', { p_token: token, p_codigo: canje.codigo })
      if (!vigente() || terminado) return
      if (error) throw error
      verTarjeta()
    } catch (e) {
      if (!vigente() || terminado) return
      const m = e?.message || ''
      // El mesero lo confirmó justo antes de que tocara "Cancelar".
      if (m.includes('CANJE_YA_ENTREGADO')) return entregado({ premio: canje.premio })
      if (m.includes('TOKEN_INVALIDO')) { borrarToken(negocioId); return verTarjeta() }
      if (m.includes('CANJE_NO_ENCONTRADO')) return verTarjeta()
      if (!sinInternet(e)) console.error('Error al cancelar el canje:', e)
      avisar(sinInternet(e) ? 'Sin conexión. Revisa tu señal e intenta de nuevo.' : 'No se pudo cancelar. Intenta de nuevo.')
      if (btn.isConnected) { btn.disabled = false; btn.textContent = 'Cancelar' }
    }
  }

  async function crear() {
    if (!token) return verTarjeta()
    pintar(pantallaCliente({ negocio, cuerpo: '<p class="cl-cargando">Preparando tu código...</p>' }))
    try {
      const { data, error } = await supabase.rpc('crear_canje', { p_token: token })
      if (!vigente()) return
      if (error) throw error
      canje = {
        codigo: String(data.codigo),
        premio: data.premio || '',
        limite: Date.now() + Math.max(0, Number(data.segundos_restantes) || 0) * 1000,
      }
      mostrarCodigo()
    } catch (e) {
      if (!vigente()) return
      const m = e?.message || ''
      if (m.includes('TOKEN_INVALIDO')) { borrarToken(negocioId); return verTarjeta() }
      if (m.includes('PUNTOS_INSUFICIENTES')) return mostrarAviso({ icono: '🎯', titulo: 'Aún no completas tu tarjeta', sub: 'Sigue sumando visitas para tu premio.' })
      if (m.includes('NUMERO_EXCLUIDO')) return mostrarAviso({ icono: '🚫', titulo: 'Este número no puede canjear premios aquí' })
      if (m.includes('NEGOCIO_INACTIVO')) return mostrarAviso({ icono: '🔍', titulo: 'Este negocio no está disponible' })
      if (!sinInternet(e)) console.error('Error al crear el canje:', e)
      mostrarAviso({
        icono: '📶',
        titulo: sinInternet(e) ? 'Necesitas internet para canjear tu premio' : 'No pudimos crear tu código',
        sub: 'Revisa tu señal e intenta de nuevo.', reintentar: true,
      })
    }
  }

  crear()
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


// ── TÉRMINOS Y AVISO DE PRIVACIDAD (dueños) ─────────────────
// Página corta para el negocio. El aviso del cliente es otro y no cambia.
export function paginaTerminos() {
  inyectarEstilosDueno()
  return `
    <div class="ow ow-sello">
      <header class="ow-cab">
        ${logoSelloHTML(22)}
        <button class="ow-btn secundario chico" id="btn-terminos-volver">Volver</button>
      </header>
      <main class="ow-cuerpo" style="padding-bottom:40px">
        <div class="ow-tarjeta ow-texto-legal" style="margin-top:8px">
          <h1 class="ow-h1">Términos y Aviso de privacidad</h1>
          <p class="ow-sub">Para negocios que usan Sello.</p>

          <h2>Los datos de tus clientes son de tu negocio</h2>
          <p>Tu negocio es el responsable de los datos de sus clientes (primer nombre, teléfono y visitas) y de avisarles que se guardan. Sello los guarda y los procesa por ti, solo para llevar tu programa de lealtad.</p>

          <h2>Lo que hace Sello con ellos</h2>
          <p>Nada más. No los vende, no los comparte y no los usa para otros fines. Solo tú ves los datos de tus clientes.</p>

          <h2>Si un cliente pide ver, corregir o borrar sus datos</h2>
          <p>Escríbenos a <a href="mailto:${CORREO_CONTACTO}">${CORREO_CONTACTO}</a> y lo hacemos por ti.</p>

          <h2>Tu cuenta</h2>
          <p>Guardamos el nombre de tu negocio y tu correo. Tu contraseña se guarda cifrada.</p>

          <p style="margin-top:20px;font-size:13px">Conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (México).</p>
        </div>
      </main>
    </div>
  `
}

export function initTerminos() {
  inyectarEstilosDueno()
  document.getElementById('btn-terminos-volver')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back()
    else navigate('login')
  })
}

export async function paginaLanding(negocioId) {
  inyectarEstilos()
  try {
    const { data: resumen, error } = await supabase.rpc('public_get_landing', { p_business_id: negocioId })
    if (error) throw error
    if (!resumen?.business) return `<div style="padding:40px;text-align:center">No encontrado</div>`
    const negocio = resumen.business
    aplicarColorNegocio(negocio.color_principal)
    const niveles = resumen.levels || []
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
          ${urlLogo(negocio.logo) ? `<img src="${esc(urlLogo(negocio.logo))}" alt="" style="width:80px;height:80px;border-radius:20px;object-fit:contain;background:#ffffff;margin-bottom:16px" onerror="this.style.display='none'" />` : `<div style="margin-bottom:16px">${logoSVG(40, 'rgba(255,255,255,0.5)')}</div>`}
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
          <div style="background:white;border-radius:14px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)"><div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:${DS.green800}">${resumen.customer_count}</div><div style="font-size:12px;color:${DS.gray500};margin-top:4px">Clientes registrados</div></div>
          <div style="background:white;border-radius:14px;padding:20px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)"><div style="font-family:'Sora',sans-serif;font-size:32px;font-weight:800;color:${DS.green800}">${resumen.visit_count}</div><div style="font-size:12px;color:${DS.gray500};margin-top:4px">Visitas registradas</div></div>
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

// ═══════════════════════════════════════════════════════════
// PANEL DEL DUEÑO (Fase 4)
// Pestaña "Resumen": en 3 segundos, si Sello le está trayendo clientes de
// vuelta. Todo lo calcula el servidor (Fase B: resumen_inicio,
// resumen_periodo, clientes_cerca_premio, actividad_reciente,
// clientes_inactivos y logros_lista); el navegador solo pinta.
// Pestaña "Personalización": programa, ventas, tarjeta de los clientes y
// exportar (con la página pública). Pestaña "Equipo": cómo va el equipo,
// visitas recientes, meseros, personal y QR abiertos.
// Estilos: inyectarEstilosDueno (todo dentro de .ow).
// ═══════════════════════════════════════════════════════════
const PLANTILLAS_PREMIO = ['Un postre gratis', 'Una bebida gratis', '10% de descuento', '2×1']

// Exportar la lista de clientes solo en el plan Pro (aún no existe el plan:
// se queda en false; no depende de la base de datos).
const PLAN_EXPORTAR_SOLO_PRO = false

// "Color libre" (selector de cualquier color) solo en Pro. Con true no aparece
// para nadie (aún no hay plan Pro). El servidor acepta cualquier #rrggbb.
const PLAN_COLOR_LIBRE_SOLO_PRO = true

// Mensaje de agradecimiento de la tarjeta (4E): máx. 40 caracteres, como el servidor.
const MENSAJE_GRACIAS_MAX = 40
const PLANTILLAS_MENSAJE = ['¡Gracias por tu visita!', '¡Qué gusto verte de nuevo!', 'Gracias por preferirnos']

// Límites del ticket promedio y del costo del premio (los mismos que revisa el servidor).
const TICKET_MAX = 100000
const COSTO_MAX = 100000

// Paleta de la tarjeta del cliente: 12 colores, todos con contraste de al
// menos 4.5:1 con texto blanco (fórmula de WCAG, la misma de textoSobreColor).
// Un color guardado que ya no esté aquí se ofrece como "Tu color actual".
const COLORES_TARJETA = [
  { nombre: 'Azul marino', valor: '#1e3a5f' },       // 11.50:1
  { nombre: 'Azul', valor: '#1d4ed8' },              //  6.70:1
  { nombre: 'Azul cielo oscuro', valor: '#0369a1' }, //  5.93:1
  { nombre: 'Turquesa', valor: '#0f766e' },          //  5.47:1
  { nombre: 'Verde', valor: '#0a5c47' },             //  7.97:1
  { nombre: 'Verde olivo', valor: '#4d6418' },       //  6.66:1
  { nombre: 'Mostaza oscuro', valor: '#8a6100' },    //  5.54:1
  { nombre: 'Naranja quemado', valor: '#b2440c' },   //  5.64:1
  { nombre: 'Rojo', valor: '#b91c1c' },              //  6.47:1
  { nombre: 'Vino', valor: '#9f1239' },              //  8.02:1
  { nombre: 'Morado', valor: '#6d28d9' },            //  7.10:1
  { nombre: 'Gris carbón', valor: '#1f2937' },       // 14.68:1
]
// El de un negocio nuevo (alta_negocio) y el de respaldo.
const COLOR_TARJETA_INICIAL = '#0a5c47'
// Variables de la vista previa para un color (fondo, texto encima y como texto).
const varsVista = c => `--vista-color:${c};--vista-texto:${textoSobreColor(c)};--vista-tinta:${tintaSobreBlanco(c)}`
const esColorHex = c => /^#[0-9a-f]{6}$/i.test(String(c || ''))

// "+529981234567" → "998 123 4567"
function telefonoLegible(e164) {
  const d = String(e164 || '').replace(/^\+52/, '')
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : esc(e164)
}

const formatoPesos = n => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(Number(n) || 0)
const formatoNumero = n => new Intl.NumberFormat('es-MX').format(Number(n) || 0)

// "120" o "120.50" o "120,50" → 120.5; vacío → null; texto inválido → NaN.
function leerPesos(texto) {
  const t = String(texto || '').trim().replace(/[$\s]/g, '').replace(',', '.')
  if (!t) return null
  return /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : NaN
}

const avisoOk = texto => `<p class="ow-msg-ok" role="status">${texto}</p>`
const avisoError = texto => `<p class="ow-msg-error" role="alert">${texto}</p>`

function mensajeDueno(error) {
  const m = error?.message || ''
  if (sinInternet(error)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (m.includes('META_INVALIDA')) return 'Las visitas para el premio deben ser de 1 a 100.'
  if (m.includes('PREMIO_INVALIDO')) return 'Escribe el premio (máximo 80 letras).'
  if (m.includes('MAX_CODIGOS_INVALIDO')) return 'Los QR abiertos deben ser de 1 a 50.'
  if (m.includes('TICKET_INVALIDO')) return `Lo que gasta un cliente debe ser de $1 a ${formatoPesos(TICKET_MAX)}, o déjalo vacío.`
  if (m.includes('COSTO_INVALIDO')) return `El costo del premio debe ser de $0 a ${formatoPesos(COSTO_MAX)}, o déjalo vacío.`
  if (m.includes('TELEFONO_INVALIDO')) return 'Escribe los 10 dígitos del número.'
  if (m.includes('NO_ENCONTRADO')) return 'Ese número ya no estaba en la lista.'
  if (m.includes('COLOR_INVALIDO')) return 'No pudimos guardar ese color. Intenta con otro.'
  if (m.includes('LOGO_INVALIDO')) return 'No pudimos guardar el logo. Vuelve a subirlo.'
  if (m.includes('MENSAJE_INVALIDO')) return `El mensaje debe tener máximo ${MENSAJE_GRACIAS_MAX} letras.`
  if (m.includes('Acceso denegado')) return 'Solo el dueño puede ver y cambiar esto. Sal y vuelve a entrar.'
  return 'Algo salió mal. Intenta de nuevo.'
}

// Pestaña elegida: se recuerda en esta pestaña del navegador.
const CLAVE_PESTANA_DUENO = 'sello_pestana_dueno'
function leerPestanaDueno() { try { const p = sessionStorage.getItem(CLAVE_PESTANA_DUENO); return p === 'ajustes' || p === 'equipo' ? p : 'resumen' } catch (e) { return 'resumen' } }
function guardarPestanaDueno(p) { try { sessionStorage.setItem(CLAVE_PESTANA_DUENO, p) } catch (e) {} }

// Esqueletos de carga: la forma del panel aparece al instante, nunca en blanco.
const bloqueEsq = alto => `<div class="ow-esq" style="height:${alto}px;margin-bottom:16px"></div>`
const esqueletoResumen = () => [124, 88, 300, 88, 150].map(bloqueEsq).join('')
const esqueletoAjustes = () => [360, 300, 160].map(bloqueEsq).join('')

// Tarjeta de error con "Reintentar" (nunca pantalla en blanco).
function errorPanelHTML(texto, idBoton) {
  return `<div class="ow-tarjeta">
    <p style="margin-bottom:12px">${texto}</p>
    <button class="ow-btn secundario" id="${idBoton}">Reintentar</button>
  </div>`
}

// ── Resumen (Fase B) ──
// Todo sale de supabase/fase-7-resumen.sql (resumen_inicio, resumen_periodo,
// clientes_cerca_premio, actividad_reciente) y de
// clientes_inactivos (Fase 4). Colores con significado: verde = crecimiento,
// ámbar = oportunidad, gris azulado = información. Nada en rojo: si un número
// baja, su comparación se ve en gris.
const PERIODOS_RESUMEN = {
  mes: { boton: 'Mes', titulo: 'Este mes', anterior: 'mes pasado', primero: 'Tu primer mes' },
  semana: { boton: 'Semana', titulo: 'Esta semana', anterior: 'semana pasada', primero: 'Tu primera semana' },
}

// Mes por defecto; Semana si el mes anterior no tiene con qué comparar y la
// semana anterior sí.
function periodoInicialResumen(d) {
  return d?.mes?.anterior_con_datos !== true && d?.semana?.anterior_con_datos === true ? 'semana' : 'mes'
}

// Comparación contra el periodo anterior: sube = verde; baja o igual = gris.
// Sin periodo anterior con datos, o si el anterior fue 0, no se compara:
// solo se ve el número actual.
function cambioPeriodoHTML(dato, conDatos, anterior) {
  if (!conDatos || !dato || !(Number(dato.anterior) > 0)) return ''
  const dif = (Number(dato.actual) || 0) - Number(dato.anterior)
  if (dif > 0) return `<div class="ow-cambio sube">▲ ${formatoNumero(dif)} vs. ${anterior}</div>`
  if (dif < 0) return `<div class="ow-cambio">▼ ${formatoNumero(-dif)} vs. ${anterior}</div>`
  return `<div class="ow-cambio">Igual que ${anterior === 'mes pasado' ? 'el' : 'la'} ${anterior}</div>`
}

// Tarjeta principal (verde Sello sólido, texto blanco). Nunca un "0" grande
// ni "$0": con 0 regresos, el mensaje de arranque.
// "desde que empezaste · 1 de octubre": la fecha es el alta del negocio
// (campo alta de grafica_clientes); si no llegó, va sin fecha.
function principalInicioHTML(r, alta = null) {
  const regresaron = Number(r.clientes_regresaron) || 0
  const cabeza = regresaron > 0
    ? `<div class="ow-principal-lbl">Ya regresaron</div>
       <div class="ow-principal-num">${formatoNumero(regresaron)} ${regresaron === 1 ? 'cliente' : 'clientes'}</div>`
    : `<div class="ow-principal-arranque">Tu primer cliente que regrese aparecerá aquí</div>
       <div class="ow-principal-lbl">Cuenta desde su segunda visita.</div>`
  let ventas = ''
  if (r.ticket_promedio == null) {
    ventas = '<button type="button" class="ow-enlace" id="dn-invita-ticket">Agrega en Personalización cuánto gasta un cliente para ver tus ventas estimadas</button>'
  } else if (regresaron > 0 && r.ventas_estimadas_total != null) {
    ventas = `<div class="ow-principal-sub" id="dn-ventas">≈ ${formatoPesos(r.ventas_estimadas_total)} en ventas <span class="ow-nota">(estimado)</span></div>`
  }
  const fechaAlta = textoAlta(alta)
  const desde = regresaron > 0 ? `<div class="ow-principal-desde">desde que empezaste${fechaAlta ? ` · ${fechaAlta}` : ''}</div>` : ''
  return `<section class="ow-tarjeta ow-principal" aria-label="Clientes que regresaron">${cabeza}${ventas}${desde}</section>`
}

// Negocio nuevo: en vez de ceros, qué hacer para empezar.
function vacioResumenHTML() {
  return `<section class="ow-tarjeta ow-vacio-tarjeta">
    <h2 class="ow-h2">Aquí verás si Sello te trae clientes de vuelta</h2>
    <p class="ow-sub">Aún no tienes clientes. Empieza así:</p>
    <ol class="ow-pasos">
      ${PASOS_ONBOARDING.map((p, i) => `<li><span class="ow-paso-num">${i + 1}</span><span><span class="ow-paso-titulo">${p.titulo}</span><span class="ow-paso-desc">${p.desc}</span></span></li>`).join('')}
    </ol>
    <button class="ow-btn primario" id="dn-ir-cajero">Ir al cajero</button>
  </section>`
}

// "Cómo va tu equipo esta semana" (pestaña Equipo): una línea por persona con
// lo que devuelve resumen_meseros. Sumó = reclamados + manuales. El aviso
// ámbar sale solo si revisar es verdadero; la frase se elige según las reglas
// que marcó el servidor en "motivo".
const AVISOS_EQUIPO = [
  { patron: /c[oó]digos sin usar/i, texto: 'Tiene muchos códigos sin usar. Pregúntale si los clientes no alcanzan a escanear.' },
  { patron: /a mano/i, texto: 'Suma muchas visitas a mano. Pregúntale si el QR le está fallando.' },
  { patron: /c[oó]digo de canje/i, texto: 'Se equivocó varias veces al escribir el código de canje.' },
]
function equipoSemanaHTML(meseros) {
  const lista = meseros || []
  const cab = '<h2 class="ow-titulo-sec">Cómo va tu equipo esta semana</h2>'
  if (lista.length === 0) {
    return `${cab}<p class="ow-vacio">Cuando tu equipo cobre con "Cobré una cuenta", aquí verás a cada mesero.</p>`
  }
  const filas = lista.map(m => {
    const sumo = (Number(m.reclamados) || 0) + (Number(m.manuales) || 0)
    const manuales = Number(m.manuales) || 0
    const avisos = m.revisar ? AVISOS_EQUIPO.filter(a => a.patron.test(m.motivo || '')) : []
    return `<div class="ow-eq-persona">
      <div class="ow-eq-linea"><span class="ow-persona" style="color:var(--ow-texto)">${m.rol === 'owner' ? 'Tú' : esc(m.nombre)}</span> · sumó ${formatoNumero(sumo)} ${sumo === 1 ? 'visita' : 'visitas'}${manuales > 0 ? ` · ${formatoNumero(manuales)} a mano` : ''}</div>
      ${avisos.map(a => `<p class="ow-eq-aviso">${a.texto}</p>`).join('')}
    </div>`
  }).join('')
  return `${cab}${filas}`
}

// "Este mes" / "Esta semana": selector y 3 números grandes.
function periodoHTML(d, periodo) {
  const P = PERIODOS_RESUMEN[periodo] || PERIODOS_RESUMEN.mes
  const r = d?.[periodo] || {}
  const con = r.anterior_con_datos === true
  // "Tu primer mes": el negocio empezó (primera visita, resumen_inicio.desde)
  // dentro de este periodo y no hay periodo anterior con datos. Si es más
  // viejo y el anterior no tiene datos, no se muestra nada.
  const empezo = d?.inicio?.desde
  const primero = !con && !!empezo && !!r.desde && String(empezo) >= String(r.desde)
  const cifra = (dato, lbl) => `<div class="ow-cifra">
      <div class="ow-cifra-num">${formatoNumero(dato?.actual)}</div>
      <div class="ow-cifra-lbl">${lbl}</div>
      ${primero ? `<span class="ow-primer">${P.primero}</span>` : cambioPeriodoHTML(dato, con, P.anterior)}
    </div>`
  return `<div class="ow-periodo-cab">
      <h2 class="ow-titulo-sec" id="dn-periodo-titulo" style="margin:0">${P.titulo}</h2>
      <div class="ow-seg chico" role="group" aria-label="Periodo">
        ${Object.entries(PERIODOS_RESUMEN).map(([k, p]) => `<button type="button" data-periodo="${k}" aria-pressed="${k === periodo}">${p.boton}</button>`).join('')}
      </div>
    </div>
    <div class="ow-cifras">
      ${cifra(r.clientes_nuevos, 'Clientes nuevos')}
      ${cifra(r.visitas_regreso, 'Visitas de regreso')}
      ${cifra(r.premios_entregados, 'Premios entregados')}
    </div>`
}

// Tarjeta ámbar (oportunidad): solo si hay alguien a 1 visita de su premio.
function cercaPremioHTML(c) {
  const total = Number(c?.total) || 0
  const lista = c?.clientes || []
  if (total === 0 || lista.length === 0) return ''
  const nombres = lista.slice(0, 3).map(x => esc(x.nombre))
  const resto = total - nombres.length
  return `<button type="button" class="ow-fila atencion" id="dn-ver-cerca">
    <span><span class="ow-fila-titulo">${total === 1 ? '1 cliente está a 1 visita de su premio' : `${formatoNumero(total)} clientes están a 1 visita de su premio`}</span>
      <span class="ow-fila-sub">${nombres.join(', ')}${resto > 0 ? ` y ${formatoNumero(resto)} más` : ''}</span></span>
    <span class="ow-fila-ver">Ver</span>
  </button>`
}

// Tarjeta gris azulada (información): solo si hay clientes que no vienen.
// Solo informativa: el botón para invitarlos llega con WhatsApp (la hoja ya
// acepta una acción por fila, ver abrirListaClientes).
function inactivosHTML(i) {
  const n = (i?.clientes || []).length
  if (n === 0) return ''
  const cuantos = n >= 300 ? 'Más de 300 clientes no vienen' : n === 1 ? '1 cliente no viene' : `${formatoNumero(n)} clientes no vienen`
  return `<button type="button" class="ow-fila info" id="dn-ver-inactivos">
    <span><span class="ow-fila-titulo">${cuantos} desde hace 21 días</span>
      <span class="ow-fila-sub">Para que sepas quiénes son.</span></span>
    <span class="ow-fila-ver">Ver</span>
  </button>`
}

// Hoja con una lista de clientes (primer nombre y ···4821).
// detalle(cliente): texto opcional bajo el nombre.
// accion (para después, hoy nadie la pasa): { texto, alTocar(cliente, hoja) }
// agrega un botón a cada fila.
function abrirListaClientes({ titulo, sub = '', clientes = [], nota = '', detalle = null, accion = null }) {
  const h = abrirHojaDueno({ titulo: esc(titulo), sub: esc(sub) })
  h.cuerpo.innerHTML = clientes.length === 0
    ? '<p class="ow-vacio">Nadie por ahora.</p>'
    : clientes.map((c, i) => `<div class="ow-lista-fila">
        <div><div><span class="ow-persona">${esc(c.nombre)}</span> <span class="ow-nota" style="font-variant-numeric:tabular-nums">···${esc(c.ultimos4)}</span></div>
          ${detalle ? `<div class="ow-ayuda" style="margin-top:2px">${esc(detalle(c))}</div>` : ''}</div>
        ${accion ? `<button type="button" class="ow-btn secundario chico" data-fila="${i}">${esc(accion.texto)}</button>` : ''}
      </div>`).join('') + (nota ? `<p class="ow-ayuda" style="text-align:center">${esc(nota)}</p>` : '')
  if (accion) {
    h.cuerpo.querySelectorAll('[data-fila]').forEach(b => b.addEventListener('click', () => accion.alTocar(clientes[Number(b.dataset.fila)], h)))
  }
  return h
}

// "Lo que está pasando": 5 actividades en lenguaje humano, sin botones.
const ORDINALES = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava', 'novena', 'décima']
function textoActividad(a) {
  const quien = `<strong>${esc(a.nombre)}</strong>`
  if (a.tipo === 'canje') return `${quien} recibió su premio`
  if (a.tipo === 'nuevo') return `${quien} vino por primera vez`
  const n = Number(a.numero) || 0
  return ORDINALES[n] ? `${quien} regresó: es su ${ORDINALES[n]} visita` : `${quien} regresó: es su visita número ${formatoNumero(n)}`
}
// Tiempos relativos en la zona del negocio (America/Cancun): "hace un
// momento", "hace 20 min", "hace 1 h", "ayer", "hace 3 días"; con más de 7
// días, fecha corta ("12 nov"; con año si no es este año).
const ZONA_ACTIVIDAD = 'America/Cancun'
const diaEnZona = f => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_ACTIVIDAD, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(f).map(x => [x.type, x.value]))
  return Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))
}
const anioEnZona = f => new Intl.DateTimeFormat('en', { timeZone: ZONA_ACTIVIDAD, year: 'numeric' }).format(f)
function tiempoRelativo(iso, ahora = new Date()) {
  const f = new Date(iso)
  if (isNaN(f)) return ''
  const minutos = Math.floor((ahora - f) / 60000)
  if (minutos < 1) return 'hace un momento'
  if (minutos < 60) return `hace ${minutos} min`
  const dias = Math.round((diaEnZona(ahora) - diaEnZona(f)) / 86400000)
  if (dias <= 0) return `hace ${Math.floor(minutos / 60)} h`
  if (dias === 1) return 'ayer'
  if (dias <= 7) return `hace ${dias} días`
  const conAnio = anioEnZona(f) !== anioEnZona(ahora) ? { year: 'numeric' } : {}
  return sinPunto(f.toLocaleDateString('es-MX', { timeZone: ZONA_ACTIVIDAD, day: 'numeric', month: 'short', ...conAnio }))
}
const MAX_ACTIVIDAD_RESUMEN = 5
const MAX_ACTIVIDAD_TODA = 20
const filasActividadHTML = lista => `<ul class="ow-act">${lista.map(a => `<li class="ow-act-fila">
    <span class="ow-act-punto ${a.tipo === 'canje' ? 'canje' : a.tipo === 'nuevo' ? 'nuevo' : 'regreso'}" aria-hidden="true"></span>
    <span class="ow-act-texto">${textoActividad(a)}</span>
    <span class="ow-act-hora">${esc(tiempoRelativo(a.fecha))}</span>
  </li>`).join('')}</ul>`
function actividadHTML(act) {
  if (!act) return ''
  const lista = (act.actividad || []).slice(0, MAX_ACTIVIDAD_RESUMEN)
  return `<section class="ow-tarjeta" aria-labelledby="dn-act-titulo">
    <h2 class="ow-titulo-sec" id="dn-act-titulo">Lo que está pasando</h2>
    ${lista.length === 0
      ? '<p class="ow-vacio">Aquí verás cada visita y cada premio entregado.</p>'
      : filasActividadHTML(lista)}
    ${lista.length >= MAX_ACTIVIDAD_RESUMEN ? '<button type="button" class="ow-enlace" id="dn-ver-actividad">Ver toda la actividad</button>' : ''}
  </section>`
}

// Hoja con los últimos 20 movimientos (actividad_reciente(20)), mismo formato.
function abrirActividad() {
  const h = abrirHojaDueno({ titulo: `Últimos ${MAX_ACTIVIDAD_TODA} movimientos` })
  async function cargar() {
    h.cuerpo.innerHTML = [44, 44, 44, 44].map(bloqueEsq).join('')
    try {
      const { data, error } = await supabase.rpc('actividad_reciente', { p_limite: MAX_ACTIVIDAD_TODA })
      if (!h.hoja.isConnected) return
      if (error) throw error
      const lista = data?.actividad || []
      h.cuerpo.innerHTML = lista.length === 0
        ? '<p class="ow-vacio">Aquí verás cada visita y cada premio entregado.</p>'
        : filasActividadHTML(lista)
    } catch (e) {
      if (!h.hoja.isConnected) return
      if (e?.message?.includes('NEGOCIO_INACTIVO')) { h.cerrar(); const { logout } = await import('./auth.js'); logout('negocio'); return }
      console.error('Error al cargar la actividad:', e)
      h.cuerpo.innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar la actividad.', 'act-reintentar')
      h.cuerpo.querySelector('#act-reintentar')?.addEventListener('click', cargar)
    }
  }
  cargar()
}

// La pestaña completa, en este orden: tarjeta principal, Logros, el periodo,
// (lugar de la gráfica "Clientes en tu programa", pendiente de la fase 9),
// tarjetas de acción y Lo que está pasando. Sin clientes: los pasos para empezar.
function resumenHTML(d, periodo) {
  const inicio = d?.inicio || {}
  if (!(Number(inicio.clientes_registrados) > 0)) return vacioResumenHTML() + logrosFilaHTML(d)
  return `
    ${principalInicioHTML(inicio, d.grafica?.alta)}
    ${logrosFilaHTML(d)}
    <section class="ow-periodo" id="dn-periodo" aria-labelledby="dn-periodo-titulo">${periodoHTML(d, periodo)}</section>
    <div id="dn-grafica-clientes"></div>
    ${cercaPremioHTML(d.cerca)}
    ${inactivosHTML(d.inactivos)}
    ${actividadHTML(d.actividad)}`
}

// ── "Clientes en tu programa" (grafica_clientes, fase 9) ──
// Área azul con degradado, máx. 3 guías, punto en el último valor y solo dos
// fechas (inicio del rango y "Hoy"). SVG propio dibujado al ancho real.
const RANGOS_GRAFICA = [['30', '30 días'], ['todo', 'Todo']]
const AZUL_GRAFICA = '#2563EB'
function fechaCortaGrafica(d) {
  const f = fechaLocal(d)
  const conAnio = f.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}
  return sinPunto(f.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...conAnio }))
}
function graficaClientesHTML(g, modo, ancho, cargando = false) {
  const puntos = (g?.puntos || []).map(p => ({ fecha: p.fecha, total: Number(p.total) || 0 }))
  const total = Number(g?.total) || 0
  const chips = RANGOS_GRAFICA.map(([k, t]) => `<button type="button" class="ow-gc-chip" data-rango="${k}" aria-pressed="${k === modo}"><span>${t}</span></button>`).join('')
  let cuerpo
  if (cargando) {
    cuerpo = '<div class="ow-esq ow-gc-esq"></div>'
  } else if (puntos.length < 2) {
    cuerpo = '<p class="ow-vacio">Tu gráfica aparecerá cuando tengas más días de clientes.</p>'
  } else {
    const W = Math.max(200, Math.round(ancho)), H = 140, PT = 10, PB = 6, PX = 7
    const techo = Math.max(1, ...puntos.map(p => p.total)) * 1.12
    const x = i => PX + i * (W - 2 * PX) / (puntos.length - 1)
    const y = v => PT + (H - PT - PB) * (1 - v / techo)
    const linea = puntos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join('')
    const base = (H - PB).toFixed(1)
    const area = `${linea}L${x(puntos.length - 1).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`
    const guias = [0, 0.5, 1].map(k => { const yy = (PT + (H - PT - PB) * k).toFixed(1); return `<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="#EEF1F4" stroke-width="1"/>` }).join('')
    const ult = puntos[puntos.length - 1]
    const desc = `${formatoNumero(puntos[0].total)} clientes el ${fechaCortaGrafica(puntos[0].fecha)} y ${formatoNumero(ult.total)} hoy`
    cuerpo = `<svg class="ow-gc-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(desc)}">
        <defs><linearGradient id="gc-degradado" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${AZUL_GRAFICA}" stop-opacity="0.25"/><stop offset="1" stop-color="${AZUL_GRAFICA}" stop-opacity="0"/></linearGradient></defs>
        ${guias}
        <path d="${area}" fill="url(#gc-degradado)"/>
        <path d="${linea}" fill="none" stroke="${AZUL_GRAFICA}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${x(puntos.length - 1).toFixed(1)}" cy="${y(ult.total).toFixed(1)}" r="4.5" fill="${AZUL_GRAFICA}" stroke="#ffffff" stroke-width="2"/>
      </svg>
      <div class="ow-gc-fechas" aria-hidden="true"><span>${fechaCortaGrafica(puntos[0].fecha)}</span><span>Hoy</span></div>`
  }
  return `<section class="ow-tarjeta" aria-labelledby="dn-gc-titulo">
    <div class="ow-gc-cab">
      <div><h2 class="ow-titulo-sec" id="dn-gc-titulo" style="margin:0">Clientes en tu programa</h2>
        <p class="ow-gc-sub">${modo === '30' ? 'Últimos 30 días' : 'Desde que empezaste'}</p></div>
      <div class="ow-gc-total" aria-label="${formatoNumero(total)} clientes">${formatoNumero(total)}</div>
    </div>
    <div class="ow-gc-chips" role="group" aria-label="Rango de la gráfica">${chips}</div>
    ${cuerpo}
  </section>`
}

// "1 de octubre" (con año si ya pasó más de un año). alta = "AAAA-MM-DD".
function textoAlta(alta) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(alta || ''))) return ''
  const f = fechaLocal(alta)
  const conAnio = Date.now() - f.getTime() > 365 * 86400000 ? { year: 'numeric' } : {}
  return f.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', ...conAnio })
}

// ── "Tu WhatsApp" (menú ☰): mi_telefono_dueno / guardar_telefono_dueno ──
function abrirWhatsappDueno() {
  const h = abrirHojaDueno({ titulo: 'Tu WhatsApp (opcional)', sub: 'Solo lo usa el equipo de Sello para felicitarte y avisarte de novedades. Tus clientes no lo ven.' })
  h.cuerpo.innerHTML = `
    <div class="ow-campo">
      <label class="ow-label" for="wa-dueno">Número de WhatsApp</label>
      <input type="tel" id="wa-dueno" class="ow-input" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="Cargando..." disabled />
    </div>
    <button id="btn-guardar-wa" class="ow-btn primario" disabled>Guardar</button>
    <div id="msg-wa"></div>`
  initWhatsappDueno().then(() => { const c = h.cuerpo.querySelector('#wa-dueno'); if (c?.isConnected) c.focus() })
}
const MENSAJE_TELEFONO_DUENO = 'Revisa el número: escribe los 10 dígitos (ej. 998 123 4567) o, si es de otro país, empieza con + y la lada.'
const telefonoDuenoLegible = t => !t ? '' : /^\+52\d{10}$/.test(t) ? telefonoLegible(t) : t
async function initWhatsappDueno() {
  const campo = document.getElementById('wa-dueno')
  const btn = document.getElementById('btn-guardar-wa')
  const msg = document.getElementById('msg-wa')
  if (!campo || !btn) return
  try {
    const { data, error } = await supabase.rpc('mi_telefono_dueno')
    if (error) throw error
    if (!campo.isConnected) return
    campo.value = telefonoDuenoLegible(data?.telefono_dueno)
  } catch (e) {
    if (!campo.isConnected) return
    console.error('Error al cargar tu WhatsApp:', e)
    msg.innerHTML = '<p class="ow-ayuda">No pudimos cargar tu número. Puedes escribirlo de nuevo.</p>'
  }
  campo.disabled = false; btn.disabled = false
  campo.placeholder = 'Ej: 998 123 4567'
  let guardando = false
  async function guardar() {
    if (guardando) return
    guardando = true; btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { data, error } = await supabase.rpc('guardar_telefono_dueno', { p_telefono: campo.value.trim() })
      if (error) throw error
      campo.value = telefonoDuenoLegible(data?.telefono_dueno)
      msg.innerHTML = avisoOk(data?.telefono_dueno ? 'WhatsApp guardado' : 'Número quitado')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
    } catch (e) {
      console.error('Error al guardar tu WhatsApp:', e)
      msg.innerHTML = avisoError(e?.message?.includes('TELEFONO_INVALIDO') ? MENSAJE_TELEFONO_DUENO : mensajeDueno(e))
    } finally {
      guardando = false; btn.disabled = false; btn.textContent = 'Guardar'
    }
  }
  btn.addEventListener('click', guardar)
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') guardar() })
}

// ── Visitas recientes y "Anular visita" (Fase 6) ──
// La lista se lee directo con la sesión del dueño: las políticas
// visitas_select_owner y clientes_select_owner (fase-4.sql) solo le dejan ver
// filas de SU negocio. Los nombres de los meseros salen de equipo_negocio()
// (profiles solo deja leer la fila propia). Anular pasa siempre por la RPC
// anular_visita (fase-6-anular.sql), que valida todo en el servidor.
const DIAS_VISITAS_RECIENTES = 7
const MAX_VISITAS_RECIENTES = 200   // tope de lo que se trae (una semana muy llena)
const VISITAS_POR_PAGINA = 15
const MOTIVO_MIN = 3
const MOTIVO_MAX = 200
const MOTIVOS_RAPIDOS = ['Se sumó por error', 'No era el cliente', 'Fue una prueba']

const MENSAJES_ANULAR = {
  VISITA_CANJEADA: 'Esta visita ya se usó para un premio entregado. No se puede anular.',
  VISITA_YA_ANULADA: 'Esta visita ya estaba anulada.',
  MOTIVO_INVALIDO: `Escribe el motivo (de ${MOTIVO_MIN} a ${MOTIVO_MAX} letras).`,
  VISITA_NO_ENCONTRADA: 'Ya no encontramos esta visita. Actualiza la lista.',
  NEGOCIO_INACTIVO: 'Este negocio está desactivado. Contacta a Sello.',
}
function mensajeAnular(e) {
  if (sinInternet(e)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  const m = e?.message || ''
  const clave = Object.keys(MENSAJES_ANULAR).find(k => m.includes(k))
  return clave ? MENSAJES_ANULAR[clave] : mensajeDueno(e)
}

// Igual que lo hace el servidor: espacios repetidos se juntan.
const limpiarMotivo = t => String(t || '').replace(/\s+/g, ' ').trim()

// "Hoy, 3:42 p.m." / "Ayer, 9:05 a.m." / "lun 17 nov, 1:10 p.m." (hora del celular)
function formatoMomento(iso) {
  const f = new Date(iso)
  const hora = f.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const dia = new Date(f); dia.setHours(0, 0, 0, 0)
  const dif = Math.round((hoy - dia) / 86400000)
  if (dif === 0) return `Hoy, ${hora}`
  if (dif === 1) return `Ayer, ${hora}`
  return `${sinPunto(f.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' }))}, ${hora}`
}

const ultimos4 = tel => String(tel || '').replace(/\D/g, '').slice(-4)
const etiquetaOrigen = o => o === 'qr' ? '<span class="ow-origen">QR</span>' : o === 'manual' ? '<span class="ow-origen manual">Manual</span>' : ''

// lista: filas ya preparadas ({ id, nombre, u4, momento, origen, mesero, anulada, motivo })
function visitasHTML(lista, mostrar, aviso, topado) {
  const cab = `<h2 class="ow-titulo-sec" id="dn-visitas-titulo" style="margin-bottom:4px">Visitas recientes</h2>
    <p class="ow-ayuda" style="margin:0 0 10px">Últimos ${DIAS_VISITAS_RECIENTES} días. Si una visita no debió contar, anúlala y se le resta el punto al cliente.</p>
    ${aviso ? avisoOk(esc(aviso)) : ''}`
  if (lista.length === 0) return `${cab}<p class="ow-vacio">No hay visitas en los últimos ${DIAS_VISITAS_RECIENTES} días.</p>`
  const filas = lista.slice(0, mostrar).map(v => `<div class="ow-visita${v.anulada ? ' anulada' : ''}">
      <div class="ow-visita-info">
        <div class="ow-visita-linea"><span class="ow-persona">${esc(v.nombre)}</span><span class="ow-nota" style="font-variant-numeric:tabular-nums">···${esc(v.u4)}</span>${etiquetaOrigen(v.origen)}</div>
        <div class="ow-visita-dato">${esc(v.momento)}${v.mesero ? ` · ${esc(v.mesero)}` : ''}</div>
        ${v.anulada ? `<div class="ow-visita-dato">Anulada${v.motivo ? `: ${esc(v.motivo)}` : ''}</div>` : ''}
      </div>
      ${v.anulada
        ? '<span class="ow-estado inactivo">Anulada</span>'
        : `<button class="ow-btn secundario chico ow-texto-atencion" data-anular="${esc(v.id)}" aria-label="Anular la visita de ${esc(v.nombre)} ···${esc(v.u4)}, ${esc(v.momento)}">Anular</button>`}
    </div>`).join('')
  const quedan = lista.length - mostrar
  return `${cab}<div>${filas}</div>
    ${quedan > 0 ? `<button class="ow-btn secundario" id="dn-visitas-mas" style="margin-top:12px">Ver ${formatoNumero(Math.min(quedan, VISITAS_POR_PAGINA))} más</button>` : ''}
    ${quedan <= 0 && topado ? `<p class="ow-ayuda" style="text-align:center">Se muestran las ${formatoNumero(MAX_VISITAS_RECIENTES)} más recientes.</p>` : ''}`
}

// Hoja para anular: motivo obligatorio (3 a 200), "Anular visita" y "Cancelar".
// alAnular(visita, motivo) se llama solo si el servidor la anuló.
function abrirAnularVisita(v, alAnular, alFallar) {
  const h = abrirHojaDueno({ titulo: '¿Anular esta visita?', sub: 'Se le resta el punto al cliente. La visita se queda en tu historial con el motivo.' })
  h.cuerpo.innerHTML = `
    <div class="ow-resumen-visita">
      <div class="ow-visita-linea"><span class="ow-persona">${esc(v.nombre)}</span><span class="ow-nota" style="font-variant-numeric:tabular-nums">···${esc(v.u4)}</span>${etiquetaOrigen(v.origen)}</div>
      <div class="ow-visita-dato">${esc(v.momento)}${v.mesero ? ` · ${esc(v.mesero)}` : ''}</div>
    </div>
    <div class="ow-campo">
      <label class="ow-label" for="an-motivo">Motivo <span class="ow-cuenta" id="an-cuenta">0/${MOTIVO_MAX}</span></label>
      <textarea id="an-motivo" class="ow-input ow-textarea" maxlength="${MOTIVO_MAX}" rows="3" autocomplete="off" placeholder="Ej: El cliente no estaba en el negocio"></textarea>
      <div class="ow-chips">${MOTIVOS_RAPIDOS.map(m => `<button type="button" class="ow-chip" data-motivo="${esc(m)}">${esc(m)}</button>`).join('')}</div>
    </div>
    <button class="ow-btn ow-btn-atencion" id="an-si">Anular visita</button>
    <button class="ow-btn secundario" id="an-no">Cancelar</button>
    <div id="an-msg"></div>`
  const campo = h.cuerpo.querySelector('#an-motivo')
  const cuenta = h.cuerpo.querySelector('#an-cuenta')
  const btn = h.cuerpo.querySelector('#an-si')
  const msg = h.cuerpo.querySelector('#an-msg')
  const contar = () => { cuenta.textContent = `${limpiarMotivo(campo.value).length}/${MOTIVO_MAX}` }
  campo.addEventListener('input', () => { contar(); if (msg.innerHTML) msg.innerHTML = '' })
  h.cuerpo.querySelectorAll('[data-motivo]').forEach(b => b.addEventListener('click', () => {
    campo.value = b.dataset.motivo; contar(); msg.innerHTML = ''; campo.focus()
  }))
  h.cuerpo.querySelector('#an-no').addEventListener('click', () => h.cerrar())
  setTimeout(() => campo.focus(), 50)

  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    const motivo = limpiarMotivo(campo.value)
    if (motivo.length < MOTIVO_MIN || motivo.length > MOTIVO_MAX) {
      msg.innerHTML = avisoError(MENSAJES_ANULAR.MOTIVO_INVALIDO); campo.focus(); return
    }
    btn.disabled = true; btn.textContent = 'Anulando...'; msg.innerHTML = ''
    h.fija = true  // que no se cierre a medio camino
    try {
      const { error } = await supabase.rpc('anular_visita', { p_visita_id: v.id, p_motivo: motivo })
      if (error) throw error
      h.cerrar()
      alAnular(v, motivo)
    } catch (e) {
      console.error('Error al anular la visita:', e?.message)
      h.fija = false
      btn.disabled = false; btn.textContent = 'Anular visita'
      msg.innerHTML = avisoError(mensajeAnular(e))
      alFallar?.(e)
    }
  })
}

// ── Fechas cortas ──
// "2026-11-04" → fecha local (sin que el navegador la corra por zona horaria).
const fechaLocal = d => { const [a, m, dd] = String(d).split('-').map(Number); return new Date(a, (m || 1) - 1, dd || 1) }
const sinPunto = t => t.replace(/\./g, '')

// ── Personalización ──
// Vista previa de la tarjeta del cliente (mismo acomodo que su pantalla).
// logoUrl: el logo guardado o el recién elegido (aún sin guardar); mensaje: el
// que está escrito en el campo. Así la vista previa cambia en vivo.
function vistaTarjetaHTML(nd, { logoUrl = null, mensaje = '' } = {}) {
  const meta = Math.max(1, Number(nd.meta_puntos) || 10)
  const puntos = Math.min(meta - 1, Math.max(1, Math.round(meta * 0.4)))
  const sellos = meta <= 10
    ? `<div class="ow-vista-sellos">${Array.from({ length: meta }, (_, i) => `<span class="ow-vista-sello${i < puntos ? ' lleno' : ''}"></span>`).join('')}</div>`
    : ''
  const ini = esc(inicialNegocio(nd.nombre || 'Tu negocio'))
  const avatar = logoUrl
    ? `<span class="ow-vista-avatar con-logo">${ini}<img src="${esc(logoUrl)}" alt="" onerror="this.parentNode.classList.remove('con-logo');this.remove()"></span>`
    : `<span class="ow-vista-avatar">${ini}</span>`
  const msj = String(mensaje || '').trim()
  return `
    <div class="ow-vista-sellotop">${logoSVG(11, '#94a3b8')}<span>Sello</span></div>
    <div class="ow-vista-marca">${avatar}<span><span class="ow-vista-nombre">${esc(nd.nombre || 'Tu negocio')}</span>${msj ? `<span class="ow-vista-mensaje">${esc(msj)}</span>` : ''}</span></div>
    <div class="ow-vista-saludo">Buenas tardes, Ana</div>
    <div class="ow-vista-tarjeta">
      <div><span class="ow-vista-num">${puntos}</span><span class="ow-vista-meta"> / ${meta}</span></div>
      ${sellos}
    </div>
    <div class="ow-vista-premio"><span>TU PREMIO</span>${esc(nd.premio || 'Tu premio')}</div>
    ${MOSTRAR_PIE_SELLO ? '<div class="ow-vista-pie">Hecho con Sello</div>' : ''}`
}

// Personalización, en este orden: Tu programa, Para calcular tus ventas,
// Tarjeta de tus clientes y Exportar. Cada sección guarda con su propio
// botón (programa, ventas y QR abiertos usan la misma RPC guardar_programa).
function ajustesHTML(nd, negocioId) {
  const landingUrl = `${window.location.origin}/#/landing/${negocioId}`
  const pesos = v => v == null ? '' : String(Number(v))
  const actual = esColorHex(nd.color_principal) ? nd.color_principal.toLowerCase() : COLOR_TARJETA_INICIAL
  // Si el color guardado no está en la paleta, se ofrece como "Tu color actual".
  const colores = COLORES_TARJETA.some(c => c.valor === actual)
    ? COLORES_TARJETA
    : [{ nombre: 'Tu color actual', valor: actual }, ...COLORES_TARJETA]
  return `
    <section class="ow-seccion" aria-labelledby="sec-programa">
      <h2 class="ow-seccion-titulo" id="sec-programa">Tu programa</h2>
      <p class="ow-seccion-sub">Qué gana tu cliente y cuándo.</p>
      <div class="ow-tarjeta">
        <div class="ow-campo">
          <label class="ow-label" for="prog-meta">Visitas para ganar el premio</label>
          <input type="number" inputmode="numeric" id="prog-meta" class="ow-input" min="1" max="100" value="${nd.meta_puntos ?? 10}" />
        </div>
        <div class="ow-campo">
          <label class="ow-label" for="prog-premio">Premio</label>
          <input type="text" id="prog-premio" class="ow-input" maxlength="80" value="${esc(nd.premio || '')}" placeholder="Ej: Un café gratis" />
          <div class="ow-chips">${PLANTILLAS_PREMIO.map(p => `<button type="button" class="ow-chip" data-premio="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        </div>
        <button id="btn-guardar-programa" class="ow-btn primario">Guardar programa</button>
        <div id="msg-programa"></div>
      </div>
    </section>

    <section class="ow-seccion" aria-labelledby="sec-ventas">
      <h2 class="ow-seccion-titulo" id="sec-ventas">Para calcular tus ventas <span class="ow-nota">(opcional)</span></h2>
      <p class="ow-seccion-sub">Con esto te decimos cuánto te dejan los clientes que regresan.</p>
      <div class="ow-tarjeta">
        <div class="ow-campo">
          <label class="ow-label" for="prog-ticket">¿Cuánto gasta en promedio un cliente?</label>
          <div class="ow-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-ticket" class="ow-input" value="${pesos(nd.ticket_promedio)}" placeholder="Ej: 120" autocomplete="off" /></div>
        </div>
        <div class="ow-campo">
          <label class="ow-label" for="prog-costo">¿Cuánto te cuesta el premio?</label>
          <div class="ow-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-costo" class="ow-input" value="${pesos(nd.costo_premio)}" placeholder="Ej: 25" autocomplete="off" /></div>
        </div>
        <button id="btn-guardar-ventas" class="ow-btn primario">Guardar</button>
        <div id="msg-ventas"></div>
      </div>
    </section>

    <section class="ow-seccion" aria-labelledby="sec-tarjeta">
      <h2 class="ow-seccion-titulo" id="sec-tarjeta">Tarjeta de tus clientes</h2>
      <p class="ow-seccion-sub">Así la ven en su celular.</p>
      <div class="ow-tarjeta">
        <div class="ow-label" id="lbl-color-tarjeta">Color</div>
        <div class="ow-colores" role="radiogroup" aria-labelledby="lbl-color-tarjeta">
          ${colores.map(c => `<button type="button" class="ow-color" role="radio" aria-checked="${c.valor === actual}" aria-label="${esc(c.nombre)}" title="${esc(c.nombre)}" data-color="${c.valor}" style="background:${c.valor}"></button>`).join('')}
        </div>
        ${PLAN_COLOR_LIBRE_SOLO_PRO ? '' : `<div class="ow-color-libre">
          <input type="color" id="color-libre" value="${actual}" aria-describedby="color-libre-nota" /><label class="ow-label" for="color-libre">Color libre</label>
        </div>
        <p class="ow-ayuda" id="color-libre-nota" style="margin:0 0 18px">Si es muy claro, el texto de la tarjeta se pone oscuro.</p>`}
        <div class="ow-campo">
          <div class="ow-label">Logo</div>
          <div class="ow-logo-fila">
            <span id="logo-muestra"></span>
            <div class="ow-logo-acciones">
              <button type="button" class="ow-btn secundario chico" id="logo-elegir">Subir logo</button>
              <button type="button" class="ow-enlace" id="logo-quitar" hidden>Quitar</button>
            </div>
          </div>
          <input type="file" id="logo-archivo" class="ow-oculto" accept="image/png,image/jpeg,image/webp" tabindex="-1" aria-hidden="true" />
          <p class="ow-ayuda">PNG, JPG o WebP. Lo ajustamos al tamaño correcto.</p>
          <div id="msg-logo"></div>
        </div>
        <div class="ow-campo">
          <label class="ow-label" for="tarjeta-mensaje">Mensaje de agradecimiento <span class="ow-nota">(opcional)</span><span class="ow-cuenta" id="tarjeta-mensaje-cuenta" aria-hidden="true"></span></label>
          <input type="text" id="tarjeta-mensaje" class="ow-input" maxlength="${MENSAJE_GRACIAS_MAX}" value="${esc(nd.mensaje_gracias || '')}" placeholder="Ej: ¡Gracias por tu visita!" autocomplete="off" />
          <div class="ow-chips">${PLANTILLAS_MENSAJE.map(p => `<button type="button" class="ow-chip" data-mensaje="${esc(p)}">${esc(p)}</button>`).join('')}</div>
        </div>
        <div class="ow-label">Vista previa</div>
        <div class="ow-vista" id="vista-tarjeta" style="${varsVista(actual)}">${vistaTarjetaHTML(nd, { logoUrl: urlLogo(nd.logo_ruta), mensaje: nd.mensaje_gracias })}</div>
        <button id="btn-guardar-tarjeta" class="ow-btn primario">Guardar</button>
        <div id="msg-tarjeta"></div>
      </div>
    </section>

    <section class="ow-seccion" aria-labelledby="sec-exportar">
      <h2 class="ow-seccion-titulo" id="sec-exportar">Exportar</h2>
      <p class="ow-seccion-sub">Tu lista de clientes y tu página para compartir.</p>
      <div class="ow-tarjeta">
        <p class="ow-label">Lista de clientes</p>
        <p class="ow-ayuda" style="margin:0 0 12px">Para abrirla en Excel.</p>
        <button id="btn-exportar-csv" class="ow-btn secundario">Descargar clientes (.csv)</button>
        <div id="msg-exportar"></div>
        <div class="ow-separador"></div>
        <p class="ow-label">Tu página pública</p>
        <p class="ow-ayuda" style="margin:0 0 12px">Compártela en Instagram o WhatsApp.</p>
        <div class="ow-url">${esc(landingUrl)}</div>
        <div class="ow-botones">
          <button id="btn-copiar-landing" class="ow-btn secundario">Copiar link</button>
          <button id="btn-ver-landing" class="ow-btn secundario">Ver página</button>
        </div>
        <div id="msg-landing"></div>
      </div>
    </section>
    <p style="text-align:center"><button type="button" class="ow-enlace" id="ayuda-otra-vez">Ver ayuda otra vez</button></p>
    <div id="msg-ayuda" style="text-align:center"></div>`
}

// Pestaña Equipo, al final: Números del personal y QR abiertos por mesero.
// Salen de los mismos datos del negocio que Personalización.
function equipoAjustesHTML(nd) {
  return `
    <section class="ow-seccion" aria-labelledby="sec-personal">
      <h2 class="ow-seccion-titulo" id="sec-personal">Números del personal</h2>
      <p class="ow-seccion-sub">Los números de tu equipo no suman puntos.</p>
      <div class="ow-tarjeta">
        <div class="ow-agregar">
          <input type="tel" inputmode="numeric" id="excl-tel" class="ow-input" placeholder="10 dígitos" autocomplete="off" aria-label="Número de 10 dígitos" />
          <button id="btn-agregar-excl" class="ow-btn secundario">Agregar</button>
        </div>
        <div id="msg-excl"></div>
        <div id="lista-excl" style="margin-top:12px">${bloqueEsq(44)}</div>
      </div>
    </section>

    <section class="ow-seccion" aria-labelledby="sec-qr-abiertos">
      <h2 class="ow-seccion-titulo" id="sec-qr-abiertos">QR abiertos por mesero</h2>
      <p class="ow-seccion-sub">Cuántos QR puede tener abiertos un mesero a la vez. Súbelo si hay mucha gente.</p>
      <div class="ow-tarjeta">
        <div class="ow-campo">
          <label class="ow-label" for="prog-max">QR abiertos por mesero</label>
          <input type="number" inputmode="numeric" id="prog-max" class="ow-input" min="1" max="50" value="${nd.max_codigos_activos ?? 3}" />
        </div>
        <button id="btn-guardar-qr" class="ow-btn primario">Guardar</button>
        <div id="msg-qr"></div>
      </div>
    </section>`
}

// Cambiar contraseña (5A), ahora desde el menú ☰. Supabase Auth la guarda;
// nunca pasa por nuestras tablas.
function abrirCambiarContrasena() {
  const h = abrirHojaDueno({ titulo: 'Cambiar contraseña', sub: 'Si te dieron una contraseña temporal, cámbiala aquí.' })
  h.cuerpo.innerHTML = `
    <div class="ow-campo">
      <label class="ow-label" for="nueva-contrasena">Nueva contraseña</label>
      <div class="ow-clave"><input type="password" id="nueva-contrasena" class="ow-input" autocomplete="new-password" minlength="${CONTRASENA_MIN}" placeholder="Mínimo ${CONTRASENA_MIN} caracteres" /><button type="button" id="ver-nueva-contrasena" aria-label="Mostrar contraseña">Mostrar</button></div>
    </div>
    <button id="btn-cambiar-contrasena" class="ow-btn primario">Cambiar contraseña</button>
    <div id="msg-contrasena"></div>`
  initContrasenaDueno()
  setTimeout(() => h.cuerpo.querySelector('#nueva-contrasena')?.focus(), 50)
}

// Sección "Tu contraseña" (5A): el dueño cambia la contraseña temporal que
// le dio Sello. Supabase Auth la guarda; nunca pasa por nuestras tablas.
const CONTRASENA_MIN = 8
function initContrasenaDueno() {
  const campo = document.getElementById('nueva-contrasena')
  const btn = document.getElementById('btn-cambiar-contrasena')
  const msg = document.getElementById('msg-contrasena')
  const ver = document.getElementById('ver-nueva-contrasena')
  if (!campo || !btn) return
  ver?.addEventListener('click', () => {
    const mostrar = campo.type === 'password'
    campo.type = mostrar ? 'text' : 'password'
    ver.textContent = mostrar ? 'Ocultar' : 'Mostrar'
    ver.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña')
  })
  async function cambiar() {
    if (btn.disabled) return
    const nueva = campo.value
    if (nueva.trim().length < CONTRASENA_MIN) {
      msg.innerHTML = avisoError(`Usa al menos ${CONTRASENA_MIN} caracteres.`); campo.focus(); return
    }
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { error } = await supabase.auth.updateUser({ password: nueva })
      if (error) throw error
      campo.value = ''
      msg.innerHTML = avisoOk('Listo. Desde ahora entras con tu nueva contraseña.')
    } catch (e) {
      msg.innerHTML = avisoError(mensajeErrorAuth(e, { otro: 'No pudimos cambiarla. Intenta de nuevo.' }))
    } finally {
      btn.disabled = false; btn.textContent = 'Cambiar contraseña'
    }
  }
  btn.addEventListener('click', cambiar)
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') cambiar() })
}

// Mismo arreglo que guardar_programa en el servidor ("  café   gratis " →
// "café gratis"), para no avisar de un premio "nuevo" que solo cambió espacios.
const normalizarPremio = t => String(t || '').replace(/\s+/g, ' ').trim()

// 6B: antes de guardar un cambio de meta o premio, pregunta a
// impacto_programa (supabase/fase-6b-impacto.sql) cuántos clientes cambian.
// Devuelve las líneas del aviso, o [] si no hay clientes afectados (por
// ejemplo en la configuración inicial, sin clientes todavía).
// Si la consulta falla (sin internet, función aún no aplicada), devuelve []
// y se guarda sin aviso: el aviso informa, no debe impedir guardar.
async function lineasImpactoPrograma({ metaAntes, premioAntes, meta, premio }) {
  const cambiaMeta = meta !== metaAntes
  const cambiaPremio = normalizarPremio(premio) !== normalizarPremio(premioAntes)
  if (!cambiaMeta && !cambiaPremio) return []
  let r
  try {
    const { data, error } = await supabase.rpc('impacto_programa', { p_meta: meta })
    if (error) throw error
    r = data
  } catch (e) {
    console.warn('No se pudo calcular el impacto del cambio:', e?.message)
    return []
  }
  const clientes = Number(r?.clientes) || 0
  const yaAlcanzan = Number(r?.ya_alcanzan) || 0
  const masLejos = Number(r?.mas_lejos) || 0
  const lineas = []
  if (cambiaMeta && meta < metaAntes && yaAlcanzan > 0) {
    lineas.push(yaAlcanzan === 1
      ? 'Con la nueva meta, 1 cliente ya podrá canjear su premio hoy'
      : `Con la nueva meta, ${formatoNumero(yaAlcanzan)} clientes ya podrán canjear su premio hoy`)
  }
  if (cambiaMeta && meta > metaAntes && masLejos > 0) {
    lineas.push(masLejos === 1
      ? 'Con la nueva meta, 1 cliente quedará más lejos de su premio'
      : `Con la nueva meta, ${formatoNumero(masLejos)} clientes quedarán más lejos de su premio`)
  }
  if (cambiaPremio && clientes > 0) lineas.push('Tus clientes verán el premio nuevo. Los canjes ya entregados no cambian')
  if (lineas.length === 0) return []
  lineas.push('Los puntos de tus clientes se conservan')
  return lineas
}

// Hoja "Vas a cambiar tu programa". Resuelve true con "Guardar cambios" y
// false con "Cancelar", "Cerrar", Escape o tocando fuera.
function confirmarCambioPrograma(lineas) {
  return new Promise(resolver => {
    const h = abrirHojaDueno({ titulo: 'Vas a cambiar tu programa' })
    h.cuerpo.innerHTML = `
      ${lineas.map(l => `<p class="ow-sub" style="margin:0 0 12px">${esc(l)}.</p>`).join('')}
      <button class="ow-btn primario" id="prog-si" style="margin-top:8px">Guardar cambios</button>
      <button class="ow-btn secundario" id="prog-no">Cancelar</button>`
    const cerrarHoja = h.cerrar
    let respondido = false
    const responder = valor => {
      if (respondido) return
      respondido = true
      cerrarHoja.call(h)
      resolver(valor)
    }
    h.cerrar = () => responder(false)
    h.cuerpo.querySelector('#prog-si').addEventListener('click', () => responder(true))
    h.cuerpo.querySelector('#prog-no').addEventListener('click', () => responder(false))
    setTimeout(() => h.cuerpo.querySelector('#prog-si')?.focus(), 50)
  })
}

/// "Tu programa", "Para calcular tus ventas" (Personalización) y "QR abiertos
// por mesero" (Equipo) se guardan con la MISMA RPC guardar_programa, que
// recibe los cinco valores juntos. Cada botón manda lo que se escribió en SU
// sección y, para lo demás, lo último guardado: así un cambio a medias en otra
// sección no se guarda sin querer.
// nd: los datos guardados del negocio. alGuardar({ meta, premio }) al guardar.
function initProgramaDueno(nd, alGuardar) {
  const $ = id => document.getElementById(id)
  const guardado = {
    meta: Number(nd?.meta_puntos) || 10,
    premio: nd?.premio || '',
    max: Number(nd?.max_codigos_activos) || 3,
    ticket: nd?.ticket_promedio == null ? null : Number(nd.ticket_promedio),
    costo: nd?.costo_premio == null ? null : Number(nd.costo_premio),
  }
  document.querySelectorAll('.ow-chip[data-premio]').forEach(chip => {
    chip.addEventListener('click', () => { $('prog-premio').value = chip.dataset.premio; $('prog-premio').focus() })
  })

  let guardando = false
  async function guardar({ btn, msg, textoBoton, textoOk, cambios, conAviso = false }) {
    if (!btn || !msg) return
    const d = { ...guardado, ...cambios() }
    // Las mismas reglas que revisa el servidor, para avisar antes de mandar.
    let error = ''
    if (!(d.meta >= 1 && d.meta <= 100)) error = 'META_INVALIDA'
    else if (!d.premio || d.premio.length > 80) error = 'PREMIO_INVALIDO'
    else if (d.ticket !== null && !(d.ticket >= 1 && d.ticket <= TICKET_MAX)) error = 'TICKET_INVALIDO'
    else if (d.costo !== null && !(d.costo >= 0 && d.costo <= COSTO_MAX)) error = 'COSTO_INVALIDO'
    else if (!(d.max >= 1 && d.max <= 50)) error = 'MAX_CODIGOS_INVALIDO'
    if (error) { msg.innerHTML = avisoError(mensajeDueno({ message: error })); return }
    if (guardando || btn.disabled) return
    guardando = true
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      // 6B: el aviso de impacto solo aplica a meta y premio.
      if (conAviso) {
        const lineas = await lineasImpactoPrograma({ metaAntes: guardado.meta, premioAntes: guardado.premio, meta: d.meta, premio: d.premio })
        if (lineas.length > 0 && !(await confirmarCambioPrograma(lineas))) return
      }
      const { error: e } = await supabase.rpc('guardar_programa', {
        p_meta_puntos: d.meta, p_premio: d.premio, p_max_codigos_activos: d.max,
        p_ticket_promedio: d.ticket, p_costo_premio: d.costo,
      })
      if (e) throw e
      Object.assign(guardado, d)
      msg.innerHTML = avisoOk(textoOk)
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
      alGuardar?.({ meta: d.meta, premio: d.premio })
    } catch (e) {
      console.error('Error al guardar el programa:', e)
      msg.innerHTML = avisoError(mensajeDueno(e))
    } finally {
      guardando = false
      btn.disabled = false; btn.textContent = textoBoton
    }
  }

  $('btn-guardar-programa')?.addEventListener('click', () => guardar({
    btn: $('btn-guardar-programa'), msg: $('msg-programa'), textoBoton: 'Guardar programa', textoOk: 'Programa guardado', conAviso: true,
    cambios: () => ({ meta: parseInt($('prog-meta').value, 10), premio: $('prog-premio').value.trim() }),
  }))
  $('btn-guardar-ventas')?.addEventListener('click', () => guardar({
    btn: $('btn-guardar-ventas'), msg: $('msg-ventas'), textoBoton: 'Guardar', textoOk: 'Guardado',
    cambios: () => ({ ticket: leerPesos($('prog-ticket').value), costo: leerPesos($('prog-costo').value) }),
  }))
  $('btn-guardar-qr')?.addEventListener('click', () => guardar({
    btn: $('btn-guardar-qr'), msg: $('msg-qr'), textoBoton: 'Guardar', textoOk: 'Guardado',
    cambios: () => ({ max: parseInt($('prog-max').value, 10) }),
  }))
}

// Sección "Tarjeta de tus clientes" (4E): color, logo y mensaje de
// agradecimiento, con vista previa en vivo. Se guarda todo junto con la RPC
// guardar_tarjeta (valida color, logo y mensaje en el servidor).
// El logo se sube al bucket público "logos", en la carpeta del negocio
// (Storage solo deja escribir ahí al dueño). Antes de subirlo se vuelve a
// dibujar en el navegador: queda de máx. 512 px y sin datos ocultos del archivo.
const LOGO_TIPOS = ['image/png', 'image/jpeg', 'image/webp']   // nunca SVG
const LOGO_MAX_LADO = 512
const LOGO_MAX_BYTES = 1024 * 1024          // lo mismo que limita el bucket
const LOGO_MAX_ORIGINAL = 15 * 1024 * 1024  // foto del celular, antes de reducirla
const EXT_LOGO = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }

const lienzoABlob = (lienzo, tipo, calidad) => new Promise(r => { try { lienzo.toBlob(r, tipo, calidad) } catch (e) { r(null) } })

async function prepararLogo(archivo) {
  if (!archivo || !LOGO_TIPOS.includes(archivo.type)) throw new Error('LOGO_TIPO')
  if (archivo.size > LOGO_MAX_ORIGINAL) throw new Error('LOGO_PESADO')
  const url = URL.createObjectURL(archivo)
  try {
    const img = new Image()
    img.src = url
    try { await img.decode() } catch (e) { throw new Error('LOGO_ILEGIBLE') }
    const ancho = img.naturalWidth, alto = img.naturalHeight
    if (!ancho || !alto || ancho * alto > 50e6) throw new Error('LOGO_ILEGIBLE')
    const escala = Math.min(1, LOGO_MAX_LADO / Math.max(ancho, alto))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.max(1, Math.round(ancho * escala))
    lienzo.height = Math.max(1, Math.round(alto * escala))
    const ctx = lienzo.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height)
    // WebP si el navegador lo sabe hacer (Safari a veces no); si no, PNG.
    let blob = await lienzoABlob(lienzo, 'image/webp', 0.9)
    if (!blob || blob.type !== 'image/webp') blob = await lienzoABlob(lienzo, 'image/png')
    // Un PNG con mucho detalle puede pasar de 1 MB: JPG con fondo blanco.
    if (!blob || blob.size > LOGO_MAX_BYTES) {
      const plano = document.createElement('canvas')
      plano.width = lienzo.width; plano.height = lienzo.height
      const c2 = plano.getContext('2d')
      c2.fillStyle = '#ffffff'; c2.fillRect(0, 0, plano.width, plano.height); c2.drawImage(lienzo, 0, 0)
      blob = await lienzoABlob(plano, 'image/jpeg', 0.85)
    }
    if (!blob || !EXT_LOGO[blob.type]) throw new Error('LOGO_ILEGIBLE')
    if (blob.size > LOGO_MAX_BYTES) throw new Error('LOGO_PESADO')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

function mensajeLogo(e) {
  const m = e?.message || ''
  if (m === 'LOGO_TIPO') return 'Usa una imagen PNG, JPG o WebP.'
  if (m === 'LOGO_PESADO') return 'Esa imagen es muy pesada. Prueba con otra.'
  if (m === 'LOGO_ILEGIBLE') return 'No pudimos leer esa imagen. Prueba con otra.'
  return 'No pudimos usar esa imagen. Prueba con otra.'
}

// Devuelve { actualizar(cambios) } para que la vista previa siga a Programa
// (meta y premio) sin perder el logo ni el mensaje que se están editando.
function initTarjetaDueno(negocioId, nd, alGuardar) {
  const $ = id => document.getElementById(id)
  const btn = $('btn-guardar-tarjeta'); const msg = $('msg-tarjeta'); const vista = $('vista-tarjeta')
  if (!btn) return { actualizar() {} }
  const opciones = [...document.querySelectorAll('.ow-color')]
  const mensaje = $('tarjeta-mensaje'); const cuenta = $('tarjeta-mensaje-cuenta')
  const archivo = $('logo-archivo'); const elegirLogo = $('logo-elegir'); const quitarLogo = $('logo-quitar')
  const msgLogo = $('msg-logo'); const muestra = $('logo-muestra')
  const datos = { ...nd }
  const estado = {
    color: opciones.find(o => o.getAttribute('aria-checked') === 'true')?.dataset.color || COLOR_TARJETA_INICIAL,
    logoGuardado: RUTA_LOGO.test(nd.logo_ruta || '') ? nd.logo_ruta : null,
    logoNuevo: null,      // Blob ya reducido, aún sin subir
    logoNuevoUrl: null,   // URL local para la vista previa
    quitar: false,
    guardando: false,
  }

  const logoVisible = () => estado.logoNuevoUrl || (estado.quitar ? null : urlLogo(estado.logoGuardado))
  function pintar() {
    const url = logoVisible()
    vista.style.cssText = varsVista(estado.color)
    vista.innerHTML = vistaTarjetaHTML(datos, { logoUrl: url, mensaje: mensaje.value })
    muestra.innerHTML = `<span class="ow-vista-avatar${url ? ' con-logo' : ''}" style="${varsVista(estado.color)}">${esc(inicialNegocio(datos.nombre || 'Tu negocio'))}${url ? `<img src="${esc(url)}" alt="" onerror="this.parentNode.classList.remove('con-logo');this.remove()">` : ''}</span>`
    elegirLogo.textContent = url ? 'Cambiar logo' : 'Subir logo'
    quitarLogo.hidden = !url
    cuenta.textContent = `${mensaje.value.length}/${MENSAJE_GRACIAS_MAX}`
  }
  const cambiado = () => { msg.innerHTML = '' }

  // Color: grupo de opciones accesible (flechas para moverse).
  const libre = $('color-libre')
  function elegir(boton, enfocar = false) {
    libre?.classList.remove('activo')
    opciones.forEach(o => { o.setAttribute('aria-checked', String(o === boton)); o.tabIndex = o === boton ? 0 : -1 })
    estado.color = boton.dataset.color
    cambiado(); pintar()
    if (enfocar) boton.focus()
  }
  opciones.forEach(o => { o.tabIndex = o.getAttribute('aria-checked') === 'true' ? 0 : -1 })
  opciones.forEach((o, i) => {
    o.addEventListener('click', () => elegir(o))
    o.addEventListener('keydown', e => {
      const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (!paso) return
      e.preventDefault()
      elegir(opciones[(i + paso + opciones.length) % opciones.length], true)
    })
  })

  // Color libre: cualquier color (si coincide con uno de la lista, se elige ese).
  libre?.addEventListener('input', () => {
    const v = String(libre.value || '').toLowerCase()
    if (!esColorHex(v)) return
    const igual = opciones.find(o => o.dataset.color === v)
    if (igual) { elegir(igual); return }
    opciones.forEach((o, i) => { o.setAttribute('aria-checked', 'false'); o.tabIndex = i === 0 ? 0 : -1 })
    libre.classList.add('activo')
    estado.color = v
    cambiado(); pintar()
  })

  // Mensaje: en vivo en la vista previa, con plantillas.
  mensaje.addEventListener('input', () => { cambiado(); pintar() })
  document.querySelectorAll('.ow-chip[data-mensaje]').forEach(chip => chip.addEventListener('click', () => {
    mensaje.value = chip.dataset.mensaje.slice(0, MENSAJE_GRACIAS_MAX); cambiado(); pintar(); mensaje.focus()
  }))

  // Logo: se prepara al elegirlo (vista previa inmediata) y se sube al guardar.
  const soltarVistaLocal = () => { if (estado.logoNuevoUrl) URL.revokeObjectURL(estado.logoNuevoUrl); estado.logoNuevoUrl = null; estado.logoNuevo = null }
  elegirLogo.addEventListener('click', () => { if (!estado.guardando) archivo.click() })
  archivo.addEventListener('change', async () => {
    const elegido = archivo.files?.[0]
    archivo.value = ''
    if (!elegido) return
    msgLogo.innerHTML = ''
    elegirLogo.disabled = true
    try {
      const blob = await prepararLogo(elegido)
      if (!vista.isConnected) return
      soltarVistaLocal()
      estado.logoNuevo = blob
      estado.logoNuevoUrl = URL.createObjectURL(blob)
      estado.quitar = false
      cambiado(); pintar()
      msgLogo.innerHTML = `<p class="ow-ayuda">Listo. Toca "Guardar" para usarlo.</p>`
    } catch (e) {
      msgLogo.innerHTML = avisoError(mensajeLogo(e))
    } finally {
      elegirLogo.disabled = false
    }
  })
  quitarLogo.addEventListener('click', () => {
    soltarVistaLocal()
    estado.quitar = true
    msgLogo.innerHTML = ''
    cambiado(); pintar()
  })

  const logos = () => supabase.storage.from('logos')
  // Borrar un archivo que ya no se usa: si falla, solo queda un archivo de sobra.
  async function borrarArchivo(ruta) {
    if (!ruta) return
    try { const { error } = await logos().remove([ruta]); if (error) console.warn('No se borró el logo anterior:', error.message) } catch (e) {}
  }

  btn.addEventListener('click', async () => {
    if (estado.guardando || !esColorHex(estado.color)) return
    const texto = mensaje.value.replace(/\s+/g, ' ').trim()
    if (texto.length > MENSAJE_GRACIAS_MAX) { msg.innerHTML = avisoError(mensajeDueno({ message: 'MENSAJE_INVALIDO' })); return }
    estado.guardando = true; btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    let subido = null
    try {
      let ruta = estado.quitar ? null : estado.logoGuardado
      if (estado.logoNuevo) {
        // Nombre nuevo cada vez: nunca se reemplaza un archivo (ni hay caché vieja).
        subido = `${negocioId}/logo-${Date.now()}.${EXT_LOGO[estado.logoNuevo.type]}`
        const { error } = await logos().upload(subido, estado.logoNuevo, {
          contentType: estado.logoNuevo.type, upsert: false, cacheControl: '31536000',
        })
        if (error) { const err = new Error('SUBIDA'); err.causa = error; throw err }
        ruta = subido
      }
      const { data, error } = await supabase.rpc('guardar_tarjeta', {
        p_color: estado.color, p_logo_ruta: ruta, p_mensaje: texto || null,
      })
      if (error) throw error
      const anterior = estado.logoGuardado
      estado.logoGuardado = data?.logo || null
      estado.quitar = false
      soltarVistaLocal()
      mensaje.value = data?.mensaje || ''
      subido = null
      if (anterior && anterior !== estado.logoGuardado) borrarArchivo(anterior)
      aplicarColorNegocio(estado.color)
      alGuardar?.({ color: estado.color, logo_ruta: estado.logoGuardado })
      pintar()
      msgLogo.innerHTML = ''
      msg.innerHTML = avisoOk('Tarjeta guardada')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
    } catch (e) {
      console.error('Error al guardar la tarjeta:', e?.causa || e)
      if (subido) borrarArchivo(subido)
      msg.innerHTML = avisoError(e?.message === 'SUBIDA'
        ? (sinInternet(e.causa) ? 'Sin conexión. Revisa tu internet e intenta de nuevo.' : 'No pudimos subir el logo. Intenta de nuevo.')
        : mensajeDueno(e))
    } finally {
      estado.guardando = false; btn.disabled = false; btn.textContent = 'Guardar'
    }
  })

  pintar()
  return {
    actualizar(cambios) { Object.assign(datos, cambios); pintar() },
  }
}

// Sección "Personal (no ganan puntos)": lista de numeros_excluidos (el dueño
// la puede leer por RLS) y altas/bajas con agregar_ / quitar_numero_excluido.
function initPersonalDueno(negocioId) {
  const $ = id => document.getElementById(id)
  const lista = $('lista-excl'); const tel = $('excl-tel'); const btn = $('btn-agregar-excl'); const msg = $('msg-excl')
  if (!lista) return
  let numeros = []
  const avisar = (texto, ok = false) => { msg.innerHTML = texto ? (ok ? avisoOk(texto) : avisoError(texto)) : '' }

  function pintar() {
    lista.innerHTML = numeros.length === 0
      ? `<p class="ow-vacio">Aún no agregas números.</p>`
      : numeros.map(n => `
        <div class="ow-lista-fila">
          <span style="font-variant-numeric:tabular-nums">${telefonoLegible(n.telefono)}</span>
          <button class="ow-btn secundario chico" data-quitar="${esc(n.id)}">Quitar</button>
        </div>`).join('')
  }

  async function cargar() {
    try {
      const { data, error } = await supabase.from('numeros_excluidos')
        .select('id, telefono, creado_en').eq('negocio_id', negocioId).order('creado_en', { ascending: true })
      if (error) throw error
      numeros = data || []
      pintar()
    } catch (e) {
      console.error('Error al cargar el personal:', e)
      lista.innerHTML = `<p class="ow-vacio">${mensajeDueno(e)}</p>`
    }
  }

  async function agregar() {
    if (btn.disabled) return
    const digitos = tel.value.replace(/\D/g, '')
    if (digitos.length !== 10) { avisar(mensajeDueno({ message: 'TELEFONO_INVALIDO' })); return }
    btn.disabled = true; avisar('')
    try {
      const { data, error } = await supabase.rpc('agregar_numero_excluido', { p_telefono: digitos })
      if (error) throw error
      if (!numeros.some(n => n.id === data.id)) numeros.push(data)
      pintar(); tel.value = ''
      avisar(data.ya_existia ? 'Ese número ya estaba en la lista.' : 'Número agregado', true)
    } catch (e) {
      console.error('Error al agregar el número:', e)
      avisar(mensajeDueno(e))
    } finally {
      btn.disabled = false
    }
  }

  async function quitar(boton) {
    if (boton.disabled) return
    boton.disabled = true; boton.textContent = 'Quitando...'; avisar('')
    try {
      const { error } = await supabase.rpc('quitar_numero_excluido', { p_id: boton.dataset.quitar })
      if (error && !error.message?.includes('NO_ENCONTRADO')) throw error
      numeros = numeros.filter(n => n.id !== boton.dataset.quitar)
      pintar()
    } catch (e) {
      console.error('Error al quitar el número:', e)
      avisar(mensajeDueno(e))
      if (boton.isConnected) { boton.disabled = false; boton.textContent = 'Quitar' }
    }
  }

  tel.addEventListener('input', () => { tel.value = tel.value.replace(/\D/g, '') })
  tel.addEventListener('keydown', e => { if (e.key === 'Enter') agregar() })
  btn.addEventListener('click', agregar)
  lista.addEventListener('click', e => { const b = e.target.closest('[data-quitar]'); if (b) quitar(b) })
  cargar()
}

// CSV para Excel: nombre, teléfono, visitas, puntos y fecha de registro.
// Cada celda va entre comillas; las que empiezan con = + - @ llevan un
// apóstrofo para que Excel no las tome como fórmula.
function exportarCSV(clientes, negocioNombre) {
  const celda = v => {
    let t = String(v ?? '')
    if (/^[=+\-@]/.test(t)) t = `'${t}`
    return `"${t.replace(/"/g, '""')}"`
  }
  const headers = ['Nombre', 'Teléfono', 'Visitas totales', 'Puntos actuales', 'Fecha de registro']
  const filas = (clientes || []).map(c => [
    c.nombre, c.telefono, c.total_visitas ?? 0, c.puntos_actuales ?? 0,
    c.fecha_registro ? new Date(c.fecha_registro).toLocaleDateString('es-MX') : '—',
  ])
  const csv = [headers, ...filas].map(fila => fila.map(celda).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const nombre = String(negocioNombre || 'negocio').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]/g, '').trim() || 'negocio'
  link.href = url; link.download = `clientes-${nombre}-${new Date().toISOString().split('T')[0]}.csv`; link.click()
  URL.revokeObjectURL(url)
}

function initAjustesExtra(negocioId, nombreNegocio) {
  const $ = id => document.getElementById(id)

  // Antes de descargar, un recordatorio de que son datos de sus clientes.
  // Con PLAN_EXPORTAR_SOLO_PRO = true, en vez de descargar avisa que es de Pro.
  $('btn-exportar-csv')?.addEventListener('click', () => {
    if ($('btn-exportar-csv').disabled) return
    if (PLAN_EXPORTAR_SOLO_PRO) {
      const h = abrirHojaDueno({ titulo: 'Exportar es parte del plan Pro', sub: `Escríbenos a ${CORREO_CONTACTO} para activarlo.` })
      h.cuerpo.innerHTML = '<button class="ow-btn secundario" id="exp-cerrar">Entendido</button>'
      h.cuerpo.querySelector('#exp-cerrar').addEventListener('click', () => h.cerrar())
      return
    }
    const h = abrirHojaDueno({ titulo: 'Descargar tus clientes' })
    h.cuerpo.innerHTML = `
      <p class="ow-sub" style="margin:0 0 20px">Estos datos son de tus clientes. Úsalos solo para tu programa de lealtad.</p>
      <button class="ow-btn primario" id="exp-si">Continuar</button>
      <button class="ow-btn secundario" id="exp-no">Cancelar</button>`
    h.cuerpo.querySelector('#exp-no').addEventListener('click', () => h.cerrar())
    h.cuerpo.querySelector('#exp-si').addEventListener('click', () => { h.cerrar(); descargarCSV() })
    setTimeout(() => h.cuerpo.querySelector('#exp-si')?.focus(), 50)
  })

  async function descargarCSV() {
    const btn = $('btn-exportar-csv'); const msg = $('msg-exportar')
    if (!btn) return
    btn.textContent = 'Preparando...'; btn.disabled = true
    try {
      const { data: clientes, error } = await supabase.from('clientes')
        .select('nombre, telefono, total_visitas, puntos_actuales, fecha_registro')
        .eq('negocio_id', negocioId).order('fecha_registro', { ascending: true })
      if (error) throw error
      exportarCSV(clientes, nombreNegocio)
      msg.innerHTML = avisoOk('Archivo descargado')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 3000)
    } catch (e) { msg.innerHTML = avisoError(mensajeDueno(e)) }
    finally { btn.textContent = 'Descargar clientes (.csv)'; btn.disabled = false }
  }

  $('btn-copiar-landing')?.addEventListener('click', () => {
    const url = `${window.location.origin}/#/landing/${negocioId}`
    const msg = $('msg-landing')
    navigator.clipboard.writeText(url).then(() => {
      if (!msg) return
      msg.innerHTML = avisoOk('Link copiado')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2000)
    }).catch(() => { if (msg) msg.innerHTML = avisoError('No se pudo copiar. Selecciona el link y cópialo a mano.') })
  })
  $('btn-ver-landing')?.addEventListener('click', () => navigate('landing', negocioId))
}

// ── EQUIPO (Fase 4C) ──
// El dueño da de alta a sus meseros. Las cuentas las crea la Edge Function
// crear-mesero (el navegador nunca tiene llaves de administrador). La lista
// sale de equipo_negocio() (supabase/fase-4c.sql).
// La contraseña se muestra UNA sola vez: al cerrar la hoja se borra de la
// pantalla y no se puede volver a ver.
export const MENSAJE_CUENTA_DESACTIVADA = 'Tu cuenta está desactivada. Habla con el dueño del negocio.'
export const MENSAJE_NEGOCIO_DESACTIVADO = 'Este negocio está desactivado. Contacta a Sello.'

const MENSAJES_EQUIPO = {
  NOMBRE_INVALIDO: 'Escribe el nombre del mesero (máximo 30 letras).',
  CORREO_INVALIDO: 'Revisa el correo: no parece válido.',
  CORREO_EN_USO: 'Ese correo ya tiene una cuenta en Sello. Usa otro.',
  LIMITE_MESEROS: 'Ya tienes 10 meseros activos. Desactiva a uno para agregar otro.',
  MESERO_NO_ENCONTRADO: 'Ese mesero ya no está en tu equipo.',
  MESERO_DESACTIVADO: 'Ese mesero está desactivado.',
  ACCESO_DENEGADO: 'Solo el dueño del negocio puede administrar el equipo.',
  SIN_SESION: 'Tu sesión ya no es válida. Sal y vuelve a entrar.',
  NEGOCIO_INACTIVO: 'El negocio está desactivado.',
  FUNCION_NO_PUBLICADA: `El servicio para administrar tu equipo no está disponible. Escríbenos a ${CORREO_CONTACTO}.`,
  SIN_RESPUESTA: 'No pudimos conectar con el servidor de Sello. Intenta de nuevo en un momento.',
  ERROR_SERVIDOR: 'Algo salió mal en el servidor. Intenta de nuevo.',
}

// Llama a la Edge Function y convierte su error en un código:
//   - FunctionsHttpError: la función (o la puerta de Supabase) respondió con
//     4xx/5xx. Se lee su { error, mensaje }; si no trae código (respuesta de
//     la puerta, p. ej. "Invalid JWT" o función no publicada) se usa el estado.
//   - FunctionsFetchError: la petición no llegó (sin señal, CORS o servidor
//     caído). Solo se dice "Sin conexión" si el celular de verdad está sin red.
//   - FunctionsRelayError: la puerta de Supabase no pudo llegar a la función.
async function llamarEquipo(cuerpo) {
  const { data, error } = await supabase.functions.invoke('crear-mesero', { body: cuerpo })
  if (error) {
    const estado = error.name === 'FunctionsHttpError' ? error.context?.status : null
    let info = null
    if (estado) { try { info = await error.context.json() } catch (e) {} }
    const codigo = typeof info?.error === 'string' ? info.error
      : estado === 401 ? 'SIN_SESION'
      : estado === 404 ? 'FUNCION_NO_PUBLICADA'
      : error.name === 'FunctionsFetchError' ? 'SIN_RESPUESTA'
      : 'ERROR_SERVIDOR'
    console.error('crear-mesero respondió con error:', error.name, estado ?? '', codigo)
    const err = new Error(codigo)
    err.mensaje = typeof info?.mensaje === 'string' ? info.mensaje : null
    throw err
  }
  return data
}

function mensajeEquipo(e) {
  if (navigator.onLine === false || /Failed to fetch|NetworkError|Load failed/i.test(e?.message || '')) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  return MENSAJES_EQUIPO[e?.message] || e?.mensaje || MENSAJES_EQUIPO.ERROR_SERVIDOR
}

const limpiarNombreMesero = t => String(t || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim()
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Hoja inferior genérica del dueño. fija = true: no se cierra tocando fuera
// ni con Escape (para no perder una contraseña por accidente).
function abrirHojaDueno({ titulo, sub = '' }) {
  inyectarEstilosDueno()
  const hoja = document.createElement('div')
  hoja.className = 'ow-hoja-fondo'
  hoja.innerHTML = `<div class="ow-hoja" role="dialog" aria-modal="true" aria-labelledby="ow-hoja-titulo">
    <div class="ow-hoja-cab">
      <div><h2 class="ow-h2" id="ow-hoja-titulo">${titulo}</h2>${sub ? `<p class="ow-sub" id="ow-hoja-sub">${sub}</p>` : ''}</div>
      <button class="ow-btn secundario chico" id="ow-hoja-cerrar">Cerrar</button>
    </div>
    <div id="ow-hoja-cuerpo"></div>
  </div>`
  document.body.appendChild(hoja)
  const control = {
    hoja,
    cuerpo: hoja.querySelector('#ow-hoja-cuerpo'),
    fija: false,
    cerrar() { hoja.remove(); document.removeEventListener('keydown', alTeclear) },
    titulo(texto, subtitulo = '') {
      hoja.querySelector('#ow-hoja-titulo').textContent = texto
      const s = hoja.querySelector('#ow-hoja-sub'); if (s) s.textContent = subtitulo
    },
  }
  const alTeclear = e => { if (e.key === 'Escape' && !control.fija) control.cerrar() }
  document.addEventListener('keydown', alTeclear)
  hoja.querySelector('#ow-hoja-cerrar').addEventListener('click', () => control.cerrar())
  hoja.addEventListener('click', e => { if (e.target === hoja && !control.fija) control.cerrar() })
  return control
}

// Muestra correo y contraseña UNA vez, con Copiar y Compartir por WhatsApp.
function mostrarCredenciales(h, datos, negocioNombre, esNueva) {
  const direccion = `${location.origin}${location.pathname}#/login`
  hojaCredenciales(h, {
    titulo: esNueva ? `Nueva contraseña de ${datos.nombre}` : `Listo, ${datos.nombre} ya tiene cuenta`,
    correo: datos.correo,
    contrasena: datos.contrasena,
    mensaje: [
      `Hola ${datos.nombre}, ${esNueva ? 'esta es tu nueva contraseña de Sello' : `ya tienes tu cuenta de Sello${negocioNombre ? ` en ${negocioNombre}` : ''}`}.`,
      `1. Abre: ${direccion}`,
      `2. Correo: ${datos.correo}`,
      `3. Contraseña: ${datos.contrasena}`,
      'Entra una sola vez y tu sesión se queda abierta en tu celular.',
    ].join('\n'),
  })
}

// Hoja con correo y contraseña, que se muestran UNA sola vez. "Copiar" copia
// el mensaje completo; si el navegador no deja, la contraseña queda
// seleccionada para copiarla a mano. nota: aviso extra bajo la credencial.
function hojaCredenciales(h, { titulo, correo, contrasena, mensaje, nota = '' }) {
  h.fija = true
  h.hoja.querySelector('#ow-hoja-cerrar').hidden = true
  h.titulo(titulo, '')
  const datos = { correo, contrasena }

  h.cuerpo.innerHTML = `
    <p class="ow-aviso-unico ow-aviso-fijo" role="note"><strong>Guarda esta contraseña ahora: no se vuelve a mostrar.</strong></p>
    ${nota ? `<p class="ow-ayuda" style="margin:0 0 14px">${nota}</p>` : ''}
    <div class="ow-credencial">
      <div><span class="ow-credencial-lbl">Correo</span><span class="ow-credencial-valor">${esc(datos.correo)}</span></div>
      <div><span class="ow-credencial-lbl">Contraseña</span><span class="ow-contrasena">${esc(datos.contrasena)}</span></div>
    </div>
    <div class="ow-botones">
      <button class="ow-btn secundario" id="eq-copiar">Copiar</button>
      <button class="ow-btn primario" id="eq-whatsapp">Compartir por WhatsApp</button>
    </div>
    <div id="eq-copiado"></div>
    <button class="ow-btn secundario" id="eq-listo" style="margin-top:16px">Ya la guardé</button>`

  // Sin https (o si el navegador no deja copiar), navigator.clipboard no
  // existe o falla: se deja la contraseña seleccionada para copiarla a mano.
  h.cuerpo.querySelector('#eq-copiar').addEventListener('click', async () => {
    const aviso = h.cuerpo.querySelector('#eq-copiado')
    try {
      if (!window.isSecureContext || !navigator.clipboard?.writeText) throw new Error('SIN_PORTAPAPELES')
      await navigator.clipboard.writeText(mensaje)
      aviso.innerHTML = avisoOk('Copiado. Pégalo donde quieras.')
    } catch (e) {
      const clave = h.cuerpo.querySelector('.ow-contrasena')
      try {
        const rango = document.createRange()
        rango.selectNodeContents(clave)
        const sel = window.getSelection()
        sel.removeAllRanges(); sel.addRange(rango)
      } catch (err) {}
      aviso.innerHTML = `<p class="ow-msg-ok" role="status" style="color:var(--ow-texto-2)">Este navegador no deja copiar. La contraseña quedó seleccionada: cópiala manualmente.</p>`
    }
  })
  h.cuerpo.querySelector('#eq-whatsapp').addEventListener('click', () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank', 'noopener')
  })
  h.cuerpo.querySelector('#eq-listo').addEventListener('click', () => h.cerrar())
}

function abrirAgregarMesero(negocioNombre, alCambiar) {
  const h = abrirHojaDueno({ titulo: 'Agregar mesero', sub: 'Le creamos su cuenta y te damos su contraseña.' })
  h.cuerpo.innerHTML = `
    <div class="ow-campo"><label class="ow-label" for="eq-nombre">Nombre</label><input id="eq-nombre" class="ow-input" maxlength="30" autocomplete="off" autocapitalize="words" placeholder="Ej: Ana" /></div>
    <div class="ow-campo"><label class="ow-label" for="eq-correo">Correo</label><input id="eq-correo" type="email" class="ow-input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ana@correo.com" /><p class="ow-ayuda">Con este correo entrará a Sello.</p></div>
    <button class="ow-btn primario" id="eq-crear">Crear cuenta</button>
    <div id="eq-msg"></div>`
  const nombre = h.cuerpo.querySelector('#eq-nombre'); const correo = h.cuerpo.querySelector('#eq-correo')
  const btn = h.cuerpo.querySelector('#eq-crear'); const msg = h.cuerpo.querySelector('#eq-msg')
  setTimeout(() => nombre.focus(), 50)

  async function crear() {
    if (btn.disabled) return
    const n = limpiarNombreMesero(nombre.value); const c = correo.value.trim().toLowerCase()
    if (!n || n.length > 30) { msg.innerHTML = avisoError(MENSAJES_EQUIPO.NOMBRE_INVALIDO); nombre.focus(); return }
    if (!CORREO_VALIDO.test(c)) { msg.innerHTML = avisoError(MENSAJES_EQUIPO.CORREO_INVALIDO); correo.focus(); return }
    btn.disabled = true; btn.textContent = 'Creando cuenta...'; msg.innerHTML = ''
    try {
      const datos = await llamarEquipo({ accion: 'crear', nombre: n, correo: c })
      if (!h.hoja.isConnected) return
      mostrarCredenciales(h, datos, negocioNombre, false)
      alCambiar()
    } catch (e) {
      console.error('Error al crear el mesero:', e?.message)
      msg.innerHTML = avisoError(mensajeEquipo(e))
      btn.disabled = false; btn.textContent = 'Crear cuenta'
    }
  }
  nombre.addEventListener('keydown', e => { if (e.key === 'Enter') correo.focus() })
  correo.addEventListener('keydown', e => { if (e.key === 'Enter') crear() })
  btn.addEventListener('click', crear)
}

function abrirNuevaContrasena(mesero, negocioNombre) {
  const h = abrirHojaDueno({ titulo: `Nueva contraseña para ${mesero.nombre}`, sub: 'La contraseña anterior dejará de servir.' })
  h.cuerpo.innerHTML = `<button class="ow-btn primario" id="eq-generar">Generar nueva contraseña</button><div id="eq-msg"></div>`
  const btn = h.cuerpo.querySelector('#eq-generar'); const msg = h.cuerpo.querySelector('#eq-msg')
  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    btn.disabled = true; btn.textContent = 'Generando...'; msg.innerHTML = ''
    try {
      const datos = await llamarEquipo({ accion: 'nueva_contrasena', usuario_id: mesero.usuario_id })
      if (h.hoja.isConnected) mostrarCredenciales(h, datos, negocioNombre, true)
    } catch (e) {
      console.error('Error al cambiar la contraseña:', e?.message)
      msg.innerHTML = avisoError(mensajeEquipo(e))
      btn.disabled = false; btn.textContent = 'Generar nueva contraseña'
    }
  })
}

function abrirDesactivar(mesero, alCambiar) {
  const h = abrirHojaDueno({ titulo: `¿Desactivar a ${mesero.nombre}?`, sub: 'Ya no podrá entrar ni generar códigos, aunque tenga la app abierta. Sus visitas se quedan en tu historial.' })
  h.cuerpo.innerHTML = `
    <button class="ow-btn ow-btn-atencion" id="eq-si">Sí, desactivar</button>
    <button class="ow-btn secundario" id="eq-no">Cancelar</button>
    <div id="eq-msg"></div>`
  const btn = h.cuerpo.querySelector('#eq-si'); const msg = h.cuerpo.querySelector('#eq-msg')
  h.cuerpo.querySelector('#eq-no').addEventListener('click', () => h.cerrar())
  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    btn.disabled = true; btn.textContent = 'Desactivando...'; msg.innerHTML = ''
    try {
      await llamarEquipo({ accion: 'desactivar', usuario_id: mesero.usuario_id })
      h.cerrar()
      alCambiar()
    } catch (e) {
      console.error('Error al desactivar:', e?.message)
      msg.innerHTML = avisoError(mensajeEquipo(e))
      btn.disabled = false; btn.textContent = 'Sí, desactivar'
    }
  })
}

function equipoHTML(eq) {
  const meseros = eq?.meseros || []
  const activos = Number(eq?.activos) || 0
  const maximo = Number(eq?.maximo) || 10
  const lista = meseros.length === 0
    ? `<div class="ow-vacio">Aún no tienes meseros. Agrega al primero: toma menos de un minuto y su sesión se queda abierta en su celular.</div>`
    : meseros.map(m => `<div class="ow-mesero-fila">
        <div class="ow-mesero-info">
          <span class="ow-persona">${esc(m.nombre)}</span>
          <span class="ow-estado ${m.activo ? 'activo' : 'inactivo'}">${m.activo ? 'Activo' : 'Desactivado'}</span>
        </div>
        ${m.activo ? `<div class="ow-mesero-acciones">
          <button class="ow-btn secundario chico" data-nueva="${esc(m.usuario_id)}">Nueva contraseña</button>
          <button class="ow-btn secundario chico ow-texto-atencion" data-desactivar="${esc(m.usuario_id)}">Desactivar</button>
        </div>` : ''}
      </div>`).join('')
  return `
    <section class="ow-seccion" aria-labelledby="sec-equipo">
      <h2 class="ow-seccion-titulo" id="sec-equipo">Meseros</h2>
      <p class="ow-seccion-sub">Cada mesero entra una sola vez en su celular y su sesión se queda abierta.</p>
      <div class="ow-tarjeta">
        ${lista}
        <button class="ow-btn primario" id="eq-agregar" style="margin-top:20px"${activos >= maximo ? ' disabled' : ''}>Agregar mesero</button>
        <p class="ow-ayuda" style="text-align:center">${activos >= maximo ? `Llegaste al máximo de ${maximo} meseros activos.` : `${activos} de ${maximo} meseros activos`}</p>
      </div>
    </section>`
}

// Cada visita a #/dueno abre una "sesión"; las respuestas que llegan tarde
// de una visita anterior se ignoran.
let duenoSesion = 0

// ═══════════════════════════════════════════════════════════
// LOGROS (Fase C) — supabase/fase-8-logros.sql
// logros_pendientes(): hitos alcanzados y sin celebrar.
// celebrar_logro(tipo, hito): los marca (también los menores) en el servidor.
// logros_lista(): celebrados + próximo hito de cada tipo.
// Aquí solo vive la presentación. Ni la pantalla ni la imagen llevan
// nombres o teléfonos de clientes.
// ═══════════════════════════════════════════════════════════
// La misma lista de hitos que logros_hitos() en el SQL (14 en total).
const HITOS_LOGRO = {
  regresos: [1, 5, 10, 25, 50, 100, 250],
  clientes: [10, 25, 50, 100, 250, 500, 1000],
}
const TIPOS_LOGRO = ['regresos', 'clientes']   // orden en que se celebran
const esLogro = l => !!l && TIPOS_LOGRO.includes(l.tipo) && HITOS_LOGRO[l.tipo].includes(Number(l.hito))
const reduceMovimiento = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const ICONO_COMPARTIR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>'
const ICONO_MEDALLA = '<svg class="ow-lg-medalla" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7.5 2h3.2l1.3 5.2-2.6 1.2zM16.5 2h-3.2L12 7.2l2.6 1.2z" fill="#B8902F" opacity="0.65"/><circle cx="12" cy="15" r="6.5" fill="#B8902F"/><circle cx="12" cy="15" r="3.6" fill="none" stroke="#F6EED6" stroke-width="1.5"/></svg>'
const ICONO_CERRAR = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>'

const nombreNegocioLogro = n => String(n || '').trim() || 'tu negocio'

// Textos: dicen lo que pasó en el negocio, nunca que Sello lo causó.
function tituloCelebracion(l, nombre) {
  const n = Number(l.hito), neg = nombreNegocioLogro(nombre)
  if (l.tipo === 'regresos' && n === 1) return '¡Tu primer cliente ya regresó!'
  return l.tipo === 'regresos'
    ? `¡${formatoNumero(n)} clientes ya regresaron a ${neg}!`
    : `¡${formatoNumero(n)} clientes ya son parte de ${neg}!`
}
function tituloCortoLogro(l) {
  if (l.tipo === 'regresos') return Number(l.hito) === 1 ? 'Tu primer regreso' : 'clientes que regresaron'
  return 'clientes registrados'
}
function textoImagenLogro(l, nombre) {
  const neg = nombreNegocioLogro(nombre)
  if (l.tipo === 'regresos') return Number(l.hito) === 1 ? `cliente ya regresó a ${neg}` : `clientes ya regresaron a ${neg}`
  return `personas ya juntan visitas en ${neg}`
}
const FRASE_IMAGEN_LOGRO = '¿Y tú? Pregunta cómo unirte'
const formatoFechaLogro = iso => {
  const d = iso ? new Date(iso) : null
  return !d || isNaN(d) ? '' : sinPunto(d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }))
}
const nombreArchivoLogro = l => `logro-${l.tipo}-${l.hito}.png`

// Los 14 hitos con su estado. Desbloqueado = ya celebrado o ya alcanzado con
// los números del Resumen. Orden: desbloqueados (el más reciente arriba) y
// luego bloqueados (el más cercano primero).
function tarjetasLogros(lista, inicio) {
  const conteos = {
    clientes: Number(inicio?.clientes_registrados) || 0,
    regresos: Number(inicio?.clientes_regresaron) || 0,
  }
  const celebrados = new Map((lista?.celebrados || []).filter(esLogro).map(c => [`${c.tipo}-${Number(c.hito)}`, c.celebrado_en || null]))
  const todas = TIPOS_LOGRO.flatMap(tipo => HITOS_LOGRO[tipo].map(hito => {
    const clave = `${tipo}-${hito}`
    const actual = conteos[tipo]
    return { tipo, hito, actual, falta: Math.max(0, hito - actual), fecha: celebrados.get(clave) || null, ok: celebrados.has(clave) || actual >= hito }
  }))
  const cuando = t => (t.fecha ? Date.parse(t.fecha) : NaN) || Infinity   // alcanzado sin fecha: arriba
  const desbloqueadas = todas.filter(t => t.ok).sort((a, b) => cuando(b) - cuando(a) || b.hito - a.hito)
  const bloqueadas = todas.filter(t => !t.ok).sort((a, b) => a.falta - b.falta || a.hito - b.hito)
  return { desbloqueadas, bloqueadas, total: todas.length }
}

// Fila de Logros bajo la tarjeta principal: medallas de los últimos 3
// ganados, el próximo logro más cercano (menor "faltan", de cualquier tipo)
// con su barra, y una flecha. Toda la fila abre Logros.
const medallaTexto = h => h >= 1000 ? `${formatoNumero(Math.floor(h / 1000))}K` : formatoNumero(h)
const nombreProximoLogro = t => t.tipo === 'regresos'
  ? (t.hito === 1 ? 'tu primer regreso' : `${formatoNumero(t.hito)} regresos`)
  : `${formatoNumero(t.hito)} clientes`
function logrosFilaHTML(d) {
  const { desbloqueadas, bloqueadas, total } = tarjetasLogros(d?.logros, d?.inicio)
  const medallas = desbloqueadas.slice(0, 3)
  const sig = bloqueadas[0]   // ya viene ordenada: la más cercana primero
  const titulo = sig ? `Próximo logro: ${nombreProximoLogro(sig)}` : 'Ganaste todos los logros'
  const falta = sig ? (sig.falta === 1 ? 'falta 1' : `faltan ${formatoNumero(sig.falta)}`) : ''
  const pct = sig ? Math.min(100, Math.round(sig.actual / sig.hito * 100)) : 100
  const etiqueta = `Logros: ${desbloqueadas.length} de ${total}. ${titulo}${falta ? `, ${falta}` : ''}`
  return `<button type="button" class="ow-lgfila" id="dn-ver-logros" aria-label="${esc(etiqueta)}">
    ${medallas.length ? `<span class="ow-medallas" aria-hidden="true">${medallas.map(m => `<span class="ow-medalla">${medallaTexto(m.hito)}</span>`).join('')}</span>` : ''}
    <span class="ow-lgfila-centro" aria-hidden="true">
      <span class="ow-lgfila-linea"><span class="ow-lgfila-titulo">${titulo}</span>${falta ? `<span class="ow-lgfila-falta">${falta}</span>` : ''}</span>
      ${sig ? `<span class="ow-lgfila-barra"><span style="width:${pct}%"></span></span>` : ''}
    </span>
    <span class="ow-lgfila-flecha" aria-hidden="true">›</span>
  </button>`
}

// ── Imagen para compartir (1080×1920) ──
function cargarImagenCORS(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return }
    const img = new Image()
    const listo = v => { resolve(v); img.onload = img.onerror = null }
    img.crossOrigin = 'anonymous'
    img.onload = () => listo(img.naturalWidth > 0 ? img : null)
    img.onerror = () => listo(null)
    setTimeout(() => listo(null), 5000)
    img.src = url
  })
}

function lineasTexto(ctx, texto, ancho) {
  const lineas = []
  let linea = ''
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${p}` : p
    if (linea && ctx.measureText(prueba).width > ancho) { lineas.push(linea); linea = p } else linea = prueba
  }
  if (linea) lineas.push(linea)
  return lineas
}

// La frase de abajo usa UNA sola tipografía: Pacifico (public/fonts, la guarda
// el service worker). Se registra con FontFace (no depende de qué hoja de
// estilos esté puesta) y se espera document.fonts.load antes de dibujar.
// Devuelve true si quedó lista; si no (sin red y sin caché), la imagen se
// dibuja con la del sistema y NO se guarda, para reintentar la próxima vez.
const FUENTE_FRASE = 'Pacifico'
// (document.fonts.check no sirve para saberlo: da true con una familia que no
// existe. Por eso se revisa el estado de NUESTRA FontFace.)
let caraPacifico = null
let cargaPacifico = null
function esperarFuenteFrase() {
  if (!cargaPacifico) {
    cargaPacifico = (async () => {
      try {
        if (!document.fonts?.load || typeof FontFace !== 'function') return false
        if (!caraPacifico) {
          caraPacifico = new FontFace(FUENTE_FRASE, `url('${import.meta.env.BASE_URL}fonts/pacifico.woff2') format('woff2')`)
          document.fonts.add(caraPacifico)
        }
        await Promise.race([
          caraPacifico.load().then(() => document.fonts.load(`64px '${FUENTE_FRASE}'`, FRASE_IMAGEN_LOGRO)),
          new Promise(r => setTimeout(r, 4000)),
        ])
        return caraPacifico.status === 'loaded'
      } catch (e) { return false }
    })()
    cargaPacifico.then(ok => {
      if (ok) return
      // Para reintentar luego, una FontFace nueva (una que falló no se recupera).
      if (caraPacifico?.status === 'error') { document.fonts.delete(caraPacifico); caraPacifico = null }
      cargaPacifico = null
    })
  }
  return cargaPacifico
}

// LA función que dibuja la imagen (1080×1920). La usan la celebración nueva,
// su miniatura ("Vista previa") y la celebración que se abre desde Logros.
// Se genera una vez por logro y negocio; la miniatura y "Compartir" usan
// ese mismo blob.
const imagenesLogro = new Map()
async function imagenLogro(l, marca) {
  const color = esColorHex(marca.color) ? marca.color : DS.green800
  const tinta = textoSobreColor(color)   // oscuro si el color del negocio es claro
  const logoUrl = urlLogo(marca.logoRuta)
  const texto = textoImagenLogro(l, marca.nombre)
  const clave = [l.tipo, l.hito, color, logoUrl || '', texto].join('|')
  if (imagenesLogro.has(clave)) return imagenesLogro.get(clave)

  const W = 1080, H = 1920, M = 100, ANCHO = W - 2 * M, CX = W / 2
  const lienzo = document.createElement('canvas')
  lienzo.width = W; lienzo.height = H
  const ctx = lienzo.getContext('2d')
  if (!ctx) return null
  const sistema = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif"
  const [logo, fuenteLista] = await Promise.all([cargarImagenCORS(logoUrl), esperarFuenteFrase()])

  function dibujar(conLogo) {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.fillStyle = tinta

    // Medidas de cada bloque para centrar todo en vertical.
    const numero = formatoNumero(l.hito)
    let tamNum = 360
    ctx.font = `800 ${tamNum}px ${sistema}`
    while (ctx.measureText(numero).width > ANCHO && tamNum > 160) { tamNum -= 10; ctx.font = `800 ${tamNum}px ${sistema}` }
    const mNum = ctx.measureText(numero)
    const subeNum = mNum.actualBoundingBoxAscent || tamNum * 0.72
    const altoNum = subeNum + (mNum.actualBoundingBoxDescent || 0)

    let tamTxt = 76
    ctx.font = `700 ${tamTxt}px ${sistema}`
    let lineasTxt = lineasTexto(ctx, texto, ANCHO)
    if (lineasTxt.length > 3) { tamTxt = 62; ctx.font = `700 ${tamTxt}px ${sistema}`; lineasTxt = lineasTexto(ctx, texto, ANCHO) }
    const lhTxt = Math.round(tamTxt * 1.2)

    const tamFrase = 64
    ctx.font = `${tamFrase}px '${FUENTE_FRASE}', ${sistema}`
    const lineasFrase = lineasTexto(ctx, FRASE_IMAGEN_LOGRO, ANCHO)
    const lhFrase = Math.round(tamFrase * 1.3)

    const LOGO = 340
    const hayLogo = conLogo && !!logo
    const total = (hayLogo ? LOGO + 80 : 0) + altoNum + 56 + lineasTxt.length * lhTxt + 70 + lineasFrase.length * lhFrase
    const arriba = M, abajo = H - M - 90   // deja lugar a "Hecho con Sello"
    let y = arriba + Math.max(0, (abajo - arriba - total) / 2)

    // Logo en círculo blanco, completo (contain) dentro del cuadrado inscrito.
    if (hayLogo) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(CX, y + LOGO / 2, LOGO / 2, 0, Math.PI * 2); ctx.fill()
      const caja = Math.floor(LOGO / Math.SQRT2) - 8
      const escala = Math.min(caja / logo.naturalWidth, caja / logo.naturalHeight)
      const w = logo.naturalWidth * escala, h = logo.naturalHeight * escala
      ctx.drawImage(logo, CX - w / 2, y + (LOGO - h) / 2, w, h)
      ctx.fillStyle = tinta
      y += LOGO + 80
    }

    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 ${tamNum}px ${sistema}`
    ctx.fillText(numero, CX, y + subeNum)
    y += altoNum + 56

    ctx.textBaseline = 'top'
    ctx.font = `700 ${tamTxt}px ${sistema}`
    for (const linea of lineasTxt) { ctx.fillText(linea, CX, y); y += lhTxt }
    y += 70

    ctx.font = `${tamFrase}px '${FUENTE_FRASE}', ${sistema}`
    for (const linea of lineasFrase) { ctx.fillText(linea, CX, y); y += lhFrase }

    // Marca Sello: pequeña y discreta.
    ctx.globalAlpha = 0.9
    ctx.textBaseline = 'alphabetic'
    ctx.font = `500 32px ${sistema}`
    ctx.fillText('Hecho con Sello', CX, H - M)
    ctx.globalAlpha = 1
  }

  dibujar(true)
  let blob = await lienzoABlob(lienzo, 'image/png')
  // Si el logo no deja exportar el lienzo (CORS), se dibuja sin logo y sigue.
  if (!blob && logo) { dibujar(false); blob = await lienzoABlob(lienzo, 'image/png') }
  if (blob && fuenteLista) imagenesLogro.set(clave, blob)
  return blob
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo; a.style.display = 'none'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Comparte el PNG con la hoja del sistema (dentro del toque: el blob ya está
// listo); si el navegador no puede, lo descarga. → 'compartido' | 'cancelado' | 'descargado'
async function compartirPNG(blob, nombreArchivo, titulo) {
  try {
    const archivo = new File([blob], nombreArchivo, { type: 'image/png' })
    if (navigator.canShare?.({ files: [archivo] })) {
      try { await navigator.share({ files: [archivo], title: titulo }); return 'compartido' }
      catch (e) { if (e?.name === 'AbortError') return 'cancelado' }
    }
  } catch (e) { /* sin File o sin Web Share: se descarga */ }
  descargarBlob(blob, nombreArchivo)
  return 'descargado'
}

// Confeti ligero (~2 s) en un canvas propio, sin librerías.
function lanzarConfeti(lienzo) {
  const ctx = lienzo.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = lienzo.clientWidth, h = lienzo.clientHeight
  lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const colores = ['#ffffff', '#FFD166', '#F4845F']
  const piezas = Array.from({ length: 110 }, (_, i) => ({
    x: w / 2 + (Math.random() - 0.5) * Math.min(w, 420) * 0.4,
    y: h * 0.3,
    vx: (Math.random() - 0.5) * 10,
    vy: -(Math.random() * 9 + 5),
    g: 0.2 + Math.random() * 0.1,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    an: 6 + Math.random() * 5,
    al: 9 + Math.random() * 7,
    c: colores[i % colores.length],
  }))
  const inicio = performance.now(), DURA = 2000
  let raf = 0
  function cuadro(t) {
    const p = (t - inicio) / DURA
    ctx.clearRect(0, 0, w, h)
    if (p >= 1) return
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1
    for (const q of piezas) {
      q.vy += q.g; q.vx *= 0.99; q.x += q.vx; q.y += q.vy; q.rot += q.vr
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot)
      ctx.fillStyle = q.c; ctx.fillRect(-q.an / 2, -q.al / 2, q.an, q.al)
      ctx.restore()
    }
    raf = requestAnimationFrame(cuadro)
  }
  raf = requestAnimationFrame(cuadro)
  return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h) }
}

// Celebración de un logro. Nuevo: "NUEVO LOGRO", confeti y se marca como
// celebrado en cuanto aparece (si cierra la app ahí, no vuelve a salir).
// reabrir (desde Logros): "LOGRO DESBLOQUEADO" con la fecha, "Cerrar" y sin
// llamar a celebrar_logro. Resuelve al cerrarse.
function mostrarCelebracion(l, marca, { reabrir = false, fecha = null } = {}) {
  inyectarEstilosDueno()
  return new Promise(resolve => {
    const titulo = tituloCelebracion(l, marca.nombre)
    const numero = formatoNumero(l.hito)
    const etiqueta = reabrir ? ['Logro desbloqueado', formatoFechaLogro(fecha)].filter(Boolean).join(' · ') : 'Nuevo logro'
    const focoAntes = document.activeElement
    const el = document.createElement('div')
    el.className = 'ow-festejo'
    el.setAttribute('role', 'dialog')
    el.setAttribute('aria-modal', 'true')
    el.setAttribute('aria-labelledby', 'ow-festejo-titulo')
    el.innerHTML = `
      <div class="ow-festejo-tarjeta">
        <div class="ow-festejo-cont">
          <p class="ow-festejo-etiqueta">${esc(etiqueta)}</p>
          <div class="ow-festejo-num${numero.length >= 4 ? ' largo' : ''}" aria-hidden="true">${esc(numero)}</div>
          <h2 class="ow-festejo-titulo" id="ow-festejo-titulo">${esc(titulo)}</h2>
          <p class="ow-festejo-sub">Compártelo con tus clientes. Que se enteren de que tu programa está creciendo.</p>
          <figure class="ow-festejo-vista">
            <div class="ow-festejo-mini cargando"><img alt="Imagen para compartir: ${esc(numero)} ${esc(textoImagenLogro(l, marca.nombre))}" hidden></div>
            <figcaption>Vista previa</figcaption>
          </figure>
          <button type="button" class="ow-festejo-compartir" data-festejo="compartir" disabled>${ICONO_COMPARTIR}<span>Compartir</span></button>
          <p class="ow-festejo-nota" role="status" aria-live="polite"></p>
          <button type="button" class="ow-festejo-despues" data-festejo="cerrar">${reabrir ? 'Cerrar' : 'Después'}</button>
          ${reabrir ? '' : '<p class="ow-festejo-pista">Lo encuentras luego en Logros</p>'}
        </div>
      </div>
      ${reabrir || reduceMovimiento() ? '' : '<canvas class="ow-confeti" aria-hidden="true"></canvas>'}`
    document.body.appendChild(el)
    const overflowAntes = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    if (!reabrir) supabase.rpc('celebrar_logro', { p_tipo: l.tipo, p_hito: Number(l.hito) }).then(() => {}, () => {})

    const btnCompartir = el.querySelector('[data-festejo="compartir"]')
    const btnCerrar = el.querySelector('[data-festejo="cerrar"]')
    const nota = el.querySelector('.ow-festejo-nota')
    const mini = el.querySelector('.ow-festejo-mini')
    const img = mini.querySelector('img')
    const confeti = el.querySelector('.ow-confeti')
    const pararConfeti = confeti ? lanzarConfeti(confeti) : () => {}

    // La imagen se genera UNA vez al abrir; la miniatura es esa misma imagen.
    let blob = null, urlMini = null, abierta = true
    imagenLogro(l, marca).then(b => b, () => null).then(b => {
      if (!abierta) return
      blob = b
      mini.classList.remove('cargando')
      if (b) { urlMini = URL.createObjectURL(b); img.src = urlMini; img.hidden = false }
      btnCompartir.disabled = false
    })

    btnCompartir.addEventListener('click', async () => {
      if (btnCompartir.disabled) return
      nota.textContent = ''
      if (!blob) { nota.textContent = 'No pudimos preparar la imagen.'; return }
      if (await compartirPNG(blob, nombreArchivoLogro(l), titulo) === 'descargado' && abierta) nota.textContent = 'Imagen guardada en tus descargas.'
    })

    function cerrar() {
      if (!abierta) return
      abierta = false
      document.removeEventListener('keydown', alTeclear, true)
      window.removeEventListener('hashchange', cerrar)
      pararConfeti()
      if (urlMini) URL.revokeObjectURL(urlMini)
      document.body.style.overflow = overflowAntes
      el.remove()
      if (focoAntes?.isConnected) focoAntes.focus?.({ preventScroll: true })
      resolve()
    }
    function alTeclear(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cerrar() }
      else if (e.key === 'Tab') {   // el foco se queda dentro
        const botones = [...el.querySelectorAll('button:not([disabled])')]
        if (!botones.length) return
        const i = botones.indexOf(document.activeElement)
        e.preventDefault(); e.stopPropagation()
        botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus()
      }
    }
    document.addEventListener('keydown', alTeclear, true)
    window.addEventListener('hashchange', cerrar)   // si sale del panel (atrás), se va con él
    btnCerrar.addEventListener('click', cerrar)
    btnCerrar.focus({ preventScroll: true })
  })
}

// Pantalla "Logros": los 14 hitos en cuadrícula. Las desbloqueadas abren su
// celebración (sin volver a marcarla).
function abrirLogros(marca) {
  inyectarEstilosDueno()
  const focoAntes = document.activeElement
  const fondo = document.createElement('div')
  fondo.className = 'ow-lg-fondo'
  fondo.innerHTML = `<section class="ow-lg" role="dialog" aria-modal="true" aria-labelledby="ow-lg-titulo">
    <header class="ow-lg-cab">
      <div><h2 class="ow-lg-titulo" id="ow-lg-titulo">Logros</h2><p class="ow-lg-cuenta" id="ow-lg-cuenta"></p></div>
      <button type="button" class="ow-lg-cerrar" aria-label="Cerrar logros">${ICONO_CERRAR}</button>
    </header>
    <div class="ow-lg-cuerpo"></div>
  </section>`
  document.body.appendChild(fondo)
  const overflowAntes = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  const cuerpo = fondo.querySelector('.ow-lg-cuerpo')
  const cuenta = fondo.querySelector('#ow-lg-cuenta')
  const btnCerrar = fondo.querySelector('.ow-lg-cerrar')

  function cerrar() {
    if (!fondo.isConnected) return
    document.removeEventListener('keydown', alTeclear)
    window.removeEventListener('hashchange', cerrar)
    document.body.style.overflow = overflowAntes
    fondo.remove()
    if (focoAntes?.isConnected) focoAntes.focus?.({ preventScroll: true })
  }
  function alTeclear(e) {
    if (document.querySelector('.ow-festejo')) return   // la celebración atiende sus teclas
    if (e.key === 'Escape') cerrar()
  }
  document.addEventListener('keydown', alTeclear)
  window.addEventListener('hashchange', cerrar)
  btnCerrar.addEventListener('click', cerrar)
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrar() })
  btnCerrar.focus({ preventScroll: true })

  const tarjetaHTML = (t, i) => t.ok
    ? `<button type="button" class="ow-lg-t ok" data-logro="${i}" aria-label="${esc(tituloCelebracion(t, marca().nombre))}. Ver y compartir">
        <span class="ow-lg-icono">${ICONO_COMPARTIR}</span>
        <span class="ow-lg-cifra"><span class="ow-lg-num">${formatoNumero(t.hito)}</span>${ICONO_MEDALLA}</span>
        <span class="ow-lg-nombre">${tituloCortoLogro(t)}</span>
        <span class="ow-lg-pie"><span class="ow-lg-fecha">${t.fecha ? esc(formatoFechaLogro(t.fecha)) : 'Desbloqueado'}</span></span>
      </button>`
    : `<div class="ow-lg-t bloq">
        <span class="ow-lg-num">${formatoNumero(t.hito)}</span>
        <span class="ow-lg-nombre">${tituloCortoLogro(t)}</span>
        <span class="ow-lg-pie">
          <span class="ow-lg-barra" role="progressbar" aria-label="${formatoNumero(t.hito)} ${tituloCortoLogro(t)}" aria-valuemin="0" aria-valuemax="${t.hito}" aria-valuenow="${Math.min(t.actual, t.hito)}"><span style="width:${Math.min(100, Math.round(t.actual / t.hito * 100))}%"></span></span>
          <span class="ow-lg-falta">${t.falta === 1 ? 'falta 1' : `faltan ${formatoNumero(t.falta)}`}</span>
        </span>
      </div>`

  async function cargar() {
    cuenta.textContent = ''
    cuerpo.innerHTML = `<div class="ow-lg-grid">${'<div class="ow-lg-esq"></div>'.repeat(6)}</div>`
    try {
      const [lista, inicio] = await Promise.all([supabase.rpc('logros_lista'), supabase.rpc('resumen_inicio')])
      if (!fondo.isConnected) return
      if (lista.error) throw lista.error
      if (inicio.error) throw inicio.error
      const { desbloqueadas, bloqueadas, total } = tarjetasLogros(lista.data, inicio.data)
      const todas = [...desbloqueadas, ...bloqueadas]
      cuenta.textContent = `${desbloqueadas.length} de ${total} desbloqueados`
      // Dos apartados; dentro de cada uno se conserva el orden (desbloqueadas
      // primero, la más reciente arriba; luego la más cercana).
      cuerpo.innerHTML = [['clientes', 'Clientes registrados'], ['regresos', 'Clientes que regresaron']].map(([tipo, titulo]) => `
        <section class="ow-lg-seccion" aria-labelledby="lg-sec-${tipo}">
          <h3 class="ow-lg-sec" id="lg-sec-${tipo}">${titulo}</h3>
          <div class="ow-lg-grid">${todas.map((t, i) => t.tipo === tipo ? tarjetaHTML(t, i) : '').join('')}</div>
        </section>`).join('')
      cuerpo.querySelectorAll('[data-logro]').forEach(b => b.addEventListener('click', () => {
        const t = todas[Number(b.dataset.logro)]
        if (t?.ok) mostrarCelebracion(t, marca(), { reabrir: true, fecha: t.fecha })
      }))
    } catch (e) {
      if (!fondo.isConnected) return
      if (e?.message?.includes('NEGOCIO_INACTIVO')) { cerrar(); const { logout } = await import('./auth.js'); logout('negocio'); return }
      console.error('Error al cargar los logros:', e)
      cuerpo.innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tus logros.', 'lg-reintentar')
      cuerpo.querySelector('#lg-reintentar')?.addEventListener('click', cargar)
    }
  }
  cargar()
}

// Título del encabezado según la pestaña.
const TITULOS_PESTANA = { resumen: 'Resumen', ajustes: 'Personalización', equipo: 'Equipo' }

// Logo del negocio en el encabezado (o su inicial sobre su color).
function cabLogoHTML(nombre, logoRuta) {
  const url = urlLogo(logoRuta)
  const ini = esc(inicialNegocio(nombre || 'Tu negocio'))
  return `<span class="ow-vista-avatar ow-cab-logo${url ? ' con-logo' : ''}" style="--vista-color:var(--ow-acento);--vista-texto:var(--ow-acento-texto)" aria-hidden="true">${ini}${url ? `<img src="${esc(url)}" alt="" onerror="this.parentNode.classList.remove('con-logo');this.remove()">` : ''}</span>`
}

export async function paginaDueno() {
  inyectarEstilosDueno()
  const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
  if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
  const pestana = leerPestanaDueno()
  return `
    <div class="ow" id="dn-root">
      <header class="ow-cab">
        <div class="ow-cab-id">
          <span id="dn-cab-logo">${cabLogoHTML(negocio.nombre, negocio.logo_ruta)}</span>
          <div class="ow-cab-textos">
            <div class="ow-cab-hola" id="dn-cab-hola">Hola, ${esc(negocio.nombre || '')}</div>
            <h1 class="ow-cab-titulo" id="dn-cab-titulo">${TITULOS_PESTANA[pestana]}</h1>
          </div>
        </div>
        <div class="ow-menu-caja">
          <button type="button" class="ow-menu-btn" id="dn-menu-btn" aria-label="Menú" aria-haspopup="true" aria-expanded="false" aria-controls="dn-menu">☰</button>
          <div class="ow-menu" id="dn-menu" hidden>
            <button type="button" id="dn-menu-logros">Logros</button>
            <button type="button" id="dn-menu-contrasena">Cambiar contraseña</button>
            <button type="button" id="dn-menu-salir">Salir</button>
            <button type="button" id="dn-menu-whatsapp">Tu WhatsApp (opcional)</button>
          </div>
        </div>
      </header>
      <main class="ow-cuerpo">
        <div class="ow-tabs" role="tablist" aria-label="Mi panel">
          <button class="ow-tab" role="tab" id="tab-resumen" aria-controls="dn-resumen" data-pestana="resumen" aria-selected="${pestana === 'resumen'}">Resumen</button>
          <button class="ow-tab" role="tab" id="tab-ajustes" aria-controls="dn-ajustes" data-pestana="ajustes" aria-selected="${pestana === 'ajustes'}">Personalización</button>
          <button class="ow-tab" role="tab" id="tab-equipo" aria-controls="dn-equipo" data-pestana="equipo" aria-selected="${pestana === 'equipo'}">Equipo</button>
        </div>
        <div id="dn-resumen" role="tabpanel" aria-labelledby="tab-resumen"${pestana === 'resumen' ? '' : ' hidden'}>${esqueletoResumen()}</div>
        <div id="dn-ajustes" role="tabpanel" aria-labelledby="tab-ajustes"${pestana === 'ajustes' ? '' : ' hidden'}>${esqueletoAjustes()}</div>
        <div id="dn-equipo" role="tabpanel" aria-labelledby="tab-equipo"${pestana === 'equipo' ? '' : ' hidden'}>
          <section class="ow-tarjeta" id="dn-eq-semana">${[52, 52].map(bloqueEsq).join('')}</section>
          <section class="ow-tarjeta" id="dn-visitas" aria-labelledby="dn-visitas-titulo">${[52, 52, 52].map(bloqueEsq).join('')}</section>
          <div id="dn-eq-meseros">${[160].map(bloqueEsq).join('')}</div>
          <div id="dn-eq-ajustes">${[120, 120].map(bloqueEsq).join('')}</div>
        </div>
      </main>
      ${navBarDueno('panel')}
    </div>
  `
}

// Menú ☰ del encabezado: Logros, Cambiar contraseña, Salir y Tu WhatsApp.
function initMenuDueno({ alLogros = null } = {}) {
  const btn = document.getElementById('dn-menu-btn')
  const menu = document.getElementById('dn-menu')
  if (!btn || !menu) return
  const abierto = () => !menu.hidden
  function cerrar(devolverFoco = false) {
    if (!abierto()) return
    menu.hidden = true; btn.setAttribute('aria-expanded', 'false')
    document.removeEventListener('click', alTocarFuera, true)
    document.removeEventListener('keydown', alTeclear)
    if (devolverFoco) btn.focus()
  }
  function abrir() {
    menu.hidden = false; btn.setAttribute('aria-expanded', 'true')
    document.addEventListener('click', alTocarFuera, true)
    document.addEventListener('keydown', alTeclear)
    menu.querySelector('button')?.focus()
  }
  const alTocarFuera = e => { if (!menu.contains(e.target) && e.target !== btn) cerrar() }
  const alTeclear = e => { if (e.key === 'Escape') cerrar(true) }
  btn.addEventListener('click', () => abierto() ? cerrar() : abrir())
  document.getElementById('dn-menu-logros').addEventListener('click', () => { cerrar(); alLogros?.() })
  document.getElementById('dn-menu-contrasena').addEventListener('click', () => { cerrar(); abrirCambiarContrasena() })
  document.getElementById('dn-menu-whatsapp').addEventListener('click', () => { cerrar(); abrirWhatsappDueno() })
  document.getElementById('dn-menu-salir').addEventListener('click', async () => {
    cerrar()
    const { logout } = await import('./auth.js'); logout()
  })
}

export async function initDueno(negocioId) {
  inyectarEstilosDueno(); initNavDueno()
  ayudasMotor.activar('dn-root', AYUDAS_DUENO)
  const sesion = ++duenoSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === duenoSesion && !!$('dn-root')
  const estado = { resumenCargado: 0, resumenViejo: false, ajustesCargados: false, cargandoResumen: false, cargandoAjustes: false, equipoCargado: false, cargandoEquipo: false, nombre: '', logoRuta: undefined, logrosRevisados: false }

  // Nombre, color y logo del negocio para los logros: lo más reciente de
  // Personalización y, mientras carga, lo guardado al entrar.
  const negocioLocal = () => { try { return JSON.parse(localStorage.getItem('negocio')) || {} } catch (e) { return {} } }
  const marca = () => {
    const local = negocioLocal()
    return {
      nombre: estado.nombre || local.nombre || '',
      color: document.documentElement.style.getPropertyValue('--negocio-color').trim() || local.color_principal,
      logoRuta: estado.logoRuta !== undefined ? estado.logoRuta : local.logo_ruta,
    }
  }
  initMenuDueno({ alLogros: () => abrirLogros(marca) })

  // Los logros esperan a Personalización (trae color y logo), máx. 5 s.
  let avisarMarca
  const marcaLista = new Promise(r => { avisarMarca = r })

  // Celebración (Fase C): una vez por visita al panel, cuando el Resumen está
  // a la vista. Del mayor hito pendiente de cada tipo: primero regresos y
  // luego clientes, una pantalla a la vez. Si algo falla, no se muestra nada.
  async function revisarLogros() {
    if (estado.logrosRevisados || !vigente() || $('dn-resumen').hidden) return
    estado.logrosRevisados = true
    try {
      const { data, error } = await supabase.rpc('logros_pendientes')
      if (error || !Array.isArray(data) || !vigente()) return
      const mayor = {}
      for (const l of data) if (esLogro(l) && Number(l.hito) > (mayor[l.tipo] || 0)) mayor[l.tipo] = Number(l.hito)
      const cola = TIPOS_LOGRO.filter(t => mayor[t]).map(t => ({ tipo: t, hito: mayor[t] }))
      if (cola.length === 0) return
      await Promise.race([marcaLista, new Promise(r => setTimeout(r, 5000))])
      for (const l of cola) {
        if (!vigente()) return
        await mostrarCelebracion(l, marca())
      }
    } catch (e) { /* en silencio */ }
  }

  async function salirSiInactivo(e) {
    if (!e?.message?.includes('NEGOCIO_INACTIVO')) return false
    const { logout } = await import('./auth.js'); logout('negocio')
    return true
  }

  function mostrarPestana(p) {
    guardarPestanaDueno(p)
    document.querySelectorAll('.ow-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pestana === p)))
    $('dn-resumen').hidden = p !== 'resumen'
    $('dn-ajustes').hidden = p !== 'ajustes'
    $('dn-equipo').hidden = p !== 'equipo'
    $('dn-cab-titulo').textContent = TITULOS_PESTANA[p] || ''
    if (p === 'resumen' && estado.resumenViejo) cargarResumen()
    if (p === 'resumen' && estado.resumenCargado) revisarLogros()
    if (p === 'resumen') pintarGrafica()   // se dibuja al ancho real
    if (p === 'ajustes' && !estado.ajustesCargados) cargarAjustes()
    if (p === 'equipo' && !estado.equipoCargado) cargarEquipo()
  }

  // Pestaña "Equipo", sección Meseros (Fase 4C): lista con equipo_negocio();
  // altas, nuevas contraseñas y bajas con la Edge Function crear-mesero.
  // Las otras secciones de la pestaña: "Cómo va tu equipo" y Visitas recientes
  // (con el resumen) y Números del personal / QR abiertos (con Personalización).
  async function cargarEquipo() {
    if (estado.cargandoEquipo) return
    estado.cargandoEquipo = true
    if (!estado.equipoCargado) $('dn-eq-meseros').innerHTML = bloqueEsq(160)
    try {
      const { data, error } = await supabase.rpc('equipo_negocio')
      if (!vigente()) return
      if (error) throw error
      const meseros = data?.meseros || []
      $('dn-eq-meseros').innerHTML = equipoHTML(data)
      estado.equipoCargado = true
      const nombreNegocio = estado.nombre || (() => { try { return JSON.parse(localStorage.getItem('negocio'))?.nombre || '' } catch (e) { return '' } })()
      const buscar = id => meseros.find(m => m.usuario_id === id)
      $('eq-agregar')?.addEventListener('click', () => abrirAgregarMesero(nombreNegocio, cargarEquipo))
      $('dn-eq-meseros').querySelectorAll('[data-nueva]').forEach(b => b.addEventListener('click', () => {
        const m = buscar(b.dataset.nueva); if (m) abrirNuevaContrasena(m, nombreNegocio)
      }))
      $('dn-eq-meseros').querySelectorAll('[data-desactivar]').forEach(b => b.addEventListener('click', () => {
        const m = buscar(b.dataset.desactivar); if (m) abrirDesactivar(m, () => { cargarEquipo(); estado.resumenViejo = true })
      }))
    } catch (e) {
      if (!vigente() || await salirSiInactivo(e)) return
      console.error('Error al cargar el equipo:', e)
      if (!estado.equipoCargado) {
        $('dn-eq-meseros').innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tu equipo.', 'dn-reintentar-equipo')
        $('dn-reintentar-equipo')?.addEventListener('click', cargarEquipo)
      }
    } finally {
      estado.cargandoEquipo = false
    }
  }

  // Resumen (Fase B): todo llega en una sola carga; el selector Mes/Semana
  // cambia sin volver a pedir nada. "elegido": el dueño tocó el selector en
  // esta visita al panel (si no, cada carga vuelve a decidir con la regla).
  const res = { datos: null, periodo: 'mes', elegido: false }

  // Gráfica "Clientes en tu programa": "Todo" llega con el resumen; "30 días"
  // se pide solo cuando se toca ese chip (y se guarda hasta la siguiente carga).
  const gc = { modo: 'todo', d30: null, pedido30: 0 }
  function pintarGrafica() {
    const caja = $('dn-grafica-clientes')
    if (!caja) return
    const todo = res.datos?.grafica
    if (!todo) { caja.innerHTML = ''; return }   // si falló, no se muestra
    const cargando = gc.modo === '30' && !gc.d30
    const g = gc.modo === '30' ? (gc.d30 || todo) : todo
    caja.innerHTML = graficaClientesHTML(g, gc.modo, (caja.clientWidth || 320) - 42, cargando)
    caja.querySelectorAll('[data-rango]').forEach(b => b.addEventListener('click', () => {
      if (gc.modo === b.dataset.rango) return
      gc.modo = b.dataset.rango
      if (gc.modo === '30' && !gc.d30) cargar30()
      pintarGrafica()
      caja.querySelector(`[data-rango="${gc.modo}"]`)?.focus()
    }))
  }
  async function cargar30() {
    const pedido = ++gc.pedido30
    try {
      const { data, error } = await supabase.rpc('grafica_clientes', { p_dias: 30 })
      if (!vigente() || pedido !== gc.pedido30) return
      if (error) throw error
      gc.d30 = data
    } catch (e) {
      if (!vigente() || pedido !== gc.pedido30) return
      console.error('Error al cargar la gráfica de 30 días:', e)
      gc.modo = 'todo'
    }
    pintarGrafica()
  }

  function pintarPeriodo() {
    const caja = $('dn-periodo')
    if (!caja || !res.datos) return
    caja.innerHTML = periodoHTML(res.datos, res.periodo)
    caja.querySelectorAll('[data-periodo]').forEach(b => b.addEventListener('click', () => {
      if (res.periodo === b.dataset.periodo) return
      res.periodo = b.dataset.periodo; res.elegido = true
      pintarPeriodo()
      caja.querySelector(`[data-periodo="${res.periodo}"]`)?.focus()
    }))
  }

  function pintarResumen() {
    const d = res.datos
    if (!d) return
    if (!res.elegido) res.periodo = periodoInicialResumen(d)
    $('dn-resumen').innerHTML = resumenHTML(d, res.periodo)
    pintarPeriodo()
    pintarGrafica()
    $('dn-ir-cajero')?.addEventListener('click', () => navigate('cajero'))
    $('dn-ver-logros')?.addEventListener('click', () => abrirLogros(marca))
    $('dn-ver-actividad')?.addEventListener('click', abrirActividad)
    $('dn-invita-ticket')?.addEventListener('click', () => {
      mostrarPestana('ajustes')
      // Cuando Personalización termine de cargar, el campo del ticket queda a la vista.
      const enfocar = (intentos = 20) => {
        const campo = $('prog-ticket')
        if (campo) { campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); campo.focus({ preventScroll: true }) }
        else if (intentos > 0 && vigente()) setTimeout(() => enfocar(intentos - 1), 150)
      }
      enfocar()
    })
    $('dn-ver-cerca')?.addEventListener('click', () => {
      const c = d.cerca || {}
      const total = Number(c.total) || 0
      const lista = c.clientes || []
      abrirListaClientes({
        titulo: total === 1 ? '1 cliente está a 1 visita de su premio' : `${formatoNumero(total)} clientes están a 1 visita de su premio`,
        sub: 'Su próxima visita les da el premio',
        clientes: lista,
        nota: total > lista.length ? `Se muestran ${formatoNumero(lista.length)} de ${formatoNumero(total)}.` : '',
      })
    })
    $('dn-ver-inactivos')?.addEventListener('click', () => {
      const lista = d.inactivos?.clientes || []
      abrirListaClientes({
        titulo: 'No vienen desde hace 21 días',
        sub: 'Los que vinieron más recientemente, primero.',
        clientes: lista,
        detalle: c => `Última visita hace ${formatoNumero(c.dias)} días · ${formatoNumero(c.visitas)} ${Number(c.visitas) === 1 ? 'visita' : 'visitas'}`,
      })
    })
  }

  // Visitas recientes (Fase 6). Lo ya traído se guarda para repintar al
  // instante cuando el resumen se vuelve a dibujar.
  const vis = { lista: null, mostrar: VISITAS_POR_PAGINA, topado: false, aviso: '', avisoHasta: 0, pedido: 0, error: '' }

  function pintarVisitas() {
    const caja = $('dn-visitas')
    if (!caja) return
    if (!vis.lista) {
      caja.innerHTML = vis.error
        ? `<h2 class="ow-titulo-sec" id="dn-visitas-titulo">Visitas recientes</h2><p style="margin-bottom:12px">${vis.error}</p><button class="ow-btn secundario" id="dn-visitas-reintentar">Reintentar</button>`
        : [52, 52, 52].map(bloqueEsq).join('')
      $('dn-visitas-reintentar')?.addEventListener('click', () => { vis.error = ''; cargarVisitas() })
      return
    }
    const aviso = Date.now() < vis.avisoHasta ? vis.aviso : ''
    caja.innerHTML = visitasHTML(vis.lista, vis.mostrar, aviso, vis.topado)
    $('dn-visitas-mas')?.addEventListener('click', () => { vis.mostrar += VISITAS_POR_PAGINA; pintarVisitas() })
    caja.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', () => {
      const v = vis.lista.find(x => x.id === b.dataset.anular)
      if (!v || v.anulada) return
      abrirAnularVisita(v, (anulada, motivo) => {
        if (!vigente()) return
        anulada.anulada = true; anulada.motivo = motivo
        vis.aviso = `Visita anulada. Se le restó el punto a ${anulada.nombre}.`
        vis.avisoHasta = Date.now() + 8000
        pintarVisitas()
        // Cambian "visitas esta semana", la gráfica y la tabla del equipo.
        cargarResumen()
      }, async e => {
        if (!vigente()) return
        if (await salirSiInactivo(e)) return
        if (/VISITA_YA_ANULADA|VISITA_NO_ENCONTRADA/.test(e?.message || '')) cargarVisitas()
      })
    }))
  }

  async function cargarVisitas() {
    if (!$('dn-visitas')) return
    const pedido = ++vis.pedido
    pintarVisitas()
    try {
      const desde = new Date(Date.now() - DIAS_VISITAS_RECIENTES * 86400000).toISOString()
      const [v, eq, ses] = await Promise.all([
        supabase.from('visitas')
          .select('id, fecha, origen, mesero_id, anulada_en, anulada_motivo, clientes(nombre, telefono)')
          .eq('negocio_id', negocioId)
          .gte('fecha', desde)
          .order('fecha', { ascending: false })
          .limit(MAX_VISITAS_RECIENTES),
        supabase.rpc('equipo_negocio'),
        supabase.auth.getSession(),
      ])
      if (!vigente() || pedido !== vis.pedido) return
      if (v.error) throw v.error
      // Si no llegan los nombres del equipo, la lista se muestra igual sin ellos.
      if (eq.error) console.error('Error al cargar los nombres del equipo:', eq.error)
      const nombres = new Map((eq.data?.meseros || []).map(m => [m.usuario_id, m.nombre]))
      const yo = ses.data?.session?.user?.id
      vis.lista = (v.data || []).map(r => ({
        id: r.id,
        nombre: r.clientes?.nombre || 'Cliente',
        u4: ultimos4(r.clientes?.telefono),
        momento: formatoMomento(r.fecha),
        origen: r.origen,
        mesero: r.mesero_id ? (r.mesero_id === yo ? 'Tú' : nombres.get(r.mesero_id) || 'Mesero') : '',
        anulada: !!r.anulada_en,
        motivo: r.anulada_motivo || '',
      }))
      vis.topado = (v.data || []).length >= MAX_VISITAS_RECIENTES
      vis.error = ''
    } catch (e) {
      if (!vigente() || pedido !== vis.pedido || await salirSiInactivo(e)) return
      console.error('Error al cargar las visitas recientes:', e)
      // Si ya había una lista, se queda; si no, aviso con "Reintentar".
      if (!vis.lista) vis.error = sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar las visitas.'
    }
    pintarVisitas()
  }

  // Resumen y "Cómo va tu equipo" (pestaña Equipo) se cargan juntos.
  // Obligatorias: resumen_inicio y resumen_periodo (mes y semana). Las demás
  // tarjetas, si fallan, simplemente no aparecen (el error queda en consola).
  async function cargarResumen() {
    if (estado.cargandoResumen) return
    estado.cargandoResumen = true
    // Si ya había datos, se quedan en pantalla mientras se actualizan.
    if (!estado.resumenCargado) $('dn-resumen').innerHTML = esqueletoResumen()
    try {
      const [ini, mes, sem, cerca, inact, act, meseros, logros, graf] = await Promise.all([
        supabase.rpc('resumen_inicio'),
        supabase.rpc('resumen_periodo', { p_periodo: 'mes' }),
        supabase.rpc('resumen_periodo', { p_periodo: 'semana' }),
        supabase.rpc('clientes_cerca_premio'),
        supabase.rpc('clientes_inactivos'),
        supabase.rpc('actividad_reciente', { p_limite: 5 }),
        supabase.rpc('resumen_meseros'),
        supabase.rpc('logros_lista'),
        supabase.rpc('grafica_clientes', { p_dias: null }),
      ])
      if (!vigente()) return
      for (const r of [ini, mes, sem]) if (r.error) throw r.error
      const opcional = (r, que) => {
        if (!r.error) return r.data
        console.error(`Error al cargar ${que}:`, r.error)
        return null
      }
      res.datos = {
        inicio: ini.data || {},
        mes: mes.data || {},
        semana: sem.data || {},
        cerca: opcional(cerca, 'los clientes cerca del premio'),
        inactivos: opcional(inact, 'los clientes que no vienen'),
        actividad: opcional(act, 'la actividad reciente'),
        logros: opcional(logros, 'los logros'),
        grafica: opcional(graf, 'la gráfica de clientes'),
      }
      // "30 días" se vuelve a pedir solo si está a la vista.
      gc.d30 = null
      if (gc.modo === '30') cargar30()
      pintarResumen()
      if (meseros.error) {
        console.error('Error al cargar el equipo de la semana:', meseros.error)
        $('dn-eq-semana').innerHTML = `<h2 class="ow-titulo-sec">Cómo va tu equipo esta semana</h2><p style="margin-bottom:12px">${sinInternet(meseros.error) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar esta semana.'}</p><button class="ow-btn secundario" id="dn-reintentar-semana">Reintentar</button>`
        $('dn-reintentar-semana')?.addEventListener('click', cargarResumen)
      } else {
        $('dn-eq-semana').innerHTML = equipoSemanaHTML(Number(ini.data?.clientes_registrados) > 0 ? meseros.data?.meseros : [])
      }
      estado.resumenCargado = Date.now(); estado.resumenViejo = false
      cargarVisitas()
      revisarLogros()
    } catch (e) {
      if (!vigente() || await salirSiInactivo(e)) return
      console.error('Error al cargar el resumen:', e)
      if (!estado.resumenCargado) {
        $('dn-resumen').innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tus números.', 'dn-reintentar-resumen')
        $('dn-reintentar-resumen')?.addEventListener('click', cargarResumen)
        $('dn-eq-semana').innerHTML = `<h2 class="ow-titulo-sec">Cómo va tu equipo esta semana</h2><p style="margin-bottom:12px">${sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar esta semana.'}</p><button class="ow-btn secundario" id="dn-reintentar-semana">Reintentar</button>`
        $('dn-reintentar-semana')?.addEventListener('click', cargarResumen)
        if (!vis.lista) cargarVisitas()  // Visitas recientes no depende del resumen
      }
    } finally {
      estado.cargandoResumen = false
    }
  }

  async function cargarAjustes() {
    if (estado.cargandoAjustes) return
    estado.cargandoAjustes = true
    $('dn-ajustes').innerHTML = esqueletoAjustes()
    try {
      const { data: nd, error } = await supabase.from('negocios')
        .select('id,nombre,activo,meta_puntos,color_principal,premio,max_codigos_activos,ticket_promedio,costo_premio,logo_ruta,mensaje_gracias')
        .eq('id', negocioId).single()
      if (!vigente()) return
      if (error) throw error
      if (nd?.activo === false) { const { logout } = await import('./auth.js'); logout('negocio'); return }
      estado.nombre = nd.nombre || ''
      estado.logoRuta = nd.logo_ruta || null
      aplicarColorNegocio(nd.color_principal)
      // Encabezado: nombre y logo al día (lo guardado en el celular puede ser viejo).
      $('dn-cab-hola').textContent = `Hola, ${estado.nombre}`
      $('dn-cab-logo').innerHTML = cabLogoHTML(estado.nombre, nd.logo_ruta)
      $('dn-ajustes').innerHTML = ajustesHTML(nd, negocioId)
      // Números del personal y QR abiertos viven en la pestaña Equipo.
      $('dn-eq-ajustes').innerHTML = equipoAjustesHTML(nd)
      estado.ajustesCargados = true
      // Si cambian ticket, costo o premio, el resumen y la vista previa se ponen al día.
      const tarjeta = initTarjetaDueno(negocioId, nd, ({ logo_ruta }) => {
        estado.logoRuta = logo_ruta || null
        if (vigente()) $('dn-cab-logo').innerHTML = cabLogoHTML(estado.nombre, logo_ruta)
      })
      initProgramaDueno(nd, ({ meta, premio }) => {
        estado.resumenViejo = true
        tarjeta.actualizar({ meta_puntos: meta, premio })
      })
      initPersonalDueno(negocioId)
      initAjustesExtra(negocioId, estado.nombre)
      // 4F: las ayudas de primera vez vuelven a salir en este celular.
      $('ayuda-otra-vez')?.addEventListener('click', () => {
        reiniciarAyudas()
        $('msg-ayuda').innerHTML = avisoOk('Listo. Las ayudas aparecerán otra vez en tus pantallas.')
      })
    } catch (e) {
      if (!vigente()) return
      console.error('Error al cargar los ajustes:', e)
      const texto = sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tus ajustes.'
      $('dn-ajustes').innerHTML = errorPanelHTML(texto, 'dn-reintentar-ajustes')
      $('dn-reintentar-ajustes')?.addEventListener('click', cargarAjustes)
      $('dn-eq-ajustes').innerHTML = errorPanelHTML(texto, 'dn-reintentar-eq-ajustes')
      $('dn-reintentar-eq-ajustes')?.addEventListener('click', cargarAjustes)
    } finally {
      estado.cargandoAjustes = false
      avisarMarca()
    }
  }

  document.querySelectorAll('.ow-tab').forEach(b => b.addEventListener('click', () => mostrarPestana(b.dataset.pestana)))

  // Al volver a la app después de un rato, los números se actualizan solos.
  const alVolver = () => {
    if (!vigente()) { document.removeEventListener('visibilitychange', alVolver); return }
    if (document.visibilityState !== 'visible') return
    // Resumen y Equipo ("Cómo va tu equipo" y Visitas recientes) se refrescan juntos.
    if ((!$('dn-resumen').hidden || !$('dn-equipo').hidden) && Date.now() - estado.resumenCargado > 60 * 1000) cargarResumen()
  }
  document.addEventListener('visibilitychange', alVolver)

  // La gráfica se vuelve a dibujar al cambiar el ancho (girar el celular).
  let tGrafica = 0
  const alCambiarAncho = () => {
    if (!vigente()) { window.removeEventListener('resize', alCambiarAncho); return }
    clearTimeout(tGrafica)
    tGrafica = setTimeout(() => { if (vigente() && !$('dn-resumen').hidden) pintarGrafica() }, 150)
  }
  window.addEventListener('resize', alCambiarAncho)

  // Personalización se carga desde el principio: trae el color del negocio (el acento).
  cargarResumen()
  cargarAjustes()
  if (leerPestanaDueno() === 'equipo') cargarEquipo()
}

// ═══════════════════════════════════════════════════════════
// ADMINISTRADOR DE SELLO (Fase 5A) — #/admin
// Lista de negocios con TOTALES (nunca datos de clientes), alta de negocios
// piloto con su dueño y Desactivar/Activar.
// - La lista y el cambio de estado: admin_negocios() y admin_cambiar_activo()
//   (supabase/fase-5a.sql), que rechazan a quien no esté en admins.
// - El alta: Edge Function crear-negocio (el navegador nunca tiene llaves de
//   administrador). La contraseña temporal se muestra UNA sola vez.
// Mismo estilo que el panel del dueño (.ow, verde de Sello).
// ═══════════════════════════════════════════════════════════
const MENSAJES_ADMIN = {
  NOMBRE_INVALIDO: 'Escribe el nombre del negocio (de 2 a 60 letras).',
  CORREO_INVALIDO: 'Revisa el correo: no parece válido.',
  CORREO_EN_USO: 'Ese correo ya tiene una cuenta en Sello. Usa otro.',
  YA_TIENE_PERFIL: 'Esa cuenta ya pertenece a un negocio.',
  ACCESO_DENEGADO: 'Esta cuenta no es administradora de Sello.',
  SIN_SESION: 'Tu sesión ya no es válida. Sal y vuelve a entrar.',
  NEGOCIO_NO_ENCONTRADO: 'Ese negocio ya no existe. Recarga la lista.',
}

function mensajeAdmin(e) {
  const m = e?.message || ''
  if (sinInternet(e)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (e?.sinRespuesta) return 'No pudimos conectar con el servidor. Intenta de nuevo en un momento.'
  if (MENSAJES_ADMIN[m]) return MENSAJES_ADMIN[m]
  if (m.includes('Acceso denegado')) return MENSAJES_ADMIN.ACCESO_DENEGADO
  if (m.includes('NEGOCIO_NO_ENCONTRADO')) return MENSAJES_ADMIN.NEGOCIO_NO_ENCONTRADO
  return e?.mensaje || 'Algo salió mal. Intenta de nuevo.'
}

// Llama a la Edge Function. Si responde con error, lee su código y mensaje.
async function llamarCrearNegocio(cuerpo) {
  const { data, error } = await supabase.functions.invoke('crear-negocio', { body: cuerpo })
  if (error) {
    let info = null
    try { info = await error.context?.json?.() } catch (e) {}
    const err = new Error(info?.error || error.name || 'ERROR')
    err.mensaje = info?.mensaje
    err.sinRespuesta = !info && /FetchError|RelayError/i.test(error.name || '')
    throw err
  }
  return data
}

const limpiarNombreNegocio = t => String(t || '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '').replace(/\s+/g, ' ').trim()
const formatoFechaAlta = f => {
  const d = new Date(f)
  return isNaN(d) ? '—' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}
const plural = (n, uno, varios) => `${formatoNumero(n)} ${Number(n) === 1 ? uno : varios}`

function adminCifrasHTML(negocios) {
  const activos = negocios.filter(n => n.activo).length
  const clientes = negocios.reduce((s, n) => s + (Number(n.clientes) || 0), 0)
  const visitas = negocios.reduce((s, n) => s + (Number(n.visitas_7_dias) || 0), 0)
  return `<div class="ow-cifras">
    <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(activos)} <span class="ow-cifra-de">de ${formatoNumero(negocios.length)}</span></div><div class="ow-cifra-lbl">Negocios activos</div></div>
    <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(clientes)}</div><div class="ow-cifra-lbl">Clientes registrados</div></div>
    <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(visitas)}</div><div class="ow-cifra-lbl">Visitas, últimos 7 días</div></div>
  </div>`
}

function adminListaHTML(negocios, logros = null) {
  if (negocios.length === 0) {
    return `<div class="ow-tarjeta"><div class="ow-vacio">Aún no hay negocios. Crea el primero: toma menos de un minuto.</div></div>`
  }
  return `<div class="ow-tarjeta">${negocios.map(n => `
    <div class="ow-mesero-fila">
      <div class="ow-negocio-info">
        <div class="ow-mesero-info">
          <span class="ow-persona">${esc(n.nombre)}</span>
          <span class="ow-estado ${n.activo ? 'activo' : 'inactivo'}">${n.activo ? 'Activo' : 'Desactivado'}</span>
        </div>
        <span class="ow-negocio-datos">${n.correo ? `${esc(n.correo)} · ` : ''}Alta: ${esc(formatoFechaAlta(n.creado_en))}</span>
        <span class="ow-negocio-datos">${plural(n.clientes, 'cliente', 'clientes')} · ${plural(n.visitas_7_dias, 'visita', 'visitas')} en 7 días</span>
        ${(() => { const l = logros?.get(n.id); return l ? `<span class="ow-negocio-datos">Logros: ${formatoNumero(l.cantidad)}${l.ultimo_hito ? ` · último: ${ultimoLogroCorto(l.ultimo_tipo, l.ultimo_hito)}` : ''}</span>` : '' })()}
      </div>
      <div class="ow-mesero-acciones">
        <button class="ow-btn secundario chico" data-telefono="${esc(n.id)}">WhatsApp</button>
        <button class="ow-btn secundario chico${n.activo ? ' ow-texto-atencion' : ''}" data-cambiar="${esc(n.id)}">${n.activo ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>`).join('')}
  </div>`
}

function abrirCrearNegocio(alCrear) {
  const h = abrirHojaDueno({ titulo: 'Crear negocio', sub: 'Creamos el negocio y la cuenta de su dueño.' })
  h.cuerpo.innerHTML = `
    <div class="ow-campo"><label class="ow-label" for="ad-nombre">Nombre del negocio</label><input id="ad-nombre" class="ow-input" maxlength="60" autocomplete="off" autocapitalize="words" placeholder="Ej: Café La Esquina" /></div>
    <div class="ow-campo"><label class="ow-label" for="ad-correo">Correo del dueño</label><input id="ad-correo" type="email" class="ow-input" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="dueno@correo.com" /><p class="ow-ayuda">Con este correo entrará a Sello. Empieza con meta de 10 visitas y "Un café gratis"; lo cambia en su bienvenida.</p></div>
    <div class="ow-campo"><label class="ow-label" for="ad-tel-nuevo">WhatsApp del dueño <span class="ow-nota">(opcional)</span></label><input id="ad-tel-nuevo" type="tel" inputmode="tel" class="ow-input" maxlength="20" autocomplete="off" placeholder="Ej: 998 123 4567" /><p class="ow-ayuda">Solo para que el equipo de Sello lo felicite y le avise de novedades.</p></div>
    <button class="ow-btn primario" id="ad-crear">Crear negocio</button>
    <div id="ad-msg"></div>`
  const nombre = h.cuerpo.querySelector('#ad-nombre'); const correo = h.cuerpo.querySelector('#ad-correo')
  const btn = h.cuerpo.querySelector('#ad-crear'); const msg = h.cuerpo.querySelector('#ad-msg')
  const telefono = h.cuerpo.querySelector('#ad-tel-nuevo')
  setTimeout(() => nombre.focus(), 50)

  async function crear() {
    if (btn.disabled) return
    const n = limpiarNombreNegocio(nombre.value); const c = correo.value.trim().toLowerCase()
    if (n.length < 2 || n.length > 60) { msg.innerHTML = avisoError(MENSAJES_ADMIN.NOMBRE_INVALIDO); nombre.focus(); return }
    if (c.length > 254 || !CORREO_VALIDO.test(c)) { msg.innerHTML = avisoError(MENSAJES_ADMIN.CORREO_INVALIDO); correo.focus(); return }
    btn.disabled = true; btn.textContent = 'Creando negocio...'; msg.innerHTML = ''
    try {
      const tel = telefono.value.trim()
      const datos = await llamarCrearNegocio({ nombre: n, correo: c, ...(tel ? { telefono: tel } : {}) })
      // El negocio se crea aunque el WhatsApp no sea válido: solo se avisa.
      const avisoTel = datos.telefono_aviso === 'TELEFONO_INVALIDO'
        ? 'El WhatsApp no era válido y no se guardó; corrígelo en la lista con "WhatsApp". '
        : datos.telefono_aviso ? 'El WhatsApp no se pudo guardar; agrégalo en la lista con "WhatsApp". ' : ''
      alCrear()
      if (!h.hoja.isConnected) return
      const direccion = `${location.origin}${location.pathname}#/login`
      hojaCredenciales(h, {
        titulo: `Listo, ${datos.nombre} ya está en Sello`,
        correo: datos.correo,
        contrasena: datos.contrasena,
        nota: avisoTel + 'Es una contraseña temporal. Pídele al dueño que la cambie al entrar: Mi panel → menú ☰ → Cambiar contraseña.',
        mensaje: [
          `Hola, ya está lista la cuenta de ${datos.nombre} en Sello.`,
          `1. Abre: ${direccion}`,
          `2. Correo: ${datos.correo}`,
          `3. Contraseña temporal: ${datos.contrasena}`,
          'Al entrar, cámbiala en Mi panel → menú ☰ → Cambiar contraseña.',
        ].join('\n'),
      })
    } catch (e) {
      console.error('Error al crear el negocio:', e?.message)
      msg.innerHTML = avisoError(mensajeAdmin(e))
      btn.disabled = false; btn.textContent = 'Crear negocio'
    }
  }
  nombre.addEventListener('keydown', e => { if (e.key === 'Enter') correo.focus() })
  correo.addEventListener('keydown', e => { if (e.key === 'Enter') telefono.focus() })
  telefono.addEventListener('keydown', e => { if (e.key === 'Enter') crear() })
  btn.addEventListener('click', crear)
}

// ── Logros en el admin (admin_logros, fase 9) ──
// Solo conteos y el WhatsApp del DUEÑO (para felicitarlo); nunca datos de clientes.
const ultimoLogroCorto = (tipo, hito) => tipo === 'regresos'
  ? (Number(hito) === 1 ? 'primer regreso' : `${formatoNumero(hito)} regresos`)
  : `${formatoNumero(hito)} clientes`
const textoLogroAdmin = (tipo, hito) => tipo === 'regresos'
  ? (Number(hito) === 1 ? 'tuvo su primer cliente que regresó' : `llegó a ${formatoNumero(hito)} clientes que regresaron`)
  : `llegó a ${formatoNumero(hito)} clientes`
function felicitacionWhatsApp(negocio, tipo, hito) {
  const logro = tipo === 'regresos'
    ? (Number(hito) === 1 ? `el primer cliente de ${negocio} ya regresó` : `${formatoNumero(hito)} clientes ya regresaron a ${negocio}`)
    : `${negocio} ya tiene ${formatoNumero(hito)} clientes en su programa`
  return `¡Hola! Te escribimos de Sello. ¡Felicidades: ${logro}! Gracias por confiar en nosotros.`
}
const enlaceWhatsApp = (tel, texto) => `https://wa.me/${String(tel).replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`
// "hoy", "ayer", "hace 3 días"; con más de 7 días, fecha corta.
function cuandoDia(iso, ahora = new Date()) {
  const f = new Date(iso)
  if (isNaN(f)) return ''
  const dias = Math.round((diaEnZona(ahora) - diaEnZona(f)) / 86400000)
  if (dias <= 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias <= 7) return `hace ${dias} días`
  return tiempoRelativo(iso, ahora)
}

function logrosRecientesHTML(recientes) {
  const filas = (recientes || []).filter(r => r.principal === true)
  if (filas.length === 0) return '<div class="ow-tarjeta"><div class="ow-vacio">Todavía no hay logros.</div></div>'
  return `<div class="ow-tarjeta">${filas.map(r => `
    <div class="ow-mesero-fila">
      <div class="ow-negocio-info">
        <span><span class="ow-persona">${esc(r.negocio)}</span> ${textoLogroAdmin(r.tipo, r.hito)} · ${esc(cuandoDia(r.celebrado_en))}</span>
        ${r.telefono_dueno ? `<span class="ow-negocio-datos">${esc(telefonoDuenoLegible(r.telefono_dueno))} · <button type="button" class="ow-enlace" style="min-height:0;padding:0;font-size:13px" data-telefono="${esc(r.negocio_id)}">Corregir</button></span>` : ''}
      </div>
      ${r.telefono_dueno
        ? `<a class="ow-btn primario chico" style="text-decoration:none" href="${esc(enlaceWhatsApp(r.telefono_dueno, felicitacionWhatsApp(r.negocio, r.tipo, r.hito)))}" target="_blank" rel="noopener noreferrer" aria-label="Felicitar a ${esc(r.negocio)} por WhatsApp">WhatsApp</a>`
        : `<button type="button" class="ow-btn secundario chico" data-telefono="${esc(r.negocio_id)}">Agregar número</button>`}
    </div>`).join('')}
  </div>`
}

// Corregir (o agregar) el WhatsApp del dueño. Vacío = quitarlo.
function abrirTelefonoDueno(negocio, telActual, alGuardar) {
  const h = abrirHojaDueno({ titulo: `WhatsApp del dueño de ${esc(negocio.nombre)}`, sub: 'Solo lo usa el equipo de Sello. Sus clientes no lo ven.' })
  h.cuerpo.innerHTML = `
    <div class="ow-campo"><label class="ow-label" for="ad-tel">Número de WhatsApp</label>
      <input id="ad-tel" type="tel" inputmode="tel" class="ow-input" maxlength="20" autocomplete="off" value="${esc(telefonoDuenoLegible(telActual))}" placeholder="Ej: 998 123 4567" />
      <p class="ow-ayuda">10 dígitos si es de México; si es de otro país, empieza con + y la lada. Déjalo vacío para quitarlo.</p></div>
    <button class="ow-btn primario" id="ad-tel-guardar">Guardar</button>
    <div id="ad-tel-msg"></div>`
  const campo = h.cuerpo.querySelector('#ad-tel'); const btn = h.cuerpo.querySelector('#ad-tel-guardar'); const msg = h.cuerpo.querySelector('#ad-tel-msg')
  setTimeout(() => campo.focus(), 50)
  async function guardar() {
    if (btn.disabled) return
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { error } = await supabase.rpc('admin_guardar_telefono_dueno', { p_negocio_id: negocio.id, p_telefono: campo.value.trim() })
      if (error) throw error
      h.cerrar()
      alGuardar()
    } catch (e) {
      console.error('Error al guardar el WhatsApp del dueño:', e?.message)
      const m = e?.message || ''
      msg.innerHTML = avisoError(m.includes('TELEFONO_INVALIDO') ? MENSAJE_TELEFONO_DUENO
        : m.includes('NEGOCIO_NO_EXISTE') ? MENSAJES_ADMIN.NEGOCIO_NO_ENCONTRADO : mensajeAdmin(e))
      btn.disabled = false; btn.textContent = 'Guardar'
    }
  }
  btn.addEventListener('click', guardar)
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') guardar() })
}

function abrirCambiarActivo(negocio, alCambiar) {
  const desactivar = negocio.activo
  const h = abrirHojaDueno({
    titulo: desactivar ? `¿Desactivar ${esc(negocio.nombre)}?` : `¿Activar ${esc(negocio.nombre)}?`,
    sub: desactivar
      ? 'Su dueño y sus meseros ya no podrán entrar ni generar códigos, y sus clientes no podrán sumar puntos. No se borra nada: puedes activarlo de nuevo.'
      : 'Vuelve a funcionar para su dueño, sus meseros y sus clientes, con todos sus datos.',
  })
  h.cuerpo.innerHTML = `
    <button class="ow-btn ${desactivar ? 'ow-btn-atencion' : 'primario'}" id="ad-si">${desactivar ? 'Sí, desactivar' : 'Sí, activar'}</button>
    <button class="ow-btn secundario" id="ad-no">Cancelar</button>
    <div id="ad-msg"></div>`
  const btn = h.cuerpo.querySelector('#ad-si'); const msg = h.cuerpo.querySelector('#ad-msg')
  const textoBtn = btn.textContent
  h.cuerpo.querySelector('#ad-no').addEventListener('click', () => h.cerrar())
  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    btn.disabled = true; btn.textContent = desactivar ? 'Desactivando...' : 'Activando...'; msg.innerHTML = ''
    try {
      const { error } = await supabase.rpc('admin_cambiar_activo', { p_negocio_id: negocio.id, p_activo: !desactivar })
      if (error) throw error
      h.cerrar()
      alCambiar()
    } catch (e) {
      console.error('Error al cambiar el estado del negocio:', e?.message)
      msg.innerHTML = avisoError(mensajeAdmin(e))
      btn.disabled = false; btn.textContent = textoBtn
    }
  })
}

let adminSesion = 0

export function paginaAdmin() {
  inyectarEstilosDueno()
  return `
    <div class="ow ow-sello" id="ad-root">
      <header class="ow-cab">${logoSelloHTML(22)}<span class="ow-cab-negocio">Administración</span></header>
      <main class="ow-cuerpo">
        <div id="ad-cifras">${bloqueEsq(88)}</div>
        <section class="ow-seccion" aria-labelledby="sec-logros-recientes">
          <h2 class="ow-seccion-titulo" id="sec-logros-recientes">Logros recientes</h2>
          <p class="ow-seccion-sub">Felicita al dueño por WhatsApp.</p>
          <div id="ad-logros">${bloqueEsq(120)}</div>
        </section>
        <section class="ow-seccion" aria-labelledby="sec-negocios">
          <div class="ow-admin-cab">
            <div>
              <h1 class="ow-seccion-titulo" id="sec-negocios">Negocios</h1>
              <p class="ow-seccion-sub" style="margin-bottom:0">Solo totales. Aquí nunca se ven datos de clientes.</p>
            </div>
            <button class="ow-btn primario chico" id="ad-nuevo">Crear negocio</button>
          </div>
          <div id="ad-lista">${bloqueEsq(220)}</div>
        </section>
      </main>
      <nav class="ow-nav" aria-label="Secciones">
        <button id="ad-nav-negocios" aria-current="page">Negocios</button>
        <button id="ad-nav-panel" hidden>Mi panel</button>
        <button id="ad-nav-salir">Salir</button>
      </nav>
    </div>`
}

export function initAdmin() {
  inyectarEstilosDueno()
  const sesion = ++adminSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === adminSesion && !!$('ad-root')
  let negocios = []
  let cargando = false
  let cargado = false

  // "Mi panel" solo si esta cuenta también es dueña de un negocio.
  import('./auth.js').then(({ getNegocioActual }) => { if (getNegocioActual() && $('ad-nav-panel')) $('ad-nav-panel').hidden = false })
  $('ad-nav-negocios')?.addEventListener('click', () => cargar())
  $('ad-nav-panel')?.addEventListener('click', () => navigate('dueno'))
  $('ad-nav-salir')?.addEventListener('click', async () => { const { logout } = await import('./auth.js'); logout() })
  $('ad-nuevo')?.addEventListener('click', () => abrirCrearNegocio(cargar))

  async function cargar() {
    if (cargando) return
    cargando = true
    try {
      const [neg, lg] = await Promise.all([supabase.rpc('admin_negocios'), supabase.rpc('admin_logros')])
      if (!vigente()) return
      if (neg.error) throw neg.error
      negocios = Array.isArray(neg.data?.negocios) ? neg.data.negocios : []
      // Logros: si fallan, la lista de negocios se muestra igual.
      let porNegocio = null
      let recientes = []
      if (lg.error) {
        console.error('Error al cargar los logros:', lg.error?.message)
        $('ad-logros').innerHTML = errorPanelHTML(sinInternet(lg.error) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar los logros.', 'ad-reintentar-logros')
        $('ad-reintentar-logros')?.addEventListener('click', cargar)
      } else {
        recientes = Array.isArray(lg.data?.recientes) ? lg.data.recientes : []
        porNegocio = new Map((lg.data?.negocios || []).map(x => [x.negocio_id, x]))
        $('ad-logros').innerHTML = logrosRecientesHTML(recientes)
      }
      // El número del dueño solo se conoce si ya aparece en un logro.
      const telefonos = new Map(recientes.filter(r => r.telefono_dueno).map(r => [r.negocio_id, r.telefono_dueno]))
      const abrirTel = id => {
        const n = negocios.find(x => x.id === id) || { id, nombre: recientes.find(r => r.negocio_id === id)?.negocio || 'este negocio' }
        abrirTelefonoDueno(n, telefonos.get(id) || '', cargar)
      }
      $('ad-cifras').innerHTML = adminCifrasHTML(negocios)
      $('ad-lista').innerHTML = adminListaHTML(negocios, porNegocio)
      document.querySelectorAll('#ad-lista [data-telefono], #ad-logros [data-telefono]').forEach(b => b.addEventListener('click', () => abrirTel(b.dataset.telefono)))
      cargado = true
      $('ad-lista').querySelectorAll('[data-cambiar]').forEach(b => b.addEventListener('click', () => {
        const n = negocios.find(x => x.id === b.dataset.cambiar)
        if (n) abrirCambiarActivo(n, cargar)
      }))
    } catch (e) {
      if (!vigente()) return
      console.error('Error al cargar los negocios:', e?.message)
      if (e?.message?.includes('Acceso denegado')) {
        // Ya no es administrador: fuera de esta pantalla.
        const { marcarAdmin } = await import('./auth.js'); marcarAdmin(false)
        window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange'))
        return
      }
      if (!cargado) {
        $('ad-cifras').innerHTML = ''
        $('ad-logros').innerHTML = ''
        $('ad-lista').innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar los negocios.', 'ad-reintentar')
        $('ad-reintentar')?.addEventListener('click', cargar)
      }
    } finally {
      cargando = false
    }
  }

  cargar()
}
