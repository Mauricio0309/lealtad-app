import './style.css'
import { getPage } from './router.js'
import { isLoggedIn, getNegocioActual } from './auth.js'
import {
  paginaCajero, initCajero,
  paginaRegistro, initRegistro,
  paginaAdmin, initAdmin,
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
  if (page === 'cliente') {
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = await paginaCliente(telefono)
    await initCliente(telefono)
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
    const telefono = parts[3] || ''
    app.innerHTML = paginaRegistroCliente(negocioId, telefono)
    initRegistroCliente(negocioId, telefono)
    return
  }

  if (page === 'privacidad') {
    app.innerHTML = paginaPrivacidad()
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
    app.innerHTML = '<div style="text-align:center;padding:60px;color:#666">Cargando...</div>'
    app.innerHTML = await paginaAdmin()
    initAdmin()
    return
  }

  // ── Requieren login ──
  if (!isLoggedIn()) {
    app.innerHTML = paginaLogin()
    initLogin()
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
