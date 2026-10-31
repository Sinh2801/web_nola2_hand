/**
 * SEEDER 20 NGƯỜI DÙNG + AVATAR (NOLA2HAND)
 *
 * - Tên tiếng Việt khớp giới tính (nam / nữ), không trùng tên.
 * - MSSV 23120001 -> 23120020, email MSSV@nlu.edu.vn, mật khẩu 123456.
 * - Số điện thoại hợp lệ, không trùng với 20 user này và không trùng user đang có trong DB.
 * - KHÔNG xóa user nào. Tài khoản đã có (cùng email) thì được cập nhật và GIỮ NGUYÊN _id,
 *   nên sản phẩm và token đăng nhập cũ vẫn hợp lệ, chạy lại bao nhiêu lần cũng không hỏng dữ liệu.
 * - AVATAR: mỗi tài khoản có ảnh đại diện chữ cái đầu của tên, màu cố định theo MSSV.
 *     AVATAR_MODE=svg         (mặc định) ảnh SVG nhúng thẳng vào DB dạng data URI,
 *                             không cần internet, không cần cấu hình thư mục uploads.
 *     AVATAR_MODE=ui-avatars  lưu link ảnh PNG từ dịch vụ ui-avatars.com.
 * - Tự bổ sung avatar cho các user cũ trong DB chưa có avatar (không đổi mật khẩu).
 * - Model User PHẢI có trường lưu avatar (xem hướng dẫn). Nếu chưa có, script dừng và báo cách thêm.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

// ==========================================
// CẤU HÌNH
// ==========================================
const TOTAL_USERS = 20;
const PASSWORD = '123456'; // được hash bởi pre-save hook khi User.create
const EMAIL_DOMAIN = 'nlu.edu.vn';
const MSSV_PREFIX = '23120';
const AVATAR_MODE = (process.env.AVATAR_MODE || 'svg').toLowerCase(); // 'svg' | 'ui-avatars'

// Tên các trường avatar thường gặp, script lấy trường đầu tiên model có
const AVATAR_FIELD_CANDIDATES = ['avatar', 'avatarUrl', 'profileImage', 'profilePicture', 'profilePic', 'image', 'photo', 'picture'];

// Bảng màu avatar (nền đậm, chữ trắng đọc rõ)
const AVATAR_COLORS = [
    '#EA580C', '#059669', '#2563EB', '#7C3AED', '#DB2777',
    '#0891B2', '#CA8A04', '#DC2626', '#4F46E5', '#0D9488'
];

// ==========================================
// DỮ LIỆU TÊN (tách nam / nữ để tên tự nhiên)
// ==========================================
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];

const NAM = {
    dem: ['Văn', 'Hữu', 'Đức', 'Minh', 'Quốc', 'Thành', 'Gia', 'Anh', 'Tuấn'],
    ten: ['An', 'Bình', 'Cường', 'Dũng', 'Hùng', 'Khoa', 'Long', 'Nam', 'Phong', 'Quân', 'Sơn', 'Tài', 'Vinh', 'Hải', 'Khang', 'Huy', 'Đạt', 'Thịnh', 'Trung']
};

const NU = {
    dem: ['Thị', 'Ngọc', 'Thu', 'Thanh', 'Mai', 'Phương', 'Hồng', 'Kim', 'Bảo'],
    ten: ['Linh', 'Nga', 'Hương', 'Trang', 'Hà', 'My', 'Anh', 'Thảo', 'Nhung', 'Lan', 'Vy', 'Ngân', 'Trinh', 'Yến', 'Hạnh', 'Quyên', 'Châu', 'Ân']
};

// ==========================================
// DỮ LIỆU THÔNG TIN THÊM
// ==========================================
const FACULTIES = [
    { name: 'Công nghệ thông tin', classCode: 'DH23DTA' },
    { name: 'Kinh tế', classCode: 'DH23KT' },
    { name: 'Nông học', classCode: 'DH23NH' },
    { name: 'Lâm nghiệp', classCode: 'DH23LN' },
    { name: 'Thủy sản', classCode: 'DH23TS' },
    { name: 'Chăn nuôi - Thú y', classCode: 'DH23TY' },
    { name: 'Cơ khí - Công nghệ', classCode: 'DH23CK' },
    { name: 'Môi trường và Tài nguyên', classCode: 'DH23MT' }
];

const ADDRESSES = [
    'Ký túc xá Đại học Nông Lâm TP.HCM',
    'Nhà trọ gần cổng trường Đại học Nông Lâm TP.HCM',
    'Khu nhà trọ sinh viên gần Đại học Nông Lâm TP.HCM'
];

const BIOS = [
    'Sinh viên hay dọn trọ nên thường pass lại đồ học tập còn dùng tốt.',
    'Thích săn đồ 2hand giá rẻ, giao dịch nhanh gọn tại cổng trường.',
    'Bán đồ thật, mô tả đúng tình trạng, ưu tiên gặp trực tiếp.',
    'Cần pass lại đồ dư sau mỗi học kỳ, giá sinh viên dễ thương.',
    'Ưu tiên giao dịch tại ký túc xá, có thể fix nhẹ cho bạn cùng trường.',
    'Mua bán đồ cũ để tiết kiệm, chấp nhận kiểm tra hàng trước khi nhận.'
];

// ==========================================
// TIỆN ÍCH
// ==========================================
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

const PHONE_PREFIXES = [
    '032', '033', '034', '035', '036', '037', '038', '039',
    '070', '076', '077', '078', '079',
    '081', '082', '083', '084', '085', '086', '088', '089',
    '090', '091', '092', '093', '094', '096', '097', '098', '099'
];

function randomPhone() {
    return `${pick(PHONE_PREFIXES)}${randInt(1000000, 9999999)}`;
}

// Kiểm tra model User có trường này không
const hasField = (name) => Boolean(User.schema.path(name));

// Tìm tên trường avatar mà model đang dùng
const findAvatarField = () => AVATAR_FIELD_CANDIDATES.find(hasField);

// Lấy giá trị giới tính phù hợp với enum của model (nếu có)
function genderValue(isMale) {
    const p = User.schema.path('gender');
    if (!p) return undefined;
    const maleRe = /^(male|nam|m)$/i;
    const femaleRe = /^(female|nữ|nu|f)$/i;
    const values = p.enumValues && p.enumValues.length ? p.enumValues : null;
    if (values) return values.find((v) => (isMale ? maleRe : femaleRe).test(v));
    return isMale ? 'Nam' : 'Nữ';
}

// ==========================================
// AVATAR
// ==========================================

// Chữ cái đầu theo cách người Việt: lấy 2 từ cuối của tên (Hồ Tuấn An -> TA)
function initialsOf(name) {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return '?';
    const lastTwo = words.length >= 2 ? words.slice(-2) : words;
    return lastTwo.map((w) => Array.from(w)[0].toLocaleUpperCase('vi')).join('');
}

// Màu cố định theo seed (cùng MSSV luôn ra cùng màu)
function colorFor(seed) {
    const s = String(seed);
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function escapeXml(s) {
    return String(s).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// Tạo avatar (chuỗi dùng được trực tiếp trong <img src="...">)
function buildAvatar(name, seed) {
    const initials = initialsOf(name);
    const color = colorFor(seed || name);

    if (AVATAR_MODE === 'ui-avatars') {
        const shortName = String(name).trim().split(/\s+/).slice(-2).join(' ');
        const params = new URLSearchParams({
            name: shortName,
            background: color.replace('#', ''),
            color: 'ffffff',
            size: '200',
            bold: 'true',
            format: 'png'
        });
        return `https://ui-avatars.com/api/?${params}`;
    }

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" role="img" aria-label="${escapeXml(name)}">` +
        `<rect width="200" height="200" fill="${color}"/>` +
        `<text x="100" y="100" text-anchor="middle" dominant-baseline="central" ` +
        `font-family="Segoe UI, Arial, Helvetica, sans-serif" font-size="84" font-weight="700" fill="#ffffff">${escapeXml(initials)}</text>` +
        `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

// ==========================================
// TẠO DANH SÁCH NGƯỜI
// ==========================================
// 10 nam, 10 nữ, không trùng tên, rồi xáo trộn
function generatePeople() {
    const used = new Set();
    const people = [];

    for (let i = 0; i < TOTAL_USERS; i++) {
        const isMale = i % 2 === 0;
        const pool = isMale ? NAM : NU;
        let name;
        let guard = 0;
        do {
            name = `${pick(HO)} ${pick(pool.dem)} ${pick(pool.ten)}`;
            guard++;
        } while (used.has(name) && guard < 200);
        used.add(name);
        people.push({ name, isMale });
    }
    return shuffle(people);
}

// ==========================================
// CHẠY
// ==========================================
const run = async () => {
    try {
        // Kiểm tra model có trường avatar chưa, trước khi làm bất cứ việc gì
        const AVATAR_FIELD = findAvatarField();
        if (!AVATAR_FIELD) {
            console.error('❌ Model User chưa có trường lưu avatar, nên không thể lưu ảnh đại diện.');
            console.error('   Mở file models/User.js và thêm vào schema dòng sau, rồi chạy lại:');
            console.error("   avatar: { type: String, default: '' },");
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand');
        console.log('✅ Đã kết nối MongoDB thành công');
        console.log(`🖼️  Avatar: lưu vào trường "${AVATAR_FIELD}", chế độ ${AVATAR_MODE}`);

        const people = generatePeople();
        const emails = people.map((_, i) => `${MSSV_PREFIX}${String(i + 1).padStart(3, '0')}@${EMAIL_DOMAIN}`);

        // 1. Lấy số điện thoại đang có để không trùng
        const existing = await User.find({}, 'phone').lean();
        const usedPhones = new Set(existing.map((u) => u.phone).filter(Boolean));

        // 2. Tạo mới hoặc cập nhật từng user. Nếu email đã có thì GIỮ NGUYÊN _id
        console.log(`\n➕ Đang tạo hoặc cập nhật ${TOTAL_USERS} người dùng...\n`);
        const created = [];
        let countNew = 0;
        let countUpdated = 0;

        for (let i = 0; i < people.length; i++) {
            const person = people[i];
            const mssv = `${MSSV_PREFIX}${String(i + 1).padStart(3, '0')}`;
            const email = `${mssv}@${EMAIL_DOMAIN}`;
            const faculty = pick(FACULTIES);

            const old = await User.findOne({ email });

            // Giữ số điện thoại cũ nếu có, không thì tạo số mới không trùng
            let phone = old && old.phone;
            if (!phone) {
                do {
                    phone = randomPhone();
                } while (usedPhones.has(phone));
                usedPhones.add(phone);
            }

            const data = {
                name: person.name,
                email,
                phone,
                password: PASSWORD, // pre-save hook sẽ hash
                address: pick(ADDRESSES),
                studentId: mssv,
                isVerified: true,
                isActive: true
            };

            data[AVATAR_FIELD] = buildAvatar(person.name, mssv);

            // Các trường thêm: chỉ lưu nếu model có
            const gender = genderValue(person.isMale);
            if (hasField('gender') && gender) data.gender = gender;
            if (hasField('dateOfBirth')) data.dateOfBirth = new Date(randInt(2003, 2005), randInt(0, 11), randInt(1, 28));
            if (hasField('faculty')) data.faculty = faculty.name;
            if (hasField('className')) data.className = faculty.classCode;
            if (hasField('bio')) data.bio = pick(BIOS);

            let user;
            if (old) {
                old.set(data);
                user = await old.save();
                countUpdated++;
            } else {
                user = await User.create(data);
                countNew++;
            }
            created.push({ user, faculty, isMale: person.isMale });
        }

        // 3. Bổ sung avatar cho user cũ chưa có (updateOne nên không động tới mật khẩu)
        const missing = await User.find({ [AVATAR_FIELD]: { $in: [null, ''] } }, 'name studentId').lean();
        for (const u of missing) {
            await User.updateOne(
                { _id: u._id },
                { $set: { [AVATAR_FIELD]: buildAvatar(u.name, u.studentId || String(u._id)) } }
            );
        }

        // 4. In danh sách rõ ràng
        console.log(`✅ Xong ${created.length} người dùng (tạo mới ${countNew}, cập nhật giữ nguyên _id ${countUpdated}):\n`);
        created.forEach(({ user, faculty, isMale }, idx) => {
            console.log(`${String(idx + 1).padStart(2, '0')}. ${user.name}  (${isMale ? 'Nam' : 'Nữ'})`);
            console.log(`    🎓 MSSV     : ${user.studentId}`);
            console.log(`    📧 Email    : ${user.email}`);
            console.log(`    🔑 Mật khẩu : ${PASSWORD}`);
            console.log(`    📱 SĐT      : ${user.phone}`);
            console.log(`    🏫 Khoa/Lớp : ${faculty.name} / ${faculty.classCode}`);
            console.log(`    📍 Địa chỉ  : ${user.address}`);
            console.log(`    🖼️  Avatar   : chữ "${initialsOf(user.name)}", màu ${colorFor(user.studentId)}`);
            console.log('');
        });

        const EXTRA_FIELDS = ['gender', 'dateOfBirth', 'faculty', 'className', 'bio'];
        const extraSaved = EXTRA_FIELDS.filter(hasField);
        const extraSkipped = EXTRA_FIELDS.filter((f) => !hasField(f));

        console.log('📝 Thông tin đăng nhập:');
        console.log(`   Email : ${emails[0]} đến ${emails[emails.length - 1]}`);
        console.log(`   Mật khẩu: ${PASSWORD} (tất cả tài khoản)`);
        console.log(`   Trường avatar          : ${AVATAR_FIELD} (${AVATAR_MODE})`);
        console.log(`   Avatar bổ sung user cũ : ${missing.length} tài khoản`);
        console.log(`   Trường thêm đã lưu     : ${extraSaved.length ? extraSaved.join(', ') : '(không có)'}`);
        console.log(`   Trường thêm bị bỏ qua  : ${extraSkipped.length ? extraSkipped.join(', ') + ' (model User chưa có)' : '(không có)'}`);
        console.log(`   Tổng số user trong DB  : ${await User.countDocuments()}`);
        console.log('\n✨ Hoàn thành!');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Lỗi:', error.message);
        if (error.code === 11000) {
            console.error('⚠️  Trùng email, số điện thoại hoặc MSSV với dữ liệu đang có trong database');
        }
        process.exit(1);
    }
};

if (require.main === module) {
    run();
}

module.exports = { initialsOf, colorFor, buildAvatar };