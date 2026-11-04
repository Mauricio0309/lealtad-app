import { supabase } from './supabase.js'

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
    .select(`
      *,
      negocios:negocio_id (
        id,
        nombre,
        activo,
        meta_puntos,
        color_principal,
        emoji_negocio,
        descripcion
      )
    `)
    .eq('user_id', authData.user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.negocios) return null
  if (profile.activo === false) {
    await supabase.auth.signOut().catch(() => {})
    return { desactivado: true }
  }

  localStorage.setItem('negocio', JSON.stringify(profile.negocios))
  return profile.negocios
}

export async function getPerfilActual() {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !profile) return null
  return profile
}

export async function logout() {
  await supabase.auth.signOut().catch(() => {})
  localStorage.removeItem('negocio')
  window.location.hash = '#/login'
  window.dispatchEvent(new Event('hashchange'))
}

export function getNegocioActual() {
  const data = localStorage.getItem('negocio')
  return data ? JSON.parse(data) : null
}

export function isLoggedIn() {
  return !!localStorage.getItem('negocio')
}
