/**
 * TẠO DỮ LIỆU MẪU ĐỂ DEMO "ĐỘ TIN CẬY NGƯỜI BÁN" + THỐNG KÊ CẢM XÚC (NOLA2HAND)
 *
 * Quy tắc của web: chỉ ĐƠN HÀNG ĐÃ HOÀN THÀNH mới được đánh giá, mỗi người đánh giá 1 lần/đơn.
 * Script tôn trọng quy tắc đó: với mỗi đánh giá, tạo 1 sản phẩm mẫu (đã bán) + 1 đơn hàng 'completed' + 1 đánh giá của người mua.
 * Sản phẩm mẫu là sản phẩm MỚI (status 'Sold', tag 'demo-reviews') nên KHÔNG đụng vào các tin đang bán thật.
 *
 * 5 người bán được gán 5 mức chất lượng để demo đủ các trạng thái trên giao diện:
 *   1. tốt         22 đánh giá, hầu hết 4-5 sao, bình luận tích cực             -> "Rất tin cậy"
 *   2. khá         14 đánh giá, lẫn lộn, có 2 đánh giá lệch sao/nội dung        -> "Tin cậy" hoặc "Cần thận trọng"
 *   3. kém         12 đánh giá, nhiều 1-2 sao, bình luận tiêu cực, 4 đơn bị trả -> "Rủi ro cao"
 *   4. mới         2 đánh giá 5 sao                                              -> "Chưa đủ dữ liệu"
 *   5. chưa có     0 đánh giá                                                    -> "Chưa đủ dữ liệu"
 *
 * LƯU Ý TRUNG THỰC: đây là DỮ LIỆU MẪU do script sinh ra, không phải đánh giá của người dùng thật.
 * Khi demo/báo cáo hãy nói rõ là dữ liệu mẫu. Đừng dùng các bình luận này để train hay đo mô hình.
 *
 * CHẠY (trong thư mục backend):
 *   node seed_demo_reviews.js --dry              xem kế hoạch, không ghi gì
 *   node seed_demo_reviews.js                    tạo dữ liệu (có phân tích cảm xúc bằng AI cho từng đánh giá)
 *   node seed_demo_reviews.js --no-ai            tạo dữ liệu nhưng chưa phân tích cảm xúc (chạy scripts/backfillSentiment.js sau)
 *   node seed_demo_reviews.js --tune-accounts    thêm: chỉnh ngày tạo + xác thực của 5 người bán để điểm "tài khoản" hợp lý
 *   node seed_demo_reviews.js --clean            xóa toàn bộ dữ liệu mẫu do script này tạo
 *   --seed=7                                     đổi hạt giống ngẫu nhiên (mặc định 2024, chạy lại cho kết quả giống nhau)
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MARK = '[DEMO-REVIEWS]';   // dấu hiệu nhận biết dữ liệu mẫu (ghi trong notes của đơn hàng)
const TAG = 'demo-reviews';       // tag của sản phẩm mẫu
const DAY = 86400000;

/* ───────────── Nội dung mẫu (viết mới, khác bộ câu dùng để đo mô hình) ───────────── */
const POS = [
    'Bạn bán rất nhiệt tình, hàng đúng như mô tả, giao dịch nhanh gọn',
    'Sách còn mới, ít ghi chú, giá sinh viên quá hợp lý, cảm ơn bạn nhiều',
    'Hàng chất lượng hơn mong đợi, bạn hẹn gặp đúng giờ',
    'Đóng gói cẩn thận, trả lời tin nhắn nhanh, sẽ ủng hộ lần sau',
    'Máy chạy mượt, pin vẫn tốt, rất hài lòng với giao dịch này',
    'Người bán thân thiện, cho kiểm tra hàng thoải mái, rất yên tâm',
    'Món đồ đẹp hơn trong ảnh, giá rẻ, mình rất ưng ý',
    'Giao dịch suôn sẻ, bạn bán dễ thương và trung thực',
    'Hàng dùng tốt, không có lỗi gì, đáng đồng tiền',
    'Cảm ơn shop, hàng giống mô tả, mình sẽ giới thiệu cho bạn bè',
    'Bán uy tín, còn tặng thêm phụ kiện, quá tuyệt vời',
    'Mọi thứ đều tốt, người bán hỗ trợ rất nhiệt tình'
];
const NEU = [
    'Hàng tạm ổn, dùng được, không có gì nổi bật',
    'Sản phẩm giống mô tả, giao dịch bình thường',
    'Đã nhận hàng, dùng thử thấy cũng được',
    'Chất lượng vừa phải so với giá tiền',
    'Hàng ổn, chỉ là bạn bán trả lời hơi chậm',
    'Mình nhận được hàng rồi, chưa dùng nhiều nên chưa biết thêm'
];
const NEG = [
    'Hàng lỗi, người bán trả lời cộc lốc, mình rất thất vọng',
    'Sản phẩm khác hẳn trong ảnh, cảm giác bị lừa',
    'Hẹn gặp mà trễ cả tiếng, thái độ không tốt, không mua nữa',
    'Dùng được hai hôm là hỏng, nhắn tin không thấy hỗ trợ',
    'Hàng cũ và trầy xước nhiều hơn mô tả, không đáng tiền',
    'Giao hàng chậm, đóng gói sơ sài, hàng móp méo',
    'Bán hàng thiếu trách nhiệm, hỏi gì cũng không trả lời',
    'Chất lượng quá tệ so với giá, đừng nên mua của bạn này'
];
// 5 sao nhưng nội dung chê (để demo cảnh báo "lệch sao và nội dung")
const MISMATCH = [
    'Hàng bị trầy xước nhiều, giao hơi trễ, nhưng thôi cũng chấp nhận được',
    'Bạn bán trả lời chậm, hàng không như kỳ vọng lắm'
];

