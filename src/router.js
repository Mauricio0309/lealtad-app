export function getPage() {
  const hash = window.location.hash
  if (hash.startsWith('#/registro-cliente/')) return 'registro-cliente'
  if (hash.startsWith('#/negocio/')) return 'negocio'
  if (hash.startsWith('#/registro')) return 'registro'
  if (hash.startsWith('#/cliente/')) return 'cliente'
  if (hash.startsWith('#/landing/')) return 'landing'
  if (hash.startsWith('#/onboarding')) return 'onboarding'
  if (hash.startsWith('#/kiosko')) return 'kiosko'
  if (hash === '#/admin') return 'admin'
  if (hash === '#/cajero') return 'cajero'
  if (hash === '#/login') return 'login'
  if (hash === '#/dueno') return 'dueno'
  if (hash === '#/bienvenida') return 'bienvenida'
  return 'login'
}

export function navigate(page, param = '') {
  if (param) {
    window.location.hash = `#/${page}/${param}`
  } else {
    window.location.hash = `#/${page}`
  }
  window.dispatchEvent(new Event('hashchange'))
}