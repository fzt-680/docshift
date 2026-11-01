/**
 * 浏览器端功能测试：对全部转换链路做真实验证
 * 结果写入 #results，供无头浏览器 --dump-dom 读取
 */
import { getConverter } from './converters'
import type { FormatId } from './types'

const out: string[] = []
let pass = 0
let fail = 0

const resultsEl = () => document.getElementById('results')
function log(line: string) {
  out.push(line)
  if (resultsEl()) resultsEl()!.textContent = out.join('\n')
}

window.addEventListener('error', (e) => {
  log('WINDOW-ERROR: ' + (e as ErrorEvent).message + ' @ ' + (e as ErrorEvent).filename + ':' + (e as ErrorEvent).lineno)
})
window.addEventListener('unhandledrejection', (e) => {
  log('UNHANDLED-REJECTION: ' + String((e as PromiseRejectionEvent).reason))
})

function file(name: string, content: string | BlobPart, mime: string): File {
  return new File([content], name, { type: mime })
}

const MD = `# 测试文档

这是一段**加粗**与*斜体*文本，还有\`行内代码\`。

## 列表

- 第一项
- 第二项
  - 嵌套项

## 表格

| 名称 | 数值 |
| --- | --- |
| 甲 | 1 |
| 乙 | 2 |

> 引用块内容

\`\`\`js
console.log("hello")
\`\`\`
`

const HTML = `<!doctype html><html><head><style>.x{color:red}</style></head><body><h1>网页标题</h1><p>段落 <b>加粗</b> <a href="https://example.com">链接</a></p><ul><li>项目一</li><li>项目二</li></ul></body></html>`

const CSV = `姓名,年龄,城市
张三,28,南京
李四,34,北京`

const JSON_DATA = `[{"id":1,"name":"甲","score":90},{"id":2,"name":"乙","score":85}]`

const TXT = `会议纪要

本次会议讨论了项目进度。

下一步计划
第一周完成设计
第二周完成开发`

async function run(from: FormatId, to: FormatId, f: File, opts?: Record<string, string | number>) {
  const label = `${from} -> ${to}`
  log('... running ' + label)
  try {
    const conv = getConverter(from, to, opts)
    if (!conv) throw new Error('converter not registered')
    const r = await conv({ file: f })
    const head = new Uint8Array(await r.blob.slice(0, 4).arrayBuffer())
    const sig = Array.from(head).map((b) => b.toString(16).padStart(2, '0')).join('')
    out.push(`PASS  ${label}  => ${r.filename}  ${r.blob.size}B  sig=${sig}`)
    pass++
    return r
  } catch (e) {
    out.push(`FAIL  ${label}  => ${e instanceof Error ? e.message : String(e)}`)
    fail++
    return null
  }
}

