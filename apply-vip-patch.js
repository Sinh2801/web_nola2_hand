#!/usr/bin/env node
/**
 * Áp dụng tính năng Thẻ VIP lên các file cũ của project nlu_nola3_hand.
 * Chạy ở THƯ MỤC GỐC project (nơi có backend/ và frontend/):
 *     node apply-vip-patch.js
 * - Kiểm tra toàn bộ trước, chỉ ghi file khi mọi thay đổi đều khớp (không sửa dở).
 * - Chạy lại lần 2 an toàn: phần nào đã áp dụng sẽ được bỏ qua.
 * - Giữ nguyên kiểu xuống dòng (CRLF/LF) của từng file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const norm = (s) => s.replace(/\r\n/g, '\n');
const files = new Map(); // file -> { text, crlf, changed }

function get(file) {
    if (!files.has(file)) {
        const full = path.join(ROOT, file);
        if (!fs.existsSync(full)) throw new Error(`Không thấy file ${file}. Hãy chạy script ở thư mục gốc project.`);
        const raw = fs.readFileSync(full, 'utf8');
        files.set(file, { text: norm(raw), crlf: raw.includes('\r\n'), changed: false });
    }
    return files.get(file);
}

const log = [];
function rep(file, oldStr, newStr, count = 1) {
    const f = get(file);
    if (f.text.includes(newStr)) { log.push(`  bỏ qua (đã có): ${file}`); return; }
    const n = f.text.split(oldStr).length - 1;
    if (n !== count) throw new Error(`${file}: cần ${count} vị trí khớp nhưng thấy ${n}:\n${oldStr.slice(0, 120)}`);
    f.text = f.text.split(oldStr).join(newStr);
    f.changed = true;
    log.push(`  đã sửa: ${file}`);
}

const OPS = [
    {
        "file": "backend/models/Product.js",
        "old": "  moderationReason: {\n    type: String,\n    default: null\n  }\n}, {",
        "new": "  moderationReason: {\n    type: String,\n    default: null\n  },\n  // ── Thẻ VIP ──\n  vipPinnedUntil: { type: Date, default: null },     // còn hạn: sản phẩm được ghim lên đầu danh sách\n  vipPinnedAt: { type: Date, default: null },        // lần gắn thẻ gần nhất, dùng để xếp thứ tự giữa các tin ghim\n  vipHighlightUntil: { type: Date, default: null }   // còn hạn: hiện viền + huy hiệu \"Nổi bật\"\n}, {",
        "count": 1
    },
    {
        "file": "backend/models/Product.js",
        "old": "productSchema.index({ createdAt: -1 });",
        "new": "productSchema.index({ createdAt: -1 });\nproductSchema.index({ vipPinnedUntil: 1, vipPinnedAt: -1 });",
        "count": 1
    },
    {
        "file": "backend/server.js",
        "old": "const sellerBankQRRoutes = require('./routes/sellerBankQR');",
        "new": "const sellerBankQRRoutes = require('./routes/sellerBankQR');\nconst vipRoutes = require('./routes/vip');",
        "count": 1
    },
    {
        "file": "backend/server.js",
        "old": "app.use('/api/seller-bankqr', sellerBankQRRoutes);",
        "new": "app.use('/api/seller-bankqr', sellerBankQRRoutes);\napp.use('/api/vip', vipRoutes);",
        "count": 1
    },
    {
        "file": "backend/controllers/productController.js",
        "old": "    const products = await Product.find(query)\n      .sort(sortOption)\n      .skip(skip)\n      .limit(Number(limit))\n      .populate('userId', 'name avatar')\n      .select('-__v');\n\n    const total = await Product.countDocuments(query);",
        "new": "    // Sản phẩm đang có thẻ VIP \"ghim\" luôn nằm đầu khi xem mặc định (mới nhất).\n    // Các kiểu sắp xếp khác (giá, đánh giá, phổ biến...) giữ nguyên để kết quả công bằng.\n    const pinFirst = !sort || sort === 'newest' || sort === '-createdAt' || (sort === 'relevance' && !search);\n    const lim = Number(limit);\n    let products;\n\n    if (pinFirst) {\n      const now = new Date();\n      const pinnedQuery = { ...query, vipPinnedUntil: { $gt: now } };\n      const pinnedCount = await Product.countDocuments(pinnedQuery);\n      products = [];\n\n      if (skip < pinnedCount) {\n        products = await Product.find(pinnedQuery)\n          .sort({ vipPinnedAt: -1 })\n          .skip(skip)\n          .limit(lim)\n          .populate('userId', 'name avatar')\n          .select('-__v');\n      }\n\n      const need = lim - products.length;\n      if (need > 0) {\n        const regular = await Product.find({ ...query, $nor: [{ vipPinnedUntil: { $gt: now } }] })\n          .sort(sortOption)\n          .skip(Math.max(0, skip - pinnedCount))\n          .limit(need)\n          .populate('userId', 'name avatar')\n          .select('-__v');\n        products = products.concat(regular);\n      }\n    } else {\n      products = await Product.find(query)\n        .sort(sortOption)\n        .skip(skip)\n        .limit(lim)\n        .populate('userId', 'name avatar')\n        .select('-__v');\n    }\n\n    const total = await Product.countDocuments(query);",
        "count": 1
    },
    {
        "file": "backend/controllers/paymentController.js",
        "old": "const vnpayUtil = require('../utils/vnpay');",
        "new": "const vnpayUtil = require('../utils/vnpay');\nconst vipController = require('./vipController');",
        "count": 1
    },
    {
        "file": "backend/controllers/paymentController.js",
        "old": "    const payment = await Payment.findOne({ vnpayTxnRef: verify.vnp_TxnRef });\n    if (!payment) return res.json(IPN.IpnOrderNotFound);",
        "new": "    const payment = await Payment.findOne({ vnpayTxnRef: verify.vnp_TxnRef });\n    if (!payment) {\n      // Không phải đơn hàng thường: có thể là đơn mua thẻ VIP\n      const vipResponse = await vipController.handleVnpayIpn(verify, req.app.get('io'));\n      return res.json(vipResponse || IPN.IpnOrderNotFound);\n    }",
        "count": 1
    },
    {
        "file": "backend/controllers/paymentController.js",
        "old": "    const payment = await Payment.findOne({ vnpayTxnRef: verify.vnp_TxnRef });\n    if (!payment || payment.buyerId.toString() !== req.user.id)",
        "new": "    const payment = await Payment.findOne({ vnpayTxnRef: verify.vnp_TxnRef });\n    if (!payment) {\n      const vipStatus = await vipController.getVnpayStatusForUser(verify, req.user.id, req.app.get('io'));\n      if (vipStatus) return res.json({ success: true, data: vipStatus });\n    }\n    if (!payment || payment.buyerId.toString() !== req.user.id)",
        "count": 1
    },
    {
        "file": "frontend/src/App.jsx",
        "old": "import PaymentResult from './pages/PaymentResult.jsx';",
        "new": "import PaymentResult from './pages/PaymentResult.jsx';\nimport VipStore from './pages/VipStore'\nimport VipManagement from './pages/VipManagement'",
        "count": 1
    },
    {
        "file": "frontend/src/App.jsx",
        "old": "          <Route path=\"/shipper\" element={<ShipperDashboard />} />\n",
        "new": "          <Route path=\"/shipper\" element={<ShipperDashboard />} />\n          <Route path=\"/vip\" element={<VipStore />} />\n",
        "count": 1
    },
    {
        "file": "frontend/src/App.jsx",
        "old": "          <Route path=\"/admin/revenue\" element={<RevenueStats />} />\n",
        "new": "          <Route path=\"/admin/revenue\" element={<RevenueStats />} />\n          <Route path=\"/admin/vip\" element={<VipManagement />} />\n",
        "count": 1
    },
    {
        "file": "frontend/src/components/ProfileDropdown.jsx",
        "old": "                <span className=\"text-gray-800 dark:text-gray-200\">Ưu đãi của tôi</span>\n              </Link>\n",
        "new": "                <span className=\"text-gray-800 dark:text-gray-200\">Ưu đãi của tôi</span>\n              </Link>\n              <Link\n                to=\"/vip\"\n                onClick={() => setIsOpen(false)}\n                className=\"flex items-center p-3 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors\"\n              >\n                <div className=\"w-5 h-5 bg-orange-500 rounded mr-3 flex items-center justify-center\">\n                  <span className=\"text-xs\">👑</span>\n                </div>\n                <span className=\"text-gray-800 dark:text-gray-200\">Thẻ VIP đẩy tin</span>\n              </Link>\n",
        "count": 1
    },
    {
        "file": "frontend/src/pages/PaymentResult.jsx",
        "old": "    const v = VIEWS[state];\n",
        "new": "    const v = VIEWS[state];\n    const isVip = info?.kind === 'vip';\n    const VIP_DESC = {\n        success: 'Thẻ VIP đã được kích hoạt. Vào \"Thẻ của tôi\" để gắn thẻ cho sản phẩm.',\n        pending: 'Giao dịch chưa thành công. Bạn có thể quay lại cửa hàng thẻ để mua lại.',\n        cancelled: 'Bạn đã hủy giao dịch. Bạn có thể quay lại cửa hàng thẻ để mua lại.',\n        expired: 'Giao dịch đã hết hạn. Bạn có thể quay lại cửa hàng thẻ để mua lại.',\n    };\n",
        "count": 1
    },
    {
        "file": "frontend/src/pages/PaymentResult.jsx",
        "old": "{v.desc && <p className=\"text-sm text-gray-600 dark:text-gray-400 mb-4\">{v.desc}</p>}",
        "new": "{v.desc && <p className=\"text-sm text-gray-600 dark:text-gray-400 mb-4\">{isVip ? (VIP_DESC[state] || v.desc) : v.desc}</p>}",
        "count": 1
    },
    {
        "file": "frontend/src/pages/PaymentResult.jsx",
        "old": "                        <Link\n                            to=\"/orders?type=buying\"\n                            className=\"bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-xl\"\n                        >\n                            Xem đơn mua của tôi\n                        </Link>",
        "new": "                        <Link\n                            to={isVip ? '/vip?tab=cards' : '/orders?type=buying'}\n                            className=\"bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-xl\"\n                        >\n                            {isVip ? 'Xem thẻ của tôi' : 'Xem đơn mua của tôi'}\n                        </Link>",
        "count": 1
    },
    {
        "file": "frontend/src/pages/Products.jsx",
        "old": "import api from '../utils/api'\n",
        "new": "import api from '../utils/api'\nimport VipBadge, { vipCardClass } from '../components/VipBadge'\n",
        "count": 1
    },
    {
        "file": "frontend/src/pages/Products.jsx",
        "old": "                  <div className=\"bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full relative\">\n",
        "new": "                  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full relative ${vipCardClass(product)}`}>\n                    <VipBadge product={product} />\n",
        "count": 1
    },
    {
        "file": "frontend/src/pages/Home.jsx",
        "old": "import api from '../utils/api'\n",
        "new": "import api from '../utils/api'\nimport VipBadge, { vipCardClass } from '../components/VipBadge'\n",
        "count": 1
    },
    {
        "file": "frontend/src/components/Layout.jsx",
        "old": "import Chatbot from './Chatbot'\n",
        "new": "import Chatbot from './Chatbot'\nimport VipMarquee from './VipMarquee'\n",
        "count": 1
    },
    {
        "file": "frontend/src/components/Layout.jsx",
        "old": "    <div className=\"min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300\">\n      {/* Navbar */}",
        "new": "    <div className=\"min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300\">\n      {/* Dải chữ chạy quảng bá thẻ VIP (ẩn với shipper và ở trang mua thẻ / kết quả thanh toán) */}\n      {!(user?.isShipper && user?.shipperStatus === 'approved') &&\n        !location.pathname.startsWith('/vip') &&\n        !location.pathname.startsWith('/payment') && <VipMarquee />}\n      {/* Navbar */}",
        "count": 1
    },
    {
        "file": "frontend/src/components/Layout.jsx",
        "old": "import { Link, useNavigate } from 'react-router-dom'\n",
        "new": "import { Link, useNavigate, useLocation } from 'react-router-dom'\n",
        "count": 1
    },
    {
        "file": "frontend/src/components/Layout.jsx",
        "old": "  const navigate = useNavigate()\n",
        "new": "  const navigate = useNavigate()\n  const location = useLocation()\n",
        "count": 1
    }
];;

