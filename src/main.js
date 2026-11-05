import './style.css'
import { getPage } from './router.js'
import { getNegocioActual, getPerfilActual, esAdmin, marcarAdmin, leerAcceso, diag } from './auth.js'
import { supabase } from './supabase.js'
import {
  paginaCajero, initCajero,
  paginaLogin, initLogin,
  paginaQRNegocio, initQRNegocio,
  paginaDueno, initDueno,
  paginaBienvenida, initBienvenida,
  paginaOnboarding, initOnboarding,
  paginaLanding, initLanding,
  paginaPrivacidad, initPrivacidad,
  paginaTerminos, initTerminos,
  MENSAJE_CUENTA_DESACTIVADA,
  paginaReclamar, initReclamar,
  paginaTarjeta, initTarjeta,
  paginaAdmin, initAdmin,
} from './pages.js'

// Actualización automática de la PWA:
// 1. Al abrir la app y cada que vuelve al primer plano se pregunta si hay un sw.js nuevo.
// 2. Cuando el SW nuevo toma el control ("controllerchange") hay una versión nueva.
// 3. Para no borrarle a nadie lo que está escribiendo, la recarga espera a que
//    la app se oculte o a que cambie de pantalla.
if ('serviceWorker' in navigator) {
  let versionNueva = false
  const recargar = () => { if (versionNueva) { versionNueva = false; window.location.reload() } }
  // Si no había SW (primera visita), tomar el control no es una versión nueva.
  const habiaControlador = !!navigator.serviceWorker.controller

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!habiaControlador) return
    versionNueva = true
    if (document.visibilityState === 'hidden') recargar()
  })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') recargar() })
  window.addEventListener('hashchange', recargar)

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(reg => {
        console.log('Sello SW registrado')
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
        })
      })
      .catch(err => console.log('SW error:', err))
  })
}

let turnoRender = 0

// Enlace de "restablecer contraseña": llega con #access_token=...&type=recovery.
// supabase-js lo procesa y borra el hash; mientras tanto se queda en "Entrar"
// en modo "nueva contraseña" (aunque ya exista la sesión de recuperación).
let modoRecuperacion = /type=recovery/.test(window.location.hash)

const cargandoHTML = () => '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'

// Sin señal y sin copia local del perfil: no se manda a "Entrar" (la sesión
// sigue guardada); se ofrece reintentar.
function mostrarSinConexion(app) {
  app.innerHTML = `<div style="max-width:360px;margin:0 auto;padding:80px 24px;text-align:center;font-family:system-ui,sans-serif;color:#1c2b25">
    <p style="font-size:18px;font-weight:700;margin-bottom:8px">Sin conexión</p>
    <p style="font-size:15px;color:#4d5f57;margin-bottom:20px">Tu sesión sigue guardada. Revisa tu internet e intenta de nuevo.</p>
    <button id="btn-reintentar-arranque" style="min-height:46px;padding:10px 24px;border:none;border-radius:10px;background:#0a5c47;color:#fff;font:inherit;font-size:15px;font-weight:600">Reintentar</button>
  </div>`
  document.getElementById('btn-reintentar-arranque')?.addEventListener('click', render)
}

