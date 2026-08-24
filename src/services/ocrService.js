/* ============================================================
 * ocrService.js — 單據 OCR 辨識服務
 * Supabase Storage 上傳 → 圖片 URL → Vercel Serverless（api/ocr.js）
 *
 * 使用方式：
 *   import { processReceiptOCR } from '../services/ocrService'
 *   const { extractedAmount, extractedDate, merchant, imageUrl, statusLabel } =
 *     await processReceiptOCR(file)
 *
 * 運作邏輯：
 *   1. 將單據圖片上傳至 Supabase Storage 的 'receipts' bucket。
 *   2. 取得 Public URL（https://.../storage/v1/object/public/receipts/...）。
 *   3. POST /api/ocr 傳送 { imageUrl }，由後端（Groq / Gemini）辨識。
 *   4. 解析回傳 JSON → 自動填入金額 / 日期 / 商戶，並保存圖片 URL。
 *
 * 環境變數（.env.local，git-ignored）：
 *   VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY（Supabase Project）
 * ============================================================ */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_BUCKET = 'receipts'

/* 建立 Supabase 客戶端（未設定 env 時拋出明確錯誤） */
function getSupabase() {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('請先設定 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY（.env.local）')
  }
  return createClient(url, anonKey)
}

/* ===== 上傳圖片至 Supabase Storage → 回傳 Public URL ===== */
async function uploadToSupabase(file) {
  const supabase = getSupabase()

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
    console.error('[ocrService] Supabase 上傳失敗：', error)
    throw new Error(`Supabase 上傳失敗：${error ? error.message : '未知錯誤'}`)
  }

  const { data: publicUrlData } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(filePath)
  const imageUrl = publicUrlData.publicUrl
  console.log('[ocrService] Supabase Public URL:', imageUrl)
  return imageUrl
}

/* ===== 呼叫 /api/ocr（傳送 imageUrl，由後端辨識） ===== */
async function callOCRBackend(imageUrl) {
  console.log('[ocrService] POST /api/ocr，imageUrl:', imageUrl)

  const res = await fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
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
 * 上傳 → URL → 後端辨識 → 回傳結果
 * ============================================================ */
export async function processReceiptOCR(file) {
  const imageUrl = await uploadToSupabase(file)
  const data = await callOCRBackend(imageUrl)

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
    imageUrl,
    engine: data.engine || 'gemini',
    model: data.model || 'gemini-1.5-flash',
    source: 'vercel',
    statusLabel:
      data.engine === 'groq'
        ? '✨ Groq Vision AI 辨識成功'
        : '✨ Gemini 1.5 Flash AI 辨識成功',
  }
}
