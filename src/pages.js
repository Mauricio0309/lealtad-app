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
    .sc-search-btn { padding: 13px 16px; background: var(--negocio-color, ${DS.green800}); color: ${DS.white}; border: none; border-radius: 10px; cursor: pointer; font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600; white-space: nowrap; }

    .s-chart-wrap { position: relative; height: 180px; margin-top: 8px; }
    .s-chart-wrap.donut { height: 200px; }



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
// ESTILOS DEL DUEÑO (login, bienvenida, panel, ajustes, términos)
// Herramienta de negocio sobria: fondo claro, texto gris oscuro, tarjetas
// planas con borde fino y UN acento (el color del negocio) solo en botones
// principales y en la pestaña elegida. Sin emojis ni animaciones de fiesta.
// Todo va dentro de .ow para no cambiar las pantallas del mesero ni del cliente.
// ═══════════════════════════════════════════════════════════
function inyectarEstilosDueno() {
  inyectarEstilos()
  if (document.getElementById('sello-styles-dueno')) return
  const s = document.createElement('style')
  s.id = 'sello-styles-dueno'
  s.textContent = `
    .ow, .ow-hoja-fondo {
      --ow-fondo: #f6f7f9; --ow-superficie: #ffffff; --ow-borde: #e4e7ec;
      --ow-texto: #1d2129; --ow-texto-2: #5f6673; --ow-texto-3: #8a919c;
      --ow-acento: var(--negocio-color, #1d2129); --ow-ok: #1a7f4b; --ow-mal: #b42318;
      color: var(--ow-texto); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      font-size: 15px; line-height: 1.45; -webkit-font-smoothing: antialiased;
    }
    .ow { min-height: 100vh; background: var(--ow-fondo); }
    .ow *:focus-visible { outline: 2px solid var(--ow-acento); outline-offset: 2px; }

    .ow-cab { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: calc(14px + env(safe-area-inset-top)) 16px 14px; background: var(--ow-superficie); border-bottom: 1px solid var(--ow-borde); }
    .ow-marca { font-size: 15px; font-weight: 700; letter-spacing: -0.01em; color: var(--ow-texto); }
    .ow-cab-negocio { font-size: 14px; color: var(--ow-texto-2); max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .ow-cuerpo { max-width: 640px; margin: 0 auto; padding: 8px 16px calc(88px + env(safe-area-inset-bottom)); }

    .ow-tabs { display: flex; gap: 24px; border-bottom: 1px solid var(--ow-borde); margin-bottom: 16px; }
    .ow-tab { position: relative; min-height: 44px; padding: 10px 0; background: none; border: none; font: inherit; font-size: 15px; font-weight: 600; color: var(--ow-texto-3); cursor: pointer; }
    .ow-tab[aria-selected="true"] { color: var(--ow-texto); }
    .ow-tab[aria-selected="true"]::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px; background: var(--ow-acento); }
    .ow [role="tabpanel"][hidden] { display: none; }

    .ow-tarjeta { background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; padding: 16px; margin-bottom: 12px; }
    .ow-titulo-sec { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .ow-h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; }
    .ow-h2 { font-size: 18px; font-weight: 600; line-height: 1.3; }
    .ow-sub { font-size: 14px; color: var(--ow-texto-2); margin-top: 4px; }
    .ow-nota { color: var(--ow-texto-3); font-weight: 400; }
    .ow-ayuda { font-size: 13px; color: var(--ow-texto-2); margin-top: 6px; }

    .ow-principal-lbl { font-size: 14px; color: var(--ow-texto-2); }
    .ow-principal-num { font-size: 40px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.1; font-variant-numeric: tabular-nums; margin: 2px 0; }
    .ow-principal-sub { font-size: 16px; }

    .ow-cifras { display: grid; grid-template-columns: repeat(3, 1fr); background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; margin-bottom: 12px; }
    .ow-cifras.dos { grid-template-columns: repeat(2, 1fr); }
    .ow-cifra { min-width: 0; padding: 14px 12px; border-left: 1px solid var(--ow-borde); }
    .ow-cifra:first-child { border-left: none; }
    .ow-cifra-num { font-size: 26px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.15; font-variant-numeric: tabular-nums; }
    .ow-cifra-de { font-size: 13px; font-weight: 500; color: var(--ow-texto-3); letter-spacing: 0; }
    .ow-cifra-lbl { font-size: 12px; line-height: 1.3; color: var(--ow-texto-2); margin-top: 4px; }
    .ow-cambio { font-size: 12px; margin-top: 4px; color: var(--ow-texto-3); font-variant-numeric: tabular-nums; }
    .ow-cambio.sube { color: var(--ow-ok); }
    .ow-cambio.baja { color: var(--ow-mal); }

    .ow-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; margin-bottom: 12px; padding: 14px 16px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; font: inherit; color: inherit; text-align: left; cursor: pointer; }
    .ow-fila:disabled { cursor: default; }
    .ow-fila:not(:disabled):hover { border-color: #cfd4dc; }
    .ow-fila-titulo { display: block; font-weight: 600; }
    .ow-fila-sub { display: block; font-size: 13px; color: var(--ow-texto-2); }
    .ow-fila-der { display: flex; align-items: baseline; gap: 10px; flex-shrink: 0; }
    .ow-fila-num { font-size: 26px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .ow-fila-ver { font-size: 14px; font-weight: 500; color: var(--ow-texto-2); }

    .ow-tabla-wrap { overflow-x: auto; }
    .ow-tabla { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
    .ow-tabla th { padding: 0 0 8px 12px; border-bottom: 1px solid var(--ow-borde); font-size: 12px; font-weight: 600; color: var(--ow-texto-2); text-align: right; white-space: nowrap; }
    .ow-tabla td { padding: 10px 0 10px 12px; border-bottom: 1px solid var(--ow-borde); text-align: right; vertical-align: top; }
    .ow-tabla th:first-child, .ow-tabla td:first-child { padding-left: 0; text-align: left; }
    .ow-tabla tbody tr:last-child td { border-bottom: none; padding-bottom: 0; }
    .ow-persona { font-weight: 600; }
    .ow-revisar { display: block; margin-top: 2px; font-size: 12px; font-weight: 500; color: var(--ow-mal); }

    .ow-vacio { font-size: 14px; color: var(--ow-texto-2); }
    .ow-pasos { list-style: none; display: flex; flex-direction: column; gap: 14px; margin: 16px 0; }
    .ow-pasos li { display: flex; gap: 12px; }
    .ow-paso-num { flex-shrink: 0; width: 24px; height: 24px; border: 1px solid var(--ow-borde); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: var(--ow-texto-2); }
    .ow-paso-titulo { font-weight: 600; }
    .ow-paso-desc { display: block; font-size: 14px; color: var(--ow-texto-2); }

    .ow-btn { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 10px 16px; border: 1px solid transparent; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; }
    .ow-btn.primario { background: var(--ow-acento); color: #ffffff; }
    .ow-btn.secundario { background: var(--ow-superficie); color: var(--ow-texto); border-color: var(--ow-borde); }
    .ow-btn.secundario:hover { background: #f9fafb; }
    .ow-btn:disabled { opacity: 0.55; cursor: not-allowed; }
    .ow-btn.chico { width: auto; min-height: 36px; padding: 6px 12px; font-size: 14px; }
    .ow-btn + .ow-btn { margin-top: 8px; }
    .ow-botones { display: flex; gap: 8px; }
    .ow-botones .ow-btn + .ow-btn { margin-top: 0; }
    .ow-enlace { display: inline-block; min-height: 40px; padding: 8px 0; background: none; border: none; font: inherit; font-size: 14px; color: var(--ow-texto-2); text-decoration: underline; text-underline-offset: 3px; cursor: pointer; text-align: left; }

    .ow-campo { margin-bottom: 16px; }
    .ow-label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px; }
    .ow-input { width: 100%; height: 44px; padding: 0 12px; border: 1px solid var(--ow-borde); border-radius: 10px; background: #ffffff; font: inherit; font-size: 16px; color: var(--ow-texto); outline: none; }
    .ow-input:focus { border-color: #9aa1ac; box-shadow: 0 0 0 3px rgba(29,33,41,0.08); }
    .ow-input::placeholder { color: #b3b9c2; }
    .ow-pesos { position: relative; }
    .ow-pesos span { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--ow-texto-3); }
    .ow-pesos .ow-input { padding-left: 26px; }
    .ow-clave { position: relative; }
    .ow-clave .ow-input { padding-right: 84px; }
    .ow-clave button { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); min-height: 32px; padding: 4px 10px; background: none; border: none; font: inherit; font-size: 13px; font-weight: 500; color: var(--ow-texto-2); cursor: pointer; }
    .ow-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .ow-chip { min-height: 32px; padding: 4px 10px; border: 1px solid var(--ow-borde); border-radius: 8px; background: #ffffff; font: inherit; font-size: 13px; color: var(--ow-texto-2); cursor: pointer; }
    .ow-chip:hover { border-color: #cfd4dc; }
    .ow-agregar { display: flex; gap: 8px; }
    .ow-agregar .ow-input { flex: 1; min-width: 0; }
    .ow-agregar .ow-btn { width: auto; }
    .ow-lista-fila { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--ow-borde); }
    .ow-lista-fila:last-child { border-bottom: none; }
    .ow-url { padding: 10px 12px; border: 1px solid var(--ow-borde); border-radius: 10px; background: var(--ow-fondo); font-size: 13px; color: var(--ow-texto-2); word-break: break-all; margin-bottom: 12px; }

    .ow-msg-ok { margin-top: 10px; font-size: 14px; color: var(--ow-ok); }
    .ow-msg-error { margin-top: 10px; font-size: 14px; color: var(--ow-mal); }
    .ow .s-error { margin-top: 10px; font-size: 14px; color: var(--ow-mal); }
    .ow .s-success { display: block; margin-top: 10px; padding: 0; background: none; font-size: 14px; font-weight: 500; color: var(--ow-ok); }

    .ow-colores { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
    .ow-color { width: 36px; height: 36px; padding: 0; border: 2px solid #ffffff; border-radius: 50%; box-shadow: 0 0 0 1px var(--ow-borde); cursor: pointer; }
    .ow-color[aria-checked="true"] { box-shadow: 0 0 0 2px var(--ow-texto); }
    .ow-vista { padding: 16px; border: 1px solid var(--ow-borde); border-radius: 12px; background: #f5f6f8; margin-bottom: 16px; }
    .ow-vista-marca { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
    .ow-vista-punto { width: 20px; height: 20px; border-radius: 50%; background: var(--vista-color); flex-shrink: 0; }
    .ow-vista-saludo { font-size: 18px; font-weight: 700; margin-top: 12px; }
    .ow-vista-tarjeta { margin-top: 10px; padding: 16px; border-radius: 12px; background: #ffffff; text-align: center; }
    .ow-vista-num { font-size: 34px; font-weight: 800; color: var(--vista-color); font-variant-numeric: tabular-nums; }
    .ow-vista-meta { font-size: 18px; font-weight: 700; color: #cbd5e1; }
    .ow-vista-sellos { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; justify-items: center; margin-top: 12px; }
    .ow-vista-sello { width: 100%; max-width: 30px; aspect-ratio: 1; border: 1.5px dashed #cbd5e1; border-radius: 50%; }
    .ow-vista-sello.lleno { border: none; background: var(--vista-color); }
    .ow-vista-premio { margin-top: 10px; padding: 12px 16px; border-radius: 12px; background: #ffffff; font-size: 14px; font-weight: 600; }
    .ow-vista-premio span { display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: var(--ow-texto-3); }

    .ow-nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; background: var(--ow-superficie); border-top: 1px solid var(--ow-borde); padding-bottom: env(safe-area-inset-bottom); }
    .ow-nav button { flex: 1; min-height: 52px; background: none; border: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--ow-texto-3); cursor: pointer; }
    .ow-nav button[aria-current="page"] { color: var(--ow-texto); }

    .ow-hoja-fondo { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: flex-end; justify-content: center; background: rgba(15,18,24,0.4); }
    .ow-hoja { width: 100%; max-width: 560px; max-height: 80vh; overflow-y: auto; padding: 16px 16px calc(24px + env(safe-area-inset-bottom)); background: #ffffff; border-radius: 12px 12px 0 0; }
    .ow-hoja-cab { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
    @media (min-width: 600px) { .ow-hoja-fondo { align-items: center; } .ow-hoja { border-radius: 12px; } }

    .ow-esq { background: #eceef2; border-radius: 12px; animation: owPulso 1.6s ease-in-out infinite; }
    @keyframes owPulso { 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) { .ow-esq { animation: none; } }

    .ow-centro { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px 16px; }
    .ow-caja { width: 100%; max-width: 380px; padding: 28px 24px; background: var(--ow-superficie); border: 1px solid var(--ow-borde); border-radius: 12px; }
    .ow-caja .ow-marca { margin-bottom: 20px; }
    .ow-legal { max-width: 380px; margin-top: 16px; font-size: 13px; color: var(--ow-texto-3); text-align: center; }
    .ow-legal a { color: var(--ow-texto-2); text-underline-offset: 3px; }
    .ow-paso-de { font-size: 13px; color: var(--ow-texto-3); margin-bottom: 8px; }
    .ow-texto-legal h2 { font-size: 15px; font-weight: 600; margin: 20px 0 6px; }
    .ow-texto-legal p { font-size: 14px; color: var(--ow-texto-2); }
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

// Contraseña con botón de texto "Mostrar / Ocultar" (login).
function pwField(id, placeholder = '••••••') {
  return `<div class="ow-clave"><input type="password" id="${id}" placeholder="${placeholder}" class="ow-input" autocomplete="current-password" /><button type="button" aria-label="Mostrar contraseña" onclick="var i=document.getElementById('${id}');var v=i.type==='password';i.type=v?'text':'password';this.textContent=v?'Ocultar':'Mostrar';this.setAttribute('aria-label',v?'Ocultar contraseña':'Mostrar contraseña')">Mostrar</button></div>`
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

// Barra inferior del dueño: solo texto, sin íconos. Va dentro de .ow.
function navBarDueno(active = 'panel') {
  return `
    <nav class="ow-nav" aria-label="Secciones">
      <button id="snav-panel"${active === 'panel' ? ' aria-current="page"' : ''}>Mi panel</button>
      <button id="snav-cajero-d">Cajero</button>
      <button id="snav-salir">Salir</button>
    </nav>
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
}

