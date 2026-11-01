# DocShift · 文档格式转换器

> 纯本地、隐私优先的文档格式转换网站。所有转换在浏览器内完成，文件永不上传。

## ✨ 特性

- **100% 本地转换**：无服务器、无上传，断网也能用（页面加载后）
- **多格式互转**：Markdown / Word / PDF / Excel / HTML / CSV / JSON / TXT / 图片
- **批量处理**：多文件队列、一键全部转换、ZIP 打包下载
- **转换预览**：HTML 渲染预览 / 文本源码预览
- **图片工具**：格式互转（PNG/JPG/WebP）、质量压缩、转 PDF
- **明暗主题**、响应式布局、移动端可用

## 🔧 支持的转换

| 源格式 | 目标格式 |
| --- | --- |
| Markdown (.md) | HTML、PDF、Word (.docx)、TXT |
| Word (.docx) | HTML、Markdown、TXT、PDF |
| HTML (.html) | Markdown、TXT、PDF |
| PDF (.pdf) | Markdown、Word (.docx)、Excel (.xlsx)、PPT (.pptx)、TXT、HTML（启发式内容重建） |
| Excel (.xlsx/.xls) | CSV、JSON、HTML、Word (.docx)、PDF |
| CSV/TSV | JSON、Excel、HTML、Markdown |
| JSON | CSV、Excel |
| TXT | Markdown、HTML、PDF、Word |
| 图片 (jpg/png/webp/gif/bmp) | PDF、格式互转、压缩 |

## 🏗 技术栈

React 18 · TypeScript · Vite 5 · pdf.js · Mammoth · SheetJS · PapaParse · Turndown · docx · jsPDF · html2canvas · JSZip

核心转换库均为纯浏览器端方案，适配 Cloudflare Pages 静态托管。

## 🚀 本地开发

```bash
npm install
npm run dev        # 开发服务器 http://localhost:5173
npm run build      # 生产构建 → dist/
npm run preview    # 预览生产构建
```

## ☁️ 部署到 Cloudflare Pages

**方式一：连接 Git 仓库（推荐，支持自动部署）**

1. 将本仓库推送到 GitHub
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git
3. 选择仓库，构建配置：
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Node version: `22`
4. Save and Deploy，约 1 分钟后上线

**方式二：wrangler 直接上传**

```bash
npm run build
npx wrangler pages deploy dist --project-name=docshift
```

## 📁 项目结构

```
doc-converter/
├── src/
│   ├── converters/        # 9 个转换器模块 + 注册表
│   │   ├── markdown.ts    # MD → HTML/TXT/PDF/DOCX
│   │   ├── word.ts        # DOCX → HTML/MD/TXT/PDF
│   │   ├── html.ts        # HTML → MD/TXT/PDF
│   │   ├── pdf.ts         # PDF → TXT/HTML（pdf.js 文本提取）
│   │   ├── excel.ts       # XLSX → CSV/JSON/HTML
│   │   ├── csv.ts         # CSV → JSON/XLSX/HTML/MD
│   │   ├── json.ts        # JSON → CSV/XLSX
│   │   ├── text.ts        # TXT → MD/HTML/PDF/DOCX
│   │   ├── image.ts       # 图片 → PDF / 互转 / 压缩
│   │   └── index.ts       # (from, to) → ConverterFn 注册表
│   ├── lib/
│   │   ├── htmlToDocx.ts  # 自绘 HTML→DOCX 原生渲染器
│   │   ├── htmlToPdf.ts   # canvas 分页 HTML→PDF（完整中文支持）
│   │   └── markdownStyle.ts
│   ├── components/        # Dropzone / FileCard / PreviewModal / FormatMatrix / Faq
│   ├── formats.ts         # 格式定义与转换矩阵
│   ├── App.tsx / main.tsx / styles.css
│   └── test-main.ts       # 浏览器端全链路功能测试（26 项断言）
├── test/index.html        # 测试入口
└── vite.config.ts
```

## 🧪 测试

```bash
npx vite build --config vite.config.test.ts   # 构建测试包 → dist-test
# 用无头浏览器（Edge/Chrome）打开 dist-test/test/index.html 查看 26 项断言结果
```

测试覆盖全部 25 条转换链路 + React 渲染 + 内容校验（文件签名 / 文本完整性）。

## ⚠️ 已知限制

- PDF → Word/Excel/PPT/Markdown 为**启发式内容重建**（按字号推断标题、按符号识别列表、按坐标聚类分列），非高保真还原；表格、合并单元格、复杂排版无法从 PDF 坐标可靠还原，每个输出文件内均附说明
- 扫描件 PDF（纯图片）无文字层，无法提取文本（真实 PDF 文件的文字层提取不受影响）
- 超大文件受浏览器内存约束，建议数百 MB 以内

## 📄 License

MIT