const ITEMS = [
    ['Giáo trình Giải tích 1', 'Sách', 40000, 90000], ['Giáo trình Cấu trúc dữ liệu', 'Sách', 50000, 110000],
    ['Tai nghe Bluetooth', 'Điện tử', 150000, 350000], ['Laptop văn phòng cũ', 'Điện tử', 4000000, 7500000],
    ['Chuột không dây', 'Điện tử', 80000, 200000], ['Bàn phím cơ', 'Điện tử', 300000, 650000],
    ['Áo khoác hoodie', 'Quần áo', 90000, 220000], ['Áo sơ mi trắng', 'Quần áo', 60000, 140000],
    ['Bàn học gấp gọn', 'Nội thất', 150000, 320000], ['Kệ sách mini', 'Nội thất', 100000, 250000],
    ['Bộ bút và sổ tay', 'Văn phòng phẩm', 30000, 80000], ['Máy tính cầm tay', 'Văn phòng phẩm', 120000, 260000],
    ['Vợt cầu lông', 'Thể thao', 120000, 380000], ['Giày chạy bộ', 'Thể thao', 200000, 480000],
    ['Quạt mini để bàn', 'Khác', 60000, 150000], ['Đèn học LED', 'Khác', 70000, 180000]
];

/* ───────────── Kế hoạch từng người bán ───────────── */
// mỗi phần tử: [số sao, loại bình luận]
const rep = (n, rating, kind) => Array.from({ length: n }, () => [rating, kind]);
const PLANS = [
    { key: 'tot', label: 'Tốt', ageDays: 200, verified: true, extraCompleted: 2, returned: 0,
        reviews: [...rep(14, 5, 'pos'), ...rep(6, 4, 'pos'), ...rep(2, 3, 'neu')] },
    { key: 'kha', label: 'Khá', ageDays: 120, verified: true, extraCompleted: 1, returned: 1,
        reviews: [...rep(3, 5, 'pos'), ...rep(5, 4, 'pos'), ...rep(3, 3, 'neu'), ...rep(1, 2, 'neg'), ...rep(2, 5, 'mismatch')] },
    { key: 'kem', label: 'Kém', ageDays: 30, verified: false, extraCompleted: 0, returned: 4,
        reviews: [...rep(5, 1, 'neg'), ...rep(3, 2, 'neg'), ...rep(2, 3, 'neu'), ...rep(2, 5, 'pos')] },
    { key: 'moi', label: 'Mới', ageDays: 5, verified: false, extraCompleted: 0, returned: 0,
        reviews: [...rep(2, 5, 'pos')] },
    { key: 'chua', label: 'Chưa có đánh giá', ageDays: 60, verified: true, extraCompleted: 0, returned: 0, reviews: [] }
];

/* ───────────── Bộ sinh số ngẫu nhiên có hạt giống (kết quả lặp lại được) ───────────── */
function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Dựng kế hoạch thuần (không đụng DB) để dễ kiểm thử.
 * sellers: tối đa 5 người; buyers: danh sách người mua. Mỗi phần tử có _id (bất kỳ kiểu nào so sánh bằng String được).
 */
