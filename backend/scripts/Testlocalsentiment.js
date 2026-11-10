// Chạy: node scripts/testLocalSentiment.js            -> thử vài câu mẫu
//       node scripts/testLocalSentiment.js --parity ../ml/sentiment/outputs/parity.json
//                                                      -> kiểm tra Node cho kết quả giống Python
const fs = require('fs');
const path = require('path');
const { predict, isAvailable, modelInfo } = require('../utils/localSentiment');

if (!isAvailable()) {
    console.error('Chưa có backend/ml/sentiment-model.json. Hãy chạy ml/sentiment/train_sentiment.py trước.');
    process.exit(1);
}
console.log('Thông tin mô hình:', JSON.stringify(modelInfo().test_metrics), '| dataset:', modelInfo().dataset.name);

const i = process.argv.indexOf('--parity');
if (i !== -1) {
    const file = path.resolve(process.argv[i + 1] || '../ml/sentiment/outputs/parity.json');
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const names = ['negative', 'neutral', 'positive'];
    let maxDiff = 0, bad = 0;
    for (const r of rows) {
        const p = predict(r.text);
        if (!p) { bad++; continue; }
        for (let k = 0; k < 3; k++) maxDiff = Math.max(maxDiff, Math.abs(p.probs[names[k]] - r.probs[k]));
    }
    console.log(`Parity ${rows.length} câu: chênh lệch xác suất lớn nhất = ${maxDiff.toExponential(2)}; câu không dự đoán được = ${bad}`);
    process.exit(maxDiff < 1e-4 && bad === 0 ? 0 : 1);
}

const samples = [
    'Người bán nhiệt tình, hàng đúng mô tả, giao nhanh',
    'Hàng lỗi, người bán trả lời cộc lốc, không bao giờ mua nữa',
    'Hàng bình thường, tạm được',
    'Sản phẩm rất tốt, đóng gói cẩn thận, cảm ơn shop nhiều!!!',
    'Giao hàng chậm, sản phẩm không giống hình'
];
for (const s of samples) {
    const p = predict(s);
    console.log(`${p.sentiment.padEnd(9)} ${(p.confidence * 100).toFixed(1).padStart(5)}%  ${s}`);
}