import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

const META_VISITAS = 10
const ADMIN_PASSWORD = 'lealtad2024'

// ─── ESTILOS GLOBALES INYECTADOS UNA VEZ ─────────────────
function inyectarEstilos() {
  if (document.getElementById('lealtad-styles')) return
  const style = document.createElement('style')
  style.id = 'lealtad-styles'
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');

    * { box-sizing: border-box; }

    body {
      font-family: 'Inter', sans-serif;
      background: #f0f2f7;
      margin: 0;
    }

    /* ── Vista cliente rediseñada ── */
    .lc-root {
      min-height: 100vh;
      background: linear-gradient(160deg, #0f172a 0%, #1e293b 60%, #0f4c3a 100%);
      color: white;
      font-family: 'Sora', sans-serif;
      padding-bottom: 40px;
    }
    .lc-hero {
      padding: 48px 24px 32px;
      text-align: center;
    }
    .lc-logo-ring {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399, #059669);
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 32px; margin-bottom: 16px;
      box-shadow: 0 0 0 8px rgba(52,211,153,0.15);
    }
    .lc-negocio { font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; }
    .lc-saludo { font-size: 26px; font-weight: 800; color: white; margin: 0; }

    .lc-card {
      margin: 0 16px 16px;
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 24px;
    }

    .lc-stats {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 12px; margin-bottom: 24px;
    }
    .lc-stat-box {
      background: rgba(255,255,255,0.08);
      border-radius: 14px; padding: 16px;
      text-align: center;
    }
    .lc-stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
    .lc-stat-num { font-size: 32px; font-weight: 800; color: #34d399; line-height: 1; }

    .lc-progress-label {
      display: flex; justify-content: space-between;
      font-size: 13px; color: #94a3b8; margin-bottom: 10px;
    }
    .lc-progress-track {
      height: 10px; background: rgba(255,255,255,0.1);
      border-radius: 999px; overflow: hidden;
    }
    .lc-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #34d399, #10b981);
      border-radius: 999px;
      transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
      box-shadow: 0 0 12px rgba(52,211,153,0.5);
    }
    .lc-message {
      margin-top: 16px; padding: 14px 18px;
      background: rgba(52,211,153,0.12);
      border: 1px solid rgba(52,211,153,0.25);
      border-radius: 12px;
      font-size: 14px; color: #a7f3d0; text-align: center; line-height: 1.5;
    }
    .lc-message.premio {
      background: rgba(251,191,36,0.12);
      border-color: rgba(251,191,36,0.3);
      color: #fde68a;
      font-size: 15px; font-weight: 600;
    }
    .lc-qr-section { text-align: center; }
    .lc-qr-section canvas { border-radius: 12px; }
    .lc-qr-hint { font-size: 12px; color: #64748b; margin-top: 10px; }

    /* ── Barra de navegación inferior del dueño ── */
    .dueno-nav {
      position: fixed; bottom: 0; left: 0; right: 0;
      background: white;
      border-top: 1px solid #e2e8f0;
      display: flex;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.08);
      z-index: 100;
    }
    .dueno-nav-btn {
      flex: 1; border: none; background: none;
      padding: 12px 8px 10px;
      cursor: pointer; font-family: 'Inter', sans-serif;
      display: flex; flex-direction: column; align-items: center; gap: 3px;
      color: #94a3b8; font-size: 11px; font-weight: 500;
      transition: color 0.2s;
    }
    .dueno-nav-btn:hover { color: #667eea; }
    .dueno-nav-btn.active { color: #667eea; }
    .dueno-nav-btn .nav-icon { font-size: 20px; line-height: 1; }

    /* ── Pantalla bienvenida ── */
    .bienvenida-root {
      min-height: 100vh;
      background: linear-gradient(145deg, #667eea 0%, #764ba2 100%);
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 32px 24px;
      font-family: 'Sora', sans-serif;
      color: white; text-align: center;
    }
    .bienvenida-logo {
      width: 80px; height: 80px; border-radius: 24px;
      background: rgba(255,255,255,0.2);
      display: flex; align-items: center; justify-content: center;
      font-size: 40px; margin-bottom: 24px;
      animation: popIn 0.5s cubic-bezier(0.34,1.56,0.64,1);
    }
    .bienvenida-sub { font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.1em; }
    .bienvenida-nombre { font-size: 30px; font-weight: 800; margin: 0 0 40px; }
    .bienvenida-btns { display: flex; flex-direction: column; gap: 14px; width: 100%; max-width: 320px; }
    .bienvenida-btn {
      padding: 18px 24px; border-radius: 16px; border: none;
      font-family: 'Sora', sans-serif; font-size: 16px; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 14px;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .bienvenida-btn:active { transform: scale(0.97); }
    .bienvenida-btn.primary { background: white; color: #667eea; box-shadow: 0 8px 30px rgba(0,0,0,0.2); }
    .bienvenida-btn.secondary { background: rgba(255,255,255,0.15); color: white; border: 1px solid rgba(255,255,255,0.3); }
    .bienvenida-btn .btn-icon { font-size: 24px; }
    .bienvenida-btn .btn-text { text-align: left; }
    .bienvenida-btn .btn-sub { font-size: 12px; font-weight: 400; opacity: 0.7; display: block; }
    .bienvenida-salir {
      margin-top: 24px; background: none; border: none;
      color: rgba(255,255,255,0.5); font-size: 13px; cursor: pointer;
      font-family: 'Inter', sans-serif;
    }

    /* ── QR landing rediseñado ── */
    .qrlanding-root {
      min-height: 100vh;
      background: linear-gradient(160deg, #1e293b 0%, #0f172a 100%);
      font-family: 'Sora', sans-serif;
      color: white;
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: 32px 20px;
      text-align: center;
    }
    .qrlanding-badge {
      display: inline-block; background: rgba(52,211,153,0.15);
      border: 1px solid rgba(52,211,153,0.3);
      color: #34d399; font-size: 12px; font-weight: 600;
      padding: 6px 14px; border-radius: 999px; margin-bottom: 20px;
      letter-spacing: 0.08em; text-transform: uppercase;
    }
    .qrlanding-nombre { font-size: 32px; font-weight: 800; margin: 0 0 8px; line-height: 1.1; }
    .qrlanding-sub { font-size: 15px; color: #64748b; margin-bottom: 40px; }
    .qrlanding-form {
      width: 100%; max-width: 340px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px; padding: 28px 24px;
    }
    .qrlanding-label { font-size: 13px; color: #94a3b8; margin-bottom: 10px; display: block; text-align: left; }
    .qrlanding-input {
      width: 100%; padding: 14px 16px;
      background: rgba(255,255,255,0.08);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 12px; color: white; font-size: 18px;
      font-family: 'Sora', sans-serif; font-weight: 600;
      text-align: center; letter-spacing: 0.05em;
      outline: none; transition: border-color 0.2s;
      margin-bottom: 16px;
    }
    .qrlanding-input:focus { border-color: #34d399; }
    .qrlanding-input::placeholder { color: #475569; font-weight: 400; font-size: 15px; letter-spacing: 0; }
    .qrlanding-btn {
      width: 100%; padding: 16px;
      background: linear-gradient(135deg, #34d399, #059669);
      border: none; border-radius: 12px;
      color: white; font-size: 16px; font-weight: 700;
      font-family: 'Sora', sans-serif; cursor: pointer;
      transition: opacity 0.2s, transform 0.15s;
      box-shadow: 0 4px 20px rgba(52,211,153,0.35);
    }
    .qrlanding-btn:hover { opacity: 0.9; }
    .qrlanding-btn:active { transform: scale(0.98); }

    /* ── Toast de confirmación ── */
    .toast-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex; align-items: center; justify-content: center;
      z-index: 999; animation: fadeIn 0.2s ease;
    }
    .toast-box {
      background: white; border-radius: 24px;
      padding: 36px 28px; text-align: center;
      max-width: 300px; width: 90%;
      animation: popIn 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }
    .toast-icon { font-size: 56px; margin-bottom: 12px; display: block; }
    .toast-title { font-size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 6px; font-family: 'Sora', sans-serif; }
    .toast-sub { font-size: 14px; color: #64748b; line-height: 1.5; }
    .toast-box.premio-toast { background: linear-gradient(145deg, #fef3c7, #fffbeb); }
    .toast-box.premio-toast .toast-title { color: #92400e; }
    .toast-box.premio-toast .toast-sub { color: #78350f; }

    /* ── Cajero panel ── */
    .cajero-container { padding-bottom: 80px; }

    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes popIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  `
  document.head.appendChild(style)
}

// ─── HELPER: campo de contraseña con ojo ──────────────────
function inputPassword(id, placeholder = '••••••') {
  return `
    <div style="position:relative">
      <input type="password" id="${id}" placeholder="${placeholder}"
        style="width:100%;padding:10px 40px 10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box" />
      <button type="button" onclick="
        var i=document.getElementById('${id}');
        if(i.type==='password'){i.type='text';this.textContent='🙈';}
        else{i.type='password';this.textContent='👁';}
      " style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;padding:0;line-height:1">👁</button>
    </div>
  `
}

function errorConexion(donde = '') {
  return `<p class="error">Sin conexión${donde ? ' al ' + donde : ''}. Verifica tu internet e intenta de nuevo.</p>`
}

// ─── TOAST VISUAL ─────────────────────────────────────────
function mostrarToast({ icono, titulo, subtitulo, esPremio = false, duracion = 2200 }) {
  const overlay = document.createElement('div')
  overlay.className = 'toast-overlay'
  overlay.innerHTML = `
    <div class="toast-box ${esPremio ? 'premio-toast' : ''}">
      <span class="toast-icon">${icono}</span>
      <div class="toast-title">${titulo}</div>
      <div class="toast-sub">${subtitulo}</div>
    </div>
  `
  document.body.appendChild(overlay)
  overlay.addEventListener('click', () => overlay.remove())
  if (!esPremio) setTimeout(() => overlay?.remove(), duracion)
}

// ─── PÁGINA LOGIN ─────────────────────────────────────────
export function paginaLogin() {
  inyectarEstilos()
  return `
    <div class="container">
      <div class="header" style="text-align:center;padding:30px 20px">
        <h1 style="font-size:26px">Lealtad App</h1>
        <p>Inicia sesión para continuar</p>
      </div>
      <div class="cliente-card">
        <div class="form-group">
          <label>Correo electrónico</label>
          <input type="email" id="email" placeholder="tu@correo.com" />
        </div>
        <div class="form-group">
          <label>Contraseña</label>
          ${inputPassword('password')}
        </div>
        <button class="btn-registrar" id="btn-login" style="margin-top:8px">Entrar</button>
        <div id="msg"></div>
      </div>
    </div>
  `
}

export function initLogin() {
  inyectarEstilos()
  const doLogin = async () => {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()
    const msg = document.getElementById('msg')
    const btn = document.getElementById('btn-login')

    if (!email || !password) {
      msg.innerHTML = `<p class="error">Llena todos los campos</p>`
      return
    }

    btn.disabled = true
    btn.textContent = 'Verificando...'
    msg.innerHTML = ''

    try {
      const { login } = await import('./auth.js')
      const negocio = await login(email, password)

      if (!negocio) {
        msg.innerHTML = `<p class="error">Correo o contraseña incorrectos</p>`
        return
      }
      if (negocio.activo === false) {
        msg.innerHTML = `<p class="error">Esta cuenta está desactivada. Contacta al administrador.</p>`
        const { logout } = await import('./auth.js')
        logout()
        return
      }

      // ── Ir a bienvenida en lugar de directo al panel ──
      window.location.hash = '#/bienvenida'
      window.dispatchEvent(new Event('hashchange'))
    } catch (e) {
      msg.innerHTML = errorConexion('servidor')
    } finally {
      btn.disabled = false
      btn.textContent = 'Entrar'
    }
  }

  document.getElementById('btn-login').addEventListener('click', doLogin)
  document.getElementById('password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin()
  })
}

// ─── PANTALLA DE BIENVENIDA ───────────────────────────────
export async function paginaBienvenida() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) {
      window.location.hash = '#/login'
      window.dispatchEvent(new Event('hashchange'))
      return '<div></div>'
    }
    return `
      <div class="bienvenida-root">
        <div class="bienvenida-logo">☕</div>
        <div class="bienvenida-sub">Bienvenido</div>
        <h1 class="bienvenida-nombre">${negocio.nombre}</h1>
        <div class="bienvenida-btns">
          <button class="bienvenida-btn primary" id="btn-ir-cajero-bienvenida">
            <span class="btn-icon">🧾</span>
            <span class="btn-text">
              Panel Cajero
              <span class="btn-sub">Registrar visitas de clientes</span>
            </span>
          </button>
          <button class="bienvenida-btn secondary" id="btn-ir-dueno-bienvenida">
            <span class="btn-icon">📊</span>
            <span class="btn-text">
              Mi Panel
              <span class="btn-sub">Estadísticas y premios</span>
            </span>
          </button>
        </div>
        <button class="bienvenida-salir" id="btn-salir-bienvenida">Cerrar sesión</button>
      </div>
    `
  } catch (e) {
    return `<div class="container"><div class="cliente-card">${errorConexion()}</div></div>`
  }
}

export function initBienvenida() {
  inyectarEstilos()
  document.getElementById('btn-ir-cajero-bienvenida')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('btn-ir-dueno-bienvenida')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('btn-salir-bienvenida')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })
}

// ─── PÁGINA CAJERO ───────────────────────────────────────
export function paginaCajero() {
  inyectarEstilos()
  return `
    <div class="container cajero-container">
      <div class="header">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h1>Panel Cajero</h1>
            <p>Registra visitas de tus clientes</p>
          </div>
        </div>
      </div>

      <div style="padding:16px;display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;gap:8px">
          <input type="tel" id="telefono" placeholder="Buscar por teléfono..." style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px" />
          <button id="buscar" style="padding:10px 16px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px">Buscar</button>
        </div>
        <div style="display:flex;gap:8px">
          <input type="text" id="nombre-buscar" placeholder="O buscar por nombre..." style="flex:1;padding:10px;border:1px solid #ddd;border-radius:8px;font-size:14px" />
          <button id="buscar-nombre" style="padding:10px 16px;background:#667eea;color:white;border:none;border-radius:8px;cursor:pointer;font-size:14px;white-space:nowrap">Buscar</button>
        </div>
      </div>

      <div id="resultado"></div>

      <div class="cliente-card" style="margin-top:12px">
        <h3 style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Últimos clientes atendidos hoy</h3>
        <div id="ultimos-clientes">
          <p style="color:#aaa;font-size:13px;text-align:center">Cargando...</p>
        </div>
      </div>
    </div>

    <nav class="dueno-nav">
      <button class="dueno-nav-btn active" id="nav-cajero">
        <span class="nav-icon">🧾</span>Cajero
      </button>
      <button class="dueno-nav-btn" id="nav-panel">
        <span class="nav-icon">📊</span>Mi Panel
      </button>
      <button class="dueno-nav-btn" id="nav-salir">
        <span class="nav-icon">🚪</span>Salir
      </button>
    </nav>
  `
}

export function initCajero() {
  inyectarEstilos()

  document.getElementById('nav-panel')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('nav-salir')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  cargarUltimosClientes()

  document.getElementById('buscar').addEventListener('click', async () => {
    const telefono = document.getElementById('telefono').value.trim()
    if (!telefono) return
    document.getElementById('nombre-buscar').value = ''
    await buscarYMostrar({ telefono })
  })

  document.getElementById('buscar-nombre').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-buscar').value.trim()
    if (!nombre) return
    document.getElementById('telefono').value = ''
    await buscarYMostrar({ nombre })
  })

  document.getElementById('telefono').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const telefono = document.getElementById('telefono').value.trim()
      if (telefono) { document.getElementById('nombre-buscar').value = ''; await buscarYMostrar({ telefono }) }
    }
  })

  document.getElementById('nombre-buscar').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const nombre = document.getElementById('nombre-buscar').value.trim()
      if (nombre) { document.getElementById('telefono').value = ''; await buscarYMostrar({ nombre }) }
    }
  })
}

async function cargarUltimosClientes() {
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) return

    const hoy = new Date().toISOString().split('T')[0]
    const { data: visitas, error } = await supabase
      .from('visitas').select('cliente_id, fecha')
      .eq('negocio_id', negocio.id)
      .gte('fecha', hoy)
      .order('fecha', { ascending: false })
      .limit(20)
    if (error) throw error

    if (!visitas || visitas.length === 0) {
      document.getElementById('ultimos-clientes').innerHTML =
        `<p style="color:#aaa;font-size:13px;text-align:center">Ningún cliente atendido hoy</p>`
      return
    }

    const vistos = new Set()
    const clientesIds = []
    for (const v of visitas) {
      if (!vistos.has(v.cliente_id)) { vistos.add(v.cliente_id); clientesIds.push(v.cliente_id) }
      if (clientesIds.length >= 5) break
    }

    const { data: clientes, error: err2 } = await supabase
      .from('clientes').select('id, nombre, telefono, total_visitas').in('id', clientesIds)
    if (err2) throw err2

    const ordenados = clientesIds.map(id => clientes.find(c => c.id === id)).filter(Boolean)

    document.getElementById('ultimos-clientes').innerHTML = ordenados.map(c => `
      <div class="negocio-row" style="cursor:pointer" data-telefono="${c.telefono}">
        <div><div class="negocio-nombre">${c.nombre}</div><div class="negocio-meta">${c.telefono}</div></div>
        <div class="negocio-stats">
          <span style="font-size:12px;color:#666">${c.total_visitas} visitas</span>
          <span style="font-size:11px;color:#aaa">→</span>
        </div>
      </div>
    `).join('')

    document.querySelectorAll('#ultimos-clientes .negocio-row').forEach(row => {
      row.addEventListener('click', async () => {
        const tel = row.dataset.telefono
        document.getElementById('telefono').value = tel
        document.getElementById('nombre-buscar').value = ''
        await buscarYMostrar({ telefono: tel })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    })
  } catch (e) {
    document.getElementById('ultimos-clientes').innerHTML =
      `<p style="color:#aaa;font-size:13px;text-align:center">Sin conexión</p>`
  }
}

async function buscarYMostrar({ telefono, nombre }) {
  const resultado = document.getElementById('resultado')
  resultado.innerHTML = `<p style="text-align:center;color:#666;padding:16px">Buscando...</p>`

  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    let query = supabase.from('clientes').select('*').eq('negocio_id', negocio?.id)
    if (telefono) query = query.eq('telefono', telefono)
    else if (nombre) query = query.ilike('nombre', `%${nombre}%`)

    const { data, error } = await query
    if (error) throw error

    if (telefono) {
      const cliente = data?.[0]
      if (!cliente) {
        resultado.innerHTML = `
          <div class="cliente-card">
            <p class="error" style="margin-bottom:12px">Cliente no encontrado</p>
            <button class="btn-registrar" id="btn-nuevo">+ Registrar cliente nuevo</button>
          </div>
        `
        document.getElementById('btn-nuevo').addEventListener('click', () => navigate('registro', telefono))
        return
      }
      mostrarCliente(cliente)
      return
    }

    if (!data || data.length === 0) {
      resultado.innerHTML = `<div class="cliente-card"><p class="error">No se encontró ningún cliente con ese nombre</p></div>`
      return
    }
    if (data.length === 1) { mostrarCliente(data[0]); return }

    resultado.innerHTML = `
      <div class="cliente-card">
        <p style="font-size:13px;color:#666;margin-bottom:10px">Se encontraron ${data.length} clientes. Selecciona uno:</p>
        ${data.map(c => `
          <div class="negocio-row" style="cursor:pointer" data-id="${c.id}">
            <div><div class="negocio-nombre">${c.nombre}</div><div class="negocio-meta">${c.telefono}</div></div>
            <div class="negocio-stats"><span style="font-size:12px">${c.total_visitas} visitas</span><span style="font-size:11px;color:#aaa">→</span></div>
          </div>
        `).join('')}
      </div>
    `
    resultado.querySelectorAll('.negocio-row').forEach(row => {
      row.addEventListener('click', () => {
        const cliente = data.find(c => c.id === row.dataset.id)
        if (cliente) mostrarCliente(cliente)
      })
    })
  } catch (e) {
    resultado.innerHTML = `<div class="cliente-card">${errorConexion('buscar clientes')}</div>`
  }
}

async function mostrarCliente(data) {
  try {
    const { data: negocioData, error: e1 } = await supabase
      .from('negocios').select('meta_puntos').eq('id', data.negocio_id).single()
    if (e1) throw e1

    const { data: premiosActivos, error: e2 } = await supabase
      .from('premios').select('*').eq('negocio_id', data.negocio_id).eq('activo', true)
    if (e2) throw e2

    const meta = negocioData?.meta_puntos || META_VISITAS
    const visitasEnCiclo = data.puntos_actuales % meta
    const pct = Math.min(Math.round((visitasEnCiclo / meta) * 100), 100)
    const resultado = document.getElementById('resultado')

    resultado.innerHTML = `
      <div class="cliente-card">
        <h2>${data.nombre || 'Cliente'}</h2>
        <div class="cliente-info">
          <div class="stat">
            <div class="stat-label">Visitas totales</div>
            <div class="stat-value" id="visitas-display">${data.total_visitas}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Para el premio</div>
            <div class="stat-value" id="ciclo-display">${visitasEnCiclo}/${meta}</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label">
            <span>Progreso al premio</span>
            <span id="progress-label">${visitasEnCiclo}/${meta}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" id="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <button class="btn-registrar" id="registrar">+ Registrar visita</button>
        <div id="msg"></div>
      </div>
    `

    document.getElementById('registrar').addEventListener('click', async () => {
      const btn = document.getElementById('registrar')
      btn.disabled = true
      btn.textContent = 'Registrando...'
      btn.style.opacity = '0.7'

      try {
        const { error: ev } = await supabase.from('visitas').insert({
          cliente_id: data.id, negocio_id: data.negocio_id, puntos_sumados: 1
        })
        if (ev) throw ev

        const nuevasVisitas = data.total_visitas + 1
        const nuevosActuales = data.puntos_actuales + 1

        const { error: ec } = await supabase.from('clientes').update({
          puntos_actuales: nuevosActuales, total_visitas: nuevasVisitas
        }).eq('id', data.id)
        if (ec) throw ec

        data.puntos_actuales = nuevosActuales
        data.total_visitas = nuevasVisitas

        const nuevoCiclo = nuevosActuales % meta
        const nuevoPct = Math.min(Math.round((nuevoCiclo / meta) * 100), 100)

        document.getElementById('visitas-display').textContent = nuevasVisitas
        document.getElementById('ciclo-display').textContent = `${nuevoCiclo}/${meta}`
        document.getElementById('progress-label').textContent = `${nuevoCiclo}/${meta}`
        document.getElementById('progress-fill').style.width = nuevoPct + '%'

        cargarUltimosClientes()

        if (nuevosActuales > 0 && nuevosActuales % meta === 0) {
          if (premiosActivos && premiosActivos.length > 0) {
            const premioAplicable = premiosActivos.find(p => p.puntos_requeridos === meta) || premiosActivos[0]

            // ── Toast visual de premio ──
            mostrarToast({
              icono: '🎉',
              titulo: '¡Premio desbloqueado!',
              subtitulo: `Entrega: ${premioAplicable.nombre}\n\nToca aquí para confirmar la entrega.`,
              esPremio: true
            })

            // Al tocar el toast confirma el canje
            const overlay = document.querySelector('.toast-overlay')
            if (overlay) {
              overlay.addEventListener('click', async () => {
                try {
                  await supabase.from('canjes').insert({
                    cliente_id: data.id,
                    premio_id: premioAplicable.id,
                    fecha: new Date().toISOString()
                  })
                } catch (e) { /* silencioso */ }
                overlay.remove()
                document.getElementById('msg').innerHTML =
                  `<div class="exito">✓ Premio "${premioAplicable.nombre}" entregado y registrado.</div>`
              }, { once: true })
            }
          } else {
            mostrarToast({ icono: '✅', titulo: 'Ciclo completado', subtitulo: 'No hay premios activos configurados.' })
          }
        } else {
          // ── Toast visual de visita normal ──
          mostrarToast({
            icono: '✅',
            titulo: 'Visita registrada',
            subtitulo: `Faltan ${meta - nuevoCiclo} visita${meta - nuevoCiclo === 1 ? '' : 's'} para el premio`
          })
        }
      } catch (e) {
        document.getElementById('msg').innerHTML = errorConexion('registrar la visita')
      } finally {
        btn.disabled = false
        btn.textContent = '+ Registrar visita'
        btn.style.opacity = '1'
      }
    })
  } catch (e) {
    document.getElementById('resultado').innerHTML =
      `<div class="cliente-card">${errorConexion('cargar el cliente')}</div>`
  }
}

// ─── PÁGINA REGISTRO CAJERO ──────────────────────────────
export function paginaRegistro(telefono = '') {
  inyectarEstilos()
  return `
    <div class="container" style="padding-bottom:80px">
      <div class="header">
        <h1>Nuevo Cliente</h1>
        <p>Registra al cliente en el programa</p>
      </div>
      <div class="cliente-card">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="nombre" placeholder="Nombre del cliente" />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="tel" value="${telefono}" placeholder="Teléfono" />
        </div>
        <button class="btn-registrar" id="guardar" style="margin-top:16px">Guardar cliente</button>
        <div id="msg"></div>
      </div>
    </div>
    <nav class="dueno-nav">
      <button class="dueno-nav-btn active" id="nav-cajero-reg">
        <span class="nav-icon">🧾</span>Cajero
      </button>
      <button class="dueno-nav-btn" id="nav-panel-reg">
        <span class="nav-icon">📊</span>Mi Panel
      </button>
      <button class="dueno-nav-btn" id="nav-salir-reg">
        <span class="nav-icon">🚪</span>Salir
      </button>
    </nav>
  `
}

export function initRegistro() {
  inyectarEstilos()
  document.getElementById('nav-cajero-reg')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('nav-panel-reg')?.addEventListener('click', () => navigate('dueno'))
  document.getElementById('nav-salir-reg')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  document.getElementById('guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim()
    const telefono = document.getElementById('tel').value.trim()
    const msg = document.getElementById('msg')
    const btn = document.getElementById('guardar')

    if (!nombre || !telefono) {
      msg.innerHTML = `<p class="error">Llena todos los campos</p>`
      return
    }

    btn.disabled = true
    btn.textContent = 'Guardando...'

    try {
      const { getNegocioActual } = await import('./auth.js')
      const negocio = getNegocioActual()
      const { error } = await supabase.from('clientes').insert({
        nombre, telefono, negocio_id: negocio?.id, puntos_actuales: 0, total_visitas: 0
      })
      if (error) throw error
      msg.innerHTML = `<div class="exito">✓ Cliente registrado</div>`
      setTimeout(() => navigate('cajero'), 1500)
    } catch (e) {
      msg.innerHTML = errorConexion('guardar el cliente')
    } finally {
      btn.disabled = false
      btn.textContent = 'Guardar cliente'
    }
  })
}

// ─── PÁGINA ADMIN ─────────────────────────────────────────
function isAdminAutenticado() {
  return sessionStorage.getItem('admin_auth') === 'ok'
}

export async function paginaAdmin() {
  inyectarEstilos()
  if (!isAdminAutenticado()) {
    return `
      <div class="container">
        <div class="header" style="text-align:center;padding:30px 20px">
          <h1 style="font-size:26px">Panel Admin</h1>
          <p>Acceso restringido</p>
        </div>
        <div class="cliente-card">
          <div class="form-group">
            <label>Contraseña de administrador</label>
            ${inputPassword('admin-password')}
          </div>
          <button class="btn-registrar" id="btn-admin-login" style="margin-top:8px">Entrar</button>
          <div id="msg-admin"></div>
        </div>
      </div>
    `
  }

  try {
    const { data: negocios, error: e1 } = await supabase.from('negocios').select('*')
    if (e1) throw e1
    const { data: clientes, error: e2 } = await supabase.from('clientes').select('*')
    if (e2) throw e2
    const { data: visitas, error: e3 } = await supabase.from('visitas').select('*')
    if (e3) throw e3

    const filas = (negocios || []).map(n => {
      const cn = (clientes || []).filter(c => c.negocio_id === n.id).length
      const vn = (visitas || []).filter(v => v.negocio_id === n.id).length
      return `
        <div class="negocio-row">
          <div>
            <div class="negocio-nombre">${n.nombre}</div>
            <div class="negocio-meta">${n.email}</div>
          </div>
          <div class="negocio-stats">
            <span>${cn} clientes</span>
            <span>${vn} visitas</span>
            <span class="badge ${n.activo ? 'activo' : 'inactivo'}">${n.activo ? 'Activo' : 'Inactivo'}</span>
            <button class="btn-toggle-negocio" data-id="${n.id}" data-activo="${n.activo}"
              style="background:${n.activo ? '#fee2e2' : '#d1fae5'};color:${n.activo ? '#dc2626' : '#059669'};border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">
              ${n.activo ? 'Desactivar' : 'Activar'}
            </button>
            <button class="btn-descargar-qr" data-id="${n.id}" data-nombre="${n.nombre}"
              style="background:#667eea;color:white;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px">
              ⬇ QR
            </button>
          </div>
        </div>
      `
    }).join('')

    return `
      <div class="container">
        <div class="header">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><h1>Panel Admin</h1><p>Gestiona tus negocios</p></div>
            <button id="btn-admin-logout" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
          </div>
        </div>
        <div class="cliente-card">
          <div class="admin-stats">
            <div class="stat"><div class="stat-label">Negocios</div><div class="stat-value">${(negocios||[]).length}</div></div>
            <div class="stat"><div class="stat-label">Clientes</div><div class="stat-value">${(clientes||[]).length}</div></div>
            <div class="stat"><div class="stat-label">Visitas</div><div class="stat-value">${(visitas||[]).length}</div></div>
          </div>
        </div>
        <div class="cliente-card" style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Negocios registrados</h3>
            <button id="btn-nuevo-negocio" style="background:#667eea;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px">+ Nuevo negocio</button>
          </div>
          <div id="form-negocio" style="display:none;background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:16px">
            <div class="form-group"><label>Nombre del negocio</label><input type="text" id="nuevo-nombre" placeholder="Ej: Café El Sol" /></div>
            <div class="form-group"><label>Correo electrónico</label><input type="email" id="nuevo-email" placeholder="cafe@correo.com" /></div>
            <div class="form-group"><label>Contraseña</label>${inputPassword('nuevo-password', 'Contraseña para el dueño')}</div>
            <button id="btn-guardar-negocio" class="btn-registrar" style="margin-top:8px">Guardar negocio</button>
            <div id="msg-negocio"></div>
          </div>
          ${filas || '<p style="color:#666;text-align:center">No hay negocios aún</p>'}
        </div>
        <canvas id="qr-canvas" style="display:none"></canvas>
      </div>
    `
  } catch (e) {
    return `<div class="container"><div class="header"><h1>Panel Admin</h1></div><div class="cliente-card">${errorConexion('cargar los datos')}</div></div>`
  }
}

export function initAdmin() {
  inyectarEstilos()
  if (!isAdminAutenticado()) {
    document.getElementById('btn-admin-login')?.addEventListener('click', () => {
      const pw = document.getElementById('admin-password').value
      const msg = document.getElementById('msg-admin')
      if (pw === ADMIN_PASSWORD) { sessionStorage.setItem('admin_auth', 'ok'); navigate('admin') }
      else msg.innerHTML = `<p class="error">Contraseña incorrecta</p>`
    })
    document.getElementById('admin-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-admin-login').click()
    })
    return
  }

  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth'); navigate('admin')
  })
  document.getElementById('btn-nuevo-negocio')?.addEventListener('click', () => {
    const form = document.getElementById('form-negocio')
    form.style.display = form.style.display === 'none' ? 'block' : 'none'
  })
  document.getElementById('btn-guardar-negocio')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nuevo-nombre').value.trim()
    const email = document.getElementById('nuevo-email').value.trim()
    const password = document.getElementById('nuevo-password').value.trim()
    const msg = document.getElementById('msg-negocio')
    if (!nombre || !email || !password) { msg.innerHTML = `<p class="error">Llena todos los campos</p>`; return }
    msg.innerHTML = `<p style="color:#666;text-align:center">Guardando...</p>`
    try {
      const { error } = await supabase.from('negocios').insert({ nombre, email, password, password_hash: password, activo: true, meta_puntos: 10 })
      if (error) throw error
      msg.innerHTML = `<div class="exito">✓ Negocio creado correctamente</div>`
      setTimeout(() => navigate('admin'), 1500)
    } catch (e) { msg.innerHTML = errorConexion('guardar el negocio') }
  })
  document.querySelectorAll('.btn-toggle-negocio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const activoActual = btn.dataset.activo === 'true'
      btn.textContent = 'Guardando...'; btn.disabled = true
      try {
        const { error } = await supabase.from('negocios').update({ activo: !activoActual }).eq('id', btn.dataset.id)
        if (error) throw error
        navigate('admin')
      } catch (e) { btn.textContent = activoActual ? 'Desactivar' : 'Activar'; btn.disabled = false; alert('Sin conexión.') }
    })
  })
  document.querySelectorAll('.btn-descargar-qr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const url = `${window.location.origin}/#/negocio/${btn.dataset.id}`
      const canvas = document.getElementById('qr-canvas')
      await QRCode.toCanvas(canvas, url, { width: 400, margin: 2, color: { dark: '#000000', light: '#ffffff' } })
      const canvasFinal = document.createElement('canvas')
      canvasFinal.width = canvas.width; canvasFinal.height = canvas.height + 50
      const ctx = canvasFinal.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvasFinal.width, canvasFinal.height)
      ctx.drawImage(canvas, 0, 0)
      ctx.fillStyle = '#000000'; ctx.font = 'bold 22px Arial'; ctx.textAlign = 'center'
      ctx.fillText(btn.dataset.nombre, canvas.width / 2, canvas.height + 35)
      const link = document.createElement('a')
      link.download = `QR-${btn.dataset.nombre}.png`
      link.href = canvasFinal.toDataURL('image/png'); link.click()
    })
  })
}

// ─── PÁGINA CLIENTE — REDISEÑADA ──────────────────────────
export async function paginaCliente(telefono) {
  inyectarEstilos()
  try {
    const { data, error } = await supabase
      .from('clientes').select('*, negocios(nombre, meta_puntos)')
      .eq('telefono', telefono).single()
    if (error) throw error

    if (!data) return `<div class="container"><div class="header"><h1>No encontrado</h1><p>Este cliente no está registrado</p></div></div>`

    const meta = data.negocios?.meta_puntos || META_VISITAS
    const visitasEnCiclo = data.puntos_actuales % meta
    const pct = data.puntos_actuales === 0 ? 0 : Math.min(Math.round((visitasEnCiclo / meta) * 100), 100)
    const tienePremio = data.puntos_actuales > 0 && data.puntos_actuales % meta === 0

    let mensajeProgreso
    if (data.puntos_actuales === 0) mensajeProgreso = `Empieza a visitar para acumular visitas ☕`
    else if (tienePremio) mensajeProgreso = `🎉 ¡Tienes un premio disponible! Muéstraselo al cajero.`
    else mensajeProgreso = `Te faltan <strong>${meta - visitasEnCiclo}</strong> visita${meta - visitasEnCiclo === 1 ? '' : 's'} para tu próximo premio`

    return `
      <div class="lc-root">
        <div class="lc-hero">
          <div class="lc-logo-ring">☕</div>
          <div class="lc-negocio">${data.negocios?.nombre || 'Programa de Lealtad'}</div>
          <h1 class="lc-saludo">Hola, ${data.nombre?.split(' ')[0] || 'Cliente'} 👋</h1>
        </div>

        <div class="lc-card">
          <div class="lc-stats">
            <div class="lc-stat-box">
              <div class="lc-stat-label">Visitas totales</div>
              <div class="lc-stat-num">${data.total_visitas}</div>
            </div>
            <div class="lc-stat-box">
              <div class="lc-stat-label">Para el premio</div>
              <div class="lc-stat-num" style="color:${tienePremio ? '#fbbf24' : '#34d399'}">${visitasEnCiclo}/${meta}</div>
            </div>
          </div>

          <div class="lc-progress-label">
            <span>Progreso al premio</span>
            <span>${visitasEnCiclo} de ${meta}</span>
          </div>
          <div class="lc-progress-track">
            <div class="lc-progress-fill" id="lc-fill" style="width:0%"></div>
          </div>

          <div class="lc-message ${tienePremio ? 'premio' : ''}" style="margin-top:16px">
            ${mensajeProgreso}
          </div>
        </div>

        <div class="lc-card">
          <div class="lc-qr-section">
            <div style="font-size:13px;color:#64748b;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.08em">Tu código QR</div>
            <div id="qrcode" style="display:inline-block;padding:12px;background:white;border-radius:16px;"></div>
            <div class="lc-qr-hint">Muéstralo al cajero para sumar visitas</div>
          </div>
        </div>
      </div>
    `
  } catch (e) {
    return `<div class="lc-root"><div class="lc-hero"><h1 class="lc-saludo">Sin conexión</h1></div><div class="lc-card">${errorConexion('cargar tu perfil')}</div></div>`
  }
}

export function initCliente(telefono) {
  inyectarEstilos()
  // Animar la barra después de render
  setTimeout(() => {
    const fill = document.getElementById('lc-fill')
    if (fill) {
      const pct = fill.parentElement?.previousElementSibling
      // Leer el width real del data-pct
      const w = fill.dataset.pct || fill.style.width
    }
  }, 100)

  // Animar barra con delay
  const tryAnimate = () => {
    const fill = document.getElementById('lc-fill')
    if (!fill) return
    // El width real está en el HTML; lo leemos y animamos desde 0
    const targetPct = fill.getAttribute('data-target') || (() => {
      // calcular desde el DOM
      const label = document.querySelector('.lc-progress-label span:last-child')
      if (!label) return '0'
      const [current, total] = label.textContent.split(' de ').map(Number)
      return total ? Math.round((current / total) * 100) : 0
    })()
    fill.style.width = '0%'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fill.style.width = targetPct + '%'
      })
    })
  }

  // Recalcular pct desde el texto del label
  setTimeout(() => {
    const label = document.querySelector('.lc-progress-label span:last-child')
    const fill = document.getElementById('lc-fill')
    if (label && fill) {
      const parts = label.textContent.split(' de ')
      const current = parseInt(parts[0]) || 0
      const total = parseInt(parts[1]) || 1
      const pct = Math.min(Math.round((current / total) * 100), 100)
      fill.style.width = '0%'
      setTimeout(() => { fill.style.width = pct + '%' }, 50)
    }
  }, 80)

  const qrDiv = document.getElementById('qrcode')
  if (qrDiv) {
    QRCode.toCanvas(document.createElement('canvas'),
      `${window.location.origin}/#/cliente/${telefono}`,
      { width: 180, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } },
      (err, canvas) => { if (!err) qrDiv.appendChild(canvas) }
    )
  }
}

// ─── PÁGINA QR DEL NEGOCIO — REDISEÑADA ──────────────────
export async function paginaQRNegocio(negocioId) {
  inyectarEstilos()
  try {
    const { data: negocio, error } = await supabase
      .from('negocios').select('*').eq('id', negocioId).single()
    if (error) throw error
    if (!negocio) return `<div class="container"><div class="header"><h1>No encontrado</h1></div></div>`

    return `
      <div class="qrlanding-root">
        <div class="qrlanding-badge">☕ Programa de lealtad</div>
        <h1 class="qrlanding-nombre">${negocio.nombre}</h1>
        <p class="qrlanding-sub">Acumula visitas y gana premios</p>

        <div class="qrlanding-form">
          <label class="qrlanding-label">Tu número de teléfono</label>
          <input type="tel" id="tel-negocio" class="qrlanding-input" placeholder="10 dígitos" />
          <button class="qrlanding-btn" id="btn-entrar">Entrar →</button>
          <div id="msg-negocio" style="margin-top:12px;font-size:13px;color:#64748b;text-align:center"></div>
        </div>
      </div>
    `
  } catch (e) {
    return `<div class="qrlanding-root"><div class="lc-card">${errorConexion()}</div></div>`
  }
}

export function initQRNegocio(negocioId) {
  inyectarEstilos()
  const doEntrar = async () => {
    const telefono = document.getElementById('tel-negocio').value.trim()
    if (!telefono) return
    const msg = document.getElementById('msg-negocio')
    const btn = document.getElementById('btn-entrar')
    msg.textContent = 'Buscando...'
    btn.disabled = true
    try {
      const { data, error } = await supabase
        .from('clientes').select('*').eq('telefono', telefono).eq('negocio_id', negocioId).single()
      if (error && error.code !== 'PGRST116') throw error
      if (data) navigate('cliente', telefono)
      else navigate('registro-cliente', `${negocioId}/${telefono}`)
    } catch (e) {
      msg.innerHTML = errorConexion()
      btn.disabled = false
    }
  }

  document.getElementById('btn-entrar')?.addEventListener('click', doEntrar)
  document.getElementById('tel-negocio')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doEntrar()
  })
}

// ─── REGISTRO DESDE QR ────────────────────────────────────
export function paginaRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  return `
    <div class="qrlanding-root">
      <div class="qrlanding-badge">✨ Nuevo registro</div>
      <h1 class="qrlanding-nombre">Bienvenido</h1>
      <p class="qrlanding-sub">Regístrate para acumular visitas y ganar premios</p>
      <div class="qrlanding-form">
        <label class="qrlanding-label">Tu nombre</label>
        <input type="text" id="nombre-cliente" class="qrlanding-input" placeholder="¿Cómo te llamas?" style="margin-bottom:12px" />
        <label class="qrlanding-label">Teléfono</label>
        <input type="tel" id="tel-cliente" class="qrlanding-input" value="${telefono}" readonly style="background:rgba(255,255,255,0.04);color:#64748b;margin-bottom:16px" />
        <button class="qrlanding-btn" id="btn-registrar-cliente">Registrarme →</button>
        <div id="msg-registro" style="margin-top:12px;font-size:13px;color:#64748b;text-align:center"></div>
      </div>
    </div>
  `
}

export function initRegistroCliente(negocioId, telefono) {
  inyectarEstilos()
  document.getElementById('btn-registrar-cliente').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-cliente').value.trim()
    const msg = document.getElementById('msg-registro')
    const btn = document.getElementById('btn-registrar-cliente')
    if (!nombre) { msg.innerHTML = `<p style="color:#f87171">Escribe tu nombre</p>`; return }
    btn.disabled = true; btn.textContent = 'Registrando...'
    try {
      const { error } = await supabase.from('clientes').insert({
        nombre, telefono, negocio_id: negocioId, puntos_actuales: 0, total_visitas: 0
      })
      if (error) throw error
      navigate('cliente', telefono)
    } catch (e) {
      msg.innerHTML = errorConexion('registrarte')
      btn.disabled = false; btn.textContent = 'Registrarme →'
    }
  })
}

// ─── PANEL DEL DUEÑO ──────────────────────────────────────
export async function paginaDueno() {
  inyectarEstilos()
  try {
    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()
    if (!negocio) { window.location.hash = '#/login'; window.dispatchEvent(new Event('hashchange')); return '<div></div>' }

    const { data: negocioData, error: e0 } = await supabase.from('negocios').select('*').eq('id', negocio.id).single()
    if (e0) throw e0
    if (negocioData?.activo === false) { const { logout } = await import('./auth.js'); logout(); return '<div></div>' }

    const metaVisitas = negocioData?.meta_puntos || 10
    const { data: clientes } = await supabase.from('clientes').select('*').eq('negocio_id', negocio.id)
    const { data: visitas } = await supabase.from('visitas').select('*').eq('negocio_id', negocio.id)
    const { data: premios } = await supabase.from('premios').select('*').eq('negocio_id', negocio.id)

    const premioIds = (premios || []).map(p => p.id)
    const { data: canjes } = premioIds.length > 0
      ? await supabase.from('canjes').select('*, premios(nombre), clientes(nombre)')
          .in('premio_id', premioIds).order('fecha', { ascending: false }).limit(10)
      : { data: [] }

    const hoy = new Date().toISOString().split('T')[0]
    const visitasHoy = (visitas || []).filter(v => v.fecha && v.fecha.startsWith(hoy)).length

    const clientesOrdenados = [...(clientes || [])].sort((a, b) => b.total_visitas - a.total_visitas).slice(0, 5)

    const filasClientes = clientesOrdenados.map(c => `
      <div class="negocio-row">
        <div><div class="negocio-nombre">${c.nombre}</div><div class="negocio-meta">${c.telefono}</div></div>
        <div class="negocio-stats"><span>${c.total_visitas} visitas</span></div>
      </div>
    `).join('')

    const filasPremios = (premios || []).map(p => `
      <div class="negocio-row">
        <div><div class="negocio-nombre">${p.nombre}</div><div class="negocio-meta">Se gana a las ${p.puntos_requeridos} visitas</div></div>
        <div class="negocio-stats">
          <span class="badge ${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
          <button class="btn-toggle-premio" data-id="${p.id}" data-activo="${p.activo}"
            style="background:#f0f4f8;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px">
            ${p.activo ? 'Desactivar' : 'Activar'}
          </button>
          <button class="btn-eliminar-premio" data-id="${p.id}" data-nombre="${p.nombre}"
            style="background:#fee2e2;color:#dc2626;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600">🗑</button>
        </div>
      </div>
    `).join('')

    const filasCanjes = (canjes || []).length === 0
      ? `<p style="color:#aaa;font-size:13px;text-align:center">No hay premios entregados aún</p>`
      : (canjes || []).map(c => {
          const fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'
          return `
            <div class="negocio-row">
              <div><div class="negocio-nombre">${c.premios?.nombre || 'Premio'}</div><div class="negocio-meta">${c.clientes?.nombre || '—'} · ${fecha}</div></div>
              <div class="negocio-stats"><span style="font-size:12px;color:#059669">✓ Entregado</span></div>
            </div>
          `
        }).join('')

    return `
      <div class="container" style="padding-bottom:80px">
        <div class="header">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><h1>${negocioData?.nombre || negocio.nombre}</h1><p>Panel del dueño</p></div>
          </div>
        </div>

        <div class="cliente-card">
          <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Resumen</h3>
          <div class="admin-stats">
            <div class="stat"><div class="stat-label">Clientes</div><div class="stat-value">${(clientes||[]).length}</div></div>
            <div class="stat"><div class="stat-label">Visitas hoy</div><div class="stat-value">${visitasHoy}</div></div>
            <div class="stat"><div class="stat-label">Total visitas</div><div class="stat-value">${(visitas||[]).length}</div></div>
          </div>
        </div>

        <div class="cliente-card" style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Premios</h3>
            <button id="btn-nuevo-premio" style="background:#667eea;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px">+ Nuevo premio</button>
          </div>
          <p style="font-size:12px;color:#aaa;margin-bottom:12px">Las visitas necesarias se configuran por premio</p>
          <div id="form-premio" style="display:none;background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:12px">
            <div class="form-group"><label>Nombre del premio</label><input type="text" id="nombre-premio" placeholder="Ej: Café gratis, Descuento 20%..." /></div>
            <div class="form-group"><label>¿A cuántas visitas se gana?</label><input type="number" id="visitas-premio" value="${metaVisitas}" min="1" /></div>
            <button id="btn-guardar-premio" class="btn-registrar" style="margin-top:8px">Guardar premio</button>
            <div id="msg-premio"></div>
          </div>
          <div id="lista-premios">${filasPremios || '<p style="color:#666;text-align:center;font-size:14px">No hay premios aún</p>'}</div>
        </div>

        <div class="cliente-card" style="margin-top:12px">
          <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Últimos premios entregados</h3>
          ${filasCanjes}
        </div>

        <div class="cliente-card" style="margin-top:12px;margin-bottom:24px">
          <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Clientes más frecuentes</h3>
          ${filasClientes || '<p style="color:#666;text-align:center;font-size:14px">Aún no hay clientes registrados</p>'}
        </div>
      </div>

      <nav class="dueno-nav">
        <button class="dueno-nav-btn" id="nav-cajero-dueno">
          <span class="nav-icon">🧾</span>Cajero
        </button>
        <button class="dueno-nav-btn active" id="nav-panel-dueno">
          <span class="nav-icon">📊</span>Mi Panel
        </button>
        <button class="dueno-nav-btn" id="nav-salir-dueno">
          <span class="nav-icon">🚪</span>Salir
        </button>
      </nav>
    `
  } catch (e) {
    return `<div class="container"><div class="header"><h1>Error de conexión</h1></div><div class="cliente-card">${errorConexion('cargar tu panel')}</div></div>`
  }
}

export function initDueno(negocioId) {
  inyectarEstilos()

  document.getElementById('nav-cajero-dueno')?.addEventListener('click', () => navigate('cajero'))
  document.getElementById('nav-salir-dueno')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  document.getElementById('btn-nuevo-premio')?.addEventListener('click', () => {
    const form = document.getElementById('form-premio')
    const abierto = form.style.display !== 'none'
    if (!abierto) document.getElementById('nombre-premio').value = ''
    form.style.display = abierto ? 'none' : 'block'
  })

  document.getElementById('btn-guardar-premio')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-premio').value.trim()
    const visitas = parseInt(document.getElementById('visitas-premio').value)
    const msg = document.getElementById('msg-premio')
    const btn = document.getElementById('btn-guardar-premio')
    if (!nombre || !visitas || visitas < 1) { msg.innerHTML = `<p class="error">Llena todos los campos correctamente</p>`; return }
    btn.disabled = true; btn.textContent = 'Guardando...'
    try {
      const { error } = await supabase.from('premios').insert({ negocio_id: negocioId, nombre, puntos_requeridos: visitas, activo: true })
      if (error) throw error
      msg.innerHTML = `<div class="exito">✓ Premio creado</div>`
      setTimeout(() => navigate('dueno'), 1000)
    } catch (e) {
      msg.innerHTML = errorConexion('guardar el premio')
      btn.disabled = false; btn.textContent = 'Guardar premio'
    }
  })

  document.querySelectorAll('.btn-toggle-premio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const activoActual = btn.dataset.activo === 'true'
      try {
        const { error } = await supabase.from('premios').update({ activo: !activoActual }).eq('id', btn.dataset.id)
        if (error) throw error
        navigate('dueno')
      } catch (e) { alert('Sin conexión. Intenta de nuevo.') }
    })
  })

  document.querySelectorAll('.btn-eliminar-premio').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar el premio "${btn.dataset.nombre}"? Esta acción no se puede deshacer.`)) return
      btn.disabled = true; btn.textContent = '...'
      try {
        const { error } = await supabase.from('premios').delete().eq('id', btn.dataset.id)
        if (error) throw error
        navigate('dueno')
      } catch (e) { alert('Sin conexión. No se pudo eliminar.'); btn.disabled = false; btn.textContent = '🗑' }
    })
  })
}