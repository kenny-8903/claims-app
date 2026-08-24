/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * 「Local 擬真 / Vercel 真 AI」雙模組切換方案
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { confidence, extractedDate, extractedAmount, merchant, engine } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 環境自動判斷（import.meta.env.PROD === true 且 VITE_GEMINI_API_KEY 存在）
 *      → 優先呼叫 Google Gemini 1.5 Flash Vision（真 AI）。
 *   2. 若 Gemini 遇到香港地區限制（400/403 "User location not supported"）
 *      或任何 API 失敗 → 自動平滑降級至 Local 擬真引擎（Smart Mock）。
 *   3. 本機 dev（PROD=false）或無 API key → 直接使用 Local 擬真引擎。
 *
 * 環境變數：VITE_GEMINI_API_KEY（請放於 .env.local）
 * ============================================================ */

/* ===== Google Gemini 設定（Vercel 真 AI 引擎） ===== */
const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const getGeminiApiKey = () => import.meta.env.VITE_GEMINI_API_KEY || ''

/* 環境自動判斷：僅在 Vercel 生產環境（vite build / PROD）且有 API key 時使用 Gemini */
function shouldUseGemini() {
  return import.meta.env.PROD === true && getGeminiApiKey().trim().length > 0
}

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

/* 從檔名推導商戶名稱（移除副檔名與雜訊字元） */
function deriveMerchant(fileName) {
  const stem = (fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .toUpperCase()
  return stem.length > 0 ? stem.slice(0, 24) : 'UNKNOWN'
}

/* 判斷是否為香港地區限制 / 其他可降級的 Gemini 錯誤 */
function isRegionBlocked(error) {
  const msg = (error && (error.message || '')).toLowerCase()
  return /user location is not supported|location is not supported|user location|unsupported location/.test(msg)
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
  }
}


/* ============================================================
 * Vercel 真 AI 引擎（Google Gemini 1.5 Flash Vision）
 * ============================================================ */

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

/* 由 Gemini 回傳的文字中抽取 JSON（處理 ```json 程式碼塊） */
function extractJson(text) {
  const cleaned = (text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Gemini 回傳內容不含有效 JSON')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

const GEMINI_PROMPT = [
  'You are a receipt OCR extractor. Analyze the receipt image and return STRICT JSON only, no markdown, no extra text:',
  '{ "amount": <number in HKD with 2 decimals>, "date": "<YYYY-MM-DD>", "merchant": "<merchant name>", "confidence": <0-100 number> }',
  'If a field is unreadable, return null for that field. Keep the JSON valid.',
].join('\n')

async function callGemini(file) {
  const apiKey = getGeminiApiKey()
  const base64 = await fileToBase64(file)

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: GEMINI_PROMPT },
            {
              inline_data: {
                mime_type: file.type || 'image/jpeg',
                data: base64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 256,
      },
    }),
  })

  if (!res.ok) {
    let message = `Gemini API 回應失敗（HTTP ${res.status}）`
    try {
      const err = await res.json()
      if (err && err.error && err.error.message) message = err.error.message
    } catch {
      /* 忽略錯誤 body 解析失敗 */
    }
    const error = new Error(message)
    error.status = res.status
    throw error
  }

  const data = await res.json()
  const text =
    (data &&
      data.candidates &&
      data.candidates[0] &&
      data.candidates[0].content &&
      data.candidates[0].content.parts &&
      data.candidates[0].content.parts[0] &&
      data.candidates[0].content.parts[0].text) ||
    ''

  const parsed = extractJson(text)

  // 驗證與正規化
  const amount = Number(parsed.amount)
  const extractedAmount =
    Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date || ''))
  const extractedDate = dateMatch ? String(parsed.date) : toDateString(new Date())

  const merchant =
    typeof parsed.merchant === 'string' && parsed.merchant.trim()
      ? parsed.merchant.trim().slice(0, 40)
      : 'UNKNOWN'

  const conf = Number(parsed.confidence)
  const confidence =
    Number.isFinite(conf) && conf > 0 && conf <= 100 ? Math.round(conf * 10) / 10 : 95

  if (extractedAmount === null) {
    throw new Error('Gemini 未能提取有效金額')
  }

  return {
    extractedAmount,
    extractedDate,
    merchant,
    confidence,
    engine: 'gemini',
    model: GEMINI_MODEL,
  }
}

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * ============================================================ */
export async function processReceiptOCR(file) {
  // 1) Vercel 生產環境：嘗試 Gemini 真 AI
  if (shouldUseGemini()) {
    try {
      return await callGemini(file)
    } catch (err) {
      const reason = isRegionBlocked(err) ? '香港地區限制' : 'API 失敗'
      console.warn(`[ocrService] Gemini 呼叫失敗（${reason}），平滑降級至 Local 擬真引擎。`, err)
      // 2) 平滑降級至 Local 擬真引擎
    }
  }

  // 2) 本機 dev / 無 API key / Gemini 失敗 → Local 擬真引擎
  return runMockEngine(file)
}

