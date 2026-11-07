import './style.css'
import { getPage } from './router.js'
import { getNegocioActual, getPerfilActual, esAdmin, marcarAdmin, leerAcceso, logout, motivoDesactivacion } from './auth.js'
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
  // Los primeros segundos las rutas cambian solas (p. ej. "/" → #/cajero):
  // recargar ahí se vería como un destello. Ese caso espera al siguiente
  // cambio de pantalla o a que la app se oculte.
  const abiertaEn = Date.now()
  window.addEventListener('hashchange', () => { if (Date.now() - abiertaEn > 5000) recargar() })

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

// Pantalla de carga: la misma de index.html (logo de Sello sobre #f1f7f4).
// Si ya está en pantalla no se vuelve a pintar, así no parpadea.
const ARRANQUE_HTML = document.querySelector('#app .sello-arranque')?.outerHTML
  || '<div class="sello-arranque" role="status" aria-label="Cargando"></div>'
function mostrarCargando(app) {
  if (app.firstElementChild?.classList.contains('sello-arranque') && app.childElementCount === 1) return
  app.innerHTML = ARRANQUE_HTML
}

// El acceso (sesión + perfil) se reutiliza unos segundos: al abrir en "/"
// se lee una vez, se redirige a #/cajero y esa segunda vista ya no vuelve a
// preguntar al servidor. Cualquier cambio de sesión (entrar, salir, token
// renovado) lo invalida.
let accesoMemo = null
supabase.auth.onAuthStateChange(() => { accesoMemo = null })
async function accesoActual() {
  if (accesoMemo && Date.now() - accesoMemo.t < 5000) return accesoMemo.valor
  const valor = await leerAcceso()
  accesoMemo = valor.estado === 'ok' && !valor.desdeCopia ? { valor, t: Date.now() } : null
  return valor
}

// ¿El acceso leído del servidor dice que la cuenta o el negocio ya no están
// activos? Devuelve 'cuenta', 'negocio' o null.
function motivoDeAcceso(acceso) {
  if (acceso?.estado !== 'ok') return null
  if (acceso.perfil.activo === false) return 'cuenta'
  if (acceso.negocioActivo === false) return 'negocio'
  return null
}

// Cuenta o negocio desactivados: se cierra la sesión y "Entrar" muestra el
// motivo (lo guarda logout). Nunca en silencio.
async function salirPorDesactivacion(motivo) {
  accesoMemo = null
  await logout(motivo)
}

// Si la cuenta se desactiva con la app abierta (p. ej. el mesero la deja en
// el Cajero todo el turno), se nota al volver a primer plano.
const PAGINAS_CON_SESION = ['cajero', 'dueno', 'bienvenida', 'onboarding']
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState !== 'visible' || !PAGINAS_CON_SESION.includes(getPage())) return
  const motivo = await motivoDesactivacion().catch(() => null)
  if (motivo && PAGINAS_CON_SESION.includes(getPage())) salirPorDesactivacion(motivo)
})

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
  // (No se vacía #app aquí: cada rama pinta su vista o la pantalla de carga,
  // así nunca hay un instante en blanco entre una y otra.)

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
    mostrarCargando(app)
    const negocioId = hash.split('/')[2] || ''
    const html = await paginaLanding(negocioId)
    if (turno !== turnoRender) return
    app.innerHTML = html
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
      mostrarCargando(app)
      const acceso = await accesoActual()
      if (turno !== turnoRender) return
      const motivo = motivoDeAcceso(acceso)
      if (motivo) { await salirPorDesactivacion(motivo); return }
      if (acceso.estado === 'ok') {
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
    mostrarCargando(app)
    const { data: { session } } = await supabase.auth.getSession()
    if (turno !== turnoRender) return
    if (!session) {
      app.innerHTML = paginaLogin()
      initLogin()
      return
    }
    const admin = await esAdmin()
    if (turno !== turnoRender) return
    if (admin) {
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
  mostrarCargando(app)
  const acceso = await accesoActual()
  if (turno !== turnoRender) return

  if (acceso.estado === 'sin_red') { mostrarSinConexion(app); return }
  if (acceso.estado === 'sin_sesion') {
    app.innerHTML = paginaLogin()
    initLogin()
    return
  }
  const profile = acceso.estado === 'ok' ? acceso.perfil : null
  // El dueño desactivó al mesero, o Sello desactivó el negocio: se cierra la
  // sesión guardada en este celular y "Entrar" explica por qué. (Antes se
  // pintaba el mensaje y logout() volvía a pintar "Entrar" encima, vacío.)
  const motivo = motivoDeAcceso(acceso)
  if (motivo) { await salirPorDesactivacion(motivo); return }
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
    const html = await paginaBienvenida()
    if (turno !== turnoRender || getPage() !== 'bienvenida') return
    app.innerHTML = html
    initBienvenida()
    return
  }

  if (page === 'dueno') {
    const html = await paginaDueno()
    if (turno !== turnoRender || getPage() !== 'dueno') return
    app.innerHTML = html
    const negocio = getNegocioActual()
    if (negocio) initDueno(negocio.id)
    return
  }

  if (page === 'cajero') {
    // El rol solo decide la barra de abajo: el dueño puede volver a Mi panel.
    app.innerHTML = paginaCajero(profile.role)
    initCajero()
    return
  }

  app.innerHTML = paginaLogin()
  initLogin()
}

render()
window.addEventListener('hashchange', render)
