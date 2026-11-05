// Chạy: node scripts/seedVipPackages.js
// Tạo sẵn vài gói thẻ mẫu. Nếu đã có gói nào thì bỏ qua.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const VipPackage = require('../models/VipPackage');

const PACKAGES = [
    { name: 'Đẩy Top 1 ngày', description: 'Đưa 1 sản phẩm lên đầu trang chủ và danh sách trong 24 giờ.',
        type: 'pin', durationDays: 1, quantity: 1, validDays: 60, price: 5000, sortOrder: 1 },
    { name: 'Đẩy Top 3 ngày', description: 'Sản phẩm nằm đầu danh sách trong 3 ngày liên tục.',
        type: 'pin', durationDays: 3, quantity: 1, validDays: 90, price: 12000, originalPrice: 15000, sortOrder: 2 },
    { name: 'Đẩy Top 7 ngày', description: 'Một tuần ở vị trí đầu trang, phù hợp đồ giá trị cao.',
        type: 'pin', durationDays: 7, quantity: 1, validDays: 90, price: 25000, originalPrice: 35000, badge: 'Phổ biến', sortOrder: 3 },
    { name: 'Gói Làm Mới x5', description: '5 lượt đẩy top, mỗi lượt 1 ngày. Dùng cho nhiều sản phẩm hoặc đẩy lại nhiều lần.',
        type: 'pin', durationDays: 1, quantity: 5, validDays: 90, price: 19000, originalPrice: 25000, badge: 'Tiết kiệm', sortOrder: 4 },
    { name: 'Thẻ Nổi Bật 7 ngày', description: 'Viền cam và huy hiệu "Nổi bật" giúp tin của bạn dễ thấy hơn.',
        type: 'highlight', durationDays: 7, quantity: 1, validDays: 90, price: 15000, sortOrder: 5 },
    { name: 'Thẻ VIP Combo 7 ngày', description: 'Vừa đẩy top vừa nổi bật trong 7 ngày.',
        type: 'combo', durationDays: 7, quantity: 1, validDays: 90, price: 35000, originalPrice: 40000, badge: 'Hiệu quả nhất', sortOrder: 6 }
];

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await VipPackage.countDocuments();
        if (count > 0) {
            console.log(`Đã có ${count} gói thẻ, bỏ qua seed.`);
        } else {
            await VipPackage.insertMany(PACKAGES);
            console.log(`Đã tạo ${PACKAGES.length} gói thẻ mẫu.`);
        }
    } catch (e) {
        console.error('Seed lỗi:', e.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();