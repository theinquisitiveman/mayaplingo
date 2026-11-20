// Draws the parol (star lantern) app icon as PNGs (no image tooling needed).
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

function crc32(buf) {
  let c, crc = ~0
  for (const b of buf) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c }
  return ~crc >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  // Five-point star (the parol mascot) on green.
  const pts = []
  for (let k = 0; k < 10; k++) {
    const r = (k % 2 ? 0.19 : 0.42) * size, a = -Math.PI / 2 + (k * Math.PI) / 5
    pts.push([size / 2 + r * Math.cos(a), size * 0.52 + r * Math.sin(a)])
  }
  const inside = (x, y) => {
    let c = false
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    for (let x = 0; x < size; x++) {
      const eye = [[0.43, 0.5], [0.57, 0.5]].some(([ex, ey]) => Math.hypot(x - ex * size, y - ey * size) < size * 0.03)
      const [r, g, b] = eye ? [75, 75, 75] : inside(x, y) ? [255, 200, 0] : [88, 204, 2]
      const o = y * (size * 3 + 1) + 1 + x * 3
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
for (const [name, size] of [['icon-192', 192], ['icon-512', 512], ['apple-touch-icon', 180]]) {
  writeFileSync(new URL(`../public/icons/${name}.png`, import.meta.url), png(size))
}
console.log('icons written')
