/* ============================================================
 * api/ocr.js — Vercel Serverless Function（Node.js）
 *
 * 前端上傳 Base64 圖片 → Server 端呼叫 GitHub Models (GPT-4o-mini Vision)
 * 透過 Server 端呼叫，徹底避開「香港 IP 在前端瀏覽器直接呼叫 AI」的地區限制。
 *
 * 環境變數：GITHUB_TOKEN（必要）
 *   - 正式環境：Vercel Project → Settings → Environment Variables
 *   - 本地測試：寫入 .env.local 並使用 `vercel dev`（或 npx vercel dev）
 *   - Token 未設定時回傳 500 錯誤（不再於程式碼內硬編碼 Token）
 *
 * 請求：POST /api/ocr
 *   { "image": "<base64>", "mimeType": "image/jpeg", "fileName": "x.jpg" }
 * 回應（成功 200）：
 *   { "extractedAmount": 1250.00, "extractedDate": "2026-08-24",
 *     "merchant": "APOLLO", "confidence": 95, "engine": "github",
 *     "model": "gpt-4o-mini", "source": "vercel" }
 * ============================================================ */

const MODEL_NAME = 'gpt-4o-mini'
const CHAT_COMPLETIONS_URL = 'https://models.inference.ai.azure.com/chat/completions'

/* Vercel Node 執行環境的請求 body 上限為 4.5MB，此處保守限制 base64 長度 */
const MAX_BASE64_LENGTH = 4 * 1024 * 1024

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

  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return res.status(500).json({ error: 'GITHUB_TOKEN 尚未設定（請在 Vercel 環境變數中設定）' })
  }

  try {
    const decoded = Buffer.from(image, 'base64')
    const mime = typeof mimeType === 'string' && mimeType.length > 0 ? mimeType : 'image/jpeg'
    const dataUrl = `data:${mime};base64,${decoded.toString('base64')}`

    // GitHub Models（Azure AI Foundry，OpenAI 相容格式）Chat Completions
    const inferenceRes = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
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
      }),
    })

    if (!inferenceRes.ok) {
      const detail = await inferenceRes.text().catch(() => '')
      console.error('[ocr] GitHub Models API 失敗：', inferenceRes.status, detail)
      return res.status(inferenceRes.status).json({
        error: `GitHub Models API 回應失敗（HTTP ${inferenceRes.status}）：${detail.slice(0, 500)}`,
      })
    }

    const data = await inferenceRes.json()
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
    console.error('[ocr] GitHub Models 呼叫失敗：', err)
    return res.status(500).json({ error: err.message || 'GitHub Models 呼叫失敗' })
  }
}
