import { FORMATS } from '../formats'
import { DOT_COLORS } from './Dropzone'

export default function FormatMatrix() {
  const rows = Object.values(FORMATS).filter((f) => f.targets.length > 0)
  return (
    <section className="section" id="matrix">
      <h2 className="section-title">支持的转换</h2>
      <p className="section-sub">全部在浏览器本地完成，点击上方上传区即可开始</p>
      <div className="matrix">
        {rows.map((f) => (
          <div className="matrix-row" key={f.id}>
            <div className="matrix-from">
              <span className={'file-icon ' + f.id}>{f.icon}</span>
              {f.label}
            </div>
            <div className="matrix-to">
              {f.targets.map((t) => (
                <span className="tag" key={t}>
                  → {FORMATS[t].label}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export { DOT_COLORS }
