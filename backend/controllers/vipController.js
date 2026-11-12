const crypto = require('crypto');
const VipPackage = require('../models/VipPackage');
const VipPurchase = require('../models/VipPurchase');
const Product = require('../models/Product');
const User = require('../models/User');
const vnpayUtil = require('../utils/vnpay');
const { createAndEmitNotification } = require('../utils/notifications');

const DAY = 24 * 60 * 60 * 1000;
const PENDING_MINUTES = 30;
const TYPES = ['pin', 'highlight', 'combo'];

/* ───────────────────────── Helper ───────────────────────── */

const genCode = () =>
    `VIP${Date.now().toString(36)}${crypto.randomBytes(2).toString('hex')}`.toUpperCase();

const toInt = (v) => Math.round(Number(v));

const getIp = (req) => {
    const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '127.0.0.1';
    return ip === '::1' ? '127.0.0.1' : ip.replace('::ffff:', '');
};

// Đơn chờ thanh toán quá 30 phút thì đánh dấu hết hạn
const expirePendingPurchases = () =>
    VipPurchase.updateMany(
        { status: 'pending', pendingExpiresAt: { $lt: new Date() } },
        { $set: { status: 'expired' } }
    );

// Chuyển trạng thái nội bộ sang trạng thái mà trang kết quả thanh toán hiện có đang hiểu
const toGatewayStatus = (s) => (s === 'paid' ? 'confirmed' : s === 'pending' ? 'pending' : 'rejected');

// Kích hoạt thẻ sau khi thanh toán thành công. Chạy nhiều lần vẫn an toàn (idempotent):
// chỉ đơn đang pending/expired mới được chuyển sang paid, các lần sau trả về null.
async function activatePurchase(purchaseId, { transId, responseCode, note } = {}, io) {
    const base = await VipPurchase.findById(purchaseId);
    if (!base) return null;

    const now = new Date();
    const set = {
        status: 'paid',
        paidAt: now,
        usesLeft: base.packageSnapshot.quantity,
        cardExpiresAt: new Date(now.getTime() + base.packageSnapshot.validDays * DAY)
    };
    if (transId !== undefined) set.vnpayTransId = String(transId);
    if (responseCode !== undefined) set.vnpayResponseCode = String(responseCode);
    if (note) set.note = note;

    const activated = await VipPurchase.findOneAndUpdate(
        { _id: purchaseId, status: { $in: ['pending', 'expired'] } },
        { $set: set },
        { new: true }
    );
    if (!activated) return null;

    await createAndEmitNotification(
        io,
        activated.userId,
        'payment_confirmed',
        'Mua thẻ VIP thành công',
        `Bạn đã sở hữu "${activated.packageSnapshot.name}". Vào mục Thẻ VIP để gắn thẻ cho sản phẩm.`,
        { vipPurchaseId: activated._id }
    );
    return activated;
}

/* ───────────────────────── Public ───────────────────────── */

