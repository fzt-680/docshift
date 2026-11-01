import TurndownService from 'turndown'
import { htmlToPdf } from '../lib/htmlToPdf'
import { readAsText, baseName } from '../lib/download'
import { htmlToText } from './markdown'
import type { ConvertContext } from '../types'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })

/** 若为完整 HTML 文档，只取 body 内容 */
function extractBody(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,link,meta').forEach((el) => el.remove())
  return doc.body.innerHTML
}

export async function htmlConverter(ctx: ConvertContext, to: string) {
  const raw = await readAsText(ctx.file)
  const body = extractBody(raw)
  const name = baseName(ctx.file.name)

  if (to === 'markdown') {
    const md = turndown.turndown(body)
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename: name + '.md', previewText: md, previewType: 'text' as const }
  }
  if (to === 'txt') {
    const text = htmlToText(body)
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: name + '.txt', previewText: text, previewType: 'text' as const }
  }
  if (to === 'pdf') {
    const blob = await htmlToPdf(body)
    return { blob, filename: name + '.pdf', previewType: 'none' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}
