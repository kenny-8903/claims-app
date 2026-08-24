// Trigger redeploy to pick up GITHUB_TOKEN env variable
/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 前端上傳 Base64 圖片 → Server 端呼叫 GitHub Models (GPT-4o-mini Vision)
 * 透過 Server 端呼叫，徹底避開「香港 IP 在前端瀏覽器直接呼叫 AI」的地區限制。
 *
 * HTTP Client：使用原生 node:https（非全域 fetch），
 *   避免 Vercel 執行環境的全域 fetch 拋出 generic「fetch failed」異常。
 *
 * 環境變數：GITHUB_TOKEN（必要）
 *   - 正式環境：Vercel Project → Settings → Environment Variables
 *   - 本地測試：寫入 .env.local 並使用 `vercel dev`（或 npx vercel dev）
 *   - Token 未設定時回傳 500 錯誤（不在程式碼內硬編碼 Token）
 *
 * 請求：POST /api/ocr
 *   { "image": "<base64 或 data URL>", "mimeType": "image/jpeg", "fileName": "x.jpg" }
 * 回應（成功 200）：
 *   { "extractedAmount": 1250.00, "extractedDate": "2026-08-24",
 *     "merchant": "APOLLO", "confidence": 95, "engine": "github",
 *     "model": "gpt-4o-mini", "source": "vercel" }
 * ============================================================ */

import https from 'node:https'

const MODEL_NAME = 'gpt-4o-mini'
const CHAT_COMPLETIONS_URL = 'https://models.inference.ai.azure.com/chat/completions'

/* Base64 字串長度上限（原圖約 3MB）；Vercel Node 函式 body 上限 4.5MB */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024
/* 解碼後圖片位元組上限 */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/* 要求模型嚴格回傳 JSON（amount / date / merchant） */
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

/* ============================================================
 * 原生 node:https POST 封裝（Promise）
 * 回傳 { status, data }；網路層錯誤（TLS/DNS/逾時）以 reject 拋出
 * ============================================================ */
function httpsPostJson(url, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    let body
    try {
      body = JSON.stringify(bodyObj)
    } catch (err) {
      reject(err)
      return
    }

    let urlObj
    try {
      urlObj = new URL(url)
    } catch (err) {
      reject(err)
      return
    }

    const req = https.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: `${urlObj.pathname}${urlObj.search}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers,
        },
      },
      (res) => {
        const chunks = []
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8')
          let data
          try {
            data = JSON.parse(raw)
          } catch {
            data = raw
          }
          resolve({ status: res.statusCode, data })
        })
        res.on('error', (err) => reject(err))
      },
    )

    req.setTimeout(30000, () => {
      req.destroy(new Error('請求逾時（30 秒）'))
    })
    req.on('error', (err) => reject(err))
    req.write(body)
    req.end()
  })
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
      const meta = imageB64.slice(5, commaIdx) // 例如 "image/png;base64"
      const metaMime = meta.split(';')[0]
      if (metaMime && metaMime.includes('/')) mime = metaMime
      imageB64 = imageB64.slice(commaIdx + 1)
    }
  }
  // 容錯：移除所有空白字元（有些客戶端會插入換行）
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

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN 尚未設定（請在 Vercel 環境變數中設定）' })
  }

  try {
    const dataUrl = `data:${mime};base64,${decoded.toString('base64')}`

    // 原生 node:https 呼叫 GitHub Models（OpenAI 相容格式）Chat Completions
    const inferenceRes = await httpsPostJson(
      CHAT_COMPLETIONS_URL,
      { Authorization: `Bearer ${token}` },
      {
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
      },
    )

    if (inferenceRes.status < 200 || inferenceRes.status >= 300) {
      const detail =
        typeof inferenceRes.data === 'string'
          ? inferenceRes.data
          : JSON.stringify(inferenceRes.data || {})
      console.error('[ocr] GitHub Models API 失敗：', inferenceRes.status, detail)
      return res.status(inferenceRes.status).json({
        error: `GitHub Models API 回應失敗（HTTP ${inferenceRes.status}）：${detail.slice(0, 500)}`,
      })
    }

    const data = inferenceRes.data || {}
    const text =
      (data &&
        data.choices &&
        data.choices[0] &&
        data.choices[0].message &&
        data.choices[0].message.content) ||
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
    // 展開 err.message 與 err.cause，並嘗試取出 response.data 字串化
    const message = (err && err.message) || String(err || '未知錯誤')
    const cause = err && err.cause ? err.cause : null
    const causeText = cause ? (cause.message || String(cause)) : ''
    let responseDataText = ''
    try {
      const respData = err && err.response && err.response.data
      if (respData !== undefined && respData !== null) {
        responseDataText = typeof respData === 'string' ? respData : JSON.stringify(respData)
      }
    } catch {
      /* 忽略 response.data 序列化失敗 */
    }
    const detailText = [
      message,
      causeText ? `原因：${causeText}` : '',
      responseDataText ? `response: ${responseDataText.slice(0, 500)}` : '',
    ]
      .filter(Boolean)
      .join('；')

    console.error('[ocr] GitHub Models 呼叫失敗：', detailText, err)
    return res.status(500).json({
      error: `GitHub Models 呼叫失敗：${message}`,
      detail: detailText,
    })
  }
}

