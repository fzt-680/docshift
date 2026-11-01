import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { readAsArrayBuffer, baseName } from '../lib/download'
import type { ConvertContext } from '../types'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

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
  await pdf.destroy()
  const full = pages.join('\n\n')

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
