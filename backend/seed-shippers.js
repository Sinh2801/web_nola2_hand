const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// 1. Đảm bảo đọc chính xác file .env bất kể chạy từ thư mục nào
dotenv.config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const seedShippers = async () => {
  try {
    // 2. Thay thế giá trị dự phòng bằng chuỗi Atlas thực tế của bạn
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dnu-marketplace';

    await mongoose.connect(MONGODB_URI);
    console.log(' Đã kết nối MongoDB Atlas thành công!');

    for (let i = 1; i <= 5; i++) {
      // Bạn có thể đổi @dnu.edu.vn thành @nola2hand.vn nếu muốn đồng bộ thương hiệu
      const email = `shipper${i}@dnu.edu.vn`;
      const phone = `099988877${i}`;

      const existingUser = await User.findOne({ $or: [{ email }, { phone }] });
      if (existingUser) {
        console.log(`⚠️ Tài khoản shipper${i} đã tồn tại, bỏ qua...`);
        continue;
      }

      const newShipper = new User({
        name: `Shipper ${i}`,
        email,
        phone,
        password: '123456',
        isVerified: true,
        isShipper: true,
        shipperStatus: 'approved',
        shipperInfo: {
          idCard: `01234567890${i}`,
          vehicleType: 'motorbike',
          operatingArea: 'Khu vực trường',
          bio: 'Shipper chuyên nghiệp của nola2hand',
          appliedAt: new Date()
        }
      });

      // Middleware 'pre' save trong User model sẽ tự động hash password
      await newShipper.save();
      console.log(`Tạo thành công shipper${i} (Email: ${email} | Phone: ${phone} | Pass: 123456)`);
    }

    console.log(' Hoàn thành tạo 5 tài khoản shipper mẫu!');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi tạo shipper:', error);
    process.exit(1);
  }
};

seedShippers();