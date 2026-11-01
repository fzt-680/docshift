import type { QueueItem } from '../types'

interface Props {
  item: QueueItem
  onClose: () => void
}

export default function PreviewModal({ item, onClose }: Props) {
  const r = item.result
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className={'file-icon ' + item.from} style={{ width: 26, height: 26, fontSize: 11, borderRadius: 7 }}>
            {item.from === 'markdown' ? 'M' : item.from === 'docx' ? 'W' : item.from === 'html' ? 'H' : item.from === 'pdf' ? 'P' : item.from === 'xlsx' || item.from === 'csv' ? 'X' : item.from === 'json' ? 'J' : item.from === 'txt' ? 'T' : 'I'}
          </span>
          <h3>预览 · {r?.filename ?? item.file.name}</h3>
          <button className="btn small" onClick={onClose}>关闭</button>
        </div>
        <div className="modal-body">
          {r?.previewType === 'html' && (
            <iframe title="preview" srcDoc={r.previewHtml} sandbox="allow-same-origin" />
          )}
          {r?.previewType === 'text' && <pre>{r.previewText}</pre>}
          {r?.previewType === 'none' && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>该格式暂不支持预览，请下载后查看</div>
          )}
        </div>
      </div>
    </div>
  )
}
