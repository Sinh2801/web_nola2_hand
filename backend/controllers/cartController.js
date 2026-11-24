const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Coupon = require('../models/Coupon');

const MAX_CART_ITEMS = 50;

// Tạo dữ liệu trả về cho client: kèm trạng thái còn hàng / đổi giá của từng sản phẩm
const buildCartResponse = async (userId) => {
    const cart = await Cart.findOne({ userId }).populate({
        path: 'items.productId',
        select: 'title price images category condition location status isApproved userId',
        populate: { path: 'userId', select: 'name avatar vipSellerUntil' }
    });

    const items = [];
    for (const it of (cart?.items || [])) {
        const p = it.productId;

        // Sản phẩm đã bị xóa khỏi hệ thống
        if (!p) {
            items.push({
                productId: null,
                product: null,
                priceAtAdd: it.priceAtAdd,
                addedAt: it.addedAt,
                available: false,
                unavailableReason: 'removed',
                priceChanged: false,
                priceDiff: 0,
                _rawId: it._id
            });
            continue;
        }

        let unavailableReason = null;
        if (p.status === 'Deleted') unavailableReason = 'removed';
        else if (p.status === 'Sold') unavailableReason = 'sold';
        else if (!p.isApproved) unavailableReason = 'unavailable';
        else if (p.userId && String(p.userId._id) === String(userId)) unavailableReason = 'own';

        const priceDiff = (p.price ?? 0) - (it.priceAtAdd ?? 0);

        items.push({
            productId: p._id,
            product: {
                _id: p._id,
                title: p.title,
                price: p.price,
                images: p.images,
                category: p.category,
                condition: p.condition,
                location: p.location,
                status: p.status,
                seller: p.userId
                    ? { _id: p.userId._id, name: p.userId.name, avatar: p.userId.avatar, vipSellerUntil: p.userId.vipSellerUntil }
                    : null
            },
            priceAtAdd: it.priceAtAdd,
            addedAt: it.addedAt,
            available: !unavailableReason,
            unavailableReason,
            priceChanged: priceDiff !== 0,
            priceDiff
        });
    }

    return {
        items,
        count: items.length,
        availableCount: items.filter((i) => i.available).length
    };
};