async function main() {
  // 1. React 应用渲染检查
  const { default: App } = await import('./App')
  const { createRoot } = await import('react-dom/client')
  const React = await import('react')
  const rootEl = document.getElementById('app-root')!
  createRoot(rootEl).render(React.createElement(App))
  await new Promise((r) => setTimeout(r, 300))
  const appHtml = rootEl.innerHTML
  out.push(appHtml.includes('DocShift') && appHtml.includes('转换队列') === false && appHtml.includes('拖拽文件到此处') ? 'PASS  react-app-render' : 'FAIL  react-app-render')
  appHtml.includes('拖拽文件到此处') ? pass++ : fail++

  // 2. 文档类转换
  await run('markdown', 'html', file('demo.md', MD, 'text/markdown'))
  await run('markdown', 'txt', file('demo.md', MD, 'text/markdown'))
  const docxR = await run('markdown', 'docx', file('demo.md', MD, 'text/markdown'))
  const pdfR = await run('markdown', 'pdf', file('demo.md', MD, 'text/markdown'))
  await run('html', 'markdown', file('page.html', HTML, 'text/html'))
  await run('html', 'txt', file('page.html', HTML, 'text/html'))
  await run('txt', 'markdown', file('note.txt', TXT, 'text/plain'))
  await run('txt', 'docx', file('note.txt', TXT, 'text/plain'))
  await run('txt', 'pdf', file('note.txt', TXT, 'text/plain'))

  // 3. 数据类转换
  const csvJson = await run('csv', 'json', file('data.csv', CSV, 'text/csv'))
  if (csvJson) {
    const txt = await csvJson.blob.text()
    const ok = txt.includes('张三') && txt.includes('南京')
    out.push(`${ok ? 'PASS' : 'FAIL'}  csv->json-content-check`)
    ok ? pass++ : fail++
  }
  const csvXlsx = await run('csv', 'xlsx', file('data.csv', CSV, 'text/csv'))
  if (csvXlsx) {
    const xf = new File([csvXlsx.blob], 'data.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const rDocx = await run('xlsx', 'docx', xf)
    if (rDocx) {
      const w = new File([rDocx.blob], 'data.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const rh = await run('docx', 'html', w)
      if (rh) {
        const t = await rh.blob.text()
        const ok = t.includes('张三') && t.includes('<table>')
        out.push(`${ok ? 'PASS' : 'FAIL'}  xlsx->docx->html-roundtrip-check (表格与数据保留)`)
        ok ? pass++ : fail++
      }
    }
    await run('xlsx', 'pdf', xf)
  }
  await run('csv', 'html', file('data.csv', CSV, 'text/csv'))
  await run('csv', 'markdown', file('data.csv', CSV, 'text/csv'))
  const jsonCsv = await run('json', 'csv', file('data.json', JSON_DATA, 'application/json'))
  if (jsonCsv) {
    const txt = await jsonCsv.blob.text()
    const ok = txt.includes('name') && txt.includes('甲')
    out.push(`${ok ? 'PASS' : 'FAIL'}  json->csv-content-check`)
    ok ? pass++ : fail++
  }
  await run('json', 'xlsx', file('data.json', JSON_DATA, 'application/json'))

  // 4. 图片转换（canvas 生成 PNG）
  const c = document.createElement('canvas')
  c.width = 400
  c.height = 300
  const cx = c.getContext('2d')!
  cx.fillStyle = '#4f6ef7'
  cx.fillRect(0, 0, 400, 300)
  cx.fillStyle = '#fff'
  cx.font = '28px sans-serif'
  cx.fillText('DocShift 中文测试', 40, 160)
  const pngBlob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/png'))
  const pngFile = new File([pngBlob], 'pic.png', { type: 'image/png' })
  await run('image', 'pdf', pngFile)
  await run('image', 'image', pngFile, { format: 'webp', quality: 80 })

  // 5. PDF 结构化输出（启发式四链路）
  {
    const { default: JsPdf } = await import('jspdf')
    const p = new JsPdf({ unit: 'pt', format: 'a4' })
    p.setFontSize(22)
    p.text('DocShift Test Document', 72, 90)
    p.setFontSize(14)
    p.text('Section One', 72, 130)
    p.setFontSize(11)
    p.text('This is the first body paragraph of the test document.', 72, 160)
    p.text('Second body line continues here.', 72, 180)
    p.text('Section Two', 72, 220)
    p.text('Column A value', 72, 260)
    p.text('Column B value', 250, 260)
    p.text('Row two left', 72, 280)
    p.text('Row two right', 250, 280)
    p.text('- bullet item one', 72, 320)
    p.text('- bullet item two', 72, 340)
    const textPdf = p.output('blob')
    const back = new File([textPdf], 'struct.pdf', { type: 'application/pdf' })

    const rTxt = await run('pdf', 'txt', back)
    if (rTxt) {
      const t = await rTxt.blob.text()
      const ok = t.includes('DocShift Test Document')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->txt-content-check`)
      ok ? pass++ : fail++
    }

    const rMd = await run('pdf', 'markdown', back)
    if (rMd) {
      const t = await rMd.blob.text()
      const ok = t.includes('# DocShift Test Document') && t.includes('## Section One') && t.includes('- bullet item one')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->markdown-heuristic-check (标题/列表识别)`)
      ok ? pass++ : fail++
    }

    const rDocx = await run('pdf', 'docx', back)
    if (rDocx) {
      const w = new File([rDocx.blob], 'struct.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      const rh = await run('docx', 'html', w)
      if (rh) {
        const t = await rh.blob.text()
        const ok = t.includes('DocShift Test Document') && t.includes('<h1>')
        out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->docx->html-roundtrip-check`)
        ok ? pass++ : fail++
      }
    }

    const rXlsx = await run('pdf', 'xlsx', back)
    if (rXlsx) {
      const XLSXLib = await import('xlsx')
      const wb = XLSXLib.read(await rXlsx.blob.arrayBuffer(), { type: 'array' })
      const csv = XLSXLib.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]])
      const ok = csv.includes('Column A value') && csv.includes('Column B value') && csv.includes('Row two right')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->xlsx-column-cluster-check (坐标聚类分列)`)
      ok ? pass++ : fail++
    }

    const rPptx = await run('pdf', 'pptx', back)
    if (rPptx) {
      const JSZipLib = await import('jszip')
      const zip = await JSZipLib.loadAsync(rPptx.blob)
      const names = Object.keys(zip.files)
      const slideFiles = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      const s1 = slideFiles.length ? await zip.files[slideFiles[0]].async('string') : ''
      const ok = slideFiles.length >= 2 && s1.includes('DocShift Test Document')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->pptx-slide-check (${slideFiles.length} 页，首页含标题)`)
      ok ? pass++ : fail++
    }
  }

  // 6. docx 回读：用刚生成的 docx 转 html
  if (docxR) {
    const back = new File([docxR.blob], 'demo.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
    const r = await run('docx', 'html', back)
    if (r) {
      const t = await r.blob.text()
      const ok = t.includes('测试文档') && t.includes('<table>')
      out.push(`${ok ? 'PASS' : 'FAIL'}  docx->html-content-check`)
      ok ? pass++ : fail++
    }
  }

  out.push('')
  out.push(`===== RESULT: ${pass} passed, ${fail} failed =====`)
  document.getElementById('results')!.textContent = out.join('\n')
  document.title = fail === 0 ? 'ALL-TESTS-PASSED' : 'TESTS-FAILED'
}

main().catch((e) => {
  document.getElementById('results')!.textContent = 'FATAL: ' + (e instanceof Error ? e.stack : String(e))
  document.title = 'TESTS-FATAL'
})
