/**
 * CDP 驱动脚本：用 Node 内置 WebSocket 连接 Edge 远程调试端口，
 * 真实等待测试页完成（轮询 document.title），再取回结果文本。
 * 用法: node cdp-test.mjs <url> [timeoutMs]
 */
const url = process.argv[2] || 'http://127.0.0.1:4174/'
const timeoutMs = Number(process.argv[3] || 90000)
const CDP_PORT = 9222

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findPageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('未找到可用的浏览器页面目标')
}

async function main() {
  const target = await findPageTarget()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')), { once: true })
  })

  let msgId = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true })
    return r.result?.result?.value
  }

  await send('Page.enable')
  await send('Page.navigate', { url })
  console.log('navigated:', url)

  const start = Date.now()
  let title = ''
  while (Date.now() - start < timeoutMs) {
    await sleep(1000)
    title = (await evalJs('document.title')) || ''
    if (title.startsWith('ALL-TESTS') || title.startsWith('TESTS-')) break
    process.stdout.write('.')
  }
  console.log('\nfinal title:', title)

  const results = await evalJs("document.getElementById('results') ? document.getElementById('results').textContent : 'NO RESULTS ELEMENT'")
  console.log('===== TEST RESULTS =====')
  console.log(results)
  ws.close()
  process.exit(title.startsWith('ALL-TESTS') ? 0 : 2)
}

main().catch((e) => {
  console.error('CDP-TEST-ERROR:', e.message)
  process.exit(1)
})