// @route GET /api/vip/packages
exports.getPackages = async (req, res) => {
    try {
        const data = await VipPackage.find({ isActive: true }).sort({ sortOrder: 1, price: 1 });
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

/* ───────────────────────── Người dùng ───────────────────────── */

// @route POST /api/vip/purchase    body: { packageId }
exports.createPurchase = async (req, res) => {
    try {
        if (!process.env.VNPAY_TMN_CODE || !process.env.VNPAY_HASH_SECRET || !process.env.VNPAY_RETURN_URL) {
            return res.status(503).json({ success: false, message: 'Cổng thanh toán VNPay chưa được cấu hình' });
        }

        const pkg = await VipPackage.findOne({ _id: req.body.packageId, isActive: true });
        if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói thẻ hoặc gói đã ngừng bán' });

        const transactionCode = genCode();
        const txnRef = `${transactionCode}-${Date.now()}`;

        const purchase = await VipPurchase.create({
            userId: req.user.id,
            packageId: pkg._id,
            packageSnapshot: {
                name: pkg.name,
                type: pkg.type,
                durationDays: pkg.durationDays,
                quantity: pkg.quantity,
                validDays: pkg.validDays,
                price: pkg.price
            },
            amount: pkg.price,                       // giá luôn lấy từ server, không nhận từ client
            transactionCode,
            source: 'vnpay',
            vnpayTxnRef: txnRef,
            pendingExpiresAt: new Date(Date.now() + PENDING_MINUTES * 60 * 1000)   // khớp vnp_ExpireDate (30 phút)
        });

        const payUrl = vnpayUtil.buildPayUrl({
            txnRef,
            amount: purchase.amount,
            orderInfo: `Thanh toan the VIP ${transactionCode}`,
            ipAddr: getIp(req),
            expireMinutes: PENDING_MINUTES
        });

        res.json({ success: true, data: { payUrl, purchaseId: purchase._id } });
    } catch (e) {
        console.error('[VIP] createPurchase error:', e.message);
        res.status(500).json({ success: false, message: 'Không thể tạo thanh toán thẻ VIP' });
    }
};

// @route GET /api/vip/my-cards
exports.getMyCards = async (req, res) => {
    try {
        await expirePendingPurchases();
        const now = new Date();
        const list = await VipPurchase.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();

        const cards = [];
        const history = [];
        for (const p of list) {
            const usable = p.status === 'paid' && p.usesLeft > 0 && p.cardExpiresAt && p.cardExpiresAt > now;
            (usable ? cards : history).push({ ...p, isUsable: !!usable });
        }
        res.json({ success: true, data: { cards, history } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route GET /api/vip/my-products   (sản phẩm của tôi có thể gắn thẻ)
exports.getMyProducts = async (req, res) => {
    try {
        const data = await Product.find({ userId: req.user.id, status: 'Available', isApproved: true })
            .select('title images price vipPinnedUntil vipHighlightUntil')
            .sort({ createdAt: -1 })
            .limit(100);
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route POST /api/vip/apply    body: { purchaseId, productId }
exports.applyCard = async (req, res) => {
    try {
        const { purchaseId, productId } = req.body;
        const now = new Date();

        const product = await Product.findOne({
            _id: productId, userId: req.user.id, status: 'Available', isApproved: true
        });
        if (!product) {
            return res.status(404).json({ success: false, message: 'Chỉ gắn thẻ được cho sản phẩm đang bán, đã duyệt và thuộc về bạn' });
        }

        // Trừ 1 lượt trước (nguyên tử) để không bị dùng quá số lượt khi bấm nhiều lần
        const card = await VipPurchase.findOneAndUpdate(
            { _id: purchaseId, userId: req.user.id, status: 'paid', usesLeft: { $gt: 0 }, cardExpiresAt: { $gt: now } },
            { $inc: { usesLeft: -1 } },
            { new: true }
        );
        if (!card) {
            return res.status(400).json({ success: false, message: 'Thẻ không tồn tại, đã hết lượt hoặc đã hết hạn' });
        }

        const { type, durationDays } = card.packageSnapshot;
        const extend = (current) => {
            const base = current && current > now ? current.getTime() : now.getTime();
            return new Date(base + durationDays * DAY);   // đang còn hạn thì cộng dồn
        };

        const set = {};
        const record = { productId: product._id, appliedAt: now };
        if (type === 'pin' || type === 'combo') {
            set.vipPinnedUntil = extend(product.vipPinnedUntil);
            set.vipPinnedAt = now;
            record.pinnedUntil = set.vipPinnedUntil;
        }
        if (type === 'highlight' || type === 'combo') {
            set.vipHighlightUntil = extend(product.vipHighlightUntil);
            record.highlightUntil = set.vipHighlightUntil;
        }

        try {
            await Product.updateOne({ _id: product._id }, { $set: set });
        } catch (err) {
            await VipPurchase.updateOne({ _id: card._id }, { $inc: { usesLeft: 1 } });   // hoàn lại lượt
            throw err;
        }
        await VipPurchase.updateOne({ _id: card._id }, { $push: { applied: record } });

        res.json({
            success: true,
            message: 'Đã gắn thẻ cho sản phẩm',
            data: { usesLeft: card.usesLeft, vipPinnedUntil: set.vipPinnedUntil, vipHighlightUntil: set.vipHighlightUntil }
        });
    } catch (e) {
        console.error('[VIP] applyCard error:', e.message);
        res.status(500).json({ success: false, message: 'Không thể gắn thẻ' });
    }
};

/* ──────── Móc vào luồng VNPay hiện có (paymentController gọi 2 hàm này) ──────── */

// IPN: nhận kết quả đã xác thực chữ ký từ vnpayUtil.verifyIpn.
// Trả về object phản hồi cho VNPay nếu mã giao dịch thuộc đơn mua thẻ VIP, trả null nếu không phải.
exports.handleVnpayIpn = async (verify, io) => {
    const { IPN } = vnpayUtil;
    const purchase = await VipPurchase.findOne({ vnpayTxnRef: verify.vnp_TxnRef });
    if (!purchase) return null;

    if (verify.vnp_Amount !== purchase.amount) return IPN.IpnInvalidAmount;
    if (purchase.status === 'paid') return IPN.InpOrderAlreadyConfirmed;

    if (verify.isSuccess) {
        await activatePurchase(
            purchase._id,
            { transId: verify.vnp_TransactionNo, responseCode: verify.vnp_ResponseCode },
            io
        );
    } else if (purchase.status === 'pending') {
        purchase.vnpayResponseCode = String(verify.vnp_ResponseCode || '');
        await purchase.save();
    }
    return IPN.IpnSuccess;
};

// Trang kết quả: nhận kết quả đã xác thực chữ ký từ vnpayUtil.verifyReturn.
// Trả null nếu không phải đơn VIP của user này.
exports.getVnpayStatusForUser = async (verify, userId, io) => {
    await expirePendingPurchases();
    let purchase = await VipPurchase.findOne({ vnpayTxnRef: verify.vnp_TxnRef });
    if (!purchase || purchase.userId.toString() !== String(userId)) return null;

    if (verify.isSuccess && verify.vnp_Amount === purchase.amount && purchase.status !== 'paid') {
        await activatePurchase(
            purchase._id,
            { transId: verify.vnp_TransactionNo, responseCode: verify.vnp_ResponseCode },
            io
        );
        purchase = await VipPurchase.findById(purchase._id);
    }
    return {
        kind: 'vip',
        status: toGatewayStatus(purchase.status),
        transactionCode: purchase.transactionCode,
        purchaseId: purchase._id
    };
};

/* ───────────────────────── Admin ───────────────────────── */

const pickPackageFields = (b) => {
    const out = {};
    ['name', 'description', 'type', 'durationDays', 'quantity', 'validDays', 'price',
        'originalPrice', 'badge', 'sortOrder', 'isActive'].forEach((k) => {
        if (b[k] !== undefined) out[k] = b[k];
    });
    ['durationDays', 'quantity', 'validDays', 'price', 'originalPrice', 'sortOrder'].forEach((k) => {
        if (out[k] !== undefined) out[k] = toInt(out[k]);
    });
    return out;
};

// @route GET /api/vip/admin/packages
exports.adminListPackages = async (req, res) => {
    try {
        const data = await VipPackage.find().sort({ sortOrder: 1, price: 1 });
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route POST /api/vip/admin/packages
exports.adminCreatePackage = async (req, res) => {
    try {
        const fields = pickPackageFields(req.body);
        if (!TYPES.includes(fields.type)) {
            return res.status(400).json({ success: false, message: 'Loại thẻ không hợp lệ' });
        }
        const pkg = await VipPackage.create({ ...fields, createdBy: req.user.id });
        res.status(201).json({ success: true, data: pkg });
    } catch (e) {
        res.status(e.name === 'ValidationError' ? 400 : 500).json({ success: false, message: e.message });
    }
};

// @route PUT /api/vip/admin/packages/:id
exports.adminUpdatePackage = async (req, res) => {
    try {
        const fields = pickPackageFields(req.body);
        if (fields.type !== undefined && !TYPES.includes(fields.type)) {
            return res.status(400).json({ success: false, message: 'Loại thẻ không hợp lệ' });
        }
        const pkg = await VipPackage.findByIdAndUpdate(req.params.id, { $set: fields }, { new: true, runValidators: true });
        if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói thẻ' });
        res.json({ success: true, data: pkg });
    } catch (e) {
        res.status(e.name === 'ValidationError' ? 400 : 500).json({ success: false, message: e.message });
    }
};

// @route DELETE /api/vip/admin/packages/:id
// Gói đã có người mua chỉ bị ẩn, không xóa để giữ lịch sử.
exports.adminDeletePackage = async (req, res) => {
    try {
        const used = await VipPurchase.exists({ packageId: req.params.id });
        if (used) {
            const pkg = await VipPackage.findByIdAndUpdate(req.params.id, { $set: { isActive: false } }, { new: true });
            if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói thẻ' });
            return res.json({ success: true, message: 'Gói đã có người mua nên được ẩn thay vì xóa', data: pkg });
        }
        const pkg = await VipPackage.findByIdAndDelete(req.params.id);
        if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói thẻ' });
        res.json({ success: true, message: 'Đã xóa gói thẻ' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route GET /api/vip/admin/purchases?status=&search=&page=&limit=
exports.adminListPurchases = async (req, res) => {
    try {
        await expirePendingPurchases();
        const { status, search } = req.query;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

        const query = {};
        if (['pending', 'paid', 'cancelled', 'expired'].includes(status)) query.status = status;
        if (search && search.trim()) {
            const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.transactionCode = { $regex: s, $options: 'i' };
        }

        const [data, total] = await Promise.all([
            VipPurchase.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate('userId', 'name email avatar'),
            VipPurchase.countDocuments(query)
        ]);
        res.json({ success: true, data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route GET /api/vip/admin/stats
exports.adminStats = async (req, res) => {
    try {
        await expirePendingPurchases();
        const now = new Date();
        const since = new Date(now.getTime() - 29 * DAY);
        since.setHours(0, 0, 0, 0);
        const paidVnpay = { status: 'paid', source: 'vnpay' };

        const [totals, byPackage, byDay, pendingCount, boostedProducts, grantedCount] = await Promise.all([
            VipPurchase.aggregate([
                { $match: paidVnpay },
                { $group: { _id: null, revenue: { $sum: '$amount' }, count: { $sum: 1 } } }
            ]),
            VipPurchase.aggregate([
                { $match: paidVnpay },
                { $group: { _id: '$packageSnapshot.name', revenue: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { revenue: -1 } }
            ]),
            VipPurchase.aggregate([
                { $match: { ...paidVnpay, paidAt: { $gte: since } } },
                {
                    $group: {
                        _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'Asia/Ho_Chi_Minh' } },
                        revenue: { $sum: '$amount' },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ]),
            VipPurchase.countDocuments({ status: 'pending' }),
            Product.countDocuments({ vipPinnedUntil: { $gt: now } }),
            VipPurchase.countDocuments({ status: 'paid', source: 'admin_grant' })
        ]);

        res.json({
            success: true,
            data: {
                totalRevenue: totals[0]?.revenue || 0,
                totalSold: totals[0]?.count || 0,
                pendingCount,
                grantedCount,
                activeBoostedProducts: boostedProducts,
                byPackage,
                dailyRevenue: byDay
            }
        });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route POST /api/vip/admin/grant    body: { userId hoặc email, packageId, note }
// Tặng thẻ miễn phí (khuyến mãi, bồi thường). Không tính vào doanh thu.
exports.adminGrant = async (req, res) => {
    try {
        const { userId, email, packageId, note } = req.body;
        const findUser = userId
            ? User.findById(userId).select('_id')
            : User.findOne({ email: String(email || '').toLowerCase().trim() }).select('_id');
        const [user, pkg] = await Promise.all([findUser, VipPackage.findById(packageId)]);
        if (!user) return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
        if (!pkg) return res.status(404).json({ success: false, message: 'Không tìm thấy gói thẻ' });

        const purchase = await VipPurchase.create({
            userId: user._id,
            packageId: pkg._id,
            packageSnapshot: {
                name: pkg.name, type: pkg.type, durationDays: pkg.durationDays,
                quantity: pkg.quantity, validDays: pkg.validDays, price: pkg.price
            },
            amount: 0,
            transactionCode: genCode(),
            source: 'admin_grant',
            status: 'pending'
        });
        const activated = await activatePurchase(purchase._id, { note: note || 'Admin tặng thẻ' }, req.app.get('io'));
        res.status(201).json({ success: true, data: activated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};

// @route PUT /api/vip/admin/purchases/:id/activate
// Kích hoạt thủ công đơn đang chờ/hết hạn (ví dụ khách đã chuyển tiền nhưng IPN không về).
exports.adminActivate = async (req, res) => {
    try {
        const activated = await activatePurchase(req.params.id, { note: req.body?.note || 'Admin kích hoạt thủ công' }, req.app.get('io'));
        if (!activated) {
            return res.status(400).json({ success: false, message: 'Chỉ kích hoạt được đơn đang chờ hoặc đã hết hạn thanh toán' });
        }
        res.json({ success: true, data: activated });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
};