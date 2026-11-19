const Product = require('../models/Product');
const ProductView = require('../models/ProductView');
const Review = require('../models/Review');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const RecommendationModel = require('../models/RecommendationModel');
const { scoreRecommendations, trainRecommendationModel } = require('../utils/recommendationModelService');

// @desc    Get model-scored similar products
// @route   GET /api/products/:id/ai-similar
// @access  Public
exports.getAISimilarProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    const similarProducts = await scoreRecommendations({
      userId: req.user?.id,
      sourceProductId: product._id,
      limit: 8
    });
    return res.json({ success: true, data: similarProducts });
  } catch (error) {
    console.error('Error getAISimilarProducts:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get similar products
// @route   GET /api/products/:id/similar
// @access  Public
exports.getSimilarProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const similarProducts = await scoreRecommendations({
      userId: req.user?.id,
      sourceProductId: product._id,
      limit: 8
    });

    res.json({
      success: true,
      data: similarProducts
    });
  } catch (error) {
    console.error('Error getting similar products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get products users also viewed
// @route   GET /api/products/:id/also-viewed
// @access  Public
exports.getAlsoViewed = async (req, res) => {
  try {
    // Get users who viewed this product
    const viewers = await ProductView.find({
      productId: req.params.id
    }).distinct('userId');

    if (viewers.length === 0) {
      // If no views, return empty array
      return res.json({
        success: true,
        data: []
      });
    }

    // Get products those users also viewed
    const alsoViewed = await ProductView.aggregate([
      {
        $match: {
          userId: { $in: viewers },
          productId: { $ne: new mongoose.Types.ObjectId(req.params.id) }
        }
      },
      {
        $group: {
          _id: '$productId',
          viewCount: { $sum: 1 }
        }
      },
      {
        $sort: { viewCount: -1 }
      },
      { $limit: 8 }
    ]);

    const productIds = alsoViewed.map(item => item._id);

    const products = await Product.find({
      _id: { $in: productIds },
      isApproved: true,
      status: 'Available'
    })
      .populate('userId', 'name avatar')
      .select('title images price category location viewCount averageRating');

    // Sort by viewCount from aggregation
    const sortedProducts = products.sort((a, b) => {
      const aCount = alsoViewed.find(item => item._id.toString() === a._id.toString())?.viewCount || 0;
      const bCount = alsoViewed.find(item => item._id.toString() === b._id.toString())?.viewCount || 0;
      return bCount - aCount;
    });

    res.json({
      success: true,
      data: sortedProducts
    });
  } catch (error) {
    console.error('Error getting also viewed products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get recommended products based on purchases, reviews and bookmarks
// @route   GET /api/products/recommended
// @access  Private
exports.getRecommendedProducts = async (req, res) => {
  try {
    const recommended = await scoreRecommendations({ userId: req.user.id, limit: 12 });

    res.json({
      success: true,
      data: recommended
    });
  } catch (error) {
    console.error('Error getting recommended products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getRecommendationModel = async (req, res) => {
  try {
    const model = await RecommendationModel.findOne({ key: 'default' })
      .populate('productPairs.productId', 'title')
      .populate('productPairs.pairedProductId', 'title')
      .lean();
    return res.json({ success: true, data: model || {
      trainedAt: null,
      metrics: { hitRateAt4: 0, precisionAt4: 0, popularBaselineAt4: 0 },
      dataSummary: { purchases: 0, customers: 0, reviews: 0 },
      productPairs: [],
      trainingHistory: []
    } });
  } catch (error) {
    console.error('Error getting recommendation model:', error);
    return res.status(500).json({ success: false, message: 'Không thể tải thông tin mô hình' });
  }
};

exports.trainRecommendationModel = async (req, res) => {
  try {
    const result = await trainRecommendationModel('manual');
    return res.json({ success: true, message: 'Đã huấn luyện lại mô hình', data: result.model });
  } catch (error) {
    console.error('Error training recommendation model:', error);
    return res.status(500).json({ success: false, message: 'Không thể huấn luyện mô hình' });
  }
};

// @desc    Get trending products
// @route   GET /api/products/trending
// @access  Public
exports.getTrendingProducts = async (req, res) => {
  try {
    console.log('[getTrendingProducts] Starting...');
    // Simple fallback: return most viewed products
    // This avoids issues with ProductView aggregation
    const products = await Product.find({
      isApproved: true,
      status: 'Available'
    })
      .sort({ viewCount: -1, createdAt: -1 })
      .limit(12)
      .populate('userId', 'name avatar')
      .select('title images price category location viewCount averageRating')
      .lean();

    console.log('[getTrendingProducts] Found products:', products?.length || 0);

    return res.json({
      success: true,
      data: Array.isArray(products) ? products : []
    });
  } catch (error) {
    console.error('[getTrendingProducts] Error:', error);
    console.error('[getTrendingProducts] Error stack:', error.stack);
    // Always return valid response
    return res.status(500).json({
      success: false,
      message: 'Error fetching trending products',
      data: []
    });
  }
};

// @desc    Get latest products
// @route   GET /api/products/latest
// @access  Public
exports.getLatestProducts = async (req, res) => {
  try {
    console.log('[getLatestProducts] Starting...');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const products = await Product.find({
      createdAt: { $gte: sevenDaysAgo },
      isApproved: true,
      status: 'Available'
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('userId', 'name avatar')
      .select('title images price category location viewCount averageRating createdAt')
      .lean();

    console.log('[getLatestProducts] Found products:', products?.length || 0);

    return res.json({
      success: true,
      data: Array.isArray(products) ? products : []
    });
  } catch (error) {
    console.error('[getLatestProducts] Error:', error);
    console.error('[getLatestProducts] Error stack:', error.stack);
    // Always return valid response
    return res.status(500).json({
      success: false,
      message: 'Error fetching latest products',
      data: []
    });
  }
};

// @desc    Get nearby products
// @route   GET /api/products/nearby
// @access  Private
exports.getNearbyProducts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || !user.address) {
      return res.json({
        success: true,
        data: []
      });
    }

    // For now, we'll use location field (Campus, Dormitory, Nearby)
    // In a real app, you'd use geolocation
    const products = await Product.find({
      location: user.address.includes('Campus') ? 'Campus' :
        user.address.includes('Dormitory') ? 'Dormitory' : 'Nearby',
      isApproved: true,
      status: 'Available',
      userId: { $ne: req.user.id }
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate('userId', 'name avatar')
      .select('title images price category location viewCount averageRating');

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error getting nearby products:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
