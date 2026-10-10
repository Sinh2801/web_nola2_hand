const express = require('express');
const router = express.Router();
const {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  getUserReviewStats,
  syncAllUserRatings
} = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');


router.post('/', protect, createReview);


router.post('/sync-ratings', protect, syncAllUserRatings);

router.get('/product/:productId', getProductReviews);


router.get('/user/:userId', getUserReviews);


router.get('/user/:userId/stats', getUserReviewStats);


router.put('/:reviewId', protect, updateReview);


router.delete('/:reviewId', protect, deleteReview);

module.exports = router;
