/**
 * TẠO / CẬP NHẬT TÀI KHOẢN ADMIN (NOLA2HAND)
 *
 * - Chạy lại bao nhiêu lần cũng được, không tạo trùng.
 * - Admin có avatar chữ cái đầu (dùng chung hàm buildAvatar với createMultipleUsers.js),
 *   nên không còn lỗi "Cannot read properties of null (reading 'avatar')".
 * - Model User PHẢI có trường lưu avatar (avatar: { type: String, default: '' }).
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');
const { buildAvatar } = require('./createMultipleUsers');

const AVATAR_FIELD_CANDIDATES = ['avatar', 'avatarUrl', 'profileImage', 'profilePicture', 'profilePic', 'image', 'photo', 'picture'];
const findAvatarField = () => AVATAR_FIELD_CANDIDATES.find((f) => Boolean(User.schema.path(f)));

const ADMIN_EMAIL = 'admin@nlu.edu.vn';
const ADMIN_PASSWORD = 'admin123456';
const ADMIN_NAME = 'Admin Nông Lâm';
const ADMIN_STUDENT_ID = '0000000000';

const createAdmin = async () => {
  try {
    const AVATAR_FIELD = findAvatarField();
    if (!AVATAR_FIELD) {
      console.error('❌ Model User chưa có trường lưu avatar.');
      console.error('   Mở models/User.js và thêm vào schema dòng sau, rồi chạy lại:');
      console.error("   avatar: { type: String, default: '' },");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
    console.log('✅ MongoDB connected successfully');

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL });

    if (existingAdmin) {
      existingAdmin.isAdmin = true;
      existingAdmin.isVerified = true;
      existingAdmin.isActive = true;
      existingAdmin.password = ADMIN_PASSWORD;

      // Chỉ bổ sung avatar nếu chưa có, không ghi đè ảnh người dùng đã tự đổi
      if (!existingAdmin[AVATAR_FIELD]) {
        existingAdmin[AVATAR_FIELD] = buildAvatar(existingAdmin.name || ADMIN_NAME, ADMIN_STUDENT_ID);
      }
      await existingAdmin.save();

      console.log('✅ Admin updated successfully!');
      console.log('Email   :', existingAdmin.email);
      console.log('Password:', ADMIN_PASSWORD);
      console.log('Name    :', existingAdmin.name);
      console.log('Avatar  : đã có (trường "' + AVATAR_FIELD + '")');
      process.exit(0);
    }

    const data = {
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: '0123456789',
      password: ADMIN_PASSWORD, // pre-save hook sẽ hash
      studentId: ADMIN_STUDENT_ID,
      address: 'Đại học Nông Lâm TP.HCM',
      isAdmin: true,
      isVerified: true,
      isActive: true
    };
    data[AVATAR_FIELD] = buildAvatar(ADMIN_NAME, ADMIN_STUDENT_ID);

    const admin = await User.create(data);

    console.log('✅ Admin created successfully!');
    console.log('Email   :', admin.email);
    console.log('Password:', ADMIN_PASSWORD);
    console.log('Name    :', admin.name);
    console.log('Avatar  : đã tạo (trường "' + AVATAR_FIELD + '")');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 11000) {
      console.error('⚠️  Trùng email, số điện thoại hoặc MSSV với dữ liệu đang có trong database');
    }
    process.exit(1);
  }
};

createAdmin();