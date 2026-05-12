import { supabase } from './supabase.js'

export async function login(email, password) {
  const { data, error } = await supabase
    .from('negocios')
    .select('*')
    .eq('email', email)
    .eq('password_hash', password)
    .single()

  if (error || !data) return null

  localStorage.setItem('negocio', JSON.stringify(data))
  return data
}

export function logout() {
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
