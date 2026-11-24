const mongoose = require('mongoose');
const Review = require('../models/Review');
const Order = require('../models/Order');
const User = require('../models/User');

/**
 * Điểm tin cậy người bán (0-100) – công thức công khai, dễ giải thích:
 *   Điểm sao đánh giá      tối đa 40  (trung bình có hiệu chỉnh Bayesian để ít đánh giá không bị thổi phồng)
 *   Cảm xúc bình luận (AI) tối đa 25  ((tích cực - tiêu cực) / (số bình luận đã phân tích + 2))
 *   Lịch sử giao dịch      tối đa 20  (số đơn hoàn thành tối đa 10 đơn + tỉ lệ trả hàng)
 *   Độ tin cậy tài khoản   tối đa 15  (đã xác thực 8 điểm + tuổi tài khoản tối đa 180 ngày 7 điểm)
 * Đây là chỉ số THAM KHẢO, không phải bảo đảm an toàn giao dịch.
 */
const PRIOR_MEAN = 3.5;
const PRIOR_WEIGHT = 3;
const MIN_REVIEWS = 3;

const round1 = (x) => Math.round(x * 10) / 10;
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

function levelOf(score, enoughData) {
    if (!enoughData) return { key: 'insufficient', label: 'Chưa đủ dữ liệu' };
    if (score >= 80) return { key: 'high', label: 'Rất tin cậy' };
    if (score >= 65) return { key: 'good', label: 'Tin cậy' };
    if (score >= 50) return { key: 'caution', label: 'Cần thận trọng' };
    return { key: 'risk', label: 'Rủi ro cao' };
}

function computeTrust({ ratingCounts, sentimentCounts, pending = 0, noComment = 0, mismatch = 0, bySource = {},
                          completed = 0, returned = 0, ageDays = 0, isVerified = false }) {
    const n = [1, 2, 3, 4, 5].reduce((s, k) => s + (ratingCounts[k] || 0), 0);
    const sum = [1, 2, 3, 4, 5].reduce((s, k) => s + k * (ratingCounts[k] || 0), 0);
    const average = n > 0 ? sum / n : 0;
    const bayes = (PRIOR_WEIGHT * PRIOR_MEAN + sum) / (PRIOR_WEIGHT + n);
    const ratingPoints = ((bayes - 1) / 4) * 40;

    const pos = sentimentCounts.positive || 0;
    const neu = sentimentCounts.neutral || 0;
    const neg = sentimentCounts.negative || 0;
    const analyzed = pos + neu + neg;
    const s = (pos - neg) / (analyzed + 2);
    const sentimentPoints = ((s + 1) / 2) * 25;

    const finished = completed + returned;
    const returnRate = finished > 0 ? returned / finished : 0;
    const txPoints = 14 * (Math.min(completed, 10) / 10) + (finished > 0 ? 6 * (1 - Math.min(returnRate / 0.2, 1)) : 3);

    const accountPoints = (isVerified ? 8 : 0) + 7 * (Math.min(Math.max(ageDays, 0), 180) / 180);

    const score = Math.round(ratingPoints + sentimentPoints + txPoints + accountPoints);
    const enoughData = n >= MIN_REVIEWS;
    const level = levelOf(score, enoughData);

    const positiveShare = pct(pos, analyzed);
    const negativeShare = pct(neg, analyzed);

    const signals = [];
    if (completed >= 5) signals.push({ type: 'good', text: `Đã bán thành công ${completed} đơn hàng` });
    if (isVerified) signals.push({ type: 'good', text: 'Tài khoản đã được xác thực' });
    if (n >= 5 && average >= 4.5) signals.push({ type: 'good', text: `Điểm đánh giá trung bình cao (${round1(average)}/5 từ ${n} đánh giá)` });
    if (analyzed >= 5 && positiveShare >= 70) signals.push({ type: 'good', text: `${positiveShare}% bình luận có nội dung tích cực` });

    if (n >= MIN_REVIEWS && average < 3.5) signals.push({ type: 'warn', text: `Điểm đánh giá trung bình thấp (${round1(average)}/5)` });
    if (analyzed >= 5 && negativeShare >= 30) signals.push({ type: 'warn', text: `${negativeShare}% bình luận có nội dung tiêu cực (do AI phân tích, có thể chưa chính xác)` });
    if (finished >= 5 && returnRate >= 0.2) signals.push({ type: 'warn', text: `Tỉ lệ trả hàng cao (${Math.round(returnRate * 100)}%)` });
    if (ageDays < 14) signals.push({ type: 'warn', text: 'Tài khoản mới tạo dưới 2 tuần' });
    if (n < MIN_REVIEWS) signals.push({ type: 'info', text: `Mới có ${n} đánh giá, chưa đủ để kết luận về người bán` });

    return {
        score,
        level,
        enoughData,
        components: {
            rating: { points: Math.round(ratingPoints), max: 40, label: 'Điểm sao đánh giá' },
            sentiment: { points: Math.round(sentimentPoints), max: 25, label: 'Cảm xúc bình luận (AI)' },
            transactions: { points: Math.round(txPoints), max: 20, label: 'Lịch sử giao dịch' },
            account: { points: Math.round(accountPoints), max: 15, label: 'Độ tin cậy tài khoản' }
        },
        ratings: { count: n, average: round1(average), distribution: { 1: ratingCounts[1] || 0, 2: ratingCounts[2] || 0, 3: ratingCounts[3] || 0, 4: ratingCounts[4] || 0, 5: ratingCounts[5] || 0 } },
        sentiment: { positive: pos, neutral: neu, negative: neg, analyzed, pending, noComment, positiveShare, negativeShare, mismatch },
        ai: { bySource },
        orders: { completed, returned, returnRate: Math.round(returnRate * 100) },
        account: { ageDays: Math.max(0, Math.floor(ageDays)), isVerified },
        signals
    };
}

