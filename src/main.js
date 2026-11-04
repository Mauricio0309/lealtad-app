import './style.css'
import { getPage } from './router.js'
import { isLoggedIn, getNegocioActual, getPerfilActual } from './auth.js'
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

async function render() {
  const page = getPage()
  const hash = window.location.hash
  const app = document.querySelector('#app')
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

  if (page === 'login') {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  // FIX: admin va antes del check de isLoggedIn
  if (page === 'admin') {
    if (!isLoggedIn()) {
      app.innerHTML = paginaLogin()
      initLogin()
      return
    }
    const profile = await getPerfilActual()
    window.location.hash = profile?.role === 'owner' ? '#/dueno' : '#/cajero'
    return
  }

  // ── Requieren login ──
  if (!isLoggedIn()) {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  const profile = await getPerfilActual()
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
