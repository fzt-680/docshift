/** 文档预览 / PDF 渲染共享的 Markdown 排版样式 */
export const MARKDOWN_CSS = `
.docshift-doc h1{font-size:1.9em;margin:1.2em 0 .6em;padding-bottom:.3em;border-bottom:2px solid #e5e7eb;font-weight:700}
.docshift-doc h2{font-size:1.5em;margin:1.1em 0 .5em;padding-bottom:.25em;border-bottom:1px solid #eef0f3;font-weight:700}
.docshift-doc h3{font-size:1.25em;margin:1em 0 .45em;font-weight:600}
.docshift-doc h4{font-size:1.1em;margin:.9em 0 .4em;font-weight:600}
.docshift-doc h5{font-size:1em;margin:.8em 0 .35em;font-weight:600}
.docshift-doc h6{font-size:.95em;margin:.8em 0 .35em;font-weight:600;color:#6b7280}
.docshift-doc p{margin:.6em 0}
.docshift-doc a{color:#4f6ef7;text-decoration:none}
.docshift-doc strong{font-weight:700}
.docshift-doc em{font-style:italic}
.docshift-doc del{text-decoration:line-through;color:#9ca3af}
.docshift-doc ul,.docshift-doc ol{margin:.6em 0;padding-left:1.6em}
.docshift-doc li{margin:.25em 0}
.docshift-doc li>ul,.docshift-doc li>ol{margin:.15em 0}
.docshift-doc blockquote{margin:.8em 0;padding:.2em 1em;border-left:4px solid #4f6ef7;background:#f6f8ff;color:#4b5563;border-radius:0 6px 6px 0}
.docshift-doc blockquote p{margin:.35em 0}
.docshift-doc code{font-family:Consolas,Monaco,"Courier New",monospace;font-size:.88em;background:#f2f3f5;padding:.15em .4em;border-radius:4px;color:#c7254e}
.docshift-doc pre{background:#f6f8fa;border:1px solid #e5e7eb;border-radius:8px;padding:.9em 1.1em;overflow-x:auto;margin:.8em 0}
.docshift-doc pre code{background:none;padding:0;color:#24292f;font-size:.85em;line-height:1.6}
.docshift-doc table{border-collapse:collapse;margin:.8em 0;width:100%;font-size:.92em}
.docshift-doc th,.docshift-doc td{border:1px solid #dfe2e5;padding:.45em .8em;text-align:left}
.docshift-doc th{background:#f0f3ff;font-weight:600}
.docshift-doc tr:nth-child(2n) td{background:#fafbfc}
.docshift-doc img{max-width:100%;border-radius:6px;margin:.5em 0}
.docshift-doc hr{border:none;border-top:2px solid #e5e7eb;margin:1.4em 0}
`

/** 生成完整可预览的 HTML 文档（含样式），用于 iframe 预览和 PDF */
export function wrapDocHtml(innerHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.75;color:#1f2329}${MARKDOWN_CSS}</style></head><body><div class="docshift-doc">${innerHtml}</div></body></html>`
}
