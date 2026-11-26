const mongoose = require('mongoose');

// Giỏ hàng: mỗi người dùng 1 giỏ. Đồ 2hand mỗi món chỉ có 1 chiếc nên không có số lượng,
// mỗi sản phẩm xuất hiện tối đa 1 lần trong giỏ.
const cartSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        // Giá lúc thêm vào giỏ, dùng để báo "giá đã thay đổi"
        priceAtAdd: {
            type: Number,
            required: true,
            min: 0
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

const Cart = mongoose.model('Cart', cartSchema);

// Đồng bộ index với schema: tự xóa các index cũ còn sót trong MongoDB (ví dụ unique "user_1"
// của một phiên bản giỏ hàng trước) vì chúng gây lỗi E11000 khi nhiều người dùng cùng có giỏ.
Cart.syncIndexes().catch((err) => console.error('Cart.syncIndexes error:', err.message));

module.exports = Cart;
