/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 使用官方 @google/generative-ai SDK 呼叫 Gemini 1.5 Flash（純 Server 端）
 * 接收前端 Base64 圖片 → 要求模型強制回傳純 JSON，繞過香港 IP 限制。
 *
 * 環境變數：GEMINI_API_KEY（env 優先，其次本地 .env.local）
 *   - 正式環境：Vercel Project → Settings → Environment Variables
 *
 * 請求：POST /api/ocr
 *   { "image": "<base64 或 data URL>", "mimeType": "image/jpeg",
 *     "fileName": "x.jpg", "imageUrl": "<supabase public url，可選>" }
 * 回應（成功 200）：
 *   { "extractedAmount": 200, "extractedDate": "2018-12-24",
 *     "merchant": "APOLLO SPECTRA", "confidence": 95, "engine": "gemini",
 *     "model": "gemini-1.5-flash", "source": "vercel", "imageUrl": "..." }
 * ============================================================ */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* 讀取 API Key：優先 process.env.GEMINI_API_KEY，其次本地 .env.local */
function getGeminiApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim()
  try {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const content = readFileSync(path.join(rootDir, '.env.local'), 'utf8')
    const match = content.match(/^\s*GEMINI_API_KEY\s*=\s*(.+?)\s*$/m)
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env.local 不存在或不可讀時忽略 */
  }
  return ''
}

/* Gemini 客戶端（Server 端初始化） */
const genAI = new GoogleGenerativeAI(getGeminiApiKey())

/* 模型名稱（gemini-2.0-flash 優先；失敗自動 fallback 至 gemini-1.5-flash 等） */
const GEMINI_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-001',
]

/* Base64 壓縮防護：限制字串長度（原圖約 3MB）與解碼後位元組數 */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/* 要求 Gemini 強制回傳純 JSON（amount / date / merchant） */
const OCR_PROMPT =
  '請仔細分析這張收據，精準提取：金額 (amount: 數字)、日期 (date: YYYY-MM-DD)、商戶名稱 (merchant)，' +
  '並強制以純 JSON 格式回傳，例如：{"amount": 200, "date": "2018-12-24", "merchant": "APOLLO SPECTRA"}。' +
  '不要回傳任何 Markdown 標記或其他文字。'

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

/* 依序嘗試各 Gemini 模型；成功回傳 { modelName, text }，全部失敗拋出最後錯誤 */
async function generateWithFallback(base64, mimeType) {
  let lastError = null
  for (const modelName of GEMINI_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent([
        OCR_PROMPT,
        { inlineData: { data: base64, mimeType } },
      ])
      return { modelName, text: result.response.text() }
    } catch (err) {
      lastError = err
      console.warn(`[ocr] 模型 ${modelName} 呼叫失敗（${err.message}），嘗試下一個...`)
    }
  }
  throw lastError || new Error('所有 Gemini 模型皆呼叫失敗')
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
  const { image, mimeType, imageUrl } = body || {}

  /* ===== 提取 Base64（去掉 data:image/...;base64, 標頭並移除空白） ===== */
  let imageB64 = typeof image === 'string' ? image.trim() : ''
  let mime = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'

  if (imageB64.startsWith('data:')) {
    const commaIdx = imageB64.indexOf(',')
    if (commaIdx !== -1) {
      const meta = imageB64.slice(5, commaIdx)
      const metaMime = meta.split(';')[0]
      if (metaMime && metaMime.includes('/')) mime = metaMime
      imageB64 = imageB64.slice(commaIdx + 1)
    }
  }
  imageB64 = imageB64.replace(/\s+/g, '')

  if (!imageB64) {
    return res.status(400).json({ error: '缺少 image（Base64）欄位' })
  }
  if (imageB64.length > MAX_BASE64_LENGTH) {
    return res.status(413).json({
      error: `圖片檔案過大：Base64 長度 ${imageB64.length} 超過上限 ${MAX_BASE64_LENGTH}（原圖約 3MB）`,
    })
  }

  let decoded
  try {
    decoded = Buffer.from(imageB64, 'base64')
  } catch {
    return res.status(400).json({ error: 'image 欄位不是有效的 Base64 資料' })
  }
  if (decoded.length === 0) {
    return res.status(400).json({ error: 'image 欄位為空' })
  }
  if (decoded.length > MAX_IMAGE_BYTES) {
    return res.status(413).json({
      error: `解碼後圖片大小 ${decoded.length} bytes 超過上限 ${MAX_IMAGE_BYTES}`,
    })
  }

  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY 尚未設定（請在 Vercel 環境變數或 .env.local 中設定）',
    })
  }

  try {
    // 官方 Gemini SDK：inlineData（Base64），模型名稱自動 fallback
    const { modelName, text } = await generateWithFallback(
      decoded.toString('base64'),
      mime,
    )
    console.log(`[ocr] Gemini (${modelName}) Raw Response:`, text)

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

    if (extractedAmount === null) {
      return res.status(422).json({ error: 'Gemini 未能提取有效金額' })
    }

    return res.status(200).json({
      extractedAmount,
      extractedDate,
      merchant,
      confidence: 95,
      engine: 'gemini',
      model: modelName,
      source: 'vercel',
      imageUrl:
        typeof imageUrl === 'string' && imageUrl.trim() ? imageUrl.trim() : null,
    })
  } catch (err) {
    const message = (err && err.message) || String(err || '未知錯誤')
    const cause = err && err.cause ? err.cause : null
    const causeText = cause ? (cause.message || String(cause)) : ''
    console.error('[ocr] Gemini 呼叫失敗：', message, causeText, err)
    return res.status(500).json({
      error: `Gemini 呼叫失敗：${message}`,
      detail: causeText ? `${message}（原因：${causeText}）` : message,
    })
  }
}

