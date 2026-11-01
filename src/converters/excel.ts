import * as XLSX from 'xlsx'
import { readAsArrayBuffer, baseName } from '../lib/download'
import type { ConvertContext } from '../types'

const escapeHtml = (s: unknown) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 把二维数组转成带样式的 HTML 表格 */
function arrayToHtmlTable(rows: unknown[][], sheetName: string): string {
  if (!rows.length) return `<h2>${escapeHtml(sheetName)}</h2><p><em>（空工作表）</em></p>`
  const head = rows[0]
  const body = rows.slice(1)
  return `<h2>${escapeHtml(sheetName)}</h2><table><thead><tr>${head
    .map((c) => `<th>${escapeHtml(c ?? '')}</th>`)
    .join('')}</tr></thead><tbody>${body
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c ?? '')}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>`
}

const TABLE_CSS = `<style>body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#1f2329}table{border-collapse:collapse;width:100%;margin:12px 0 32px;font-size:14px}th,td{border:1px solid #dfe2e5;padding:6px 10px;text-align:left}th{background:#f0f3ff}h2{font-size:16px;color:#4f6ef7}</style>`

export async function excelConverter(ctx: ConvertContext, to: string) {
  const buf = await readAsArrayBuffer(ctx.file)
  const wb = XLSX.read(buf, { type: 'array' })
  const name = baseName(ctx.file.name)

  if (to === 'csv') {
    const parts = wb.SheetNames.map((sn) => XLSX.utils.sheet_to_csv(wb.Sheets[sn]))
    const out = parts.join('\n\n')
    return { blob: new Blob([out], { type: 'text/csv;charset=utf-8' }), filename: name + '.csv', previewText: out, previewType: 'text' as const }
  }
  if (to === 'json') {
    const obj: Record<string, unknown> = {}
    wb.SheetNames.forEach((sn) => {
      obj[sn] = XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null })
    })
    const out = JSON.stringify(obj, null, 2)
    return { blob: new Blob([out], { type: 'application/json;charset=utf-8' }), filename: name + '.json', previewText: out, previewType: 'text' as const }
  }
  if (to === 'html') {
    const tables = wb.SheetNames.map((sn) => arrayToHtmlTable(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' }) as unknown[][], sn)).join('')
    return {
      blob: new Blob([`<!doctype html><html><head><meta charset="utf-8">${TABLE_CSS}</head><body>${tables}</body></html>`], { type: 'text/html;charset=utf-8' }),
      filename: name + '.html',
      previewHtml: tables,
      previewType: 'html' as const,
    }
  }
  throw new Error('不支持的目标格式: ' + to)
}

export { arrayToHtmlTable, TABLE_CSS }
