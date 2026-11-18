import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import {
    fetchCart,
    removeFromCart,
    clearCart
} from '../store/slices/cartSlice'
import BuyNowModal from '../components/BuyNowModal'

const formatPrice = (price) => {
    if (!price) return '0'
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

const PLACEHOLDER =
    'https://via.placeholder.com/300x300/cccccc/ffffff?text=No+Image'

export default function Cart() {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { items, loading, error } = useSelector((state) => state.cart)

    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [orderedIds, setOrderedIds] = useState([])

    // Tải lại giỏ mỗi khi mở trang để dữ liệu luôn mới nhất
    useEffect(() => {
        dispatch(fetchCart())
    }, [dispatch])

    // Bỏ các dòng mà sản phẩm đã bị xóa khỏi hệ thống
    const validItems = items.filter((i) => i.product)

    const checkoutItems = validItems.map((i) => ({ product: i.product }))
    const total = validItems.reduce((sum, i) => sum + (i.product.price || 0), 0)

    const handleCheckout = () => {
        setOrderedIds([])
        setCheckoutOpen(true)
    }

    const handleCloseCheckout = () => {
        orderedIds.forEach((id) => dispatch(removeFromCart(id)))
        setOrderedIds([])
        setCheckoutOpen(false)
    }

    const handleRemove = (productId) => dispatch(removeFromCart(productId))

    const handleClear = () => {
        if (window.confirm('Bạn có chắc muốn xóa toàn bộ giỏ hàng?')) {
            dispatch(clearCart())
        }
    }


    const handleOrderCreated = () => {
        dispatch(clearCart())      // đặt hàng xong mới xóa giỏ
        setCheckoutOpen(false)
        navigate('/orders')        // đổi thành route "Đơn mua" của bạn
    }


    // Đang tải lần đầu
    if (loading && validItems.length === 0) {
        return (
            <div className="py-20 text-center text-gray-600 dark:text-gray-300">
                Đang tải giỏ hàng...
            </div>
        )
    }

    // Giỏ trống
    if (validItems.length === 0) {
        return (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center">
                <div className="text-6xl mb-4">🛒</div>
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                    Giỏ hàng của bạn đang trống
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                    Hãy khám phá các sản phẩm và thêm món bạn thích vào giỏ nhé.
                </p>
                <Link
                    to="/products"
                    className="inline-block bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                >
                    Xem sản phẩm
                </Link>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-6">
            {/* Tiêu đề */}
            <div className="flex items-end justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                        Giỏ hàng
                    </h1>
                    <div className="h-1.5 w-16 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full mt-2"></div>
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                    {validItems.length} sản phẩm
                </span>
            </div>

            {error && (
                <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Danh sách sản phẩm */}
                <div className="lg:col-span-2 space-y-3">
                    {validItems.map(({ product }) => (
                        <div
                            key={product._id}
                            className="flex items-center gap-4 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow"
                        >
                            <Link
                                to={`/products/${product._id}`}
                                className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
                            >
                                <img
                                    src={product.images?.[0] || PLACEHOLDER}
                                    alt={product.title}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        e.target.src = PLACEHOLDER
                                    }}
                                />
                            </Link>

                            <div className="flex-1 min-w-0">
                                <Link
                                    to={`/products/${product._id}`}
                                    className="block font-semibold text-gray-800 dark:text-gray-100 line-clamp-2 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                                >
                                    {product.title}
                                </Link>
                                <p className="mt-1 text-lg font-bold text-orange-500">
                                    {formatPrice(product.price)} VNĐ
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleRemove(product._id)}
                                aria-label="Xóa khỏi giỏ hàng"
                                title="Xóa khỏi giỏ hàng"
                                className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                </svg>
                            </button>
                        </div>
                    ))}

                    <button
                        type="button"
                        onClick={handleClear}
                        className="text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    >
                        Xóa tất cả
                    </button>
                </div>

                {/* Tóm tắt đơn hàng */}
                <div className="lg:col-span-1">
                    <div className="sticky top-28 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-5 shadow-sm">
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                            Tóm tắt đơn hàng
                        </h2>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-gray-600 dark:text-gray-300">
                                <span>Số sản phẩm</span>
                                <span>{validItems.length}</span>
                            </div>
                            <div className="flex justify-between text-gray-600 dark:text-gray-300">
                                <span>Tạm tính</span>
                                <span>{formatPrice(total)} VNĐ</span>
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700 my-4"></div>

                        <div className="flex justify-between items-center mb-5">
                            <span className="font-semibold text-gray-800 dark:text-gray-100">
                                Tổng cộng
                            </span>
                            <span className="text-xl font-extrabold text-orange-500">
                                {formatPrice(total)} VNĐ
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckout}
                            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 rounded-lg transition-colors"
                        >
                            Thanh toán
                        </button>

                        <Link
                            to="/products"
                            className="block text-center mt-3 text-sm text-gray-500 dark:text-gray-400 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                        >
                            ← Tiếp tục xem sản phẩm
                        </Link>
                    </div>
                </div>
            </div>
            <BuyNowModal
                items={checkoutItems}
                isOpen={checkoutOpen}
                onClose={handleCloseCheckout}
                onItemsOrdered={setOrderedIds}
                onOrderCreated={() => navigate('/orders?type=buying')}
            />
        </div>
    )
}