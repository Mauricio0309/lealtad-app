import { supabase } from './supabase.js'
import { isAuthRetryableFetchError } from '@supabase/supabase-js'

// Marca local de "esta sesión es de un administrador de Sello" (5A). Solo
// sirve para saber a qué pantalla mandar; quién es admin lo decide el
// servidor (es_admin y las funciones admin_*).
const CLAVE_ADMIN = 'sello_admin'

// Copia local del último perfil leído del servidor (rol, negocio, activo).
// Sirve para que un error de red al abrir la app NO se confunda con "no hay
// sesión": el mesero entra a su pantalla (que ya funciona sin internet) y
// todo se vuelve a comprobar con el servidor en cuanto hay señal.
const CLAVE_PERFIL = 'sello_perfil'

// Columnas del negocio que guarda la app (las mismas que trae el login).
const COLUMNAS_NEGOCIO = 'id, nombre, activo, meta_puntos, color_principal, emoji_negocio, descripcion'

function leerJSON(clave) {
  try { const t = localStorage.getItem(clave); return t ? JSON.parse(t) : null } catch (e) { return null }
}
function guardarJSON(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)) } catch (e) {}
}
function borrar(clave) {
  try { localStorage.removeItem(clave) } catch (e) {}
}

function guardarPerfilLocal(p) {
  guardarJSON(CLAVE_PERFIL, {
    user_id: p.user_id, negocio_id: p.negocio_id, role: p.role,
    activo: p.activo !== false, nombre: p.nombre ?? null,
  })
}

// ¿El error es de red (sin señal, servidor que no responde) y no un "no"?
function esErrorDeRed(e) {
  if (!e) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  try { if (isAuthRetryableFetchError(e)) return true } catch (err) {}
  return /Failed to fetch|NetworkError|Load failed|fetch|network|timeout/i.test(`${e.name || ''} ${e.message || ''}`)
}

export async function login(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  // Cuenta desactivada por el dueño: Auth la tiene bloqueada (Fase 4C).
  if (authError && (authError.code === 'user_banned' || /banned/i.test(authError.message || ''))) {
    return { desactivado: true }
  }
  if (authError || !authData?.user) return null

  // "*" en vez de columnas sueltas: funciona antes y después de que exista
  // profiles.activo (fase-4c.sql).
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`*, negocios:negocio_id (${COLUMNAS_NEGOCIO})`)
    .eq('user_id', authData.user.id)
    .maybeSingle()

  // Sin negocio: puede ser un administrador de Sello (5A).
  if (!profileError && !profile && await esAdmin()) {
    marcarAdmin(true)
    return { admin: true }
  }

  if (profileError || !profile || !profile.negocios) return null
  if (profile.activo === false) {
    await supabase.auth.signOut().catch(() => {})
    return { desactivado: true }
  }

  const { negocios, ...perfil } = profile
  guardarPerfilLocal(perfil)
  guardarJSON('negocio', negocios)
  return negocios
}

// Lee la sesión guardada en el celular y el perfil, sin cerrar NADA.
// Devuelve { estado, perfil?, desdeCopia? }:
//   'ok'          hay sesión y perfil (del servidor o, sin red, de la copia local)
//   'sin_sesion'  de verdad no hay sesión en este celular → pantalla de entrar
//   'sin_perfil'  hay sesión pero la cuenta no tiene negocio (p. ej. un admin)
//   'sin_red'     no se pudo comprobar y no hay copia local → "Sin conexión"
export async function leerAcceso() {
  const conCopia = () => {
    const perfil = leerJSON(CLAVE_PERFIL)
    return perfil ? { estado: 'ok', perfil, desdeCopia: true } : { estado: 'sin_red' }
  }

  // getSession lee el almacenamiento local y, si el token caducó, lo renueva.
  // Si la renovación falla por red, supabase-js conserva la sesión guardada.
  let sesion = null
  try {
    const { data, error } = await supabase.auth.getSession()
    sesion = data?.session || null
    if (!sesion) {
      if (error && esErrorDeRed(error)) return conCopia()
      return { estado: 'sin_sesion' }
    }
  } catch (e) {
    return conCopia()
  }

  try {
    const { data: perfil, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', sesion.user.id)
      .maybeSingle()
    if (error) {
      // Error de red o de permiso: NO es "sin sesión". Se sigue con la copia.
      return conCopia()
    }
    if (!perfil) {
      return { estado: 'sin_perfil' }
    }
    guardarPerfilLocal(perfil)

    // Si falta (o es de otro negocio) la copia del negocio, se repone: las
    // pantallas del mesero y del dueño la necesitan.
    const negocio = getNegocioActual()
    if (!negocio || negocio.id !== perfil.negocio_id) {
      const { data: nd } = await supabase
        .from('negocios').select(COLUMNAS_NEGOCIO).eq('id', perfil.negocio_id).maybeSingle()
      if (nd) guardarJSON('negocio', nd)
    }

    return { estado: 'ok', perfil }
  } catch (e) {
    return conCopia()
  }
}

// Perfil del servidor (o de la copia local si no hay red); null si no hay.
export async function getPerfilActual() {
  const acceso = await leerAcceso()
  return acceso.estado === 'ok' ? acceso.perfil : null
}

// ¿Quien tiene la sesión es administrador de Sello? Lo responde el servidor
// (es_admin). Ante cualquier error: no.
export async function esAdmin() {
  try {
    const { data, error } = await supabase.rpc('es_admin')
    return !error && data === true
  } catch (e) {
    return false
  }
}

export function marcarAdmin(si) {
  try { si ? localStorage.setItem(CLAVE_ADMIN, '1') : localStorage.removeItem(CLAVE_ADMIN) } catch (e) {}
}

// Único lugar donde la app cierra la sesión: "Salir", cuenta o negocio
// desactivado. Nunca por un error de red.
export async function logout() {
  await supabase.auth.signOut().catch(() => {})
  borrar('negocio')
  borrar(CLAVE_PERFIL)
  marcarAdmin(false)
  window.location.hash = '#/login'
  window.dispatchEvent(new Event('hashchange'))
}

export function getNegocioActual() {
  return leerJSON('negocio')
}

export function isLoggedIn() {
  let admin = false
  try { admin = localStorage.getItem(CLAVE_ADMIN) === '1' } catch (e) {}
  return !!getNegocioActual() || admin
}
