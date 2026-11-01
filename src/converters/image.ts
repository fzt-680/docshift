import jsPDF from 'jspdf'
import { baseName } from '../lib/download'
import type { ConvertContext } from '../types'

const A4_W = 595.28
const A4_H = 841.89
const MARGIN = 36

type ImgFormat = 'png' | 'jpg' | 'webp'

function mimeOf(f: ImgFormat): string {
  return f === 'png' ? 'image/png' : f === 'webp' ? 'image/webp' : 'image/jpeg'
}

function drawToCanvas(bmp: ImageBitmap, maxW?: number): HTMLCanvasElement {
  let w = bmp.width
  let h = bmp.height
  if (maxW && w > maxW) {
    h = Math.round((h * maxW) / w)
    w = maxW
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, 0, 0, w, h)
  return canvas
}

export interface ImageOptions {
  format?: ImgFormat
  quality?: number
}

export async function imageConverter(ctx: ConvertContext, toExt: string, opts: ImageOptions = {}) {
  const name = baseName(ctx.file.name)
  const bmp = await createImageBitmap(ctx.file)
  ctx.onProgress?.(40)

  if (toExt === 'pdf') {
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const hasAlpha = /png|webp|gif/i.test(ctx.file.type)
    const maxW = A4_W - MARGIN * 2
    const maxH = A4_H - MARGIN * 2
    const scale = Math.min(maxW / bmp.width, maxH / bmp.height)
    const w = bmp.width * scale
    const h = bmp.height * scale
    const canvas = drawToCanvas(bmp)
    pdf.addImage(canvas, hasAlpha ? 'PNG' : 'JPEG', (A4_W - w) / 2, (A4_H - h) / 2, w, h, undefined, 'FAST')
    ctx.onProgress?.(90)
    const blob = pdf.output('blob')
    return { blob, filename: name + '.pdf', previewType: 'none' as const }
  }

  // 格式转换 / 压缩
  const format: ImgFormat = opts.format ?? (/png/.test(ctx.file.type) ? 'png' : /webp/.test(ctx.file.type) ? 'webp' : 'jpg')
  const quality = opts.quality ?? 0.85
  const canvas = drawToCanvas(bmp)
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('图片编码失败'))),
      mimeOf(format),
      format === 'png' ? undefined : quality,
    )
  })
  ctx.onProgress?.(90)
  return { blob, filename: name + '.' + format, previewType: 'none' as const }
}
