/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 接收 Supabase Storage 上傳後的圖片 URL，由後端辨識：
 *   1. Groq（llama-3.2-11b-vision-preview）— URL 原生支援（需 GROQ_API_KEY）
 *   2. Gemini 1.5 Flash（fallback）— 下載 URL 圖片 → base64 → REST API
 *
 * 環境變數（env 優先，其次 .env.local）：
 *   - GROQ_API_KEY（可選；設定時優先使用 Groq）
 *   - GEMINI_API_KEY（Gemini fallback 必備）
 *
 * 請求：POST /api/ocr
 *   { "imageUrl": "https://.../storage/v1/object/public/receipts/..." }
 * 回應（成功 200）：
 *   { "extractedAmount": 200, "extractedDate": "2018-12-24",
 *     "merchant": "APOLLO SPECTRA", "confidence": 95, "engine": "groq|gemini",
 *     "model": "llama-3.2-11b-vision-preview|gemini-1.5-flash",
 *     "source": "vercel", "imageUrl": "..." }
 * ============================================================ */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* ===== 環境變數（env 優先，其次本地 .env.local） ===== */
function readEnvLocal() {
  try {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    return readFileSync(path.join(rootDir, '.env.local'), 'utf8')
  } catch {
    return ''
  }
}

function getEnvValue(name) {
  if (process.env[name] && process.env[name].trim()) return process.env[name].trim()
  const content = readEnvLocal()
  const match = content.match(new RegExp(`^\\s*${name}\\s*=\\s*(.+?)\\s*$`, 'm'))
  if (match) {
    return match[1].trim().replace(/^["']|["']$/g, '')
  }
  return ''
}

/* Gemini 模型名稱（依序嘗試，避免 404） */
const GEMINI_MODELS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-001',
  'gemini-1.5-pro',
]

const GROQ_MODEL = 'llama-3.2-11b-vision-preview'
const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'

/* 下載圖片上限（bytes） */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/* 要求模型強制回傳純 JSON */
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

/* 由模型回傳文字抽取 JSON（處理 ```json 程式碼塊） */
function extractJson(text) {
  const cleaned = (text || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型回傳內容不含有效 JSON')
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

/* ===== Groq（llama-3.2-11b-vision-preview，URL 原生支援） ===== */
async function callGroq(imageUrl) {
  const apiKey = getEnvValue('GROQ_API_KEY')
  if (!apiKey) throw new Error('GROQ_API_KEY 未設定')

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 256,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Groq API 回應失敗（HTTP ${res.status}）：${detail.slice(0, 500)}`)
  }

  const data = await res.json()
  const text = (data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || ''
  return { provider: 'groq', model: GROQ_MODEL, text }
}

/* ===== 下載 imageUrl 圖片 → base64 ===== */
async function downloadImageAsBase64(imageUrl) {
  const imgRes = await fetch(imageUrl)
  if (!imgRes.ok) {
    throw new Error(`下載圖片失敗（HTTP ${imgRes.status}）`)
  }
  const buffer = Buffer.from(await imgRes.arrayBuffer())
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error(`圖片過大（${buffer.length} bytes，上限 ${MAX_IMAGE_BYTES}）`)
  }
  return buffer.toString('base64')
}

/* ===== Gemini 1.5 Flash（下載 URL → base64 → REST，含模型 fallback） ===== */
async function callGemini(imageUrl) {
  const apiKey = getEnvValue('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY 未設定')

  const base64 = await downloadImageAsBase64(imageUrl)
  let lastError = null

  for (const modelName of GEMINI_MODELS) {
    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: OCR_PROMPT },
                { inline_data: { mime_type: 'image/jpeg', data: base64 } },
              ],
            },
          ],
          generationConfig: { response_mime_type: 'application/json' },
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Gemini REST API 回應失敗（HTTP ${res.status}）：${detail.slice(0, 500)}`)
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
      return { provider: 'gemini', model: modelName, text }
    } catch (err) {
      lastError = err
      console.warn(`[ocr] 模型 ${modelName} 呼叫失敗（${err.message}），嘗試下一個...`)
    }
  }
  throw lastError || new Error('所有 Gemini 模型皆呼叫失敗')
}

/* ===== 辨識入口：Groq 優先（若有 key），失敗 fallback Gemini ===== */
async function recognize(imageUrl) {
  if (getEnvValue('GROQ_API_KEY')) {
    try {
      return await callGroq(imageUrl)
    } catch (err) {
      console.warn('[ocr] Groq 呼叫失敗，改用 Gemini：', err.message)
    }
  }
  return callGemini(imageUrl)
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
  const { imageUrl } = body || {}

  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
    return res.status(400).json({ error: '缺少 imageUrl 欄位' })
  }
  if (!/^https?:\/\//i.test(imageUrl)) {
    return res.status(400).json({ error: 'imageUrl 必須是 http(s) 網址' })
  }
  if (imageUrl.length > 2000) {
    return res.status(400).json({ error: 'imageUrl 過長' })
  }

  try {
    const { provider, model, text } = await recognize(imageUrl.trim())
    console.log(`[ocr] ${provider} (${model}) Raw Response:`, text)

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
      return res.status(422).json({ error: '模型未能提取有效金額' })
    }

    return res.status(200).json({
      extractedAmount,
      extractedDate,
      merchant,
      confidence: 95,
      engine: provider,
      model,
      source: 'vercel',
      imageUrl: imageUrl.trim(),
    })
  } catch (err) {
    const message = (err && err.message) || String(err || '未知錯誤')
    const cause = err && err.cause ? err.cause : null
    const causeText = cause ? (cause.message || String(cause)) : ''
    console.error('[ocr] 辨識失敗：', message, causeText, err)
    return res.status(500).json({
      error: `OCR 辨識失敗：${message}`,
      detail: causeText ? `${message}（原因：${causeText}）` : message,
    })
  }
}

