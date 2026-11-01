import { useCallback, useRef, useState } from 'react'
import { FORMATS, detectFormat } from '../formats'
import type { FormatId } from '../types'

interface Props {
  onFiles: (files: { file: File; from: FormatId }[]) => void
}

const ACCEPT = Object.values(FORMATS)
  .filter((f) => f.targets.length > 0)
  .flatMap((f) => f.ext.map((e) => '.' + e))
  .join(',')

export default function Dropzone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || !fileList.length) return
      const accepted: { file: File; from: FormatId }[] = []
      const skipped: string[] = []
      Array.from(fileList).forEach((file) => {
        const from = detectFormat(file.name)
        if (from) accepted.push({ file, from })
        else skipped.push(file.name)
      })
      if (skipped.length) {
        window.dispatchEvent(new CustomEvent('docshift-toast', { detail: { msg: `已跳过 ${skipped.length} 个不支持的文件`, type: 'error' } }))
      }
      onFiles(accepted)
    },
    [onFiles],
  )

  return (
    <>
      <div
        className={'dropzone' + (dragging ? ' dragging' : '')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handle(e.dataTransfer.files)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
      >
        <div className="dropzone-icon">📄</div>
        <div className="dropzone-title">拖拽文件到此处，或点击选择</div>
        <div className="dropzone-sub">支持多选 · 文件仅在浏览器本地处理，不会上传</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(e) => {
            handle(e.target.files)
            e.target.value = ''
          }}
        />
        <div className="format-chips">
          {Object.values(FORMATS)
            .filter((f) => f.targets.length > 0)
            .map((f) => (
              <span className="chip" key={f.id}>
                <span className="dot" style={{ background: DOT_COLORS[f.id] }} />
                {f.label}
                <span style={{ color: 'var(--text-3)' }}>.{f.ext[0]}</span>
              </span>
            ))}
        </div>
      </div>

      <details className="mobile-import-tip" open>
        <summary>📱 手机微信 / QQ 收到的文件怎么导入？</summary>
        <div className="tip-body">
          <p>当前网页在手机上无法直接读取微信 / QQ 内部文件（系统沙盒限制），按下面方法即可正常导入：</p>
          <p><b>iOS：</b>在微信 / QQ 打开文件 → 点右上角「···」→「存储到文件」或「用其他应用打开」→ 存到「我的 iPhone」；再点上方「选取文件」，在「文件」App 中选它。</p>
          <p><b>安卓：</b>直接点「选取文件」→ 文件管理器里找 <code>Tencent/MicroMsg/Download</code>（微信）或 <code>Tencent/QQfile_recv</code>（QQ）。</p>
        </div>
      </details>
    </>
  )
}

export const DOT_COLORS: Record<FormatId, string> = {
  markdown: '#4f6ef7',
  docx: '#2b6cb0',
  html: '#e44d26',
  pdf: '#d64545',
  xlsx: '#1e9e6a',
  csv: '#1e9e6a',
  json: '#b7791f',
  txt: '#6b7280',
  image: '#805ad5',
  pptx: '#c2410c',
}
