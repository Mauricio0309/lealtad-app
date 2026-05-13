import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

const META_PUNTOS = 10

// ─── PÁGINA LOGIN ─────────────────────────────────────────
export function paginaLogin() {
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
          <input type="password" id="password" placeholder="••••••" />
        </div>
        <button class="btn-registrar" id="btn-login" style="margin-top:8px">Entrar</button>
        <div id="msg"></div>
      </div>
    </div>
  `
}

export function initLogin() {
  document.getElementById('btn-login').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim()
    const password = document.getElementById('password').value.trim()
    const msg = document.getElementById('msg')

    if (!email || !password) {
      msg.innerHTML = `<p class="error">Llena todos los campos</p>`
      return
    }

    msg.innerHTML = `<p style="text-align:center;color:#666">Verificando...</p>`

    const { login } = await import('./auth.js')
    const negocio = await login(email, password)

    if (!negocio) {
      msg.innerHTML = `<p class="error">Correo o contraseña incorrectos</p>`
      return
    }

    window.location.hash = '#/cajero'
    window.dispatchEvent(new Event('hashchange'))
  })
}

// ─── PÁGINA CAJERO ───────────────────────────────────────
export function paginaCajero() {
  return `
    <div class="container">
      <div class="header">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h1>Panel Cajero</h1>
            <p>Registra visitas de tus clientes</p>
          </div>
          <button id="btn-logout" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
        </div>
      </div>
      <div class="search-box">
        <input type="tel" id="telefono" placeholder="Buscar por teléfono..." />
        <button id="buscar">Buscar</button>
      </div>
      <div id="resultado"></div>
    </div>
  `
}

export function initCajero() {
  document.getElementById('btn-logout').addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  document.getElementById('buscar').addEventListener('click', async () => {
    const telefono = document.getElementById('telefono').value.trim()
    if (!telefono) return

    const resultado = document.getElementById('resultado')
    resultado.innerHTML = `<p style="text-align:center;color:#666">Buscando...</p>`

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .single()

    if (!data) {
      resultado.innerHTML = `
        <div class="cliente-card">
          <p class="error" style="margin-bottom:12px">Cliente no encontrado</p>
          <button class="btn-registrar" id="btn-nuevo">+ Registrar cliente nuevo</button>
        </div>
      `
      document.getElementById('btn-nuevo').addEventListener('click', () => {
        navigate('registro', telefono)
      })
      return
    }

    mostrarCliente(data)
  })
}

function mostrarCliente(data) {
  const pct = Math.min(Math.round(((data.puntos_actuales % META_PUNTOS) / META_PUNTOS) * 100), 100)
  const resultado = document.getElementById('resultado')

  resultado.innerHTML = `
    <div class="cliente-card">
      <h2>${data.nombre || 'Cliente'}</h2>
      <div class="cliente-info">
        <div class="stat">
          <div class="stat-label">Puntos</div>
          <div class="stat-value">${data.puntos_actuales}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Visitas</div>
          <div class="stat-value">${data.total_visitas}</div>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Progreso al premio</span>
          <span>${data.puntos_actuales % META_PUNTOS}/${META_PUNTOS}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>
      <button class="btn-registrar" id="registrar">+ Registrar visita</button>
      <div id="msg"></div>
    </div>
  `

  document.getElementById('registrar').addEventListener('click', async () => {
    await supabase.from('visitas').insert({
      cliente_id: data.id,
      negocio_id: data.negocio_id,
      puntos_sumados: 1
    })

    const nuevosPuntos = data.puntos_actuales + 1
    const nuevasVisitas = data.total_visitas + 1

    await supabase.from('clientes').update({
      puntos_actuales: nuevosPuntos,
      total_visitas: nuevasVisitas
    }).eq('id', data.id)

    data.puntos_actuales = nuevosPuntos
    data.total_visitas = nuevasVisitas

    const msg = document.getElementById('msg')
    if (nuevosPuntos % META_PUNTOS === 0) {
      msg.innerHTML = `<div class="premio-alert">🎉 ¡Premio desbloqueado! Entrega el café gratis.</div>`
    } else {
      msg.innerHTML = `<div class="exito">✓ Visita registrada. Faltan ${META_PUNTOS - (nuevosPuntos % META_PUNTOS)} para el premio.</div>`
    }

    mostrarCliente(data)
  })
}

// ─── PÁGINA REGISTRO ─────────────────────────────────────
export function paginaRegistro(telefono = '') {
  return `
    <div class="container">
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
  `
}

export function initRegistro() {
  document.getElementById('guardar').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre').value.trim()
    const telefono = document.getElementById('tel').value.trim()

    if (!nombre || !telefono) {
      document.getElementById('msg').innerHTML = `<p class="error">Llena todos los campos</p>`
      return
    }

    const { data: negocio } = await supabase
      .from('negocios')
      .select('id')
      .single()

    const { error } = await supabase.from('clientes').insert({
      nombre,
      telefono,
      negocio_id: negocio?.id,
      puntos_actuales: 0,
      total_visitas: 0
    })

    if (error) {
      document.getElementById('msg').innerHTML = `<p class="error">Error al guardar</p>`
      return
    }

    document.getElementById('msg').innerHTML = `<div class="exito">✓ Cliente registrado</div>`
    setTimeout(() => navigate('cajero'), 1500)
  })
}

// ─── PÁGINA ADMIN ─────────────────────────────────────────
export async function paginaAdmin() {
  const { data: negocios } = await supabase.from('negocios').select('*')
  const { data: clientes } = await supabase.from('clientes').select('*')
  const { data: visitas } = await supabase.from('visitas').select('*')

  const filas = (negocios || []).map(n => {
    const clientesNegocio = (clientes || []).filter(c => c.negocio_id === n.id).length
    const visitasNegocio = (visitas || []).filter(v => v.negocio_id === n.id).length
    return `
      <div class="negocio-row">
        <div>
          <div class="negocio-nombre">${n.nombre}</div>
          <div class="negocio-meta">${n.email}</div>
        </div>
        <div class="negocio-stats">
          <span>${clientesNegocio} clientes</span>
          <span>${visitasNegocio} visitas</span>
          <span class="badge ${n.activo ? 'activo' : 'inactivo'}">${n.activo ? 'Activo' : 'Inactivo'}</span>
        </div>
      </div>
    `
  }).join('')

  return `
    <div class="container">
      <div class="header">
        <h1>Panel Admin</h1>
        <p>Gestiona tus negocios</p>
      </div>
      <div class="cliente-card">
        <div class="admin-stats">
          <div class="stat">
            <div class="stat-label">Negocios</div>
            <div class="stat-value">${(negocios || []).length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Clientes</div>
            <div class="stat-value">${(clientes || []).length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Visitas</div>
            <div class="stat-value">${(visitas || []).length}</div>
          </div>
        </div>
        <h3 style="margin:16px 0 10px;font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Negocios registrados</h3>
        ${filas || '<p style="color:#666;text-align:center">No hay negocios aún</p>'}
      </div>
    </div>
  `
}

// ─── PÁGINA CLIENTE ───────────────────────────────────────
export async function paginaCliente(telefono) {
  const { data } = await supabase
    .from('clientes')
    .select('*, negocios(nombre)')
    .eq('telefono', telefono)
    .single()

  if (!data) {
    return `
      <div class="container">
        <div class="header">
          <h1>No encontrado</h1>
          <p>Este cliente no está registrado</p>
        </div>
      </div>
    `
  }

  const pct = Math.min(Math.round(((data.puntos_actuales % META_PUNTOS) / META_PUNTOS) * 100), 100)
  const faltan = META_PUNTOS - (data.puntos_actuales % META_PUNTOS)

  return `
    <div class="container">
      <div class="header">
        <h1>${data.negocios?.nombre || 'Programa de Lealtad'}</h1>
        <p>Hola, ${data.nombre || 'Cliente'} 👋</p>
      </div>
      <div class="cliente-card">
        <div class="cliente-info">
          <div class="stat">
            <div class="stat-label">Puntos</div>
            <div class="stat-value">${data.puntos_actuales}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Visitas</div>
            <div class="stat-value">${data.total_visitas}</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label">
            <span>Progreso al premio</span>
            <span>${data.puntos_actuales % META_PUNTOS}/${META_PUNTOS}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="exito" style="text-align:center">
          ${faltan === META_PUNTOS ? '🎉 ¡Tienes un premio disponible!' : `Te faltan <strong>${faltan} visitas</strong> para tu próximo premio`}
        </div>
      </div>
      <div class="cliente-card" style="margin-top:12px">
        <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Tu código QR</h3>
        <div style="text-align:center">
          <div id="qrcode" style="display:inline-block"></div>
          <p style="font-size:12px;color:#666;margin-top:8px">Muéstralo al cajero para sumar puntos</p>
        </div>
      </div>
    </div>
  `
}

export function initCliente(telefono) {
  const qrDiv = document.getElementById('qrcode')
  if (qrDiv) {
    QRCode.toCanvas(document.createElement('canvas'),
      `${window.location.origin}/#/cliente/${telefono}`,
      { width: 180, margin: 1 },
      (err, canvas) => {
        if (!err) qrDiv.appendChild(canvas)
      }
    )
  }
}
// ─── PÁGINA QR DEL NEGOCIO ────────────────────────────────
export async function paginaQRNegocio(negocioId) {
  const { data: negocio } = await supabase
    .from('negocios')
    .select('*')
    .eq('id', negocioId)
    .single()

  if (!negocio) {
    return `
      <div class="container">
        <div class="header">
          <h1>No encontrado</h1>
          <p>Este negocio no existe</p>
        </div>
      </div>
    `
  }

  return `
    <div class="container">
      <div class="header" style="text-align:center">
        <h1>${negocio.nombre}</h1>
        <p>Programa de lealtad</p>
      </div>
      <div class="cliente-card" style="text-align:center">
        <p style="font-size:15px;margin-bottom:16px">Escribe tu número para ver tus puntos o registrarte</p>
        <div class="search-box" style="margin-bottom:0">
          <input type="tel" id="tel-negocio" placeholder="Tu número de teléfono" />
          <button id="btn-entrar">Entrar</button>
        </div>
        <div id="msg-negocio"></div>
      </div>
    </div>
  `
}