function onboardingVisto() { return localStorage.getItem('sello_onboarding') === 'done' }
function marcarOnboardingVisto() { localStorage.setItem('sello_onboarding', 'done') }

// Bienvenida del dueño en 3 pasos. También se muestran en el panel mientras
// el negocio no tiene clientes.
const PASOS_ONBOARDING = [
  { titulo: 'Elige tu premio y tu meta', desc: 'Por ejemplo: un café gratis a las 10 visitas. Lo cambias cuando quieras en Mi panel → Ajustes.' },
  { titulo: 'Da de alta a tus meseros', desc: 'Cada mesero entra a Sello desde su celular con su propia cuenta. Agrega sus números en Ajustes → Personal para que no ganen puntos.' },
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
    <div class="ow">
      <div class="ow-centro">
        <div class="ow-caja">
          <div class="ow-marca">Sello</div>
          <h1 class="ow-h1">Entra a tu cuenta</h1>
          <p class="ow-sub" style="margin-bottom:20px">Para dueños y meseros.</p>
          <div class="ow-campo"><label class="ow-label" for="email">Correo</label><input type="email" id="email" class="ow-input" placeholder="tu@correo.com" autocomplete="email" /></div>
          <div class="ow-campo"><label class="ow-label" for="password">Contraseña</label>${pwField('password')}</div>
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
  inyectarEstilosDueno()
  const i = Math.min(Math.max(0, Number(paso) || 0), PASOS_ONBOARDING.length - 1)
  const p = PASOS_ONBOARDING[i]; const esUltimo = i === PASOS_ONBOARDING.length - 1
  return `
    <div class="ow">
      <div class="ow-centro">
        <div class="ow-caja">
          <div class="ow-marca">Sello</div>
          <div class="ow-paso-de">Paso ${i + 1} de ${PASOS_ONBOARDING.length}</div>
          <h1 class="ow-h1">${p.titulo}</h1>
          <p class="ow-sub" style="margin-bottom:24px">${p.desc}</p>
          <button class="ow-btn primario" id="onb-siguiente">${esUltimo ? 'Empezar' : 'Siguiente'}</button>
          ${!esUltimo ? `<button class="ow-btn secundario" id="onb-skip">Saltar</button>` : ''}
        </div>
      </div>
    </div>
  `
}

