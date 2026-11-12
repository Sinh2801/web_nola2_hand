const mongoose = require('mongoose');

// Mỗi bản ghi = 1 lần mua thẻ. Khi status = 'paid' thì chính bản ghi này là "thẻ" trong kho của người dùng.
const vipPurchaseSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    packageId: { type: mongoose.Schema.Types.ObjectId, ref: 'VipPackage', required: true },

    // Lưu bản sao để đổi giá/sửa gói về sau không làm sai lịch sử
    packageSnapshot: {
        name: String,
        type: { type: String, enum: ['pin', 'highlight', 'combo', 'hot', 'ultimate', 'seller_vip'] },
        durationDays: Number,
        quantity: Number,
        validDays: Number,
        price: Number
    },

    amount: { type: Number, required: true, min: 0 },
    transactionCode: { type: String, required: true, unique: true, uppercase: true, trim: true },

    source: { type: String, enum: ['vnpay', 'admin_grant'], default: 'vnpay' },
    status: { type: String, enum: ['pending', 'paid', 'cancelled', 'expired'], default: 'pending', index: true },

    vnpayTxnRef: { type: String, index: true },
    vnpayTransId: { type: String },
    vnpayResponseCode: { type: String },

    paidAt: { type: Date },
    pendingExpiresAt: { type: Date },   // hạn thanh toán (30 phút)

    usesLeft: { type: Number, default: 0, min: 0 },
    cardExpiresAt: { type: Date },      // hạn sử dụng thẻ

    applied: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        appliedAt: { type: Date, default: Date.now },
        pinnedUntil: Date,
        highlightUntil: Date,
        hotUntil: Date,
        sellerUntil: Date
    }],

    note: { type: String, trim: true, default: '' }   // ghi chú khi admin tặng/kích hoạt thủ công
}, { timestamps: true });

vipPurchaseSchema.index({ userId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model('VipPurchase', vipPurchaseSchema);