export function initQRNegocio(negocioId) {
  document.getElementById('btn-entrar').addEventListener('click', async () => {
    const telefono = document.getElementById('tel-negocio').value.trim()
    if (!telefono) return

    const msg = document.getElementById('msg-negocio')
    msg.innerHTML = `<p style="text-align:center;color:#666;margin-top:12px">Buscando...</p>`

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefono', telefono)
      .eq('negocio_id', negocioId)
      .single()

    if (data) {
      navigate('cliente', telefono)
    } else {
      navigate('registro-cliente', `${negocioId}/${telefono}`)
    }
  })
}

// ─── REGISTRO DESDE QR ────────────────────────────────────
export function paginaRegistroCliente(negocioId, telefono) {
  return `
    <div class="container">
      <div class="header">
        <h1>Bienvenido</h1>
        <p>Regístrate para acumular puntos</p>
      </div>
      <div class="cliente-card">
        <div class="form-group">
          <label>Tu nombre</label>
          <input type="text" id="nombre-cliente" placeholder="¿Cómo te llamas?" />
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="tel" id="tel-cliente" value="${telefono}" readonly style="background:#f0f4f8" />
        </div>
        <button class="btn-registrar" id="btn-registrar-cliente" style="margin-top:8px">Registrarme</button>
        <div id="msg-registro"></div>
      </div>
    </div>
  `
}

export function initRegistroCliente(negocioId, telefono) {
  document.getElementById('btn-registrar-cliente').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-cliente').value.trim()
    if (!nombre) {
      document.getElementById('msg-registro').innerHTML = `<p class="error">Escribe tu nombre</p>`
      return
    }

    const { error } = await supabase.from('clientes').insert({
      nombre,
      telefono,
      negocio_id: negocioId,
      puntos_actuales: 0,
      total_visitas: 0
    })

    if (error) {
      document.getElementById('msg-registro').innerHTML = `<p class="error">Error al registrar</p>`
      return
    }

    navigate('cliente', telefono)
  })
}
