const express = require('express');
const {
    getPackages, createPurchase, getMyCards, getMyProducts, applyCard,
    adminListPackages, adminCreatePackage, adminUpdatePackage, adminDeletePackage,
    adminListPurchases, adminStats, adminGrant, adminActivate
} = require('../controllers/vipController');
const { protect, authorize, blockShipper } = require('../middleware/auth');
const { paymentLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Công khai
router.get('/packages', getPackages);

// Người dùng
router.post('/purchase', paymentLimiter, protect, blockShipper, createPurchase);
router.get('/my-cards', protect, getMyCards);
router.get('/my-products', protect, getMyProducts);
router.post('/apply', protect, blockShipper, applyCard);

// Admin
router.get('/admin/packages', protect, authorize(), adminListPackages);
router.post('/admin/packages', protect, authorize(), adminCreatePackage);
router.put('/admin/packages/:id', protect, authorize(), adminUpdatePackage);
router.delete('/admin/packages/:id', protect, authorize(), adminDeletePackage);
router.get('/admin/purchases', protect, authorize(), adminListPurchases);
router.get('/admin/stats', protect, authorize(), adminStats);
router.post('/admin/grant', protect, authorize(), adminGrant);
router.put('/admin/purchases/:id/activate', protect, authorize(), adminActivate);

module.exports = router;