// @route GET /api/seller-trust/:userId   (công khai)
const getSellerTrust = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: 'Mã người dùng không hợp lệ' });
        }
        const oid = new mongoose.Types.ObjectId(userId);

        const [user, facets, orderAgg] = await Promise.all([
            User.findById(oid).select('createdAt isVerified'),
            Review.aggregate([
                { $match: { reviewedUserId: oid, isSeller: false } },   // chỉ các đánh giá do NGƯỜI MUA viết về người bán này
                {
                    $facet: {
                        ratings: [{ $group: { _id: '$rating', c: { $sum: 1 } } }],
                        sentiments: [{
                            $group: {
                                _id: { s: { $ifNull: ['$sentiment', 'none'] }, hasComment: { $gt: [{ $strLenCP: { $ifNull: ['$comment', ''] } }, 0] } },
                                c: { $sum: 1 }
                            }
                        }],
                        sources: [
                            { $match: { sentiment: { $ne: null } } },
                            { $group: { _id: { $ifNull: ['$sentimentSource', 'unknown'] }, c: { $sum: 1 } } }
                        ],
                        mismatch: [
                            { $match: { $or: [{ rating: { $gte: 4 }, sentiment: 'negative' }, { rating: { $lte: 2 }, sentiment: 'positive' }] } },
                            { $count: 'c' }
                        ]
                    }
                }
            ]),
            Order.aggregate([
                { $match: { sellerId: oid, status: { $in: ['completed', 'returned'] } } },
                { $group: { _id: '$status', c: { $sum: 1 } } }
            ])
        ]);

        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });

        const f = facets[0] || { ratings: [], sentiments: [], sources: [], mismatch: [] };
        const ratingCounts = {};
        f.ratings.forEach((r) => { ratingCounts[r._id] = r.c; });

        const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
        let pending = 0;
        let noComment = 0;
        f.sentiments.forEach((r) => {
            if (r._id.s === 'none') {
                if (r._id.hasComment) pending += r.c; else noComment += r.c;
            } else if (r._id.s in sentimentCounts) {
                sentimentCounts[r._id.s] += r.c;
            }
        });

        const bySource = {};
        f.sources.forEach((r) => { bySource[r._id] = r.c; });

        const orders = {};
        orderAgg.forEach((r) => { orders[r._id] = r.c; });

        const ageDays = (Date.now() - new Date(user.createdAt).getTime()) / 86400000;
        const data = computeTrust({
            ratingCounts, sentimentCounts, pending, noComment, mismatch: f.mismatch[0]?.c || 0, bySource,
            completed: orders.completed || 0, returned: orders.returned || 0, ageDays, isVerified: !!user.isVerified
        });

        res.json({ success: true, data });
    } catch (error) {
        console.error('Error getting seller trust:', error);
        res.status(500).json({ success: false, message: 'Lỗi server khi tính độ tin cậy người bán' });
    }
};

module.exports = { getSellerTrust, computeTrust };