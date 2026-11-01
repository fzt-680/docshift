import type { ConverterFn, FormatId } from '../types'
import { defaultExt } from '../formats'
import { markdownConverter } from './markdown'
import { wordConverter } from './word'
import { htmlConverter } from './html'
import { pdfConverter } from './pdf'
import { excelConverter } from './excel'
import { csvConverter } from './csv'
import { jsonConverter } from './json'
import { textConverter } from './text'
import { imageConverter, type ImageOptions } from './image'

/** 获取 (from → to) 的转换函数；options 目前仅图片转换使用 */
export function getConverter(from: FormatId, to: FormatId, options?: Record<string, string | number>): ConverterFn | null {
  if (from === 'image' && to === 'image') {
    const ext = (options?.format as ImgFormatName) ?? 'jpg'
    return (ctx) => imageConverter(ctx, ext, { format: ext as ImageOptions['format'], quality: (options?.quality as number) ?? 0.85 })
  }
  const fn = CORE[from + '->' + to]
  if (fn) return fn
  // 目标为 PDF/图片但源格式没有直连路径时，先转 HTML 再转 PDF（统一出口）
  if (to === 'pdf') {
    const viaHtml = CORE[from + '->html']
    if (viaHtml) {
      return async (ctx) => {
        const r = await viaHtml(ctx)
        const { htmlToPdf } = await import('../lib/htmlToPdf')
        const blob = await htmlToPdf(r.previewHtml ?? '')
        return { blob, filename: r.filename.replace(/\.[^.]+$/, '') + '.pdf', previewType: 'none' as const }
      }
    }
  }
  return null
}

type ImgFormatName = 'png' | 'jpg' | 'webp'

const CORE: Record<string, ConverterFn> = {
  'markdown->html': (ctx) => markdownConverter(ctx, 'html'),
  'markdown->txt': (ctx) => markdownConverter(ctx, 'txt'),
  'markdown->pdf': (ctx) => markdownConverter(ctx, 'pdf'),
  'markdown->docx': (ctx) => markdownConverter(ctx, 'docx'),
  'docx->html': (ctx) => wordConverter(ctx, 'html'),
  'docx->markdown': (ctx) => wordConverter(ctx, 'markdown'),
  'docx->txt': (ctx) => wordConverter(ctx, 'txt'),
  'docx->pdf': (ctx) => wordConverter(ctx, 'pdf'),
  'html->markdown': (ctx) => htmlConverter(ctx, 'markdown'),
  'html->txt': (ctx) => htmlConverter(ctx, 'txt'),
  'html->pdf': (ctx) => htmlConverter(ctx, 'pdf'),
  'pdf->txt': (ctx) => pdfConverter(ctx, 'txt'),
  'pdf->html': (ctx) => pdfConverter(ctx, 'html'),
  'pdf->markdown': (ctx) => pdfConverter(ctx, 'markdown'),
  'pdf->docx': (ctx) => pdfConverter(ctx, 'docx'),
  'pdf->xlsx': (ctx) => pdfConverter(ctx, 'xlsx'),
  'pdf->pptx': (ctx) => pdfConverter(ctx, 'pptx'),
  'xlsx->csv': (ctx) => excelConverter(ctx, 'csv'),
  'xlsx->json': (ctx) => excelConverter(ctx, 'json'),
  'xlsx->html': (ctx) => excelConverter(ctx, 'html'),
  'xlsx->docx': (ctx) => excelConverter(ctx, 'docx'),
  'xlsx->pdf': (ctx) => excelConverter(ctx, 'pdf'),
  'csv->json': (ctx) => csvConverter(ctx, 'json'),
  'csv->xlsx': (ctx) => csvConverter(ctx, 'xlsx'),
  'csv->html': (ctx) => csvConverter(ctx, 'html'),
  'csv->markdown': (ctx) => csvConverter(ctx, 'markdown'),
  'json->csv': (ctx) => jsonConverter(ctx, 'csv'),
  'json->xlsx': (ctx) => jsonConverter(ctx, 'xlsx'),
  'txt->markdown': (ctx) => textConverter(ctx, 'markdown'),
  'txt->html': (ctx) => textConverter(ctx, 'html'),
  'txt->pdf': (ctx) => textConverter(ctx, 'pdf'),
  'txt->docx': (ctx) => textConverter(ctx, 'docx'),
  'image->pdf': (ctx) => imageConverter(ctx, 'pdf'),
}

export { defaultExt }