export function initOnboarding(paso = 0) {
  inyectarEstilosDueno()
  const esUltimo = paso >= PASOS_ONBOARDING.length - 1
  document.getElementById('onb-siguiente')?.addEventListener('click', () => { if (esUltimo) { marcarOnboardingVisto(); navigate('bienvenida') } else navigate('onboarding', paso + 1) })
  document.getElementById('onb-skip')?.addEventListener('click', () => { marcarOnboardingVisto(); navigate('bienvenida') })
}

export async function paginaBienvenida() {
  inyectarEstilosDueno()
  try {
    const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
    return `
      <div class="ow">
        <div class="ow-centro">
          <div class="ow-caja">
            <div class="ow-marca">Sello</div>
            <h1 class="ow-h1">${esc(negocio.nombre)}</h1>
            <p class="ow-sub" style="margin-bottom:24px">¿Qué quieres hacer?</p>
            <button class="ow-btn primario" id="sbv-cajero">Cobrar en caja</button>
            <button class="ow-btn secundario" id="sbv-panel">Ver mi panel</button>
            <button class="ow-enlace" id="sbv-salir" style="margin-top:12px">Cerrar sesión</button>
          </div>
        </div>
      </div>
    `
  } catch (e) { return `<div class="ow"><div class="ow-centro"><div class="ow-caja">${errMsg()}</div></div></div>` }
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


// ── TÉRMINOS Y AVISO DE PRIVACIDAD (dueños) ─────────────────
// Página corta para el negocio. El aviso del cliente es otro y no cambia.
export function paginaTerminos() {
  inyectarEstilosDueno()
  return `
    <div class="ow">
      <header class="ow-cab">
        <span class="ow-marca">Sello</span>
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
          <p>Avísale a Sello y lo hacemos por ti.</p>

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
// Pestaña "Ajustes": programa, tarjeta de los clientes, personal, exportar
// y página pública.
// Estilos: inyectarEstilosDueno (todo dentro de .ow).
// ═══════════════════════════════════════════════════════════
const PLANTILLAS_PREMIO = [
  'Un café gratis', 'Un postre gratis', 'Un corte gratis', 'Un taco gratis',
  '20% de descuento en tu cuenta', '10% de descuento', '2x1',
]

// Límites del ticket promedio y del costo del premio (los mismos que revisa el servidor).
const TICKET_MAX = 100000
const COSTO_MAX = 100000

// Paleta corta y sobria para la tarjeta del cliente. Todos tienen buen
// contraste con texto blanco (botones de la tarjeta).
const COLORES_TARJETA = [
  { nombre: 'Grafito', valor: '#1f2937' },
  { nombre: 'Verde', valor: '#0a5c47' },
  { nombre: 'Verde azulado', valor: '#0f766e' },
  { nombre: 'Azul', valor: '#1d4ed8' },
  { nombre: 'Índigo', valor: '#4338ca' },
  { nombre: 'Vino', valor: '#9f1239' },
  { nombre: 'Terracota', valor: '#9a3412' },
  { nombre: 'Café', valor: '#78350f' },
]
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
const bloqueEsq = alto => `<div class="ow-esq" style="height:${alto}px;margin-bottom:12px"></div>`
const esqueletoResumen = () => [124, 88, 60, 88, 150].map(bloqueEsq).join('')
const esqueletoAjustes = () => [360, 300, 160].map(bloqueEsq).join('')

// Tarjeta de error con "Reintentar" (nunca pantalla en blanco).
function errorPanelHTML(texto, idBoton) {
  return `<div class="ow-tarjeta">
    <p style="margin-bottom:12px">${texto}</p>
    <button class="ow-btn secundario" id="${idBoton}">Reintentar</button>
  </div>`
}

// ── Resumen ──
function cambioSemanaHTML(actual, anterior) {
  const dif = (Number(actual) || 0) - (Number(anterior) || 0)
  if (!actual && !anterior) return ''
  if (dif > 0) return `<div class="ow-cambio sube">▲ ${formatoNumero(dif)} vs. la anterior</div>`
  if (dif < 0) return `<div class="ow-cambio baja">▼ ${formatoNumero(-dif)} vs. la anterior</div>`
  return `<div class="ow-cambio">Igual que la anterior</div>`
}

function principalHTML(r) {
  const n = Number(r.visitas_repetidas_semana) || 0
  if (r.negocio?.ticket_promedio != null) {
    return `<section class="ow-tarjeta">
      <div class="ow-principal-lbl">Esta semana tus clientes volvieron</div>
      <div class="ow-principal-num">${n === 1 ? '1 vez' : `${formatoNumero(n)} veces`}</div>
      <div class="ow-principal-sub">≈ ${formatoPesos(r.ventas_estimadas)} en ventas <span class="ow-nota">(estimado)</span></div>
    </section>`
  }
  return `<section class="ow-tarjeta">
    <div class="ow-principal-num">${formatoNumero(n)}</div>
    <div class="ow-principal-lbl">${n === 1 ? 'visita de un cliente que regresó' : 'visitas de clientes que regresaron'} esta semana</div>
    <button type="button" class="ow-enlace" id="dn-invita-ticket">Agrega cuánto gasta un cliente para ver tus ventas estimadas</button>
  </section>`
}

// Negocio nuevo: en vez de ceros, qué hacer para empezar.
function vacioResumenHTML() {
  return `<section class="ow-tarjeta">
    <h2 class="ow-h2">Aquí verás si Sello te trae clientes de vuelta</h2>
    <p class="ow-sub">Aún no tienes clientes. Empieza así:</p>
    <ol class="ow-pasos">
      ${PASOS_ONBOARDING.map((p, i) => `<li><span class="ow-paso-num">${i + 1}</span><span><span class="ow-paso-titulo">${p.titulo}</span><span class="ow-paso-desc">${p.desc}</span></span></li>`).join('')}
    </ol>
    <button class="ow-btn primario" id="dn-ir-cajero">Ir al cajero</button>
  </section>`
}

function meserosHTML(meseros) {
  const lista = meseros || []
  if (lista.length === 0) {
    return `<section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Tu equipo esta semana</h2>
      <p class="ow-vacio">Cuando tu equipo cobre con "Cobré una cuenta", aquí verás a cada mesero.</p>
    </section>`
  }
  const filas = lista.map(m => `<tr>
      <td><span class="ow-persona">${esc(m.nombre)}</span>${m.rol === 'owner' ? ' <span class="ow-nota">(tú)</span>' : ''}
        ${m.revisar ? `<span class="ow-revisar">Revisar${m.motivo ? `: ${esc(m.motivo)}` : ''}</span>` : ''}</td>
      <td>${formatoNumero(m.generados)}</td>
      <td>${formatoNumero(m.reclamados)}</td>
      <td>${formatoNumero(m.manuales)}</td>
      <td>${formatoNumero(m.bloqueos_canje)}</td>
    </tr>`).join('')
  return `<section class="ow-tarjeta">
    <h2 class="ow-titulo-sec">Tu equipo esta semana</h2>
    <div class="ow-tabla-wrap">
      <table class="ow-tabla">
        <thead><tr>
          <th scope="col">Persona</th><th scope="col">Códigos</th><th scope="col">Usados</th>
          <th scope="col">A mano</th><th scope="col">Bloqueos</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>
    <p class="ow-ayuda" style="margin-top:12px">Bloqueos: veces que escribió mal el código de canje (total, no solo esta semana).</p>
  </section>`
}

function resumenHTML(r, meseros) {
  if (!(Number(r.clientes_registrados) > 0)) return vacioResumenHTML()
  const deCada10 = Math.round((Number(r.porcentaje_regresan) || 0) / 10)
  const entregados = Number(r.premios_entregados_semana) || 0
  const inactivos = Number(r.inactivos) || 0
  return `
    ${principalHTML(r)}
    <div class="ow-cifras">
      <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(r.clientes_registrados)}</div><div class="ow-cifra-lbl">Clientes registrados</div></div>
      <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(r.visitas_semana)}</div><div class="ow-cifra-lbl">Visitas esta semana</div>${cambioSemanaHTML(r.visitas_semana, r.visitas_semana_anterior)}</div>
      <div class="ow-cifra"><div class="ow-cifra-num">${deCada10}<span class="ow-cifra-de"> de cada 10</span></div><div class="ow-cifra-lbl">Regresaron</div></div>
    </div>
    <button type="button" class="ow-fila" id="dn-ver-inactivos"${inactivos > 0 ? '' : ' disabled'}>
      <span><span class="ow-fila-titulo">Dejaron de venir</span><span class="ow-fila-sub">Más de 21 días sin venir</span></span>
      <span class="ow-fila-der"><span class="ow-fila-num">${formatoNumero(inactivos)}</span>${inactivos > 0 ? '<span class="ow-fila-ver">Ver</span>' : ''}</span>
    </button>
    <div class="ow-cifras dos">
      <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(entregados)}</div><div class="ow-cifra-lbl">Premios entregados esta semana</div>${r.costo_premios_semana != null && entregados > 0 ? `<div class="ow-cambio">≈ ${formatoPesos(r.costo_premios_semana)} de costo</div>` : ''}</div>
      <div class="ow-cifra"><div class="ow-cifra-num">${formatoNumero(r.premios_listos)}</div><div class="ow-cifra-lbl">Listos para canjear</div></div>
    </div>
    ${meserosHTML(meseros)}`
}

// Hoja con la lista de quienes dejaron de venir (primer nombre y ···4821).
async function abrirInactivos() {
  inyectarEstilosDueno()
  const hoja = document.createElement('div')
  hoja.className = 'ow-hoja-fondo'
  hoja.innerHTML = `<div class="ow-hoja" role="dialog" aria-modal="true" aria-labelledby="dn-hoja-titulo">
    <div class="ow-hoja-cab">
      <div><h2 class="ow-h2" id="dn-hoja-titulo">Dejaron de venir</h2><p class="ow-sub">Más de 21 días sin venir. Los más recientes primero.</p></div>
      <button class="ow-btn secundario chico" id="dn-hoja-cerrar">Cerrar</button>
    </div>
    <div id="dn-hoja-lista">${[52, 52, 52, 52].map(bloqueEsq).join('')}</div>
  </div>`
  document.body.appendChild(hoja)
  const cerrar = () => { hoja.remove(); document.removeEventListener('keydown', alTeclear) }
  const alTeclear = e => { if (e.key === 'Escape') cerrar() }
  document.addEventListener('keydown', alTeclear)
  hoja.querySelector('#dn-hoja-cerrar').addEventListener('click', cerrar)
  hoja.addEventListener('click', e => { if (e.target === hoja) cerrar() })
  const lista = hoja.querySelector('#dn-hoja-lista')
  try {
    const { data, error } = await supabase.rpc('clientes_inactivos')
    if (error) throw error
    if (!hoja.isConnected) return
    const clientes = data?.clientes || []
    lista.innerHTML = clientes.length === 0
      ? `<p class="ow-vacio">Nadie. Todos tus clientes vinieron en las últimas 3 semanas.</p>`
      : clientes.map(c => `<div class="ow-lista-fila">
          <div><div><span class="ow-persona">${esc(c.nombre)}</span> <span class="ow-nota" style="font-variant-numeric:tabular-nums">···${esc(c.ultimos4)}</span></div>
          <div class="ow-ayuda" style="margin-top:2px">Última visita hace ${formatoNumero(c.dias)} días</div></div>
          <div class="ow-nota" style="white-space:nowrap">${formatoNumero(c.visitas)} ${c.visitas === 1 ? 'visita' : 'visitas'}</div>
        </div>`).join('')
  } catch (e) {
    console.error('Error al cargar los clientes inactivos:', e)
    if (hoja.isConnected) lista.innerHTML = `<p class="ow-vacio">${mensajeDueno(e)}</p>`
  }
}

// ── Ajustes ──
// Vista previa de la tarjeta del cliente (mismo acomodo que su pantalla).
function vistaTarjetaHTML(nd) {
  const meta = Math.max(1, Number(nd.meta_puntos) || 10)
  const puntos = Math.min(meta - 1, Math.max(1, Math.round(meta * 0.4)))
  const sellos = meta <= 10
    ? `<div class="ow-vista-sellos">${Array.from({ length: meta }, (_, i) => `<span class="ow-vista-sello${i < puntos ? ' lleno' : ''}"></span>`).join('')}</div>`
    : ''
  return `
    <div class="ow-vista-marca"><span class="ow-vista-punto"></span>${esc(nd.nombre || 'Tu negocio')}</div>
    <div class="ow-vista-saludo">Buenas tardes, Ana</div>
    <div class="ow-vista-tarjeta">
      <div><span class="ow-vista-num">${puntos}</span><span class="ow-vista-meta"> / ${meta}</span></div>
      ${sellos}
    </div>
    <div class="ow-vista-premio"><span>TU PREMIO</span>${esc(nd.premio || 'Tu premio')}</div>`
}

function ajustesHTML(nd, negocioId) {
  const landingUrl = `${window.location.origin}/#/landing/${negocioId}`
  const pesos = v => v == null ? '' : String(Number(v))
  const actual = esColorHex(nd.color_principal) ? nd.color_principal.toLowerCase() : COLORES_TARJETA[1].valor
  // Si el color guardado no está en la paleta, se ofrece como "Tu color actual".
  const colores = COLORES_TARJETA.some(c => c.valor === actual)
    ? COLORES_TARJETA
    : [{ nombre: 'Tu color actual', valor: actual }, ...COLORES_TARJETA]
  return `
    <section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Programa</h2>
      <div class="ow-campo">
        <label class="ow-label" for="prog-meta">Visitas para ganar el premio</label>
        <input type="number" inputmode="numeric" id="prog-meta" class="ow-input" min="1" max="100" value="${nd.meta_puntos ?? 10}" />
      </div>
      <div class="ow-campo">
        <label class="ow-label" for="prog-premio">Premio</label>
        <input type="text" id="prog-premio" class="ow-input" maxlength="80" value="${esc(nd.premio || '')}" placeholder="Ej: Un café gratis" />
        <div class="ow-chips">${PLANTILLAS_PREMIO.map(p => `<button type="button" class="ow-chip" data-premio="${esc(p)}">${esc(p)}</button>`).join('')}</div>
      </div>
      <div class="ow-campo">
        <label class="ow-label" for="prog-ticket">¿Cuánto gasta en promedio un cliente? <span class="ow-nota">(opcional)</span></label>
        <div class="ow-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-ticket" class="ow-input" value="${pesos(nd.ticket_promedio)}" placeholder="Ej: 120" autocomplete="off" /></div>
        <p class="ow-ayuda">Con esto calculamos cuánto te dejan los clientes que regresan.</p>
      </div>
      <div class="ow-campo">
        <label class="ow-label" for="prog-costo">¿Cuánto te cuesta el premio? <span class="ow-nota">(opcional)</span></label>
        <div class="ow-pesos"><span>$</span><input type="text" inputmode="decimal" id="prog-costo" class="ow-input" value="${pesos(nd.costo_premio)}" placeholder="Ej: 25" autocomplete="off" /></div>
      </div>
      <div class="ow-campo">
        <label class="ow-label" for="prog-max">Códigos activos por mesero</label>
        <input type="number" inputmode="numeric" id="prog-max" class="ow-input" min="1" max="50" value="${nd.max_codigos_activos ?? 3}" />
        <p class="ow-ayuda">Cuántos QR puede tener abiertos un mesero a la vez. Súbelo si hay mucha gente.</p>
      </div>
      <button id="btn-guardar-programa" class="ow-btn primario">Guardar programa</button>
      <div id="msg-programa"></div>
    </section>

    <section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Tarjeta de tus clientes</h2>
      <div class="ow-label" id="lbl-color-tarjeta">Color</div>
      <div class="ow-colores" role="radiogroup" aria-labelledby="lbl-color-tarjeta">
        ${colores.map(c => `<button type="button" class="ow-color" role="radio" aria-checked="${c.valor === actual}" aria-label="${esc(c.nombre)}" title="${esc(c.nombre)}" data-color="${c.valor}" style="background:${c.valor}"></button>`).join('')}
      </div>
      <div class="ow-label">Vista previa</div>
      <div class="ow-vista" id="vista-tarjeta" style="--vista-color:${actual}">${vistaTarjetaHTML(nd)}</div>
      <button id="btn-guardar-tarjeta" class="ow-btn primario">Guardar</button>
      <div id="msg-tarjeta"></div>
    </section>

    <section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Personal (no ganan puntos)</h2>
      <p class="ow-ayuda" style="margin:-6px 0 12px">Agrega el número de cada persona de tu equipo. Esos números no suman puntos.</p>
      <div class="ow-agregar">
        <input type="tel" inputmode="numeric" id="excl-tel" class="ow-input" placeholder="10 dígitos" autocomplete="off" aria-label="Número de 10 dígitos" />
        <button id="btn-agregar-excl" class="ow-btn secundario">Agregar</button>
      </div>
      <div id="msg-excl"></div>
      <div id="lista-excl" style="margin-top:8px"><p class="ow-vacio">Cargando...</p></div>
    </section>

    <section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Exportar datos</h2>
      <p class="ow-ayuda" style="margin:-6px 0 12px">Descarga la lista de tus clientes para abrirla en Excel.</p>
      <button id="btn-exportar-csv" class="ow-btn secundario">Descargar clientes (.csv)</button>
      <div id="msg-exportar"></div>
    </section>

    <section class="ow-tarjeta">
      <h2 class="ow-titulo-sec">Tu página pública</h2>
      <p class="ow-ayuda" style="margin:-6px 0 12px">Compártela en Instagram o WhatsApp.</p>
      <div class="ow-url">${esc(landingUrl)}</div>
      <div class="ow-botones">
        <button id="btn-copiar-landing" class="ow-btn secundario">Copiar link</button>
        <button id="btn-ver-landing" class="ow-btn secundario">Ver página</button>
      </div>
      <div id="msg-landing"></div>
    </section>`
}

