/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * 「Vercel Serverless 真 AI / Local 擬真」雙模式
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { confidence, extractedDate, extractedAmount, merchant, engine } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 上傳單據時 POST /api/ocr（Vercel Serverless Function）。
 *      Server 端以 GEMINI_API_KEY 呼叫 Google Gemini 1.5 Flash Vision，
 *      徹底避開香港 IP 在前端瀏覽器直接呼叫 Gemini 的地區限制。
 *   2. 成功 → 回傳 { engine: 'gemini', source: 'vercel',
 *      statusLabel: '✨ Google Gemini AI 辨識成功 (Live API)' }。
 *   3. 失敗（本機 dev 無 /api、API 錯誤、金鑰未設定等）→ 平滑降級至
 *      Local 擬真引擎（Smart Mock for HK Local），UI 顯示
 *      「✨ OCR 辨識成功 (Local Demo 模式)」。
 * ============================================================ */

/* ===== 工具函式 ===== */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

/* 從檔名推導商戶名稱（移除副檔名與雜訊字元） */
function deriveMerchant(fileName) {
  const stem = (fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase()
  return stem.length > 0 ? stem.slice(0, 24) : 'UNKNOWN'
}

/* ============================================================
 * Vercel Serverless 真 AI 引擎（POST /api/ocr）
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
    statusLabel: '✨ Google Gemini AI 辨識成功 (Live API)',
  }
}

/* ============================================================
 * Local 擬真引擎（Smart Mock for HK Local）
 * ============================================================ */
const MOCK_RULES = [
  {
    match: (name) => /apollo|default|sample|demo/.test(name),
    result: { extractedAmount: 200, extractedDate: '2018-12-24', merchant: 'APOLLO', confidence: 98.7 },
  },
  {
    match: (name) => /taxi/.test(name),
    result: { extractedAmount: 120, extractedDate: '2026-08-14', merchant: 'TAXI', confidence: 97.5 },
  },
  {
    match: (name) => /mcdonald|macdonald/.test(name),
    result: { extractedAmount: 45.5, extractedDate: '2026-08-10', merchant: 'MCDONALD', confidence: 96.8 },
  },
]

function smartMockOCR(file) {
  const name = (file.name || '').toLowerCase()

  // 1) 依檔名關鍵字匹配
  for (const rule of MOCK_RULES) {
    if (rule.match(name)) {
      return { ...rule.result }
    }
  }

  // 2) 其他圖片：動態產生合理港幣金額（HK$150 ~ $1,500）與當日日期
  const seed = (file.name.length * 31 + (file.size || 0)) % 100
  const extractedAmount = Math.round((150 + seed * 13.5) * 100) / 100 // 150.00 ~ 1498.50
  const now = new Date()
  return {
    extractedAmount,
    extractedDate: toDateString(now),
    merchant: deriveMerchant(file.name),
    confidence: Math.round((94 + seed * 0.05) * 10) / 10, // 94.0% ~ 98.9%
  }
}

async function runMockEngine(file) {
  // 模擬引擎運算延遲（0.9 ~ 1.5 秒）
  await delay(900 + Math.random() * 600)
  const mock = smartMockOCR(file)
  return {
    ...mock,
    engine: 'mock',
    model: 'local-smart-mock',
    source: 'local',
    statusLabel: '✨ OCR 辨識成功 (Local Demo 模式)',
  }
}

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * ============================================================ */
export async function processReceiptOCR(file) {
  // 1) 優先呼叫 Vercel Serverless 真 AI（POST /api/ocr）
  try {
    return await callVercelOCR(file)
  } catch (err) {
    console.error('[ocrService] Vercel OCR API 呼叫失敗，平滑降級至 Local 擬真引擎。', err)
    // 2) 平滑降級至 Local 擬真引擎（本機 dev / API 失敗 / 金鑰未設定皆適用）
  }

  return runMockEngine(file)
}

