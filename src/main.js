import './style.css'
import { getPage } from './router.js'
import { isLoggedIn, getNegocioActual, getPerfilActual } from './auth.js'
import {
  paginaCajero, initCajero,
  paginaRegistro, initRegistro,
  paginaCliente, initCliente,
  paginaLogin, initLogin,
  paginaQRNegocio, initQRNegocio,
  paginaRegistroCliente, initRegistroCliente,
  paginaDueno, initDueno,
  paginaBienvenida, initBienvenida,
  paginaOnboarding, initOnboarding,
  paginaKiosko, initKiosko,
  paginaLanding, initLanding,
  paginaPrivacidad, initPrivacidad,
  paginaReclamar, initReclamar,
  paginaTarjeta, initTarjeta,
} from './pages.js'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('Sello SW registrado'))
      .catch(err => console.log('SW error:', err))
  })
}

async function render() {
  const page = getPage()
  const hash = window.location.hash
  const app = document.querySelector('#app')
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

  if (page === 'cliente') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    const parts = hash.split('/')
    const negocioId = parts[2] || ''
    const telefono = decodeURIComponent(parts[3] || '')
    app.innerHTML = await paginaCliente(negocioId, telefono)
    await initCliente(negocioId, telefono)
    return
  }

  if (page === 'negocio') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    const negocioId = hash.split('/')[2] || ''
    app.innerHTML = await paginaQRNegocio(negocioId)
    initQRNegocio(negocioId)
    return
  }

  if (page === 'landing') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    const negocioId = hash.split('/')[2] || ''
    app.innerHTML = await paginaLanding(negocioId)
    initLanding(negocioId)
    return
  }

  if (page === 'registro-cliente') {
    const parts = hash.split('/')
    const negocioId = parts[2] || ''
    const telefono = decodeURIComponent(parts[3] || '')
    app.innerHTML = paginaRegistroCliente(negocioId, telefono)
    initRegistroCliente(negocioId, telefono)
    return
  }

  if (page === 'privacidad') {
    const tipo = hash.split('/')[2] || 'cliente'
    app.innerHTML = paginaPrivacidad(tipo)
    initPrivacidad()
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
  if (!profile || !['owner', 'mesero'].includes(profile.role)) {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  if (profile.role === 'mesero' && !['cajero', 'registro'].includes(page)) {
    window.location.hash = '#/cajero'
    return
  }

  if (profile.role === 'owner' && !['onboarding', 'bienvenida', 'kiosko', 'dueno', 'cajero', 'registro'].includes(page)) {
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

  if (page === 'kiosko') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    app.innerHTML = await paginaKiosko()
    initKiosko()
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

  if (page === 'registro') {
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = paginaRegistro(telefono)
    initRegistro()
    return
  }

  app.innerHTML = paginaLogin()
  initLogin()
}

render()
window.addEventListener('hashchange', render)
