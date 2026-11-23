// Lo pesado de los logros, aparte del paquete principal: la imagen para
// compartir (canvas 1080×1920 + fuente Pacifico), el confeti y Compartir.
// pages.js lo importa con import() SOLO al abrir una celebración, antes de
// habilitar "Compartir" (así navigator.share se llama directo en el toque).
import {
  DS, esColorHex, textoSobreColor, urlLogo, textoImagenLogro, formatoNumero,
  lienzoABlob, FRASE_IMAGEN_LOGRO, inyectarEstilosDueno,
} from './pages.js'

// ── Imagen para compartir (1080×1920) ──
function cargarImagenCORS(url) {
  return new Promise(resolve => {
    if (!url) { resolve(null); return }
    const img = new Image()
    const listo = v => { resolve(v); img.onload = img.onerror = null }
    img.crossOrigin = 'anonymous'
    img.onload = () => listo(img.naturalWidth > 0 ? img : null)
    img.onerror = () => listo(null)
    setTimeout(() => listo(null), 5000)
    img.src = url
  })
}

function lineasTexto(ctx, texto, ancho) {
  const lineas = []
  let linea = ''
  for (const p of String(texto).split(/\s+/).filter(Boolean)) {
    const prueba = linea ? `${linea} ${p}` : p
    if (linea && ctx.measureText(prueba).width > ancho) { lineas.push(linea); linea = p } else linea = prueba
  }
  if (linea) lineas.push(linea)
  return lineas
}

// La frase de abajo usa UNA sola tipografía: Pacifico (public/fonts, la guarda
// el service worker). Se registra con FontFace (no depende de qué hoja de
// estilos esté puesta) y se espera document.fonts.load antes de dibujar.
// Devuelve true si quedó lista; si no (sin red y sin caché), la imagen se
// dibuja con la del sistema y NO se guarda, para reintentar la próxima vez.
const FUENTE_FRASE = 'Pacifico'
// (document.fonts.check no sirve para saberlo: da true con una familia que no
// existe. Por eso se revisa el estado de NUESTRA FontFace.)
let caraPacifico = null
let cargaPacifico = null
function esperarFuenteFrase() {
  if (!cargaPacifico) {
    cargaPacifico = (async () => {
      try {
        if (!document.fonts?.load || typeof FontFace !== 'function') return false
        if (!caraPacifico) {
          caraPacifico = new FontFace(FUENTE_FRASE, `url('${import.meta.env.BASE_URL}fonts/pacifico.woff2') format('woff2')`)
          document.fonts.add(caraPacifico)
        }
        await Promise.race([
          caraPacifico.load().then(() => document.fonts.load(`64px '${FUENTE_FRASE}'`, FRASE_IMAGEN_LOGRO)),
          new Promise(r => setTimeout(r, 4000)),
        ])
        return caraPacifico.status === 'loaded'
      } catch (e) { return false }
    })()
    cargaPacifico.then(ok => {
      if (ok) return
      // Para reintentar luego, una FontFace nueva (una que falló no se recupera).
      if (caraPacifico?.status === 'error') { document.fonts.delete(caraPacifico); caraPacifico = null }
      cargaPacifico = null
    })
  }
  return cargaPacifico
}

