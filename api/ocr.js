/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 使用官方 openai SDK 呼叫 GitHub Models（GPT-4o-mini Vision）
 * baseURL: https://models.inference.ai.azure.com
 * 透過 Server 端呼叫，徹底避開「香港 IP 在前端瀏覽器直接呼叫 AI」的地區限制。
 *
 * 環境變數：GITHUB_TOKEN（必要；未設定時自動讀取本地 .env.local）
 *   - 正式環境：Vercel Project → Settings → Environment Variables
 *   - 本地測試：寫入 .env.local 並使用 `vercel dev`（或 npx vercel dev）
 *
 * 請求：POST /api/ocr
 *   { "image": "<base64 或 data URL>", "mimeType": "image/jpeg", "fileName": "x.jpg" }
 * 回應（成功 200）：
 *   { "extractedAmount": 200, "extractedDate": "2018-12-24",
 *     "merchant": "APOLLO", "confidence": 95, "engine": "github",
 *     "model": "gpt-4o-mini", "source": "vercel" }
 * ============================================================ */

import OpenAI from 'openai'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/* 讀取 Token：優先環境變數 GITHUB_TOKEN，其次本地 .env.local（供 Node 直跑 / vercel dev） */
function getGithubToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
    const content = readFileSync(path.join(rootDir, '.env.local'), 'utf8')
    const match = content.match(/^\s*GITHUB_TOKEN\s*=\s*(.+?)\s*$/m)
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* .env.local 不存在或不可讀時忽略 */
  }
  return ''
}

/* 官方 openai SDK 客戶端（GitHub Models 走 OpenAI 相容 endpoint） */
const client = new OpenAI({
  baseURL: 'https://models.inference.ai.azure.com',
  apiKey: getGithubToken(),
})

const MODEL_NAME = 'gpt-4o-mini'

/* Base64 字串長度上限（原圖約 3MB）；Vercel Node 函式 body 上限 4.5MB */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024
/* 解碼後圖片位元組上限 */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/* 要求 AI 強制回傳 JSON（amount / date / merchant） */
const OCR_PROMPT =
  '請讀取這張單據圖片，僅回傳 JSON：{"amount": 數字, "date": "YYYY-MM-DD", "merchant": "商戶名稱"}。' +
  '不要回傳任何 Markdown 標記或其他文字。若某欄位無法讀取，請回傳 null。'

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

  /* ===== Base64 容錯與長度檢查 ===== */
  let imageB64 = typeof image === 'string' ? image.trim() : ''
  let mime = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'

  // 容錯：允許 data URL 前綴（data:image/png;base64,...），並由 meta 推導 mimeType
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

  try {
    const dataUrl = `data:${mime};base64,${decoded.toString('base64')}`

    // 官方 openai SDK：Chat Completions（GPT-4o-mini Vision）
    const completion = await client.chat.completions.create({
      model: MODEL_NAME,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: OCR_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 256,
      response_format: { type: 'json_object' },
    })

    const text =
      (completion &&
        completion.choices &&
        completion.choices[0] &&
        completion.choices[0].message &&
        completion.choices[0].message.content) ||
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
      return res.status(422).json({ error: '模型未能提取有效金額' })
    }

    return res.status(200).json({
      extractedAmount,
      extractedDate,
      merchant,
      confidence: 95,
      engine: 'github',
      model: MODEL_NAME,
      source: 'vercel',
    })
  } catch (err) {
    const message = (err && err.message) || String(err || '未知錯誤')
    const cause = err && err.cause ? err.cause : null
    const causeText = cause ? (cause.message || String(cause)) : ''
    console.error('[ocr] OpenAI SDK 呼叫失敗：', message, causeText, err)
    return res.status(500).json({
      error: `GitHub Models 呼叫失敗：${message}`,
      detail: causeText ? `${message}（原因：${causeText}）` : message,
    })
  }
}