// @desc    Lấy giỏ hàng
// @route   GET /api/cart
// @access  Private
exports.getCart = async (req, res) => {
    try {
        const data = await buildCartResponse(req.user.id);
        res.json({ success: true, data });
    } catch (error) {
        console.error('getCart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Thêm sản phẩm vào giỏ
// @route   POST /api/cart/items
// @access  Private
exports.addItem = async (req, res) => {
    try {
        const { productId } = req.body;
        const userId = req.user.id;

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Sản phẩm không hợp lệ' });
        }

        const product = await Product.findById(productId);
        if (!product || product.status === 'Deleted') {
            return res.status(404).json({ success: false, message: 'Sản phẩm không tồn tại' });
        }
        if (String(product.userId) === String(userId)) {
            return res.status(400).json({ success: false, message: 'Bạn không thể thêm sản phẩm của chính mình vào giỏ' });
        }
        if (product.status !== 'Available') {
            return res.status(400).json({ success: false, message: 'Sản phẩm này đã được bán' });
        }
        if (!product.isApproved) {
            return res.status(400).json({ success: false, message: 'Sản phẩm chưa được duyệt' });
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) cart = new Cart({ userId, items: [] });

        const exists = cart.items.some((i) => String(i.productId) === String(productId));
        if (exists) {
            const data = await buildCartResponse(userId);
            return res.json({ success: true, alreadyInCart: true, message: 'Sản phẩm đã có trong giỏ hàng', data });
        }

        if (cart.items.length >= MAX_CART_ITEMS) {
            return res.status(400).json({ success: false, message: `Giỏ hàng tối đa ${MAX_CART_ITEMS} sản phẩm` });
        }

        cart.items.push({ productId, priceAtAdd: product.price });
        await cart.save();

        const data = await buildCartResponse(userId);
        res.status(201).json({ success: true, message: 'Đã thêm vào giỏ hàng', data });
    } catch (error) {
        console.error('addItem error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa 1 sản phẩm khỏi giỏ
// @route   DELETE /api/cart/items/:productId
// @access  Private
exports.removeItem = async (req, res) => {
    try {
        const { productId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: 'Sản phẩm không hợp lệ' });
        }
        // Nhận cả productId lẫn _id của dòng trong giỏ (sản phẩm đã bị xóa khỏi hệ thống chỉ còn _id dòng)
        const cart = await Cart.findOne({ userId: req.user.id });
        if (cart) {
            cart.items = cart.items.filter(
                (i) => String(i.productId) !== String(productId) && String(i._id) !== String(productId)
            );
            await cart.save();
        }
        const data = await buildCartResponse(req.user.id);
        res.json({ success: true, message: 'Đã xóa khỏi giỏ hàng', data });
    } catch (error) {
        console.error('removeItem error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa nhiều sản phẩm khỏi giỏ (xóa đã chọn / xóa sản phẩm đã bán / sau khi đặt hàng)
// @route   POST /api/cart/remove
// @access  Private
exports.removeMany = async (req, res) => {
    try {
        const { productIds = [], unavailable = false } = req.body;
        const userId = req.user.id;

        const ids = (Array.isArray(productIds) ? productIds : []).filter((id) => mongoose.Types.ObjectId.isValid(id));

        if (unavailable) {
            // Xóa tất cả sản phẩm không còn khả dụng (đã bán / bị gỡ / chưa duyệt)
            const cart = await Cart.findOne({ userId });
            if (cart && cart.items.length) {
                const products = await Product.find({ _id: { $in: cart.items.map((i) => i.productId) } })
                    .select('status isApproved userId');
                const okIds = new Set(
                    products
                        .filter((p) => p.status === 'Available' && p.isApproved && String(p.userId) !== String(userId))
                        .map((p) => String(p._id))
                );
                cart.items = cart.items.filter((i) => okIds.has(String(i.productId)));
                await cart.save();
            }
        } else if (ids.length) {
            await Cart.updateOne({ userId }, { $pull: { items: { productId: { $in: ids } } } });
        }

        const data = await buildCartResponse(userId);
        res.json({ success: true, data });
    } catch (error) {
        console.error('removeMany error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Xóa toàn bộ giỏ
// @route   DELETE /api/cart
// @access  Private
exports.clearCart = async (req, res) => {
    try {
        await Cart.updateOne({ userId: req.user.id }, { $set: { items: [] } });
        const data = await buildCartResponse(req.user.id);
        res.json({ success: true, message: 'Đã xóa toàn bộ giỏ hàng', data });
    } catch (error) {
        console.error('clearCart error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================================
// MÃ GIẢM GIÁ TRONG GIỎ HÀNG
// Mỗi sản phẩm là một đơn riêng và mỗi mã chỉ dùng được 1 lần cho mỗi lần đặt hàng,
// nên mã được áp dụng cho MỘT sản phẩm phù hợp nhất (giảm nhiều nhất) trong số các sản phẩm đã chọn.
// Dùng lại đúng các hàm validateCoupon / calculateDiscount của model Coupon,
// cùng cách quy đổi danh mục như orderController.createDirectOrder.
// ==========================================================
const CATEGORY_TO_COUPON = {
    'Sách': 'Books',
    'Điện tử': 'Electronics',
    'Nội thất': 'Furniture',
    'Quần áo': 'Clothing',
    'Văn phòng phẩm': 'Stationery',
    'Thể thao': 'Sports',
    'Khác': 'Other'
};
const toCouponCategory = (c) => CATEGORY_TO_COUPON[c] || 'Other';

// Lấy các sản phẩm còn bán trong danh sách đã chọn (bỏ sản phẩm của chính mình)
const loadSelectedProducts = async (userId, productIds) => {
    const ids = (Array.isArray(productIds) ? productIds : []).filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!ids.length) return [];
    const products = await Product.find({ _id: { $in: ids }, status: 'Available', isApproved: true })
        .select('title price category userId');
    return products.filter((p) => String(p.userId) !== String(userId));
};

// Đánh giá 1 mã với các sản phẩm đã chọn
const evaluateCoupon = (coupon, userId, products) => {
    if (!products.length) {
        return { eligible: false, discountAmount: 0, targetProductId: null, targetTitle: null, reason: 'Hãy chọn sản phẩm để áp dụng mã' };
    }

    let best = null;
    const failures = []; // { product, errors }
    for (const p of products) {
        const v = coupon.validateCoupon(userId, p.price, toCouponCategory(p.category));
        if (v.isValid) {
            const discount = coupon.calculateDiscount(p.price);
            if (!best || discount > best.discountAmount) best = { product: p, discountAmount: discount };
        } else {
            failures.push({ product: p, errors: v.errors });
        }
    }

    if (best && best.discountAmount > 0) {
        return {
            eligible: true,
            discountAmount: best.discountAmount,
            targetProductId: best.product._id,
            targetTitle: best.product.title,
            reason: null
        };
    }

    // Không sản phẩm nào đủ điều kiện: chọn lý do dễ hiểu nhất
    const isCategoryErr = (e) => e.includes('danh mục');
    const passCategory = failures.filter((f) => !f.errors.some(isCategoryErr));
    let reason;
    if (passCategory.length) {
        const top = passCategory.sort((a, b) => b.product.price - a.product.price)[0];
        reason = top.errors[0];
    } else {
        reason = 'Mã không áp dụng cho danh mục của các sản phẩm đã chọn';
    }
    return { eligible: false, discountAmount: 0, targetProductId: null, targetTitle: null, reason };
};

const couponView = (coupon, ev) => ({
    _id: coupon._id,
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    description: coupon.description,
    minPurchase: coupon.minPurchase,
    maxDiscount: coupon.maxDiscount,
    expiryDate: coupon.expiryDate,
    applicableCategories: coupon.applicableCategories || [],
    ...ev
});

const userAllowed = (coupon, userId) =>
    !coupon.applicableUsers || coupon.applicableUsers.length === 0 ||
    coupon.applicableUsers.some((id) => String(id) === String(userId));

// @desc    Danh sách mã giảm giá kèm khả năng áp dụng với các sản phẩm đã chọn
// @route   POST /api/cart/coupons/evaluate
// @access  Private
exports.evaluateCoupons = async (req, res) => {
    try {
        const userId = req.user.id;
        const products = await loadSelectedProducts(userId, req.body.productIds);

        const coupons = await Coupon.find({
            isActive: true,
            expiryDate: { $gt: new Date() },
            $or: [{ usageLimit: null }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }]
        }).sort({ createdAt: -1 });

        const data = coupons
            .filter((c) => userAllowed(c, userId))
            .map((c) => couponView(c, evaluateCoupon(c, userId, products)))
            .sort((a, b) => {
                if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
                if (a.eligible) return b.discountAmount - a.discountAmount;
                return new Date(a.expiryDate) - new Date(b.expiryDate);
            });

        res.json({ success: true, data });
    } catch (error) {
        console.error('evaluateCoupons error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Áp dụng 1 mã (nhập tay hoặc chọn) cho các sản phẩm đã chọn
// @route   POST /api/cart/coupons/apply
// @access  Private
exports.applyCoupon = async (req, res) => {
    try {
        const userId = req.user.id;
        const code = String(req.body.code || '').trim().toUpperCase();
        if (!code) {
            return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá' });
        }

        const coupon = await Coupon.findOne({ code });
        if (!coupon) {
            return res.status(404).json({ success: false, message: 'Mã giảm giá không tồn tại' });
        }
        if (!coupon.isActive) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá đã bị vô hiệu hóa' });
        }
        if (coupon.expiryDate <= new Date()) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết hạn' });
        }
        if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ success: false, message: 'Mã giảm giá đã hết lượt sử dụng' });
        }
        if (!userAllowed(coupon, userId)) {
            return res.status(400).json({ success: false, message: 'Bạn không có quyền sử dụng mã giảm giá này' });
        }

        const products = await loadSelectedProducts(userId, req.body.productIds);
        const ev = evaluateCoupon(coupon, userId, products);
        if (!ev.eligible) {
            return res.status(400).json({ success: false, message: ev.reason || 'Mã giảm giá không áp dụng được' });
        }

        res.json({ success: true, message: 'Áp dụng mã giảm giá thành công', data: couponView(coupon, ev) });
    } catch (error) {
        console.error('applyCoupon error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};