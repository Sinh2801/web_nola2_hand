const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { createAndEmitNotification } = require('../utils/notifications');
const { uploadToCloudinary } = require('../utils/uploadImage');
const { analyzeSentiment } = require('../utils/sentimentAnalysis');

// Helper function để cập nhật average rating của user
const updateUserRating = async (userId) => {
  try {
    const stats = await Review.aggregate([
      { $match: { reviewedUserId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 }
        }
      }
    ]);

    if (stats.length > 0) {
      await User.findByIdAndUpdate(userId, {
        'rating.average': Math.round(stats[0].averageRating * 10) / 10,
        'rating.count': stats[0].totalReviews
      });
    } else {
      // Nếu không có review nào, reset về 0
      await User.findByIdAndUpdate(userId, {
        'rating.average': 0,
        'rating.count': 0
      });
    }
  } catch (error) {
    console.error('Error updating user rating:', error);
  }
};

// Helper: cập nhật điểm trung bình của sản phẩm (chỉ tính đánh giá của người mua)
const updateProductRating = async (productId) => {
  try {
    if (!productId) return;
    const stats = await Review.aggregate([
      { $match: { productId: new mongoose.Types.ObjectId(productId), isSeller: false } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    await Product.findByIdAndUpdate(productId, {
      averageRating: stats.length ? Math.round(stats[0].avg * 10) / 10 : 0,
      totalReviews: stats.length ? stats[0].count : 0
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

// Tạo đánh giá mới
// CHỈ người thật sự tham gia đơn hàng đã hoàn thành mới được đánh giá:
//  - người mua đánh giá người bán / sản phẩm
//  - người bán đánh giá người mua
// Người được đánh giá, sản phẩm và vai trò (isSeller) đều lấy từ đơn hàng, KHÔNG tin dữ liệu client gửi lên.
const createReview = async (req, res) => {
  try {
    const { transactionId, productId: bodyProductId, rating, comment, orderId } = req.body;
    const reviewerId = req.user.id;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Số sao phải từ 1 đến 5'
      });
    }

    // Tìm đơn hàng làm căn cứ đánh giá
    let order = null;
    if (orderId) {
      order = await Order.findById(orderId);
    } else if (bodyProductId) {
      // Client không gửi orderId: tìm đơn đã hoàn thành của chính người này với sản phẩm đó
      order = await Order.findOne({
        productId: bodyProductId,
        status: 'completed',
        $or: [{ buyerId: reviewerId }, { sellerId: reviewerId }]
      }).sort({ completedAt: -1 });
    }

    if (!order) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ người đã mua sản phẩm mới được đánh giá'
      });
    }

    if (order.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể đánh giá sau khi giao dịch hoàn thành'
      });
    }

    const isBuyer = order.buyerId.toString() === reviewerId;
    const isOrderSeller = order.sellerId.toString() === reviewerId;
    if (!isBuyer && !isOrderSeller) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền đánh giá đơn hàng này'
      });
    }

    // Lấy thông tin từ đơn hàng
    const reviewedUserId = isBuyer ? order.sellerId : order.buyerId;
    const productId = order.productId;
    const isSeller = isOrderSeller; // true nếu người đánh giá là người bán

    // Mỗi người chỉ đánh giá 1 lần cho mỗi đơn
    const existingReview = await Review.findOne({
      orderId: order._id,
      reviewerId
    });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã đánh giá giao dịch này rồi'
      });
    }

    // Handle image uploads
    let reviewImages = [];
    if (req.files && req.files.length > 0) {
      try {
        const uploadPromises = req.files.map(file =>
            uploadToCloudinary(file.buffer, 'dnu-marketplace/reviews')
        );
        const results = await Promise.all(uploadPromises);
        reviewImages = results.map(result => result.secure_url);
      } catch (uploadError) {
        console.error('Error uploading review images:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi upload hình ảnh'
        });
      }
    }

    // Tạo review mới
    const review = new Review({
      transactionId: transactionId || order._id.toString(),
      orderId: order._id,
      reviewerId,
      reviewedUserId,
      productId,
      rating: ratingNum,
      comment,
      images: reviewImages,
      isSeller
    });

    await review.save();

    // AI phân tích sentiment từ comment (bất đồng bộ, không chặn response)
    if (review.comment && review.comment.trim()) {
      analyzeSentiment(review.comment)
          .then(({ sentiment, score }) => {
            return Review.findByIdAndUpdate(review._id, { sentiment, sentimentScore: score }, { new: true });
          })
          .catch(err => console.error('Sentiment analysis error:', err));
    }

    // Populate thông tin người đánh giá
    await review.populate('reviewerId', 'name email avatar');

    // Cập nhật điểm trung bình
    await updateUserRating(reviewedUserId);
    if (!isSeller) await updateProductRating(productId);

    // Create notification for product owner if review is for a product
    try {
      if (productId) {
        const product = await Product.findById(productId).populate('userId');
        if (product && product.userId._id.toString() !== reviewerId.toString()) {
          const io = req.app.get('io');
          await createAndEmitNotification(
              io,
              product.userId._id,
              'new_review',
              'Có đánh giá mới',
              `${req.user.name} đã đánh giá sản phẩm "${product.title}" của bạn`,
              { productId: product._id, reviewId: review._id, productName: product.title, rating: ratingNum }
          );
        }
      }
    } catch (notifError) {
      console.error('Error creating review notification:', notifError);
    }

    res.status(201).json({
      success: true,
      message: 'Đánh giá thành công',
      data: review
    });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi tạo đánh giá'
    });
  }
};

