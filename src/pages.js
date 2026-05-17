import QRCode from 'qrcode'
import { supabase } from './supabase.js'
import { navigate } from './router.js'

const META_VISITAS = 10

// ─── CONTRASEÑA MAESTRA ADMIN ─────────────────────────────
const ADMIN_PASSWORD = 'lealtad2024'

// ─── HELPER: campo de contraseña con ojo ──────────────────
function inputPassword(id, placeholder = '••••••') {
  return `
    <div style="position:relative">
      <input type="password" id="${id}" placeholder="${placeholder}"
        style="width:100%;padding:10px 40px 10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px;box-sizing:border-box" />
      <button type="button" onclick="
        var i=document.getElementById('${id}');
        var b=this;
        if(i.type==='password'){i.type='text';b.textContent='🙈';}
        else{i.type='password';b.textContent='👁';}
      " style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:16px;padding:0;line-height:1">👁</button>
    </div>
  `
}

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
          ${inputPassword('password')}
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

    if (negocio.activo === false) {
      msg.innerHTML = `<p class="error">Esta cuenta está desactivada. Contacta al administrador.</p>`
      const { logout } = await import('./auth.js')
      logout()
      return
    }

    window.location.hash = '#/dueno'
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
          <div style="display:flex;gap:8px">
            <button id="btn-ir-dueno" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">← Mi Panel</button>
            <button id="btn-logout" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
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
        <h3 style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:10px">Últimos clientes atendidos</h3>
        <div id="ultimos-clientes">
          <p style="color:#aaa;font-size:13px;text-align:center">Cargando...</p>
        </div>
      </div>
    </div>
  `
}

export function initCajero() {
  document.getElementById('btn-ir-dueno').addEventListener('click', () => navigate('dueno'))
  document.getElementById('btn-logout').addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  cargarUltimosClientes()

  document.getElementById('buscar').addEventListener('click', async () => {
    const telefono = document.getElementById('telefono').value.trim()
    if (telefono) await buscarYMostrar({ telefono })
  })

  document.getElementById('buscar-nombre').addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-buscar').value.trim()
    if (nombre) await buscarYMostrar({ nombre })
  })

  document.getElementById('telefono').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const telefono = document.getElementById('telefono').value.trim()
      if (telefono) await buscarYMostrar({ telefono })
    }
  })

  document.getElementById('nombre-buscar').addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      const nombre = document.getElementById('nombre-buscar').value.trim()
      if (nombre) await buscarYMostrar({ nombre })
    }
  })
}

async function cargarUltimosClientes() {
  const { getNegocioActual } = await import('./auth.js')
  const negocio = getNegocioActual()
  if (!negocio) return

  const { data: visitas } = await supabase
    .from('visitas')
    .select('cliente_id, fecha')
    .eq('negocio_id', negocio.id)
    .order('fecha', { ascending: false })
    .limit(20)

  if (!visitas || visitas.length === 0) {
    document.getElementById('ultimos-clientes').innerHTML =
      `<p style="color:#aaa;font-size:13px;text-align:center">Aún no hay visitas registradas</p>`
    return
  }

  const vistos = new Set()
  const clientesIds = []
  for (const v of visitas) {
    if (!vistos.has(v.cliente_id)) {
      vistos.add(v.cliente_id)
      clientesIds.push(v.cliente_id)
    }
    if (clientesIds.length >= 5) break
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, telefono, total_visitas')
    .in('id', clientesIds)

  if (!clientes || clientes.length === 0) {
    document.getElementById('ultimos-clientes').innerHTML =
      `<p style="color:#aaa;font-size:13px;text-align:center">Sin datos</p>`
    return
  }

  const ordenados = clientesIds.map(id => clientes.find(c => c.id === id)).filter(Boolean)

  const filas = ordenados.map(c => `
    <div class="negocio-row" style="cursor:pointer" data-telefono="${c.telefono}">
      <div>
        <div class="negocio-nombre">${c.nombre}</div>
        <div class="negocio-meta">${c.telefono}</div>
      </div>
      <div class="negocio-stats">
        <span style="font-size:12px;color:#666">${c.total_visitas} visitas</span>
        <span style="font-size:11px;color:#aaa">→</span>
      </div>
    </div>
  `).join('')

  document.getElementById('ultimos-clientes').innerHTML = filas

  document.querySelectorAll('#ultimos-clientes .negocio-row').forEach(row => {
    row.addEventListener('click', async () => {
      const tel = row.dataset.telefono
      document.getElementById('telefono').value = tel
      await buscarYMostrar({ telefono: tel })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })
}

async function buscarYMostrar({ telefono, nombre }) {
  const resultado = document.getElementById('resultado')
  resultado.innerHTML = `<p style="text-align:center;color:#666;padding:16px">Buscando...</p>`

  const { getNegocioActual } = await import('./auth.js')
  const negocio = getNegocioActual()

  let query = supabase.from('clientes').select('*').eq('negocio_id', negocio?.id)

  if (telefono) {
    query = query.eq('telefono', telefono)
  } else if (nombre) {
    query = query.ilike('nombre', `%${nombre}%`)
  }

  const { data } = await query

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

  if (data.length === 1) {
    mostrarCliente(data[0])
    return
  }

  const filas = data.map(c => `
    <div class="negocio-row" style="cursor:pointer" data-id="${c.id}">
      <div>
        <div class="negocio-nombre">${c.nombre}</div>
        <div class="negocio-meta">${c.telefono}</div>
      </div>
      <div class="negocio-stats">
        <span style="font-size:12px">${c.total_visitas} visitas</span>
        <span style="font-size:11px;color:#aaa">→</span>
      </div>
    </div>
  `).join('')

  resultado.innerHTML = `
    <div class="cliente-card">
      <p style="font-size:13px;color:#666;margin-bottom:10px">Se encontraron ${data.length} clientes. Selecciona uno:</p>
      ${filas}
    </div>
  `

  resultado.querySelectorAll('.negocio-row').forEach(row => {
    row.addEventListener('click', () => {
      const cliente = data.find(c => c.id === row.dataset.id)
      if (cliente) mostrarCliente(cliente)
    })
  })
}

async function mostrarCliente(data) {
  const { data: negocioData } = await supabase
    .from('negocios')
    .select('meta_puntos')
    .eq('id', data.negocio_id)
    .single()

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
    await supabase.from('visitas').insert({
      cliente_id: data.id,
      negocio_id: data.negocio_id,
      puntos_sumados: 1
    })

    const nuevasVisitas = data.total_visitas + 1
    const nuevosActuales = data.puntos_actuales + 1

    await supabase.from('clientes').update({
      puntos_actuales: nuevosActuales,
      total_visitas: nuevasVisitas
    }).eq('id', data.id)

    data.puntos_actuales = nuevosActuales
    data.total_visitas = nuevasVisitas

    const nuevoCiclo = nuevosActuales % meta
    const nuevoPct = Math.min(Math.round((nuevoCiclo / meta) * 100), 100)

    document.getElementById('visitas-display').textContent = nuevasVisitas
    document.getElementById('ciclo-display').textContent = `${nuevoCiclo}/${meta}`
    document.getElementById('progress-label').textContent = `${nuevoCiclo}/${meta}`
    document.getElementById('progress-fill').style.width = nuevoPct + '%'

    cargarUltimosClientes()

    const msg = document.getElementById('msg')
    if (nuevosActuales > 0 && nuevosActuales % meta === 0) {
      msg.innerHTML = `<div class="premio-alert">🎉 ¡Premio desbloqueado! Entrega el premio al cliente.</div>`
    } else {
      msg.innerHTML = `<div class="exito">✓ Visita registrada. Faltan ${meta - nuevoCiclo} visitas para el premio.</div>`
    }
  })
}

// ─── PÁGINA REGISTRO CAJERO ──────────────────────────────
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

    const { getNegocioActual } = await import('./auth.js')
    const negocio = getNegocioActual()

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
function isAdminAutenticado() {
  return sessionStorage.getItem('admin_auth') === 'ok'
}

export async function paginaAdmin() {
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
          <div>
            <h1>Panel Admin</h1>
            <p>Gestiona tus negocios</p>
          </div>
          <button id="btn-admin-logout" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
        </div>
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
      </div>

      <div class="cliente-card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Negocios registrados</h3>
          <button id="btn-nuevo-negocio" style="background:#667eea;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px">+ Nuevo negocio</button>
        </div>

        <div id="form-negocio" style="display:none;background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:16px">
          <div class="form-group">
            <label>Nombre del negocio</label>
            <input type="text" id="nuevo-nombre" placeholder="Ej: Café El Sol" />
          </div>
          <div class="form-group">
            <label>Correo electrónico</label>
            <input type="email" id="nuevo-email" placeholder="cafe@correo.com" />
          </div>
          <div class="form-group">
            <label>Contraseña</label>
            ${inputPassword('nuevo-password', 'Contraseña para el dueño')}
          </div>
          <button id="btn-guardar-negocio" class="btn-registrar" style="margin-top:8px">Guardar negocio</button>
          <div id="msg-negocio"></div>
        </div>

        ${filas || '<p style="color:#666;text-align:center">No hay negocios aún</p>'}
      </div>

      <canvas id="qr-canvas" style="display:none"></canvas>
    </div>
  `
}

