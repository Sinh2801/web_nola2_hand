/**
 * SEEDER DỮ LIỆU MẪU CHO TOÀN BỘ COLLECTION (NOLA2HAND)
 *
 * Mục đích: điền dữ liệu mẫu đầy đủ các trường để các màn hình (doanh thu, đơn hàng,
 * đánh giá, bình luận, tin nhắn, thông báo...) có dữ liệu để hiển thị.
 *
 * NGUYÊN TẮC: collection nào ĐÃ CÓ dữ liệu thì BỎ QUA, không xóa, không ghi đè.
 *   Chỉ collection đang trống mới được tạo dữ liệu.
 *
 * ĐIỀU KIỆN: DB phải có sẵn user (createMultipleUsers.js, seed-shippers.js, createAdmin.js)
 *            và sản phẩm (seed_1000_products.js). Thiếu thì script dừng và nhắc bạn.
 *
 * CHẠY:
 *   node seed_sample_data.js                      tạo dữ liệu cho mọi collection đang trống
 *   node seed_sample_data.js --only=orders,payments   chỉ chạy các bước được liệt kê
 *   node seed_sample_data.js --reset=orders       xóa rồi tạo lại collection chỉ định
 *                                                 (reset orders sẽ tự reset luôn payments và reviews)
 *
 * Tên bước: bankqr, sellerqr, coupons, follows, offers, orders, payments, reviews, posts,
 *           hashtags, comments, collections, bookmarks, favorites, views, searches,
 *           stories, messages, notifications, notifsettings, userstats
 *
 * Doanh thu của trang Admin được tính từ Payment có status = 'confirmed' theo confirmedAt,
 * nên dữ liệu đơn hàng và thanh toán được rải đều trong 12 tháng gần nhất.
 *
 * Bỏ qua có chủ ý: PendingRegistration, PendingPasswordReset (dữ liệu tạm khi đăng ký / quên mật khẩu).
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Payment = require('./models/Payment');
const Offer = require('./models/Offer');
const Review = require('./models/Review');
const Comment = require('./models/Comment');
const Follow = require('./models/Follow');
const Bookmark = require('./models/Bookmark');
const Collection = require('./models/Collection');
const Coupon = require('./models/Coupon');
const Hashtag = require('./models/Hashtag');
const Message = require('./models/Message');
const Notification = require('./models/Notification');
const NotificationSettings = require('./models/NotificationSettings');
const Post = require('./models/Post');
const ProductView = require('./models/ProductView');
const SearchHistory = require('./models/SearchHistory');
const Story = require('./models/Story');
const BankQR = require('./models/BankQR');
const SellerBankQR = require('./models/SellerBankQR');

// ==========================================
// CẤU HÌNH SỐ LƯỢNG
// ==========================================
const COUNT = {
    orders: 300,          // số đơn hàng (mỗi đơn có 1 payment)
    offers: 220,
    productComments: 600,
    postComments: 200,
    posts: 120,
    views: 2500,
    searches: 300,
    stories: 40,
    messageThreads: 120
};

// ==========================================
// THAM SỐ DÒNG LỆNH
// ==========================================
const argv = process.argv.slice(2);
const getArg = (k) => ((argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || '');
const ONLY = getArg('only').split(',').map((s) => s.trim()).filter(Boolean);
const RESET = getArg('reset').split(',').map((s) => s.trim()).filter(Boolean);
if (RESET.includes('orders')) {
    ['payments', 'reviews'].forEach((k) => { if (!RESET.includes(k)) RESET.push(k); });
}

// ==========================================
// TIỆN ÍCH
// ==========================================
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.now();

const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const oid = () => new mongoose.Types.ObjectId();
const sid = (x) => String((x && x._id) || x);
const D = (ms) => new Date(ms);
const round1000 = (n) => Math.max(1000, Math.round(n / 1000) * 1000);

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
const sample = (arr, n) => shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));

function weighted(pairs) {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = Math.random() * total;
    for (const [v, w] of pairs) {
        r -= w;
        if (r <= 0) return v;
    }
    return pairs[0][0];
}

// Thời điểm ngẫu nhiên trong quá khứ, thiên về gần hiện tại. minAge/maxAge tính bằng ms
function pastTime(minAge, maxAge, bias = 1.5) {
    const span = Math.max(0, maxAge - minAge);
    return NOW - minAge - Math.pow(Math.random(), bias) * span;
}

const asciiUpper = (s) => String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D').toUpperCase();
const asciiLower = (s) => asciiUpper(s).toLowerCase();

const CAT_EN = {
    'Sách': 'Books', 'Điện tử': 'Electronics', 'Quần áo': 'Clothing', 'Nội thất': 'Furniture',
    'Văn phòng phẩm': 'Stationery', 'Thể thao': 'Sports', 'Khác': 'Other'
};
const money = (n) => Number(n || 0).toLocaleString('vi-VN');

// ---------- ảnh minh họa dạng SVG (không cần internet) ----------
const svgUri = (svg) => `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
const esc = (s) => String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

function placeholderImage(text, color = '#64748B') {
    return svgUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">` +
        `<rect width="400" height="260" fill="${color}"/>` +
        `<text x="200" y="130" text-anchor="middle" dominant-baseline="central" font-family="Arial, sans-serif" font-size="26" fill="#fff">${esc(text)}</text></svg>`
    );
}

// Ảnh giống mã QR (chỉ để minh họa, KHÔNG quét được)
function fakeQr(seed) {
    let h = 0;
    for (const c of String(seed)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
    const N = 25, S = 8;
    const inFinder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([ox, oy]) => x >= ox && x < ox + 7 && y >= oy && y < oy + 7);
    let rects = '';
    for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
            if (inFinder(x, y)) continue;
            if (rnd() > 0.5) rects += `<rect x="${(x + 1) * S}" y="${(y + 1) * S}" width="${S}" height="${S}"/>`;
        }
    }
    const finder = (ox, oy) =>
        `<rect x="${(ox + 1) * S}" y="${(oy + 1) * S}" width="${7 * S}" height="${7 * S}"/>` +
        `<rect x="${(ox + 2) * S}" y="${(oy + 2) * S}" width="${5 * S}" height="${5 * S}" fill="#fff"/>` +
        `<rect x="${(ox + 3) * S}" y="${(oy + 3) * S}" width="${3 * S}" height="${3 * S}"/>`;
    const size = (N + 2) * S;
    return svgUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
        `<rect width="${size}" height="${size}" fill="#fff"/><g fill="#111">${rects}${finder(0, 0)}${finder(N - 7, 0)}${finder(0, N - 7)}</g></svg>`
    );
}

function coverImage(seed) {
    const colors = [['#EA580C', '#FDBA74'], ['#059669', '#6EE7B7'], ['#2563EB', '#93C5FD'], ['#7C3AED', '#C4B5FD'], ['#DB2777', '#F9A8D4'], ['#0891B2', '#67E8F9']];
    const [a, b] = colors[[...String(seed)].reduce((s, c) => s + c.charCodeAt(0), 0) % colors.length];
    return svgUri(
        `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="300" viewBox="0 0 900 300">` +
        `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>` +
        `<rect width="900" height="300" fill="url(#g)"/></svg>`
    );
}

// ==========================================
// NỘI DUNG MẪU
// ==========================================
const BANKS = ['Vietcombank', 'VietinBank', 'BIDV', 'Agribank', 'Techcombank', 'MB Bank', 'ACB', 'Sacombank', 'TPBank', 'VPBank'];
const randDigits = (n) => Array.from({ length: n }, () => rand(0, 9)).join('');

const ADDRESS_LINES = ['Ký túc xá khu A', 'Ký túc xá khu B', 'Nhà trọ gần cổng trường', 'Cổng chính trường Đại học Nông Lâm', 'Khu nhà trọ sinh viên'];
const ORDER_NOTES = ['Gọi trước khi giao giúp mình nhé.', 'Giao giờ hành chính giúp mình.', 'Mình ở phòng tầng 2, bạn lên giúp nhé.', 'Cho mình kiểm tra hàng trước khi nhận.', ''];
const CANCEL_BY_BUYER = ['Mình đổi ý không mua nữa.', 'Mình tìm được món rẻ hơn.', 'Mình đặt nhầm sản phẩm.', 'Mình không kịp nhận hàng.'];
const CANCEL_BY_SELLER = ['Mình lỡ bán cho người khác rồi.', 'Sản phẩm bị hỏng trước khi giao.', 'Mình có việc đột xuất không giao được.'];
const CANCEL_AUTO = 'Tự động hủy do hết thời gian xác nhận';
const RETURN_REASONS = ['Hàng không đúng mô tả.', 'Sản phẩm bị lỗi khi sử dụng.', 'Hàng bị xước nhiều hơn so với hình.', 'Kích thước không vừa với mình.'];
const RETURN_REJECT_REASONS = ['Hình ảnh minh chứng chưa thể hiện rõ lỗi.', 'Sản phẩm đã được người bán mô tả đúng tình trạng.'];
const PAYMENT_REJECT_REASONS = ['Biên lai không khớp số tiền.', 'Không nhận được tiền chuyển khoản.', 'Ảnh biên lai không rõ.'];

const REVIEW_BY_RATING = {
    5: ['Giao dịch nhanh gọn, hàng đúng mô tả, người bán nhiệt tình.', 'Đồ đẹp hơn mong đợi, rất hài lòng!', 'Hàng như hình, đóng gói cẩn thận, sẽ ủng hộ tiếp.'],
    4: ['Hàng ổn, đúng mô tả, giao hơi trễ một chút.', 'Đồ tốt, giá hợp lý, chỉ hơi xước nhẹ như người bán nói.'],
    3: ['Tạm ổn, hàng cũ hơn mình nghĩ một chút.', 'Giao dịch bình thường, hàng đúng với giá tiền.'],
    2: ['Hàng có vài lỗi không ghi trong mô tả.', 'Người bán phản hồi tin nhắn hơi chậm.'],
    1: ['Hàng không đúng mô tả, mình hơi thất vọng.']
};
const REVIEW_SELLER_TO_BUYER = ['Người mua thân thiện, thanh toán nhanh.', 'Giao dịch suôn sẻ, hẹn gặp lại!', 'Bạn mua đến đúng giờ hẹn, rất lịch sự.', 'Mua nhanh gọn, không mặc cả nhiều.'];

const PRODUCT_COMMENTS = ['Món này còn không bạn?', 'Giá này có fix thêm không ạ?', 'Cho mình xin thêm ảnh thật với nhé.', 'Bạn ở khu nào để mình qua xem hàng?', 'Mình lấy nhé, nhắn riêng mình nha.', 'Đồ còn dùng tốt không bạn?', 'Có bảo hành gì không ạ?', 'Giá hơi cao so với tình trạng, bạn bớt chút được không?', 'Hàng đẹp quá, mình đã quan tâm!', 'Mình đang cần đúng món này luôn.'];
const COMMENT_REPLIES = ['Còn nha bạn, nhắn tin mình nhé.', 'Mình fix nhẹ cho bạn sinh viên nhé.', 'Mình ở KTX, bạn qua xem trực tiếp được nha.', 'Đồ mình dùng kỹ lắm, bạn yên tâm.', 'Mình gửi thêm ảnh qua tin nhắn nhé.'];
const POST_COMMENTS = ['Đồ xịn quá, đã lưu lại!', 'Cho mình hỏi giá chốt bao nhiêu bạn?', 'Bài đăng rõ ràng, chấm điểm 10 luôn.', 'Mình ở gần đó, qua xem được không bạn?', 'Pass lại hay đấy, theo dõi bạn rồi.', 'Còn hàng không bạn ơi?'];

const OFFER_MESSAGES = ['Bạn bớt giúp mình chút nhé, mình là sinh viên.', 'Giá này mình lấy luôn trong hôm nay.', 'Mình trả giá này, hợp lý thì chốt nhé.', 'Mình đến lấy trực tiếp tại cổng trường, bạn bớt giúp mình.'];
const SELLER_ACCEPT = ['Ok bạn, mình chốt giá này.', 'Được nhé, hẹn bạn tại cổng trường.'];
const SELLER_REJECT = ['Giá này thấp quá bạn ơi, mình không bán được.', 'Mình xin lỗi, mình đã có người trả cao hơn.'];
const SELLER_COUNTER = ['Mình chỉ bớt được đến mức này thôi bạn.', 'Giá này mình lấy lại vốn, bạn xem được không?'];

const SEARCH_TERMS = ['laptop cũ', 'sách giáo trình', 'giày sneaker', 'balo', 'đèn học', 'bàn học', 'tai nghe', 'vợt cầu lông', 'máy tính cầm tay', 'quạt mini', 'hoodie', 'kệ sách', 'sạc dự phòng', 'loa bluetooth', 'bàn phím cơ', 'chuột máy tính', 'từ điển tiếng anh', 'tạ tay', 'thảm yoga', 'ghế xoay'];
const COLLECTION_NAMES = [['Đồ học tập', 'Những món cần cho học kỳ mới.'], ['Góc công nghệ', 'Laptop, phụ kiện giá sinh viên.'], ['Săn đồ rẻ', 'Các món dưới 100 nghìn.'], ['Nội thất phòng trọ', 'Bàn ghế, đèn học cho phòng trọ.'], ['Thể thao cuối tuần', 'Đồ chơi thể thao dành cho sinh viên.'], ['Thời trang sinh viên', 'Áo khoác, giày, balo.']];
const STORY_TEXTS = ['Hàng mới về!', 'Giảm giá cuối tuần', 'Pass gấp trong hôm nay', 'Dọn trọ, thanh lý hết', 'Giá sinh viên', ''];
const STORY_EMOJI = ['🔥', '💸', '📦', '✨', '😍'];
const HIGHLIGHT_TITLES = ['Đồ học tập', 'Đồ điện tử', 'Thanh lý', 'Hàng đã bán'];
const BOOKMARK_TAGS = ['cần mua', 'xem sau', 'giá tốt', 'để tặng bạn', 'so sánh'];
const BOOKMARK_NOTES = ['Hỏi lại giá vào cuối tuần.', 'Đợi nhận học bổng rồi mua.', 'Giống món bạn mình đang cần.', ''];
const MESSAGE_LOCATIONS = ['cổng trường', 'ký túc xá', 'căn tin', 'thư viện'];
const POST_LOCATIONS = ['KTX Đại học Nông Lâm', 'Cổng trường Đại học Nông Lâm', 'Khu nhà trọ gần trường', 'Thư viện trường'];

// ==========================================
// GHI DỮ LIỆU
// ==========================================
const ctx = {};
const summary = [];

// Chèn nhiều document, rồi sửa lại createdAt / updatedAt bằng driver gốc để chắc chắn đúng ngày đã đặt
async function insertDocs(Model, docs, chunk = 500) {
    let n = 0;
    for (let i = 0; i < docs.length; i += chunk) {
        const res = await Model.insertMany(docs.slice(i, i + chunk));
        n += res.length;
    }
    const ops = docs
        .filter((d) => d._id && d.createdAt)
        .map((d) => ({ updateOne: { filter: { _id: d._id }, update: { $set: { createdAt: d.createdAt, updatedAt: d.updatedAt || d.createdAt } } } }));
    for (let i = 0; i < ops.length; i += 1000) {
        await Model.collection.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
    }
    return n;
}

async function bulk(Model, ops) {
    for (let i = 0; i < ops.length; i += 1000) {
        await Model.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
    }
}

// Chạy một bước: bỏ qua nếu bị loại bởi --only, hoặc collection đã có dữ liệu
async function step(key, label, Model, fn) {
    if (ONLY.length && !ONLY.includes(key)) return;
    if (RESET.includes(key)) {
        const del = await Model.deleteMany({});
        console.log(`🧹 ${label}: đã xóa ${del.deletedCount} bản ghi cũ (--reset)`);
        ctx[`${key}Loaded`] = false;
    }
    const existing = await Model.countDocuments();
    if (existing > 0) {
        console.log(`⏭️  ${label}: đã có ${existing} bản ghi, bỏ qua`);
        summary.push([label, 'bỏ qua', existing]);
        return;
    }
    const created = await fn();
    console.log(`✅ ${label}: đã tạo ${created} bản ghi`);
    summary.push([label, 'đã tạo', created]);
}

// ---------- nạp dữ liệu phụ thuộc (dùng dữ liệu mới tạo hoặc dữ liệu đã có sẵn) ----------
async function getOffers() { if (!ctx.offers) ctx.offers = await Offer.find({}).lean(); return ctx.offers; }
async function getOrders() { if (!ctx.orders) ctx.orders = await Order.find({}).lean(); return ctx.orders; }
async function getPosts() { if (!ctx.posts) ctx.posts = await Post.find({}).lean(); return ctx.posts; }
async function getCoupons() { if (!ctx.coupons) ctx.coupons = await Coupon.find({}).lean(); return ctx.coupons; }

// ==========================================
// CÁC BƯỚC TẠO DỮ LIỆU
// ==========================================

// 1. BankQR (tài khoản nhận tiền của sàn)
async function seedBankQR() {
    const banks = [
        { bankName: 'Vietcombank', accountHolder: 'NOLA2HAND MARKETPLACE', isActive: true },
        { bankName: 'MB Bank', accountHolder: 'NOLA2HAND MARKETPLACE', isActive: false }
    ];
    const docs = banks.map((b, i) => {
        const accountNumber = randDigits(12);
        return {
            _id: oid(), ...b, accountNumber, qrCodeImage: fakeQr(`${b.bankName}${accountNumber}`),
            createdBy: ctx.admin._id, createdAt: D(NOW - (90 - i * 30) * DAY)
        };
    });
    return insertDocs(BankQR, docs);
}

// 2. SellerBankQR (mỗi người bán 1 tài khoản)
async function seedSellerBankQR() {
    const sellerIds = [...new Set(ctx.products.map((p) => sid(p.userId)))].filter((id) => ctx.userById.has(id));
    const docs = sellerIds.map((id) => {
        const u = ctx.userById.get(id);
        const accountNumber = randDigits(rand(10, 12));
        const bankName = pick(BANKS);
        const verified = chance(0.8);
        const createdAt = D(pastTime(2 * DAY, 120 * DAY));
        return {
            _id: oid(), sellerId: u._id, bankName, accountNumber, accountHolder: asciiUpper(u.name),
            qrCodeImage: fakeQr(`${bankName}${accountNumber}`), isVerified: verified,
            ...(verified ? { verifiedBy: ctx.admin._id, verifiedAt: D(createdAt.getTime() + rand(1, 48) * HOUR) } : {}),
            createdAt
        };
    });
    return insertDocs(SellerBankQR, docs);
}

// 3. Coupon
async function seedCoupons() {
    const exp = (days) => D(NOW + days * DAY);
    const list = [
        { code: 'WELCOME10', discountType: 'percentage', discountValue: 10, minPurchase: 50000, maxDiscount: 20000, description: 'Giảm 10% cho đơn đầu tiên, tối đa 20.000đ.', usageLimit: 500, expiryDate: exp(180) },
        { code: 'SINHVIEN15', discountType: 'percentage', discountValue: 15, minPurchase: 100000, maxDiscount: 30000, description: 'Ưu đãi sinh viên giảm 15%, tối đa 30.000đ.', usageLimit: 300, expiryDate: exp(120) },
        { code: 'GIAM20K', discountType: 'fixed', discountValue: 20000, minPurchase: 150000, maxDiscount: null, description: 'Giảm trực tiếp 20.000đ cho đơn từ 150.000đ.', usageLimit: 200, expiryDate: exp(90) },
        { code: 'SACH10', discountType: 'percentage', discountValue: 10, minPurchase: 0, maxDiscount: 15000, description: 'Giảm 10% cho sách và văn phòng phẩm.', usageLimit: null, expiryDate: exp(150), applicableCategories: ['Books', 'Stationery'] },
        { code: 'DIENTU50K', discountType: 'fixed', discountValue: 50000, minPurchase: 500000, maxDiscount: null, description: 'Giảm 50.000đ cho đồ điện tử từ 500.000đ.', usageLimit: 100, expiryDate: exp(60), applicableCategories: ['Electronics'] },
        { code: 'NLU2026', discountType: 'fixed', discountValue: 10000, minPurchase: 0, maxDiscount: null, description: 'Mã chào mừng sinh viên Nông Lâm 2026.', usageLimit: null, expiryDate: exp(365) },
        { code: 'THETHAO10', discountType: 'percentage', discountValue: 10, minPurchase: 0, maxDiscount: 25000, description: 'Giảm 10% cho đồ thể thao.', usageLimit: 150, expiryDate: exp(100), applicableCategories: ['Sports'] },
        { code: 'NOITHAT30K', discountType: 'fixed', discountValue: 30000, minPurchase: 300000, maxDiscount: null, description: 'Giảm 30.000đ cho nội thất từ 300.000đ.', usageLimit: 50, expiryDate: exp(75), applicableCategories: ['Furniture'] },
        { code: 'TAMDUNG', discountType: 'percentage', discountValue: 20, minPurchase: 200000, maxDiscount: 50000, description: 'Mã đang tạm dừng.', usageLimit: 100, expiryDate: exp(30), isActive: false }
    ];
    const docs = list.map((c) => ({
        _id: oid(), usedCount: 0, isActive: true, applicableCategories: [], applicableUsers: [],
        createdBy: ctx.admin._id, createdAt: D(NOW - rand(5, 60) * DAY), ...c
    }));
    const n = await insertDocs(Coupon, docs);
    ctx.coupons = docs.map((d) => ({ ...d }));
    return n;
}

// 4. Follow (và cập nhật followers/following trong User)
async function seedFollows() {
    const people = ctx.people;
    const pairs = new Set();
    const docs = [];
    const followersOf = new Map(people.map((u) => [sid(u), []]));
    const followingOf = new Map(people.map((u) => [sid(u), []]));
    for (const u of people) {
        for (const target of sample(people.filter((x) => sid(x) !== sid(u)), rand(3, 8))) {
            const key = `${sid(u)}>${sid(target)}`;
            if (pairs.has(key)) continue;
            pairs.add(key);
            docs.push({ _id: oid(), followerId: u._id, followingId: target._id, createdAt: D(pastTime(HOUR, 90 * DAY)) });
            followingOf.get(sid(u)).push(target._id);
            followersOf.get(sid(target)).push(u._id);
        }
    }
    const n = await insertDocs(Follow, docs);
    await bulk(User, people.map((u) => ({
        updateOne: {
            filter: { _id: u._id },
            update: { $set: {
                    followers: followersOf.get(sid(u)), following: followingOf.get(sid(u)),
                    followerCount: followersOf.get(sid(u)).length, followingCount: followingOf.get(sid(u)).length
                } }
        }
    })));
    return n;
}

// 5. Offer
async function seedOffers() {
    const docs = [];
    const products = shuffle(ctx.products);
    for (let i = 0; i < COUNT.offers; i++) {
        const product = products[i % products.length];
        const sellerId = product.userId;
        const buyer = pick(ctx.people.filter((u) => sid(u) !== sid(sellerId)));
        if (!buyer || !ctx.userById.has(sid(sellerId))) continue;
        const status = weighted([['pending', 22], ['accepted', 25], ['rejected', 18], ['countered', 15], ['expired', 10], ['cancelled', 10]]);
        let createdAt;
        if (status === 'pending') createdAt = NOW - rand(2, 5 * 24) * HOUR;       // còn hạn 7 ngày
        else if (status === 'expired') createdAt = NOW - rand(9, 60) * DAY;
        else createdAt = pastTime(2 * DAY, 90 * DAY);
        const offerPrice = round1000(product.price * (0.6 + Math.random() * 0.32));
        const doc = {
            _id: oid(), buyerId: buyer._id, sellerId, productId: product._id,
            offerPrice, status, message: pick(OFFER_MESSAGES),
            expiresAt: D(createdAt + 7 * DAY), createdAt: D(createdAt)
        };
        const respondedAt = createdAt + rand(1, 36) * HOUR;
        if (status === 'accepted') { doc.acceptedAt = D(respondedAt); doc.sellerMessage = pick(SELLER_ACCEPT); doc.updatedAt = D(respondedAt); }
        if (status === 'rejected') { doc.rejectedAt = D(respondedAt); doc.rejectedBy = sellerId; doc.sellerMessage = pick(SELLER_REJECT); doc.updatedAt = D(respondedAt); }
        if (status === 'countered') {
            doc.counterOfferPrice = round1000(offerPrice + (product.price - offerPrice) * (0.4 + Math.random() * 0.4));
            doc.sellerMessage = pick(SELLER_COUNTER); doc.updatedAt = D(respondedAt);
        }
        if (status === 'cancelled') doc.updatedAt = D(createdAt + rand(1, 24) * HOUR);
        docs.push(doc);
    }
    const n = await insertDocs(Offer, docs);
    ctx.offers = docs.map((d) => ({ ...d }));
    return n;
}

// 6. Order (chứa dữ liệu doanh thu cùng với Payment)
function orderTimeline(status, deliveryMethod, hasShipper) {
    // trả về createdAt và các mốc thời gian phù hợp từng trạng thái, mọi mốc đều <= hiện tại
    const f = {};
    let createdAt;
    if (status === 'pending') createdAt = NOW - rand(1, 18) * HOUR;
    else if (status === 'confirmed') createdAt = NOW - rand(1, 5) * DAY - rand(0, 12) * HOUR;
    else if (status === 'picked_up') createdAt = NOW - rand(2, 6) * DAY - rand(0, 12) * HOUR;
    else if (status === 'cancelled') createdAt = pastTime(1 * DAY, 365 * DAY);
    else if (status === 'completed') createdAt = pastTime(6 * DAY, 365 * DAY);
    else createdAt = pastTime(10 * DAY, 365 * DAY); // return_* và returned

    f.createdAt = createdAt;
    if (status === 'pending') return f;
    if (status === 'cancelled') { f.cancelledAt = createdAt + rand(1, 20) * HOUR; return f; }

    f.confirmedAt = createdAt + rand(1, 12) * HOUR;
    let last = f.confirmedAt;
    const viaShipper = deliveryMethod === 'delivery' && hasShipper;

    if (status === 'confirmed') return f;
    if (viaShipper) {
        f.shipperAssignedAt = last + rand(1, 6) * HOUR;
        f.pickedUpAt = f.shipperAssignedAt + rand(1, 6) * HOUR;
        last = f.pickedUpAt;
    } else if (status === 'picked_up') {
        f.pickedUpAt = last + rand(1, 12) * HOUR;
        last = f.pickedUpAt;
    }
    if (status === 'picked_up') return f;

    if (viaShipper) { f.deliveredAt = last + rand(1, 24) * HOUR; last = f.deliveredAt; }
    f.completedAt = last + rand(1, 24) * HOUR;
    return f;
}

async function seedOrders() {
    const coupons = (await getCoupons()).map((c) => ({ ...c, _used: 0 }));
    const acceptedOffers = shuffle((await getOffers()).filter((o) => o.status === 'accepted'));
    const usedProducts = new Set();
    const productById = ctx.productById;
    const docs = [];
    const couponUse = new Map();

    const makeOrder = ({ product, buyer, offer }) => {
        const seller = ctx.userById.get(sid(product.userId));
        const status = weighted([['completed', 50], ['confirmed', 8], ['picked_up', 7], ['pending', 6], ['cancelled', 14], ['return_requested', 4], ['return_rejected', 4], ['returned', 7]]);
        const deliveryMethod = ctx.shippers.length
            ? weighted([['delivery', 60], ['meetup', 25], ['pickup', 15]])
            : weighted([['meetup', 60], ['pickup', 40]]);
        const hasShipper = ctx.shippers.length > 0;
        const t = orderTimeline(status, deliveryMethod, hasShipper);
        const paymentMethod = weighted([['transfer', 70], ['cash', 20], ['momo', 10]]);

        // giá và mã giảm giá (mã chỉ áp dụng cho đơn đặt trực tiếp, không áp cho đơn từ offer)
        let finalPrice = offer ? (offer.counterOfferPrice || offer.offerPrice) : product.price;
        let discountAmount = 0, couponDoc = null;
        if (!offer && chance(0.22)) {
            const cat = CAT_EN[product.category];
            const cands = coupons.filter((c) => c.isActive && c.expiryDate > NOW && product.price >= (c.minPurchase || 0)
                && (!c.applicableCategories.length || c.applicableCategories.includes(cat))
                && (c.usageLimit === null || (c.usedCount + c._used) < c.usageLimit));
            if (cands.length) {
                couponDoc = pick(cands);
                discountAmount = couponDoc.discountType === 'percentage'
                    ? Math.min(Math.round(product.price * couponDoc.discountValue / 100), couponDoc.maxDiscount || Infinity)
                    : Math.min(couponDoc.discountValue, product.price);
                finalPrice = product.price - discountAmount;
                couponDoc._used++;
                couponUse.set(sid(couponDoc), (couponUse.get(sid(couponDoc)) || 0) + 1);
            }
        }
        finalPrice = Math.max(0, Math.round(finalPrice));

        const doc = {
            _id: oid(), buyerId: buyer._id, sellerId: seller._id, productId: product._id,
            finalPrice, status, deliveryMethod, paymentMethod,
            notes: pick(ORDER_NOTES), discountAmount,
            shippingAddress: {
                fullName: buyer.name, phone: buyer.phone || '0900000000',
                address: pick(ADDRESS_LINES), ward: 'Linh Trung', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh', note: ''
            },
            expiresAt: D(t.createdAt + DAY), createdAt: D(t.createdAt),
            pickupProof: '', deliveryProof: ''
        };
        if (offer) doc.offerId = offer._id;
        if (couponDoc) { doc.couponId = couponDoc._id; doc.couponCode = couponDoc.code; }
        if (t.confirmedAt) doc.confirmedAt = D(t.confirmedAt);

        // shipper (chỉ khi giao tận nơi và đã tới bước nhận hàng)
        if (deliveryMethod === 'delivery' && hasShipper && t.shipperAssignedAt) {
            doc.shipperId = pick(ctx.shippers)._id;
            doc.shipperAssignedAt = D(t.shipperAssignedAt);
            doc.pickedUpAt = D(t.pickedUpAt);
            doc.pickupProof = placeholderImage('Ảnh nhận hàng', '#0891B2');
            if (t.deliveredAt) { doc.deliveredAt = D(t.deliveredAt); doc.deliveryProof = placeholderImage('Ảnh giao hàng', '#059669'); }
        } else if (t.pickedUpAt) {
            doc.pickedUpAt = D(t.pickedUpAt);
        }
        if (t.completedAt) doc.completedAt = D(t.completedAt);

        if (status === 'cancelled') {
            doc.cancelledAt = D(t.cancelledAt);
            const who = weighted([['buyer', 60], ['seller', 25], ['auto', 15]]);
            if (who === 'buyer') { doc.cancelledBy = buyer._id; doc.cancellationReason = pick(CANCEL_BY_BUYER); }
            else if (who === 'seller') { doc.cancelledBy = seller._id; doc.cancellationReason = pick(CANCEL_BY_SELLER); }
            else doc.cancellationReason = CANCEL_AUTO;
        }

        if (['return_requested', 'return_rejected', 'returned'].includes(status)) {
            const from = t.completedAt ? 'completed' : (t.pickedUpAt ? 'picked_up' : 'confirmed');
            doc.returnFromStatus = from;
            doc.returnReason = pick(RETURN_REASONS);
            const reqAt = (t.completedAt || t.pickedUpAt || t.confirmedAt) + rand(2, 48) * HOUR;
            doc.returnRequestedAt = D(reqAt);
            doc.returnEvidence = [{
                url: (product.images && product.images[0]) || placeholderImage('Bằng chứng', '#DC2626'),
                type: 'image', uploadedAt: D(reqAt)
            }];
            if (status === 'return_rejected') {
                doc.returnRejectedAt = D(reqAt + rand(2, 36) * HOUR);
                doc.returnRejectedBy = seller._id;
                doc.returnRejectionReason = pick(RETURN_REJECT_REASONS);
            }
            if (status === 'returned') {
                doc.returnApprovedAt = D(reqAt + rand(2, 36) * HOUR);
                doc.returnApprovedBy = chance(0.5) ? seller._id : ctx.admin._id;
            }
        }

        // updatedAt = mốc muộn nhất
        const stamps = [t.createdAt, t.confirmedAt, t.pickedUpAt, t.deliveredAt, t.completedAt, t.cancelledAt,
            doc.returnRequestedAt && doc.returnRequestedAt.getTime(), doc.returnApprovedAt && doc.returnApprovedAt.getTime(),
            doc.returnRejectedAt && doc.returnRejectedAt.getTime()].filter(Boolean);
        doc.updatedAt = D(Math.max(...stamps));
        return doc;
    };

    // (a) đơn tạo từ offer đã được chấp nhận
    for (const offer of acceptedOffers.slice(0, Math.floor(COUNT.orders * 0.25))) {
        const product = productById.get(sid(offer.productId));
        const buyer = ctx.userById.get(sid(offer.buyerId));
        if (!product || !buyer || usedProducts.has(sid(product))) continue;
        if (!ctx.userById.has(sid(product.userId)) || sid(product.userId) !== sid(offer.sellerId)) continue;
        usedProducts.add(sid(product));
        docs.push(makeOrder({ product, buyer, offer }));
    }
    // (b) đơn đặt mua trực tiếp
    const pool = shuffle(ctx.products);
    for (const product of pool) {
        if (docs.length >= COUNT.orders) break;
        if (usedProducts.has(sid(product)) || !ctx.userById.has(sid(product.userId))) continue;
        const buyer = pick(ctx.people.filter((u) => sid(u) !== sid(product.userId)));
        if (!buyer) continue;
        usedProducts.add(sid(product));
        docs.push(makeOrder({ product, buyer, offer: null }));
    }

    const n = await insertDocs(Order, docs);
    ctx.orders = docs.map((d) => ({ ...d }));

    // đồng bộ trạng thái sản phẩm: đơn đang hiệu lực -> Sold, đơn hủy / hoàn -> Available
    const SOLD_STATUSES = ['pending', 'confirmed', 'picked_up', 'completed', 'return_requested', 'return_rejected'];
    await bulk(Product, docs.map((o) => ({
        updateOne: { filter: { _id: o.productId }, update: { $set: { status: SOLD_STATUSES.includes(o.status) ? 'Sold' : 'Available' } } }
    })));
    // cập nhật số lần dùng mã giảm giá
    const cops = [...couponUse.entries()].map(([id, c]) => ({ updateOne: { filter: { _id: id }, update: { $inc: { usedCount: c } } } }));
    if (cops.length) await bulk(Coupon, cops);
    return n;
}

// 7. Payment (nguồn dữ liệu doanh thu: status = 'confirmed' theo confirmedAt)
async function seedPayments() {
    const orders = await getOrders();
    const usedCodes = new Set();
    const genCode = () => {
        for (let i = 0; i < 50; i++) {
            const code = Array.from({ length: 3 }, () => String.fromCharCode(65 + rand(0, 25))).join('') + randDigits(3);
            if (!usedCodes.has(code)) { usedCodes.add(code); return code; }
        }
        throw new Error('Không tạo được mã giao dịch không trùng');
    };
    const docs = [];
    for (const o of orders) {
        const buyer = ctx.userById.get(sid(o.buyerId));
        if (!buyer) continue;
        const amount = o.finalPrice;
        const platformFee = Math.round(amount * 5 / 100);
        const vatAmount = Math.round(platformFee * 10 / 100);
        const createdAt = new Date(o.createdAt).getTime() + rand(1, 30) * 60 * 1000;
        const isMomo = o.paymentMethod === 'momo';
        const doc = {
            _id: oid(), orderId: o._id, buyerId: o.buyerId,
            buyerName: buyer.name, buyerPhone: buyer.phone || '0900000000',
            amount, platformFeePercent: 5, vatPercent: 10, platformFee, vatAmount,
            sellerAmount: amount - platformFee - vatAmount,
            transactionCode: genCode(),
            paymentMethod: isMomo ? 'momo' : 'bank_transfer',
            shippingAddress: o.shippingAddress,
            paymentProof: null, status: 'pending',
            expiresAt: D(createdAt + DAY), createdAt: D(createdAt)
        };
        const tConfirm = o.confirmedAt ? new Date(o.confirmedAt).getTime() : createdAt + rand(2, 10) * HOUR;
        let last = createdAt;

        if (o.status === 'pending') {
            if (!isMomo && chance(0.5)) doc.paymentProof = placeholderImage('Biên lai chuyển khoản');
        } else if (o.status === 'cancelled' || o.status === 'returned') {
            doc.status = 'rejected';
            doc.rejectionReason = o.status === 'returned' ? 'Hoàn tiền do đơn hàng được trả lại.' : pick(PAYMENT_REJECT_REASONS);
            last = createdAt + rand(1, 20) * HOUR;
        } else {
            doc.status = 'confirmed';
            doc.confirmedBy = ctx.admin._id;
            doc.confirmedAt = D(tConfirm);
            doc.adminApproved = true; doc.adminApprovedAt = D(tConfirm); doc.adminApprovedBy = ctx.admin._id;
            doc.sellerApproved = true; doc.sellerApprovedAt = D(tConfirm + rand(1, 6) * HOUR); doc.sellerApprovedBy = o.sellerId;
            last = doc.sellerApprovedAt.getTime();
            if (isMomo) {
                doc.momoOrderId = `MOMO${new Date(tConfirm).getTime()}${rand(100, 999)}`;
                doc.momoTransId = randDigits(11);
                doc.momoResultCode = 0;
            } else if (o.paymentMethod === 'transfer') {
                doc.paymentProof = placeholderImage('Biên lai chuyển khoản');
            }
            if (o.paymentMethod === 'cash' && o.status === 'completed') {
                doc.codConfirmedByAdmin = true;
                doc.codConfirmedAt = D(tConfirm + rand(1, 12) * HOUR);
            }
            if (o.status === 'completed') {
                const doneAt = o.completedAt ? new Date(o.completedAt).getTime() : tConfirm + DAY;
                const roll = Math.random();
                if (roll < 0.85) {
                    doc.sellerPaid = true;
                    doc.sellerPaidAt = D(doneAt + rand(1, 72) * HOUR);
                    doc.sellerPaidBy = ctx.admin._id;
                    doc.sellerPaymentProof = placeholderImage('Biên lai chuyển cho người bán', '#059669');
                    last = Math.max(last, doc.sellerPaidAt.getTime());
                    if (chance(0.75)) {
                        doc.sellerConfirmedReceipt = true;
                        doc.sellerReceiptConfirmedAt = D(doc.sellerPaidAt.getTime() + rand(1, 24) * HOUR);
                        last = Math.max(last, doc.sellerReceiptConfirmedAt.getTime());
                    }
                } else if (roll < 0.9) {
                    doc.sellerPaid = true;
                    doc.sellerPaidAt = D(doneAt + rand(1, 48) * HOUR);
                    doc.sellerPaidBy = ctx.admin._id;
                    doc.sellerPaymentProof = placeholderImage('Biên lai chuyển cho người bán', '#059669');
                    doc.sellerReportedIssue = true;
                    doc.sellerReportReason = 'Mình chưa nhận được tiền trong tài khoản.';
                    doc.sellerReportedAt = D(doc.sellerPaidAt.getTime() + rand(6, 48) * HOUR);
                    last = Math.max(last, doc.sellerReportedAt.getTime());
                }
            }
        }
        doc.updatedAt = D(Math.min(NOW, Math.max(last, tConfirm)));
        docs.push(doc);
    }
    return insertDocs(Payment, docs);
}

// 8. Review (đánh giá sau giao dịch hoàn thành) + cập nhật rating
async function seedReviews() {
    const orders = (await getOrders()).filter((o) => o.status === 'completed');
    const docs = [];
    const pickRating = () => weighted([[5, 50], [4, 30], [3, 12], [2, 5], [1, 3]]);
    const sentimentOf = (r) => (r >= 4 ? 'positive' : r === 3 ? 'neutral' : 'negative');
    for (const o of orders) {
        const doneAt = new Date(o.completedAt || o.updatedAt || o.createdAt).getTime();
        if (chance(0.7)) {
            const rating = pickRating();
            const at = Math.min(NOW - HOUR, doneAt + rand(2, 96) * HOUR);
            docs.push({
                _id: oid(), transactionId: sid(o), orderId: o._id, reviewerId: o.buyerId, reviewedUserId: o.sellerId,
                productId: o.productId, rating, comment: pick(REVIEW_BY_RATING[rating]), images: [], isSeller: false,
                sentiment: sentimentOf(rating), sentimentScore: rating, createdAt: D(at)
            });
        }
        if (chance(0.3)) {
            const rating = weighted([[5, 65], [4, 25], [3, 7], [2, 2], [1, 1]]);
            const at = Math.min(NOW - HOUR, doneAt + rand(2, 120) * HOUR);
            docs.push({
                _id: oid(), transactionId: sid(o), orderId: o._id, reviewerId: o.sellerId, reviewedUserId: o.buyerId,
                productId: o.productId, rating, comment: pick(REVIEW_SELLER_TO_BUYER), images: [], isSeller: true,
                sentiment: sentimentOf(rating), sentimentScore: rating, createdAt: D(at)
            });
        }
    }
    const n = await insertDocs(Review, docs);

    // điểm trung bình của người được đánh giá
    const byUser = new Map();
    docs.forEach((r) => { const k = sid(r.reviewedUserId); (byUser.get(k) || byUser.set(k, []).get(k)).push(r.rating); });
    await bulk(User, [...byUser.entries()].map(([id, arr]) => ({
        updateOne: { filter: { _id: id }, update: { $set: { 'rating.average': Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10, 'rating.count': arr.length } } }
    })));
    // điểm trung bình của sản phẩm (chỉ tính đánh giá của người mua)
    const byProduct = new Map();
    docs.filter((r) => !r.isSeller).forEach((r) => { const k = sid(r.productId); (byProduct.get(k) || byProduct.set(k, []).get(k)).push(r.rating); });
    await bulk(Product, [...byProduct.entries()].map(([id, arr]) => ({
        updateOne: { filter: { _id: id }, update: { $set: { averageRating: Math.round(arr.reduce((s, x) => s + x, 0) / arr.length * 10) / 10, totalReviews: arr.length } } }
    })));
    return n;
}

// 9. Post (bài đăng gắn với sản phẩm)
async function seedPosts() {
    const chosen = sample(ctx.products.filter((p) => ctx.userById.has(sid(p.userId)) && p.images && p.images.length), COUNT.posts);
    const docs = chosen.map((p) => {
        const tagify = (t) => String(t).toLowerCase().replace(/\s+/g, '');
        const tags = [...new Set([tagify(p.category), ...(p.tags || []).map(tagify), 'passđồ', 'sinhviên'])]
            .filter(Boolean).slice(0, 5);
        const likes = sample(ctx.people.filter((u) => sid(u) !== sid(p.userId)), rand(0, 12)).map((u) => u._id);
        const createdAt = pastTime(HOUR, 60 * DAY);
        return {
            _id: oid(), userId: p.userId, productId: p._id,
            images: p.images.slice(0, 4), videos: [],
            caption: `Pass lại ${p.title} giá ${money(p.price)}đ. Ai cần ib mình nhé! ${tags.map((t) => `#${t}`).join(' ')}`,
            hashtags: tags, mentions: [], location: pick(POST_LOCATIONS), price: p.price,
            category: CAT_EN[p.category] || 'Other', condition: p.condition,
            status: p.status === 'Sold' ? 'sold' : 'available',
            likes, likeCount: likes.length, commentCount: 0, shareCount: rand(0, 6), viewCount: rand(20, 600),
            isApproved: true, reports: [], createdAt: D(createdAt)
        };
    });
    const n = await insertDocs(Post, docs);
    ctx.posts = docs.map((d) => ({ ...d }));
    await bulk(Product, docs.map((d) => ({ updateOne: { filter: { _id: d.productId }, update: { $set: { postId: d._id, likeCount: d.likeCount, shareCount: d.shareCount } } } })));
    return n;
}

// 10. Hashtag (tổng hợp từ bài đăng)
async function seedHashtags() {
    const posts = await getPosts();
    const map = new Map();
    posts.forEach((p) => (p.hashtags || []).forEach((h) => {
        if (!map.has(h)) map.set(h, []);
        map.get(h).push(p._id);
    }));
    const docs = [...map.entries()].map(([name, ids]) => ({
        _id: oid(), name: name.toLowerCase(), posts: ids, postCount: ids.length, lastUsedAt: D(pastTime(HOUR, 30 * DAY)), createdAt: D(pastTime(30 * DAY, 90 * DAY))
    }));
    return insertDocs(Hashtag, docs);
}

// 11. Comment (sản phẩm và bài đăng, có trả lời và lượt thích)
// 11. Comment: bình luận sản phẩm CHỈ của người đã mua (đơn đã nhận hàng), bài đăng giữ như cũ
async function seedComments() {
    const docs = [];
    const orders = (await getOrders()).filter((o) =>
        ['completed', 'return_requested', 'return_rejected', 'returned'].includes(o.status));

    // (a) bình luận sản phẩm: người mua + người bán trả lời
    for (const o of orders) {
        if (!chance(0.85)) continue;
        const buyer = ctx.userById.get(sid(o.buyerId));
        if (!buyer) continue;
        const doneAt = new Date(o.completedAt || o.updatedAt || o.createdAt).getTime();
        const at = Math.min(NOW - HOUR, doneAt + rand(2, 96) * HOUR);
        const rating = weighted([[5, 50], [4, 30], [3, 12], [2, 5], [1, 3]]);
        const likes = sample(ctx.people, rand(0, 5)).map((u) => u._id);
        const replies = [];
        if (chance(0.5)) {
            const rAt = Math.min(NOW - 1000, at + rand(10, 600) * 60 * 1000);
            replies.push({ userId: o.sellerId, content: pick(COMMENT_REPLIES), likes: [], createdAt: D(rAt) });
        }
        docs.push({
            _id: oid(), productId: o.productId, userId: o.buyerId,
            content: pick(REVIEW_BY_RATING[rating]),
            likes, likeCount: likes.length, replies, createdAt: D(at),
            updatedAt: D(replies.length ? replies[0].createdAt.getTime() : at)
        });
    }

    // (b) bình luận bài đăng (mạng xã hội, ai cũng bình luận được)
    const posts = await getPosts();
    for (let i = 0; posts.length && i < COUNT.postComments; i++) {
        const p = pick(posts);
        const commenter = pick(ctx.people.filter((u) => sid(u) !== sid(p.userId)));
        if (!commenter) continue;
        const start = Math.max(new Date(p.createdAt).getTime(), NOW - 60 * DAY);
        const at = start + Math.random() * Math.max(HOUR, NOW - start - HOUR);
        const likes = sample(ctx.people, rand(0, 5)).map((u) => u._id);
        docs.push({
            _id: oid(), postId: p._id, userId: commenter._id, content: pick(POST_COMMENTS),
            likes, likeCount: likes.length, replies: [], createdAt: D(at), updatedAt: D(at)
        });
    }

    const n = await insertDocs(Comment, docs);

    const byProduct = new Map(), byPost = new Map();
    docs.forEach((c) => {
        if (c.productId) (byProduct.get(sid(c.productId)) || byProduct.set(sid(c.productId), []).get(sid(c.productId))).push(c._id);
        if (c.postId) byPost.set(sid(c.postId), (byPost.get(sid(c.postId)) || 0) + 1);
    });
    await bulk(Product, [...byProduct.entries()].map(([id, ids]) => ({ updateOne: { filter: { _id: id }, update: { $set: { comments: ids } } } })));
    await bulk(Post, [...byPost.entries()].map(([id, cnt]) => ({ updateOne: { filter: { _id: id }, update: { $set: { commentCount: cnt } } } })));
    return n;
}
// 12. Collection (bộ sưu tập bài đăng)
async function seedCollections() {
    const posts = await getPosts();
    if (!posts.length) { console.log('   (chưa có Post nên không tạo Collection)'); return 0; }
    const docs = [];
    for (const owner of sample(ctx.people, Math.min(12, ctx.people.length))) {
        for (const [name, description] of sample(COLLECTION_NAMES, rand(1, 2))) {
            const chosen = sample(posts, rand(3, 8));
            docs.push({
                _id: oid(), userId: owner._id, name, description,
                coverImage: (chosen[0].images && chosen[0].images[0]) || '',
                posts: chosen.map((p) => p._id), postCount: chosen.length, isPublic: chance(0.75),
                createdAt: D(pastTime(DAY, 60 * DAY))
            });
        }
    }
    return insertDocs(Collection, docs);
}

// 13. Bookmark
async function seedBookmarks() {
    const docs = [];
    for (const u of ctx.people) {
        const prods = sample(ctx.products.filter((p) => sid(p.userId) !== sid(u)), rand(3, 10));
        for (const p of prods) {
            docs.push({
                _id: oid(), userId: u._id, productId: p._id, tags: sample(BOOKMARK_TAGS, rand(0, 2)),
                notes: pick(BOOKMARK_NOTES), createdAt: D(pastTime(HOUR, 60 * DAY))
            });
        }
    }
    return insertDocs(Bookmark, docs);
}

// 14. Yêu thích (mảng favorites trong User, chỉ điền cho người chưa có)
async function seedFavorites() {
    const targets = ctx.people.filter((u) => !(u.favorites && u.favorites.length));
    const ops = targets.map((u) => ({
        updateOne: {
            filter: { _id: u._id },
            update: { $set: { favorites: sample(ctx.products.filter((p) => sid(p.userId) !== sid(u)), rand(3, 12)).map((p) => p._id) } }
        }
    }));
    if (ops.length) await bulk(User, ops);
    return ops.length;
}

// 15. ProductView
async function seedViews() {
    const docs = [];
    const hot = sample(ctx.products, Math.max(10, Math.floor(ctx.products.length * 0.2))); // một phần sản phẩm được xem nhiều hơn
    for (let i = 0; i < COUNT.views; i++) {
        const p = chance(0.6) ? pick(hot) : pick(ctx.products);
        const viewer = pick(ctx.people.filter((u) => sid(u) !== sid(p.userId)));
        if (!viewer) continue;
        const at = D(NOW - Math.pow(Math.random(), 1.4) * 30 * DAY);
        docs.push({ _id: oid(), userId: viewer._id, productId: p._id, viewedAt: at, createdAt: at });
    }
    return insertDocs(ProductView, docs);
}

// 16. SearchHistory
async function seedSearches() {
    const docs = [];
    for (let i = 0; i < COUNT.searches; i++) {
        const u = pick(ctx.people);
        const term = pick(SEARCH_TERMS);
        const filters = {};
        if (chance(0.35)) filters.category = pick(Object.keys(CAT_EN));
        if (chance(0.25)) filters.maxPrice = pick([100000, 200000, 500000, 1000000]);
        if (chance(0.2)) filters.location = pick(['Campus', 'Dormitory', 'Nearby']);
        docs.push({ _id: oid(), userId: u._id, searchTerm: term, filters, resultCount: rand(0, 40), createdAt: D(pastTime(HOUR, 45 * DAY)) });
    }
    return insertDocs(SearchHistory, docs);
}

// 17. Story (story thường hết hạn trong 24 giờ, story nổi bật hết hạn sau 10 năm; TTL của MongoDB sẽ tự xóa khi hết hạn)
async function seedStories() {
    const docs = [];
    const mediaFor = (u) => {
        const own = ctx.products.filter((p) => sid(p.userId) === sid(u) && p.images && p.images.length);
        const p = own.length ? pick(own) : pick(ctx.products.filter((x) => x.images && x.images.length));
        return (p && p.images[0]) || placeholderImage('Story', '#7C3AED');
    };
    const makeViews = (owner, createdAt, expiresAt) => sample(ctx.people.filter((u) => sid(u) !== sid(owner)), rand(2, 15))
        .map((u) => ({ userId: u._id, viewedAt: D(Math.min(NOW - 1000, expiresAt - 1000, createdAt + rand(5, 600) * 60 * 1000)) }));
    for (let i = 0; i < COUNT.stories; i++) {
        const owner = pick(ctx.people);
        const highlight = i < 8;
        const createdAt = highlight ? pastTime(2 * DAY, 60 * DAY) : NOW - rand(30, 22 * 60) * 60 * 1000;
        const expiresAt = highlight ? NOW + 3650 * DAY : createdAt + DAY;
        const views = makeViews(owner, createdAt, Math.min(expiresAt, NOW + DAY));
        const stickers = chance(0.5) ? [{ type: 'emoji', content: pick(STORY_EMOJI), position: { x: rand(10, 80), y: rand(10, 80) } }] : [];
        docs.push({
            _id: oid(), userId: owner._id, mediaType: 'image', mediaUrl: mediaFor(owner),
            text: pick(STORY_TEXTS), stickers, expiresAt: D(expiresAt),
            views, viewCount: views.length,
            reactions: sample(views, rand(0, 4)).map((v) => ({ userId: v.userId, emoji: pick(['❤️', '🔥', '😍', '👍']), reactedAt: v.viewedAt })),
            isHighlight: highlight, ...(highlight ? { highlightTitle: pick(HIGHLIGHT_TITLES) } : {}),
            createdAt: D(createdAt)
        });
    }
    return insertDocs(Story, docs);
}

// 18. Message (hội thoại mua bán)
async function seedMessages() {
    const docs = [];
    const prods = ctx.products.filter((p) => ctx.userById.has(sid(p.userId)));
    for (let i = 0; i < COUNT.messageThreads; i++) {
        const p = pick(prods);
        const seller = ctx.userById.get(sid(p.userId));
        const buyer = pick(ctx.people.filter((u) => sid(u) !== sid(seller)));
        if (!buyer) continue;
        const conversationId = [sid(buyer), sid(seller)].sort().join('_');
        const offerPrice = round1000(p.price * (0.7 + Math.random() * 0.2));
        const place = pick(MESSAGE_LOCATIONS);
        const script = [
            [buyer, seller, `Chào bạn, "${p.title}" còn không ạ?`],
            [seller, buyer, 'Còn nha bạn, bạn cần xem thêm ảnh không?'],
            [buyer, seller, `Mình trả ${money(offerPrice)}đ được không bạn?`, offerPrice],
            [seller, buyer, chance(0.6) ? 'Ok bạn, mình chốt giá đó nhé.' : `Mình bớt được đến ${money(round1000(p.price * 0.9))}đ thôi bạn.`],
            [buyer, seller, `Vậy mình qua ${place} lấy nhé.`],
            [seller, buyer, 'Ok bạn, hẹn gặp!']
        ].slice(0, rand(3, 6));
        let t = pastTime(2 * HOUR, 30 * DAY);
        const unreadTail = chance(0.25);
        script.forEach(([from, to, content, offer], idx) => {
            t += rand(1, 30) * 60 * 1000;
            const isLast = idx === script.length - 1;
            docs.push({
                _id: oid(), conversationId, senderId: from._id, receiverId: to._id, productId: p._id,
                content, isRead: !(unreadTail && isLast),
                ...(offer ? { offerPrice: offer } : {}), attachments: [], createdAt: D(Math.min(t, NOW - 1000))
            });
        });
    }
    return insertDocs(Message, docs);
}

// 19. Notification
async function seedNotifications() {
    const docs = [];
    const prods = ctx.products.filter((p) => ctx.userById.has(sid(p.userId)));
    const makers = [
        (u, p, o) => ({ type: 'new_message', title: 'Tin nhắn mới', message: `${o.name} đã nhắn tin cho bạn về "${p.title}"`, data: { productId: p._id, senderId: o._id } }),
        (u, p, o) => ({ type: 'new_comment', title: 'Bình luận mới', message: `${o.name} đã bình luận về "${p.title}"`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'new_offer', title: 'Có người trả giá', message: `${o.name} đã trả giá cho "${p.title}"`, data: { productId: p._id, buyerId: o._id } }),
        (u, p, o) => ({ type: 'offer_accepted', title: 'Offer được chấp nhận', message: `Người bán đã chấp nhận giá của bạn cho "${p.title}"`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'offer_rejected', title: 'Offer bị từ chối', message: `Người bán đã từ chối giá của bạn cho "${p.title}"`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'offer_countered', title: 'Người bán trả giá lại', message: `Người bán đề xuất giá mới cho "${p.title}"`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'new_review', title: 'Có đánh giá mới', message: `${o.name} đã đánh giá sản phẩm "${p.title}" của bạn`, data: { productId: p._id, rating: rand(3, 5) } }),
        (u, p, o) => ({ type: 'product_favorited', title: 'Có người yêu thích', message: `${o.name} đã thêm "${p.title}" vào yêu thích`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'user_followed', title: 'Người theo dõi mới', message: `${o.name} đã bắt đầu theo dõi bạn`, data: { userId: o._id } }),
        (u, p, o) => ({ type: 'favorite_price_drop', title: 'Sản phẩm yêu thích giảm giá', message: `"${p.title}" vừa giảm giá còn ${money(round1000(p.price * 0.9))}đ`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'review_reminder', title: 'Nhắc đánh giá', message: `Bạn hãy đánh giá giao dịch "${p.title}" nhé`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'product_trending', title: 'Sản phẩm đang được quan tâm', message: `"${p.title}" đang có nhiều lượt xem`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'payment_confirmed', title: 'Thanh toán đã xác nhận', message: `Thanh toán cho "${p.title}" đã được xác nhận`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'payment_rejected', title: 'Thanh toán bị từ chối', message: `Thanh toán cho "${p.title}" chưa hợp lệ, vui lòng kiểm tra lại`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'product_approved', title: 'Sản phẩm đã được duyệt', message: `"${p.title}" của bạn đã được duyệt và hiển thị`, data: { productId: p._id } }),
        (u, p, o) => ({ type: 'new_coupon', title: 'Mã giảm giá mới', message: 'Có mã giảm giá mới dành cho bạn, vào xem ngay!', data: {} }),
        (u, p, o) => ({ type: 'offer_expired', title: 'Offer đã hết hạn', message: `Offer của bạn cho "${p.title}" đã hết hạn`, data: { productId: p._id } })
    ];
    for (const u of ctx.people) {
        for (let i = 0; i < rand(4, 10); i++) {
            const p = pick(prods);
            const other = pick(ctx.people.filter((x) => sid(x) !== sid(u)));
            const base = pick(makers)(u, p, other);
            const createdAt = pastTime(HOUR, 30 * DAY);
            const isRead = chance(0.6);
            docs.push({
                _id: oid(), userId: u._id, ...base, isRead,
                ...(isRead ? { readAt: D(createdAt + rand(1, 600) * 60 * 1000) } : {}), createdAt: D(createdAt)
            });
        }
    }
    return insertDocs(Notification, docs);
}

// 20. NotificationSettings (mỗi người dùng 1 bản ghi)
async function seedNotificationSettings() {
    const keys = ['favoritePriceDrop', 'reviewReminder', 'productExpiring', 'productTrending', 'newOffer', 'newMessage', 'newComment', 'newReview', 'productApproved', 'productRejected', 'paymentNotification'];
    const docs = [...ctx.people, ctx.admin].filter(Boolean).map((u) => {
        const s = { _id: oid(), userId: u._id, createdAt: D(pastTime(DAY, 60 * DAY)) };
        keys.forEach((k) => { s[k] = !(chance(0.12) && ['productTrending', 'reviewReminder', 'productExpiring'].includes(k)); });
        return s;
    });
    return insertDocs(NotificationSettings, docs);
}

// 21. Bổ sung hồ sơ người dùng (chỉ điền các trường còn trống, không ghi đè)
async function seedUserStats() {
    const posts = await getPosts();
    const postCount = new Map();
    posts.forEach((p) => postCount.set(sid(p.userId), (postCount.get(sid(p.userId)) || 0) + 1));
    const ops = [];
    for (const u of ctx.people) {
        const set = {};
        if (!u.nickname) set.nickname = `${asciiLower(u.name).split(/\s+/).slice(-1)[0]}${rand(10, 99)}`;
        if (!u.coverPhoto) set.coverPhoto = coverImage(u._id);
        if (!u.website && chance(0.2)) set.website = `https://facebook.com/${asciiLower(u.name).replace(/\s+/g, '.')}`;
        if (postCount.has(sid(u)) && !u.postCount) set.postCount = postCount.get(sid(u));
        if (!u.lastSeen || chance(0.3)) set.lastSeen = D(NOW - rand(1, 72 * 60) * 60 * 1000);
        if (u.isOnline === undefined || u.isOnline === false) set.isOnline = chance(0.2);
        if (Object.keys(set).length) ops.push({ updateOne: { filter: { _id: u._id }, update: { $set: set } } });
    }
    if (ops.length) await bulk(User, ops);
    return ops.length;
}

// ==========================================
// CHẠY
// ==========================================
const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB thành công\n');

        // ---- nạp user và sản phẩm ----
        const users = await User.find({}).lean();
        ctx.users = users;
        ctx.userById = new Map(users.map((u) => [sid(u), u]));
        ctx.admin = users.find((u) => u.isAdmin) || null;
        ctx.shippers = users.filter((u) => u.isShipper && u.shipperStatus === 'approved');
        ctx.people = users.filter((u) => !u.isAdmin && !u.isShipper);

        const allProducts = await Product.find({}).lean();
        ctx.products = allProducts.filter((p) => p.isApproved && ['Available', 'Sold'].includes(p.status) && ctx.userById.has(sid(p.userId)));
        ctx.productById = new Map(allProducts.map((p) => [sid(p), p]));

        if (ctx.people.length < 3) {
            console.error('❌ Cần ít nhất 3 người dùng thường. Chạy: node createMultipleUsers.js');
            process.exit(1);
        }
        if (ctx.products.length < 20) {
            console.error('❌ Cần ít nhất 20 sản phẩm đã duyệt của user hiện có. Chạy: node seed_1000_products.js');
            process.exit(1);
        }
        if (!ctx.admin) {
            console.warn('⚠️  Chưa có tài khoản admin (node createAdmin.js). Tạm dùng một user thường để làm người xác nhận thanh toán.');
            ctx.admin = ctx.people[0];
        }
        console.log(`👥 ${ctx.people.length} người dùng, 🛵 ${ctx.shippers.length} shipper, 📦 ${ctx.products.length} sản phẩm khả dụng\n`);

        await step('bankqr', 'BankQR (QR sàn)', BankQR, seedBankQR);
        await step('sellerqr', 'SellerBankQR (QR người bán)', SellerBankQR, seedSellerBankQR);
        await step('coupons', 'Coupon (mã giảm giá)', Coupon, seedCoupons);
        await step('follows', 'Follow (theo dõi)', Follow, seedFollows);
        await step('offers', 'Offer (trả giá)', Offer, seedOffers);
        await step('orders', 'Order (đơn hàng)', Order, seedOrders);
        await step('payments', 'Payment (thanh toán, doanh thu)', Payment, seedPayments);
        await step('reviews', 'Review (đánh giá)', Review, seedReviews);
        await step('posts', 'Post (bài đăng)', Post, seedPosts);
        await step('hashtags', 'Hashtag', Hashtag, seedHashtags);
        await step('comments', 'Comment (bình luận)', Comment, seedComments);
        await step('collections', 'Collection (bộ sưu tập)', Collection, seedCollections);
        await step('bookmarks', 'Bookmark (đánh dấu)', Bookmark, seedBookmarks);
        await step('views', 'ProductView (lượt xem)', ProductView, seedViews);
        await step('searches', 'SearchHistory (lịch sử tìm kiếm)', SearchHistory, seedSearches);
        await step('stories', 'Story', Story, seedStories);
        await step('messages', 'Message (tin nhắn)', Message, seedMessages);
        await step('notifications', 'Notification (thông báo)', Notification, seedNotifications);
        await step('notifsettings', 'NotificationSettings', NotificationSettings, seedNotificationSettings);

        // hai bước cập nhật trường trong User (không phải collection riêng), chỉ điền chỗ còn trống
        if (!ONLY.length || ONLY.includes('favorites')) {
            const n = await seedFavorites();
            console.log(n ? `✅ User.favorites: đã điền cho ${n} người dùng` : '⏭️  User.favorites: mọi người dùng đã có, bỏ qua');
        }
        if (!ONLY.length || ONLY.includes('userstats')) {
            const n = await seedUserStats();
            console.log(n ? `✅ Hồ sơ User: bổ sung trường còn trống cho ${n} người dùng` : '⏭️  Hồ sơ User: không có trường nào cần bổ sung');
        }

        // ---- tổng kết ----
        const revenue = await Payment.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]);
        console.log('\n📊 Tổng kết');
        summary.forEach(([label, state, n]) => console.log(`   ${state === 'đã tạo' ? '✅' : '⏭️ '} ${label}: ${state} (${n})`));
        if (revenue.length) console.log(`\n💰 Doanh thu (thanh toán đã xác nhận): ${money(revenue[0].total)}đ từ ${revenue[0].count} giao dịch`);
        console.log('\n✨ Hoàn thành!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
        if (error.errors) Object.values(error.errors).slice(0, 5).forEach((e) => console.error('   -', e.message));
        process.exit(1);
    }
};

run();