// Chạy: node scripts/seedVipPackages.js
// Thêm các gói thẻ mẫu. Gói nào đã có (trùng tên) thì giữ nguyên, chỉ thêm gói còn thiếu,
// nên chạy lại nhiều lần an toàn và không ghi đè giá bạn đã chỉnh trong trang admin.
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const VipPackage = require('../models/VipPackage');

const P = (o) => ({ quantity: 1, validDays: 90, ...o });

const PACKAGES = [
    // ── Đẩy top: lên đầu trang chủ và danh sách ──
    P({ name: 'Đẩy Top 1 ngày', description: 'Đưa 1 sản phẩm lên đầu trang chủ và danh sách trong 24 giờ.', type: 'pin', durationDays: 1, validDays: 60, price: 5000, sortOrder: 10 }),
    P({ name: 'Đẩy Top 3 ngày', description: 'Sản phẩm nằm đầu danh sách trong 3 ngày liên tục.', type: 'pin', durationDays: 3, price: 12000, originalPrice: 15000, sortOrder: 11 }),
    P({ name: 'Đẩy Top 7 ngày', description: 'Một tuần ở vị trí đầu trang, phù hợp đồ giá trị cao.', type: 'pin', durationDays: 7, price: 25000, originalPrice: 35000, badge: 'Phổ biến', sortOrder: 12 }),
    P({ name: 'Đẩy Top 14 ngày', description: 'Hai tuần liền trên đầu trang, tiết kiệm hơn mua lẻ.', type: 'pin', durationDays: 14, price: 45000, originalPrice: 70000, sortOrder: 13 }),
    P({ name: 'Đẩy Top 30 ngày', description: 'Cả tháng ở vị trí đầu trang cho sản phẩm bạn muốn bán gấp.', type: 'pin', durationDays: 30, validDays: 120, price: 80000, originalPrice: 150000, badge: 'Giá tốt nhất', sortOrder: 14 }),
    P({ name: 'Gói Làm Mới x5', description: '5 lượt đẩy top, mỗi lượt 1 ngày. Dùng cho nhiều sản phẩm hoặc đẩy lại nhiều lần.', type: 'pin', durationDays: 1, quantity: 5, price: 19000, originalPrice: 25000, badge: 'Tiết kiệm', sortOrder: 15 }),
    P({ name: 'Gói Làm Mới x10', description: '10 lượt đẩy top, mỗi lượt 1 ngày, dành cho shop đăng nhiều tin.', type: 'pin', durationDays: 1, quantity: 10, validDays: 120, price: 35000, originalPrice: 50000, sortOrder: 16 }),

    // ── Nổi bật: viền cam + huy hiệu ──
    P({ name: 'Thẻ Nổi Bật 3 ngày', description: 'Viền cam và huy hiệu "Nổi bật" giúp tin dễ thấy hơn.', type: 'highlight', durationDays: 3, price: 8000, sortOrder: 20 }),
    P({ name: 'Thẻ Nổi Bật 7 ngày', description: 'Viền cam và huy hiệu "Nổi bật" trong 1 tuần.', type: 'highlight', durationDays: 7, price: 15000, sortOrder: 21 }),
    P({ name: 'Thẻ Nổi Bật 14 ngày', description: 'Hai tuần nổi bật giữa danh sách sản phẩm.', type: 'highlight', durationDays: 14, price: 26000, originalPrice: 30000, sortOrder: 22 }),

    // ── HOT: nhãn đỏ thu hút ──
    P({ name: 'Nhãn HOT 3 ngày', description: 'Gắn nhãn 🔥 HOT màu đỏ, hợp đồ thanh lý gấp hoặc giá sốc.', type: 'hot', durationDays: 3, price: 7000, sortOrder: 30 }),
    P({ name: 'Nhãn HOT 7 ngày', description: 'Nhãn 🔥 HOT trong 1 tuần.', type: 'hot', durationDays: 7, price: 13000, originalPrice: 16000, sortOrder: 31 }),

    // ── Combo / Siêu VIP: nhiều hiệu ứng trong một thẻ ──
    P({ name: 'Thẻ VIP Combo 7 ngày', description: 'Vừa đẩy top vừa nổi bật trong 7 ngày.', type: 'combo', durationDays: 7, price: 35000, originalPrice: 40000, badge: 'Hiệu quả', sortOrder: 40 }),
    P({ name: 'Thẻ VIP Combo 30 ngày', description: 'Đẩy top và nổi bật suốt 30 ngày.', type: 'combo', durationDays: 30, validDays: 120, price: 110000, originalPrice: 190000, sortOrder: 41 }),
    P({ name: 'Siêu VIP 7 ngày', description: 'Đủ bộ: đẩy top + nổi bật + nhãn HOT trong 7 ngày.', type: 'ultimate', durationDays: 7, price: 45000, originalPrice: 55000, badge: 'Mạnh nhất', sortOrder: 42 }),

    // ── Shop VIP: huy hiệu trên mọi tin của tài khoản ──
    P({ name: 'Shop VIP 30 ngày', description: 'Huy hiệu 🏪 Shop VIP hiện trên mọi tin của bạn trong 30 ngày, tạo uy tín với người mua.', type: 'seller_vip', durationDays: 30, validDays: 120, price: 49000, sortOrder: 50 }),
    P({ name: 'Shop VIP 90 ngày', description: 'Một học kỳ mang huy hiệu Shop VIP trên mọi tin.', type: 'seller_vip', durationDays: 90, validDays: 180, price: 129000, originalPrice: 147000, badge: 'Tiết kiệm', sortOrder: 51 })
];

(async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const existing = new Set((await VipPackage.find().select('name')).map((p) => p.name));
        const toAdd = PACKAGES.filter((p) => !existing.has(p.name));
        if (toAdd.length) await VipPackage.insertMany(toAdd);
        console.log(`Đã thêm ${toAdd.length} gói thẻ mới, giữ nguyên ${PACKAGES.length - toAdd.length} gói đã có.`);
    } catch (e) {
        console.error('Seed lỗi:', e.message);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
    }
})();