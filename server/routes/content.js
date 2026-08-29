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

/*
  To giay luon trang, ke ca khi portal dang o che do toi. Phan lon file tai len
  (bao cao, ban xuat tu Word) gia dinh chu den tren nen trang va chi dat mau cho
  mot vai phan -- ep chung sang nen toi la thanh khong doc noi.

  Toan bo selector duoi day deu o muc the (specificity 0,0,1). File tai len chi can
  mot class hay mot thuoc tinh style la de len duoc -- style rieng cua file luon thang.
*/
const RESET_STYLE = `<style id="__portal_reset">
  html { -webkit-text-size-adjust: 100%; }
  html, body { margin: 0; padding: 0; background: #ffffff; }
  body {
    color: #33333d;
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.75;
    letter-spacing: -0.006em;
    padding: 34px 36px 56px;
    box-sizing: border-box;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  h1, h2, h3, h4, h5, h6 {
    color: #15151a;
    font-weight: 640;
    letter-spacing: -0.021em;
    line-height: 1.3;
    /* scroll-margin de tieu de khong bi thanh cong cu che khi nhay tu muc luc. */
    scroll-margin-top: 24px;
  }
  h1 { font-size: 28px; margin: 0 0 16px; }
  h2 { font-size: 20px; margin: 32px 0 10px; }
  h3 { font-size: 16.5px; margin: 24px 0 8px; }
  h4, h5, h6 { font-size: 15px; margin: 20px 0 6px; }

  p { margin: 0 0 14px; }
  ul, ol { margin: 0 0 14px; padding-left: 22px; }
  li { margin-bottom: 5px; }
  li > ul, li > ol { margin-top: 5px; }

  a { color: #4f46e5; text-decoration-thickness: 1px; text-underline-offset: 2px; }

  strong, b { font-weight: 620; color: #15151a; }

  blockquote {
    margin: 0 0 16px;
    padding: 12px 16px;
    border-left: 3px solid #c7cbff;
    background: #f7f7ff;
    border-radius: 0 6px 6px 0;
  }
  blockquote p:last-child { margin-bottom: 0; }

  hr { border: 0; border-top: 1px solid #e7e7ec; margin: 28px 0; }

  table {
    border-collapse: collapse;
    max-width: 100%;
    margin: 0 0 16px;
    font-size: 14px;
  }
  th {
    text-align: left;
    padding: 8px 12px;
    background: #f7f7f9;
    border-bottom: 1px solid #e7e7ec;
    font-weight: 600;
    font-size: 12.5px;
    color: #63636e;
  }
  td { padding: 8px 12px; border-bottom: 1px solid #f0f0f4; vertical-align: top; }

  code, kbd, samp {
    font-family: 'JetBrains Mono', ui-monospace, Consolas, monospace;
    font-size: 0.88em;
    background: #f4f4f6;
    padding: 1.5px 5px;
    border-radius: 4px;
    color: #15151a;
  }
  pre {
    overflow-x: auto;
    background: #f7f7f9;
    border: 1px solid #e7e7ec;
    border-radius: 8px;
    padding: 14px 16px;
    margin: 0 0 16px;
  }
  pre code { background: none; padding: 0; font-size: 13px; }

  img, video, canvas, svg, iframe { max-width: 100%; height: auto; }
  figure { margin: 0 0 16px; }
  figcaption { font-size: 13px; color: #63636e; margin-top: 6px; }
</style>`

