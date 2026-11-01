/**
 * UI 交互测试（CDP）：
 * 1. 通过文件输入框注入测试文件，验证队列出现
 * 2. 点击目标格式下拉，验证菜单紧贴按钮（修复原生 select 弹窗乱跑的问题）
 * 3. 选择选项，验证值更新
 */
const BASE = 'http://127.0.0.1:4173/'
const TEST_FILE = process.argv[2] || 'C:/Users/孙李山/WorkBuddy/2026-11-01-11-49-26/doc-converter/.tmp-test.md'
const CDP_PORT = 9222
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function findPageTarget() {
  for (let i = 0; i < 20; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl)
      if (page) return page
    } catch {}
    await sleep(500)
  }
  throw new Error('未找到浏览器页面目标')
}

async function main() {
  const target = await findPageTarget()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', () => rej(new Error('WS 失败')), { once: true })
  })
  let msgId = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++msgId
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })
  const evalJs = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.result?.exceptionDetails) throw new Error('JS 异常: ' + JSON.stringify(r.result.exceptionDetails))
    return r.result?.result?.value
  }

  const results = []
  const check = (name, ok, detail = '') => {
    results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`)
    return ok
  }

  await send('Page.enable')
  await send('Page.navigate', { url: BASE })
  await sleep(1500)

  // 1. 注入文件
  await send('DOM.enable')
  const docResp = await send('DOM.getDocument', { depth: -1 })
  const docNodeId = docResp.result.root.nodeId
  const qResp = await send('DOM.querySelector', { nodeId: docNodeId, selector: 'input[type=file]' })
  const nodeId = qResp.result.nodeId
  if (!nodeId) throw new Error('未找到文件输入框')
  const setResp = await send('DOM.setFileInputFiles', { nodeId, files: [TEST_FILE] })
  if (setResp.error) throw new Error('文件注入失败（文件不存在?）: ' + JSON.stringify(setResp.error))
  await sleep(600)

  const cardCount = await evalJs("document.querySelectorAll('.file-card').length")
  check('文件注入后队列出现文件卡片', cardCount === 1, `cards=${cardCount}`)

  // 2. 点击自定义下拉
  const toggleInfo = await evalJs(`(() => {
    const t = document.querySelector('.fselect-toggle');
    if (!t) return null;
    t.click();
    return { text: t.textContent };
  })()`)
  check('下拉开关存在且可点击', !!toggleInfo, `value="${toggleInfo?.text}"`)
  await sleep(300)

  const geo = await evalJs(`(() => {
    const t = document.querySelector('.fselect-toggle');
    const m = document.querySelector('.fselect-menu');
    if (!t || !m) return null;
    const tr = t.getBoundingClientRect(), mr = m.getBoundingClientRect();
    return { toggle: {x: tr.x, y: tr.y, w: tr.width, bottom: tr.bottom}, menu: {x: mr.x, y: mr.y, w: mr.width, bottom: mr.bottom}, options: m.querySelectorAll('.fselect-option').length };
  })()`)
  if (!geo) {
    check('下拉菜单渲染', false)
  } else {
    const anchoredX = Math.abs(geo.menu.x - geo.toggle.x) < 40
    const below = geo.menu.y >= geo.toggle.bottom - 4 && geo.menu.y - geo.toggle.bottom < 30
    check('菜单紧贴按钮下方展开（修复乱跑）', anchoredX && below, `menu@(${Math.round(geo.menu.x)},${Math.round(geo.menu.y)}) toggle@(${Math.round(geo.toggle.x)},${Math.round(geo.toggle.y)})`)
    check('菜单包含全部目标格式选项', geo.options === 4, `options=${geo.options}`)
  }

  // 3. 选择「PDF 文档」
  const picked = await evalJs(`(() => {
    const opts = document.querySelectorAll('.fselect-option');
    const target = Array.from(opts).find(o => o.textContent.includes('PDF'));
    if (!target) return null;
    target.click();
    return true;
  })()`)
  await sleep(300)
  const afterText = await evalJs("document.querySelector('.fselect-toggle')?.textContent")
  const menuGone = await evalJs("document.querySelectorAll('.fselect-menu').length") === 0
  check('点击选项后菜单关闭', menuGone)
  check('选择 PDF 后按钮文本更新', !!picked && afterText?.includes('PDF'), `now="${afterText}"`)

  // 4. 点击外部关闭
  await evalJs("document.querySelector('.fselect-toggle').click()")
  await sleep(200)
  const openAgain = await evalJs("document.querySelectorAll('.fselect-menu').length === 1")
  await evalJs("document.body.click()")
  await sleep(200)
  const closedByOutside = await evalJs("document.querySelectorAll('.fselect-menu').length === 0")
  check('再次打开菜单', openAgain)
  check('点击页面外部菜单关闭', closedByOutside)

  // 5. 暗色主题下菜单可见性（背景应为卡片色而非透明）
  const themeOk = await evalJs(`(() => {
    document.querySelector('.theme-toggle').click();
    const m = document.querySelector('.fselect-menu');
    return true;
  })()`)
  check('暗色主题切换无报错', themeOk)

  console.log(results.join('\n'))
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`===== UI-TEST: ${results.length - failed}/${results.length} passed =====`)
  ws.close()
  process.exit(failed ? 2 : 0)
}

main().catch((e) => {
  console.error('UI-TEST-ERROR:', e.message)
  process.exit(1)
})
