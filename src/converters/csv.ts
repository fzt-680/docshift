import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { readAsText, baseName } from '../lib/download'
import { arrayToHtmlTable, TABLE_CSS } from './excel'
import type { ConvertContext } from '../types'

const CSV_TABLE_CSS = `<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1f2329}table{border-collapse:collapse;width:100%;font-size:14px}th,td{border:1px solid #dfe2e5;padding:6px 10px;text-align:left}th{background:#f0f3ff}</style>`

/** 二维数组 → Markdown 表格 */
function arrayToMarkdown(rows: unknown[][]): string {
  if (!rows.length) return ''
  const fmt = (v: unknown) => String(v ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
  const head = rows[0].map(fmt)
  const lines = ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |']
  rows.slice(1).forEach((r) => lines.push('| ' + r.map(fmt).join(' | ') + ' |'))
  return lines.join('\n')
}

export async function csvConverter(ctx: ConvertContext, to: string) {
  const text = await readAsText(ctx.file)
  const name = baseName(ctx.file.name)
  const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false })

  if (to === 'json') {
    const out = JSON.stringify(parsed.data, null, 2)
    return { blob: new Blob([out], { type: 'application/json;charset=utf-8' }), filename: name + '.json', previewText: out, previewType: 'text' as const }
  }
  if (to === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(parsed.data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: name + '.xlsx', previewType: 'none' as const }
  }
  if (to === 'html') {
    const rows = [parsed.meta.fields ?? Object.keys(parsed.data[0] ?? {}), ...parsed.data.map((r) => parsed.meta.fields!.map((f) => r[f]))] as unknown[][]
    const table = arrayToHtmlTable(rows, name)
    return {
      blob: new Blob([`<!doctype html><html><head><meta charset="utf-8">${TABLE_CSS}</head><body>${table}</body></html>`], { type: 'text/html;charset=utf-8' }),
      filename: name + '.html',
      previewHtml: table,
      previewType: 'html' as const,
    }
  }
  if (to === 'markdown') {
    const fields = parsed.meta.fields ?? Object.keys(parsed.data[0] ?? {})
    const rows = [fields, ...parsed.data.map((r) => fields.map((f) => r[f]))] as unknown[][]
    const md = '# ' + name + '\n\n' + arrayToMarkdown(rows)
    return { blob: new Blob([md], { type: 'text/markdown;charset=utf-8' }), filename: name + '.md', previewText: md, previewType: 'text' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}

export { arrayToMarkdown }