async function render() {
  const page = getPage()
  const hash = window.location.hash
  const app = document.querySelector('#app')
  // Cada render tiene su turno: si cambia la ruta mientras se espera la
  // sesión, el render viejo ya no pinta nada encima del nuevo.
  const turno = ++turnoRender
  if (page !== 'login') modoRecuperacion = false
  // Las pantallas del dueño pintan el fondo de la página (html.ow-pagina) para
  // que no se vea blanco mientras se dibujan. En las demás se quita.
  if (!['login', 'onboarding', 'bienvenida', 'dueno', 'terminos', 'admin'].includes(page)) {
    document.documentElement.classList.remove('ow-pagina')
  }
  app.innerHTML = ''

  // ── Páginas públicas ──
  // El QR del mesero abre #/c/<negocio_id>/<codigo>.
  if (page === 'reclamar') {
    const parts = hash.split('/')
    app.innerHTML = paginaReclamar()
    initReclamar(parts[2] || '', parts[3] || '')
    return
  }

  // Tarjeta del cliente: se abre con el token guardado en su teléfono.
  if (page === 'tarjeta') {
    app.innerHTML = paginaTarjeta()
    initTarjeta(hash.split('/')[2] || '')
    return
  }

  // QR fijo del mostrador: solo consulta la tarjeta del teléfono recordado.
  if (page === 'negocio') {
    app.innerHTML = paginaQRNegocio()
    initQRNegocio(hash.split('/')[2] || '')
    return
  }

  if (page === 'landing') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    const negocioId = hash.split('/')[2] || ''
    app.innerHTML = await paginaLanding(negocioId)
    initLanding(negocioId)
    return
  }

  if (page === 'privacidad') {
    const tipo = hash.split('/')[2] || 'cliente'
    app.innerHTML = paginaPrivacidad(tipo)
    initPrivacidad()
    return
  }

  // Términos y aviso de privacidad para negocios (pública, se abre desde el login).
  if (page === 'terminos') {
    app.innerHTML = paginaTerminos()
    initTerminos()
    return
  }

  // "Entrar" (también la dirección sin ruta "/", que es con la que abre la
  // PWA instalada, y el enlace #/login que se comparte por WhatsApp).
  // Si ya hay sesión en este celular, NO se muestra el formulario: se va
  // directo a su pantalla. Esta era la causa de "pide entrar otra vez".
  if (page === 'login') {
    if (!modoRecuperacion) {
      app.innerHTML = cargandoHTML()
      const acceso = await leerAcceso()
      if (turno !== turnoRender) return
      diag('arranque en login', { estado: acceso.estado })
      if (acceso.estado === 'ok' && acceso.perfil.activo !== false) {
        window.location.hash = acceso.perfil.role === 'mesero' ? '#/cajero' : '#/bienvenida'
        return
      }
      if (acceso.estado === 'sin_perfil' && await esAdmin()) {
        if (turno !== turnoRender) return
        window.location.hash = '#/admin'
        return
      }
      if (acceso.estado === 'sin_red') { mostrarSinConexion(app); return }
    }
    app.innerHTML = paginaLogin()
    initLogin({ recuperacion: modoRecuperacion })
    return
  }

  // Panel del administrador de Sello (5A). Solo se muestra si el servidor
  // dice que quien tiene la sesión está en admins (es_admin). Aunque alguien
  // forzara esta pantalla, las funciones admin_* y crear-negocio rechazan a
  // quien no sea administrador.
  if (page === 'admin') {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      app.innerHTML = paginaLogin()
      initLogin()
      return
    }
    if (await esAdmin()) {
      app.innerHTML = paginaAdmin()
      initAdmin()
      return
    }
    marcarAdmin(false)
    const profile = await getPerfilActual()
    window.location.hash = profile?.role === 'owner' ? '#/dueno' : profile ? '#/cajero' : '#/login'
    return
  }

  // ── Requieren sesión ──
  // Se decide con la sesión guardada por Supabase (no con copias locales) y
  // un error de red o de permiso NUNCA se toma como "no hay sesión".
  app.innerHTML = cargandoHTML()
  const acceso = await leerAcceso()
  if (turno !== turnoRender) return
  diag('arranque', { pagina: page, estado: acceso.estado, desdeCopia: !!acceso.desdeCopia })

  if (acceso.estado === 'sin_red') { mostrarSinConexion(app); return }
  if (acceso.estado === 'sin_sesion') {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }
  const profile = acceso.estado === 'ok' ? acceso.perfil : null
  // El dueño lo desactivó: se cierra la sesión guardada en este celular.
  if (profile?.activo === false) {
    const { logout } = await import('./auth.js')
    await logout()
    app.innerHTML = paginaLogin()
    initLogin()
    const msg = document.getElementById('msg')
    if (msg) msg.innerHTML = `<p class="s-error">${MENSAJE_CUENTA_DESACTIVADA}</p>`
    return
  }
  // Administrador de Sello sin negocio propio: su pantalla es #/admin.
  if (!profile && await esAdmin()) {
    if (turno !== turnoRender) return
    window.location.hash = '#/admin'
    return
  }
  if (!profile || !['owner', 'mesero'].includes(profile.role)) {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  if (profile.role === 'mesero' && page !== 'cajero') {
    window.location.hash = '#/cajero'
    return
  }

  if (profile.role === 'owner' && !['onboarding', 'bienvenida', 'dueno', 'cajero'].includes(page)) {
    window.location.hash = '#/bienvenida'
    return
  }

  if (page === 'onboarding') {
    const paso = parseInt(hash.split('/')[2] || '0')
    app.innerHTML = paginaOnboarding(paso)
    initOnboarding(paso)
    return
  }

  if (page === 'bienvenida') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    app.innerHTML = await paginaBienvenida()
    initBienvenida()
    return
  }

  if (page === 'dueno') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    app.innerHTML = await paginaDueno()
    const negocio = getNegocioActual()
    if (negocio) initDueno(negocio.id)
    return
  }

  if (page === 'cajero') {
    app.innerHTML = paginaCajero()
    initCajero()
    return
  }

  app.innerHTML = paginaLogin()
  initLogin()
}

render()
window.addEventListener('hashchange', render)
