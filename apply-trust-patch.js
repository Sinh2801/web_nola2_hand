#!/usr/bin/env node
/**
 * Áp dụng tính năng Độ tin cậy người bán + thống kê cảm xúc lên các file cũ của project nlu_nola3_hand.
 * Chạy ở THƯ MỤC GỐC project (nơi có backend/ và frontend/):
 *     node apply-trust-patch.js
 * - Phần backend: kiểm tra toàn bộ trước, chỉ ghi khi mọi chỗ đều khớp (không sửa dở).
 * - Phần giao diện: tìm chỗ chèn linh hoạt; chỗ nào không tìm thấy thì CẢNH BÁO kèm hướng dẫn chèn tay, các chỗ khác vẫn áp dụng.
 * - Chạy lại lần 2 an toàn: phần nào đã áp dụng sẽ được bỏ qua.
 * - Giữ nguyên kiểu xuống dòng (CRLF/LF) của từng file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const norm = (s) => s.replace(/\r\n/g, '\n');
const files = new Map(); // file -> { text, crlf, changed }

function get(file) {
    if (!files.has(file)) {
        const full = path.join(ROOT, file);
        if (!fs.existsSync(full)) throw new Error(`Không thấy file ${file}. Hãy chạy script ở thư mục gốc project.`);
        const raw = fs.readFileSync(full, 'utf8');
        files.set(file, { text: norm(raw), crlf: raw.includes('\r\n'), changed: false });
    }
    return files.get(file);
}

const log = [];
function rep(file, oldStr, newStr, count = 1, skipIf = null) {
    const f = get(file);
    if (skipIf && f.text.includes(skipIf)) { log.push(`  bỏ qua (đã có): ${file}`); return; }
    if (f.text.includes(newStr)) { log.push(`  bỏ qua (đã có): ${file}`); return; }
    const n = f.text.split(oldStr).length - 1;
    if (n !== count) throw new Error(`${file}: cần ${count} vị trí khớp nhưng thấy ${n}:\n${oldStr.slice(0, 120)}`);
    f.text = f.text.split(oldStr).join(newStr);
    f.changed = true;
    log.push(`  đã sửa: ${file}`);
}

const OPS = [
    {
        "file": "backend/models/Review.js",
        "old": "  sentimentScore: {\n    type: Number,\n    min: 1,\n    max: 5,\n    default: null\n  }\n}, {",
        "new": "  sentimentScore: {\n    type: Number,\n    min: 1,\n    max: 5,\n    default: null\n  },\n  // Nguồn quyết định kết quả cảm xúc: local-model | local-model-low-confidence | gemini | default\n  sentimentSource: {\n    type: String,\n    default: null\n  }\n}, {",
        "count": 1,
        "skipIf": "sentimentSource:"
    },
    {
        "file": "backend/controllers/reviewController.js",
        "old": "      analyzeSentiment(review.comment)\n          .then(({ sentiment, score }) => {\n            return Review.findByIdAndUpdate(review._id, { sentiment, sentimentScore: score }, { new: true });\n          })\n          .catch(err => console.error('Sentiment analysis error:', err));\n",
        "new": "      analyzeAndStoreSentiment(review._id, review.comment);\n",
        "count": 1,
        "skipIf": "analyzeAndStoreSentiment(review._id, review.comment);"
    },
    {
        "file": "backend/controllers/reviewController.js",
        "old": "const updateReview = async (req, res) => {",
        "new": "// Phân tích cảm xúc chạy nền và lưu kèm nguồn quyết định (mô hình tự train / Gemini / mặc định)\nconst analyzeAndStoreSentiment = (reviewId, comment) =>\n  analyzeSentiment(comment)\n    .then(({ sentiment, score, source }) => {\n      console.log(`[sentiment] ${source} -> ${sentiment} (${score})`);\n      return Review.findByIdAndUpdate(reviewId, { sentiment, sentimentScore: score, sentimentSource: source || null });\n    })\n    .catch((err) => console.error('Sentiment analysis error:', err));\n\nconst updateReview = async (req, res) => {",
        "count": 1,
        "skipIf": "const analyzeAndStoreSentiment"
    },
    {
        "file": "backend/controllers/reviewController.js",
        "old": "    review.rating = ratingNum;\n    review.comment = comment;\n    await review.save();\n",
        "new": "    const commentChanged = (review.comment || '').trim() !== String(comment || '').trim();\n    review.rating = ratingNum;\n    review.comment = comment;\n    if (commentChanged) {\n      // Nội dung đổi thì kết quả cũ không còn đúng: xóa rồi phân tích lại\n      review.sentiment = null;\n      review.sentimentScore = null;\n      review.sentimentSource = null;\n    }\n    await review.save();\n    if (commentChanged && review.comment && review.comment.trim()) {\n      analyzeAndStoreSentiment(review._id, review.comment);\n    }\n",
        "count": 1,
        "skipIf": "const commentChanged"
    },
    {
        "file": "backend/server.js",
        "old": "const sellerBankQRRoutes = require('./routes/sellerBankQR');",
        "new": "const sellerBankQRRoutes = require('./routes/sellerBankQR');\nconst sellerTrustRoutes = require('./routes/sellerTrust');",
        "count": 1
    },
    {
        "file": "backend/server.js",
        "old": "app.use('/api/seller-bankqr', sellerBankQRRoutes);",
        "new": "app.use('/api/seller-bankqr', sellerBankQRRoutes);\napp.use('/api/seller-trust', sellerTrustRoutes);",
        "count": 1
    }
];;

const warnings = [];
const CARD_IMPORT = "import SellerTrustCard from '../components/SellerTrustCard';";

function addImport(file, line) {
    const f = get(file);
    if (f.text.includes("components/SellerTrustCard'")) return;
    const m = f.text.match(/^import [^\n]* from ['"]react-router-dom['"];?[ \t]*$/m)
        || f.text.match(/^import [^\n]* from ['"]react-redux['"];?[ \t]*$/m)
        || f.text.match(/^import React[^\n]*$/m);
    if (!m) throw new Error('không tìm thấy dòng import để chèn');
    f.text = f.text.slice(0, m.index + m[0].length) + '\n' + line + f.text.slice(m.index + m[0].length);
    f.changed = true;
}

// Chèn một đoạn giao diện; nếu lỗi thì chỉ cảnh báo (không dừng cả đợt)
function soft(file, label, manual, fn) {
    try {
        const f = get(file);
        const before = f.text;
        fn(f);
        if (f.text !== before) { f.changed = true; log.push(`  đã sửa: ${file} (${label})`); }
        else log.push(`  bỏ qua (đã có): ${file} (${label})`);
    } catch (e) {
        warnings.push(`  ! ${file} – ${label}: ${e.message}\n    Làm thủ công: ${manual}`);
    }
}

try {
    // 1) Backend: bắt buộc khớp hết
    for (const o of OPS) rep(o.file, o.old, o.new, o.count, o.skipIf);

    // 2) Giao diện
    const UR = 'frontend/src/pages/UserReviews.jsx';
    soft(UR, 'import', `thêm ${"import SellerTrustCard, { SentimentChip } from '../components/SellerTrustCard';"} ở đầu file`, () => {
        const f = get(UR);
        if (f.text.includes("components/SellerTrustCard'")) return;
        const m = f.text.match(/^import StarRating[^\n]*$/m) || f.text.match(/^import React[^\n]*$/m);
        if (!m) throw new Error('không tìm thấy dòng import');
        f.text = f.text.slice(0, m.index + m[0].length) + "\nimport SellerTrustCard, { SentimentChip } from '../components/SellerTrustCard';" + f.text.slice(m.index + m[0].length);
    });
    soft(UR, 'thẻ độ tin cậy', 'đặt <SellerTrustCard userId={userId} variant="public" /> phía trên khối thống kê đánh giá', () => {
        const f = get(UR);
        if (f.text.includes('<SellerTrustCard')) return;
        const m = f.text.match(/^([ \t]*)\{\/\* Review Stats \*\/\}[ \t]*$/m)
            || f.text.match(/^([ \t]*)<div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6 shadow-sm">/m);
        if (!m) throw new Error('không tìm thấy khối thống kê đánh giá');
        f.text = f.text.slice(0, m.index) + `${m[1]}<SellerTrustCard userId={userId} variant="public" />\n\n` + f.text.slice(m.index);
    });
    soft(UR, 'nhãn cảm xúc từng đánh giá', 'thêm {review.sentiment && <SentimentChip sentiment={review.sentiment} score={review.sentimentScore} />} dưới nội dung bình luận', () => {
        const f = get(UR);
        if (f.text.includes('<SentimentChip')) return;
        const m = f.text.match(/^([ \t]*)\{review\.productId && \(/m);
        if (!m) throw new Error('không tìm thấy khối sản phẩm trong mỗi đánh giá');
        const i = m[1];
        f.text = f.text.slice(0, m.index) +
            `${i}{review.sentiment && (\n${i}  <div className="mt-2 ml-13">\n${i}    <SentimentChip sentiment={review.sentiment} score={review.sentimentScore} />\n${i}  </div>\n${i})}\n\n` + f.text.slice(m.index);
    });

    const SD = 'frontend/src/pages/SellerDashboard.jsx';
    soft(SD, 'import', `thêm ${CARD_IMPORT} ở đầu file`, () => addImport(SD, CARD_IMPORT));
    soft(SD, 'thẻ ở tab Đánh giá', 'trong khối {activeTab === \'reviews\' && ...}, ngay sau thẻ <div> mở đầu, thêm <SellerTrustCard userId={userId || user.id} variant="owner" />', () => {
        const f = get(SD);
        if (f.text.includes('<SellerTrustCard')) return;
        const m = f.text.match(/\{activeTab === ['"]reviews['"][^\n]*\n([ \t]*)<div[^>\n]*>[ \t]*\n/);
        if (!m) throw new Error("không tìm thấy khối {activeTab === 'reviews' ...}");
        const end = m.index + m[0].length;
        f.text = f.text.slice(0, end) + `${m[1]}  <SellerTrustCard userId={userId || user.id} variant="owner" />\n` + f.text.slice(end);
    });

    const PD = 'frontend/src/pages/ProductDetail.jsx';
    soft(PD, 'import', `thêm ${CARD_IMPORT} ở đầu file`, () => addImport(PD, CARD_IMPORT));
    soft(PD, 'thẻ gọn dưới "Người bán"', 'dưới thẻ <Link> của người bán, thêm <SellerTrustCard userId={product.userId?._id} variant="compact" />', () => {
        const f = get(PD);
        if (f.text.includes('<SellerTrustCard')) return;
        const m = f.text.match(/Người bán<\/h3>[\s\S]*?\n([ \t]*)<\/Link>[ \t]*\n/);
        if (!m) throw new Error('không tìm thấy khối "Người bán"');
        const end = m.index + m[0].length;
        f.text = f.text.slice(0, end) + `${m[1]}<SellerTrustCard userId={product.userId?._id} variant="compact" />\n` + f.text.slice(end);
    });

    let written = 0;
    for (const [file, f] of files) {
        if (!f.changed) continue;
        fs.writeFileSync(path.join(ROOT, file), f.crlf ? f.text.replace(/\n/g, '\r\n') : f.text, 'utf8');
        written++;
    }
    console.log(log.join('\n'));
    if (warnings.length) console.log('\nCẢNH BÁO (một số chỗ ở giao diện cần chèn tay):\n' + warnings.join('\n'));
    console.log(`\nXong. Đã ghi ${written} file.`);
} catch (e) {
    console.error('\nLỖI: ' + e.message + '\nKhông có file nào bị thay đổi.');
    process.exit(1);
}