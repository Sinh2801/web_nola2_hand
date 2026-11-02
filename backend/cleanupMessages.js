/**
 * DỌN DỮ LIỆU CHAT CŨ (NOLA2HAND)
 *
 * Cách dùng:
 *   node cleanupMessages.js                 -> chỉ XEM TRƯỚC, không xóa gì
 *   node cleanupMessages.js --orphans --yes -> xóa tin nhắn có người gửi/nhận không còn trong DB
 *   node cleanupMessages.js --all --yes     -> xóa TOÀN BỘ tin nhắn (không hoàn tác được)
 *
 * Không cần biết tên model: script làm việc trực tiếp với collection.
 * Mặc định collection tin nhắn là "messages", user là "users".
 * Nếu tên khác thì chạy: MESSAGES_COLLECTION=ten_khac node cleanupMessages.js
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MESSAGES_COLLECTION = process.env.MESSAGES_COLLECTION || 'messages';
const USERS_COLLECTION = process.env.USERS_COLLECTION || 'users';

const args = process.argv.slice(2);
const MODE_ALL = args.includes('--all');
const MODE_ORPHANS = args.includes('--orphans');
const CONFIRMED = args.includes('--yes');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB');

        const db = mongoose.connection.db;
        const messages = db.collection(MESSAGES_COLLECTION);
        const users = db.collection(USERS_COLLECTION);

        const total = await messages.countDocuments();
        console.log(`📨 Tổng số tin nhắn hiện có: ${total}`);

        // Tìm tin nhắn mồ côi: senderId hoặc receiverId trỏ tới user không còn tồn tại
        const userIds = new Set((await users.find({}, { projection: { _id: 1 } }).toArray()).map((u) => String(u._id)));
        const refIds = [
            ...(await messages.distinct('senderId')),
            ...(await messages.distinct('receiverId'))
        ];
        const deadIds = [...new Map(refIds.filter((id) => id && !userIds.has(String(id))).map((id) => [String(id), id])).values()];

        const orphanFilter = { $or: [{ senderId: { $in: deadIds } }, { receiverId: { $in: deadIds } }] };
        const orphanCount = deadIds.length ? await messages.countDocuments(orphanFilter) : 0;

        console.log(`👻 User đã bị xóa nhưng vẫn còn trong tin nhắn: ${deadIds.length}`);
        console.log(`👻 Tin nhắn mồ côi (gây lỗi giao diện): ${orphanCount}`);

        if (!MODE_ALL && !MODE_ORPHANS) {
            console.log('\nℹ️  Chế độ xem trước, chưa xóa gì. Thêm --orphans hoặc --all kèm --yes để xóa.');
            process.exit(0);
        }

        if (!CONFIRMED) {
            console.log('\n⚠️  Thiếu --yes nên chưa xóa gì. Thêm --yes để xác nhận.');
            process.exit(0);
        }

        if (MODE_ALL) {
            const result = await messages.deleteMany({});
            console.log(`\n🗑️  Đã xóa TOÀN BỘ ${result.deletedCount} tin nhắn.`);
        } else {
            const result = orphanCount ? await messages.deleteMany(orphanFilter) : { deletedCount: 0 };
            console.log(`\n🗑️  Đã xóa ${result.deletedCount} tin nhắn mồ côi.`);
        }

        console.log(`📨 Còn lại: ${await messages.countDocuments()} tin nhắn`);
        console.log('✨ Hoàn thành!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Lỗi:', error.message);
        process.exit(1);
    }
};

run();