// Edge Function: crear-negocio (Fase 5A)
// El administrador de Sello da de alta un negocio piloto con su cuenta de dueño.
//
// POST, cuerpo JSON:
//   { nombre, correo }  → { negocio_id, nombre, correo, contrasena }
// Errores: estado 4xx/5xx con { error: 'CODIGO', mensaje: 'texto en español' }.
//
// Seguridad:
//   - Valida el JWT de quien llama contra Supabase Auth y exige que esté en
//     la tabla admins (se lee con service_role; nadie más puede leerla).
//     alta_negocio lo vuelve a comprobar en la base de datos.
//   - La llave service_role viene solo de las variables de entorno que
//     Supabase pone en la función (SUPABASE_SERVICE_ROLE_KEY). No está en el
//     repo ni llega al navegador, y nunca se escribe en logs.
//   - Crea la cuenta Auth del dueño y luego llama alta_negocio (negocio +
//     perfil owner). Si eso falla, borra la cuenta recién creada.
//   - La contraseña temporal se devuelve UNA vez y nunca se registra en logs.
//     La respuesta va con Cache-Control: no-store.
import { createClient } from 'npm:@supabase/supabase-js@2.105.4'

// ── Contraseña temporal (misma receta que crear-mesero) ──
// Sin caracteres que se confunden al dictarla o copiarla: 0 O o, 1 l I i.
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULAS = 'abcdefghjkmnpqrstuvwxyz'
const DIGITOS = '23456789'
const ALFABETO = MAYUSCULAS + MINUSCULAS + DIGITOS

// 12 caracteres al azar (≈ 69 bits) en 3 grupos de 4: "Kx7m-Qp4t-Wz9r".
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

// ── Validaciones (las mismas que alta_negocio en supabase/fase-5a.sql) ──
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// "  Café   La Esquina " → "Café La Esquina". Sin caracteres de control. 2 a 60.
function limpiarNombre(valor: unknown): string | null {
  const nombre = String(valor ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return nombre.length >= 2 && nombre.length <= 60 ? nombre : null
}

function limpiarCorreo(valor: unknown): string | null {
  const correo = String(valor ?? '').trim().toLowerCase()
  return correo.length <= 254 && CORREO_RE.test(correo) ? correo : null
}

// ── Respuestas ──
const MENSAJES: Record<string, string> = {
  SIN_SESION: 'Tu sesión ya no es válida. Sal y vuelve a entrar.',
  ACCESO_DENEGADO: 'Solo un administrador de Sello puede crear negocios.',
  PETICION_INVALIDA: 'No entendimos la petición. Intenta de nuevo.',
  NOMBRE_INVALIDO: 'Escribe el nombre del negocio (de 2 a 60 letras).',
  CORREO_INVALIDO: 'Revisa el correo: no parece válido.',
  CORREO_EN_USO: 'Ese correo ya tiene una cuenta en Sello. Usa otro.',
  YA_TIENE_PERFIL: 'Esa cuenta ya pertenece a un negocio.',
  METODO_NO_PERMITIDO: 'Método no permitido.',
  CONFIGURACION: 'El servidor no está bien configurado. Revisa la función en Supabase.',
  ERROR_INTERNO: 'Algo salió mal. Intenta de nuevo.',
}

// CORS: si se define ORIGENES_PERMITIDOS (separados por coma), solo esos
// sitios pueden llamar la función desde el navegador. Si no, cualquiera
// (igual necesita la sesión de un administrador).
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
      console.error('crear-negocio: faltan variables de entorno de Supabase')
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

    // 2. Debe estar en admins.
    const { data: filaAdmin, error: errorAdmin } = await admin
      .from('admins')
      .select('user_id')
      .eq('user_id', usuario.id)
      .maybeSingle()
    if (errorAdmin) throw errorAdmin
    if (!filaAdmin) return fallar(403, 'ACCESO_DENEGADO')

    // 3. Datos.
    let cuerpo: Record<string, unknown>
    try { cuerpo = await req.json() } catch { return fallar(400, 'PETICION_INVALIDA') }
    if (!cuerpo || typeof cuerpo !== 'object') return fallar(400, 'PETICION_INVALIDA')

    const nombre = limpiarNombre(cuerpo.nombre)
    if (!nombre) return fallar(400, 'NOMBRE_INVALIDO')
    const correo = limpiarCorreo(cuerpo.correo)
    if (!correo) return fallar(400, 'CORREO_INVALIDO')

    // Revisión rápida para no crear y borrar una cuenta en vano; la definitiva
    // (sin importar mayúsculas y con bloqueo) la hacen alta_negocio y Auth.
    const { count, error: errorConteo } = await admin
      .from('negocios')
      .select('id', { count: 'exact', head: true })
      .eq('email', correo)
    if (errorConteo) throw errorConteo
    if ((count ?? 0) > 0) return fallar(409, 'CORREO_EN_USO')

    // 4. Cuenta Auth del dueño, ya confirmada (entra de inmediato).
    const contrasena = generarContrasena()
    const { data: creado, error: errorCrear } = await admin.auth.admin.createUser({
      email: correo,
      password: contrasena,
      email_confirm: true,
    })
    if (errorCrear || !creado?.user) {
      const texto = `${errorCrear?.code ?? ''} ${errorCrear?.message ?? ''}`
      if (/email_exists|already (been )?registered|already exists/i.test(texto)) return fallar(409, 'CORREO_EN_USO')
      if (/email_address_invalid|invalid.*email/i.test(texto)) return fallar(400, 'CORREO_INVALIDO')
      throw errorCrear ?? new Error('createUser sin usuario')
    }

    // 5. Negocio + perfil owner. Si falla, no queda una cuenta suelta.
    const { data: alta, error: errorAlta } = await admin.rpc('alta_negocio', {
      p_usuario_id: creado.user.id,
      p_nombre: nombre,
      p_correo: correo,
      p_admin_id: usuario.id,
    })
    if (errorAlta || !alta?.negocio_id) {
      await admin.auth.admin.deleteUser(creado.user.id).catch(() => {
        console.error('crear-negocio: no se pudo borrar la cuenta tras un alta fallida')
      })
      const codigo = ['NOMBRE_INVALIDO', 'CORREO_INVALIDO', 'CORREO_EN_USO', 'YA_TIENE_PERFIL']
        .find(c => errorAlta?.message?.includes(c))
      if (codigo) return fallar(codigo === 'CORREO_EN_USO' || codigo === 'YA_TIENE_PERFIL' ? 409 : 400, codigo)
      if (errorAlta?.message?.includes('Acceso denegado')) return fallar(403, 'ACCESO_DENEGADO')
      throw errorAlta ?? new Error('alta_negocio sin negocio')
    }

    return responder(200, { negocio_id: alta.negocio_id, nombre: alta.nombre ?? nombre, correo, contrasena })
  } catch (e) {
    // Solo el tipo de error: nunca el cuerpo, correos ni contraseñas.
    const err = e as { code?: string; name?: string }
    console.error('crear-negocio: error inesperado', err?.code ?? err?.name ?? 'desconocido')
    return fallar(500, 'ERROR_INTERNO')
  }
})