try {
    for (const o of OPS) rep(o.file, o.old, o.new, o.count);

    // Nút "Quản lý thẻ VIP" ở AdminDashboard (dùng lại class của nút Thống kê doanh thu)
    {
        const file = 'frontend/src/pages/AdminDashboard.jsx';
        const f = get(file);
        if (f.text.includes('to="/admin/vip"')) log.push(`  bỏ qua (đã có): ${file}`);
        else {
            const re = /( *)<Link to="\/admin\/revenue" className="([^"]+)">\n *<span>📊<\/span> Thống kê doanh thu\n *<\/Link>\n/;
            const m = f.text.match(re);
            if (!m) throw new Error(`${file}: không thấy nút "Thống kê doanh thu" để chèn nút VIP`);
            const ind = m[1];
            const add = `${ind}<Link to="/admin/vip" className="${m[2]}">\n${ind}  <span>👑</span> Quản lý thẻ VIP\n${ind}</Link>\n`;
            f.text = f.text.slice(0, m.index + m[0].length) + add + f.text.slice(m.index + m[0].length);
            f.changed = true;
            log.push(`  đã sửa: ${file}`);
        }
    }

    // Home.jsx: huy hiệu VIP + viền nổi bật trên 2 khối thẻ sản phẩm
    {
        const file = 'frontend/src/pages/Home.jsx';
        const f = get(file);
        if (f.text.includes('<VipBadge product={product} />')) log.push(`  bỏ qua (đã có): ${file} (thẻ sản phẩm)`);
        else {
            const re = /( *)<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full">\n/g;
            let count = 0;
            f.text = f.text.replace(re, (_, i) => {
                count++;
                return `${i}<div className={\`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow flex flex-col h-full relative \${vipCardClass(product)}\`}>\n${i}  <VipBadge product={product} />\n`;
            });
            if (count !== 2) throw new Error(`${file}: cần 2 thẻ sản phẩm nhưng thấy ${count}`);
            f.changed = true;
            log.push(`  đã sửa: ${file} (2 thẻ sản phẩm)`);
        }
    }

    // Mọi thứ khớp -> ghi file
    let written = 0;
    for (const [file, f] of files) {
        if (!f.changed) continue;
        fs.writeFileSync(path.join(ROOT, file), f.crlf ? f.text.replace(/\n/g, '\r\n') : f.text, 'utf8');
        written++;
    }
    console.log(log.join('\n'));
    console.log(`\nXong. Đã ghi ${written} file.`);
} catch (e) {
    console.error('\nLỖI: ' + e.message + '\nKhông có file nào bị thay đổi.');
    process.exit(1);
}