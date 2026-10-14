const express = require('express');
const {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getAvailableCoupons
} = require('../controllers/couponController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();


router.post('/validate', protect, validateCoupon);
router.get('/available', protect, getAvailableCoupons);


const adminRouter = express.Router();
adminRouter.use(protect);
adminRouter.use(authorize());

adminRouter.post('/', createCoupon);
adminRouter.get('/', getAllCoupons);
adminRouter.get('/:id', getCouponById);
adminRouter.put('/:id', updateCoupon);
adminRouter.delete('/:id', deleteCoupon);

module.exports = { router, adminRouter };
