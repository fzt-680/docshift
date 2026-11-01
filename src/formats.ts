import type { FormatDef, FormatId } from './types'

export const FORMATS: Record<FormatId, FormatDef> = {
  markdown: {
    id: 'markdown',
    label: 'Markdown',
    ext: ['md', 'markdown'],
    mime: ['text/markdown'],
    icon: 'M',
    targets: ['html', 'pdf', 'docx', 'txt'],
  },
  docx: {
    id: 'docx',
    label: 'Word 文档',
    ext: ['docx'],
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    icon: 'W',
    targets: ['html', 'markdown', 'txt', 'pdf'],
  },
  html: {
    id: 'html',
    label: 'HTML 网页',
    ext: ['html', 'htm'],
    mime: ['text/html'],
    icon: 'H',
    targets: ['markdown', 'txt', 'pdf'],
  },
  pdf: {
    id: 'pdf',
    label: 'PDF 文档',
    ext: ['pdf'],
    mime: ['application/pdf'],
    icon: 'P',
    targets: ['txt', 'html'],
  },
  xlsx: {
    id: 'xlsx',
    label: 'Excel 表格',
    ext: ['xlsx', 'xls'],
    mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    icon: 'X',
    targets: ['csv', 'json', 'html'],
  },
  csv: {
    id: 'csv',
    label: 'CSV 表格',
    ext: ['csv', 'tsv'],
    mime: ['text/csv'],
    icon: 'C',
    targets: ['json', 'xlsx', 'html', 'markdown'],
  },
  json: {
    id: 'json',
    label: 'JSON 数据',
    ext: ['json'],
    mime: ['application/json'],
    icon: 'J',
    targets: ['csv', 'xlsx'],
  },
  txt: {
    id: 'txt',
    label: '纯文本',
    ext: ['txt', 'text', 'log'],
    mime: ['text/plain'],
    icon: 'T',
    targets: ['markdown', 'html', 'pdf', 'docx'],
  },
  image: {
    id: 'image',
    label: '图片',
    ext: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
    mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'],
    icon: 'I',
    targets: ['pdf', 'image'],
  },
}

const EXT_MAP: Record<string, FormatId> = {}
Object.values(FORMATS).forEach((f) => {
  f.ext.forEach((e) => {
    EXT_MAP[e] = f.id
  })
})

/** 根据文件名推断格式 */
export function detectFormat(filename: string): FormatId | null {
  const i = filename.lastIndexOf('.')
  if (i < 0) return null
  return EXT_MAP[filename.slice(i + 1).toLowerCase()] ?? null
}

/** 格式 → 可目标的格式 */
export function targetsOf(from: FormatId): FormatDef[] {
  return FORMATS[from].targets.map((t) => FORMATS[t])
}

/** 目标格式的默认扩展名 */
export function defaultExt(to: FormatId): string {
  return FORMATS[to].ext[0]
}
