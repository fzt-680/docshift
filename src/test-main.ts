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
  await run('csv', 'xlsx', file('data.csv', CSV, 'text/csv'))
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

  // 5. PDF 回读：jsPDF 生成带真实文字层的 PDF，验证提取链路
  {
    const { default: JsPdf } = await import('jspdf')
    const p = new JsPdf({ unit: 'pt', format: 'a4' })
    p.text('DocShift Test Document', 72, 100)
    p.text('Second line content', 72, 130)
    p.addPage()
    p.text('Page two content', 72, 100)
    const textPdf = p.output('blob')
    const back = new File([textPdf], 'text.pdf', { type: 'application/pdf' })
    const r = await run('pdf', 'txt', back)
    if (r) {
      const t = await r.blob.text()
      const ok = t.includes('DocShift Test Document') && t.includes('Page two content')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->txt-content-check => ${JSON.stringify(t.slice(0, 80))}`)
      ok ? pass++ : fail++
    }
    const r2 = await run('pdf', 'html', back)
    if (r2) {
      const t = await r2.blob.text()
      const ok = t.includes('DocShift Test Document') && t.includes('第 2 页')
      out.push(`${ok ? 'PASS' : 'FAIL'}  pdf->html-content-check`)
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
