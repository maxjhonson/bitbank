// Generates simple amber-on-dark PNG icons without extra dependencies.
// Usage: node scripts/gen-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const BG = [0x16, 0x15, 0x1a]
const AMBER = [0xf2, 0xb3, 0x3d]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

/** Dark square with an amber "spotlight" disc and a dark inner disc (a ring), kept inside the maskable safe zone. */
function render(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  const c = size / 2
  const outer = size * 0.3
  const inner = size * 0.15
  const SS = 3 // supersampling for smooth edges
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      let amber = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const d = Math.hypot(x + (sx + 0.5) / SS - c, y + (sy + 0.5) / SS - c)
          if (d <= outer && d >= inner) amber++
        }
      const a = amber / (SS * SS)
      const o = y * (size * 3 + 1) + 1 + x * 3
      for (let i = 0; i < 3; i++) raw[o + i] = Math.round(BG[i] * (1 - a) + AMBER[i] * a)
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
mkdirSync(out, { recursive: true })
for (const size of [192, 512]) writeFileSync(join(out, `icon-${size}.png`), render(size))
console.log('wrote icons to', out)
