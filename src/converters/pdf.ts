import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import PptxGenJS from 'pptxgenjs'
import { marked } from 'marked'
import * as XLSX from 'xlsx'
import { readAsArrayBuffer, baseName } from '../lib/download'
import { htmlToDocx } from '../lib/htmlToDocx'
import type { ConvertContext } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

marked.setOptions({ gfm: true, breaks: true })

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

interface PdfItem {
  str: string
  x: number
  width: number
}

interface PdfLine {
  text: string
  size: number
  bold: boolean
  page: number
  items: PdfItem[]
}

const NOTE_MD =
  '\n\n---\n\n> 本文档由 DocShift 从 PDF 启发式提取生成：标题按字号推断、列表按符号识别，**表格与复杂排版无法从 PDF 还原**，关键内容请对照原 PDF 核对。\n'

/** 从 PDF 提取带元数据的行（字号 / 粗体 / 页码 / 字符坐标） */
async function extractLines(pdf: pdfjsLib.PDFDocumentProxy): Promise<PdfLine[]> {
  const lines: PdfLine[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    let curItems: PdfItem[] = []
    let curSize = 0
    let curBold = false
    const flush = () => {
      const text = curItems.map((i) => i.str).join('').trim()
      if (text) lines.push({ text, size: curSize, bold: curBold, page: p, items: curItems })
      curItems = []
      curSize = 0
      curBold = false
    }
    tc.items.forEach((item) => {
      if (!('str' in item)) return
      const it = item as { str: string; transform: number[]; fontName?: string; hasEOL?: boolean; width: number }
      const size = Math.hypot(it.transform[2] ?? 0, it.transform[3] ?? 0)
      if (it.str.trim() === '') {
        if (it.hasEOL) flush()
        return
      }
      curItems.push({ str: it.str, x: it.transform[4] ?? 0, width: it.width ?? 0 })
      curSize = Math.max(curSize, size)
      curBold = curBold || /bold|heavy|black/i.test(it.fontName ?? '')
      if (it.hasEOL) flush()
    })
    flush()
  }
  return lines
}

/** 众数字号 = 正文字号 */
function bodyFontSize(lines: PdfLine[]): number {
  const freq = new Map<number, number>()
  lines.forEach((l) => {
    if (l.size > 0) freq.set(l.size, (freq.get(l.size) ?? 0) + 1)
  })
  let best = 12
  let bestCount = 0
  freq.forEach((count, size) => {
    if (count > bestCount) {
      best = size
      bestCount = count
    }
  })
  return best
}

const LIST_BULLET = /^[•·▪◦◦●○\-–—*]\s+/
const LIST_NUMBER = /^\d+\s*[.、)]\s+/

/** PDF 行 → Markdown（启发式） */
export function linesToMarkdown(lines: PdfLine[]): string {
  const body = bodyFontSize(lines)
  const out: string[] = []
  let paraBuf: string[] = []
  let lastPage = 1

  const flushPara = () => {
    if (paraBuf.length) {
      out.push(paraBuf.join(' '))
      paraBuf = []
    }
  }
  const pushBlock = (line: string) => {
    flushPara()
    out.push(line)
  }

  lines.forEach((l) => {
    if (l.page !== lastPage) {
      flushPara()
      out.push('', '---', '')
      lastPage = l.page
    }
    const t = l.text
    const rel = body > 0 ? l.size / body : 1

    if (rel >= 1.6 && t.length <= 30) return pushBlock('# ' + t)
    if (rel >= 1.3 && t.length <= 35) return pushBlock('## ' + t)
    if (rel >= 1.15 && t.length <= 40) return pushBlock('### ' + t)
    if (l.bold && t.length <= 25) return pushBlock('#### ' + t)
    const bullet = LIST_BULLET.exec(t)
    if (bullet) return pushBlock('- ' + t.slice(bullet[0].length))
    const num = LIST_NUMBER.exec(t)
    if (num) return pushBlock('1. ' + t.slice(num[0].length))
    paraBuf.push(t)
  })
  flushPara()

  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + NOTE_MD
}

