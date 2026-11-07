// Edge Function: crear-mesero
// El dueño da de alta, cambia la contraseña o desactiva a sus meseros.
//
// Acciones (POST, cuerpo JSON):
//   { accion: 'crear', nombre, correo }      → { usuario_id, nombre, correo, contrasena }
//   { accion: 'nueva_contrasena', usuario_id } → { usuario_id, nombre, correo, contrasena }
//   { accion: 'desactivar', usuario_id }       → { usuario_id, desactivado: true }
// Errores: estado 4xx/5xx con { error: 'CODIGO', mensaje: 'texto en español' }.
//
// Seguridad:
//   - Valida el JWT de quien llama contra Supabase Auth y exige que sea dueño
//     (role = 'owner') y esté activo. El negocio SIEMPRE sale de su perfil,
//     nunca de un parámetro.
//   - Solo crea meseros (alta_mesero inserta role = 'mesero'); nunca dueños.
//   - Solo toca meseros de SU negocio; un id ajeno responde "no encontrado".
//   - La llave service_role viene solo de las variables de entorno que
//     Supabase pone en la función (SUPABASE_SERVICE_ROLE_KEY). No está en el
//     repo ni llega al navegador.
//   - Las contraseñas nunca se registran en logs. La respuesta va con
//     Cache-Control: no-store.
import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

// ── Contraseña ──
// Sin caracteres que se confunden al dictarla o copiarla: 0 O o, 1 l I i.
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghjkmnpqrstuvwxyz'
const DIGITOS = '23456789'
const ALFABETO = MAYUSCULAS + MINUSCULAS + DIGITOS

// 12 caracteres al azar (≈ 69 bits) en 3 grupos de 4: "Kx7m-Qp4t-Wz9r".
// Siempre lleva mayúscula, minúscula y número, por si el proyecto exige
// contraseñas fuertes.
function generarContrasena(): string {
  const limite = 256 - (256 % ALFABETO.length) // evita sesgo (muestreo con rechazo)
  for (;;) {
    const elegidos: string[] = []
    while (elegidos.length < 12) {
      const bytes = crypto.getRandomValues(new Uint8Array(32))
      for (const b of bytes) {
        if (b < limite && elegidos.length < 12) elegidos.push(ALFABETO[b % ALFABETO.length])
      }
    }
    const texto = elegidos.join('')
    const tieneTodo = [MAYUSCULAS, MINUSCULAS, DIGITOS].every(grupo => [...texto].some(c => grupo.includes(c)))
    if (tieneTodo) return `${texto.slice(0, 4)}-${texto.slice(4, 8)}-${texto.slice(8, 12)}`
  }
}

// ── Validaciones ──
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// "  ana   maría " → "ana maría". Sin caracteres de control. Máximo 30.
function limpiarNombre(valor: unknown): string | null {
  const nombre = String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return nombre && nombre.length <= 30 ? nombre : null
}

// ── Respuestas ──
const MENSAJES: Record<string, string> = {
  SIN_SESION: 'Tu sesión ya no es válida. Sal y vuelve a entrar.',
  ACCESO_DENEGADO: 'Solo el dueño del negocio puede administrar el equipo.',
  NEGOCIO_INACTIVO: 'El negocio está desactivado.',
  PETICION_INVALIDA: 'No entendimos la petición. Intenta de nuevo.',
  NOMBRE_INVALIDO: 'Escribe el nombre del mesero (máximo 30 letras).',
  CORREO_INVALIDO: 'Revisa el correo: no parece válido.',
  CORREO_EN_USO: 'Ese correo ya tiene una cuenta en Sello. Usa otro.',
  LIMITE_MESEROS: 'Ya tienes 10 meseros activos. Desactiva a uno para agregar otro.',
  MESERO_NO_ENCONTRADO: 'Ese mesero ya no está en tu equipo.',
  MESERO_DESACTIVADO: 'Ese mesero está desactivado.',
  YA_TIENE_PERFIL: 'Esa cuenta ya pertenece a un negocio.',
  METODO_NO_PERMITIDO: 'Método no permitido.',
  CONFIGURACION: 'El servidor no está bien configurado. Avísale a Sello.',
  ERROR_INTERNO: 'Algo salió mal. Intenta de nuevo.',
}

