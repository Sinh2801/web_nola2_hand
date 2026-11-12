/**
 * SEEDER ĐƠN HÀNG + THANH TOÁN (NOLA2HAND)
 *
 * Chạy SAU khi đã chạy seed_1000_products.js:
 *   node seed_payments.js              xóa Order/Payment cũ và tạo mới
 *   node seed_payments.js --dry-run    chỉ in bảng doanh thu theo tháng, không ghi DB
 *   node seed_payments.js --keep-old   giữ Order/Payment cũ, chỉ gán lại sản phẩm mới cho
 *                                      các đơn đang trỏ vào sản phẩm đã bị xóa
 *
 * Doanh thu trang thống kê = Payment có status 'confirmed', tính theo confirmedAt.
 * Script tạo mỗi đơn gồm 1 Order + 1 Payment đã xác nhận, doanh thu tăng dần theo
 * ngày/tháng. Sản phẩm được bán sẽ chuyển sang 'Sold' và lùi ngày đăng về trước ngày bán.
 *
 * Tùy chỉnh bằng .env (đều không bắt buộc):
 *   SEED_ORDERS=700      tổng số đơn đã xác nhận
 *   SEED_MONTHS=12       số tháng dữ liệu
 *   SEED_GROWTH=1.10     mức tăng mỗi tháng (1.10 = +10%/tháng)
 *   SEED_PROOF_URL=...   ảnh biên lai dùng chung cho dữ liệu mẫu
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');
const User = require('./models/User');
const Order = require('./models/Order');
const Payment = require('./models/Payment');

// ==========================================
// CẤU HÌNH
// ==========================================
const ARGS = new Set(process.argv.slice(2));
const KEEP_OLD = ARGS.has('--keep-old');
const DRY_RUN = ARGS.has('--dry-run');

const TOTAL_ORDERS = Number(process.env.SEED_ORDERS) || 700;
const MONTHS = Number(process.env.SEED_MONTHS) || 12;
const GROWTH = Number(process.env.SEED_GROWTH) || 1.1;
const PROOF_URL = process.env.SEED_PROOF_URL || 'https://placehold.co/600x800/png?text=Bien+lai';

const MIN_AVAILABLE = 150;   // luôn chừa lại ít nhất ngần này sản phẩm còn hàng
const PENDING_COUNT = 5;     // số giao dịch "chờ duyệt" để trang admin có dữ liệu
const REJECTED_RATIO = 0.04; // tỷ lệ giao dịch bị từ chối
const PRICE_TREND = 0.4;     // 0 = giá ngẫu nhiên, càng lớn càng nghiêng về đơn giá cao ở các tháng sau
const FEE_PERCENT = 5;
const VAT_PERCENT = 10;

const HOUR = 3600 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * HOUR;
const VN = 7 * HOUR; // UTC+7

// Hệ số theo thứ trong tuần (0 = Chủ nhật)
const WEEKDAY = [1.2, 0.95, 1, 1, 1, 1.1, 1.3];
// Giờ mua hàng: buổi tối nhiều hơn
const HOUR_WEIGHTS = [
    [8, 2], [9, 3], [10, 4], [11, 4], [12, 5], [13, 4], [14, 4], [15, 4],
    [16, 5], [17, 6], [18, 7], [19, 9], [20, 10], [21, 9], [22, 6], [23, 3]
];
const HOUR_TOTAL = HOUR_WEIGHTS.reduce((s, [, w]) => s + w, 0);

const ADDRESSES = [
    { address: 'Ký túc xá khu B, Đại học Nông Lâm', ward: 'Linh Trung', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh' },
    { address: 'Cổng chính Đại học Nông Lâm, khu phố 6', ward: 'Linh Trung', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh' },
    { address: 'Ký túc xá khu A, Đại học Nông Lâm', ward: 'Linh Trung', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh' },
    { address: 'Nhà trọ gần chợ Thủ Đức', ward: 'Linh Chiểu', district: 'Thủ Đức', city: 'TP. Hồ Chí Minh' }
];
const REJECT_REASONS = [
    'Biên lai không hợp lệ',
    'Số tiền chuyển khoản không khớp',
    'Ảnh biên lai bị mờ, không đọc được'
];

// ==========================================
// TIỆN ÍCH
// ==========================================
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
};
const vnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';
const monthKey = (ms) => new Date(ms + VN).toISOString().slice(0, 7);

// Mã giao dịch dạng KXE098 (3 chữ + 3 số), không trùng
const makeCodeGen = (used) => () => {
    const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for (;;) {
        const c = L[randInt(0, L.length - 1)] + L[randInt(0, L.length - 1)] + L[randInt(0, L.length - 1)]
            + String(randInt(0, 999)).padStart(3, '0');
        if (!used.has(c)) { used.add(c); return c; }
    }
};

function genTime(dayStart, now) {
    for (let t = 0; t < 10; t++) {
        let r = Math.random() * HOUR_TOTAL;
        let h = 20;
        for (const [hh, w] of HOUR_WEIGHTS) { r -= w; if (r <= 0) { h = hh; break; } }
        const ms = dayStart + h * HOUR + randInt(0, 59) * MIN + randInt(0, 59) * 1000;
        if (ms <= now - 5 * MIN) return ms;
    }
    return now - randInt(10, 300) * MIN;
}

// Rải n mốc thời gian trong MONTHS tháng gần nhất, tăng dần theo thời gian
function buildDates(n, now) {
    const totalDays = Math.round(MONTHS * 30.4);
    const todayStart = Math.floor((now + VN) / DAY) * DAY - VN;
    const start = todayStart - (totalDays - 1) * DAY;

    // Trọng số từng ngày: tăng dần theo thời gian, cuối tuần nhiều hơn, thỉnh thoảng có ngày cao điểm
    const weights = [];
    let sum = 0;
    for (let i = 0; i < totalDays; i++) {
        const dayStart = start + i * DAY;
        const wd = new Date(dayStart + VN).getUTCDay();
        const w = Math.pow(GROWTH, i / 30.4) * WEEKDAY[wd] * rand(0.9, 1.1) * (Math.random() < 0.03 ? 1.5 : 1);
        weights.push(w);
        sum += w;
    }

    // Chia số đơn theo từng ngày (làm tròn ngẫu nhiên để các tháng tăng đều, không bị lệch lớn)
    const counts = weights.map((w) => {
        const e = (n * w) / sum;
        const f = Math.floor(e);
        return f + (Math.random() < e - f ? 1 : 0);
    });
    let diff = counts.reduce((a, b) => a + b, 0) - n;
    while (diff !== 0) {
        const i = randInt(0, totalDays - 1);
        if (diff > 0 && counts[i] > 0) { counts[i] -= 1; diff -= 1; }
        else if (diff < 0) { counts[i] += 1; diff += 1; }
    }

    const dates = [];
    counts.forEach((c, i) => {
        for (let k = 0; k < c; k++) dates.push(genTime(start + i * DAY, now));
    });
    return dates.sort((a, b) => a - b);
}

function orderState(ageDays) {
    const r = Math.random();
    if (ageDays > 6) return 'completed';
    if (ageDays > 3) return r < 0.85 ? 'completed' : 'picked_up';
    if (ageDays > 1) return r < 0.5 ? 'completed' : r < 0.8 ? 'picked_up' : 'confirmed';
    return r < 0.2 ? 'picked_up' : 'confirmed';
}

function pickMethod() {
    const r = Math.random();
    return r < 0.6 ? 'transfer' : r < 0.8 ? 'momo' : 'vnpay';
}

// ==========================================
// TẠO 1 CẶP ORDER + PAYMENT
// kind: 'confirmed' | 'pending' | 'rejected'
// ==========================================
function buildRecord(ctx, product, buyer, createdMs, kind) {
    const { admin, nextCode, now } = ctx;
    const cap = (ms) => Math.min(ms, now - MIN);

    const amount = product.price;
    const platformFee = Math.round(amount * FEE_PERCENT / 100);
    const vatAmount = Math.round(platformFee * VAT_PERCENT / 100);
    const sellerAmount = amount - platformFee - vatAmount;

    const orderMethod = kind === 'confirmed' ? pickMethod() : 'transfer';
    const payMethod = { transfer: 'bank_transfer', momo: 'momo', vnpay: 'vnpay' }[orderMethod];
    const deliveryMethod = pick(['delivery', 'delivery', 'delivery', 'meetup', 'meetup', 'pickup']);
    const addr = pick(ADDRESSES);
    const phone = buyer.phone || `09${randInt(10000000, 99999999)}`;
    const shippingAddress = deliveryMethod === 'delivery'
        ? { fullName: buyer.name, phone, ...addr }
        : { fullName: buyer.name, phone };

    const orderId = new mongoose.Types.ObjectId();
    const created = new Date(createdMs);
    const order = {
        _id: orderId,
        buyerId: buyer._id,
        sellerId: product.userId,
        productId: product._id,
        finalPrice: amount,
        status: 'pending',
        deliveryMethod,
        paymentMethod: orderMethod,
        shippingAddress,
        discountAmount: 0,
        expiresAt: new Date(createdMs + DAY),
        createdAt: created,
        updatedAt: created
    };

    const payment = {
        orderId,
        buyerId: buyer._id,
        buyerName: buyer.name,
        buyerPhone: phone,
        paymentMethod: payMethod,
        amount,
        platformFeePercent: FEE_PERCENT,
        vatPercent: VAT_PERCENT,
        platformFee,
        vatAmount,
        sellerAmount,
        transactionCode: nextCode(),
        shippingAddress,
        paymentProof: payMethod === 'bank_transfer' ? PROOF_URL : null,
        status: 'pending',
        expiresAt: new Date(createdMs + DAY),
        createdAt: created,
        updatedAt: created
    };

    let lastMs = createdMs;
    let confirmedMs = null;

    if (kind === 'confirmed') {
        confirmedMs = cap(createdMs + randInt(5, 180) * MIN);
        lastMs = confirmedMs;
        const ageDays = (now - createdMs) / DAY;
        const state = orderState(ageDays);

        order.status = state;
        order.confirmedAt = new Date(confirmedMs);

        let pickedMs = null;
        let doneMs = null;
        if (state === 'picked_up' || state === 'completed') {
            pickedMs = cap(confirmedMs + randInt(2, 24) * HOUR);
            order.pickedUpAt = new Date(pickedMs);
            lastMs = pickedMs;
        }
        if (state === 'completed') {
            doneMs = cap(pickedMs + randInt(1, 48) * HOUR);
            order.deliveredAt = new Date(doneMs);
            order.completedAt = new Date(doneMs);
            lastMs = doneMs;
        }

        payment.status = 'confirmed';
        payment.confirmedAt = new Date(confirmedMs);
        payment.adminApproved = true;
        payment.adminApprovedAt = new Date(confirmedMs);
        payment.sellerApproved = true;
        payment.sellerApprovedAt = new Date(Math.min(createdMs + randInt(1, 60) * MIN, confirmedMs));
        payment.sellerApprovedBy = product.userId;
        if (admin) {
            payment.confirmedBy = admin._id;
            payment.adminApprovedBy = admin._id;
        }
        if (payMethod === 'momo') {
            payment.momoOrderId = `MOMO${createdMs}${randInt(100, 999)}`;
            payment.momoTransId = String(randInt(1e9, 9e9));
            payment.momoResultCode = 0;
        }
        if (payMethod === 'vnpay') {
            payment.vnpayTxnRef = `VNP${createdMs}${randInt(100, 999)}`;
            payment.vnpayTransId = String(randInt(1e9, 9e9));
            payment.vnpayResponseCode = '00';
        }

        // Đã chuyển tiền cho người bán
        if (state === 'completed' && ageDays > 3) {
            const paidMs = cap(doneMs + randInt(1, 36) * HOUR);
            payment.sellerPaid = true;
            payment.sellerPaidAt = new Date(paidMs);
            payment.sellerPaymentProof = PROOF_URL;
            if (admin) payment.sellerPaidBy = admin._id;
            lastMs = paidMs;
            if (ageDays > 5) {
                const rcvMs = cap(paidMs + randInt(1, 24) * HOUR);
                payment.sellerConfirmedReceipt = true;
                payment.sellerReceiptConfirmedAt = new Date(rcvMs);
                lastMs = rcvMs;
            }
        }
    } else if (kind === 'rejected') {
        const cancelMs = cap(createdMs + randInt(30, 600) * MIN);
        lastMs = cancelMs;
        order.status = 'cancelled';
        order.cancelledAt = new Date(cancelMs);
        order.cancellationReason = 'Thanh toán bị từ chối';
        if (admin) order.cancelledBy = admin._id;
        payment.status = 'rejected';
        payment.rejectionReason = pick(REJECT_REASONS);
    }

    order.updatedAt = new Date(lastMs);
    payment.updatedAt = new Date(lastMs);

    return { order, payment, confirmedMs };
}

// ==========================================
// LẬP KẾ HOẠCH DỮ LIỆU (không đụng DB)
// ==========================================
function plan({ products, buyers, admin, now, usedCodes }) {
    const nextCode = makeCodeGen(usedCodes);
    const ctx = { admin, nextCode, now };
    const buyerFor = (sellerId) => {
        for (let i = 0; i < 20; i++) {
            const b = pick(buyers);
            if (String(b._id) !== String(sellerId)) return b;
        }
        return buyers.find((b) => String(b._id) !== String(sellerId)) || buyers[0];
    };

    const sold = products.filter((p) => p.status === 'Sold');
    const available = shuffle(products.filter((p) => p.status === 'Available'));

    const confirmedTarget = Math.max(sold.length, Math.min(TOTAL_ORDERS, products.length - MIN_AVAILABLE));
    const needFromAvail = Math.max(0, confirmedTarget - sold.length);
    const chosen = [...sold, ...available.slice(0, needFromAvail)];
    const rest = available.slice(needFromAvail);

    const rejectedCount = Math.min(Math.round(confirmedTarget * REJECTED_RATIO), Math.max(0, rest.length - PENDING_COUNT));
    const pendingCount = Math.min(PENDING_COUNT, rest.length);

    // Ghép sản phẩm với ngày bán: giá cao có xu hướng rơi vào các tháng sau
    const dates = buildDates(chosen.length, now);
    const byPrice = [...chosen].sort((a, b) => a.price - b.price);
    const pct = new Map(byPrice.map((p, i) => [String(p._id), i / Math.max(1, byPrice.length - 1)]));
    const ordered = chosen
        .map((p) => ({ p, s: pct.get(String(p._id)) * PRICE_TREND + Math.random() * (1 - PRICE_TREND) }))
        .sort((a, b) => a.s - b.s)
        .map((x) => x.p);

    const orders = [];
    const payments = [];
    const productOps = [];
    const confirmed = [];

    ordered.forEach((product, i) => {
        const createdMs = dates[i];
        const { order, payment, confirmedMs } = buildRecord(ctx, product, buyerFor(product.userId), createdMs, 'confirmed');
        orders.push(order);
        payments.push(payment);
        confirmed.push({ amount: payment.amount, platformFee: payment.platformFee, ms: confirmedMs });
        productOps.push({
            updateOne: {
                filter: { _id: product._id },
                update: {
                    $set: {
                        status: 'Sold',
                        createdAt: new Date(createdMs - randInt(1, 14) * DAY - randInt(0, 600) * MIN),
                        updatedAt: new Date(confirmedMs)
                    }
                }
            }
        });
    });

    // Giao dịch bị từ chối (sản phẩm vẫn còn hàng)
    const rejDates = buildDates(rejectedCount, now);
    rest.slice(0, rejectedCount).forEach((product, i) => {
        const { order, payment } = buildRecord(ctx, product, buyerFor(product.userId), rejDates[i], 'rejected');
        orders.push(order);
        payments.push(payment);
    });

    // Giao dịch chờ duyệt (mới trong 18 giờ gần đây, còn hạn 24 giờ)
    rest.slice(rejectedCount, rejectedCount + pendingCount).forEach((product) => {
        const createdMs = now - randInt(30, 18 * 60) * MIN;
        const { order, payment } = buildRecord(ctx, product, buyerFor(product.userId), createdMs, 'pending');
        orders.push(order);
        payments.push(payment);
    });

    return { orders, payments, productOps, confirmed, counts: { confirmed: chosen.length, rejected: rejectedCount, pending: pendingCount } };
}

function printMonthly(confirmed) {
    const map = new Map();
    for (const c of confirmed) {
        const k = monthKey(c.ms);
        const cur = map.get(k) || { n: 0, gmv: 0, fee: 0 };
        cur.n += 1;
        cur.gmv += c.amount;
        cur.fee += Math.round(c.amount * FEE_PERCENT / 100);
        map.set(k, cur);
    }
    console.log('\n📈 Doanh thu theo tháng (doanh thu sàn = 5% giá trị giao dịch):');
    console.log('   Tháng     Số đơn   Giá trị giao dịch        Doanh thu sàn');
    for (const k of [...map.keys()].sort()) {
        const v = map.get(k);
        console.log(`   ${k}   ${String(v.n).padStart(6)}   ${vnd(v.gmv).padStart(20)}   ${vnd(v.fee).padStart(18)}`);
    }
}

// ==========================================
// CHẠY SEEDER
// ==========================================
async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB');

        const products = await Product.find({ status: { $in: ['Available', 'Sold'] }, isApproved: true })
            .select('_id userId price status').lean();
        if (products.length === 0) {
            console.log('❌ Chưa có sản phẩm. Chạy node seed_1000_products.js trước.');
            process.exit(1);
        }

        let buyers = await User.find({ email: /^23120\d{3}@nlu\.edu\.vn$/ }).select('_id name phone').lean();
        if (buyers.length < 2) {
            buyers = await User.find({ isActive: { $ne: false }, isAdmin: { $ne: true }, isShipper: { $ne: true } })
                .select('_id name phone').lean();
        }
        if (buyers.length < 2) {
            console.log('❌ Cần ít nhất 2 user thường để làm người mua. Chạy node createMultipleUsers.js trước.');
            process.exit(1);
        }
        const admin = (await User.findOne({ isAdmin: true, isSuperAdmin: true }).select('_id').lean())
            || (await User.findOne({ isAdmin: true }).select('_id').lean());
        if (!admin) console.log('⚠️ Không tìm thấy admin, các trường confirmedBy/adminApprovedBy sẽ để trống.');

        let candidates = products;
        const usedCodes = new Set();
        const relinkOps = [];

        if (KEEP_OLD) {
            console.log('📦 Chế độ --keep-old: giữ Order/Payment cũ.');
            const existingCodes = await Payment.distinct('transactionCode');
            existingCodes.forEach((c) => usedCodes.add(c));

            const existing = await Order.find({}).select('productId buyerId status').lean();
            const productMap = new Map(products.map((p) => [String(p._id), p]));
            const used = new Set();
            const orphans = [];
            for (const o of existing) {
                if (productMap.has(String(o.productId))) used.add(String(o.productId));
                else orphans.push(o);
            }
            candidates = products.filter((p) => !used.has(String(p._id)));

            // Gán sản phẩm mới cho các đơn đang trỏ vào sản phẩm đã xóa
            let pool = shuffle(candidates.filter((p) => p.status === 'Available'));
            for (const o of orphans) {
                const idx = pool.findIndex((p) => String(p.userId) !== String(o.buyerId));
                if (idx === -1) break;
                const [p] = pool.splice(idx, 1);
                candidates = candidates.filter((c) => String(c._id) !== String(p._id));
                await Order.updateOne({ _id: o._id }, { $set: { productId: p._id, sellerId: p.userId } });
                if (['confirmed', 'picked_up', 'completed'].includes(o.status)) {
                    relinkOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: { status: 'Sold' } } } });
                }
            }
            console.log(`🔗 Đã gán lại ${orphans.length} đơn cũ sang sản phẩm mới.`);
        }

        const now = Date.now();
        const result = plan({ products: candidates, buyers, admin, now, usedCodes });
        console.log(`⚙️ Kế hoạch: ${result.counts.confirmed} đơn đã xác nhận, ${result.counts.rejected} bị từ chối, ${result.counts.pending} chờ duyệt.`);
        printMonthly(result.confirmed);

        if (DRY_RUN) {
            console.log('\n(--dry-run) Không ghi gì vào database.');
            process.exit(0);
        }

        if (!KEEP_OLD) {
            console.log('\n🗑️ Đang xóa Payment và Order cũ...');
            await Payment.deleteMany({});
            await Order.deleteMany({});
        }

        console.log('💾 Đang ghi dữ liệu...');
        for (let i = 0; i < result.orders.length; i += 500) {
            await Order.insertMany(result.orders.slice(i, i + 500));
        }
        for (let i = 0; i < result.payments.length; i += 500) {
            await Payment.insertMany(result.payments.slice(i, i + 500));
        }

        // Dùng driver gốc để giữ nguyên createdAt đã lùi ngày
        const ops = [...result.productOps, ...relinkOps];
        if (ops.length) await Product.collection.bulkWrite(ops, { ordered: false });

        console.log(`\n✨ HOÀN THÀNH! Đã tạo ${result.orders.length} đơn và ${result.payments.length} thanh toán.`);
        console.log(`   Đánh dấu ${ops.length} sản phẩm là đã bán.`);
        process.exit(0);
    } catch (error) {
        console.error('\n❌ LỖI:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
} else {
    module.exports = { plan, buildDates, buildRecord, printMonthly };
}