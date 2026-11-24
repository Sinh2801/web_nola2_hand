import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { addToCart } from '../store/slices/cartSlice'
import { useToast } from '../context/ToastContext'

const CartIcon = ({ className = 'w-5 h-5' }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 3h2l.4 2M7 13h10l3-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
        />
    </svg>
)

/**
 * Nút "Thêm vào giỏ hàng". Đồ 2hand mỗi món chỉ có 1 chiếc nên không có số lượng:
 * thêm rồi thì nút chuyển thành "Đã trong giỏ - Xem giỏ hàng".
 */
export default function AddToCartButton({ productId, className = '' }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { addToast } = useToast()
    const { user } = useSelector((state) => state.auth)
    const items = useSelector((state) => state.cart.items)
    const [loading, setLoading] = useState(false)

    const inCart = items.some((i) => String(i.productId) === String(productId))

    const handleClick = async () => {
        if (!user) {
            addToast('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng', 'warning')
            navigate('/login')
            return
        }
        if (inCart) {
            navigate('/cart')
            return
        }
        setLoading(true)
        try {
            const res = await dispatch(addToCart(productId)).unwrap()
            addToast(res.message || 'Đã thêm vào giỏ hàng', res.alreadyInCart ? 'info' : 'success')
        } catch (message) {
            addToast(typeof message === 'string' ? message : 'Không thể thêm vào giỏ hàng', 'error')
        } finally {
            setLoading(false)
        }
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className={`w-full px-6 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${
                inCart
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-2 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
                    : 'bg-white dark:bg-gray-800 text-orange-600 dark:text-orange-400 border-2 border-orange-500 hover:bg-orange-50 dark:hover:bg-gray-700 hover:-translate-y-0.5'
            } ${className}`}
        >
            {inCart ? (
                <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    Đã trong giỏ · Xem giỏ hàng
                </>
            ) : (
                <>
                    <CartIcon />
                    {loading ? 'Đang thêm...' : 'Thêm vào giỏ hàng'}
                </>
            )}
        </button>
    )
}