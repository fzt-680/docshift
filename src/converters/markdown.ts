import { marked } from 'marked'
import { htmlToDocx } from '../lib/htmlToDocx'
import { htmlToPdf } from '../lib/htmlToPdf'
import { readAsText, baseName } from '../lib/download'
import type { ConvertContext } from '../types'

marked.setOptions({ gfm: true, breaks: true })

/** HTML → 纯文本 */
export function htmlToText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  // 块级元素后补换行
  div.querySelectorAll('p,div,li,tr,h1,h2,h3,h4,h5,h6,blockquote,pre,br').forEach((el) => {
    el.append(document.createTextNode('\n'))
  })
  return (div.textContent || '').replace(/\n{3,}/g, '\n\n').trim()
}

export async function markdownConverter(ctx: ConvertContext, to: string) {
  const md = await readAsText(ctx.file)
  const html = marked.parse(md, { async: false }) as string
  const name = baseName(ctx.file.name)

  if (to === 'html') {
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: name + '.html', previewHtml: html, previewType: 'html' as const }
  }
  if (to === 'txt') {
    return { blob: new Blob([htmlToText(html)], { type: 'text/plain;charset=utf-8' }), filename: name + '.txt', previewText: htmlToText(html), previewType: 'text' as const }
  }
  if (to === 'pdf') {
    const blob = await htmlToPdf(html)
    return { blob, filename: name + '.pdf', previewType: 'none' as const }
  }
  if (to === 'docx') {
    const blob = await htmlToDocx(html, name)
    return { blob, filename: name + '.docx', previewHtml: html, previewType: 'html' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}
