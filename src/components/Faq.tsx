import { useState } from 'react'

const FAQS = [
  {
    q: '我的文件会被上传到服务器吗？',
    a: '不会。DocShift 是一个纯静态网站，所有转换都通过浏览器内的 JavaScript / WebAssembly 在您的设备上完成。整个过程中没有任何文件数据离开您的电脑，您可以断开网络后继续使用已加载的页面。',
  },
  {
    q: '转换质量如何？复杂排版会保留吗？',
    a: 'Word / Markdown / HTML 之间的转换会保留标题层级、列表、表格、加粗斜体、链接、图片和引用块等结构；Excel 转换保留多工作表与全部单元格数据。PDF 生成采用页面级栅格化方案，中文与复杂排版显示稳定。需要说明：扫描件 PDF（纯图片）无法提取文字，加密或损坏的文件可能转换失败。',
  },
  {
    q: '支持批量转换吗？文件大小有限制吗？',
    a: '支持。可一次拖入多个文件，逐个设置目标格式后一键全部转换，并打包为 ZIP 下载。理论上没有硬性大小限制，实际受浏览器内存约束——通常数百 MB 的文件均可正常处理；超大文件建议分批。',
  },
  {
    q: '图片转 PDF 是怎么排版的？',
    a: '每张图片生成一页 A4 PDF，按原始比例居中缩放完整放入页面，不会裁剪。带透明通道的 PNG / WebP / GIF 会保留透明背景输出为 PNG 嵌入 PDF。',
  },
  {
    q: 'PDF 转 Word / Excel / PPT / Markdown 是完整还原吗？',
    a: '不是，是「启发式内容重建」。PDF 只记录文字画在页面的坐标，不记录“这是标题/表格/列表”的结构。DocShift 的做法：按字号大小推断标题层级、按符号识别列表、按文字坐标聚类分列（Excel），段落与列表会保留为真实结构；但表格、合并单元格、复杂排版无法从坐标可靠还原。每个输出文件内都附有说明，关键内容请对照原 PDF 核对。若需高保真还原，请使用 Adobe Acrobat 等专业工具的云端转换。',
  },
  {
    q: 'PDF 转出来的表格乱了怎么办？',
    a: 'PDF 中的表格是线条加散落文字的坐标组合，不携带表格结构，客户端方案无法可靠还原。Excel 输出对「列对齐规整」的 PDF（如从 Excel 导出的报表）效果较好，文字会按坐标落入对应列；复杂表格建议使用原文件，或先用 OCR 工具处理扫描件。',
  },
]

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="section" id="faq">
      <h2 className="section-title">常见问题</h2>
      <p className="section-sub">关于隐私、转换能力与限制的说明</p>
      <div className="faq">
        {FAQS.map((f, i) => (
          <div className={'faq-item' + (open === i ? ' open' : '')} key={i}>
            <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
              {f.q}
              <span className="caret">▾</span>
            </button>
            <div className="faq-a">{f.a}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
