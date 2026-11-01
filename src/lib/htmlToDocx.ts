import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ImageRun,
  ExternalHyperlink,
  type ISectionOptions,
} from 'docx'

/**
 * 将 HTML 字符串转换为原生 .docx（基于 docx 库自绘渲染器）
 * 支持：标题、段落、加粗/斜体/下划线/删除线、行内代码、代码块、
 *       列表（有序/无序/嵌套）、引用块、表格、链接、图片（base64）、分割线
 */

type Align = (typeof AlignmentType)[keyof typeof AlignmentType]

interface Ctx {
  align?: Align
}

function parse(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body
}

/** 行内节点 → TextRun[] */
function inlineRuns(node: Node, inherited: { bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean } = {}): (TextRun | ExternalHyperlink)[] {
  const runs: (TextRun | ExternalHyperlink)[] = []
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || ''
      if (!text) return
      runs.push(
        new TextRun({
          text: text.replace(/\s+/g, ' '),
          bold: inherited.bold,
          italics: inherited.italic,
          strike: inherited.strike,
          font: inherited.code ? 'Consolas' : undefined,
          ...(inherited.code ? { shading: { fill: 'F2F3F5' } } : {}),
        }),
      )
      return
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return
    const el = child as HTMLElement
    const tag = el.tagName.toLowerCase()
    const next = { ...inherited }
    if (tag === 'strong' || tag === 'b') next.bold = true
    if (tag === 'em' || tag === 'i') next.italic = true
    if (tag === 's' || tag === 'del' || tag === 'strike') next.strike = true
    if (tag === 'code' && el.parentElement?.tagName.toLowerCase() !== 'pre') next.code = true

    if (tag === 'a') {
      const href = el.getAttribute('href') || ''
      const children = inlineRuns(el, next)
      runs.push(
        new ExternalHyperlink({
          children: children as never,
          link: href,
        }),
      )
      return
    }
    if (tag === 'br') {
      runs.push(new TextRun({ text: '', break: 1 }))
      return
    }
    if (tag === 'img') {
      // 图片由块级处理；行内图片跳过（罕见）
      return
    }
    runs.push(...inlineRuns(el, next))
  })
  return runs
}

const HEADINGS: Record<string, typeof HeadingLevel[keyof typeof HeadingLevel]> = {
  h1: HeadingLevel.HEADING_1,
  h2: HeadingLevel.HEADING_2,
  h3: HeadingLevel.HEADING_3,
  h4: HeadingLevel.HEADING_4,
  h5: HeadingLevel.HEADING_5,
  h6: HeadingLevel.HEADING_6,
}

function blockChildren(el: HTMLElement, ctx: Ctx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []

  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim()
      if (text) {
        out.push(new Paragraph({ children: [new TextRun(text)], alignment: ctx.align }))
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const child = node as HTMLElement
    const tag = child.tagName.toLowerCase()

    if (tag in HEADINGS) {
      out.push(
        new Paragraph({
          heading: HEADINGS[tag],
          children: inlineRuns(child),
          alignment: ctx.align,
        }),
      )
      return
    }
    if (tag === 'p' || tag === 'div') {
      // 如果 div 里含块级子元素，递归展开；否则当段落
      const hasBlock = Array.from(child.children).some((c) =>
        ['p', 'div', 'ul', 'ol', 'table', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr'].includes(
          c.tagName.toLowerCase(),
        ),
      )
      if (hasBlock && tag === 'div') {
        out.push(...blockChildren(child, ctx))
      } else {
        const img = child.querySelector('img')
        if (img && child.children.length === 1) {
          out.push(...imageParagraph(img as HTMLImageElement, ctx))
          return
        }
        const runs = inlineRuns(child)
        if (runs.length) out.push(new Paragraph({ children: runs, alignment: ctx.align }))
      }
      return
    }
    if (tag === 'ul' || tag === 'ol') {
      out.push(...listItems(child, tag === 'ol', ctx))
      return
    }
    if (tag === 'blockquote') {
      const runs = inlineRuns(child)
      out.push(
        new Paragraph({
          children: runs,
          alignment: ctx.align,
          indent: { left: 720 },
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: '4F6EF7', space: 8 } },
        }),
      )
      return
    }
    if (tag === 'pre') {
      const code = child.textContent || ''
      code.split('\n').forEach((line) => {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: line || ' ', font: 'Consolas' })],
            shading: { fill: 'F2F3F5' },
            spacing: { after: 0 },
          }),
        )
      })
      out.push(new Paragraph({ text: '', spacing: { after: 120 } }))
      return
    }
    if (tag === 'table') {
      out.push(buildTable(child))
      return
    }
    if (tag === 'hr') {
      out.push(
        new Paragraph({
          text: '',
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC' } },
        }),
      )
      return
    }
    if (tag === 'img') {
      out.push(...imageParagraph(child as HTMLImageElement, ctx))
      return
    }
    // 兜底：当普通段落
    const runs = inlineRuns(child)
    if (runs.length) out.push(new Paragraph({ children: runs, alignment: ctx.align }))
  })
  return out
}

