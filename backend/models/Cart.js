const mongoose = require('mongoose')

// Mỗi người dùng có đúng 1 giỏ hàng (user là unique).
// Là chợ đồ cũ nên mỗi sản phẩm chỉ có 1 cái -> không cần lưu số lượng.
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Product',
          required: true
        },
        addedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
)

module.exports = mongoose.model('Cart', cartSchema)
