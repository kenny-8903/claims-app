/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * Vercel Serverless（api/ocr.js → Gemini 1.5 Flash）
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, confidence, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 上傳單據時 POST /api/ocr（Vercel Serverless Function）。
 *      Server 端以官方 @google/generative-ai SDK 呼叫 Gemini 1.5 Flash，
 *      徹底避開香港 IP 的前端瀏覽器直連限制，也無需在前端暴露 API Key。
 *   2. 成功 → engine: 'gemini'，
 *      statusLabel: '✨ Gemini 1.5 Flash AI 辨識成功'。
 *   3. 失敗 → throw Error（含詳細訊息），由呼叫端顯示「❌ API 失敗: [詳細錯誤]」。
 * ============================================================ */

/* ===== 工具函式 ===== */
function toDateString(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* 將圖片檔案轉為 base64（移除 data URL 前綴） */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result || ''
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('無法讀取圖片檔案'))
    reader.readAsDataURL(file)
  })
}

/* ============================================================
 * 呼叫 /api/ocr（Vercel Serverless → Gemini 1.5 Flash）
 * ============================================================ */
async function callVercelOCR(file) {
  const base64 = await fileToBase64(file)

  console.log('[ocrService] POST /api/ocr 送出請求，fileName:', file.name)

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: base64,
      mimeType: file.type || 'image/jpeg',
      fileName: file.name || 'receipt',
    }),
  })

  console.log('[ocrService] /api/ocr Response status:', res.status)

  if (!res.ok) {
    let message = `OCR API 回應失敗（HTTP ${res.status}）`
    try {
      const err = await res.json()
      if (err && err.error) message = err.error
    } catch {
      /* 忽略錯誤 body 解析失敗 */
    }
    console.error('[ocrService] /api/ocr 失敗:', res.status, message)
    throw new Error(message)
  }

  const data = await res.json()
  console.log('[ocrService] /api/ocr Response data:', data)

  // 驗證與正規化回傳欄位
  const amount = Number(data.extractedAmount)
  const extractedAmount = Number.isFinite(amount) && amount > 0 ? amount : null
  if (extractedAmount === null) {
    throw new Error('OCR API 未回傳有效金額')
  }

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(data.extractedDate || ''))
  const extractedDate = dateMatch ? String(data.extractedDate) : toDateString(new Date())

  const merchant =
    typeof data.merchant === 'string' && data.merchant.trim()
      ? data.merchant.trim().slice(0, 40)
      : 'UNKNOWN'

  const conf = Number(data.confidence)
  const confidence = Number.isFinite(conf) && conf > 0 && conf <= 100 ? conf : 95

  return {
    extractedAmount,
    extractedDate,
    merchant,
    confidence,
    engine: 'gemini',
    model: data.model || 'gemini-1.5-flash',
    source: 'vercel',
    statusLabel: '✨ Gemini 1.5 Flash AI 辨識成功',
  }
}

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * 成功回傳辨識結果；失敗則 throw（由呼叫端顯示「❌ API 失敗」）
 * ============================================================ */
export async function processReceiptOCR(file) {
  return callVercelOCR(file)
}
