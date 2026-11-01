import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { readAsText, baseName } from '../lib/download'
import type { ConvertContext } from '../types'

/** 任意 JSON → 适合表格化的行数组 */
function jsonToRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    if (data.length === 0) return []
    // 对象数组 → 直接用；标量数组 → 包成 value 列
    if (typeof data[0] === 'object' && data[0] !== null) return data as Record<string, unknown>[]
    return data.map((v, i) => ({ index: i, value: v }))
  }
  if (data && typeof data === 'object') {
    return Object.entries(data as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: v && typeof v === 'object' ? JSON.stringify(v) : v,
    }))
  }
  return [{ value: data }]
}

export async function jsonConverter(ctx: ConvertContext, to: string) {
  const text = await readAsText(ctx.file)
  const name = baseName(ctx.file.name)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('JSON 解析失败：文件不是合法的 JSON')
  }
  const rows = jsonToRows(data)

  if (to === 'csv') {
    const out = rows.length ? Papa.unparse(rows) : ''
    return { blob: new Blob([out], { type: 'text/csv;charset=utf-8' }), filename: name + '.csv', previewText: out, previewType: 'text' as const }
  }
  if (to === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    return { blob: new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename: name + '.xlsx', previewType: 'none' as const }
  }
  throw new Error('不支持的目标格式: ' + to)
}