export function initAdmin() {
  if (!isAdminAutenticado()) {
    document.getElementById('btn-admin-login')?.addEventListener('click', () => {
      const pw = document.getElementById('admin-password').value
      const msg = document.getElementById('msg-admin')
      if (pw === ADMIN_PASSWORD) {
        sessionStorage.setItem('admin_auth', 'ok')
        navigate('admin')
      } else {
        msg.innerHTML = `<p class="error">Contraseña incorrecta</p>`
      }
    })
    document.getElementById('admin-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btn-admin-login').click()
    })
    return
  }

  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth')
    navigate('admin')
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

    if (!nombre || !email || !password) {
      msg.innerHTML = `<p class="error">Llena todos los campos</p>`
      return
    }

    msg.innerHTML = `<p style="color:#666;text-align:center">Guardando...</p>`

    const { error } = await supabase.from('negocios').insert({
      nombre,
      email,
      password: password,
      password_hash: password,
      activo: true,
      meta_puntos: 10
    })

    if (error) {
      msg.innerHTML = `<p class="error">Error: ${error.message}</p>`
      return
    }

    msg.innerHTML = `<div class="exito">✓ Negocio creado correctamente</div>`
    setTimeout(() => navigate('admin'), 1500)
  })

  document.querySelectorAll('.btn-toggle-negocio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const activoActual = btn.dataset.activo === 'true'
      btn.textContent = 'Guardando...'
      btn.disabled = true
      const { error } = await supabase
        .from('negocios')
        .update({ activo: !activoActual })
        .eq('id', id)
      if (!error) navigate('admin')
    })
  })

  document.querySelectorAll('.btn-descargar-qr').forEach(btn => {
    btn.addEventListener('click', async () => {
      const negocioId = btn.dataset.id
      const negocioNombre = btn.dataset.nombre
      const url = `${window.location.origin}/#/negocio/${negocioId}`
      const canvas = document.getElementById('qr-canvas')

      await QRCode.toCanvas(canvas, url, {
        width: 400, margin: 2,
        color: { dark: '#000000', light: '#ffffff' }
      })

      const anchoOriginal = canvas.width
      const altoOriginal = canvas.height
      const canvasFinal = document.createElement('canvas')
      canvasFinal.width = anchoOriginal
      canvasFinal.height = altoOriginal + 50
      const ctxFinal = canvasFinal.getContext('2d')

      ctxFinal.fillStyle = '#ffffff'
      ctxFinal.fillRect(0, 0, canvasFinal.width, canvasFinal.height)
      ctxFinal.drawImage(canvas, 0, 0)
      ctxFinal.fillStyle = '#000000'
      ctxFinal.font = 'bold 22px Arial'
      ctxFinal.textAlign = 'center'
      ctxFinal.fillText(negocioNombre, anchoOriginal / 2, altoOriginal + 35)

      const link = document.createElement('a')
      link.download = `QR-${negocioNombre}.png`
      link.href = canvasFinal.toDataURL('image/png')
      link.click()
    })
  })
}