/*
  Hai viec ma trang cha khong tu lam duoc vi iframe nam o origin rieng:

  1. Bao chieu cao -- iframe khong tu co gian theo noi dung, khong bao thi sinh ra
     thanh cuon long trong thanh cuon.
  2. Bao danh sach tieu de kem vi tri -- de dung cot "Trong trang nay" ben phai.

  Danh so cap tieu de theo cap NHO NHAT thuc su co trong file, thay vi mac dinh h2
  la cap mot: ban xuat tu Word hay dung h1 cho de muc lon, file khac lai dung h2.
*/
const HEIGHT_BRIDGE = `<script id="__portal_bridge">
(function () {
  function measure() {
    var b = document.body, e = document.documentElement;
    return Math.max(
      b ? b.scrollHeight : 0, b ? b.offsetHeight : 0,
      e ? e.scrollHeight : 0, e ? e.offsetHeight : 0
    );
  }

  function slugify(text, index) {
    var s = String(text || '')
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return s ? 'muc-' + s : 'muc-' + index;
  }

  function absoluteTop(el) {
    var top = 0;
    while (el) { top += el.offsetTop; el = el.offsetParent; }
    return top;
  }

  var outline = [];
  function buildOutline() {
    var nodes = document.querySelectorAll('h1, h2, h3');
    var found = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!text) continue;
      if (!el.id) el.id = slugify(text, i);
      found.push({ el: el, id: el.id, text: text, tag: Number(el.tagName.slice(1)) });
    }
    if (found.length < 2) { outline = []; return; }

    var min = Math.min.apply(null, found.map(function (h) { return h.tag; }));
    outline = found.map(function (h) {
      return { id: h.id, text: h.text, level: Math.min(h.tag - min + 1, 3), el: h.el };
    });
  }

  var lastHeight = 0, lastOutline = '';
  function post() {
    var h = measure();
    if (h !== lastHeight) {
      lastHeight = h;
      parent.postMessage({ __portal: 'height', height: h }, '*');
    }

    var items = outline.map(function (h) {
      return { id: h.id, text: h.text, level: h.level, top: absoluteTop(h.el) };
    });
    var signature = JSON.stringify(items);
    if (signature !== lastOutline) {
      lastOutline = signature;
      parent.postMessage({ __portal: 'outline', items: items }, '*');
    }
  }

  function refresh() { buildOutline(); post(); }

  document.addEventListener('DOMContentLoaded', refresh);
  window.addEventListener('load', refresh);
  window.addEventListener('resize', post);
  if (window.ResizeObserver) {
    new ResizeObserver(post).observe(document.documentElement);
  }
  // Anh va webfont tai xong muon van lam noi dung cao them.
  setInterval(post, 500);
  refresh();
})();
</script>`

/*
  Trang tu do chieu cao theo khung nhin thay vi theo noi dung cua no
  (`height:100vh`, hoac `html/body { height:100% }`) khong the nam trong khung tu
  keo cao duoc: khung do trang, trang do khung, ket qua la ket o chieu cao toi thieu.
  Nhung trang nhu vay phai chiem tron vung ben phai.

  Day chi la phong doan cho lan tai len dau tien -- admin doi lai duoc trong form.
*/
const VIEWPORT_HEIGHT = /height\s*:\s*100vh/i
const FULL_HEIGHT_ROOT = /\b(?:html|body)\b[^{]{0,80}\{[^}]{0,400}height\s*:\s*100%/i

export function looksLikeApp(html) {
  // Style thuong nam gan dau file; khong quet ca file vi ban tai len co the rat lon.
  const head = String(html).slice(0, 100000)
  return VIEWPORT_HEIGHT.test(head) || FULL_HEIGHT_ROOT.test(head)
}

export function errorPage(message) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">${RESET_STYLE}</head>
<body><p style="color:#96969f">${message}</p></body></html>`
}

/**
 * Chen style vao dau tai lieu va script vao cuoi.
 * Style phai dung truoc de style rieng cua file van de len duoc no.
 */
export function injectIntoHtml(html, mode = 'document') {
  // Trang tu lo bo cuc thi tra nguyen ven: khung da chiem tron vung ben phai nen
  // khong can do chieu cao, va moi dong CSS chen them chi lam hong bo cuc cua no.
  if (mode === 'app') return html

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
    html: injectIntoHtml(raw, node.display_mode || 'document'),
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
    // khong chi an khoi menu. Admin xem truoc qua /api/admin/nodes/:id/content.
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
