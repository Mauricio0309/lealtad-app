import sharp from 'sharp'
import { mkdirSync } from 'fs'

mkdirSync('./public/icons', { recursive: true })

const svg = Buffer.from(`
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#0a5c47"/>
  <circle cx="256" cy="256" r="180" stroke="white" stroke-width="20" fill="none"/>
  <circle cx="256" cy="256" r="120" stroke="white" stroke-width="16" fill="none"/>
  <path d="M180 256 L230 310 L340 196" stroke="white" stroke-width="28" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`)

await sharp(svg).resize(192, 192).png().toFile('./public/icons/icon-192.png')
console.log('✓ icon-192.png generado')

await sharp(svg).resize(512, 512).png().toFile('./public/icons/icon-512.png')
console.log('✓ icon-512.png generado')
