import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

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
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
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


    .landing-root { min-height: 100vh; background: ${DS.gray50}; }
    .landing-hero { background: linear-gradient(145deg, ${DS.green900}, var(--negocio-color, ${DS.green800})); padding: 60px 24px 80px; text-align: center; position: relative; }
    .landing-hero::after { content: ''; position: absolute; bottom: -2px; left: 0; right: 0; height: 40px; background: ${DS.gray50}; border-radius: 40px 40px 0 0; }
    .landing-nombre { font-family: 'Sora', sans-serif; font-size: 36px; font-weight: 800; color: ${DS.white}; margin-bottom: 8px; }
    .landing-tag { font-size: 14px; color: rgba(255,255,255,0.5); }
    .landing-premio { background: ${DS.white}; border-radius: 14px; padding: 16px 20px; display: flex; align-items: center; gap: 14px; box-shadow: 0 2px 12px rgba(0,0,0,0.06); margin-bottom: 12px; }
    .landing-cta-btn { width: 100%; padding: 18px; background: linear-gradient(135deg, ${DS.green600}, ${DS.green700}); border: none; border-radius: 14px; color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; }

    .cj-main { padding: 20px 16px 8px; }
    .cj-cobre { width: 100%; min-height: 38vh; border: none; border-radius: 24px; background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; font-family: 'Sora', sans-serif; font-size: 26px; font-weight: 800; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s, opacity 0.15s; }
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
    .cj-fila-ver { font-size: 13px; font-weight: 600; color: var(--negocio-color, ${DS.green800}); white-space: nowrap; }
    .cj-vacio { color: #aaa; font-size: 13px; text-align: center; padding: 8px 0; }
    .cj-qr { position: fixed; inset: 0; z-index: 200; background: ${DS.white}; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: calc(24px + env(safe-area-inset-top)) 24px calc(20px + env(safe-area-inset-bottom)); text-align: center; }
    .cj-qr[hidden] { display: none; }
    .cj-qr-titulo { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; color: ${DS.gray900}; }
    .cj-qr-sub { font-size: 15px; color: ${DS.gray500}; margin-top: 4px; }
    .cj-qr-tiempo-lbl { font-size: 12px; color: ${DS.gray500}; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 8px; }
    .cj-qr-tiempo { font-family: 'Sora', sans-serif; font-size: 40px; font-weight: 800; color: ${DS.gray900}; font-variant-numeric: tabular-nums; line-height: 1.1; }
    .cj-qr-botones { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 10px; }
    .dn-ayuda { font-size: 12px; color: ${DS.gray500}; margin-top: 6px; line-height: 1.5; }
    .dn-plantillas { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
    .dn-chip { min-height: 36px; padding: 6px 12px; border: 1.5px solid ${DS.gray300}; border-radius: 999px; background: ${DS.white}; color: ${DS.gray700}; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; }
    .dn-chip:active { background: ${DS.gray100}; }
    .dn-agregar { display: flex; gap: 8px; }
    .dn-agregar .s-input { flex: 1; min-width: 0; }
    .dn-agregar .s-btn { width: auto; padding: 0 20px; }
    .dn-quitar { min-height: 40px; padding: 8px 14px; border: none; border-radius: 10px; background: #fee2e2; color: #dc2626; font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
    .dn-quitar:disabled { opacity: 0.6; }
    .dn-tabs { display: flex; gap: 4px; margin: 14px 16px; padding: 4px; background: ${DS.white}; border-radius: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .dn-tab { flex: 1; min-height: 44px; border: none; border-radius: 10px; background: none; font-family: 'Sora', sans-serif; font-size: 15px; font-weight: 700; color: ${DS.gray500}; cursor: pointer; }
    .dn-tab[aria-selected="true"] { background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; }
    [role="tabpanel"][hidden] { display: none; }
    .dn-hero { background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; border-radius: 20px; padding: 22px 20px; margin: 0 16px 14px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .dn-hero-lbl { font-size: 16px; font-weight: 600; opacity: 0.9; }
    .dn-hero-num { font-family: 'Sora', sans-serif; font-size: 48px; font-weight: 800; line-height: 1.05; font-variant-numeric: tabular-nums; margin-top: 2px; }
    .dn-hero-sub { font-size: 19px; font-weight: 700; margin-top: 6px; line-height: 1.3; }
    .dn-hero-nota { font-size: 14px; font-weight: 500; opacity: 0.8; }
    .dn-hero-invita { display: block; margin-top: 12px; padding: 8px 0; background: none; border: none; color: ${DS.white}; opacity: 0.85; font-family: 'Inter', sans-serif; font-size: 14px; text-align: left; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .dn-cifras { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 16px 14px; }
    .dn-cifras.dos { grid-template-columns: repeat(2, 1fr); }
    .dn-cifra { background: ${DS.white}; border-radius: 16px; padding: 14px 10px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
    .dn-cifra-num { font-family: 'Sora', sans-serif; font-size: 30px; font-weight: 800; line-height: 1.1; color: ${DS.gray900}; font-variant-numeric: tabular-nums; }
    .dn-cifra-de { font-size: 16px; font-weight: 700; color: ${DS.gray500}; }
    .dn-cifra-lbl { font-size: 12px; line-height: 1.3; color: ${DS.gray500}; margin-top: 4px; }
    .dn-cambio { font-size: 12px; font-weight: 700; margin-top: 6px; }
    .dn-cambio.sube { color: ${DS.green700}; }
    .dn-cambio.baja { color: #dc2626; }
    .dn-cambio.igual { color: ${DS.gray500}; }
    .dn-fila-btn { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: calc(100% - 32px); margin: 0 16px 14px; padding: 16px; background: ${DS.white}; border: none; border-radius: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); font-family: 'Inter', sans-serif; text-align: left; cursor: pointer; color: ${DS.gray900}; }
    .dn-fila-btn:disabled { cursor: default; }
    .dn-fila-btn:not(:disabled):active { transform: scale(0.99); }
    .dn-fila-titulo { display: block; font-size: 16px; font-weight: 700; }
    .dn-fila-sub { display: block; font-size: 13px; color: ${DS.gray500}; margin-top: 2px; }
    .dn-fila-der { display: flex; align-items: center; gap: 8px; }
    .dn-fila-num { font-family: 'Sora', sans-serif; font-size: 30px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .dn-fila-flecha { font-size: 28px; color: ${DS.gray300}; line-height: 1; }
    .dn-mesero { padding: 12px 0; border-bottom: 1px solid ${DS.gray100}; }
    .dn-mesero:last-child { border-bottom: none; padding-bottom: 0; }
    .dn-mesero:first-of-type { padding-top: 0; }
    .dn-mesero-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .dn-tu { font-weight: 500; color: ${DS.gray500}; }
    .dn-revisar { flex-shrink: 0; padding: 3px 10px; border-radius: 999px; background: #fee2e2; color: #b91c1c; font-size: 12px; font-weight: 700; }
    .dn-motivo { font-size: 13px; color: #b91c1c; margin-top: 4px; }
    .dn-vacio { text-align: left; }
    .dn-vacio-titulo { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; line-height: 1.2; color: ${DS.gray900}; }
    .dn-vacio-sub { font-size: 15px; color: ${DS.gray500}; margin: 8px 0 14px; }
    .dn-pasos { list-style: none; display: flex; flex-direction: column; gap: 14px; margin-bottom: 18px; }
    .dn-pasos li { display: flex; gap: 12px; font-size: 14px; line-height: 1.45; color: ${DS.gray700}; }
    .dn-pasos strong { color: ${DS.gray900}; font-size: 15px; }
    .dn-paso-icono { font-size: 24px; line-height: 1.2; flex-shrink: 0; }
    .dn-opcional { font-weight: 400; color: ${DS.gray500}; }
    .dn-pesos { position: relative; }
    .dn-pesos span { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: ${DS.gray500}; font-size: 15px; }
    .dn-pesos .s-input { padding-left: 28px; }
    .dn-hoja-fondo { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.55); display: flex; align-items: flex-end; justify-content: center; animation: sFadeIn 0.2s ease; }
    .dn-hoja { width: 100%; max-width: 480px; max-height: 80vh; overflow-y: auto; background: ${DS.white}; border-radius: 24px 24px 0 0; padding: 20px 20px calc(28px + env(safe-area-inset-bottom)); }
    .dn-hoja-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
    .dn-hoja-titulo { font-family: 'Sora', sans-serif; font-size: 18px; font-weight: 800; color: ${DS.gray900}; }
    .dn-hoja-sub { font-size: 13px; color: ${DS.gray500}; margin-top: 2px; }
    .dn-hoja-cerrar { flex-shrink: 0; min-height: 40px; padding: 8px 14px; border: none; border-radius: 10px; background: ${DS.gray100}; color: ${DS.gray700}; font-size: 14px; font-weight: 600; cursor: pointer; }
    .dn-esq { background: linear-gradient(90deg, #e9edf2 25%, #f4f6f9 50%, #e9edf2 75%); background-size: 200% 100%; animation: dnBrillo 1.3s ease-in-out infinite; }
    @keyframes dnBrillo { from { background-position: 200% 0; } to { background-position: -200% 0; } }
    @media (prefers-reduced-motion: reduce) { .dn-esq { animation: none; } }
    .cj-exito { position: fixed; inset: 0; z-index: 300; background: ${DS.green600}; color: ${DS.white}; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: calc(24px + env(safe-area-inset-top)) 24px calc(20px + env(safe-area-inset-bottom)); text-align: center; font-family: 'Sora', sans-serif; animation: sFadeIn 0.2s ease; }
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
    .cj-manual { position: fixed; inset: 0; z-index: 250; background: ${DS.white}; overflow-y: auto; padding: calc(24px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); }
    .cj-manual[hidden] { display: none; }
    .cj-manual-caja { max-width: 420px; margin: 0 auto; }
    .cj-manual .cl-btn { margin-top: 0; }
    .cj-exito.premio .cj-exito-listo { color: #78350f; }
    .cj-canjear { width: 100%; height: 72px; margin-top: 12px; border: 2px solid var(--negocio-color, ${DS.green800}); border-radius: 20px; background: ${DS.white}; color: var(--negocio-color, ${DS.green800}); font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s; }
    .cj-canjear:active { transform: scale(0.98); }
    .cj-canje { position: fixed; inset: 0; z-index: 250; background: ${DS.white}; overflow-y: auto; display: flex; padding: calc(24px + env(safe-area-inset-top)) 20px calc(20px + env(safe-area-inset-bottom)); }
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
    .cl-wrap { max-width: 480px; margin: 0 auto; min-height: 100vh; display: flex; flex-direction: column; padding: calc(16px + env(safe-area-inset-top)) 20px calc(24px + env(safe-area-inset-bottom)); }
    .cl-marca { display: flex; align-items: center; gap: 10px; min-height: 44px; font-size: 16px; font-weight: 700; color: ${DS.gray900}; }
    .cl-marca-icono { width: 32px; height: 32px; border-radius: 50%; background: var(--negocio-color, #2B4ACB); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
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
    .cl-btn { width: 100%; height: 62px; border: none; border-radius: 20px; background: var(--negocio-color, #2B4ACB); color: ${DS.white}; font-family: inherit; font-size: 20px; font-weight: 800; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; transition: transform 0.1s, opacity 0.15s; }
    .cl-btn:active { transform: scale(0.98); }
    .cl-btn:disabled { opacity: 0.6; cursor: wait; }
    .cl-btn.secundario { background: ${DS.gray100}; color: ${DS.gray900}; }
    .cl-cuerpo .cl-btn { margin-top: 28px; }
    .cl-enlace { width: 100%; min-height: 48px; margin-top: 8px; background: none; border: none; font-family: inherit; font-size: 17px; font-weight: 600; color: ${DS.gray500}; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
    .cl-privacidad { font-size: 14px; line-height: 1.5; color: ${DS.gray500}; text-align: center; margin-top: 16px; }
    .cl-privacidad button { background: none; border: none; font: inherit; color: ${DS.gray700}; text-decoration: underline; padding: 12px 4px; margin: -12px -4px; cursor: pointer; }
    .cl-estado-icono { width: 72px; height: 72px; border-radius: 50%; background: ${DS.gray100}; display: flex; align-items: center; justify-content: center; font-size: 34px; margin-bottom: 24px; }
    .cl-exito-icono { width: 72px; height: 72px; border-radius: 50%; background: var(--negocio-color, #2B4ACB); display: flex; align-items: center; justify-content: center; margin-bottom: 20px; animation: sPopIn 0.35s cubic-bezier(0.34,1.56,0.64,1); }
    .cl-listo { margin-top: 20px; border-radius: 20px; padding: 18px; background: ${DS.gold100}; border: 2px solid #fde68a; color: #78350f; font-size: 18px; font-weight: 800; line-height: 1.35; text-align: center; }
    .cl-tarjeta { background: ${DS.white}; border-radius: 24px; padding: 24px 20px; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.04); }
    .cl-progreso { display: flex; align-items: baseline; justify-content: center; gap: 8px; font-weight: 800; font-variant-numeric: tabular-nums; }
    .cl-progreso-num { font-size: 64px; line-height: 1; color: var(--negocio-color, #2B4ACB); }
    .cl-progreso-meta { font-size: 32px; color: ${DS.gray300}; }
    .cl-progreso-lbl { text-align: center; font-size: 15px; color: ${DS.gray500}; margin-top: 6px; }
    .cl-sellos { display: grid; gap: 10px; justify-items: center; margin-top: 22px; }
    .cl-sello { width: 100%; max-width: 52px; aspect-ratio: 1; border-radius: 50%; border: 2px dashed ${DS.gray300}; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .cl-sello.lleno { border: none; background: var(--negocio-color, #2B4ACB); }
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
      <button class="s-nav-btn" id="snav-salir"><span class="s-nav-icon">🚪</span>Salir</button>
    </nav>
    <div style="text-align:center;padding:4px 0 8px;border-top:1px solid rgba(255,255,255,0.08)">
      <button id="snav-privacidad-dueno" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:10px;cursor:pointer;font-family:'Inter',sans-serif;text-decoration:underline">Aviso de privacidad</button>
    </div>
  `
}

function initNavCajero() {
  document.getElementById('snav-cajero')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('snav-salir')?.addEventListener('click', async () => { cerrarTiempoRealCajero(); const { logout } = await import('./auth.js'); logout() })
}

function initNavDueno() {
  document.getElementById('snav-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('snav-cajero-d')?.addEventListener('click', () => navigate('cajero'))
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

function onboardingVisto() { return localStorage.getItem('sello_onboarding') === 'done' }
function marcarOnboardingVisto() { localStorage.setItem('sello_onboarding', 'done') }

// Bienvenida del dueño en 3 pasos. También se muestran en el panel mientras
// el negocio no tiene clientes.
const PASOS_ONBOARDING = [
  { icon: '🎁', titulo: 'Elige tu premio y tu meta', desc: 'Por ejemplo: un café gratis a las 10 visitas. Lo cambias cuando quieras en Mi Panel → Ajustes.' },
  { icon: '👥', titulo: 'Da de alta a tus meseros', desc: 'Cada mesero entra a Sello desde su celular con su propia cuenta. Agrega sus números en Ajustes → Personal para que no ganen puntos.' },
  { icon: '🧾', titulo: 'Haz una visita de prueba', desc: 'Toca "Cobré una cuenta", escanea el QR con tu celular y suma tu primer punto. Así verás lo mismo que tus clientes.' },
]

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
  let recoveryMode = false
  supabase.auth.onAuthStateChange((event) => {
    if (event !== 'PASSWORD_RECOVERY') return
    recoveryMode = true
    const btn = document.getElementById('btn-login')
    const password = document.getElementById('password')
    if (btn) btn.textContent = 'Guardar contraseña'
    if (password) {
      password.value = ''
      password.placeholder = 'Nueva contraseña'
    }
    document.getElementById('msg').textContent = 'Escribe tu nueva contraseña.'
  })
  const doLogin = async () => {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()
    const msg = document.getElementById('msg'); const btn = document.getElementById('btn-login')
    if (!email || !password) { msg.innerHTML = `<p class="s-error">Llena todos los campos</p>`; return }
    btn.disabled = true; btn.textContent = 'Verificando...'; msg.innerHTML = ''
    try {
      const { login, getPerfilActual } = await import('./auth.js')
      if (recoveryMode) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        const perfil = await getPerfilActual()
        window.location.hash = perfil?.role === 'owner' ? '#/bienvenida' : '#/cajero'
        window.dispatchEvent(new Event('hashchange'))
        return
      }
      const negocio = await login(email, password)
      if (!negocio) { msg.innerHTML = `<p class="s-error">Correo o contraseña incorrectos</p>`; return }
      if (negocio.activo === false) { msg.innerHTML = `<p class="s-error">Esta cuenta está desactivada. Contacta al administrador.</p>`; const { logout } = await import('./auth.js'); logout(); return }
      const perfil = await getPerfilActual()
      if (perfil?.role === 'mesero') { window.location.hash = '#/cajero'; window.dispatchEvent(new Event('hashchange')); return }
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
    msgR.innerHTML = `<p style="color:${DS.gray500};font-size:13px;text-align:center">Enviando instrucciones...</p>`
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      })
      if (error) throw error
      msgR.innerHTML = `<p class="s-success">Si existe una cuenta con ese correo, recibirás instrucciones para restablecer la contraseña.</p>`
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
          <button class="sbv-btn primary" id="sbv-cajero"><span class="sbv-btn-icon">🧾</span><div><div>Cajero</div><span class="sbv-btn-sub">Cobrar, dar puntos y canjear premios</span></div></button>
          <button class="sbv-btn secondary" id="sbv-panel"><span class="sbv-btn-icon">📊</span><div><div>Mi Panel</div><span class="sbv-btn-sub">Tus números y ajustes</span></div></button>
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

function mensajeCajero(error, max) {
  const m = error?.message || ''
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

export function paginaCajero() {
  inyectarEstilos()
  return `
    <div id="cj-root" style="padding-bottom:72px">
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
    ${navBarCajero()}
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
    if (!premio) avisos.temporizador = setTimeout(() => { if (vigente()) siguienteAviso() }, 6000)
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

function pantallaCliente({ negocio = null, cuerpo, acciones = '', gris = false, arriba = false }) {
  return `
    <div class="cl-root${gris ? ' gris' : ''}">
      <div class="cl-wrap">
        <div class="cl-marca"><span class="cl-marca-icono">${palomitaSVG(18)}</span><span>${esc(negocio?.nombre || 'Sello')}</span></div>
        <div class="cl-cuerpo${arriba ? ' arriba' : ''}">${cuerpo}</div>
        ${acciones ? `<div class="cl-acciones">${acciones}</div>` : ''}
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
        const contenido = i === meta - 1 ? '🎁' : lleno ? palomitaSVG(18) : ''
        return `<span class="cl-sello${lleno ? ' lleno' : ''}${i === nuevo ? ' nuevo' : ''}">${contenido}</span>`
      }).join('')
    : ''
  const cabecera = modo === 'punto'
    ? `<div class="cl-exito-icono">${palomitaSVG(40)}</div>
       <h1 class="cl-titulo">¡Ganaste 1 punto!</h1>
       <p class="cl-sub">${esc(t.nombre)}, ya llevas ${puntos} de ${meta}.</p>`
    : modo === 'premio'
    ? `<div class="cl-exito-icono emoji" aria-hidden="true">🎁</div>
       <h1 class="cl-titulo">¡Disfruta tu premio!</h1>
       <p class="cl-sub">${t.premio_entregado ? `${esc(t.premio_entregado)}. ` : ''}Ahora llevas ${puntos} de ${meta}.</p>`
    : `<h1 class="cl-titulo">${saludoPorHora()}, ${esc(t.nombre)}</h1>
       <p class="cl-sub">Tu tarjeta en ${esc(negocio?.nombre || 'este negocio')}</p>`
  return pantallaCliente({
    negocio, gris: true, arriba: true,
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
// vuelta. Todo lo calcula el servidor (resumen_dueno, resumen_meseros,
// clientes_inactivos); el navegador solo pinta.
// Pestaña "Ajustes": programa, personal, personalización y exportar.
// ═══════════════════════════════════════════════════════════
const PLANTILLAS_PREMIO = [
  'Un café gratis', 'Un postre gratis', 'Un corte gratis', 'Un taco gratis',
  '20% de descuento en tu cuenta', '10% de descuento', '2x1',
]

// Límites del ticket promedio y del costo del premio (los mismos que revisa el servidor).
const TICKET_MAX = 100000
const COSTO_MAX = 100000

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

function mensajeDueno(error) {
  const m = error?.message || ''
  if (sinInternet(error)) return 'Sin conexión. Revisa tu internet e intenta de nuevo.'
  if (m.includes('META_INVALIDA')) return 'Las visitas para el premio deben ser de 1 a 100.'
  if (m.includes('PREMIO_INVALIDO')) return 'Escribe el premio (máximo 80 letras).'
  if (m.includes('MAX_CODIGOS_INVALIDO')) return 'Los códigos activos deben ser de 1 a 50.'
  if (m.includes('TICKET_INVALIDO')) return `Lo que gasta un cliente debe ser de $1 a ${formatoPesos(TICKET_MAX)}, o déjalo vacío.`
  if (m.includes('COSTO_INVALIDO')) return `El costo del premio debe ser de $0 a ${formatoPesos(COSTO_MAX)}, o déjalo vacío.`
  if (m.includes('TELEFONO_INVALIDO')) return 'Escribe los 10 dígitos del número.'
  if (m.includes('NO_ENCONTRADO')) return 'Ese número ya no estaba en la lista.'
  if (m.includes('Acceso denegado')) return 'Solo el dueño puede ver y cambiar esto. Sal y vuelve a entrar.'
  return 'Algo salió mal. Intenta de nuevo.'
}

// Pestaña elegida: se recuerda en esta pestaña del navegador.
const CLAVE_PESTANA_DUENO = 'sello_pestana_dueno'
function leerPestanaDueno() { try { return sessionStorage.getItem(CLAVE_PESTANA_DUENO) === 'ajustes' ? 'ajustes' : 'resumen' } catch (e) { return 'resumen' } }
function guardarPestanaDueno(p) { try { sessionStorage.setItem(CLAVE_PESTANA_DUENO, p) } catch (e) {} }

// Esqueletos de carga: la forma del panel aparece al instante, nunca en blanco.
function esqueletoResumen() {
  return `
    <div class="dn-esq" style="height:150px;margin:0 16px 14px;border-radius:20px"></div>
    <div class="dn-cifras">${'<div class="dn-esq" style="height:96px;border-radius:16px"></div>'.repeat(3)}</div>
    <div class="dn-esq" style="height:64px;margin:0 16px 14px;border-radius:16px"></div>
    <div class="dn-cifras dos">${'<div class="dn-esq" style="height:96px;border-radius:16px"></div>'.repeat(2)}</div>
    <div class="dn-esq" style="height:140px;margin:0 16px 14px;border-radius:16px"></div>`
}
function esqueletoAjustes() {
  return `<div class="dn-esq" style="height:320px;margin:0 16px 14px;border-radius:16px"></div>
    <div class="dn-esq" style="height:180px;margin:0 16px 14px;border-radius:16px"></div>`
}

// Tarjeta de error con "Reintentar" (nunca pantalla en blanco).
function errorPanelHTML(texto, idBoton) {
  return `<div class="s-card" style="text-align:center">
    <div style="font-size:34px;margin-bottom:8px" aria-hidden="true">📶</div>
    <p style="font-size:15px;color:${DS.gray700};margin-bottom:14px">${texto}</p>
    <button class="s-btn primary" id="${idBoton}">Reintentar</button>
  </div>`
}

// ── Resumen ──
function cambioSemanaHTML(actual, anterior) {
  const dif = (Number(actual) || 0) - (Number(anterior) || 0)
  if (!actual && !anterior) return ''
  if (dif > 0) return `<div class="dn-cambio sube">▲ ${formatoNumero(dif)} vs. la anterior</div>`
  if (dif < 0) return `<div class="dn-cambio baja">▼ ${formatoNumero(-dif)} vs. la anterior</div>`
  return `<div class="dn-cambio igual">Igual que la anterior</div>`
}

function heroResumenHTML(r) {
  const n = Number(r.visitas_repetidas_semana) || 0
  const veces = n === 1 ? '1 vez' : `${formatoNumero(n)} veces`
  if (r.negocio?.ticket_promedio != null) {
    return `<div class="dn-hero">
      <div class="dn-hero-lbl">Esta semana tus clientes volvieron</div>
      <div class="dn-hero-num">${veces}</div>
      <div class="dn-hero-sub">≈ ${formatoPesos(r.ventas_estimadas)} en ventas <span class="dn-hero-nota">(estimado)</span></div>
    </div>`
  }
  return `<div class="dn-hero">
    <div class="dn-hero-num">${formatoNumero(n)}</div>
    <div class="dn-hero-sub">${n === 1 ? 'visita de un cliente que regresó' : 'visitas de clientes que regresaron'} esta semana</div>
    <button type="button" class="dn-hero-invita" id="dn-invita-ticket">¿Cuánto gasta un cliente? Dínoslo y te decimos cuánto vendiste →</button>
  </div>`
}

// Negocio nuevo: en vez de ceros, qué hacer para empezar.
function vacioResumenHTML() {
  return `<div class="s-card dn-vacio">
    <div class="dn-vacio-titulo">Aquí verás si Sello te trae clientes de vuelta</div>
    <p class="dn-vacio-sub">Aún no tienes clientes. Empieza así:</p>
    <ol class="dn-pasos">
      ${PASOS_ONBOARDING.map(p => `<li><span class="dn-paso-icono" aria-hidden="true">${p.icon}</span><span><strong>${p.titulo}</strong><br>${p.desc}</span></li>`).join('')}
    </ol>
    <button class="s-btn primary" id="dn-ir-cajero">Ir al cajero</button>
  </div>`
}

function meserosHTML(meseros) {
  const lista = meseros || []
  const filas = lista.map(m => {
    const partes = [
      `${formatoNumero(m.generados)} ${m.generados === 1 ? 'código' : 'códigos'}`,
      `${formatoNumero(m.reclamados)} ${m.reclamados === 1 ? 'usado' : 'usados'}`,
      `${formatoNumero(m.manuales)} a mano`,
    ]
    if (m.bloqueos_canje > 0) partes.push(`${formatoNumero(m.bloqueos_canje)} ${m.bloqueos_canje === 1 ? 'bloqueo' : 'bloqueos'} al canjear (total)`)
    return `<div class="dn-mesero">
      <div class="dn-mesero-top">
        <span class="s-row-title">${esc(m.nombre)}${m.rol === 'owner' ? ' <span class="dn-tu">(tú)</span>' : ''}</span>
        ${m.revisar ? '<span class="dn-revisar">Revisar</span>' : ''}
      </div>
      <div class="s-row-sub">${partes.join(' · ')}</div>
      ${m.revisar && m.motivo ? `<div class="dn-motivo">${esc(m.motivo)}</div>` : ''}
    </div>`
  }).join('')
  return `<div class="s-card">
    <div class="s-section-label">Tu equipo esta semana</div>
    ${filas || `<p class="cj-vacio">Cuando tu equipo cobre con "Cobré una cuenta", aquí verás a cada mesero.</p>`}
  </div>`
}

function resumenHTML(r, meseros) {
  if (!(Number(r.clientes_registrados) > 0)) return vacioResumenHTML()
  const deCada10 = Math.round((Number(r.porcentaje_regresan) || 0) / 10)
  const entregados = Number(r.premios_entregados_semana) || 0
  return `
    ${heroResumenHTML(r)}
    <div class="dn-cifras">
      <div class="dn-cifra"><div class="dn-cifra-num">${formatoNumero(r.clientes_registrados)}</div><div class="dn-cifra-lbl">clientes registrados</div></div>
      <div class="dn-cifra"><div class="dn-cifra-num">${formatoNumero(r.visitas_semana)}</div><div class="dn-cifra-lbl">visitas esta semana</div>${cambioSemanaHTML(r.visitas_semana, r.visitas_semana_anterior)}</div>
      <div class="dn-cifra"><div class="dn-cifra-num">${deCada10}<span class="dn-cifra-de"> de 10</span></div><div class="dn-cifra-lbl">regresaron al menos una vez</div></div>
    </div>
    <button type="button" class="dn-fila-btn" id="dn-ver-inactivos"${r.inactivos > 0 ? '' : ' disabled'}>
      <span><span class="dn-fila-titulo">Dejaron de venir</span><span class="dn-fila-sub">más de 21 días sin venir</span></span>
      <span class="dn-fila-der"><span class="dn-fila-num">${formatoNumero(r.inactivos)}</span>${r.inactivos > 0 ? '<span class="dn-fila-flecha" aria-hidden="true">›</span>' : ''}</span>
    </button>
    <div class="dn-cifras dos">
      <div class="dn-cifra"><div class="dn-cifra-num">${formatoNumero(entregados)}</div><div class="dn-cifra-lbl">premios entregados esta semana</div>${r.costo_premios_semana != null && entregados > 0 ? `<div class="dn-cambio igual">≈ ${formatoPesos(r.costo_premios_semana)} de costo</div>` : ''}</div>
      <div class="dn-cifra"><div class="dn-cifra-num">${formatoNumero(r.premios_listos)}</div><div class="dn-cifra-lbl">listos para canjear</div></div>
    </div>
    ${meserosHTML(meseros)}`
}

// Hoja con la lista de quienes dejaron de venir (primer nombre y ···4821).
async function abrirInactivos() {
  const hoja = document.createElement('div')
  hoja.className = 'dn-hoja-fondo'
  hoja.innerHTML = `<div class="dn-hoja" role="dialog" aria-label="Dejaron de venir">
    <div class="dn-hoja-cab">
      <div><div class="dn-hoja-titulo">Dejaron de venir</div><div class="dn-hoja-sub">Más de 21 días sin venir. Los más recientes primero.</div></div>
      <button class="dn-hoja-cerrar" id="dn-hoja-cerrar">Cerrar</button>
    </div>
    <div id="dn-hoja-lista">${'<div class="dn-esq" style="height:52px;border-radius:12px;margin-bottom:10px"></div>'.repeat(4)}</div>
  </div>`
  document.body.appendChild(hoja)
  const cerrar = () => hoja.remove()
  hoja.querySelector('#dn-hoja-cerrar').addEventListener('click', cerrar)
  hoja.addEventListener('click', e => { if (e.target === hoja) cerrar() })
  const lista = hoja.querySelector('#dn-hoja-lista')
  try {
    const { data, error } = await supabase.rpc('clientes_inactivos')
    if (error) throw error
    const clientes = data?.clientes || []
    if (!hoja.isConnected) return
    lista.innerHTML = clientes.length === 0
      ? `<p class="cj-vacio">¡Nadie! Todos tus clientes vinieron en las últimas 3 semanas.</p>`
      : clientes.map(c => `<div class="s-row">
          <div><div class="s-row-title">${esc(c.nombre)} <span style="color:${DS.gray500};font-variant-numeric:tabular-nums">···${esc(c.ultimos4)}</span></div>
          <div class="s-row-sub">Vino por última vez hace ${formatoNumero(c.dias)} días</div></div>
          <div class="s-row-sub" style="text-align:right">${formatoNumero(c.visitas)} ${c.visitas === 1 ? 'visita' : 'visitas'}</div>
        </div>`).join('')
  } catch (e) {
    console.error('Error al cargar los clientes inactivos:', e)
    if (hoja.isConnected) lista.innerHTML = `<p class="cj-vacio">${mensajeDueno(e)}</p>`
  }
}

// ── Ajustes ──
function ajustesHTML(nd, negocioId) {
  const landingUrl = `${window.location.origin}/#/landing/${negocioId}`
  const pesos = v => v == null ? '' : String(Number(v))
  return `
    <div class="s-card">
      <div class="s-section-label">Programa</div>
      <div class="s-field">
        <label class="s-label" for="prog-meta">Visitas para ganar el premio</label>
        <input type="number" inputmode="numeric" id="prog-meta" class="s-input" min="1" max="100" value="${nd.meta_puntos ?? 10}" />
      </div>
      <div class="s-field">
        <label class="s-label" for="prog-premio">Premio</label>
        <input type="text" id="prog-premio" class="s-input" maxlength="80" value="${esc(nd.premio || '')}" placeholder="Ej: Un café gratis" />
        <div class="dn-plantillas">${PLANTILLAS_PREMIO.map(p => `<button type="button" class="dn-chip" data-premio="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      </div>
      <div class="s-field">
        <label class="s-label" for="prog-ticket">¿Cuánto gasta en promedio un cliente? <span class="dn-opcional">(opcional)</span></label>
        <div class="dn-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-ticket" class="s-input" value="${pesos(nd.ticket_promedio)}" placeholder="Ej: 120" autocomplete="off" /></div>
        <div class="dn-ayuda">Con esto calculamos cuánto te dejan los clientes que regresan.</div>
      </div>
      <div class="s-field">
        <label class="s-label" for="prog-costo">¿Cuánto te cuesta el premio? <span class="dn-opcional">(opcional)</span></label>
        <div class="dn-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-costo" class="s-input" value="${pesos(nd.costo_premio)}" placeholder="Ej: 25" autocomplete="off" /></div>
      </div>
      <div class="s-field">
        <label class="s-label" for="prog-max">Códigos activos por mesero</label>
        <input type="number" inputmode="numeric" id="prog-max" class="s-input" min="1" max="50" value="${nd.max_codigos_activos ?? 3}" />
        <div class="dn-ayuda">Cuántos QR puede tener abiertos un mesero a la vez. Súbelo si hay mucha gente.</div>
      </div>
      <button id="btn-guardar-programa" class="s-btn primary">Guardar programa</button>
      <div id="msg-programa"></div>
    </div>

    <div class="s-card">
      <div class="s-section-label">Personal (no ganan puntos)</div>
      <div class="dn-ayuda" style="margin:0 0 12px">Agrega el número de cada persona de tu equipo. Esos números no suman puntos.</div>
      <div class="dn-agregar">
        <input type="tel" inputmode="numeric" id="excl-tel" class="s-input" placeholder="10 dígitos" autocomplete="off" />
        <button id="btn-agregar-excl" class="s-btn primary">Agregar</button>
      </div>
      <div id="msg-excl"></div>
      <div id="lista-excl" style="margin-top:8px"><p class="cj-vacio">Cargando...</p></div>
    </div>

    <div class="s-card">
      <div class="s-section-label">Personalización</div>
      <div class="s-field"><label class="s-label" for="input-emoji">Emoji del negocio</label><input type="text" id="input-emoji" class="s-input" value="${esc(nd.emoji_negocio || '☕')}" placeholder="☕" style="font-size:24px;text-align:center" /></div>
      <div class="s-field">
        <label class="s-label" for="input-color">Color principal</label>
        <div style="display:flex;gap:10px;align-items:center">
          <input type="color" id="input-color" value="${esc(nd.color_principal || DS.green800)}" style="width:48px;height:48px;border:none;border-radius:10px;cursor:pointer;padding:2px" />
          <span style="font-size:13px;color:${DS.gray500}">Lo ven tus clientes cuando escanean el QR</span>
        </div>
      </div>
      <div class="s-field"><label class="s-label" for="input-descripcion">Descripción corta</label><input type="text" id="input-descripcion" class="s-input" value="${esc(nd.descripcion || '')}" placeholder="Ej: El mejor café de Chetumal" /></div>
      <button id="btn-guardar-personalizacion" class="s-btn primary" style="margin-top:4px">Guardar personalización</button>
      <div id="msg-personalizacion" style="margin-top:10px"></div>
    </div>

    <div class="s-card">
      <div class="s-section-label">Exportar datos</div>
      <p style="font-size:13px;color:${DS.gray500};margin-bottom:14px">Descarga la lista de tus clientes para abrirla en Excel.</p>
      <button id="btn-exportar-csv" class="s-btn ghost">⬇ Descargar clientes (.csv)</button>
      <div id="msg-exportar" style="margin-top:10px"></div>
    </div>

    <div class="s-card">
      <div class="s-section-label">Tu página pública</div>
      <p style="font-size:13px;color:${DS.gray500};margin-bottom:12px">Compártela en Instagram o WhatsApp.</p>
      <div style="background:${DS.gray50};border-radius:10px;padding:12px 14px;font-size:12px;color:${DS.gray700};word-break:break-all;margin-bottom:12px;border:1px solid ${DS.gray100}">${esc(landingUrl)}</div>
      <div style="display:flex;gap:8px">
        <button id="btn-copiar-landing" class="s-btn ghost" style="flex:1">📋 Copiar link</button>
        <button id="btn-ver-landing" class="s-btn primary" style="flex:1">👁 Ver página</button>
      </div>
      <div id="msg-landing" style="margin-top:8px"></div>
    </div>`
}

// Sección "Programa": se guarda con la RPC guardar_programa (2G, ampliada en Fase 4).
function initProgramaDueno(alGuardar) {
  const $ = id => document.getElementById(id)
  const btn = $('btn-guardar-programa'); const msg = $('msg-programa')
  if (!btn) return
  document.querySelectorAll('.dn-chip').forEach(chip => {
    chip.addEventListener('click', () => { $('prog-premio').value = chip.dataset.premio; $('prog-premio').focus() })
  })
  btn.addEventListener('click', async () => {
    const meta = parseInt($('prog-meta').value, 10)
    const premio = $('prog-premio').value.trim()
    const max = parseInt($('prog-max').value, 10)
    const ticket = leerPesos($('prog-ticket').value)
    const costo = leerPesos($('prog-costo').value)
    // Las mismas reglas que revisa el servidor, para avisar antes de mandar.
    let error = ''
    if (!(meta >= 1 && meta <= 100)) error = 'META_INVALIDA'
    else if (!premio || premio.length > 80) error = 'PREMIO_INVALIDO'
    else if (ticket !== null && !(ticket >= 1 && ticket <= TICKET_MAX)) error = 'TICKET_INVALIDO'
    else if (costo !== null && !(costo >= 0 && costo <= COSTO_MAX)) error = 'COSTO_INVALIDO'
    else if (!(max >= 1 && max <= 50)) error = 'MAX_CODIGOS_INVALIDO'
    if (error) { msg.innerHTML = `<p class="s-error">${mensajeDueno({ message: error })}</p>`; return }
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { error: e } = await supabase.rpc('guardar_programa', {
        p_meta_puntos: meta, p_premio: premio, p_max_codigos_activos: max,
        p_ticket_promedio: ticket, p_costo_premio: costo,
      })
      if (e) throw e
      msg.innerHTML = `<div class="s-success">✓ Programa guardado</div>`
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
      alGuardar?.()
    } catch (e) {
      console.error('Error al guardar el programa:', e)
      msg.innerHTML = `<p class="s-error">${mensajeDueno(e)}</p>`
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar programa'
    }
  })
}

// Sección "Personal (no ganan puntos)": lista de numeros_excluidos (el dueño
// la puede leer por RLS) y altas/bajas con agregar_ / quitar_numero_excluido.
function initPersonalDueno(negocioId) {
  const $ = id => document.getElementById(id)
  const lista = $('lista-excl'); const tel = $('excl-tel'); const btn = $('btn-agregar-excl'); const msg = $('msg-excl')
  if (!lista) return
  let numeros = []
  const avisar = (texto, ok = false) => { msg.innerHTML = texto ? (ok ? `<div class="s-success">${texto}</div>` : `<p class="s-error">${texto}</p>`) : '' }

  function pintar() {
    lista.innerHTML = numeros.length === 0
      ? `<p class="cj-vacio">Aún no agregas números</p>`
      : numeros.map(n => `
        <div class="s-row">
          <div class="s-row-title" style="font-variant-numeric:tabular-nums">${telefonoLegible(n.telefono)}</div>
          <button class="dn-quitar" data-id="${esc(n.id)}">Quitar</button>
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
      lista.innerHTML = `<p class="cj-vacio">${mensajeDueno(e)}</p>`
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
      avisar(data.ya_existia ? 'Ese número ya estaba en la lista.' : '✓ Número agregado', true)
    } catch (e) {
      console.error('Error al agregar el número:', e)
      avisar(mensajeDueno(e))
    } finally {
      btn.disabled = false
    }
  }

  async function quitar(boton) {
    if (boton.disabled) return
    boton.disabled = true; boton.textContent = '...'; avisar('')
    try {
      const { error } = await supabase.rpc('quitar_numero_excluido', { p_id: boton.dataset.id })
      if (error && !error.message?.includes('NO_ENCONTRADO')) throw error
      numeros = numeros.filter(n => n.id !== boton.dataset.id)
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
  lista.addEventListener('click', e => { const b = e.target.closest('.dn-quitar'); if (b) quitar(b) })
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

  $('btn-guardar-personalizacion')?.addEventListener('click', async () => {
    const emoji = $('input-emoji').value.trim()
    const color = $('input-color').value
    const descripcion = $('input-descripcion').value.trim()
    const msg = $('msg-personalizacion'); const btn = $('btn-guardar-personalizacion')
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      const { error } = await supabase.from('negocios').update({ emoji_negocio: emoji, color_principal: color, descripcion }).eq('id', negocioId)
      if (error) throw error
      aplicarColorNegocio(color)
      msg.innerHTML = `<div class="s-success">✓ Personalización guardada</div>`
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
    } catch (e) { msg.innerHTML = errMsg('guardar') }
    finally { btn.disabled = false; btn.textContent = 'Guardar personalización' }
  })

  $('btn-exportar-csv')?.addEventListener('click', async () => {
    const btn = $('btn-exportar-csv'); const msg = $('msg-exportar')
    btn.textContent = 'Preparando...'; btn.disabled = true
    try {
      const { data: clientes, error } = await supabase.from('clientes')
        .select('nombre, telefono, total_visitas, puntos_actuales, fecha_registro')
        .eq('negocio_id', negocioId).order('fecha_registro', { ascending: true })
      if (error) throw error
      exportarCSV(clientes, nombreNegocio)
      msg.innerHTML = `<div class="s-success">✓ Archivo descargado</div>`
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 3000)
    } catch (e) { msg.innerHTML = errMsg('descargar') }
    finally { btn.textContent = '⬇ Descargar clientes (.csv)'; btn.disabled = false }
  })

  $('btn-copiar-landing')?.addEventListener('click', () => {
    const url = `${window.location.origin}/#/landing/${negocioId}`
    navigator.clipboard.writeText(url).then(() => {
      const msg = $('msg-landing')
      if (!msg) return
      msg.innerHTML = `<div class="s-success">✓ Link copiado</div>`
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2000)
    }).catch(() => {})
  })
  $('btn-ver-landing')?.addEventListener('click', () => navigate('landing', negocioId))
}

// Cada visita a #/dueno abre una "sesión"; las respuestas que llegan tarde
// de una visita anterior se ignoran.
let duenoSesion = 0

export async function paginaDueno() {
  inyectarEstilos()
  const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
  if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
  const pestana = leerPestanaDueno()
  return `
    <div id="dn-root" style="padding-bottom:88px">
      <div class="sello-topbar">${topbarBrand()}<span style="font-size:13px;color:rgba(255,255,255,0.6)">${esc(String(negocio.nombre || '').substring(0, 20))}</span></div>
      <div class="dn-tabs" role="tablist">
        <button class="dn-tab" role="tab" data-pestana="resumen" aria-selected="${pestana === 'resumen'}">Resumen</button>
        <button class="dn-tab" role="tab" data-pestana="ajustes" aria-selected="${pestana === 'ajustes'}">Ajustes</button>
      </div>
      <div id="dn-resumen" role="tabpanel"${pestana === 'resumen' ? '' : ' hidden'}>${esqueletoResumen()}</div>
      <div id="dn-ajustes" role="tabpanel"${pestana === 'ajustes' ? '' : ' hidden'}>${esqueletoAjustes()}</div>
    </div>
    ${navBarDueno('panel')}
  `
}

export async function initDueno(negocioId) {
  inyectarEstilos(); initNavDueno()
  const sesion = ++duenoSesion
  const $ = id => document.getElementById(id)
  const vigente = () => sesion === duenoSesion && !!$('dn-root')
  const estado = { resumenCargado: 0, resumenViejo: false, ajustesCargados: false, cargandoResumen: false, cargandoAjustes: false, nombre: '' }

  async function salirSiInactivo(e) {
    if (!e?.message?.includes('NEGOCIO_INACTIVO')) return false
    const { logout } = await import('./auth.js'); logout()
    return true
  }

  function mostrarPestana(p) {
    guardarPestanaDueno(p)
    document.querySelectorAll('.dn-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pestana === p)))
    $('dn-resumen').hidden = p !== 'resumen'
    $('dn-ajustes').hidden = p !== 'ajustes'
    if (p === 'resumen' && estado.resumenViejo) cargarResumen()
    if (p === 'ajustes' && !estado.ajustesCargados) cargarAjustes()
  }

  async function cargarResumen() {
    if (estado.cargandoResumen) return
    estado.cargandoResumen = true
    // Si ya había datos, se quedan en pantalla mientras se actualizan.
    if (!estado.resumenCargado) $('dn-resumen').innerHTML = esqueletoResumen()
    try {
      const [res, mes] = await Promise.all([supabase.rpc('resumen_dueno'), supabase.rpc('resumen_meseros')])
      if (!vigente()) return
      if (res.error) throw res.error
      if (mes.error) throw mes.error
      $('dn-resumen').innerHTML = resumenHTML(res.data || {}, res.data?.clientes_registrados > 0 ? mes.data?.meseros : [])
      estado.resumenCargado = Date.now(); estado.resumenViejo = false
      $('dn-ver-inactivos')?.addEventListener('click', abrirInactivos)
      $('dn-ir-cajero')?.addEventListener('click', () => navigate('cajero'))
      $('dn-invita-ticket')?.addEventListener('click', () => {
        mostrarPestana('ajustes')
        // Cuando Ajustes termine de cargar, el campo del ticket queda a la vista.
        const enfocar = (intentos = 20) => {
          const campo = $('prog-ticket')
          if (campo) { campo.scrollIntoView({ behavior: 'smooth', block: 'center' }); campo.focus({ preventScroll: true }) }
          else if (intentos > 0 && vigente()) setTimeout(() => enfocar(intentos - 1), 150)
        }
        enfocar()
      })
    } catch (e) {
      if (!vigente() || await salirSiInactivo(e)) return
      console.error('Error al cargar el resumen:', e)
      if (!estado.resumenCargado) {
        $('dn-resumen').innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tus números.', 'dn-reintentar-resumen')
        $('dn-reintentar-resumen')?.addEventListener('click', cargarResumen)
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
        .select('id,nombre,activo,meta_puntos,color_principal,emoji_negocio,descripcion,premio,max_codigos_activos,ticket_promedio,costo_premio')
        .eq('id', negocioId).single()
      if (!vigente()) return
      if (error) throw error
      if (nd?.activo === false) { const { logout } = await import('./auth.js'); logout(); return }
      estado.nombre = nd.nombre || ''
      aplicarColorNegocio(nd.color_principal)
      $('dn-ajustes').innerHTML = ajustesHTML(nd, negocioId)
      estado.ajustesCargados = true
      // Si cambia el ticket o el costo, el resumen se recalcula al volver a él.
      initProgramaDueno(() => { estado.resumenViejo = true })
      initPersonalDueno(negocioId)
      initAjustesExtra(negocioId, estado.nombre)
    } catch (e) {
      if (!vigente()) return
      console.error('Error al cargar los ajustes:', e)
      $('dn-ajustes').innerHTML = errorPanelHTML(sinInternet(e) ? 'Sin conexión. Revisa tu internet.' : 'No pudimos cargar tus ajustes.', 'dn-reintentar-ajustes')
      $('dn-reintentar-ajustes')?.addEventListener('click', cargarAjustes)
    } finally {
      estado.cargandoAjustes = false
    }
  }

  document.querySelectorAll('.dn-tab').forEach(b => b.addEventListener('click', () => mostrarPestana(b.dataset.pestana)))

  // Al volver a la app después de un rato, los números se actualizan solos.
  const alVolver = () => {
    if (!vigente()) { document.removeEventListener('visibilitychange', alVolver); return }
    if (document.visibilityState !== 'visible') return
    if (!$('dn-resumen').hidden && Date.now() - estado.resumenCargado > 60 * 1000) cargarResumen()
  }
  document.addEventListener('visibilitychange', alVolver)

  // El color del negocio se aplica desde el principio (lo trae Ajustes).
  cargarResumen()
  cargarAjustes()
}
