import { supabase } from './supabase.js'

export async function login(email, password) {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (authError || !authData?.user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      user_id,
      role,
      negocio_id,
      negocios:negocio_id (
        id,
        nombre,
        email,
        password_hash,
        password,
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

  localStorage.setItem('negocio', JSON.stringify(profile.negocios))
  return profile.negocios
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
