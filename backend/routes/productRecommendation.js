const express = require('express');
const {
  getSimilarProducts,
  getAISimilarProducts,
  getAlsoViewed,
  getRecommendedProducts,
  getNearbyProducts
} = require('../controllers/productRecommendationController');
const { protect, optionalProtect } = require('../middleware/auth');

const router = express.Router();

router.get('/products/:id/ai-similar', optionalProtect, getAISimilarProducts);
router.get('/products/:id/similar', optionalProtect, getSimilarProducts);
router.get('/products/:id/also-viewed', getAlsoViewed);
router.get('/products/recommended', protect, getRecommendedProducts);
router.get('/products/nearby', protect, getNearbyProducts);

module.exports = router;
