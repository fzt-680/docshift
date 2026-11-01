import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

/**
 * HTML → PDF（canvas 栅格化分页方案，完整支持中文）
 * 原理：将 HTML 渲染到离屏容器 → html2canvas 截图 → 按 A4 比例切片 → 逐页写入 jspdf
 */

const A4_WIDTH_PT = 595.28
const A4_HEIGHT_PT = 841.89
const MARGIN_PT = 36 // 页边距（0.5 英寸）
const CANVAS_SCALE = 2 // 截图倍率（清晰度）

let seq = 0

export async function htmlToPdf(html: string): Promise<Blob> {
  const id = 'docshift-pdf-render-' + Date.now() + '-' + seq++
  const wrap = document.createElement('div')
  wrap.id = id
  wrap.style.cssText = [
    'position:fixed',
    'left:-99999px',
    'top:0',
    'width:794px', // A4 @96dpi
    'background:#ffffff',
    'padding:0',
    'box-sizing:border-box',
  ].join(';')
  const inner = document.createElement('div')
  inner.className = 'docshift-doc'
  inner.style.cssText = [
    'padding:48px 56px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif',
    'font-size:15px',
    'line-height:1.75',
    'color:#1f2329',
    'word-wrap:break-word',
  ].join(';')
  inner.innerHTML = applyDocStyles(html)
  wrap.appendChild(inner)
  document.body.appendChild(wrap)

  try {
    const canvas = await html2canvas(wrap, {
      scale: CANVAS_SCALE,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    })

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageContentW = A4_WIDTH_PT - MARGIN_PT * 2
    const pageContentH = A4_HEIGHT_PT - MARGIN_PT * 2

    // 每页对应的 canvas 像素高度
    const sliceH = Math.floor((canvas.width * pageContentH) / pageContentW)
    const totalH = canvas.height
    let offset = 0
    let first = true

    while (offset < totalH) {
      const h = Math.min(sliceH, totalH - offset)
      const slice = document.createElement('canvas')
      slice.width = canvas.width
      slice.height = h
      const sctx = slice.getContext('2d')
      if (!sctx) throw new Error('Canvas 上下文创建失败')
      sctx.fillStyle = '#ffffff'
      sctx.fillRect(0, 0, slice.width, slice.height)
      sctx.drawImage(canvas, 0, offset, canvas.width, h, 0, 0, canvas.width, h)

      const imgData = slice.toDataURL('image/jpeg', 0.92)
      if (!first) pdf.addPage()
      first = false
      const drawH = (h * pageContentW) / canvas.width
      pdf.addImage(imgData, 'JPEG', MARGIN_PT, MARGIN_PT, pageContentW, drawH)
      offset += sliceH
    }

    if (first) {
      // 空文档兜底
      pdf.text(' ', 40, 40)
    }
    return pdf.output('blob')
  } finally {
    wrap.remove()
  }
}

/** 为文档类 HTML 注入基础排版样式（保证 PDF 与预览一致） */
function applyDocStyles(html: string): string {
  // 只包一层，不重复注入 style 标签（样式已由 inner 容器承担）
  return html
}
