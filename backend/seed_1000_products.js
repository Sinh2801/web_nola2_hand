const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Load cấu hình môi trường
dotenv.config({ path: path.join(__dirname, '.env') });

const Product = require('./models/Product');
const User = require('./models/User');

// ==========================================
// KHO DỮ LIỆU ĐƯỢC TỐI ƯU HÓA 100% (KHÔNG LỖI ẢNH)
// ==========================================

// Sử dụng link ảnh Pexels CDN: Rất nhẹ, tải siêu nhanh và không bị block như Unsplash
const categoryData = {
    "Sách": {
        items: ["Giáo trình Toán Cao Cấp A1", "Giáo trình Vật Lý Đại Cương", "Triết học Mác-Lênin", "Tiểu thuyết Mắt Biếc", "Sách TOEIC RC 1000"],
        priceRange: [2, 15], // 20.000đ -> 150.000đ
        image: "https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    "Điện tử": {
        items: ["Laptop Dell Latitude E5470", "Bàn phím cơ DareU EK87", "Chuột không dây Logitech G304", "Màn hình Dell 24 inch", "Cáp sạc iPhone Zin"],
        priceRange: [15, 600], // 150.000đ -> 6.000.000đ
        image: "https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=400"
    },
    "Quần áo": {
        items: ["Áo thể dục NLU size L", "Áo khoác Đoàn Thanh Niên", "Quần Jean ống rộng nam", "Balo chống nước", "Giày Sneaker Nike"],
        priceRange: [4, 30], // 40.000đ -> 300.000đ
        image: "https://images.pexels.com/photos/996329/pexels-photo-996329.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    "Nội thất": {
        items: ["Bàn xếp sinh viên ngồi bệt", "Ghế lười hạt xốp", "Tủ quần áo vải 3 buồng", "Gương đứng soi toàn thân", "Đèn học chống cận"],
        priceRange: [5, 50], // 50.000đ -> 500.000đ
        image: "https://images.pexels.com/photos/279746/pexels-photo-279746.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    "Văn phòng phẩm": {
        items: ["Combo 10 bút bi Thiên Long", "Sổ tay 200 trang bìa da", "Ram giấy A4 Double A", "Bảng tên sinh viên NLU", "Bút Highlight 5 màu"],
        priceRange: [1, 45], // 10.000đ -> 450.000đ
        image: "https://images.pexels.com/photos/2097090/pexels-photo-2097090.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    "Thể thao": {
        items: ["Vợt cầu lông Yonex", "Bóng đá số 5 Động Lực", "Giày đinh dăm đá sân", "Thảm tập Yoga TPE", "Tạ tay nhựa 5kg"],
        priceRange: [5, 40], // 50.000đ -> 400.000đ
        image: "https://images.pexels.com/photos/3628912/pexels-photo-3628912.jpeg?auto=compress&cs=tinysrgb&w=400"
    },
    "Khác": {
        items: ["Bình giữ nhiệt Lock&Lock", "Quạt mini để bàn", "Móc khóa dán balo", "Bình đun nước siêu tốc", "Nón bảo hiểm Sơn"],
        priceRange: [3, 25], // 30.000đ -> 250.000đ
        image: "https://images.pexels.com/photos/1000084/pexels-photo-1000084.jpeg?auto=compress&cs=tinysrgb&w=400"
    }
};

// Từ ngữ chuyên dùng của sinh viên khi bán đồ
const reasons = [
    "Sắp ra trường dọn trọ nên mình cần pass lại gấp.",
    "Do mua dư không có nhu cầu sử dụng tới nên thanh lý.",
    "Kẹt tiền đóng học phí nên đành ngậm ngùi chia tay em nó.",
    "Dọn dẹp lại phòng dư ra món này, còn xài rất ok nhé."
];

const qualities = [
    "Tình trạng còn rất mới, hoạt động hoàn hảo.",
    "Ngoại hình có xước xát nhẹ theo thời gian nhưng xài ngon.",
    "Đã vệ sinh sạch sẽ thơm tho, các bạn mua về là dùng luôn."
];

const offers = [
    "Freeship quanh khu vực Nông Lâm hoặc Suối Tiên.",
    "Có fix nhẹ tiền xăng xe cho anh em nào nhiệt tình.",
    "Giao dịch trực tiếp tại cổng trường NLU hoặc KTX."
];

// Dữ liệu chuẩn khớp 100% với Schema của bạn
const prefixes = ["Thanh lý", "Pass", "Góc dọn trọ", "Cần bán"];
const locations = ['Campus', 'Dormitory', 'Nearby'];
const conditions = ['Rất tốt', 'Tốt', 'Khá', 'Đã dùng nhiều', 'Cần sửa chữa', 'New', 'Like New'];

// Hàm random
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ==========================================
// THỰC THI SCRIPT IMPORT
// ==========================================

const runSeeder = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB thành công');

        const sellers = await User.find();
        if (sellers.length === 0) {
            console.log('❌ Lỗi: Database chưa có user nào. Hãy chạy script tạo user trước!');
            process.exit(1);
        }

        console.log('🗑️ Đang dọn dẹp 100% sản phẩm cũ trong Database...');
        await Product.deleteMany({});

        const TOTAL_PRODUCTS = 1000;
        const productsData = [];
        const categories = Object.keys(categoryData);

        console.log(`⚙️ Đang tiến hành tạo ${TOTAL_PRODUCTS} sản phẩm với hình ảnh đã tối ưu...`);

        for (let i = 0; i < TOTAL_PRODUCTS; i++) {
            const category = getRandomElement(categories);
            const catData = categoryData[category];

            const itemName = getRandomElement(catData.items);
            const prefix = getRandomElement(prefixes);
            const title = Math.random() > 0.3 ? `${prefix} ${itemName} ${getRandomInt(1,99)}` : itemName;

            // Tính giá tiền logic
            const basePrice = getRandomInt(catData.priceRange[0], catData.priceRange[1]) * 10000;
            const price = Math.round(basePrice / 5000) * 5000;

            const description = `${itemName}. ${getRandomElement(reasons)} ${getRandomElement(qualities)} ${getRandomElement(offers)}`;

            productsData.push({
                userId: getRandomElement(sellers)._id,
                title: title,
                description: description,
                price: price,
                category: category,
                condition: getRandomElement(conditions),
                location: getRandomElement(locations),
                images: [catData.image], // Đảm bảo lưu đúng định dạng mảng với 1 link ảnh nhẹ nhất
                tags: [category.toLowerCase(), "nlu", "pass đồ"],
                status: Math.random() > 0.1 ? "Available" : "Sold",
                isApproved: true,
                viewCount: getRandomInt(10, 500),
                favoriteCount: getRandomInt(0, 50)
            });
        }

        // Bơm dữ liệu vào Database
        const createdProducts = await Product.insertMany(productsData);
        console.log(`\n✨ ĐÃ HOÀN THÀNH XUẤT SẮC!`);
        console.log(`Đã import thành công ${createdProducts.length} sản phẩm không bị lỗi ảnh.`);
        console.log(`Hãy mở web Frontend lên để xem thành quả nhé!`);

        process.exit(0);

    } catch (error) {
        console.error('\n❌ QUÁ TRÌNH TẠO SẢN PHẨM BỊ LỖI:');
        console.error(error.message);
        process.exit(1);
    }
};

runSeeder();