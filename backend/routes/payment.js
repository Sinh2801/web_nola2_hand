const express = require('express');
const router = express.Router();
const {
  createPayment,
  getPaymentByOrderId,
  uploadPaymentProof,
  getPendingPayments,
  confirmPayment,
  rejectPayment,
  getAllPayments,
  getMyPayments,
  confirmCODReceived,
  createMomoPayment,
  momoIpn,
  getMomoStatus,
  createVnpayPayment,
  vnpayIpn,
  vnpayReturn
} = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');
const { paymentLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { upload } = require('../utils/uploadImage');
const {
  validateCreatePayment,
  validateUploadProof,
  validatePaymentAction
} = require('../middleware/validators/paymentValidator');


router.post('/', paymentLimiter, protect, validateCreatePayment, createPayment);


router.get('/order/:orderId', protect, getPaymentByOrderId);


router.put('/:id/upload-proof', uploadLimiter, protect, upload.single('paymentProof'), validateUploadProof, uploadPaymentProof);


router.get('/pending', protect, authorize(), getPendingPayments);


router.get('/my-payments', protect, getMyPayments);


router.get('/', protect, authorize(), getAllPayments);


router.put('/:id/confirm', protect, authorize(), validatePaymentAction, confirmPayment);


router.put('/:id/reject', protect, authorize(), validatePaymentAction, rejectPayment);


router.put('/:id/confirm-cod', protect, authorize(), confirmCODReceived);

router.post('/momo/ipn', momoIpn);

router.post('/momo/create', paymentLimiter, protect, validateCreatePayment, createMomoPayment);

router.get('/momo/status/:momoOrderId', protect, getMomoStatus);

router.get('/vnpay/ipn', vnpayIpn);

router.post('/vnpay/create', paymentLimiter, protect, validateCreatePayment, createVnpayPayment);

router.get('/vnpay/return', protect, vnpayReturn);

module.exports = router;
