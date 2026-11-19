const express = require('express')
const router = express.Router()

// Đổi đường dẫn và tên "protect" cho khớp middleware xác thực có sẵn của bạn
// (xem cách import trong routes/productRoutes.js)
const { protect } = require('../middleware/auth')
const cartController = require('../controllers/cartController')

// Tất cả route giỏ hàng đều yêu cầu đăng nhập
router.use(protect)

router.get('/', cartController.getCart)
router.post('/', cartController.addToCart)
router.delete('/:productId', cartController.removeFromCart)
router.delete('/', cartController.clearCart)

module.exports = router