function buildPlan(sellers, buyers, { seed = 2024, now = Date.now(), newId = (() => { let i = 0; return () => `id${++i}`; })() } = {}) {
    const rnd = makeRng(seed);
    const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
    const between = (a, b) => a + Math.floor(rnd() * (b - a + 1));
    const textFor = { pos: POS, neu: NEU, neg: NEG, mismatch: MISMATCH };

    const products = []; const orders = []; const reviews = [];

    sellers.slice(0, PLANS.length).forEach((seller, si) => {
        const plan = PLANS[si];
        const candidates = buyers.filter((b) => String(b._id) !== String(seller._id));
        const used = {};   // tránh một sản phẩm dùng nguyên văn giống nhau lặp lại quá nhiều

        const makeProduct = () => {
            const [title, category, lo, hi] = pick(ITEMS);
            const price = Math.round(between(lo, hi) / 1000) * 1000;
            const created = now - between(5, 95) * DAY;
            return {
                _id: newId(), userId: seller._id, title: `${title} (mẫu)`, price, category, createdAt: created,
                description: `Sản phẩm mẫu phục vụ demo đánh giá (dữ liệu mẫu do script tạo). ${title}, đã qua sử dụng.`
            };
        };
        const makeOrder = (product, buyer, status) => {
            const confirmed = product.createdAt + between(1, 3) * DAY;
            const completed = Math.min(confirmed + between(1, 3) * DAY, now - DAY);
            return {
                _id: newId(), buyerId: buyer._id, sellerId: seller._id, productId: product._id, finalPrice: product.price,
                status, createdAt: confirmed, confirmedAt: confirmed, completedAt: status === 'completed' ? completed : undefined, notes: MARK
            };
        };

        // đơn có đánh giá
        plan.reviews.forEach(([rating, kind]) => {
            const product = makeProduct(); const buyer = pick(candidates); const order = makeOrder(product, buyer, 'completed');
            const pool = textFor[kind]; let comment = pick(pool);
            for (let tries = 0; tries < 5 && (used[comment] || 0) >= 2; tries++) comment = pick(pool);
            used[comment] = (used[comment] || 0) + 1;
            const createdAt = Math.min(order.completedAt + between(0, 4) * DAY, now - 3600000);
            products.push(product); orders.push(order);
            reviews.push({ _id: newId(), transactionId: String(order._id), orderId: order._id, reviewerId: buyer._id,
                reviewedUserId: seller._id, productId: product._id, rating, comment, isSeller: false, createdAt, kind });
        });
        // đơn hoàn thành nhưng người mua chưa đánh giá
        for (let i = 0; i < plan.extraCompleted; i++) {
            const product = makeProduct(); products.push(product); orders.push(makeOrder(product, pick(candidates), 'completed'));
        }
        // đơn bị trả hàng
        for (let i = 0; i < plan.returned; i++) {
            const product = makeProduct(); products.push(product); orders.push(makeOrder(product, pick(candidates), 'returned'));
        }
    });
    return { products, orders, reviews };
}