// CORS: si se define ORIGENES_PERMITIDOS (separados por coma), solo esos
// sitios pueden llamar la función desde el navegador. Si no, cualquiera
// (igual necesita la sesión de un dueño).
function encabezadosCors(req: Request): Record<string, string> {
  const permitidos = (Deno.env.get('ORIGENES_PERMITIDOS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const origen = req.headers.get('Origin') ?? ''
  const permitido = permitidos.length === 0 ? '*' : permitidos.includes(origen) ? origen : permitidos[0]
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const cors = encabezadosCors(req)
  const responder = (estado: number, cuerpo: Record<string, unknown>) =>
    new Response(JSON.stringify(cuerpo), {
      status: estado,
      headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  const fallar = (estado: number, codigo: string) =>
    responder(estado, { error: codigo, mensaje: MENSAJES[codigo] ?? MENSAJES.ERROR_INTERNO })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return fallar(405, 'METODO_NO_PERMITIDO')

  try {
    const url = Deno.env.get('SUPABASE_URL')
    const llaveServicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !llaveServicio) {
      console.error('crear-mesero: faltan variables de entorno de Supabase')
      return fallar(500, 'CONFIGURACION')
    }

    // 1. ¿Quién llama? Se valida su JWT con Supabase Auth.
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return fallar(401, 'SIN_SESION')

    const admin = createClient(url, llaveServicio, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })

    const { data: datosUsuario, error: errorUsuario } = await admin.auth.getUser(jwt)
    const usuario = datosUsuario?.user
    if (errorUsuario || !usuario) return fallar(401, 'SIN_SESION')

    // 2. Debe ser dueño activo. El negocio sale de SU perfil.
    const { data: perfil, error: errorPerfil } = await admin
      .from('profiles')
      .select('user_id, negocio_id, role, activo')
      .eq('user_id', usuario.id)
      .maybeSingle()
    if (errorPerfil) throw errorPerfil
    if (!perfil || perfil.role !== 'owner' || perfil.activo === false) return fallar(403, 'ACCESO_DENEGADO')

    const { data: negocio, error: errorNegocio } = await admin
      .from('negocios')
      .select('id, activo')
      .eq('id', perfil.negocio_id)
      .maybeSingle()
    if (errorNegocio) throw errorNegocio
    if (!negocio || negocio.activo !== true) return fallar(403, 'NEGOCIO_INACTIVO')

    let cuerpo: Record<string, unknown>
    try { cuerpo = await req.json() } catch { return fallar(400, 'PETICION_INVALIDA') }

    // Un mesero de ESTE negocio (nunca un dueño ni alguien de otro negocio).
    async function buscarMesero(id: unknown) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) return null
      const { data, error } = await admin
        .from('profiles')
        .select('user_id, nombre, activo')
        .eq('user_id', id)
        .eq('negocio_id', perfil!.negocio_id)
        .eq('role', 'mesero')
        .maybeSingle()
      if (error) throw error
      return data
    }

    // ── crear ──
    if (cuerpo.accion === 'crear') {
      const nombre = limpiarNombre(cuerpo.nombre)
      if (!nombre) return fallar(400, 'NOMBRE_INVALIDO')
      const correo = String(cuerpo.correo ?? '').trim().toLowerCase()
      if (correo.length > 254 || !CORREO_RE.test(correo)) return fallar(400, 'CORREO_INVALIDO')

      // Revisión rápida del límite; la definitiva la hace alta_mesero con bloqueo.
      const { count, error: errorConteo } = await admin
        .from('profiles')
        .select('user_id', { count: 'exact', head: true })
        .eq('negocio_id', perfil.negocio_id)
        .eq('role', 'mesero')
        .eq('activo', true)
      if (errorConteo) throw errorConteo
      if ((count ?? 0) >= 10) return fallar(409, 'LIMITE_MESEROS')

      const contrasena = generarContrasena()
      const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true, // entra de inmediato, sin correo de confirmación
        user_metadata: { nombre },
      })
      if (errorCrear || !creado?.user) {
        const texto = `${errorCrear?.code ?? ''} ${errorCrear?.message ?? ''}`
        if (/email_exists|already (been )?registered|already exists/i.test(texto)) return fallar(409, 'CORREO_EN_USO')
        if (/email_address_invalid|invalid.*email/i.test(texto)) return fallar(400, 'CORREO_INVALIDO')
        throw errorCrear ?? new Error('createUser sin usuario')
      }

      const { error: errorAlta } = await admin.rpc('alta_mesero', {
        p_usuario_id: creado.user.id,
        p_negocio_id: perfil.negocio_id,
        p_nombre: nombre,
      })
      if (errorAlta) {
        // Sin perfil no debe quedar una cuenta suelta: se borra.
        await admin.auth.admin.deleteUser(creado.user.id).catch(() => {
          console.error('crear-mesero: no se pudo borrar la cuenta tras un alta fallida')
        })
        const codigo = ['LIMITE_MESEROS', 'NOMBRE_INVALIDO', 'NEGOCIO_INACTIVO', 'YA_TIENE_PERFIL']
          .find(c => errorAlta.message?.includes(c))
        if (codigo) return fallar(codigo === 'NOMBRE_INVALIDO' ? 400 : 409, codigo)
        throw errorAlta
      }

      return responder(200, { usuario_id: creado.user.id, nombre, correo, contrasena })
    }

    // ── nueva_contrasena ──
    if (cuerpo.accion === 'nueva_contrasena') {
      const mesero = await buscarMesero(cuerpo.usuario_id)
      if (!mesero) return fallar(404, 'MESERO_NO_ENCONTRADO')
      if (!mesero.activo) return fallar(409, 'MESERO_DESACTIVADO')

      const contrasena = generarContrasena()
      const { data: actualizado, error } = await admin.auth.admin.updateUserById(mesero.user_id, { password: contrasena })
      if (error || !actualizado?.user) throw error ?? new Error('updateUserById sin usuario')

      return responder(200, {
        usuario_id: mesero.user_id,
        nombre: mesero.nombre ?? 'Mesero',
        correo: actualizado.user.email ?? '',
        contrasena,
      })
    }

    // ── desactivar ──
    if (cuerpo.accion === 'desactivar') {
      const mesero = await buscarMesero(cuerpo.usuario_id)
      if (!mesero) return fallar(404, 'MESERO_NO_ENCONTRADO')

      // Primero la base de datos: desde este momento ya no pasa ninguna
      // revisión (aunque tenga la sesión abierta) y sus códigos pendientes
      // se cancelan. Sus visitas se conservan.
      if (mesero.activo) {
        const { error: errorBaja } = await admin.rpc('baja_mesero', {
          p_usuario_id: mesero.user_id,
          p_negocio_id: perfil.negocio_id,
        })
        if (errorBaja) {
          if (errorBaja.message?.includes('MESERO_NO_ENCONTRADO')) return fallar(404, 'MESERO_NO_ENCONTRADO')
          throw errorBaja
        }
      }

      // Luego Auth: no puede volver a entrar ni renovar su sesión (~100 años).
      const { error: errorBloqueo } = await admin.auth.admin.updateUserById(mesero.user_id, { ban_duration: '876000h' })
      if (errorBloqueo) {
        console.error('crear-mesero: no se pudo bloquear la cuenta en Auth', errorBloqueo.code ?? '')
        return responder(200, { usuario_id: mesero.user_id, desactivado: true, bloqueo_auth: false })
      }

      return responder(200, { usuario_id: mesero.user_id, desactivado: true, bloqueo_auth: true })
    }

    return fallar(400, 'PETICION_INVALIDA')
  } catch (e) {
    // Solo el tipo de error: nunca el cuerpo, correos ni contraseñas.
    const err = e as { code?: string; name?: string }
    console.error('crear-mesero: error inesperado', err?.code ?? err?.name ?? 'desconocido')
    return fallar(500, 'ERROR_INTERNO')
  }
})
