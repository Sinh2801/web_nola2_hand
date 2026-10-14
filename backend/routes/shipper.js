const express = require('express');
const router = express.Router();
const {
  applyShipper,
  getShipperList,
  approveShipper,
  rejectShipper,
  assignShipper,
  getMyShipperOrders,
  getAvailableOrders,
  acceptOrder,
  markPickedUp,
  markDelivered,
  toggleShipperRole,
  updateShipperBank
} = require('../controllers/shipperController');
const { protect, authorize, authorizeShipper } = require('../middleware/auth');
const { upload } = require('../utils/uploadImage');


router.post('/apply', protect, applyShipper);


router.put('/bank', protect, authorizeShipper, upload.single('qrCodeImage'), updateShipperBank);


router.get('/available-orders', protect, authorizeShipper, getAvailableOrders);


router.put('/orders/:orderId/accept', protect, authorizeShipper, acceptOrder);


router.get('/my-orders', protect, authorizeShipper, getMyShipperOrders);


router.put('/orders/:orderId/pickup', protect, authorizeShipper, upload.single('image'), markPickedUp);


router.put('/orders/:orderId/delivered', protect, authorizeShipper, upload.single('image'), markDelivered);


router.get('/list', protect, authorize(), getShipperList);
router.put('/:id/approve', protect, authorize(), approveShipper);
router.put('/:id/reject', protect, authorize(), rejectShipper);
router.put('/assign/:orderId', protect, authorize(), assignShipper);
router.put('/:id/role', protect, authorize(), toggleShipperRole);

module.exports = router;
