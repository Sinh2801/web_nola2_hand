/**
 * NẠP LẠI TOÀN BỘ DỮ LIỆU DEMO CHỈ VỚI 1 LỆNH (NOLA2HAND)
 *
 *   npm run seed                      hỏi xác nhận, XÓA SẠCH database rồi nạp lại mọi thứ
 *   npm run seed -- --yes             như trên nhưng không hỏi
 *   npm run seed:verify               chỉ kiểm tra dữ liệu có đồng bộ không (không ghi gì)
 *   node seed_all.js --from=products  chạy tiếp từ một bước (KHÔNG xóa DB), dùng khi 1 bước bị lỗi
 *   node seed_all.js --skip=reviews,follows   bỏ qua một số bước
 *   node seed_all.js --list           xem danh sách các bước
 *
 * Vì sao chạy lại không còn lỗi "không đồng bộ":
 *   1. Xóa luôn database (dropDatabase) nên không còn dữ liệu mồ côi, không còn index cũ
 *      (ví dụ lỗi E11000 user_1 của giỏ hàng), rồi tạo lại index đúng theo model.
 *   2. Các bước chạy đúng thứ tự phụ thuộc: tài khoản -> sản phẩm -> đơn hàng/thanh toán -> phần còn lại.
 *   3. Ảnh sản phẩm tải về MỘT LẦN, lưu trong uploads/seed (kèm library.json). Các lần sau dùng lại
 *      ảnh trên đĩa, không cần mạng hay PIXABAY_API_KEY, link ảnh không bao giờ hết hạn.
 *   4. Bước cuối kiểm tra chéo user / sản phẩm / đơn hàng / thanh toán / file ảnh và báo lỗi nếu lệch.
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { spawnSync } = require('child_process');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/nola2hand';
const ARGS = process.argv.slice(2);
const hasFlag = (n) => ARGS.includes(`--${n}`);
const getOpt = (n) => {
    const a = ARGS.find((x) => x.startsWith(`--${n}=`));
    return a ? a.slice(n.length + 3) : null;
};
const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

const isLocalUri = /^mongodb:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(URI);
const safeUri = URI.replace(/\/\/([^@/]+)@/, '//***@'); // ẩn user:password khi in ra

// ==========================================
// CÁC BƯỚC (theo thứ tự phụ thuộc)
// ==========================================
const STEPS = [
    { id: 'reset', title: 'Xóa sạch database và tạo lại index', fn: resetDatabase },
    { id: 'admin', title: 'Tài khoản admin', script: 'createAdmin.js' },
    { id: 'users', title: '20 người dùng + avatar', script: 'createMultipleUsers.js' },
    { id: 'shippers', title: '5 shipper', script: 'seed-shippers.js' },
    { id: 'demo', title: 'Tài khoản demo (seller / buyer / admin test)', script: 'createTestAccounts.js' },
    { id: 'vip', title: 'Gói thẻ VIP', script: 'scripts/seedVipPackages.js' },
    {
        id: 'products',
        title: '1000 sản phẩm + ảnh (tải 1 lần, lưu local)',
        script: 'seed_1000_products.js',
        env: { DOWNLOAD_IMAGES: process.env.DOWNLOAD_IMAGES || 'true' }
    },
    { id: 'orders', title: 'Đơn hàng + thanh toán (doanh thu tăng dần)', script: 'seed_payment.js' },
    { id: 'sample', title: 'Dữ liệu mẫu còn lại (đánh giá, bình luận, tin nhắn...)', script: 'seed_sample_data.js' },
    { id: 'reviews', title: 'Đánh giá demo độ tin cậy người bán', script: 'seed_demo_reviews.js', args: ['--no-ai'] },
    { id: 'follows', title: 'Đồng bộ follow', script: 'scripts/syncFollows.js' },
    { id: 'verify', title: 'Kiểm tra dữ liệu có đồng bộ', fn: verifyData }
];

// ==========================================
// TIỆN ÍCH
// ==========================================
const ask = (q) =>
    new Promise((resolve) => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question(q, (a) => { rl.close(); resolve(a.trim()); });
    });

const fmtMs = (ms) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`);
const vnd = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n)) + ' ₫';

function loadAllModels() {
    const dir = path.join(__dirname, 'models');
    for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.js')) require(path.join(dir, f));
    }
}

// ==========================================
// BƯỚC: XÓA DB + TẠO LẠI INDEX
// ==========================================
async function resetDatabase() {
    const mongoose = require('mongoose');
    await mongoose.connect(URI);
    const dbName = mongoose.connection.name;
    await mongoose.connection.dropDatabase();
    console.log(`🗑️  Đã xóa database "${dbName}"`);

    // Tạo lại collection + index theo schema. DB vừa bị xóa nên không còn index cũ để đồng bộ.
    // Một số model khai báo trùng một index (vd: unique ở trường + schema.index()) sẽ báo xung đột;
    // index unique quan trọng vẫn được tạo trước, nên chỉ cảnh báo và đi tiếp (giống khi chạy server).
    loadAllModels();
    const conflicts = [];
    for (const name of mongoose.modelNames()) {
        const m = mongoose.model(name);
        await m.createCollection().catch(() => {});
        try {
            await m.createIndexes();
        } catch (err) {
            conflicts.push(name);
        }
    }
    console.log(`🧱 Đã tạo lại ${mongoose.modelNames().length} collection và index`);
    if (conflicts.length) {
        console.log(`   ℹ️  Model khai báo trùng index (không ảnh hưởng, nên dọn sau): ${conflicts.join(', ')}`);
    }
    await mongoose.disconnect();
}

// ==========================================
// BƯỚC: KIỂM TRA TÍNH NHẤT QUÁN
// ==========================================
async function verifyData() {
    const mongoose = require('mongoose');
    await mongoose.connect(URI);
    const User = require('./models/User');
    const Product = require('./models/Product');
    const Order = require('./models/Order');
    const Payment = require('./models/Payment');

    const errors = [];
    const warns = [];
    const ok = (msg) => console.log(`   ✅ ${msg}`);
    const bad = (msg) => { errors.push(msg); console.log(`   ❌ ${msg}`); };
    const warn = (msg) => { warns.push(msg); console.log(`   ⚠️  ${msg}`); };

    const users = await User.find({}).select('_id').lean();
    const products = await Product.find({}).select('_id userId images status price').lean();
    const orders = await Order.find({}).select('_id productId buyerId sellerId finalPrice status').lean();
    const payments = await Payment.find({}).select('_id orderId amount status').lean();

    const userIds = new Set(users.map((u) => String(u._id)));
    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const orderMap = new Map(orders.map((o) => [String(o._id), o]));

    console.log(`   Người dùng: ${users.length} | Sản phẩm: ${products.length} | Đơn hàng: ${orders.length} | Thanh toán: ${payments.length}`);

    if (users.length === 0) bad('Không có người dùng nào');
    if (products.length === 0) bad('Không có sản phẩm nào');

    // --- Sản phẩm ---
    const noSeller = products.filter((p) => !userIds.has(String(p.userId)));
    noSeller.length ? bad(`${noSeller.length} sản phẩm có người bán không tồn tại`) : ok('Mọi sản phẩm đều có người bán hợp lệ');

    const noImage = products.filter((p) => !p.images || p.images.length === 0);
    noImage.length ? bad(`${noImage.length} sản phẩm không có ảnh`) : ok('Mọi sản phẩm đều có ảnh');

    // --- File ảnh local ---
    const localPaths = new Set();
    let external = 0;
    for (const p of products) {
        for (const img of p.images || []) {
            let pathname = null;
            if (img.startsWith('/uploads/')) pathname = img;
            else if (/^https?:\/\//i.test(img)) {
                try {
                    const u = new URL(img);
                    if (u.pathname.startsWith('/uploads/')) pathname = u.pathname;
                    else external++;
                } catch (_) { external++; }
            }
            if (pathname) localPaths.add(decodeURIComponent(pathname));
        }
    }
    const missingFiles = [...localPaths].filter((p) => !fs.existsSync(path.join(__dirname, p)));
    missingFiles.length
        ? bad(`${missingFiles.length} file ảnh local không tồn tại trên đĩa (vd: ${missingFiles[0]})`)
        : ok(`${localPaths.size} file ảnh local đều tồn tại trên đĩa`);
    if (external > 0) warn(`${external} ảnh dùng link ngoài (có thể hết hạn), nên tải về local`);

    // --- Đơn hàng ---
    const oNoProduct = orders.filter((o) => !productMap.has(String(o.productId)));
    oNoProduct.length ? bad(`${oNoProduct.length} đơn hàng trỏ tới sản phẩm không tồn tại`) : ok('Mọi đơn hàng đều có sản phẩm hợp lệ');

    const oNoUser = orders.filter((o) => !userIds.has(String(o.buyerId)) || !userIds.has(String(o.sellerId)));
    oNoUser.length ? bad(`${oNoUser.length} đơn hàng có người mua/bán không tồn tại`) : ok('Mọi đơn hàng đều có người mua và người bán hợp lệ');

    const oMismatch = orders.filter((o) => {
        const p = productMap.get(String(o.productId));
        return p && String(p.userId) !== String(o.sellerId);
    });
    oMismatch.length
        ? warn(`${oMismatch.length} đơn hàng có người bán khác chủ sản phẩm`)
        : ok('Người bán của đơn hàng luôn trùng chủ sản phẩm');

    // --- Thanh toán ---
    const pNoOrder = payments.filter((p) => !orderMap.has(String(p.orderId)));
    pNoOrder.length ? bad(`${pNoOrder.length} thanh toán trỏ tới đơn hàng không tồn tại`) : ok('Mọi thanh toán đều có đơn hàng hợp lệ');

    const amountMismatch = payments.filter((p) => {
        const o = orderMap.get(String(p.orderId));
        return o && Math.round(o.finalPrice) !== Math.round(p.amount);
    });
    amountMismatch.length
        ? warn(`${amountMismatch.length} thanh toán có số tiền khác giá đơn hàng (có thể do mã giảm giá)`)
        : ok('Số tiền thanh toán khớp giá đơn hàng');

    // --- Sản phẩm đã bán phải có đơn ---
    const orderedProducts = new Set(orders.map((o) => String(o.productId)));
    const soldNoOrder = products.filter((p) => p.status === 'Sold' && !orderedProducts.has(String(p._id)));
    soldNoOrder.length
        ? warn(`${soldNoOrder.length} sản phẩm "Sold" không có đơn hàng nào`)
        : ok('Mọi sản phẩm đã bán đều có đơn hàng');

    // --- Doanh thu ---
    const confirmed = payments.filter((p) => p.status === 'confirmed');
    const gmv = confirmed.reduce((s, p) => s + (p.amount || 0), 0);
    console.log(`   💰 ${confirmed.length} giao dịch đã xác nhận, tổng giá trị ${vnd(gmv)}, doanh thu sàn 5% ≈ ${vnd(gmv * 0.05)}`);
    if (confirmed.length === 0) warn('Chưa có giao dịch đã xác nhận nên trang doanh thu sẽ trống');

    await mongoose.disconnect();

    if (errors.length) {
        throw new Error(`Phát hiện ${errors.length} lỗi dữ liệu không đồng bộ (xem các dòng ❌ ở trên)`);
    }
    if (warns.length) console.log(`   (có ${warns.length} cảnh báo, không ảnh hưởng hoạt động)`);
}

// ==========================================
// CHẠY 1 BƯỚC
// ==========================================
function runScript(step) {
    const file = path.join(__dirname, step.script);
    if (!fs.existsSync(file)) {
        console.log(`   ⚠️  Không tìm thấy ${step.script}, bỏ qua bước này.`);
        return true;
    }
    const res = spawnSync(process.execPath, [file, ...(step.args || [])], {
        cwd: __dirname,
        stdio: 'inherit',
        env: { ...process.env, ...(step.env || {}) }
    });
    return res.status === 0;
}

function printAccounts() {
    console.log('\n🔑 TÀI KHOẢN ĐĂNG NHẬP');
    console.log('   Admin        : admin@nlu.edu.vn        / admin123456');
    console.log('   Người dùng   : 23120001@nlu.edu.vn ... 23120020@nlu.edu.vn / 123456');
    console.log('   Shipper      : shipper1@st.hcmuaf.edu.vn ... shipper5@... / 123456');
    console.log('   Demo         : seller_test@nlu.edu.vn, buyer_test@nlu.edu.vn, admin_test@nlu.edu.vn / 123456');
    console.log('\n👉 Database đã được tạo lại nên hãy ĐĂNG XUẤT rồi đăng nhập lại trên trình duyệt');
    console.log('   (phiên đăng nhập cũ trỏ tới user đã bị xóa).');
}

// ==========================================
// MAIN
// ==========================================
(async () => {
    if (hasFlag('list')) {
        STEPS.forEach((s, i) => console.log(`${String(i + 1).padStart(2)}. ${s.id.padEnd(9)} ${s.title}`));
        return;
    }

    const only = hasFlag('verify') ? ['verify'] : [];
    const from = getOpt('from');
    const skip = new Set(csv(getOpt('skip')));

    if (from && !STEPS.some((s) => s.id === from)) {
        console.error(`❌ Không có bước "${from}". Dùng --list để xem các bước.`);
        process.exit(1);
    }

    let plan = STEPS.filter((s) => !skip.has(s.id));
    if (only.length) plan = plan.filter((s) => only.includes(s.id));
    if (from) {
        const idx = STEPS.findIndex((s) => s.id === from);
        plan = plan.filter((s) => STEPS.indexOf(s) >= idx);
    }

    const willReset = plan.some((s) => s.id === 'reset');
    console.log('==============================================');
    console.log('  NOLA2HAND - NẠP LẠI DỮ LIỆU DEMO');
    console.log('==============================================');
    console.log(`Database: ${safeUri}`);

    if (willReset && !hasFlag('yes')) {
        if (!process.stdin.isTTY) {
            console.error('❌ Không thể hỏi xác nhận (không phải terminal). Thêm --yes để chạy tự động.');
            process.exit(1);
        }
        console.log('\n⚠️  CẢNH BÁO: sẽ XÓA SẠCH toàn bộ dữ liệu trong database này rồi tạo lại dữ liệu demo.');
        let answer;
        if (isLocalUri) {
            answer = (await ask('Gõ "yes" để tiếp tục: ')).toLowerCase();
            if (answer !== 'yes') { console.log('Đã hủy, không có gì bị thay đổi.'); return; }
        } else {
            const dbName = (URI.split('/').pop() || '').split('?')[0];
            console.log('   Đây KHÔNG phải MongoDB trên máy bạn (localhost).');
            answer = await ask(`Gõ đúng tên database "${dbName}" để xác nhận: `);
            if (answer !== dbName) { console.log('Đã hủy, không có gì bị thay đổi.'); return; }
        }
    }

    const started = Date.now();
    for (let i = 0; i < plan.length; i++) {
        const step = plan[i];
        console.log(`\n[${i + 1}/${plan.length}] ${step.title}`);
        console.log('----------------------------------------------');
        const t0 = Date.now();
        let ok = true;
        try {
            if (step.fn) await step.fn();
            else ok = runScript(step);
        } catch (err) {
            console.error(`\n❌ ${err.message}`);
            ok = false;
        }
        if (!ok) {
            console.error(`\n💥 Bước "${step.id}" bị lỗi, đã dừng.`);
            if (step.id !== 'reset' && step.id !== 'verify') {
                console.error(`   Sửa lỗi rồi chạy tiếp (không xóa lại DB):  node seed_all.js --from=${step.id}`);
            }
            process.exit(1);
        }
        console.log(`   ⏱️  ${fmtMs(Date.now() - t0)}`);
    }

    console.log('\n==============================================');
    console.log(`✨ HOÀN TẤT sau ${fmtMs(Date.now() - started)}`);
    console.log('==============================================');
    if (willReset) printAccounts();
    process.exit(0);
})().catch((err) => {
    console.error('❌ Lỗi không mong muốn:', err);
    process.exit(1);
});