// Sección "Programa": se guarda con la RPC guardar_programa (2G, ampliada en Fase 4).
function initProgramaDueno(alGuardar) {
  const $ = id => document.getElementById(id)
  const btn = $('btn-guardar-programa'); const msg = $('msg-programa')
  if (!btn) return
  document.querySelectorAll('.ow-chip[data-premio]').forEach(chip => {
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
    if (error) { msg.innerHTML = avisoError(mensajeDueno({ message: error })); return }
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { error: e } = await supabase.rpc('guardar_programa', {
        p_meta_puntos: meta, p_premio: premio, p_max_codigos_activos: max,
        p_ticket_promedio: ticket, p_costo_premio: costo,
      })
      if (e) throw e
      msg.innerHTML = avisoOk('Programa guardado')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
      alGuardar?.({ meta, premio })
    } catch (e) {
      console.error('Error al guardar el programa:', e)
      msg.innerHTML = avisoError(mensajeDueno(e))
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar programa'
    }
  })
}

// Sección "Tarjeta de tus clientes": por ahora solo el color (el logo y el
// mensaje de agradecimiento necesitan supabase/fase-4b-tarjeta.sql).
// El ícono del sello y la animación no se eligen: quedan los de siempre.
function initTarjetaDueno(negocioId) {
  const $ = id => document.getElementById(id)
  const btn = $('btn-guardar-tarjeta'); const msg = $('msg-tarjeta'); const vista = $('vista-tarjeta')
  if (!btn) return
  const opciones = [...document.querySelectorAll('.ow-color')]
  let elegido = opciones.find(o => o.getAttribute('aria-checked') === 'true')?.dataset.color || COLORES_TARJETA[1].valor

  function elegir(boton, enfocar = false) {
    opciones.forEach(o => { o.setAttribute('aria-checked', String(o === boton)); o.tabIndex = o === boton ? 0 : -1 })
    elegido = boton.dataset.color
    vista.style.setProperty('--vista-color', elegido)
    msg.innerHTML = ''
    if (enfocar) boton.focus()
  }
  opciones.forEach(o => { o.tabIndex = o.getAttribute('aria-checked') === 'true' ? 0 : -1 })
  opciones.forEach((o, i) => {
    o.addEventListener('click', () => elegir(o))
    // Flechas para moverse entre colores (grupo de opciones accesible).
    o.addEventListener('keydown', e => {
      const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (!paso) return
      e.preventDefault()
      elegir(opciones[(i + paso + opciones.length) % opciones.length], true)
    })
  })

  btn.addEventListener('click', async () => {
    if (!esColorHex(elegido)) return
    btn.disabled = true; btn.textContent = 'Guardando...'; msg.innerHTML = ''
    try {
      const { error } = await supabase.from('negocios').update({ color_principal: elegido }).eq('id', negocioId)
      if (error) throw error
      aplicarColorNegocio(elegido)
      msg.innerHTML = avisoOk('Tarjeta guardada')
      setTimeout(() => { if (msg.isConnected) msg.innerHTML = '' }, 2500)
    } catch (e) {
      console.error('Error al guardar la tarjeta:', e)
      msg.innerHTML = avisoError(mensajeDueno(e))
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar'
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

  $('btn-exportar-csv')?.addEventListener('click', async () => {
    const btn = $('btn-exportar-csv'); const msg = $('msg-exportar')
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
  })

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

// Cada visita a #/dueno abre una "sesión"; las respuestas que llegan tarde
// de una visita anterior se ignoran.
let duenoSesion = 0

export async function paginaDueno() {
  inyectarEstilosDueno()
  const { getNegocioActual } = await import('./auth.js'); const negocio = getNegocioActual()
  if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }
  const pestana = leerPestanaDueno()
  return `
    <div class="ow" id="dn-root">
      <header class="ow-cab"><span class="ow-marca">Sello</span><span class="ow-cab-negocio">${esc(negocio.nombre || '')}</span></header>
      <main class="ow-cuerpo">
        <div class="ow-tabs" role="tablist" aria-label="Mi panel">
          <button class="ow-tab" role="tab" id="tab-resumen" aria-controls="dn-resumen" data-pestana="resumen" aria-selected="${pestana === 'resumen'}">Resumen</button>
          <button class="ow-tab" role="tab" id="tab-ajustes" aria-controls="dn-ajustes" data-pestana="ajustes" aria-selected="${pestana === 'ajustes'}">Ajustes</button>
        </div>
        <div id="dn-resumen" role="tabpanel" aria-labelledby="tab-resumen"${pestana === 'resumen' ? '' : ' hidden'}>${esqueletoResumen()}</div>
        <div id="dn-ajustes" role="tabpanel" aria-labelledby="tab-ajustes"${pestana === 'ajustes' ? '' : ' hidden'}>${esqueletoAjustes()}</div>
      </main>
      ${navBarDueno('panel')}
    </div>
  `
}

export async function initDueno(negocioId) {
  inyectarEstilosDueno(); initNavDueno()
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
    document.querySelectorAll('.ow-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.pestana === p)))
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
        .select('id,nombre,activo,meta_puntos,color_principal,premio,max_codigos_activos,ticket_promedio,costo_premio')
        .eq('id', negocioId).single()
      if (!vigente()) return
      if (error) throw error
      if (nd?.activo === false) { const { logout } = await import('./auth.js'); logout(); return }
      estado.nombre = nd.nombre || ''
      aplicarColorNegocio(nd.color_principal)
      $('dn-ajustes').innerHTML = ajustesHTML(nd, negocioId)
      estado.ajustesCargados = true
      // Si cambian ticket, costo o premio, el resumen y la vista previa se ponen al día.
      initProgramaDueno(({ meta, premio }) => {
        estado.resumenViejo = true
        const vista = $('vista-tarjeta')
        if (vista) vista.innerHTML = vistaTarjetaHTML({ ...nd, meta_puntos: meta, premio })
      })
      initTarjetaDueno(negocioId)
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

  document.querySelectorAll('.ow-tab').forEach(b => b.addEventListener('click', () => mostrarPestana(b.dataset.pestana)))

  // Al volver a la app después de un rato, los números se actualizan solos.
  const alVolver = () => {
    if (!vigente()) { document.removeEventListener('visibilitychange', alVolver); return }
    if (document.visibilityState !== 'visible') return
    if (!$('dn-resumen').hidden && Date.now() - estado.resumenCargado > 60 * 1000) cargarResumen()
  }
  document.addEventListener('visibilitychange', alVolver)

  // Ajustes se carga desde el principio: trae el color del negocio (el acento).
  cargarResumen()
  cargarAjustes()
}