// LA función que dibuja la imagen (1080×1920). La usan la celebración nueva,
// su miniatura ("Vista previa") y la celebración que se abre desde Logros.
// Se genera una vez por logro y negocio; la miniatura y "Compartir" usan
// ese mismo blob.
const imagenesLogro = new Map()
export async function imagenLogro(l, marca) {
  const color = esColorHex(marca.color) ? marca.color : DS.green800
  const tinta = textoSobreColor(color)   // oscuro si el color del negocio es claro
  const logoUrl = urlLogo(marca.logoRuta)
  const texto = textoImagenLogro(l, marca.nombre)
  const clave = [l.tipo, l.hito, color, logoUrl || '', texto].join('|')
  if (imagenesLogro.has(clave)) return imagenesLogro.get(clave)

  const W = 1080, H = 1920, M = 100, ANCHO = W - 2 * M, CX = W / 2
  const lienzo = document.createElement('canvas')
  lienzo.width = W; lienzo.height = H
  const ctx = lienzo.getContext('2d')
  if (!ctx) return null
  const sistema = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, Roboto, sans-serif"
  const [logo, fuenteLista] = await Promise.all([cargarImagenCORS(logoUrl), esperarFuenteFrase()])

  function dibujar(conLogo) {
    ctx.clearRect(0, 0, W, H)
    ctx.fillStyle = color
    ctx.fillRect(0, 0, W, H)
    ctx.textAlign = 'center'
    ctx.fillStyle = tinta

    // Medidas de cada bloque para centrar todo en vertical.
    const numero = formatoNumero(l.hito)
    let tamNum = 360
    ctx.font = `800 ${tamNum}px ${sistema}`
    while (ctx.measureText(numero).width > ANCHO && tamNum > 160) { tamNum -= 10; ctx.font = `800 ${tamNum}px ${sistema}` }
    const mNum = ctx.measureText(numero)
    const subeNum = mNum.actualBoundingBoxAscent || tamNum * 0.72
    const altoNum = subeNum + (mNum.actualBoundingBoxDescent || 0)

    let tamTxt = 76
    ctx.font = `700 ${tamTxt}px ${sistema}`
    let lineasTxt = lineasTexto(ctx, texto, ANCHO)
    if (lineasTxt.length > 3) { tamTxt = 62; ctx.font = `700 ${tamTxt}px ${sistema}`; lineasTxt = lineasTexto(ctx, texto, ANCHO) }
    const lhTxt = Math.round(tamTxt * 1.2)

    const tamFrase = 64
    ctx.font = `${tamFrase}px '${FUENTE_FRASE}', ${sistema}`
    const lineasFrase = lineasTexto(ctx, FRASE_IMAGEN_LOGRO, ANCHO)
    const lhFrase = Math.round(tamFrase * 1.3)

    const LOGO = 340
    const hayLogo = conLogo && !!logo
    const total = (hayLogo ? LOGO + 80 : 0) + altoNum + 56 + lineasTxt.length * lhTxt + 70 + lineasFrase.length * lhFrase
    const arriba = M, abajo = H - M - 90   // deja lugar a "Hecho con Sello"
    let y = arriba + Math.max(0, (abajo - arriba - total) / 2)

    // Logo en círculo blanco, completo (contain) dentro del cuadrado inscrito.
    if (hayLogo) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(CX, y + LOGO / 2, LOGO / 2, 0, Math.PI * 2); ctx.fill()
      const caja = Math.floor(LOGO / Math.SQRT2) - 8
      const escala = Math.min(caja / logo.naturalWidth, caja / logo.naturalHeight)
      const w = logo.naturalWidth * escala, h = logo.naturalHeight * escala
      ctx.drawImage(logo, CX - w / 2, y + (LOGO - h) / 2, w, h)
      ctx.fillStyle = tinta
      y += LOGO + 80
    }

    ctx.textBaseline = 'alphabetic'
    ctx.font = `800 ${tamNum}px ${sistema}`
    ctx.fillText(numero, CX, y + subeNum)
    y += altoNum + 56

    ctx.textBaseline = 'top'
    ctx.font = `700 ${tamTxt}px ${sistema}`
    for (const linea of lineasTxt) { ctx.fillText(linea, CX, y); y += lhTxt }
    y += 70

    ctx.font = `${tamFrase}px '${FUENTE_FRASE}', ${sistema}`
    for (const linea of lineasFrase) { ctx.fillText(linea, CX, y); y += lhFrase }

    // Marca Sello: pequeña y discreta.
    ctx.globalAlpha = 0.9
    ctx.textBaseline = 'alphabetic'
    ctx.font = `500 32px ${sistema}`
    ctx.fillText('Hecho con Sello', CX, H - M)
    ctx.globalAlpha = 1
  }

  dibujar(true)
  let blob = await lienzoABlob(lienzo, 'image/png')
  // Si el logo no deja exportar el lienzo (CORS), se dibuja sin logo y sigue.
  if (!blob && logo) { dibujar(false); blob = await lienzoABlob(lienzo, 'image/png') }
  if (blob && fuenteLista) imagenesLogro.set(clave, blob)
  return blob
}

function descargarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nombreArchivo; a.style.display = 'none'
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// Comparte el PNG con la hoja nativa del sistema. Se llama DIRECTO desde el
// toque con el blob ya listo: navigator.share se invoca antes del primer
// await, así el navegador lo cuenta como acción del usuario (Web Share solo
// existe en HTTPS). Si no hay canShare({files}) o el navegador lo rechaza,
// abre una hoja con la imagen grande para guardarla a mano o descargarla.
// → 'compartido' | 'cancelado' | 'hoja'
export async function compartirPNG(blob, nombreArchivo, titulo) {
  let archivo = null
  try { archivo = new File([blob], nombreArchivo, { type: 'image/png' }) } catch (e) {}
  let puede = false
  try { puede = !!archivo && typeof navigator.share === 'function' && navigator.canShare?.({ files: [archivo] }) === true } catch (e) {}
  if (puede) {
    try { await navigator.share({ files: [archivo], title: titulo }); return 'compartido' }
    catch (e) { if (e?.name === 'AbortError') return 'cancelado' }
  }
  abrirHojaGuardarImagen(blob, nombreArchivo)
  return 'hoja'
}

