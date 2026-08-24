/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 前端上傳 Base64 圖片 → Server 端呼叫 Google Gemini 1.5 Flash Vision
 * 徹底避開「香港 IP 在前端瀏覽器直接呼叫 Gemini」的地區限制。
 *
 * 環境變數：GEMINI_API_KEY
 *   - 正式環境：Vercel Project → Settings → Environment Variables
 *   - 本地測試：寫入 .env.local 並使用 `vercel dev`（或 npx vercel dev）
 *
 * 請求：POST /api/ocr
 *   { "image": "<base64>", "mimeType": "image/jpeg", "fileName": "x.jpg" }
 * 回應（成功 200）：
 *   { "extractedAmount": 1250.00, "extractedDate": "2026-08-24",
 *     "merchant": "APOLLO", "confidence": 95, "engine": "gemini",
 *     "model": "gemini-1.5-flash", "source": "vercel" }
 * ============================================================ */

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

/* Vercel Node 執行環境的請求 body 上限為 4.5MB，此處保守限制 base64 長度 */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024

/* 要求 Gemini 嚴格回傳 JSON（amount / date / merchant） */
const GEMINI_PROMPT = [
  'You are a receipt OCR extractor. Analyze the receipt image and return STRICT JSON only (no markdown, no extra text):',
  '{"amount": <number in HKD with 2 decimals>, "date": "YYYY-MM-DD", "merchant": "<merchant name>"}',
  'If a field is unreadable, return null for that field. Keep the JSON valid.',
].join('\n')

function toDateString(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* 由 Gemini 回傳文字抽取 JSON（處理 ```json 程式碼塊） */
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

export default async function handler(req, res) {
  // 僅允許 POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed（僅支援 POST）' })
  }

  // 讀取 body（Vercel 會自動將 JSON body 解析為 req.body）
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: '請求 body 不是有效 JSON' })
    }
  }
  const { image, mimeType } = body || {}

  if (!image || typeof image !== 'string' || image.length === 0) {
    return res.status(400).json({ error: '缺少 image（Base64）欄位' })
  }
  if (image.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({ error: '圖片檔案過大（上限約 3MB 原圖）' })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY 尚未設定（請在 Vercel 環境變數中設定）' })
  }

  try {
    const decoded = Buffer.from(image, 'base64')
    const mime = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: GEMINI_PROMPT },
              { inline_data: { mime_type: mime, data: decoded.toString('base64') } },
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

    if (!geminiRes.ok) {
      let message = `Gemini API 回應失敗（HTTP ${geminiRes.status}）`
      try {
        const err = await geminiRes.json()
        if (err && err.error && err.error.message) message = err.error.message
      } catch {
        /* 忽略錯誤 body 解析失敗 */
      }
      return res.status(geminiRes.status).json({ error: message })
    }

    const data = await geminiRes.json()
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
    const extractedAmount = Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null

    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date || ''))
    const extractedDate = dateMatch ? String(parsed.date) : toDateString(new Date())

    const merchant =
      typeof parsed.merchant === 'string' && parsed.merchant.trim()
        ? parsed.merchant.trim().slice(0, 40)
        : 'UNKNOWN'

    if (extractedAmount === null) {
      return res.status(422).json({ error: 'Gemini 未能提取有效金額' })
    }

    return res.status(200).json({
      extractedAmount,
      extractedDate,
      merchant,
      confidence: 95,
      engine: 'gemini',
      model: GEMINI_MODEL,
      source: 'vercel',
    })
  } catch (err) {
    console.error('[ocr] Gemini 呼叫失敗：', err)
    return res.status(500).json({ error: err.message || 'Gemini 呼叫失敗' })
  }
}
