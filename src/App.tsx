import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import JSZip from 'jszip'
import Dropzone from './components/Dropzone'
import FileCard from './components/FileCard'
import PreviewModal from './components/PreviewModal'
import FormatMatrix from './components/FormatMatrix'
import Faq from './components/Faq'
import { targetsOf } from './formats'
import { getConverter } from './converters'
import { downloadBlob } from './lib/download'
import type { FormatId, QueueItem } from './types'

let uid = 0
const nextId = () => 'f' + ++uid + '-' + Date.now().toString(36)

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('docshift-theme') as 'light' | 'dark') || 'light')
  const [items, setItems] = useState<QueueItem[]>([])
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const toastTimer = useRef<number>(0)
  const runningRef = useRef(false)

  /* ---- 主题 ---- */
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('docshift-theme', theme)
  }, [theme])

  /* ---- Toast ---- */
  const showToast = useCallback((msg: string, type = '') => {
    setToast({ msg, type })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  useEffect(() => {
    const h = (e: Event) => {
      const d = (e as CustomEvent).detail as { msg: string; type?: string }
      showToast(d.msg, d.type ?? 'error')
    }
    window.addEventListener('docshift-toast', h)
    return () => window.removeEventListener('docshift-toast', h)
  }, [showToast])

  /* ---- 队列操作 ---- */
  const addFiles = useCallback((files: { file: File; from: FormatId }[]) => {
    setItems((prev) => {
      const next = [...prev]
      files.forEach(({ file, from }) => {
        // 去重：同名同大小视为同一文件
        if (next.some((i) => i.file.name === file.name && i.file.size === file.size)) return
        const targets = targetsOf(from)
        next.push({
          id: nextId(),
          file,
          from,
          to: targets[0].id,
          options: from === 'image' ? { format: 'jpg', quality: 85 } : undefined,
          status: 'pending',
          progress: 0,
        })
      })
      return next
    })
  }, [])

  const patch = useCallback((id: string, p: Partial<QueueItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i)))
  }, [])

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const convertOne = useCallback(
    async (item: QueueItem) => {
      patch(item.id, { status: 'converting', progress: 5, error: undefined })
      try {
        const converter = getConverter(item.from, item.to, item.options)
        if (!converter) throw new Error(`暂不支持 ${item.from} → ${item.to} 转换`)
        const r = await converter({
          file: item.file,
          onProgress: (p) => patch(item.id, { progress: Math.min(95, 5 + p * 0.9) }),
        })
        patch(item.id, {
          status: 'done',
          progress: 100,
          result: {
            blob: r.blob,
            filename: r.filename,
            previewHtml: r.previewHtml,
            previewText: r.previewText,
            previewType: r.previewType ?? 'none',
          },
        })
      } catch (err) {
        patch(item.id, {
          status: 'error',
          progress: 100,
          error: err instanceof Error ? err.message : '转换失败',
        })
      }
    },
    [patch],
  )

  const convertAll = useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    const pending = items.filter((i) => i.status !== 'done')
    for (const item of pending) {
      // 逐个串行转换，避免大文件内存峰值
      await convertOne(item)
    }
    runningRef.current = false
    const ok = items.filter((i) => i.status === 'done').length
    showToast(`批量转换完成：${ok}/${items.length} 成功`, ok === items.length ? 'success' : '')
  }, [items, convertOne, showToast])

  const downloadZip = useCallback(async () => {
    const done = items.filter((i) => i.status === 'done' && i.result)
    if (!done.length) return
    const zip = new JSZip()
    const used = new Set<string>()
    done.forEach((i) => {
      let name = i.result!.filename
      let n = 1
      while (used.has(name)) name = i.result!.filename.replace(/(\.[^.]+)?$/, `(${n++})$1`)
      used.add(name)
      zip.file(name, i.result!.blob)
    })
    const blob = await zip.generateAsync({ type: 'blob' })
    downloadBlob(blob, 'docshift-converted.zip')
    showToast('已打包下载 ZIP', 'success')
  }, [items, showToast])

  const stats = useMemo(() => {
    const done = items.filter((i) => i.status === 'done').length
    return { total: items.length, done, pending: items.length - done }
  }, [items])

  const previewItem = items.find((i) => i.id === previewId) ?? null

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <div className="logo">
            <span className="logo-badge">D</span>
            DocShift <small>文档格式转换</small>
          </div>
          <div className="header-spacer" />
          <a className="header-link" href="#matrix">支持格式</a>
          <a className="header-link" href="#faq">常见问题</a>
          <button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} title="切换主题" aria-label="切换主题">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <main className="container">
        <section className="hero">
          <h1>
            文档格式<span className="grad">自由转换</span>
          </h1>
          <p>Markdown · Word · PDF · Excel · HTML · 图片互转，全部在浏览器本地完成。文件永不上传，无广告，无水印。</p>
          <div className="hero-badges">
            <span className="hero-badge">🔒 <b>100% 本地处理</b></span>
            <span className="hero-badge">⚡ 浏览器内即时转换</span>
            <span className="hero-badge">🚫 文件不上传服务器</span>
            <span className="hero-badge">📦 批量转换 · ZIP 打包</span>
          </div>
        </section>

        <Dropzone onFiles={addFiles} />

        {items.length > 0 && (
          <section className="queue-section">
            <div className="queue-head">
              <h2>转换队列</h2>
              <span className="queue-count">
                {stats.done}/{stats.total} 已完成
              </span>
              <div className="queue-actions">
                <button className="btn primary" onClick={convertAll} disabled={stats.pending === 0}>
                  ⚡ 全部转换
                </button>
                <button className="btn" onClick={downloadZip} disabled={stats.done === 0}>
                  📦 打包下载 ZIP
                </button>
                <button className="btn ghost" onClick={() => setItems([])}>清空</button>
              </div>
            </div>

            {items.map((item) => (
              <FileCard
                key={item.id}
                item={item}
                onTargetChange={(to) => patch(item.id, { to, status: 'pending', result: undefined, progress: 0 })}
                onOptionChange={(k, v) => patch(item.id, { options: { ...item.options, [k]: v } })}
                onConvert={() => convertOne(item)}
                onRemove={() => remove(item.id)}
                onPreview={() => setPreviewId(item.id)}
                onDownload={() => item.result && downloadBlob(item.result.blob, item.result.filename)}
              />
            ))}
          </section>
        )}

        <FormatMatrix />
        <Faq />
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <div style={{ flex: 1, minWidth: 260 }}>
            <p>
              <b>DocShift</b> — 纯本地文档格式转换器。所有文件仅在您的浏览器中处理，不经过任何服务器。
            </p>
            <div className="tech">
              <span>React</span><span>TypeScript</span><span>Vite</span><span>pdf.js</span>
              <span>Mammoth</span><span>SheetJS</span><span>PapaParse</span><span>Turndown</span><span>docx</span><span>jsPDF</span>
            </div>
          </div>
          <p style={{ textAlign: 'right' }}>
            Deployed on Cloudflare Pages<br />
            <span style={{ opacity: 0.75 }}>静态托管 · 零后端 · 隐私优先</span>
          </p>
        </div>
      </footer>

      {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewId(null)} />}

      {toast && (
        <div className="toast-wrap">
          <div className={'toast ' + toast.type}>{toast.msg}</div>
        </div>
      )}
    </div>
  )
}
