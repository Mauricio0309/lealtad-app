export function getPage() {
  const hash = window.location.hash
  if (hash.startsWith('#/c/')) return 'reclamar'
  if (hash.startsWith('#/tarjeta/')) return 'tarjeta'
  if (hash.startsWith('#/negocio/')) return 'negocio'
  if (hash.startsWith('#/landing/')) return 'landing'
  if (hash.startsWith('#/onboarding')) return 'onboarding'
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