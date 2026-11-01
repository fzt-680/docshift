import mammoth from 'mammoth'
import TurndownService from 'turndown'
import { htmlToDocx } from '../lib/htmlToDocx'
import { htmlToPdf } from '../lib/htmlToPdf'
import { readAsArrayBuffer, baseName } from '../lib/download'
import { htmlToText } from './markdown'
import type { ConvertContext } from '../types'

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
turndown.remove(['script', 'style'])

export async function wordConverter(ctx: ConvertContext, to: string) {
  const buf = await readAsArrayBuffer(ctx.file)
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf })
  const name = baseName(ctx.file.name)

  if (to === 'html') {
    return { blob: new Blob([html], { type: 'text/html;charset=utf-8' }), filename: name + '.html', previewHtml: html, previewType: 'html' as const }
  }
  if (to === 'markdown') {
    const md = turndown.turndown(html)
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename: name + '.md', previewText: md, previewType: 'text' as const }
  }
  if (to === 'txt') {
    const text = htmlToText(html)
    return { blob: new Blob([text], { type: 'text/plain;charset=utf-8' }), filename: name + '.txt', previewText: text, previewType: 'text' as const }
  }
  if (to === 'pdf') {
    const blob = await htmlToPdf(html)
    return { blob, filename: name + '.pdf', previewType: 'none' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}

export { htmlToDocx }
