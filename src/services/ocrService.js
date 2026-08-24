/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * Google Gemini 1.5 Flash SDK（瀏覽器端直接發送）
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, confidence, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 將上傳圖片轉為 inlineData（Base64），直接以官方
 *      @google/generative-ai SDK 呼叫 Gemini 1.5 Flash。
 *   2. Prompt 要求模型強制回傳純 JSON：{"amount", "date", "merchant"}。
 *   3. 解析回傳 JSON → 自動填入表單。
 *   4. 成功 → statusLabel: '✨ Gemini 1.5 Flash AI 辨識成功'；
 *      失敗 → throw Error（供 UI 顯示「❌ 辨識失敗: [錯誤訊息]」）。
 *
 * 環境變數：
 *   - NEXT_PUBLIC_GEMINI_API_KEY（Next.js 慣用名）
 *   - VITE_GEMINI_API_KEY（Vite 相容；兩者擇一）
 * ============================================================ */

import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_MODEL = 'gemini-1.5-flash'

/* 讀取 Gemini API Key：支援 NEXT_PUBLIC_ 與 VITE_ 兩種命名 */
function getGeminiApiKey() {
  if (
    typeof process !== 'undefined' &&
    process.env &&
    process.env.NEXT_PUBLIC_GEMINI_API_KEY
  ) {
    return process.env.NEXT_PUBLIC_GEMINI_API_KEY
  }
  try {
    if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
      return import.meta.env.VITE_GEMINI_API_KEY
    }
  } catch {
    /* import.meta.env 在非 Vite 環境（Node）不可用時忽略 */
  }
  return ''
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

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * ============================================================ */
export async function processReceiptOCR(file) {
  const apiKey = getGeminiApiKey()
  if (!apiKey) {
    throw new Error('未設定 Gemini API Key（NEXT_PUBLIC_GEMINI_API_KEY / VITE_GEMINI_API_KEY）')
  }

  const base64 = await fileToBase64(file)

  try {
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL })

    const prompt =
      '請仔細分析這張收據，精準提取：金額 (amount: 數字)、日期 (date: YYYY-MM-DD)、商戶名稱 (merchant)，' +
      '並強制以純 JSON 格式回傳：{"amount": 200, "date": "2018-12-24", "merchant": "APOLLO SPECTRA"}。' +
      '不要回傳任何 Markdown 標記或其他文字。'

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: file.type || 'image/jpeg' } },
    ])

    const text = result.response.text()
    console.log('Gemini 1.5 Flash Raw Response:', text)

    const parsed = extractJson(text)

    // 驗證與正規化
    const amount = Number(parsed.amount)
    const extractedAmount =
      Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) / 100 : null
    if (extractedAmount === null) {
      throw new Error('Gemini 未能提取有效金額')
    }

    const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date || ''))
    const extractedDate = dateMatch ? String(parsed.date) : null

    const merchant =
      typeof parsed.merchant === 'string' && parsed.merchant.trim()
        ? parsed.merchant.trim().slice(0, 40)
        : 'UNKNOWN'

    return {
      extractedAmount,
      extractedDate,
      merchant,
      confidence: 95,
      engine: 'gemini',
      model: GEMINI_MODEL,
      source: 'client',
      statusLabel: '✨ Gemini 1.5 Flash AI 辨識成功',
    }
  } catch (err) {
    console.error('[ocrService] Gemini 1.5 Flash 辨識失敗：', err)
    throw new Error(err.message || 'Gemini 1.5 Flash 辨識失敗', { cause: err })
  }
}