/** PDF 行 → Excel：按字符 x 坐标的间隔聚类分列（对列对齐的 PDF 有效，复杂表格无法还原） */
function linesToExcel(lines: PdfLine[]): XLSX.WorkBook {
  const GAP = 14 // 列间隔阈值（pt）
  const rows: string[][] = []
  lines.forEach((l) => {
    const cols: string[] = []
    let cur = ''
    let curRight = -Infinity
    l.items.forEach((it) => {
      if (cur && it.x - curRight > GAP) {
        cols.push(cur.trim())
        cur = ''
      }
      cur += it.str
      curRight = it.x + it.width
    })
    cols.push(cur.trim())
    while (cols.length && !cols[cols.length - 1]) cols.pop()
    if (cols.length) rows.push(cols)
  })
  const maxCols = rows.reduce((m, r) => Math.max(m, r.length), 1)
  const aoa = rows.map((r) => {
    const row = new Array(maxCols).fill('')
    r.forEach((c, i) => (row[i] = c))
    return row
  })
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const note = XLSX.utils.aoa_to_sheet([
    ['说明'],
    ['本表由 DocShift 从 PDF 按文字坐标聚类生成（启发式）。'],
    ['对列对齐规整的 PDF 效果较好；复杂表格、合并单元格无法还原，请对照原 PDF 核对。'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '提取内容')
  XLSX.utils.book_append_sheet(wb, note, '说明')
  return wb
}

/** PDF 行 → PPT：Markdown 标题分页，段落/列表转要点 */
async function linesToPptx(lines: PdfLine[], docName: string): Promise<Blob> {
  const md = linesToMarkdown(lines).replace(/\n\n---\n\n>[\s\S]*$/, '')
  const tokens = marked.lexer(md) as unknown as Record<string, unknown>[]
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = docName

  const INK = '1F2329'
  const SUB = '6B7280'
  const ACCENT = '4F6EF7'

  let slide: PptxGenJS.Slide | null = null
  let bullets: { text: string; options: { bullet: boolean; fontSize?: number } }[] = []
  let hasTitle = false

  const flush = () => {
    if (!slide) return
    if (bullets.length) {
      slide.addText(bullets.map((b) => ({ text: b.text, options: { fontSize: 16, color: INK, ...b.options } })), {
        x: 0.7,
        y: 1.6,
        w: 8.6,
        h: 4.6,
        lineSpacingMultiple: 1.4,
        valign: 'top',
      })
      bullets = []
    }
  }
  const newSlide = (title: string, kicker?: string) => {
    flush()
    slide = pptx.addSlide()
    hasTitle = true
    slide.addText(title, { x: 0.7, y: 0.55, w: 8.6, h: 0.9, fontSize: 30, bold: true, color: INK })
    if (kicker) slide.addText(kicker, { x: 0.7, y: 1.35, w: 8.6, h: 0.3, fontSize: 12, color: SUB })
    slide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.45, w: 0.9, h: 0.05, fill: { color: ACCENT } })
  }

  tokens.forEach((tok) => {
    const type = tok.type as string
    if (type === 'heading') {
      const depth = tok.depth as number
      const text = String(tok.text ?? '')
      if (depth <= 2) {
        newSlide(text)
      } else if (slide) {
        bullets.push({ text, options: { bullet: false, fontSize: 18 } })
      }
      return
    }
    if (type === 'list') {
      const items = (tok.items as { text?: string }[]) ?? []
      items.forEach((it) => bullets.push({ text: String(it.text ?? ''), options: { bullet: true } }))
      return
    }
    if (type === 'paragraph' || type === 'text') {
      bullets.push({ text: String(tok.text ?? ''), options: { bullet: false } })
      return
    }
    if (type === 'hr' || type === 'space') return
  })

  if (!hasTitle) newSlide(docName)
  flush()

  // 说明尾页
  const noteSlide = pptx.addSlide()
  noteSlide.addText('关于本文档', { x: 0.7, y: 0.55, w: 8.6, h: 0.9, fontSize: 30, bold: true, color: INK })
  noteSlide.addShape(pptx.ShapeType.rect, { x: 0.7, y: 1.45, w: 0.9, h: 0.05, fill: { color: ACCENT } })
  noteSlide.addText(
    [
      { text: '本演示文稿由 DocShift 从 PDF 启发式转换生成', options: { bullet: true, fontSize: 16, color: INK } },
      { text: '标题按字号推断、列表按符号识别', options: { bullet: true, fontSize: 16, color: INK } },
      { text: '表格与复杂排版无法从 PDF 还原，关键内容请对照原 PDF 核对', options: { bullet: true, fontSize: 16, color: INK } },
    ],
    { x: 0.7, y: 1.8, w: 8.6, h: 3, lineSpacingMultiple: 1.5, valign: 'top' },
  )

  const blob = (await pptx.write({ outputType: 'blob' })) as Blob
  return blob
}

