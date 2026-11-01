import { htmlToDocx } from '../lib/htmlToDocx'
import { htmlToPdf } from '../lib/htmlToPdf'
import { readAsText, baseName } from '../lib/download'
import { wrapDocHtml } from '../lib/markdownStyle'
import type { ConvertContext } from '../types'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** TXT → Markdown：启发式识别标题、列表、引用 */
function txtToMarkdown(text: string): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed) {
      out.push('')
      continue
    }
    if (/^#{1,6}\s/.test(trimmed) || /^[-*+]\s/.test(trimmed) || /^\d+[.、]\s/.test(trimmed) || /^>/.test(trimmed)) {
      out.push(trimmed)
      continue
    }
    const next = (lines[i + 1] ?? '').trim()
    // 短行 + 下一行空白 + 不以句读结尾 → 视为标题
    if (trimmed.length <= 30 && !next && !/[。，；！？,.;!?：:]$/.test(trimmed)) {
      out.push('## ' + trimmed)
      continue
    }
    out.push(trimmed)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** TXT → HTML：按空行分段 */
function txtToHtml(text: string): string {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
}

export async function textConverter(ctx: ConvertContext, to: string) {
  const text = await readAsText(ctx.file)
  const name = baseName(ctx.file.name)

  if (to === 'markdown') {
    const md = txtToMarkdown(text)
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename: name + '.md', previewText: md, previewType: 'text' as const }
  }
  if (to === 'html') {
    const html = txtToHtml(text)
    return { blob: new Blob([wrapDocHtml(html)], { type: 'text/html;charset=utf-8' }), filename: name + '.html', previewHtml: html, previewType: 'html' as const }
  }
  if (to === 'pdf') {
    const blob = await htmlToPdf(txtToHtml(text))
    return { blob, filename: name + '.pdf', previewType: 'none' as const }
  }
  if (to === 'docx') {
    const blob = await htmlToDocx(txtToHtml(text), name)
    return { blob, filename: name + '.docx', previewHtml: txtToHtml(text), previewType: 'html' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}
