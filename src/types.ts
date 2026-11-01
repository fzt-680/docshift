/** 全局类型定义 */

export type FormatId =
  | 'markdown'
  | 'docx'
  | 'html'
  | 'pdf'
  | 'xlsx'
  | 'csv'
  | 'json'
  | 'txt'
  | 'image'
  | 'pptx'

export interface FormatDef {
  id: FormatId
  label: string
  ext: string[]
  mime: string[]
  icon: string
  /** 可作为转换目标的格式 id */
  targets: FormatId[]
}

export interface QueueItem {
  id: string
  file: File
  from: FormatId
  to: FormatId
  /** 图片转换专用：目标格式 / 质量 */
  options?: Record<string, string | number>
  status: 'pending' | 'converting' | 'done' | 'error'
  progress: number
  error?: string
  result?: ConvertResult
}

export interface ConvertResult {
  blob: Blob
  filename: string
  /** 用于预览：渲染后的 HTML（若有） */
  previewHtml?: string
  /** 用于预览：纯文本（若有） */
  previewText?: string
  /** 是否可在 iframe 中渲染 HTML 预览 */
  previewType: 'html' | 'text' | 'none'
}

export interface ConvertContext {
  file: File
  onProgress?: (pct: number) => void
}

export type ConverterFn = (
  ctx: ConvertContext,
) => Promise<{ blob: Blob; filename: string; previewHtml?: string; previewText?: string; previewType?: 'html' | 'text' | 'none' }>
