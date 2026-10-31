const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Review = require('./models/Review');
const Product = require('./models/Product');
const User = require('./models/User');

(async () => {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
    const del = await Review.deleteMany({});
    await Product.updateMany({}, { $set: { averageRating: 0, totalReviews: 0 } });
    await User.updateMany({}, { $set: { 'rating.average': 0, 'rating.count': 0 } });
    console.log('Đã xóa', del.deletedCount, 'đánh giá');
    process.exit(0);
})();