function imageParagraph(img: HTMLImageElement, ctx: Ctx): Paragraph[] {
  const src = img.getAttribute('src') || ''
  const alt = img.getAttribute('alt') || '图片'
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(src)
  if (!m) return [new Paragraph({ children: [new TextRun(alt)], alignment: AlignmentType.CENTER })]
  const type: 'png' | 'gif' | 'bmp' | 'jpg' = m[1] === 'jpg' || m[1] === 'jpeg' ? 'jpg' : m[1] === 'gif' ? 'gif' : m[1] === 'bmp' ? 'bmp' : 'png'
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          data: Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0)),
          type,
          transformation: { width: 320, height: 200 },
        }),
      ],
    }),
    new Paragraph({ children: [new TextRun(alt)], alignment: AlignmentType.CENTER }),
  ]
}

function listItems(list: HTMLElement, ordered: boolean, ctx: Ctx): Paragraph[] {
  const out: Paragraph[] = []
  Array.from(list.children).forEach((li, idx) => {
    if (li.tagName.toLowerCase() !== 'li') return
    const el = li as HTMLElement
    // 嵌套列表
    const nested = Array.from(el.children).filter((c) => ['ul', 'ol'].includes(c.tagName.toLowerCase()))
    const own = el.cloneNode(true) as HTMLElement
    nested.forEach((n) => n.remove())
    const runs = inlineRuns(own)
    out.push(
      new Paragraph({
        children: runs,
        bullet: ordered ? undefined : { level: 0 },
        numbering: ordered ? { reference: 'num', level: 0 } : undefined,
        alignment: ctx.align,
      }),
    )
    nested.forEach((n) => {
      out.push(...listItems(n as HTMLElement, (n as HTMLElement).tagName.toLowerCase() === 'ol', ctx))
    })
    void idx
  })
  return out
}

function buildTable(table: HTMLElement): Table {
  const rows: TableRow[] = []
  const trs = Array.from(table.querySelectorAll('tr'))
  trs.forEach((tr) => {
    const cells = Array.from(tr.children).filter((c) => ['td', 'th'].includes(c.tagName.toLowerCase()))
    const row = new TableRow({
      children: cells.map((c) => {
        const isHeader = c.tagName.toLowerCase() === 'th'
        return new TableCell({
          width: { size: 100 / Math.max(cells.length, 1), type: WidthType.PERCENTAGE },
          shading: isHeader ? { fill: 'EEF1FE' } : undefined,
          children: blockChildren(c as HTMLElement, {}).length
            ? blockChildren(c as HTMLElement, {})
            : [new Paragraph({ children: inlineRuns(c as HTMLElement) })],
        })
      }),
    })
    rows.push(row)
  })
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      left: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      right: { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
    },
  })
}

export async function htmlToDocx(html: string, title?: string): Promise<Blob> {
  const body = parse(html)
  const children = blockChildren(body, {})
  const section: ISectionOptions = {
    properties: {},
    children: children.length ? children : [new Paragraph({ children: [new TextRun('')] })],
  }
  const doc = new Document({
    creator: 'DocShift',
    title: title || 'DocShift 文档',
    description: '由 DocShift 本地转换生成',
    numbering: {
      config: [
        {
          reference: 'num',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [section],
  })
  const buf = await Packer.toBlob(doc)
  return buf
}
