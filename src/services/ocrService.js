/* ============================================================
 * ocrService.js — 純前端本地 OCR（Tesseract.js）
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, confidence, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 使用 Tesseract.js（chi_tra+eng）在瀏覽器本地進行圖片文字辨識
 *      （無任何 /api/ocr 或外部 Serverless API 呼叫）。
 *   2. 以 Regex 從辨識文字自動提取金額（$ / HKD / Total / 金額）與日期
 *      （YYYY-MM-DD / YYYY/MM/DD / DD/MM/YYYY）。
 *   3. 成功 → statusLabel: '✨ Tesseract 本地 AI 辨識成功'。
 *   4. 失敗 → throw Error（訊息供 UI 顯示「❌ 辨識失敗: [錯誤訊息]」）。
 *
 * 備註：Tesseract.js 首次執行會自 CDN（jsDelivr）下載 core 與語言資料；
 *       之後瀏覽器快取即離線可用。OCR 運算本身完全在本地瀏覽器執行。
 * ============================================================ */

import { createWorker } from 'tesseract.js'

/* ===== 工具函式 ===== */
function toDateString(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* 從檔名推導商戶名稱（移除副檔名與雜訊字元） */
function deriveMerchant(fileName) {
  const stem = (fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase()
  return stem.length > 0 ? stem.slice(0, 24) : 'UNKNOWN'
}

/* 從辨識文字中提取商戶名稱（第一行像店名的行；找不到則用檔名） */
export function extractMerchant(text, fileName) {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    const clean = line.replace(/[^\p{L}\p{N} ]+/gu, ' ').trim()
    if (
      clean.length >= 3 &&
      clean.length <= 40 &&
      !/\d/.test(clean) &&
      !/total|amount|金額|總額|date|日期|receipt|invoice|tax|合計/i.test(clean)
    ) {
      return clean.toUpperCase().slice(0, 40)
    }
  }
  return deriveMerchant(fileName)
}

/* ===== 金額提取（$ / HKD / Total / 金額 標記） ===== */
export function extractAmount(text) {
  // 1) 優先：帶有金額標記的數字（HK$ / HKD / $ / Total / 金額 / Amount）
  const labeled = text.match(
    /(?:HK\s*\$|HKD|US\s*\$|\$\s?|Total|TOTAL|Amount|AMOUNT|金額|總額|合計)[^\d]{0,10}(\d{1,3}(?:,\d{3})*\.?\d{0,2})/,
  )
  if (labeled && labeled[1]) {
    const num = Number(labeled[1].replace(/,/g, ''))
    if (Number.isFinite(num) && num > 0) return Math.round(num * 100) / 100
  }

  // 2) 次選：任何符合金額形式（帶兩位小數）的數字
  const decimal = text.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/)
  if (decimal) {
    const num = Number(decimal[1].replace(/,/g, ''))
    if (Number.isFinite(num) && num > 0) return Math.round(num * 100) / 100
  }

  return null
}

/* ===== 日期提取（YYYY-MM-DD / YYYY/MM/DD / DD/MM/YYYY） ===== */
export function extractDate(text) {
  const m =
    text.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/) ||
    text.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)
  if (!m) return null

  let y
  let mo
  let d
  if (/^\d{4}/.test(m[0])) {
    y = m[1]
    mo = m[2]
    d = m[3]
  } else {
    d = m[1]
    mo = m[2]
    y = m[3]
  }

  const yy = Number(y)
  const mm = Number(mo)
  const dd = Number(d)
  if (yy < 2000 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null

  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * 使用 Tesseract.js 在本地辨識圖片並提取金額 / 日期
 * ============================================================ */
export async function processReceiptOCR(file) {
  let worker
  try {
    // chi_tra（繁中）+ eng：建立並載入語言
    worker = await createWorker('chi_tra+eng')

    const { data } = await worker.recognize(file)
    const text = (data && data.text) || ''

    if (!text.trim()) {
      throw new Error('辨識結果為空，請確認圖片內容')
    }

    const extractedAmount = extractAmount(text)
    if (extractedAmount === null) {
      throw new Error('無法從圖片中提取金額（未找到 $ / HKD / Total / 金額 等標記）')
    }

    const extractedDate = extractDate(text) || toDateString(new Date())
    const merchant = extractMerchant(text, file.name)
    const confidence =
      data && typeof data.confidence === 'number'
        ? Math.round(data.confidence * 10) / 10
        : 90

    return {
      extractedAmount,
      extractedDate,
      merchant,
      confidence,
      engine: 'tesseract',
      model: 'tesseract.js chi_tra+eng',
      source: 'local',
      statusLabel: '✨ Tesseract 本地 AI 辨識成功',
    }
  } catch (err) {
    console.error('[ocrService] Tesseract 辨識失敗：', err)
    throw new Error(err.message || 'Tesseract 辨識失敗', { cause: err })
  } finally {
    if (worker) {
      try {
        await worker.terminate()
      } catch {
        /* 忽略 terminate 錯誤 */
      }
    }
  }
}
