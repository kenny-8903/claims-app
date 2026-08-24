/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * Supabase Storage 上傳（可選）→ Base64 + imageUrl → Vercel Serverless
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, imageUrl, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 若已設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY，將圖片上傳至
 *      'receipts' bucket 取得 Public URL（未設定則靜默略過，不顯示警告）。
 *   2. POST /api/ocr 傳送 { image: base64, mimeType, fileName, imageUrl }，
 *      由後端（Gemini 1.5 Flash）辨識。
 *   3. 解析回傳 JSON → 自動填入金額 / 日期 / 商戶，並保存圖片 URL。
 * ============================================================ */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_BUCKET = 'receipts'

/* 讀取 Supabase 設定（未設定或不可用時回傳 null，前端不顯示任何警告） */
function getSupabaseConfig() {
  try {
    const env = import.meta.env || {}
    const url = env.VITE_SUPABASE_URL
    const anonKey = env.VITE_SUPABASE_ANON_KEY
    if (!url || !anonKey) return null
    return { url, anonKey }
  } catch {
    return null
  }
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

/* ===== 上傳至 Supabase Storage（best-effort：未設定或失敗則略過） ===== */
async function uploadToSupabase(file) {
  const config = getSupabaseConfig()
  if (!config) {
    console.log('[ocrService] 未設定 VITE_SUPABASE_URL / ANON_KEY，略過 Supabase 上傳。')
    return ''
  }

  const supabase = createClient(config.url, config.anonKey)
  const safeName = (file.name || 'receipt').replace(/[^\w.-]/g, '_')
  const filePath = `${Date.now()}-${safeName}`

  console.log(`[ocrService] 上傳至 Supabase Storage（bucket: ${SUPABASE_BUCKET}，path: ${filePath}）`)
  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    })

  if (error || !data) {
    console.error('[ocrService] Supabase 上傳失敗（略過，改以 Base64 送後端）：', error)
    return ''
  }

  const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath)
  const imageUrl = publicUrlData.publicUrl
  console.log('[ocrService] Supabase Public URL:', imageUrl)
  return imageUrl
}

/* ===== 呼叫 /api/ocr（傳送 Base64 + imageUrl，由後端辨識） ===== */
async function callOCRBackend(payload) {
  console.log('[ocrService] POST /api/ocr，imageUrl:', payload.imageUrl || '（無）')

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
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
  return data
}

/* ============================================================
 * 主要入口：processReceiptOCR(file)
 * ============================================================ */
export async function processReceiptOCR(file) {
  const imageUrl = await uploadToSupabase(file)
  const base64 = await fileToBase64(file)

  const data = await callOCRBackend({
    image: base64,
    mimeType: file.type || 'image/jpeg',
    fileName: file.name || 'receipt',
    imageUrl,
  })

  // 驗證與正規化回傳欄位
  const amount = Number(data.extractedAmount)
  const extractedAmount = Number.isFinite(amount) && amount > 0 ? amount : null
  if (extractedAmount === null) {
    throw new Error('OCR API 未回傳有效金額')
  }

  const dateMatch = /^\d{4}-\d{2}-\d{2}$/.test(String(data.extractedDate || ''))
  const extractedDate = dateMatch ? String(data.extractedDate) : ''

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
    imageUrl: data.imageUrl || imageUrl || '',
    engine: data.engine || 'gemini',
    model: data.model || 'gemini-1.5-flash',
    source: 'vercel',
    statusLabel: '✨ Gemini 1.5 Flash AI 辨識成功',
  }
}
