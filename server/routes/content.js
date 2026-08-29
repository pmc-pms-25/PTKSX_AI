import { Router } from 'express'
import fs from 'node:fs'
import { getNodeBySlug, isChainActive } from '../db.js'
import { resolveContentFile } from '../paths.js'

/**
 * Noi dung duoc nap vao <iframe sandbox>, khong phai nhet thang vao DOM cua portal.
 * File tai len co the chua <script>, CSS toan cuc, hay `* { }` -- nhet vao DOM la
 * pha vo layout portal ngay. Sandbox cho script trong file van chay binh thuong
 * nhung o mot origin rieng, khong cham duoc vao portal.
 */

// Nen trang luon la giay trang chu khong doi mau theo theme cua portal.
// Phan lon file tai len (bao cao, ban xuat tu Word) gia dinh chu den tren nen trang
// va chi dat mau cho mot vai phan -- ep chung sang nen toi la thanh khong doc noi.
// Portal bu lai bang cach dong khung noi dung nhu mot to giay, ke ca o dark mode.
const RESET_STYLE = `<style id="__portal_reset">
  html { -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: #18181b;
    font-family: system-ui, "Segoe UI", Roboto, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.7;
    padding: 32px 36px 48px;
    box-sizing: border-box;
    overflow-x: hidden;
  }
  img, video, canvas, svg, iframe { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  pre { overflow-x: auto; }
  a { color: #2563eb; }
</style>`

// Iframe khong tu bao chieu cao cua no, va file tai len thi khong co san doan ma nay.
// Server chen vao de trang cha biet ma keo cao iframe -- nho vay khong co thanh cuon long nhau.
const HEIGHT_BRIDGE = `<script id="__portal_bridge">
(function () {
  function measure() {
    var b = document.body, e = document.documentElement;
    return Math.max(
      b ? b.scrollHeight : 0, b ? b.offsetHeight : 0,
      e ? e.scrollHeight : 0, e ? e.offsetHeight : 0
    );
  }
  var last = 0;
  function post() {
    var h = measure();
    if (h === last) return;
    last = h;
    parent.postMessage({ __portal: 'height', height: h }, '*');
  }
  document.addEventListener('DOMContentLoaded', post);
  window.addEventListener('load', post);
  window.addEventListener('resize', post);
  if (window.ResizeObserver) {
    new ResizeObserver(post).observe(document.documentElement);
  }
  // Anh va webfont tai xong muon van lam noi dung cao them.
  setInterval(post, 500);
  post();
})();
</script>`

export function errorPage(message) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">${RESET_STYLE}</head>
<body><p style="color:#71717a">${message}</p></body></html>`
}

/**
 * Chen style vao dau tai lieu va script vao cuoi.
 * Style phai dung truoc de style rieng cua file van de len duoc no.
 */
export function injectIntoHtml(html) {
  let out = html

  const headOpen = out.match(/<head[^>]*>/i)
  if (headOpen) {
    const at = headOpen.index + headOpen[0].length
    out = out.slice(0, at) + RESET_STYLE + out.slice(at)
  } else {
    out = RESET_STYLE + out
  }

  const bodyClose = out.search(/<\/body\s*>/i)
  if (bodyClose !== -1) {
    out = out.slice(0, bodyClose) + HEIGHT_BRIDGE + out.slice(bodyClose)
  } else {
    out += HEIGHT_BRIDGE
  }

  return out
}

/**
 * Doc file cua mot node va chen san style + script.
 * Dung chung cho ca duong cong khai lan duong xem truoc trong admin.
 */
export function loadContentHtml(node) {
  if (!node.content_file) {
    return { status: 404, html: errorPage('Trang nay chua co noi dung.') }
  }

  const full = resolveContentFile(node.content_file)
  if (!full) {
    return { status: 400, html: errorPage('Duong dan file khong hop le.') }
  }

  let raw
  try {
    raw = fs.readFileSync(full, 'utf8')
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        status: 404,
        html: errorPage('File noi dung khong con tren dia. Hay tai len lai.'),
      }
    }
    throw err
  }

  return {
    status: 200,
    html: injectIntoHtml(raw),
    // File tu khai bao bang ma thi de no tu quyet dinh -- header co charset se de len
    // meta cua file, va ban xuat tu Word thuong la windows-1252 chu khong phai utf-8.
    declaresCharset: /<meta[^>]+charset/i.test(raw),
  }
}

export function contentRoutes(db) {
  const router = Router()

  router.get('/content/:slug', (req, res) => {
    const node = getNodeBySlug(db, req.params.slug)

    if (!node || node.type !== 'item') {
      return res.status(404).type('html').send(errorPage('Khong tim thay trang nay.'))
    }
    // Tat mot muc (hoac thu muc chua no) phai chan luon ca duong dan truc tiep,
    // khong chi an khoi menu. Admin xem truoc qua /api/admin/nodes/:id/raw.
    if (!isChainActive(db, node)) {
      return res
        .status(404)
        .type('html')
        .send(errorPage('Trang nay hien khong duoc cong khai.'))
    }

    const result = loadContentHtml(node)

    res.setHeader(
      'Content-Type',
      result.declaresCharset ? 'text/html' : 'text/html; charset=utf-8',
    )
    res.setHeader('X-Content-Type-Options', 'nosniff')
    // Tai len file moi la phai thay ngay, khong duoc an ban cu trong cache.
    res.setHeader('Cache-Control', 'no-store')

    res.status(result.status).send(result.html)
  })

  return router
}
