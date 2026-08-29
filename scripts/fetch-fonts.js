/**
 * Tai font ve dong goi kem ban build.
 *
 * May tram trong mang noi bo co the khong ra duoc internet, nen khong duoc goi
 * Google Fonts luc chay. Script nay chay MOT LAN luc phat trien; ket qua nam trong
 * client/public/fonts/ va da duoc commit. Chay lai chi khi doi bo chu.
 *
 *     node scripts/fetch-fonts.js
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'client', 'public', 'fonts')
const CSS_OUT = path.join(ROOT, 'client', 'src', 'fonts.css')

// Chi giu 3 bo ky tu can dung. Bo qua cyrillic/greek cho nhe ban build.
// 'latin-ext' bat buoc phai co: chu 'd' gach ngang cua tieng Viet nam trong do.
const KEEP_SUBSETS = new Set(['latin', 'latin-ext', 'vietnamese'])

// Dung font bien thien (`wght@a..b`): mot file phuc vu moi do dam, thay vi
// mot file cho moi do dam. Voi Inter, cach nay tiet kiem khoang 400 KB.
const FAMILIES = [
  { family: 'Inter', axis: 'wght@400..700', file: 'inter' },
  { family: 'JetBrains Mono', axis: 'wght@400..500', file: 'jbmono' },
]

// Google chi tra ve woff2 khi User-Agent la trinh duyet doi moi.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Tach tung khoi @font-face kem ten subset ghi trong comment ngay truoc no. */
function parseFaces(css) {
  const faces = []
  const re = /\/\*\s*([a-z0-9-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/gi
  let m
  while ((m = re.exec(css))) {
    const block = m[2]
    // Font bien thien khai bao mot khoang ("100 900"), khong phai mot so -- giu nguyen chuoi.
    const weight = (block.match(/font-weight:\s*([^;]+);/) || [])[1]
    const url = (block.match(/url\((https:[^)]+\.woff2)\)/) || [])[1]
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1]
    if (url && range && weight) {
      faces.push({ subset: m[1], weight: weight.trim(), url, range: range.trim() })
    }
  }
  return faces
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const blocks = []
let downloaded = 0

for (const { family, axis, file } of FAMILIES) {
  const spec = `${family.replace(/ /g, '+')}:${axis}`
  const res = await fetch(`https://fonts.googleapis.com/css2?family=${spec}&display=swap`, {
    headers: { 'User-Agent': UA },
  })
  if (!res.ok) throw new Error(`${family}: HTTP ${res.status}`)

  const faces = parseFaces(await res.text()).filter((f) => KEEP_SUBSETS.has(f.subset))
  if (faces.length === 0) throw new Error(`${family}: khong tach duoc @font-face nao`)

  for (const face of faces) {
    const name = `${file}-${face.subset}.woff2`
    const bytes = Buffer.from(await (await fetch(face.url)).arrayBuffer())
    fs.writeFileSync(path.join(OUT_DIR, name), bytes)
    downloaded += bytes.length

    blocks.push(
      `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${face.weight};\n` +
        `  font-display: swap;\n` +
        `  src: url('/fonts/${name}') format('woff2');\n` +
        `  unicode-range: ${face.range};\n` +
        `}`,
    )
    console.log(`${name.padEnd(28)} ${(bytes.length / 1024).toFixed(1)} KB`)
  }
}

fs.writeFileSync(
  CSS_OUT,
  `/* File nay do scripts/fetch-fonts.js sinh ra. Dung sua tay. */\n\n${blocks.join('\n\n')}\n`,
)

console.log(`\n${blocks.length} font-face, tong ${(downloaded / 1024).toFixed(0)} KB`)
console.log(`-> ${path.relative(ROOT, CSS_OUT)}`)