export async function pdfConverter(ctx: ConvertContext, to: string) {
  const buf = await readAsArrayBuffer(ctx.file)
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const name = baseName(ctx.file.name)
  const pages: string[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    ctx.onProgress?.(Math.round((i / pdf.numPages) * 90))
    const page = await pdf.getPage(i)
    const tc = await page.getTextContent()
    let text = ''
    tc.items.forEach((item) => {
      if ('str' in item) {
        text += item.str
        if ((item as { hasEOL?: boolean }).hasEOL) text += '\n'
      }
    })
    pages.push(text.replace(/\n{3,}/g, '\n\n').trim())
  }
  const full = pages.join('\n\n')
  ctx.onProgress?.(95)

  /* ---- 结构化输出（需要行元数据） ---- */
  if (to === 'markdown' || to === 'docx' || to === 'xlsx' || to === 'pptx') {
    const lines = await extractLines(pdf)
    await pdf.destroy()

    if (to === 'markdown') {
      const md = linesToMarkdown(lines)
      return {
        blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }),
        filename: name + '.md',
        previewText: md,
        previewType: 'text' as const,
      }
    }
    if (to === 'docx') {
      const md = linesToMarkdown(lines)
      const html = marked.parse(md.replace(/\n\n---\n\n>[\s\S]*$/, ''), { async: false }) as string
      const blob = await htmlToDocx(html, name)
      return { blob, filename: name + '.docx', previewHtml: html, previewType: 'html' as const }
    }
    if (to === 'xlsx') {
      const wb = linesToExcel(lines)
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      return {
        blob: new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        filename: name + '.xlsx',
        previewType: 'none' as const,
      }
    }
    if (to === 'pptx') {
      const blob = await linesToPptx(lines, name)
      return { blob, filename: name + '.pptx', previewType: 'none' as const }
    }
  }

  await pdf.destroy()

  /* ---- 文本级输出 ---- */
  if (to === 'txt') {
    return {
      blob: new Blob([full], { type: 'text/plain;charset=utf-8' }),
      filename: name + '.txt',
      previewText: full,
      previewType: 'text' as const,
    }
  }
  if (to === 'html') {
    const html = pages
      .map((p, i) => `<section class="pdf-page"><h2>第 ${i + 1} 页</h2>${p.split(/\n{2,}/).map((para) => `<p>${escapeHtml(para)}</p>`).join('')}</section>`)
      .join('')
    return {
      blob: new Blob([`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:760px;margin:24px auto;padding:0 16px;line-height:1.8;color:#1f2329}.pdf-page{margin-bottom:40px}.pdf-page h2{font-size:15px;color:#6b7280;border-bottom:1px solid #e5e7eb;padding-bottom:6px}</style></head><body>${html}</body></html>`], { type: 'text/html;charset=utf-8' }),
      filename: name + '.html',
      previewHtml: html,
      previewType: 'html' as const,
    }
  }
  throw new Error('不支持的目标格式: ' + to)
}
