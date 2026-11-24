import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchCart, removeFromCart, removeManyFromCart } from '../store/slices/cartSlice'
import { addToFavorites } from '../store/slices/userSlice'
import api from '../utils/api'
import { useToast } from '../context/ToastContext'
import { useConfirm } from '../components/ConfirmModal'
import SellerTrustCard from '../components/SellerTrustCard'
import CartCheckoutModal from '../components/CartCheckoutModal'
import CouponPicker from '../components/CouponPicker'
import { formatVND, conditionLabel, locationLabel, timeAgo } from '../utils/format'

const REASON_TEXT = {
    sold: 'Đã bán',
    removed: 'Đã bị gỡ',
    unavailable: 'Không khả dụng',
    own: 'Sản phẩm của bạn'
}

const isVipActive = (d) => !!d && new Date(d) > new Date()

/* ====================== Thành phần nhỏ ====================== */

function Checkbox({ checked, indeterminate = false, onChange, disabled = false, label }) {
    const ref = useRef(null)
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate && !checked
    }, [indeterminate, checked])
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            aria-label={label}
            className="h-5 w-5 shrink-0 rounded-md border-gray-300 dark:border-gray-600 text-orange-500 focus:ring-orange-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        />
    )
}

function Thumb({ product, className = 'w-24 h-24' }) {
    const src = product?.images?.[0]
    return src ? (
        <img src={src} alt={product.title} className={`${className} rounded-xl object-cover bg-gray-100 dark:bg-gray-700`} />
    ) : (
        <div className={`${className} rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl`}>📦</div>
    )
}

