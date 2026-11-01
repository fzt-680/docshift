import { saveAs } from 'file-saver'

/** 下载 Blob 为文件 */
export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename)
}

/** 读取文件为 ArrayBuffer */
export function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as ArrayBuffer)
    r.onerror = () => reject(new Error('文件读取失败'))
    r.readAsArrayBuffer(file)
  })
}

/** 读取文件为文本 */
export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('文件读取失败'))
    r.readAsText(file, 'utf-8')
  })
}

/** 读取文件为 DataURL */
export function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('文件读取失败'))
    r.readAsDataURL(file)
  })
}

/** 去掉扩展名的基础文件名 */
export function baseName(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i > 0 ? filename.slice(0, i) : filename
}

/** 从文件名取扩展名（小写，不含点） */
export function extOf(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i >= 0 ? filename.slice(i + 1).toLowerCase() : ''
}

/** 人类可读的文件大小 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
