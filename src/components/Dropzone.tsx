import { useCallback, useRef, useState } from 'react'
import { FORMATS, detectFormat } from '../formats'
import type { FormatId } from '../types'

interface Props {
  onFiles: (files: { file: File; from: FormatId }[]) => void
}

const ACCEPT = Object.values(FORMATS)
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
        {Object.values(FORMATS).map((f) => (
          <span className="chip" key={f.id}>
            <span className="dot" style={{ background: DOT_COLORS[f.id] }} />
            {f.label}
            <span style={{ color: 'var(--text-3)' }}>.{f.ext[0]}</span>
          </span>
        ))}
      </div>
    </div>
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
}
