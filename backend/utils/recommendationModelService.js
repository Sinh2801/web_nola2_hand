const Product = require('../models/Product');
const Order = require('../models/Order');
const Review = require('../models/Review');
const Bookmark = require('../models/Bookmark');
const RecommendationModel = require('../models/RecommendationModel');

const COMPLETED_STATUSES = ['confirmed', 'picked_up', 'completed'];

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value || 0));
const normalise = (value, max) => max > 0 ? clamp(value / max) : 0;

async function getConfig() {
  const config = await RecommendationModel.findOne({ key: 'default' }).lean();
  return config || {
    weights: { purchase: 0.45, rating: 0.25, similarity: 0.2, popularity: 0.1 },
    metrics: { hitRateAt4: 0, precisionAt4: 0, popularBaselineAt4: 0 },
    dataSummary: { purchases: 0, customers: 0, reviews: 0 },
    trainingHistory: []
  };
}

async function getInteractions(userId) {
  const [orders, reviews, bookmarks] = await Promise.all([
    Order.find({ buyerId: userId, status: { $in: COMPLETED_STATUSES } }).select('productId').lean(),
    Review.find({ reviewerId: userId, isSeller: false }).select('productId rating').lean(),
    Bookmark.find({ userId }).select('productId').lean()
  ]);
  const ratings = new Map(reviews.map(review => [String(review.productId), review.rating]));
  return {
    purchasedIds: new Set(orders.map(order => String(order.productId))),
    ratings,
    bookmarkedIds: new Set(bookmarks.map(bookmark => String(bookmark.productId)))
  };
}

function productSimilarity(source, candidate) {
  const sourceTags = new Set((source.tags || []).map(tag => tag.toLowerCase()));
  const candidateTags = new Set((candidate.tags || []).map(tag => tag.toLowerCase()));
  const union = new Set([...sourceTags, ...candidateTags]);
  const commonTags = [...sourceTags].filter(tag => candidateTags.has(tag)).length;
  const tagScore = union.size ? commonTags / union.size : 0;
  const categoryScore = source.category && source.category === candidate.category ? 1 : 0;
  const priceScore = source.price && candidate.price
    ? clamp(1 - Math.abs(source.price - candidate.price) / Math.max(source.price, candidate.price))
    : 0;
  return categoryScore * 0.55 + tagScore * 0.3 + priceScore * 0.15;
}

async function scoreRecommendations({ userId, sourceProductId, limit = 12 }) {
  const config = await getConfig();
  const source = sourceProductId ? await Product.findById(sourceProductId).lean() : null;
  const interactions = userId ? await getInteractions(userId) : {
    purchasedIds: new Set(), ratings: new Map(), bookmarkedIds: new Set()
  };
  const products = await Product.find({
    _id: source ? { $ne: source._id } : { $nin: [...interactions.purchasedIds] },
    isApproved: true,
    status: 'Available'
  }).select('title images price category location viewCount averageRating totalReviews tags userId').lean();

  const maxViews = Math.max(...products.map(product => product.viewCount || 0), 1);
  const maxReviews = Math.max(...products.map(product => product.totalReviews || 0), 1);
  const categoryAffinity = new Map();
  const tagAffinity = new Map();

  if (userId) {
    const purchasedProducts = await Product.find({ _id: { $in: [...interactions.purchasedIds] } })
      .select('category tags').lean();
    purchasedProducts.forEach(product => {
      const rating = interactions.ratings.get(String(product._id)) || 3;
      const weight = clamp(rating / 5, 0.2, 1);
      categoryAffinity.set(product.category, (categoryAffinity.get(product.category) || 0) + weight);
      (product.tags || []).forEach(tag => {
        tagAffinity.set(tag.toLowerCase(), (tagAffinity.get(tag.toLowerCase()) || 0) + weight);
      });
    });
  }

  const scored = products.map(product => {
    const categoryScore = normalise(categoryAffinity.get(product.category), Math.max(...categoryAffinity.values(), 1));
    const tagScore = (product.tags || []).reduce((total, tag) =>
      total + (tagAffinity.get(tag.toLowerCase()) || 0), 0);
    const affinityScore = clamp(categoryScore * 0.65 + normalise(tagScore, Math.max(...tagAffinity.values(), 1)) * 0.35);
    const similarityScore = source ? productSimilarity(source, product) : affinityScore;
    const ratingScore = normalise(product.averageRating, 5);
    const popularityScore = normalise(product.viewCount, maxViews) * 0.55 +
      normalise(product.totalReviews, maxReviews) * 0.45;
    const bookmarkBoost = interactions.bookmarkedIds.has(String(product._id)) ? 0.15 : 0;
    const score = config.weights.purchase * affinityScore +
      config.weights.rating * ratingScore +
      config.weights.similarity * similarityScore +
      config.weights.popularity * popularityScore + bookmarkBoost;
    return { ...product, recommendationScore: Math.round(score * 1000) / 1000 };
  });

  return scored.sort((a, b) => b.recommendationScore - a.recommendationScore).slice(0, limit);
}

