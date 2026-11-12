const fs = require('fs');
const path = require('path');

/**
 * Chạy mô hình phân loại cảm xúc tự huấn luyện (TF-IDF + Logistic Regression) ngay trong Node.js.
 * Mô hình được tạo bởi ml/sentiment/train_sentiment.py và lưu ở backend/ml/sentiment-model.json.
 * Nếu chưa có file mô hình thì predict() trả về null để hệ thống dùng phương án dự phòng (Gemini).
 */
const MODEL_PATH = process.env.SENTIMENT_MODEL_PATH || path.join(__dirname, '../ml/sentiment-model.json');

let model = null;
let loaded = false;

function loadModel() {
    if (loaded) return model;
    loaded = true;
    try {
        const json = JSON.parse(fs.readFileSync(MODEL_PATH, 'utf8'));
        if (json.format_version !== 1 || !json.terms || !Array.isArray(json.labels) || json.labels.length !== 3) {
            throw new Error('file mô hình sai định dạng');
        }
        model = json;
        const m = json.metadata || {};
        console.log(`[sentiment] Đã nạp mô hình cục bộ (${m.dataset?.name || '?'}, ${m.n_terms || '?'} đặc trưng, macro-F1 test ${m.test_metrics?.macro_f1 ?? '?'})`);
    } catch (e) {
        model = null;
        if (e.code !== 'ENOENT') console.error('[sentiment] Không nạp được mô hình cục bộ:', e.message);
    }
    return model;
}

// PHẢI giống hệt hàm preprocess trong ml/sentiment/train_sentiment.py
function preprocess(text) {
    return String(text)
        .normalize('NFC')
        .toLowerCase()
        .replace(/https?:\/\/\S+|www\.\S+/g, ' ')
        .replace(/([\p{L}\p{N}])\1{2,}/gu, '$1')   // "quáááá" -> "quá"
        .trim();
}

function tokenize(text) {
    return text.match(/[\p{L}\p{N}_]+/gu) || [];
}

/**
 * @returns {null | { sentiment, probs, confidence, knownTerms }}
 *   null nếu chưa có mô hình hoặc văn bản không có từ nào.
 */
function predict(text) {
    const m = loadModel();
    if (!m || !text || !String(text).trim()) return null;

    const tokens = tokenize(preprocess(text));
    if (tokens.length === 0) return null;

    // Đếm unigram + bigram có trong từ vựng của mô hình
    const counts = new Map();
    const add = (term) => {
        if (m.terms[term]) counts.set(term, (counts.get(term) || 0) + 1);
    };
    for (let i = 0; i < tokens.length; i++) {
        add(tokens[i]);
        if (i + 1 < tokens.length) add(`${tokens[i]} ${tokens[i + 1]}`);
    }

    const logits = m.intercept.slice();
    let norm = 0;
    const weighted = [];
    for (const [term, count] of counts) {
        const [idf] = m.terms[term];
        const tf = m.sublinear_tf ? 1 + Math.log(count) : count;
        const x = tf * idf;
        weighted.push([term, x]);
        norm += x * x;
    }
    norm = Math.sqrt(norm);

    // Không có từ nào quen thuộc: không đủ cơ sở để kết luận
    if (norm === 0) {
        return { sentiment: 'neutral', probs: { negative: 1 / 3, neutral: 1 / 3, positive: 1 / 3 }, confidence: 0, knownTerms: 0 };
    }

    for (const [term, x] of weighted) {
        const w = m.terms[term];
        const v = x / norm;
        for (let k = 0; k < 3; k++) logits[k] += v * w[k + 1];
    }

    const max = Math.max(...logits);
    const exps = logits.map((l) => Math.exp(l - max));
    const sum = exps.reduce((a, b) => a + b, 0);
    const p = exps.map((e) => e / sum);

    let best = 0;
    for (let k = 1; k < 3; k++) if (p[k] > p[best]) best = k;

    return {
        sentiment: m.labels[best],
        probs: { [m.labels[0]]: p[0], [m.labels[1]]: p[1], [m.labels[2]]: p[2] },
        confidence: p[best],
        knownTerms: counts.size
    };
}

const isAvailable = () => loadModel() !== null;
const modelInfo = () => (loadModel() ? loadModel().metadata : null);

module.exports = { predict, isAvailable, modelInfo, preprocess, tokenize };