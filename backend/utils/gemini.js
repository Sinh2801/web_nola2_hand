const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

let ai = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) return null;
  if (!ai) ai = new GoogleGenAI({ apiKey: apiKey.trim() });
  return ai;
}

// Thứ tự thử: model mới nhất trước, 404/429 thì thử model kế
const MODEL_NAMES = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

// Giữ gemini-embedding-001 vì vector index hiện tại là 3072 chiều
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIM = Number(process.env.EMBEDDING_DIM) || 3072;

function classify(err) {
  const msg = err?.message || '';
  const s = err?.status;
  return {
    msg,
    is404: s === 404 || msg.includes('404') || msg.includes('not found'),
    is429: s === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('Too Many'),
    isAuth: s === 401 || s === 403 || msg.includes('401') || msg.includes('403'),
  };
}

/**
 * Gọi Gemini one-shot. Thử model kế tiếp nếu 404/429.
 * @returns {Promise<string|null>}
 */
async function generateContent(prompt) {
  const client = getClient();
  if (!client) return null;

  for (const model of MODEL_NAMES) {
    try {
      const res = await client.models.generateContent({ model, contents: prompt });
      return res.text;
    } catch (err) {
      const { msg, is404, is429, isAuth } = classify(err);
      if (isAuth) { console.error('Gemini auth error:', msg); return null; }
      if (is404 || is429) continue;
      console.error('Gemini generateContent error:', msg);
      return null;
    }
  }
  console.warn('Gemini: tất cả model đều lỗi (404/429).');
  return null;
}

/**
 * Tạo phiên chat có lịch sử (thay cho model.startChat() của SDK cũ).
 * history: [{ role: 'user' | 'model', parts: [{ text }] }]
 */
function createChat({ history = [], systemInstruction, model = MODEL_NAMES[0] } = {}) {
  const client = getClient();
  if (!client) return null;
  return client.chats.create({
    model,
    history,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
}

/**
 * Tạo embedding cho một đoạn text.
 * @returns {Promise<number[]|null>}
 */
async function generateEmbedding(text) {
  const client = getClient();
  if (!client || !text || !text.trim()) return null;

  try {
    const res = await client.models.embedContent({
      model: EMBEDDING_MODEL,
      contents: text.trim().slice(0, 2000),
      config: { outputDimensionality: EMBEDDING_DIM },
    });
    const values = res?.embeddings?.[0]?.values;
    return Array.isArray(values) && values.length > 0 ? values : null;
  } catch (err) {
    const { msg, is429 } = classify(err);
    if (is429) console.warn(`[Embedding] Hết quota (${EMBEDDING_MODEL}).`);
    else console.error(`[Embedding] Lỗi ${EMBEDDING_MODEL}:`, msg);
    return null;
  }
}

module.exports = { getClient, createChat, generateContent, generateEmbedding, MODEL_NAMES };