/* ───────────── Chạy thật ───────────── */
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const seedArg = Number((args.find((a) => a.startsWith('--seed=')) || '').split('=')[1]) || 2024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function recomputeRatings(Review, User, Product, userIds, productIds) {
    for (const id of userIds) {
        const s = await Review.aggregate([{ $match: { reviewedUserId: new mongoose.Types.ObjectId(String(id)) } },
            { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
        await User.findByIdAndUpdate(id, { 'rating.average': s.length ? Math.round(s[0].avg * 10) / 10 : 0, 'rating.count': s.length ? s[0].n : 0 });
    }
    for (const id of productIds) {
        const s = await Review.aggregate([{ $match: { productId: new mongoose.Types.ObjectId(String(id)), isSeller: false } },
            { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
        await Product.findByIdAndUpdate(id, { averageRating: s.length ? Math.round(s[0].avg * 10) / 10 : 0, totalReviews: s.length ? s[0].n : 0 });
    }
}

async function main() {
    const User = require('./models/User');
    const Product = require('./models/Product');
    const Order = require('./models/Order');
    const Review = require('./models/Review');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');

    const demoOrders = await Order.find({ notes: MARK }).select('_id buyerId sellerId productId');

    if (has('--clean')) {
        const orderIds = demoOrders.map((o) => o._id);
        const delRv = await Review.deleteMany({ orderId: { $in: orderIds } });
        const delOr = await Order.deleteMany({ _id: { $in: orderIds } });
        const delPr = await Product.deleteMany({ tags: TAG });
        const users = [...new Set(demoOrders.flatMap((o) => [String(o.sellerId), String(o.buyerId)]))];
        await recomputeRatings(Review, User, Product, users, []);
        console.log(`Đã xóa ${delRv.deletedCount} đánh giá, ${delOr.deletedCount} đơn hàng, ${delPr.deletedCount} sản phẩm mẫu.`);
        return;
    }

    if (demoOrders.length > 0) {
        console.log(`Đã có ${demoOrders.length} đơn hàng mẫu từ lần chạy trước. Hãy chạy "node seed_demo_reviews.js --clean" rồi chạy lại.`);
        return;
    }

    let users = await User.find({ email: /@nlu\.edu\.vn$/i, isAdmin: { $ne: true }, isShipper: { $ne: true } }).sort({ studentId: 1, createdAt: 1 });
    if (users.length < 8) {
        users = await User.find({ isAdmin: { $ne: true }, isShipper: { $ne: true } }).sort({ createdAt: 1 });
    }
    if (users.length < 8) {
        console.log(`Chỉ có ${users.length} người dùng thường. Cần ít nhất 8: chạy "node createMultipleUsers.js" trước.`);
        return;
    }
    const sellers = users.slice(0, PLANS.length);
    const buyers = users.slice(PLANS.length);

    const mkId = () => new mongoose.Types.ObjectId();
    const plan = buildPlan(sellers, buyers, { seed: seedArg, newId: mkId });

    console.log('Kế hoạch:');
    sellers.forEach((s, i) => {
        const n = plan.reviews.filter((r) => String(r.reviewedUserId) === String(s._id));
        const avg = n.length ? (n.reduce((a, r) => a + r.rating, 0) / n.length).toFixed(1) : '-';
        console.log(`  ${PLANS[i].label.padEnd(18)} ${s.name} <${s.email}>  ${n.length} đánh giá, TB ${avg} sao`);
    });
    console.log(`  Tổng: ${plan.reviews.length} đánh giá, ${plan.orders.length} đơn hàng, ${plan.products.length} sản phẩm mẫu`);
    if (has('--dry')) return;

    const locations = ['Campus', 'Dormitory', 'Nearby'];
    await Product.insertMany(plan.products.map((p, i) => ({
        _id: p._id, userId: p.userId, title: p.title, description: p.description, price: p.price, category: p.category,
        condition: 'Tốt', images: ['https://via.placeholder.com/400x300/f97316/ffffff?text=Demo'], tags: [TAG],
        location: locations[i % 3], status: 'Sold', isApproved: true, moderationStatus: 'safe', createdAt: new Date(p.createdAt)
    })));
    await Order.insertMany(plan.orders.map((o) => ({
        _id: o._id, buyerId: o.buyerId, sellerId: o.sellerId, productId: o.productId, finalPrice: o.finalPrice, status: o.status,
        notes: o.notes, deliveryMethod: 'meetup', paymentMethod: 'cash', createdAt: new Date(o.createdAt), confirmedAt: new Date(o.confirmedAt),
        completedAt: o.completedAt ? new Date(o.completedAt) : undefined, expiresAt: new Date(o.createdAt + 30 * DAY)
    })));
    await Review.insertMany(plan.reviews.map((r) => ({
        _id: r._id, transactionId: r.transactionId, orderId: r.orderId, reviewerId: r.reviewerId, reviewedUserId: r.reviewedUserId,
        productId: r.productId, rating: r.rating, comment: r.comment, images: [], isSeller: false, createdAt: new Date(r.createdAt), updatedAt: new Date(r.createdAt)
    })));
    console.log('Đã tạo sản phẩm, đơn hàng và đánh giá.');

    await recomputeRatings(Review, User, Product, sellers.map((s) => s._id), plan.products.map((p) => p._id));

    if (has('--tune-accounts')) {
        for (let i = 0; i < sellers.length; i++) {
            const s = sellers[i];
            console.log(`  [tune] ${s.email}: createdAt ${s.createdAt?.toISOString?.()} -> ${PLANS[i].ageDays} ngày trước, isVerified ${s.isVerified} -> ${PLANS[i].verified}`);
            await User.collection.updateOne({ _id: s._id }, { $set: { createdAt: new Date(Date.now() - PLANS[i].ageDays * DAY), isVerified: PLANS[i].verified } });
        }
    }

    if (has('--no-ai')) {
        console.log('Bỏ qua phân tích cảm xúc (--no-ai). Chạy "node scripts/backfillSentiment.js" khi cần.');
    } else {
        const { analyzeSentiment } = require('./utils/sentimentAnalysis');
        const bySource = {}; let done = 0;
        for (const r of plan.reviews) {
            const { sentiment, score, source } = await analyzeSentiment(r.comment);
            await Review.updateOne({ _id: r._id }, { sentiment, sentimentScore: score, sentimentSource: source || null });
            bySource[source] = (bySource[source] || 0) + 1;
            if (source === 'gemini') await sleep(400);
            if (++done % 10 === 0) console.log(`  đã phân tích cảm xúc ${done}/${plan.reviews.length}`);
        }
        console.log('Nguồn quyết định cảm xúc:', bySource);
    }

    console.log('\nXong. Đăng nhập thử bằng email ở trên (mật khẩu mặc định của seed người dùng là 123456) hoặc mở trang đánh giá của từng người bán:');
    sellers.forEach((s, i) => console.log(`  ${PLANS[i].label.padEnd(18)} /user/${s._id}/reviews`));
}

if (require.main === module) {
    main().catch((e) => { console.error('Lỗi:', e.message); process.exitCode = 1; })
        .finally(() => mongoose.disconnect());
}

module.exports = { buildPlan, PLANS, makeRng, POS, NEU, NEG, MISMATCH, MARK, TAG };