export function getPage() {
  const hash = window.location.hash
  if (hash.startsWith('#/registro')) return 'registro'
  if (hash.startsWith('#/cliente/')) return 'cliente'
  if (hash === '#/admin') return 'admin'
  if (hash === '#/cajero') return 'cajero'
  if (hash === '#/login') return 'login'
  return 'cajero'
}

export function navigate(page, param = '') {
  if (param) {
    window.location.hash = `#/${page}/${param}`
  } else {
    window.location.hash = `#/${page}`
  }
  window.dispatchEvent(new Event('hashchange'))
}