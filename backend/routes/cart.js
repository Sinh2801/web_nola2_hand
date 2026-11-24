const express = require('express');
const {
    getCart, addItem, removeItem, removeMany, clearCart, evaluateCoupons, applyCoupon
} = require('../controllers/cartController');
const { protect, blockShipper } = require('../middleware/auth');

const router = express.Router();

router.use(protect);

router.get('/', getCart);
router.post('/items', blockShipper, addItem);
router.delete('/items/:productId', removeItem);
router.post('/remove', removeMany);
router.delete('/', clearCart);

// Mã giảm giá trong giỏ hàng
router.post('/coupons/evaluate', evaluateCoupons);
router.post('/coupons/apply', blockShipper, applyCoupon);

module.exports = router;