// Lấy đánh giá của một sản phẩm (chỉ đánh giá của người mua, để khớp với phần tóm tắt sao)
const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const filter = { productId, isSeller: false };

    const reviews = await Review.find(filter)
        .populate('reviewerId', 'name email avatar')
        .populate('reviewedUserId', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Review.countDocuments(filter);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting product reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy đánh giá'
    });
  }
};

// Lấy đánh giá của một user
const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ reviewedUserId: userId })
        .populate('reviewerId', 'name email avatar')
        .populate('productId', 'title images')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

    const total = await Review.countDocuments({ reviewedUserId: userId });

    // Tính average rating
    const avgRating = await Review.aggregate([
      { $match: { reviewedUserId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      data: reviews,
      averageRating: avgRating[0]?.avgRating || 0,
      totalReviews: avgRating[0]?.count || 0,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy đánh giá người dùng'
    });
  }
};

// Cập nhật đánh giá (chỉ chủ đánh giá, chỉ sửa số sao và nội dung)
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({
        success: false,
        message: 'Số sao phải từ 1 đến 5'
      });
    }

    const review = await Review.findOne({ _id: reviewId, reviewerId: userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá hoặc bạn không có quyền chỉnh sửa'
      });
    }

    review.rating = ratingNum;
    review.comment = comment;
    await review.save();

    // Cập nhật lại average rating
    await updateUserRating(review.reviewedUserId);
    if (!review.isSeller) await updateProductRating(review.productId);

    res.json({
      success: true,
      message: 'Cập nhật đánh giá thành công',
      data: review
    });
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi cập nhật đánh giá'
    });
  }
};

// Xóa đánh giá
const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.user.id;

    const review = await Review.findOne({ _id: reviewId, reviewerId: userId });

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đánh giá hoặc bạn không có quyền xóa'
      });
    }

    const reviewedUserId = review.reviewedUserId;
    const productId = review.productId;
    const wasSeller = review.isSeller;
    await Review.findByIdAndDelete(reviewId);

    // Cập nhật lại average rating
    await updateUserRating(reviewedUserId);
    if (!wasSeller) await updateProductRating(productId);

    res.json({
      success: true,
      message: 'Xóa đánh giá thành công'
    });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi xóa đánh giá'
    });
  }
};

// Lấy thống kê đánh giá của user
const getUserReviewStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await Review.aggregate([
      { $match: { reviewedUserId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: '$rating'
          }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratingDistribution.forEach(rating => {
      ratingDistribution[rating]++;
    });

    res.json({
      success: true,
      data: {
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        totalReviews: stats[0].totalReviews,
        ratingDistribution
      }
    });
  } catch (error) {
    console.error('Error getting user review stats:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi lấy thống kê đánh giá'
    });
  }
};

// Sync lại rating cho tất cả users (chạy một lần để cập nhật data cũ)
const syncAllUserRatings = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền thực hiện thao tác này'
      });
    }

    // Lấy tất cả users có reviews
    const usersWithReviews = await Review.distinct('reviewedUserId');

    let updatedCount = 0;
    for (const userId of usersWithReviews) {
      await updateUserRating(userId);
      updatedCount++;
    }

    // Reset rating cho users không có reviews
    await User.updateMany(
        { _id: { $nin: usersWithReviews } },
        { 'rating.average': 0, 'rating.count': 0 }
    );

    res.json({
      success: true,
      message: `Đã đồng bộ rating cho ${updatedCount} users`,
      updatedCount
    });
  } catch (error) {
    console.error('Error syncing user ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi server khi đồng bộ rating'
    });
  }
};

module.exports = {
  createReview,
  getProductReviews,
  getUserReviews,
  updateReview,
  deleteReview,
  getUserReviewStats,
  syncAllUserRatings,
  updateUserRating, // Export để có thể dùng ở nơi khác nếu cần
  updateProductRating
};