// Hoja de respaldo: la imagen grande (mantener presionada para guardarla o
// compartirla, sobre todo en iPhone) y un botón "Descargar". Va encima de la
// celebración; Escape o "Cerrar" la cierran y el foco vuelve a donde estaba.
function abrirHojaGuardarImagen(blob, nombreArchivo) {
  inyectarEstilosDueno()
  document.querySelector('.ow-guardar')?.remove()
  const focoAntes = document.activeElement
  const url = URL.createObjectURL(blob)
  const fondo = document.createElement('div')
  fondo.className = 'ow-guardar'
  fondo.innerHTML = `<div class="ow-guardar-hoja" role="dialog" aria-modal="true" aria-labelledby="ow-guardar-texto">
    <img class="ow-guardar-img" src="${url}" alt="Imagen de tu logro">
    <p class="ow-guardar-texto" id="ow-guardar-texto">Mantén presionada la imagen para guardarla o compartirla</p>
    <button type="button" class="ow-btn primario" data-guardar="descargar">Descargar</button>
    <button type="button" class="ow-btn secundario" data-guardar="cerrar">Cerrar</button>
  </div>`
  document.body.appendChild(fondo)
  function cerrar() {
    if (!fondo.isConnected) return
    document.removeEventListener('keydown', alTeclear, true)
    window.removeEventListener('hashchange', cerrar)
    fondo.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    if (focoAntes?.isConnected) focoAntes.focus?.({ preventScroll: true })
  }
  function alTeclear(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cerrar() }
    else if (e.key === 'Tab') {
      const botones = [...fondo.querySelectorAll('button')]
      const i = botones.indexOf(document.activeElement)
      e.preventDefault(); e.stopImmediatePropagation()
      botones[(i + (e.shiftKey ? -1 : 1) + botones.length) % botones.length].focus()
    }
  }
  // En captura y registrado después del de la celebración, pero ésta lo deja
  // pasar mientras la hoja está abierta (ver alTeclear de mostrarCelebracion).
  document.addEventListener('keydown', alTeclear, true)
  window.addEventListener('hashchange', cerrar)
  fondo.querySelector('[data-guardar="descargar"]').addEventListener('click', () => descargarBlob(blob, nombreArchivo))
  fondo.querySelector('[data-guardar="cerrar"]').addEventListener('click', cerrar)
  fondo.addEventListener('click', e => { if (e.target === fondo) cerrar() })
  fondo.querySelector('[data-guardar="descargar"]').focus({ preventScroll: true })
}

// Confeti ligero (~2 s) en un canvas propio, sin librerías.
export function lanzarConfeti(lienzo) {
  const ctx = lienzo.getContext('2d')
  if (!ctx) return () => {}
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = lienzo.clientWidth, h = lienzo.clientHeight
  lienzo.width = Math.round(w * dpr); lienzo.height = Math.round(h * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const colores = ['#ffffff', '#FFD166', '#F4845F']
  const piezas = Array.from({ length: 110 }, (_, i) => ({
    x: w / 2 + (Math.random() - 0.5) * Math.min(w, 420) * 0.4,
    y: h * 0.3,
    vx: (Math.random() - 0.5) * 10,
    vy: -(Math.random() * 9 + 5),
    g: 0.2 + Math.random() * 0.1,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    an: 6 + Math.random() * 5,
    al: 9 + Math.random() * 7,
    c: colores[i % colores.length],
  }))
  const inicio = performance.now(), DURA = 2000
  let raf = 0
  function cuadro(t) {
    const p = (t - inicio) / DURA
    ctx.clearRect(0, 0, w, h)
    if (p >= 1) return
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1
    for (const q of piezas) {
      q.vy += q.g; q.vx *= 0.99; q.x += q.vx; q.y += q.vy; q.rot += q.vr
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot)
      ctx.fillStyle = q.c; ctx.fillRect(-q.an / 2, -q.al / 2, q.an, q.al)
      ctx.restore()
    }
    raf = requestAnimationFrame(cuadro)
  }
  raf = requestAnimationFrame(cuadro)
  return () => { cancelAnimationFrame(raf); ctx.clearRect(0, 0, w, h) }
}
