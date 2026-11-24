import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import api from '../utils/api'
import { removeManyFromCart } from '../store/slices/cartSlice'
import { formatVND } from '../utils/format'

const PAYMENT_METHODS = [
    { value: 'transfer', icon: '🏦', title: 'Chuyển khoản QR', desc: 'Quét mã QR ngân hàng và tải biên lai' },
    { value: 'momo', icon: '💗', title: 'Ví MoMo', desc: 'Thanh toán online, xác nhận tự động' },
    { value: 'vnpay', icon: '💳', title: 'VNPay', desc: 'Thẻ ATM / ngân hàng nội địa' },
    { value: 'cash', icon: '💵', title: 'Tiền mặt', desc: 'Trả khi nhận hàng' }
]

const inputClass =
    'w-full px-3.5 py-2.5 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all disabled:opacity-60'

function Field({ label, children, className = '' }) {
    return (
        <label className={`block ${className}`}>
            <span className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{label}</span>
            {children}
        </label>
    )
}

export default function CartCheckoutModal({ isOpen, onClose, items, total, coupon = null, discount = 0, onCompleted }) {
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { user } = useSelector((state) => state.auth)

    const [phase, setPhase] = useState('form') // 'form' | 'processing' | 'done'
    const [error, setError] = useState('')
    const [progress, setProgress] = useState({ current: 0, total: 0 })
    const [results, setResults] = useState({ ok: [], failed: [] })

    const [paymentMethod, setPaymentMethod] = useState('transfer')
    const [notes, setNotes] = useState('')
    const [shippingAddress, setShippingAddress] = useState({
        fullName: '', phone: '', address: '', ward: '', district: '', city: '', note: ''
    })

    // Địa chỉ hành chính Việt Nam
    const [provinces, setProvinces] = useState([])
    const [districts, setDistricts] = useState([])
    const [wards, setWards] = useState([])
    const [provinceCode, setProvinceCode] = useState('')
    const [districtCode, setDistrictCode] = useState('')
    const [wardCode, setWardCode] = useState('')
    const [loadingGeo, setLoadingGeo] = useState({ provinces: false, districts: false, wards: false })

    // Mỗi lần mở modal: đặt lại biểu mẫu, điền sẵn thông tin tài khoản
    useEffect(() => {
        if (!isOpen) return
        setPhase('form')
        setError('')
        setResults({ ok: [], failed: [] })
        setNotes('')
        setShippingAddress({
            fullName: user?.name || '',
            phone: user?.phone || '',
            address: user?.address || '',
            ward: '', district: '', city: '', note: ''
        })
        setProvinceCode('')
        setDistrictCode('')
        setWardCode('')
        setDistricts([])
        setWards([])
    }, [isOpen, user])

    useEffect(() => {
        if (!isOpen || provinces.length > 0) return
        let cancelled = false
        setLoadingGeo((p) => ({ ...p, provinces: true }))
        fetch('https://provinces.open-api.vn/api/p/')
            .then((r) => r.json())
            .then((data) => !cancelled && setProvinces(data))
            .catch((e) => console.error('Error fetching provinces:', e))
            .finally(() => !cancelled && setLoadingGeo((p) => ({ ...p, provinces: false })))
        return () => { cancelled = true }
    }, [isOpen, provinces.length])

    const handleProvince = async (e) => {
        const code = e.target.value
        setProvinceCode(code)
        setDistrictCode('')
        setWardCode('')
        setDistricts([])
        setWards([])
        const name = provinces.find((p) => String(p.code) === String(code))?.name || ''
        setShippingAddress((prev) => ({ ...prev, city: name, district: '', ward: '' }))
        if (!code) return
        setLoadingGeo((p) => ({ ...p, districts: true }))
        try {
            const data = await (await fetch(`https://provinces.open-api.vn/api/p/${code}?depth=2`)).json()
            setDistricts(data.districts || [])
        } catch (err) {
            console.error('Error fetching districts:', err)
        } finally {
            setLoadingGeo((p) => ({ ...p, districts: false }))
        }
    }

    const handleDistrict = async (e) => {
        const code = e.target.value
        setDistrictCode(code)
        setWardCode('')
        setWards([])
        const name = districts.find((d) => String(d.code) === String(code))?.name || ''
        setShippingAddress((prev) => ({ ...prev, district: name, ward: '' }))
        if (!code) return
        setLoadingGeo((p) => ({ ...p, wards: true }))
        try {
            const data = await (await fetch(`https://provinces.open-api.vn/api/d/${code}?depth=2`)).json()
            setWards(data.wards || [])
        } catch (err) {
            console.error('Error fetching wards:', err)
        } finally {
            setLoadingGeo((p) => ({ ...p, wards: false }))
        }
    }

    const handleWard = (e) => {
        const code = e.target.value
        setWardCode(code)
        const name = wards.find((w) => String(w.code) === String(code))?.name || ''
        setShippingAddress((prev) => ({ ...prev, ward: name }))
    }

    const setField = (key) => (e) => setShippingAddress((prev) => ({ ...prev, [key]: e.target.value }))

    const validate = () => {
        const a = shippingAddress
        if (!a.fullName.trim()) return 'Vui lòng nhập họ tên người nhận'
        if (!/^[0-9]{10,11}$/.test(a.phone.trim())) return 'Số điện thoại phải gồm 10-11 chữ số'
        if (!a.city || !a.district || !a.ward) return 'Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã'
        if (a.address.trim().length < 5) return 'Địa chỉ chi tiết phải từ 5 ký tự trở lên'
        return ''
    }

    // Tạo lần lượt từng đơn bằng API đặt hàng hiện có, rồi xóa các món đã đặt khỏi giỏ
    const handleSubmit = async (e) => {
        e.preventDefault()
        const msg = validate()
        if (msg) {
            setError(msg)
            return
        }
        setError('')
        setPhase('processing')
        setProgress({ current: 0, total: items.length })

        const ok = []
        const failed = []
        const address = {
            ...shippingAddress,
            fullName: shippingAddress.fullName.trim(),
            phone: shippingAddress.phone.trim(),
            address: shippingAddress.address.trim()
        }

        for (let i = 0; i < items.length; i++) {
            const item = items[i]
            setProgress({ current: i + 1, total: items.length })
            try {
                // Mã giảm giá chỉ gắn vào đơn của sản phẩm được áp mã
                const useCoupon = coupon && String(item.productId) === String(coupon.targetProductId)
                await api.post('/orders', {
                    productId: item.productId,
                    shippingAddress: address,
                    deliveryMethod: 'delivery',
                    paymentMethod,
                    notes: notes.trim(),
                    couponCode: useCoupon ? coupon.code : undefined
                })
                ok.push(item)
            } catch (err) {
                failed.push({ item, message: err.response?.data?.message || 'Không thể tạo đơn hàng' })
            }
        }

        if (ok.length) {
            try {
                await dispatch(removeManyFromCart({ productIds: ok.map((i) => i.productId) })).unwrap()
            } catch (err) {
                console.error('Không thể cập nhật giỏ hàng sau khi đặt:', err)
            }
        }

        setResults({ ok, failed })
        setPhase('done')
        onCompleted?.({
            okCount: ok.length,
            couponUsed: !!coupon && ok.some((i) => String(i.productId) === String(coupon.targetProductId))
        })
    }

    if (!isOpen) return null

    const online = ['momo', 'vnpay'].includes(paymentMethod)
    const closeable = phase !== 'processing'

    return (
        <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
            onClick={() => closeable && onClose()}
        >
            <div
                className="bg-white dark:bg-gray-800 w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Đặt hàng"
            >
                {/* ===== Đang xử lý ===== */}
                {phase === 'processing' && (
                    <div className="p-10 text-center">
                        <div className="mx-auto w-14 h-14 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        <h3 className="mt-6 text-lg font-extrabold text-gray-900 dark:text-white">Đang tạo đơn hàng...</h3>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            {progress.current}/{progress.total} sản phẩm. Vui lòng không đóng cửa sổ này.
                        </p>
                        <div className="mt-5 h-2 rounded-full bg-orange-100 dark:bg-gray-700 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-300"
                                style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* ===== Kết quả ===== */}
                {phase === 'done' && (
                    <div className="flex flex-col min-h-0">
                        <div className="p-6 sm:p-8 overflow-y-auto">
                            <div className="text-center">
                                <div
                                    className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                                        results.ok.length ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-red-100 dark:bg-red-900/30'
                                    }`}
                                >
                                    {results.ok.length ? '🎉' : '😕'}
                                </div>
                                <h3 className="mt-4 text-xl font-extrabold text-gray-900 dark:text-white">
                                    {results.ok.length
                                        ? `Đã tạo ${results.ok.length} đơn hàng`
                                        : 'Chưa tạo được đơn hàng nào'}
                                </h3>
                                {results.ok.length > 0 && (
                                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                                        {online
                                            ? 'Vào "Đơn mua" và bấm "Thanh toán" ở từng đơn để hoàn tất thanh toán online.'
                                            : 'Vui lòng chờ người bán xác nhận. Bạn có thể theo dõi từng đơn trong mục "Đơn mua".'}
                                    </p>
                                )}
                            </div>

                            {results.failed.length > 0 && (
                                <div className="mt-6 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                                    <p className="font-bold text-red-800 dark:text-red-200 text-sm mb-2">
                                        {results.failed.length} sản phẩm chưa đặt được (vẫn còn trong giỏ):
                                    </p>
                                    <ul className="space-y-1.5 text-sm">
                                        {results.failed.map(({ item, message }) => (
                                            <li key={item.productId} className="text-red-700 dark:text-red-300">
                                                <span className="font-semibold">{item.product.title}</span>: {message}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        <div className="p-4 sm:p-5 border-t border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-2">
                            {results.ok.length > 0 ? (
                                <>
                                    <button
                                        onClick={() => { onClose(); navigate('/orders') }}
                                        className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/25"
                                    >
                                        Xem đơn mua
                                    </button>
                                    <button
                                        onClick={onClose}
                                        className="flex-1 py-3 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold hover:bg-gray-200 dark:hover:bg-gray-600"
                                    >
                                        {results.failed.length ? 'Quay lại giỏ hàng' : 'Đóng'}
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={onClose}
                                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold"
                                >
                                    Quay lại giỏ hàng
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* ===== Biểu mẫu ===== */}
                {phase === 'form' && (
                    <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
                        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Xác nhận đặt hàng</h3>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Đóng"
                                className="w-9 h-9 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200 text-xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="px-5 sm:px-6 py-5 overflow-y-auto space-y-6">
                            {/* Sản phẩm */}
                            <section>
                                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mb-3">
                                    Sản phẩm ({items.length})
                                </h4>
                                <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                    {items.map((it) => (
                                        <li key={it.productId} className="flex items-center gap-3 text-sm">
                                            {it.product.images?.[0] ? (
                                                <img src={it.product.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover" />
                                            ) : (
                                                <span className="w-11 h-11 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">📦</span>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-gray-900 dark:text-white truncate">{it.product.title}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{it.product.seller?.name}</p>
                                            </div>
                                            {coupon && String(it.productId) === String(coupon.targetProductId) ? (
                                                <span className="text-right whitespace-nowrap">
                          <span className="block text-xs text-gray-400 line-through">{formatVND(it.product.price)}</span>
                          <span className="block font-bold text-orange-600 dark:text-orange-400">{formatVND(Math.max(0, it.product.price - discount))}</span>
                          <span className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400">🎟️ {coupon.code}</span>
                        </span>
                                            ) : (
                                                <span className="font-bold text-orange-600 dark:text-orange-400 whitespace-nowrap">{formatVND(it.product.price)}</span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </section>

                            {/* Thông tin nhận hàng */}
                            <section>
                                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mb-3">Thông tin nhận hàng</h4>
                                <div className="grid sm:grid-cols-2 gap-3">
                                    <Field label="Họ tên người nhận *">
                                        <input className={inputClass} value={shippingAddress.fullName} onChange={setField('fullName')} placeholder="Nguyễn Văn A" />
                                    </Field>
                                    <Field label="Số điện thoại *">
                                        <input className={inputClass} type="tel" value={shippingAddress.phone} onChange={setField('phone')} placeholder="09xxxxxxxx" />
                                    </Field>
                                    <Field label="Tỉnh / Thành phố *" className="sm:col-span-2">
                                        <select className={inputClass} value={provinceCode} onChange={handleProvince} disabled={loadingGeo.provinces}>
                                            <option value="">{loadingGeo.provinces ? 'Đang tải...' : 'Chọn Tỉnh / Thành phố'}</option>
                                            {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Quận / Huyện *">
                                        <select className={inputClass} value={districtCode} onChange={handleDistrict} disabled={!provinceCode || loadingGeo.districts}>
                                            <option value="">{loadingGeo.districts ? 'Đang tải...' : 'Chọn Quận / Huyện'}</option>
                                            {districts.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Phường / Xã *">
                                        <select className={inputClass} value={wardCode} onChange={handleWard} disabled={!districtCode || loadingGeo.wards}>
                                            <option value="">{loadingGeo.wards ? 'Đang tải...' : 'Chọn Phường / Xã'}</option>
                                            {wards.map((w) => <option key={w.code} value={w.code}>{w.name}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Địa chỉ chi tiết *" className="sm:col-span-2">
                                        <input className={inputClass} value={shippingAddress.address} onChange={setField('address')} placeholder="Số nhà, tên đường, tòa nhà / phòng KTX..." />
                                    </Field>
                                    <Field label="Ghi chú cho người bán" className="sm:col-span-2">
                                        <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ví dụ: giao giờ hành chính" maxLength={200} />
                                    </Field>
                                </div>
                                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Shipper sẽ giao hàng tận nơi theo địa chỉ này cho tất cả đơn.</p>
                            </section>

                            {/* Thanh toán */}
                            <section>
                                <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mb-3">Phương thức thanh toán</h4>
                                <div className="grid sm:grid-cols-2 gap-2.5">
                                    {PAYMENT_METHODS.map((m) => (
                                        <label
                                            key={m.value}
                                            className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                paymentMethod === m.value
                                                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                                                    : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="cart-payment-method"
                                                value={m.value}
                                                checked={paymentMethod === m.value}
                                                onChange={() => setPaymentMethod(m.value)}
                                                className="mt-1 text-orange-500 focus:ring-orange-500"
                                            />
                                            <span className="min-w-0">
                        <span className="block text-sm font-bold text-gray-900 dark:text-white">{m.icon} {m.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">{m.desc}</span>
                      </span>
                                        </label>
                                    ))}
                                </div>
                                {items.length > 1 && (
                                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                                        Giỏ có {items.length} sản phẩm nên sẽ tạo {items.length} đơn riêng. Mỗi đơn được thanh toán và theo dõi riêng trong mục "Đơn mua".
                                    </p>
                                )}
                            </section>

                            {error && (
                                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                                    ⚠️ {error}
                                </div>
                            )}
                        </div>

                        <div className="px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-4 bg-white dark:bg-gray-800">
                            <div className="min-w-0">
                                {discount > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        <span className="line-through">{formatVND(total)}</span>{' '}
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">-{formatVND(discount)}</span>
                                    </p>
                                )}
                                <p className="text-xs text-gray-500 dark:text-gray-400">Tổng thanh toán</p>
                                <p className="text-xl font-black text-orange-600 dark:text-orange-400 truncate">{formatVND(Math.max(0, total - discount))}</p>
                            </div>
                            <button
                                type="submit"
                                className="ml-auto px-8 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-black shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all"
                            >
                                Đặt hàng
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}