// ─── PÁGINA CLIENTE ───────────────────────────────────────
export async function paginaCliente(telefono) {
  const { data } = await supabase
    .from('clientes')
    .select('*, negocios(nombre, meta_puntos)')
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

  const meta = data.negocios?.meta_puntos || META_VISITAS
  const visitasEnCiclo = data.puntos_actuales % meta
  const pct = data.puntos_actuales === 0 ? 0 : Math.min(Math.round((visitasEnCiclo / meta) * 100), 100)

  let mensajeProgreso
  if (data.puntos_actuales === 0) {
    mensajeProgreso = `Empieza a visitar para acumular visitas`
  } else if (data.puntos_actuales > 0 && data.puntos_actuales % meta === 0) {
    mensajeProgreso = `🎉 ¡Tienes un premio disponible!`
  } else {
    mensajeProgreso = `Te faltan <strong>${meta - visitasEnCiclo} visitas</strong> para tu próximo premio`
  }

  return `
    <div class="container">
      <div class="header">
        <h1>${data.negocios?.nombre || 'Programa de Lealtad'}</h1>
        <p>Hola, ${data.nombre || 'Cliente'} 👋</p>
      </div>
      <div class="cliente-card">
        <div class="cliente-info">
          <div class="stat">
            <div class="stat-label">Visitas totales</div>
            <div class="stat-value">${data.total_visitas}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Para el premio</div>
            <div class="stat-value">${visitasEnCiclo}/${meta}</div>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-label">
            <span>Progreso al premio</span>
            <span>${visitasEnCiclo}/${meta}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
        </div>
        <div class="exito" style="text-align:center">${mensajeProgreso}</div>
      </div>
      <div class="cliente-card" style="margin-top:12px">
        <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Tu código QR</h3>
        <div style="text-align:center">
          <div id="qrcode" style="display:inline-block"></div>
          <p style="font-size:12px;color:#666;margin-top:8px">Muéstralo al cajero para sumar visitas</p>
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
      (err, canvas) => { if (!err) qrDiv.appendChild(canvas) }
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
        <p style="font-size:15px;margin-bottom:16px">Escribe tu número para ver tus visitas o registrarte</p>
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
        <p>Regístrate para acumular visitas</p>
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

// ─── PANEL DEL DUEÑO ──────────────────────────────────────
export async function paginaDueno() {
  const { getNegocioActual } = await import('./auth.js')
  const negocio = getNegocioActual()
  if (!negocio) {
    window.location.hash = '#/login'
    window.dispatchEvent(new Event('hashchange'))
    return '<div></div>'
  }

  const { data: negocioData } = await supabase
    .from('negocios')
    .select('*')
    .eq('id', negocio.id)
    .single()

  if (negocioData?.activo === false) {
    const { logout } = await import('./auth.js')
    logout()
    return '<div></div>'
  }

  const metaVisitas = negocioData?.meta_puntos || 10

  const { data: clientes } = await supabase
    .from('clientes').select('*').eq('negocio_id', negocio.id)

  const { data: visitas } = await supabase
    .from('visitas').select('*').eq('negocio_id', negocio.id)

  const { data: premios } = await supabase
    .from('premios').select('*').eq('negocio_id', negocio.id)

  const hoy = new Date().toISOString().split('T')[0]
  const visitasHoy = (visitas || []).filter(v => v.fecha && v.fecha.startsWith(hoy)).length

  const clientesOrdenados = [...(clientes || [])]
    .sort((a, b) => b.total_visitas - a.total_visitas)
    .slice(0, 5)

  const filasClientes = clientesOrdenados.map(c => `
    <div class="negocio-row">
      <div>
        <div class="negocio-nombre">${c.nombre}</div>
        <div class="negocio-meta">${c.telefono}</div>
      </div>
      <div class="negocio-stats">
        <span>${c.total_visitas} visitas</span>
      </div>
    </div>
  `).join('')

  const filasPremios = (premios || []).map(p => `
    <div class="negocio-row">
      <div>
        <div class="negocio-nombre">${p.nombre}</div>
        <div class="negocio-meta">Se gana a las ${p.puntos_requeridos} visitas</div>
      </div>
      <div class="negocio-stats">
        <span class="badge ${p.activo ? 'activo' : 'inactivo'}">${p.activo ? 'Activo' : 'Inactivo'}</span>
        <button class="btn-toggle-premio" data-id="${p.id}" data-activo="${p.activo}"
          style="background:#f0f4f8;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px">
          ${p.activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  `).join('')

  return `
    <div class="container">
      <div class="header">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <h1>${negocioData?.nombre || negocio.nombre}</h1>
            <p>Panel del dueño</p>
          </div>
          <div style="display:flex;gap:8px">
            <button id="btn-ir-cajero" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">🧾 Cajero</button>
            <button id="btn-logout-dueno" style="background:rgba(255,255,255,0.2);border:none;color:white;padding:8px 12px;border-radius:8px;cursor:pointer;font-size:13px">Salir</button>
          </div>
        </div>
      </div>

      <div class="cliente-card">
        <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Resumen</h3>
        <div class="admin-stats">
          <div class="stat">
            <div class="stat-label">Clientes</div>
            <div class="stat-value">${(clientes || []).length}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Visitas hoy</div>
            <div class="stat-value">${visitasHoy}</div>
          </div>
          <div class="stat">
            <div class="stat-label">Total visitas</div>
            <div class="stat-value">${(visitas || []).length}</div>
          </div>
        </div>
      </div>

      <div class="cliente-card" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em">Premios</h3>
          <button id="btn-nuevo-premio" style="background:#667eea;color:white;border:none;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px">+ Nuevo premio</button>
        </div>
        <p style="font-size:12px;color:#aaa;margin-bottom:12px">Las visitas necesarias para ganar se configuran por premio</p>

        <div id="form-premio" style="display:none;background:#f8fafc;padding:16px;border-radius:10px;margin-bottom:12px">
          <div class="form-group">
            <label>Nombre del premio</label>
            <input type="text" id="nombre-premio" placeholder="Ej: Café gratis, Descuento 20%..." />
          </div>
          <div class="form-group">
            <label>¿A cuántas visitas se gana?</label>
            <input type="number" id="visitas-premio" value="${metaVisitas}" min="1" />
          </div>
          <button id="btn-guardar-premio" class="btn-registrar" style="margin-top:8px">Guardar premio</button>
          <div id="msg-premio"></div>
        </div>

        <div id="lista-premios">
          ${filasPremios || '<p style="color:#666;text-align:center;font-size:14px">No hay premios configurados aún</p>'}
        </div>
      </div>

      <div class="cliente-card" style="margin-top:12px;margin-bottom:24px">
        <h3 style="font-size:14px;color:#666;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px">Clientes más frecuentes</h3>
        ${filasClientes || '<p style="color:#666;text-align:center;font-size:14px">Aún no hay clientes registrados</p>'}
      </div>
    </div>
  `
}

export function initDueno(negocioId) {
  document.getElementById('btn-ir-cajero')?.addEventListener('click', () => navigate('cajero'))

  document.getElementById('btn-logout-dueno')?.addEventListener('click', async () => {
    const { logout } = await import('./auth.js')
    logout()
  })

  document.getElementById('btn-nuevo-premio')?.addEventListener('click', () => {
    const form = document.getElementById('form-premio')
    form.style.display = form.style.display === 'none' ? 'block' : 'none'
  })

  document.getElementById('btn-guardar-premio')?.addEventListener('click', async () => {
    const nombre = document.getElementById('nombre-premio').value.trim()
    const visitas = parseInt(document.getElementById('visitas-premio').value)
    const msg = document.getElementById('msg-premio')

    if (!nombre || !visitas || visitas < 1) {
      msg.innerHTML = `<p class="error">Llena todos los campos correctamente</p>`
      return
    }

    const { error } = await supabase.from('premios').insert({
      negocio_id: negocioId,
      nombre,
      puntos_requeridos: visitas,
      activo: true
    })

    if (error) {
      msg.innerHTML = `<p class="error">Error al guardar el premio</p>`
      return
    }

    msg.innerHTML = `<div class="exito">✓ Premio creado</div>`
    setTimeout(() => navigate('dueno'), 1000)
  })

  document.querySelectorAll('.btn-toggle-premio').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      const activoActual = btn.dataset.activo === 'true'
      const { error } = await supabase
        .from('premios')
        .update({ activo: !activoActual })
        .eq('id', id)
      if (!error) navigate('dueno')
    })
  })
}