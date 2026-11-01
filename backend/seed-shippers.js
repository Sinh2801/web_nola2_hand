/**
 * SEEDER 5 SHIPPER MẪU (NOLA2HAND)
 *
 * - Mỗi shipper có avatar chữ cái đầu (dùng chung buildAvatar với createMultipleUsers.js).
 * - Shipper đã tồn tại thì KHÔNG tạo lại, nhưng được bổ sung avatar nếu còn thiếu
 *   (updateOne nên không đụng tới mật khẩu và giữ nguyên _id).
 * - Model User PHẢI có trường lưu avatar (avatar: { type: String, default: '' }).
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const { buildAvatar } = require('./createMultipleUsers');

const AVATAR_FIELD_CANDIDATES = ['avatar', 'avatarUrl', 'profileImage', 'profilePicture', 'profilePic', 'image', 'photo', 'picture'];
const findAvatarField = () => AVATAR_FIELD_CANDIDATES.find((f) => Boolean(User.schema.path(f)));

const TOTAL_SHIPPERS = 5;
const PASSWORD = '123456';

const seedShippers = async () => {
  try {
    const AVATAR_FIELD = findAvatarField();
    if (!AVATAR_FIELD) {
      console.error('❌ Model User chưa có trường lưu avatar.');
      console.error('   Mở models/User.js và thêm vào schema dòng sau, rồi chạy lại:');
      console.error("   avatar: { type: String, default: '' },");
      process.exit(1);
    }

    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB thành công!');

    let countNew = 0;
    let countSkipped = 0;
    let countAvatarAdded = 0;

    for (let i = 1; i <= TOTAL_SHIPPERS; i++) {
      const name = `Shipper ${i}`;
      const email = `shipper${i}@st.hcmuaf.edu.vn`;
      const phone = `099988877${i}`;

      const existingUser = await User.findOne({ $or: [{ email }, { phone }] });

      if (existingUser) {
        // Bổ sung avatar nếu thiếu, không động tới các trường khác
        if (!existingUser[AVATAR_FIELD]) {
          await User.updateOne(
              { _id: existingUser._id },
              { $set: { [AVATAR_FIELD]: buildAvatar(existingUser.name || name, email) } }
          );
          countAvatarAdded++;
          console.log(`🖼️  shipper${i} đã tồn tại, đã bổ sung avatar`);
        } else {
          console.log(`⚠️ Tài khoản shipper${i} đã tồn tại và đã có avatar, bỏ qua...`);
        }
        countSkipped++;
        continue;
      }

      const data = {
        name,
        email,
        phone,
        password: PASSWORD, // pre-save hook sẽ hash
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
      };
      data[AVATAR_FIELD] = buildAvatar(name, email);

      const newShipper = new User(data);
      await newShipper.save();
      countNew++;
      console.log(`✅ Tạo thành công shipper${i} (Email: ${email} | Phone: ${phone} | Pass: ${PASSWORD})`);
    }

    console.log('\n📝 Tổng kết:');
    console.log(`   Tạo mới            : ${countNew}`);
    console.log(`   Đã tồn tại (bỏ qua): ${countSkipped}`);
    console.log(`   Bổ sung avatar     : ${countAvatarAdded}`);
    console.log(`   Trường avatar      : ${AVATAR_FIELD}`);
    console.log('✨ Hoàn thành!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi tạo shipper:', error);
    process.exit(1);
  }
};

seedShippers();