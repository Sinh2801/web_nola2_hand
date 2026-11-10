const mongoose = require('mongoose');

const trainingRunSchema = new mongoose.Schema({
  trainedAt: { type: Date, default: Date.now },
  mode: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
  trainingPurchases: { type: Number, default: 0 },
  trainingCustomers: { type: Number, default: 0 },
  trainingReviews: { type: Number, default: 0 },
  hitRateAt4: { type: Number, default: 0 },
  precisionAt4: { type: Number, default: 0 },
  popularBaselineAt4: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 }
}, { _id: false });

const productPairSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  pairedProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  coPurchaseCount: { type: Number, default: 0 },
  purchaseScore: { type: Number, default: 0 },
  totalScore: { type: Number, default: 0 }
}, { _id: false });

const recommendationModelSchema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'default' },
  version: { type: Number, default: 1 },
  trainedAt: { type: Date, default: null },
  weights: {
    purchase: { type: Number, default: 0.45 },
    rating: { type: Number, default: 0.25 },
    similarity: { type: Number, default: 0.2 },
    popularity: { type: Number, default: 0.1 }
  },
  metrics: {
    hitRateAt4: { type: Number, default: 0 },
    precisionAt4: { type: Number, default: 0 },
    popularBaselineAt4: { type: Number, default: 0 }
  },
  dataSummary: {
    purchases: { type: Number, default: 0 },
    customers: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 }
  },
  productPairs: { type: [productPairSchema], default: [] },
  trainingHistory: { type: [trainingRunSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('RecommendationModel', recommendationModelSchema);
