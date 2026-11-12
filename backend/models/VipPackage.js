const mongoose = require('mongoose');

// Gói thẻ VIP do admin tạo và bán
const vipPackageSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Vui lòng nhập tên thẻ'], trim: true, maxlength: 80 },
    description: { type: String, trim: true, default: '', maxlength: 300 },

    // pin: đẩy sản phẩm lên đầu danh sách
    // highlight: viền + huy hiệu "Nổi bật"
    // hot: nhãn "HOT" đỏ trên sản phẩm
    // combo: pin + highlight
    // ultimate: pin + highlight + hot
    // seller_vip: huy hiệu "Shop VIP" cho tài khoản, hiện trên mọi tin của shop (không cần chọn sản phẩm)
    type: { type: String, enum: ['pin', 'highlight', 'combo', 'hot', 'ultimate', 'seller_vip'], required: true },

    durationDays: { type: Number, required: true, min: 1, max: 365 },   // mỗi lượt dùng có hiệu lực bao nhiêu ngày
    quantity: { type: Number, default: 1, min: 1, max: 100 },           // số lượt dùng trong 1 thẻ
    validDays: { type: Number, default: 90, min: 1, max: 730 },         // thẻ phải dùng trong bao nhiêu ngày kể từ lúc mua

    price: { type: Number, required: true, min: 1000 },                 // VND, số nguyên
    originalPrice: { type: Number, default: 0, min: 0 },                // giá gạch ngang (tùy chọn)
    badge: { type: String, trim: true, default: '', maxlength: 30 },    // nhãn như "Phổ biến", "Tiết kiệm"

    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

vipPackageSchema.index({ isActive: 1, sortOrder: 1 });

module.exports = mongoose.model('VipPackage', vipPackageSchema);