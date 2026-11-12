const { generateContent } = require('./gemini');
const local = require('./localSentiment');

// Mô hình cục bộ chỉ được tin khi độ tự tin >= ngưỡng này; thấp hơn thì hỏi Gemini.
// Mặc định 0.9 vì mô hình train trên phản hồi sinh viên về trường học nên khá "tự tin quá mức" với đánh giá hàng hóa
// (đo trên 36 câu mẫu: ngưỡng 0.7 vẫn sai 8/22 câu mô hình tự quyết, ngưỡng 0.9 đúng 5/5 nhưng chỉ tự quyết 5/36 câu).
// Khi đã có tập đánh giá thật >= 100 câu, hãy đo lại rồi chỉnh bằng biến môi trường SENTIMENT_CONFIDENCE_THRESHOLD.
const CONFIDENCE_THRESHOLD = Number(process.env.SENTIMENT_CONFIDENCE_THRESHOLD) || 0.9;

const NEUTRAL = { sentiment: 'neutral', score: 3 };

// Đổi xác suất của mô hình thành điểm 1-5: tích cực = 5, trung lập = 3, tiêu cực = 1
function scoreFromProbs(probs) {
  const s = 1 + 4 * (probs.positive + 0.5 * probs.neutral);
  return Math.min(5, Math.max(1, Math.round(s)));
}

async function analyzeWithGemini(text) {
  const prompt = `Phân tích cảm xúc của đánh giá sau (tích cực, trung lập hay tiêu cực).
Trả lời ĐÚNG theo JSON sau, không thêm gì khác:
{"sentiment":"positive"} hoặc {"sentiment":"neutral"} hoặc {"sentiment":"negative"}, và {"score": số từ 1 đến 5}
Ví dụ: {"sentiment":"positive","score":4}

Đánh giá:
---
${text.slice(0, 1000)}
---`;

  const response = await generateContent(prompt);
  if (!response) return null;
  try {
    const jsonStr = response.replace(/```json?\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(jsonStr);
    const sentiment = ['positive', 'neutral', 'negative'].includes(parsed.sentiment) ? parsed.sentiment : 'neutral';
    const score = typeof parsed.score === 'number' ? Math.min(5, Math.max(1, parsed.score)) : 3;
    return { sentiment, score };
  } catch {
    return null;
  }
}

/**
 * Phân tích sentiment của đánh giá.
 * Thứ tự: (1) mô hình tự train chạy cục bộ nếu đủ tự tin,
 *         (2) Gemini nếu mô hình chưa chắc hoặc chưa có,
 *         (3) quay lại kết quả của mô hình (dù chưa chắc), cuối cùng là trung lập.
 * @returns {Promise<{ sentiment: 'positive'|'neutral'|'negative', score: number, source: string, confidence?: number }>}
 */
async function analyzeSentiment(text) {
  if (!text || !text.trim()) return { ...NEUTRAL, source: 'default' };

  const pred = local.predict(text);
  const fromModel = pred && {
    sentiment: pred.sentiment,
    score: scoreFromProbs(pred.probs),
    confidence: Number(pred.confidence.toFixed(4))
  };

  if (fromModel && pred.knownTerms > 0 && pred.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...fromModel, source: 'local-model' };
  }

  const g = await analyzeWithGemini(text);
  if (g) return { ...g, source: 'gemini' };

  if (fromModel && pred.knownTerms > 0) return { ...fromModel, source: 'local-model-low-confidence' };
  return { ...NEUTRAL, source: 'default' };
}

module.exports = { analyzeSentiment };