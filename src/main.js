import './style.css'
import { getPage } from './router.js'
import { isLoggedIn } from './auth.js'
import { paginaCajero, initCajero, paginaRegistro, initRegistro, paginaAdmin, paginaCliente, initCliente, paginaLogin, initLogin } from './pages.js'

async function render() {
  const page = getPage()
  const hash = window.location.hash
  const app = document.querySelector('#app')

  app.innerHTML = ''

  // Si no está logueado y no es página pública, manda al login
  if (!isLoggedIn() && page !== 'login' && page !== 'cliente') {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }

  if (page === 'login') {
    app.innerHTML = paginaLogin()
    initLogin()
  } else if (page === 'cajero' || page === '') {
    app.innerHTML = paginaCajero()
    initCajero()
  } else if (page === 'registro') {
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = paginaRegistro(telefono)
    initRegistro()
  } else if (page === 'admin') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    app.innerHTML = await paginaAdmin()
  } else if (page === 'cliente') {
    app.innerHTML = '<div class="container"><p style="text-align:center;padding:40px;color:#666">Cargando...</p></div>'
    const telefono = hash.split('/')[2] || ''
    app.innerHTML = await paginaCliente(telefono)
    initCliente(telefono)
  }
}

render()
window.addEventListener('hashchange', render)