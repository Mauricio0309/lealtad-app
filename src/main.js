import './style.css'
import { getPage } from './router.js'
import { isLoggedIn, getNegocioActual } from './auth.js'
import { paginaCajero, initCajero, paginaRegistro, initRegistro, paginaAdmin, paginaCliente, initCliente, paginaLogin, initLogin, paginaQRNegocio, initQRNegocio, paginaRegistroCliente, initRegistroCliente, paginaDueno, initDueno } from './pages.js'

async function render() {
  const page = getPage()
  const hash = window.location.hash
  const app = document.querySelector('#app')

  app.innerHTML = ''

  // Páginas públicas que no necesitan login
  if (page === 'cliente') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = await paginaCliente(telefono)
    initCliente(telefono)
    return
  }

  if (page === 'negocio') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    const negocioId = hash.split('/')[2] || ''
    app.innerHTML = await paginaQRNegocio(negocioId)
    initQRNegocio(negocioId)
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

  if (page === 'login') {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  // Páginas que necesitan login
  if (!isLoggedIn()) {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  if (page === 'dueno') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    const negocio = getNegocioActual()
    app.innerHTML = await paginaDueno()
    initDueno(negocio.id)
    return
  }

  if (page === 'cajero') {
    app.innerHTML = paginaCajero()
    initCajero()
  } else if (page === 'registro') {
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = paginaRegistro(telefono)
    initRegistro()
  } else if (page === 'admin') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    app.innerHTML = await paginaAdmin()
  }
}

render()
window.addEventListener('hashchange', render)
