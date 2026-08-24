/* ============================================================
 * ocrService.js — 真正的 Tesseract 圖像文字辨識（純前端本地）
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, confidence, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 重點：
 *   - 使用 Tesseract.recognize(file, 'eng') 對「真實圖片」進行 OCR，
 *     並於 Console 印出 raw text 供除錯。
 *   - 無任何 Mock Data、無硬編碼金額、不使用 new Date() 當作日期。
 *   - 所有金額 / 日期 / 商戶皆來自對 raw text 的真實 Regex 解析。
 * ============================================================ */

import Tesseract from 'tesseract.js'

/* 英文字母月份縮寫 → 數字 */
const MONTH_MAP = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

function parseAmountStr(str) {
  const num = Number(str.replace(/,/g, ''))
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : null
}

/* ===== 金額提取：依序尋找 TOTAL → HKD → HK$ → $ 標記後的數字 ===== */
export function extractAmount(text) {
  const patterns = [
    /TOTAL[^\d]{0,12}(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
    /HKD\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
    /HK\s*\$\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/i,
    /\$\s*(\d{1,3}(?:,\d{3})*\.?\d{0,2})/,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1]) {
      const num = parseAmountStr(m[1])
      if (num !== null) return num
    }
  }
  return null
}

/* 組出 YYYY-MM-DD（驗證範圍） */
function buildDate(y, mo, d) {
  const yy = Number(y)
  const mm = Number(mo)
  const dd = Number(d)
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

/* ===== 日期提取：英文字母月份 + 數字（DEC 24, 2018 → 2018-12-24） ===== */
export function extractDate(text) {
  // 格式 A：「DEC 24, 2018」/「Dec 24 2018」
  const m1 = text.match(
    /(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\.?[,\s]*(\d{1,2})[,]?\s*(\d{4})/i,
  )
  if (m1) {
    const mo = MONTH_MAP[m1[1].slice(0, 3).toUpperCase()]
    const r = buildDate(m1[3], mo, m1[2])
    if (r) return r
  }
  // 格式 B：「24 DEC 2018」/「24 Dec, 2018」
  const m2 = text.match(
    /(\d{1,2})\s*(?:st|nd|rd|th)?[,\s-]*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[a-z]*\.?[,\s]*(\d{4})/i,
  )
  if (m2) {
    const mo = MONTH_MAP[m2[2].slice(0, 3).toUpperCase()]
    const r = buildDate(m2[3], mo, m2[1])
    if (r) return r
  }
  return null
}

/* ===== 商戶提取：raw text 中第一行像店名的英文行 ===== */
export function extractMerchant(text) {
  const lines = (text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  for (const line of lines) {
    const clean = line.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().toUpperCase()
    if (
      clean.length >= 3 &&
      clean.length <= 40 &&
      !/\d/.test(clean) &&
      !/TOTAL|HKD|RECEIPT|INVOICE|THANK|CASH|CHANGE|TAX|DATE|TIME/.test(clean)
    ) {
      return clean.slice(0, 40)
    }
  }
  return null
}

/* ============================================================
 * 主要入口：對「真實圖片」執行 Tesseract OCR 並解析
 * ============================================================ */
export async function processReceiptOCR(file) {
  try {
    // 對真實圖片檔案進行 Tesseract OCR（英文）
    const result = await Tesseract.recognize(file, 'eng')
    const text = (result && result.data && result.data.text) || ''

    // 印出真正在圖片中讀到的所有文字（供瀏覽器 Console 除錯）
    console.log('Tesseract OCR Raw Text:', text)

    if (!text.trim()) {
      throw new Error('辨識結果為空，請確認圖片內容')
    }

    const extractedAmount = extractAmount(text)
    if (extractedAmount === null) {
      throw new Error('無法從辨識文字中提取金額（未找到 TOTAL / HKD / $ 標記）')
    }

    // 日期來自辨識文字；若圖片沒有可辨識日期則為 null（不使用 new Date()）
    const extractedDate = extractDate(text)
    const merchant = extractMerchant(text)
    const confidence =
      result &&
      result.data &&
      typeof result.data.confidence === 'number'
        ? Math.round(result.data.confidence * 10) / 10
        : null

    return {
      extractedAmount,
      extractedDate,
      merchant,
      confidence,
      engine: 'tesseract',
      model: 'tesseract.js eng',
      source: 'local',
      statusLabel: '✨ Tesseract 本地 AI 辨識成功',
    }
  } catch (err) {
    console.error('[ocrService] Tesseract 辨識失敗：', err)
    throw new Error(err.message || 'Tesseract 辨識失敗', { cause: err })
  }
}
