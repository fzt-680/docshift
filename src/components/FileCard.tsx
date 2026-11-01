import { FORMATS, targetsOf } from '../formats'
import { formatSize } from '../lib/download'
import FormatSelect from './FormatSelect'
import type { FormatId, QueueItem } from '../types'

interface Props {
  item: QueueItem
  onTargetChange: (to: FormatId) => void
  onOptionChange: (key: string, value: string | number) => void
  onConvert: () => void
  onRemove: () => void
  onPreview: () => void
  onDownload: () => void
}

export default function FileCard({ item, onTargetChange, onOptionChange, onConvert, onRemove, onPreview, onDownload }: Props) {
  const from = FORMATS[item.from]
  const to = FORMATS[item.to]
  const busy = item.status === 'converting'
  const done = item.status === 'done'
  const isImgToImg = item.from === 'image' && item.to === 'image'

  return (
    <div className={'file-card ' + item.status}>
      <div className="file-row">
        <div className={'file-icon ' + item.from}>{from.icon}</div>
        <div className="file-meta">
          <div className="file-name" title={item.file.name}>{item.file.name}</div>
          <div className="file-sub">
            {formatSize(item.file.size)}
            {done && item.result && (
              <>
                {' · '}
                <span className="ok">✓ 已转换为 {item.result.filename}</span>
                {item.result.blob.size !== item.file.size && ` · ${formatSize(item.result.blob.size)}`}
              </>
            )}
            {item.status === 'error' && (
              <>
                {' · '}
                <span className="err">✗ {item.error}</span>
              </>
            )}
            {item.status === 'pending' && ' · 等待转换'}
            {busy && ` · 转换中 ${item.progress}%`}
          </div>
        </div>

        <div className="flow">
          <span className="tag">{from.label}</span>
          <span className="arrow">→</span>
          <FormatSelect
            value={item.to}
            disabled={busy || done}
            ariaLabel="目标格式"
            options={targetsOf(item.from).map((t) => ({ value: t.id, label: t.label }))}
            onChange={(v) => onTargetChange(v as FormatId)}
          />
        </div>

        <div className="file-actions">
          {!done && (
            <button className="btn primary small" onClick={onConvert} disabled={busy}>
              {busy ? '转换中…' : '转换'}
            </button>
          )}
          {done && (
            <>
              {item.result && item.result.previewType !== 'none' && (
                <button className="btn small" onClick={onPreview}>预览</button>
              )}
              <button className="btn primary small" onClick={onDownload}>下载</button>
            </>
          )}
          <button className="btn ghost small" onClick={onRemove} title="移除" aria-label="移除">✕</button>
        </div>
      </div>

      {busy && (
        <div className="progress">
          <div style={{ width: item.progress + '%' }} />
        </div>
      )}

      {isImgToImg && !done && (
        <div className="img-opts">
          <label>
            目标格式
            <FormatSelect
              value={(item.options?.format as string) ?? 'jpg'}
              ariaLabel="图片目标格式"
              options={[
                { value: 'png', label: 'PNG（无损）' },
                { value: 'jpg', label: 'JPG（体积小）' },
                { value: 'webp', label: 'WebP（均衡）' },
              ]}
              onChange={(v) => onOptionChange('format', v)}
            />
          </label>
          <label>
            质量
            <input
              type="range"
              min={30}
              max={100}
              value={Number(item.options?.quality ?? 85)}
              onChange={(e) => onOptionChange('quality', Number(e.target.value))}
            />
            <span className="q-val">{Number(item.options?.quality ?? 85)}%</span>
          </label>
        </div>
      )}

      {done && to.id === 'image' && item.from === 'image' && (
        <div className="img-opts">
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
            已按 {String(item.options?.format ?? 'jpg').toUpperCase()} · 质量 {Number(item.options?.quality ?? 85)}% 输出
          </span>
        </div>
      )}
    </div>
  )
}