function CartItem({ item, checked, onToggle, onRemove, onFavorite, busy }) {
    const p = item.product
    const disabled = !item.available
    const reason = REASON_TEXT[item.unavailableReason] || 'Không khả dụng'

    return (
        <div className={`flex gap-3 sm:gap-4 py-4 ${disabled ? 'opacity-70' : ''}`}>
            <div className="pt-1">
                <Checkbox checked={checked} disabled={disabled} onChange={onToggle} label={`Chọn ${p?.title || 'sản phẩm'}`} />
            </div>

            {p ? (
                <Link to={`/products/${p._id}`} className="relative shrink-0">
                    <Thumb product={p} className="w-20 h-20 sm:w-24 sm:h-24" />
                    {disabled && (
                        <span className="absolute inset-0 rounded-xl bg-black/50 text-white text-xs font-bold flex items-center justify-center text-center px-1">
              {reason}
            </span>
                    )}
                </Link>
            ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-2xl">🚫</div>
            )}

            <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:justify-between gap-2">
                <div className="min-w-0">
                    {p ? (
                        <Link
                            to={`/products/${p._id}`}
                            className="font-semibold text-gray-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 line-clamp-2 leading-snug"
                        >
                            {p.title}
                        </Link>
                    ) : (
                        <p className="font-semibold text-gray-500 dark:text-gray-400">Sản phẩm không còn tồn tại</p>
                    )}

                    {p && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                            {p.condition && (
                                <span className="px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-300 font-semibold">
                  {conditionLabel(p.condition)}
                </span>
                            )}
                            {p.category && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">{p.category}</span>
                            )}
                            {p.location && (
                                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  📍 {locationLabel(p.location)}
                </span>
                            )}
                        </div>
                    )}

                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Đã thêm {timeAgo(item.addedAt)}</p>

                    <div className="mt-2 flex items-center gap-3 text-xs font-semibold">
                        {p && !disabled && (
                            <button
                                type="button"
                                onClick={onFavorite}
                                disabled={busy}
                                className="text-gray-500 dark:text-gray-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors disabled:opacity-50"
                            >
                                ♡ Chuyển vào yêu thích
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={busy}
                            className="text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                        >
                            Xóa
                        </button>
                    </div>
                </div>

                {p && (
                    <div className="sm:text-right shrink-0">
                        <p className={`text-lg font-extrabold ${disabled ? 'text-gray-400 line-through' : 'text-orange-600 dark:text-orange-400'}`}>
                            {formatVND(p.price)}
                        </p>
                        {item.priceChanged && !disabled && (
                            <div className="mt-0.5 flex sm:justify-end items-center gap-1.5 text-xs">
                                <span className="text-gray-400 line-through">{formatVND(item.priceAtAdd)}</span>
                                <span
                                    className={`px-1.5 py-0.5 rounded-md font-bold ${
                                        item.priceDiff < 0
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                    }`}
                                >
                  {item.priceDiff < 0 ? 'Giảm' : 'Tăng'} {formatVND(Math.abs(item.priceDiff))}
                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function SellerGroup({ seller, items, selected, onToggleItem, onToggleSeller, onRemove, onFavorite, busy }) {
    const ids = items.map((i) => String(i.productId))
    const selectedCount = ids.filter((id) => selected.has(id)).length
    const subtotal = items.filter((i) => selected.has(String(i.productId))).reduce((s, i) => s + i.product.price, 0)

    return (
        <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
            <header className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                <Checkbox
                    checked={selectedCount === ids.length && ids.length > 0}
                    indeterminate={selectedCount > 0 && selectedCount < ids.length}
                    onChange={onToggleSeller}
                    label={`Chọn tất cả sản phẩm của ${seller?.name || 'người bán'}`}
                />
                <Link to={`/user/${seller?._id}`} className="flex items-center gap-2 min-w-0 group">
                    {seller?.avatar ? (
                        <img src={seller.avatar} alt={seller.name} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                        <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 text-orange-600 font-bold flex items-center justify-center">
              {(seller?.name || '?').charAt(0).toUpperCase()}
            </span>
                    )}
                    <span className="font-bold text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 truncate">
            {seller?.name || 'Người bán'}
          </span>
                    {isVipActive(seller?.vipSellerUntil) && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white">
              Shop VIP
            </span>
                    )}
                </Link>
                <div className="hidden md:block">
                    <SellerTrustCard userId={seller?._id} variant="compact" />
                </div>
                <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
          {selectedCount > 0 ? `Đã chọn ${formatVND(subtotal)}` : `${ids.length} sản phẩm`}
        </span>
            </header>

            <div className="px-4 sm:px-5 divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((item) => (
                    <CartItem
                        key={item.productId}
                        item={item}
                        busy={busy}
                        checked={selected.has(String(item.productId))}
                        onToggle={() => onToggleItem(String(item.productId))}
                        onRemove={() => onRemove(item)}
                        onFavorite={() => onFavorite(item)}
                    />
                ))}
            </div>
        </section>
    )
}

function Skeleton() {
    return (
        <div className="grid lg:grid-cols-3 gap-6 animate-pulse">
            <div className="lg:col-span-2 space-y-4">
                <div className="h-14 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        </div>
    )
}

function EmptyCart() {
    return (
        <div className="rounded-3xl border border-dashed border-orange-200 dark:border-gray-700 bg-orange-50/40 dark:bg-gray-800/40 py-20 px-6 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center text-4xl mb-5">🛒</div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Giỏ hàng của bạn đang trống</h2>
            <p className="mt-2 text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                Hãy dạo một vòng và thêm những món đồ 2hand ưng ý. Mỗi món chỉ có một chiếc nên đừng để người khác nhanh tay hơn nhé!
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Link
                    to="/products"
                    className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/25 transition-all"
                >
                    Khám phá sản phẩm
                </Link>
                <Link
                    to="/favorites"
                    className="px-6 py-3 rounded-xl border-2 border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-300 font-bold hover:bg-orange-50 dark:hover:bg-gray-700 transition-all"
                >
                    Xem yêu thích
                </Link>
            </div>
        </div>
    )
}

/* ====================== Trang giỏ hàng ====================== */

export default function Cart() {
    const dispatch = useDispatch()
    const { addToast } = useToast()
    const confirm = useConfirm()
    const { items, loaded, loading } = useSelector((state) => state.cart)

    const [selected, setSelected] = useState(() => new Set())
    const [busy, setBusy] = useState(false)
    const [checkingOut, setCheckingOut] = useState(false)
    const [showCheckout, setShowCheckout] = useState(false)
    const initializedRef = useRef(false)

    // Mã giảm giá
    const [coupons, setCoupons] = useState([])        // danh sách mã đã được backend đánh giá theo sản phẩm đang chọn
    const [couponsLoading, setCouponsLoading] = useState(false)
    const [coupon, setCoupon] = useState(null)        // mã đang áp dụng
    const [couponInput, setCouponInput] = useState('')
    const [couponError, setCouponError] = useState('')
    const [applyingCoupon, setApplyingCoupon] = useState(false)
    const [showPicker, setShowPicker] = useState(false)
    const couponRef = useRef(null)

    useEffect(() => {
        dispatch(fetchCart())
    }, [dispatch])

    const available = useMemo(() => items.filter((i) => i.available), [items])
    const unavailable = useMemo(() => items.filter((i) => !i.available), [items])

    // Lần đầu: chọn sẵn tất cả sản phẩm còn hàng. Sau đó chỉ loại bỏ những món không còn khả dụng.
    useEffect(() => {
        if (!loaded) return
        const availableIds = new Set(available.map((i) => String(i.productId)))
        if (!initializedRef.current) {
            initializedRef.current = true
            setSelected(availableIds)
        } else {
            setSelected((prev) => {
                const next = new Set([...prev].filter((id) => availableIds.has(id)))
                return next.size === prev.size ? prev : next
            })
        }
    }, [loaded, available])

    // Nhóm theo người bán
    const groups = useMemo(() => {
        const map = new Map()
        for (const it of available) {
            const key = String(it.product.seller?._id || 'unknown')
            if (!map.has(key)) map.set(key, { seller: it.product.seller, items: [] })
            map.get(key).items.push(it)
        }
        return [...map.values()]
    }, [available])

    const selectedItems = useMemo(
        () => available.filter((i) => selected.has(String(i.productId))),
        [available, selected]
    )
    const total = selectedItems.reduce((s, i) => s + i.product.price, 0)
    const sellerCount = new Set(selectedItems.map((i) => String(i.product.seller?._id))).size
    const hasPriceChange = available.some((i) => i.priceChanged)

    // Giảm giá chỉ có hiệu lực khi sản phẩm được áp mã vẫn đang được chọn
    const selectedKey = selectedItems.map((i) => String(i.productId)).sort().join(',')
    const discount =
        coupon && selected.has(String(coupon.targetProductId)) ? Math.min(coupon.discountAmount, total) : 0
    const finalTotal = Math.max(0, total - discount)
    const suggestion = !coupon ? coupons.find((c) => c.eligible) : null
    const eligibleCount = coupons.filter((c) => c.eligible).length

    useEffect(() => {
        couponRef.current = coupon
    }, [coupon])

    // Mỗi khi thay đổi sản phẩm được chọn: đánh giá lại các mã, và kiểm tra mã đang dùng còn hợp lệ không
    useEffect(() => {
        if (!loaded) return
        let cancelled = false
        const timer = setTimeout(async () => {
            setCouponsLoading(true)
            try {
                const res = await api.post('/cart/coupons/evaluate', { productIds: selectedKey ? selectedKey.split(',') : [] })
                if (cancelled) return
                const list = res.data.data || []
                setCoupons(list)

                const current = couponRef.current
                if (current) {
                    const fresh = list.find((c) => c.code === current.code)
                    if (fresh && fresh.eligible) {
                        setCoupon(fresh) // cập nhật sản phẩm được giảm và số tiền giảm
                    } else {
                        setCoupon(null)
                        if (selectedKey) {
                            addToast(`Mã ${current.code} không còn áp dụng được: ${fresh?.reason || 'không hợp lệ'}`, 'warning')
                        }
                    }
                }
            } catch (err) {
                console.error('Không thể tải mã giảm giá:', err)
            } finally {
                if (!cancelled) setCouponsLoading(false)
            }
        }, 300)
        return () => {
            cancelled = true
            clearTimeout(timer)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, selectedKey])

    // Nhập tay mã giảm giá. Trả về thông báo lỗi (hoặc null nếu thành công) để hộp thoại chọn mã dùng lại.
    const applyCouponCode = async (code) => {
        try {
            const res = await api.post('/cart/coupons/apply', {
                code,
                productIds: selectedKey ? selectedKey.split(',') : []
            })
            setCoupon(res.data.data)
            setCouponError('')
            setShowPicker(false)
            addToast(`Đã áp dụng mã ${res.data.data.code}`, 'success')
            return null
        } catch (err) {
            return err.response?.data?.message || 'Không thể áp dụng mã giảm giá'
        }
    }

    const handleApplyInput = async (e) => {
        e.preventDefault()
        if (!couponInput.trim()) return
        setApplyingCoupon(true)
        const err = await applyCouponCode(couponInput.trim())
        setApplyingCoupon(false)
        if (err) setCouponError(err)
        else setCouponInput('')
    }

    const handlePickCoupon = (c) => {
        setCoupon(c)
        setCouponError('')
        setShowPicker(false)
        addToast(`Đã áp dụng mã ${c.code}`, 'success')
    }
    const allSelected = available.length > 0 && selectedItems.length === available.length

    const toggleItem = (id) =>
        setSelected((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })

    const toggleSeller = (group) =>
        setSelected((prev) => {
            const ids = group.items.map((i) => String(i.productId))
            const next = new Set(prev)
            const all = ids.every((id) => next.has(id))
            ids.forEach((id) => (all ? next.delete(id) : next.add(id)))
            return next
        })

    const toggleAll = () =>
        setSelected(allSelected ? new Set() : new Set(available.map((i) => String(i.productId))))

    const run = async (fn, successMsg) => {
        setBusy(true)
        try {
            await fn()
            if (successMsg) addToast(successMsg, 'success')
        } catch (message) {
            addToast(typeof message === 'string' ? message : 'Có lỗi xảy ra, vui lòng thử lại', 'error')
        } finally {
            setBusy(false)
        }
    }

    const handleRemove = (item) =>
        run(() => dispatch(removeFromCart(item.productId || item._rawId)).unwrap(), 'Đã xóa khỏi giỏ hàng')

    const handleFavorite = (item) =>
        run(async () => {
            await dispatch(addToFavorites(item.productId)).unwrap()
            await dispatch(removeFromCart(item.productId)).unwrap()
        }, 'Đã chuyển vào danh sách yêu thích')

    const handleRemoveSelected = async () => {
        if (!selectedItems.length) return
        const ok = await confirm({
            title: 'Xóa sản phẩm đã chọn',
            message: `Bạn có chắc muốn xóa ${selectedItems.length} sản phẩm khỏi giỏ hàng?`,
            type: 'warning',
            confirmText: 'Xóa'
        })
        if (!ok) return
        run(
            () => dispatch(removeManyFromCart({ productIds: selectedItems.map((i) => i.productId) })).unwrap(),
            'Đã xóa các sản phẩm đã chọn'
        )
    }

    const handleRemoveUnavailable = () =>
        run(() => dispatch(removeManyFromCart({ unavailable: true })).unwrap(), 'Đã dọn các sản phẩm không còn khả dụng')

    // Kiểm tra lại giỏ ngay trước khi đặt hàng, vì có thể món đồ vừa bị người khác mua
    const handleCheckout = async () => {
        if (!selectedItems.length) return
        setCheckingOut(true)
        try {
            const res = await dispatch(fetchCart()).unwrap()
            const fresh = res.data.items
            const stillOk = selectedItems.filter((s) =>
                fresh.some((f) => String(f.productId) === String(s.productId) && f.available)
            )
            if (stillOk.length !== selectedItems.length) {
                addToast(
                    `${selectedItems.length - stillOk.length} sản phẩm vừa được bán hoặc không còn khả dụng. Vui lòng kiểm tra lại giỏ hàng.`,
                    'warning'
                )
                return
            }
            setShowCheckout(true)
        } catch {
            addToast('Không thể kiểm tra giỏ hàng, vui lòng thử lại', 'error')
        } finally {
            setCheckingOut(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-28 lg:pb-8">
            <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Giỏ hàng</h1>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {items.length > 0 ? `${items.length} sản phẩm trong giỏ` : 'Chưa có sản phẩm nào'}
                    </p>
                </div>
                <Link to="/products" className="text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline">
                    ← Tiếp tục mua sắm
                </Link>
            </div>

            {!loaded && loading ? (
                <Skeleton />
            ) : items.length === 0 ? (
                <EmptyCart />
            ) : (
                <div className="grid lg:grid-cols-3 gap-6 items-start">
                    {/* ===== Danh sách ===== */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="rounded-2xl border border-orange-100 dark:border-orange-900/40 bg-orange-50 dark:bg-orange-500/10 px-4 py-3 text-sm text-orange-800 dark:text-orange-200 flex gap-2">
                            <span>💡</span>
                            <p>
                                Đồ 2hand mỗi món chỉ có <strong>một chiếc</strong>. Sản phẩm trong giỏ <strong>chưa được giữ chỗ</strong>, người khác có thể mua trước, hãy đặt hàng sớm.
                            </p>
                        </div>

                        {hasPriceChange && (
                            <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex gap-2">
                                <span>🏷️</span>
                                <p>Một số sản phẩm đã thay đổi giá so với lúc bạn thêm vào giỏ. Giá hiển thị bên dưới là giá hiện tại.</p>
                            </div>
                        )}

                        {available.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 sm:px-5 py-3">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={selectedItems.length > 0 && !allSelected}
                                    onChange={toggleAll}
                                    label="Chọn tất cả"
                                />
                                <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Chọn tất cả ({available.length})</span>
                                <button
                                    type="button"
                                    onClick={handleRemoveSelected}
                                    disabled={!selectedItems.length || busy}
                                    className="ml-auto text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 disabled:hover:text-gray-500"
                                >
                                    Xóa đã chọn
                                </button>
                            </div>
                        )}

                        {groups.map((g) => (
                            <SellerGroup
                                key={g.seller?._id || 'unknown'}
                                seller={g.seller}
                                items={g.items}
                                selected={selected}
                                busy={busy}
                                onToggleItem={toggleItem}
                                onToggleSeller={() => toggleSeller(g)}
                                onRemove={handleRemove}
                                onFavorite={handleFavorite}
                            />
                        ))}

                        {unavailable.length > 0 && (
                            <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                                <header className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                                    <h2 className="font-bold text-gray-700 dark:text-gray-200">
                                        Không còn khả dụng ({unavailable.length})
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={handleRemoveUnavailable}
                                        disabled={busy}
                                        className="text-sm font-semibold text-orange-600 dark:text-orange-400 hover:underline disabled:opacity-50"
                                    >
                                        Dọn sạch
                                    </button>
                                </header>
                                <div className="px-4 sm:px-5 divide-y divide-gray-100 dark:divide-gray-700">
                                    {unavailable.map((item) => (
                                        <CartItem
                                            key={item.productId || item._rawId}
                                            item={item}
                                            busy={busy}
                                            checked={false}
                                            onToggle={() => {}}
                                            onRemove={() => handleRemove(item)}
                                            onFavorite={() => {}}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>

                    {/* ===== Tóm tắt đơn hàng ===== */}
                    <aside className="lg:sticky lg:top-28 space-y-4">
                        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
                            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-4">Tóm tắt đơn hàng</h2>

                            <dl className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Sản phẩm đã chọn</dt>
                                    <dd className="font-semibold text-gray-900 dark:text-white">{selectedItems.length}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Từ người bán</dt>
                                    <dd className="font-semibold text-gray-900 dark:text-white">{sellerCount}</dd>
                                </div>
                                <div className="flex justify-between">
                                    <dt className="text-gray-500 dark:text-gray-400">Tạm tính</dt>
                                    <dd className="font-semibold text-gray-900 dark:text-white">{formatVND(total)}</dd>
                                </div>
                                {discount > 0 && (
                                    <div className="flex justify-between">
                                        <dt className="text-gray-500 dark:text-gray-400">Giảm giá ({coupon.code})</dt>
                                        <dd className="font-semibold text-emerald-600 dark:text-emerald-400">-{formatVND(discount)}</dd>
                                    </div>
                                )}
                            </dl>

                            {/* Mã giảm giá */}
                            <div className="mt-4">
                                {discount > 0 ? (
                                    <div className="rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 px-3.5 py-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="font-black text-emerald-700 dark:text-emerald-300 truncate">🎟️ {coupon.code}</p>
                                            <div className="flex items-center gap-3 text-xs font-bold shrink-0">
                                                <button type="button" onClick={() => setShowPicker(true)} className="text-orange-600 dark:text-orange-400 hover:underline">
                                                    Đổi mã
                                                </button>
                                                <button type="button" onClick={() => setCoupon(null)} className="text-gray-500 dark:text-gray-400 hover:text-red-600">
                                                    Bỏ mã
                                                </button>
                                            </div>
                                        </div>
                                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                                            Tiết kiệm {formatVND(discount)} cho "{coupon.targetTitle}"
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <form onSubmit={handleApplyInput} className="flex gap-2">
                                            <input
                                                value={couponInput}
                                                onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError('') }}
                                                placeholder="Nhập mã giảm giá"
                                                maxLength={20}
                                                aria-label="Mã giảm giá"
                                                className="min-w-0 flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                                            />
                                            <button
                                                type="submit"
                                                disabled={applyingCoupon || !couponInput.trim() || !selectedItems.length}
                                                className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50"
                                            >
                                                {applyingCoupon ? '...' : 'Áp dụng'}
                                            </button>
                                        </form>
                                        {couponError && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">⚠ {couponError}</p>}

                                        {suggestion && selectedItems.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handlePickCoupon(suggestion)}
                                                className="mt-2 w-full text-left rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-800 px-3.5 py-2.5 text-xs text-orange-800 dark:text-orange-200 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-colors"
                                            >
                                                💡 Mã <strong>{suggestion.code}</strong> giảm <strong>{formatVND(suggestion.discountAmount)}</strong>. Bấm để áp dụng
                                            </button>
                                        )}
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setShowPicker(true)}
                                    className="mt-2 text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
                                >
                                    🎟️ Xem mã giảm giá{coupons.length > 0 ? ` (${eligibleCount}/${coupons.length} dùng được)` : ''}
                                </button>
                            </div>

                            <div className="my-4 border-t border-dashed border-gray-200 dark:border-gray-700" />

                            <div className="flex items-end justify-between">
                                <span className="font-bold text-gray-900 dark:text-white">Tổng thanh toán</span>
                                <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatVND(finalTotal)}</span>
                            </div>
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Mỗi sản phẩm sẽ tạo một đơn hàng riêng để bạn theo dõi.</p>

                            <button
                                type="button"
                                onClick={handleCheckout}
                                disabled={!selectedItems.length || checkingOut}
                                className="mt-5 w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black shadow-lg shadow-orange-500/30 transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                            >
                                {checkingOut ? 'Đang kiểm tra...' : `Đặt hàng (${selectedItems.length})`}
                            </button>
                            {!selectedItems.length && available.length > 0 && (
                                <p className="mt-2 text-center text-xs text-gray-400">Chọn ít nhất 1 sản phẩm để đặt hàng</p>
                            )}
                        </div>

                        <ul className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-3 text-sm text-gray-600 dark:text-gray-300">
                            <li className="flex gap-2"><span>🛡️</span><span>Thanh toán an toàn, tiền được sàn giữ đến khi bạn nhận hàng.</span></li>
                            <li className="flex gap-2"><span>🔄</span><span>Hỗ trợ yêu cầu hoàn đơn nếu hàng không đúng mô tả.</span></li>
                            <li className="flex gap-2"><span>💬</span><span>Nên nhắn tin hỏi người bán về tình trạng thực tế trước khi đặt.</span></li>
                        </ul>
                    </aside>
                </div>
            )}

            {/* Thanh đặt hàng cố định trên điện thoại */}
            {items.length > 0 && available.length > 0 && (
                <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tổng thanh toán ({selectedItems.length})</p>
                        <p className="text-lg font-black text-orange-600 dark:text-orange-400 truncate">{formatVND(finalTotal)}</p>
                    </div>
                    <button
                        type="button"
                        onClick={handleCheckout}
                        disabled={!selectedItems.length || checkingOut}
                        className="px-6 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black disabled:opacity-50"
                    >
                        Đặt hàng
                    </button>
                </div>
            )}

            <CartCheckoutModal
                isOpen={showCheckout}
                onClose={() => setShowCheckout(false)}
                items={selectedItems}
                total={total}
                coupon={discount > 0 ? coupon : null}
                discount={discount}
                onCompleted={({ couponUsed }) => {
                    if (couponUsed) setCoupon(null)
                }}
            />

            <CouponPicker
                isOpen={showPicker}
                onClose={() => setShowPicker(false)}
                coupons={coupons}
                loading={couponsLoading}
                appliedCode={discount > 0 ? coupon?.code : null}
                onApply={handlePickCoupon}
                onRemove={() => { setCoupon(null); setShowPicker(false) }}
                onApplyCode={applyCouponCode}
            />
        </div>
    )
}