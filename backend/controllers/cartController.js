const mongoose = require('mongoose')
const Cart = require('../models/Cart')
const Product = require('../models/Product') // đổi tên file nếu model sản phẩm của bạn đặt khác

// Lấy id người dùng từ middleware xác thực (hỗ trợ cả _id và id)
const getUserId = (req) => req.user._id || req.user.id

// Lấy giỏ của user, chưa có thì tạo mới
const getOrCreateCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId })
  if (!cart) cart = await Cart.create({ user: userId, items: [] })
  return cart
}

// Trả về danh sách sản phẩm trong giỏ (đã populate thông tin sản phẩm)
const sendCart = async (res, cart) => {
  await cart.populate('items.product', 'title price images status userId')
  // bỏ các sản phẩm đã bị xóa khỏi database
  const items = cart.items.filter((i) => i.product)
  res.json({ success: true, data: items })
}

// GET /api/cart
exports.getCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(getUserId(req))
    await sendCart(res, cart)
  } catch (error) {
    console.error('getCart error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// POST /api/cart   body: { productId }
exports.addToCart = async (req, res) => {
  try {
    const { productId } = req.body

    if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
      return res
        .status(400)
        .json({ success: false, message: 'productId không hợp lệ' })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: 'Không tìm thấy sản phẩm' })
    }

    // Không cho thêm sản phẩm của chính mình.
    // Đổi "seller" cho đúng tên trường người bán trong model Product của bạn.
    const userId = getUserId(req)
    if (product.seller && product.seller.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Bạn không thể thêm sản phẩm của chính mình vào giỏ'
      })
    }
    if (product.status !== 'Available') {
      return res.status(400).json({
        success: false,
        message: 'Sản phẩm này đã bán'
      })
    }

    const cart = await getOrCreateCart(userId)

    const existed = cart.items.some((i) => i.product.toString() === productId)
    if (!existed) {
      cart.items.push({ product: productId })
      await cart.save()
    }

    await sendCart(res, cart)
  } catch (error) {
    console.error('addToCart error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// DELETE /api/cart/:productId
exports.removeFromCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(getUserId(req))
    cart.items = cart.items.filter(
      (i) => i.product.toString() !== req.params.productId
    )
    await cart.save()
    await sendCart(res, cart)
  } catch (error) {
    console.error('removeFromCart error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}

// DELETE /api/cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await getOrCreateCart(getUserId(req))
    cart.items = []
    await cart.save()
    res.json({ success: true, data: [] })
  } catch (error) {
    console.error('clearCart error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}