async function trainRecommendationModel(mode = 'manual') {
  const startedAt = Date.now();
  const [orders, reviews, customers, popularProducts] = await Promise.all([
    Order.find({ status: { $in: COMPLETED_STATUSES } }).select('buyerId productId').lean(),
    Review.find({ isSeller: false }).select('reviewerId productId rating').lean(),
    Order.distinct('buyerId', { status: { $in: COMPLETED_STATUSES } }),
    Product.find({ isApproved: true, status: 'Available' }).sort({ viewCount: -1 }).limit(4).select('_id').lean()
  ]);
  const orderProductIds = [...new Set(orders.map(order => String(order.productId)))];
  const existingProducts = await Product.find({ _id: { $in: orderProductIds } })
    .select('_id').lean();
  const existingProductIds = new Set(existingProducts.map(product => String(product._id)));
  const validOrders = orders.filter(order => existingProductIds.has(String(order.productId)));
  const trainingCustomerCount = new Set(validOrders.map(order => String(order.buyerId))).size;
  const productIdsByCustomer = new Map();
  validOrders.forEach(order => {
    const customer = String(order.buyerId);
    if (!productIdsByCustomer.has(customer)) productIdsByCustomer.set(customer, new Set());
    productIdsByCustomer.get(customer).add(String(order.productId));
  });
  const coPurchaseCounts = new Map();
  productIdsByCustomer.forEach(purchasedIds => {
    const ids = [...purchasedIds];
    ids.forEach(productId => {
      if (!coPurchaseCounts.has(productId)) coPurchaseCounts.set(productId, new Map());
      ids.forEach(otherId => {
        if (otherId !== productId) {
          const counts = coPurchaseCounts.get(productId);
          counts.set(otherId, (counts.get(otherId) || 0) + 1);
        }
      });
    });
  });
  let hits = 0;
  let popularHits = 0;
  let evaluated = 0;
  productIdsByCustomer.forEach(purchasedIds => {
    if (purchasedIds.size < 2) return;
    const heldOut = [...purchasedIds].pop();
    const profile = [...purchasedIds].filter(id => id !== heldOut);
    const scores = new Map();
    profile.forEach(productId => {
      (coPurchaseCounts.get(productId) || new Map()).forEach((count, candidateId) => {
        if (!profile.includes(candidateId)) scores.set(candidateId, (scores.get(candidateId) || 0) + count);
      });
    });
    const topModelIds = [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id]) => id);
    evaluated += 1;
    if (topModelIds.includes(heldOut)) hits += 1;
    if (popularProducts.some(product => String(product._id) === heldOut)) popularHits += 1;
  });
  const hitRateAt4 = evaluated ? hits / evaluated : 0;
  const precisionAt4 = evaluated ? hitRateAt4 / 4 : 0;
  const popularBaselineAt4 = evaluated ? popularHits / evaluated : 0;
  const pairCandidates = [];
  coPurchaseCounts.forEach((counts, productId) => {
    counts.forEach((count, pairedProductId) => {
      if (productId >= pairedProductId) return;
      pairCandidates.push({ productId, pairedProductId, count });
    });
  });
  const maxCoPurchase = Math.max(...pairCandidates.map(pair => pair.count), 1);
  const pairIds = [...new Set(pairCandidates.flatMap(pair => [pair.productId, pair.pairedProductId]))];
  const pairProducts = await Product.find({ _id: { $in: pairIds } })
    .select('title category tags price').lean();
  const pairProductMap = new Map(pairProducts.map(product => [String(product._id), product]));
  const productPairs = pairCandidates
    .map(pair => {
      const product = pairProductMap.get(pair.productId);
      const pairedProduct = pairProductMap.get(pair.pairedProductId);
      if (!product || !pairedProduct) return null;
      // Normalize by both the strongest pair and the number of customers.
      // A pair seen once must not look like a 100% confidence recommendation
      // when the training data contains multiple customers.
      const relativePurchaseScore = pair.count / maxCoPurchase;
      const customerSupport = trainingCustomerCount > 0
        ? pair.count / trainingCustomerCount
        : 0;
      const purchaseScore = relativePurchaseScore * customerSupport;
      const totalScore = purchaseScore * 0.7 + productSimilarity(product, pairedProduct) * 0.3;
      return {
        productId: product._id,
        pairedProductId: pairedProduct._id,
        coPurchaseCount: pair.count,
        purchaseScore: Math.round(purchaseScore * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 20);
  const metrics = {
    hitRateAt4: Math.round(hitRateAt4 * 1000) / 10,
    precisionAt4: Math.round(precisionAt4 * 1000) / 10,
    popularBaselineAt4: Math.round(popularBaselineAt4 * 1000) / 10
  };
  const run = {
    trainedAt: new Date(),
    mode,
    trainingPurchases: validOrders.length,
    trainingCustomers: trainingCustomerCount,
    trainingReviews: reviews.length,
    ...metrics,
    durationMs: Date.now() - startedAt
  };
  const model = await RecommendationModel.findOneAndUpdate(
    { key: 'default' },
    {
      $set: { trainedAt: run.trainedAt, metrics, dataSummary: {
        purchases: validOrders.length, customers: trainingCustomerCount, reviews: reviews.length
      }, productPairs },
      $setOnInsert: { key: 'default', version: 1 },
      $push: { trainingHistory: { $each: [run], $slice: -20 } }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  return { model, run };
}

module.exports = { getConfig, scoreRecommendations, trainRecommendationModel };
