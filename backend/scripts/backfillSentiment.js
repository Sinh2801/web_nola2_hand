// Chạy: node scripts/backfillSentiment.js            -> phân tích các đánh giá có bình luận nhưng chưa có cảm xúc
//       node scripts/backfillSentiment.js --all      -> phân tích lại TẤT CẢ đánh giá có bình luận (để ghi nguồn quyết định)
//       node scripts/backfillSentiment.js --dry      -> chỉ in ra sẽ xử lý bao nhiêu đánh giá, không ghi gì
// Dùng để bổ sung dữ liệu cho các đánh giá tạo trước khi có tính năng thống kê cảm xúc.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Review = require('../models/Review');
const { analyzeSentiment } = require('../utils/sentimentAnalysis');

const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const filter = { comment: { $exists: true, $nin: [null, ''] } };
        if (!ALL) filter.sentiment = null;

        const total = await Review.countDocuments(filter);
        console.log(`Có ${total} đánh giá cần xử lý${ALL ? ' (chế độ --all)' : ''}.`);
        if (DRY || total === 0) return;

        const stats = {};
        let done = 0;
        for await (const r of Review.find(filter).select('comment').cursor()) {
            if (!r.comment || !r.comment.trim()) continue;
            const { sentiment, score, source } = await analyzeSentiment(r.comment);
            await Review.updateOne({ _id: r._id }, { sentiment, sentimentScore: score, sentimentSource: source || null });
            stats[source] = (stats[source] || 0) + 1;
            done++;
            if (done % 20 === 0) console.log(`  đã xử lý ${done}/${total}`);
            if (source === 'gemini') await sleep(400);   // tránh vượt giới hạn tốc độ của API
        }
        console.log(`Xong ${done} đánh giá. Nguồn quyết định:`, stats);
    } catch (e) {
        console.error('Lỗi:', e.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();