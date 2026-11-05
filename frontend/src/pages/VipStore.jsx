import React, { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../utils/api.js'

const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n || 0))) + ' ₫'
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '—')
const formatDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—')

const TYPE_INFO = {
    pin: { label: 'Đẩy top', icon: '🚀', desc: 'Sản phẩm lên đầu danh sách' },
    highlight: { label: 'Nổi bật', icon: '⭐', desc: 'Viền cam + huy hiệu' },
    combo: { label: 'VIP Combo', icon: '👑', desc: 'Đẩy top + nổi bật' }
}

const STATUS_LABEL = {
    pending: { text: 'Chờ thanh toán', cls: 'bg-yellow-100 text-yellow-700' },
    paid: { text: 'Đã dùng hết / hết hạn', cls: 'bg-gray-100 text-gray-600' },
    expired: { text: 'Hết hạn thanh toán', cls: 'bg-red-100 text-red-600' },
    cancelled: { text: 'Đã hủy', cls: 'bg-red-100 text-red-600' }
}

export default function VipStore() {
    const [params, setParams] = useSearchParams()
    const tab = params.get('tab') === 'cards' ? 'cards' : 'shop'

    const [packages, setPackages] = useState([])
    const [cards, setCards] = useState([])
    const [history, setHistory] = useState([])
    const [loading, setLoading] = useState(true)
    const [buyingId, setBuyingId] = useState(null)
    const [notice, setNotice] = useState(null) // { type: 'success' | 'error', text }
    const [applyCard, setApplyCard] = useState(null) // thẻ đang chọn để gắn

    const loadAll = useCallback(async () => {
        setLoading(true)
        try {
            const [p, c] = await Promise.all([api.get('/vip/packages'), api.get('/vip/my-cards')])
            setPackages(p.data.data || [])
            setCards(c.data.data.cards || [])
            setHistory(c.data.data.history || [])
        } catch (e) {
            setNotice({ type: 'error', text: e.response?.data?.message || 'Không tải được dữ liệu thẻ VIP' })
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { loadAll() }, [loadAll])

    const setTab = (t) => setParams(t === 'cards' ? { tab: 'cards' } : {})

    const buy = async (pkg) => {
        setBuyingId(pkg._id)
        setNotice(null)
        try {
            const res = await api.post('/vip/purchase', { packageId: pkg._id })
            window.location.href = res.data.data.payUrl // chuyển sang cổng VNPay
        } catch (e) {
            setNotice({ type: 'error', text: e.response?.data?.message || 'Không thể tạo thanh toán' })
            setBuyingId(null)
        }
    }

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Banner */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-orange-500 to-amber-500 text-white p-6 sm:p-8 shadow-lg shadow-orange-500/25 mb-6">
                <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/10" />
                <div className="relative">
                    <span className="text-xs font-bold uppercase tracking-widest text-orange-100">NOLA2HAND VIP</span>
                    <h1 className="text-3xl font-black mt-1">Đưa sản phẩm của bạn lên đầu trang</h1>
                    <p className="text-orange-50 mt-2 max-w-2xl text-sm">
                        Mua thẻ một lần, gắn cho bất kỳ sản phẩm đang bán. Tin được ghim lên đầu trang chủ và danh sách sản phẩm,
                        người mua nhìn thấy trước nên bán nhanh hơn.
                    </p>
                </div>
            </div>

            {notice && (
                <div role="alert" className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium flex items-start justify-between gap-3 ${
                    notice.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span>{notice.text}</span>
                    <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)} className="font-bold">×</button>
                </div>
            )}

            {/* Tabs */}
            <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6" role="tablist">
                {[['shop', 'Mua thẻ'], ['cards', `Thẻ của tôi${cards.length ? ` (${cards.length})` : ''}`]].map(([key, label]) => (
                    <button
                        key={key}
                        role="tab"
                        aria-selected={tab === key}
                        onClick={() => setTab(key)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                            tab === key
                                ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-300 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-gray-500 dark:text-gray-400">Đang tải...</p>
            ) : tab === 'shop' ? (
                packages.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400">Hiện chưa có gói thẻ nào được bán.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {packages.map((pkg) => {
                            const t = TYPE_INFO[pkg.type]
                            const discount = pkg.originalPrice > pkg.price
                                ? Math.round((1 - pkg.price / pkg.originalPrice) * 100) : 0
                            return (
                                <div key={pkg._id} className="relative flex flex-col rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 hover:shadow-lg transition-shadow">
                                    {pkg.badge && (
                                        <span className="absolute -top-3 right-4 text-xs font-bold px-3 py-1 rounded-full bg-orange-500 text-white shadow">
                      {pkg.badge}
                    </span>
                                    )}
                                    <div className="flex items-center gap-2 text-sm font-semibold text-orange-600 dark:text-orange-400">
                                        <span className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center">{t.icon}</span>
                                        {t.label}
                                    </div>
                                    <h3 className="mt-3 text-lg font-extrabold text-gray-900 dark:text-white">{pkg.name}</h3>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 min-h-[2.5rem]">{pkg.description || t.desc}</p>

                                    <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                                        <li>⏱ Hiệu lực mỗi lượt: <b>{pkg.durationDays} ngày</b></li>
                                        <li>🎟 Số lượt dùng: <b>{pkg.quantity}</b></li>
                                        <li>📅 Dùng trong vòng <b>{pkg.validDays} ngày</b> kể từ khi mua</li>
                                    </ul>

                                    <div className="mt-auto pt-5">
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{formatVND(pkg.price)}</span>
                                            {discount > 0 && (
                                                <>
                                                    <span className="text-sm text-gray-400 line-through">{formatVND(pkg.originalPrice)}</span>
                                                    <span className="text-xs font-bold text-green-600">-{discount}%</span>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={buyingId === pkg._id}
                                            onClick={() => buy(pkg)}
                                            className="mt-3 w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors"
                                        >
                                            {buyingId === pkg._id ? 'Đang chuyển sang VNPay...' : 'Mua ngay'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            ) : (
                <div className="space-y-8">
                    <section>
                        <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3">Thẻ có thể dùng</h2>
                        {cards.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-orange-200 dark:border-gray-700 py-10 text-center">
                                <p className="text-gray-600 dark:text-gray-300">Bạn chưa có thẻ nào.</p>
                                <button type="button" onClick={() => setTab('shop')} className="mt-2 text-orange-600 font-semibold hover:underline">
                                    Mua thẻ ngay
                                </button>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {cards.map((c) => {
                                    const t = TYPE_INFO[c.packageSnapshot?.type] || TYPE_INFO.pin
                                    return (
                                        <div key={c._id} className="rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50/50 dark:bg-gray-800 p-5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">{t.icon} {t.label}</span>
                                                <span className="text-xs text-gray-400 font-mono">{c.transactionCode}</span>
                                            </div>
                                            <h3 className="mt-2 font-extrabold text-gray-900 dark:text-white">{c.packageSnapshot?.name}</h3>
                                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                                                Còn <b>{c.usesLeft}</b>/{c.packageSnapshot?.quantity} lượt · mỗi lượt {c.packageSnapshot?.durationDays} ngày
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Hạn dùng thẻ: {formatDate(c.cardExpiresAt)}</p>
                                            <button
                                                type="button"
                                                onClick={() => setApplyCard(c)}
                                                className="mt-4 w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded-xl transition-colors"
                                            >
                                                Gắn cho sản phẩm
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </section>

                    {history.length > 0 && (
                        <section>
                            <h2 className="text-lg font-extrabold text-gray-900 dark:text-white mb-3">Lịch sử</h2>
                            <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                                <table className="w-full text-sm">
                                    <thead className="bg-orange-50/60 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-semibold">Thẻ</th>
                                        <th className="px-4 py-3 text-left font-semibold">Mã GD</th>
                                        <th className="px-4 py-3 text-right font-semibold">Số tiền</th>
                                        <th className="px-4 py-3 text-left font-semibold">Ngày tạo</th>
                                        <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {history.map((h) => {
                                        const st = STATUS_LABEL[h.status] || STATUS_LABEL.paid
                                        return (
                                            <tr key={h._id}>
                                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">{h.packageSnapshot?.name}</td>
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{h.transactionCode}</td>
                                                <td className="px-4 py-3 text-right">{formatVND(h.amount)}</td>
                                                <td className="px-4 py-3 text-gray-500">{formatDateTime(h.createdAt)}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.text}</span>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    )}
                </div>
            )}

            {applyCard && (
                <ApplyModal
                    card={applyCard}
                    onClose={() => setApplyCard(null)}
                    onDone={(text) => {
                        setApplyCard(null)
                        setNotice({ type: 'success', text })
                        loadAll()
                    }}
                    onError={(text) => setNotice({ type: 'error', text })}
                />
            )}

            <p className="mt-10 text-xs text-gray-400">
                Thanh toán qua VNPay. Cần hỗ trợ? <Link to="/help" className="underline">Trung tâm trợ giúp</Link>.
            </p>
        </div>
    )
}

function ApplyModal({ card, onClose, onDone, onError }) {
    const [products, setProducts] = useState(null)
    const [submittingId, setSubmittingId] = useState(null)

    useEffect(() => {
        api.get('/vip/my-products')
            .then((res) => setProducts(res.data.data || []))
            .catch((e) => { onError(e.response?.data?.message || 'Không tải được sản phẩm'); onClose() })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const apply = async (product) => {
        setSubmittingId(product._id)
        try {
            await api.post('/vip/apply', { purchaseId: card._id, productId: product._id })
            onDone(`Đã gắn thẻ "${card.packageSnapshot?.name}" cho "${product.title}"`)
        } catch (e) {
            onError(e.response?.data?.message || 'Không thể gắn thẻ')
            setSubmittingId(null)
        }
    }

    const now = new Date()
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Chọn sản phẩm để gắn thẻ"
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                    <div>
                        <h3 className="font-extrabold text-gray-900 dark:text-white">Chọn sản phẩm</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{card.packageSnapshot?.name} · còn {card.usesLeft} lượt</p>
                    </div>
                    <button type="button" aria-label="Đóng" onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-700">×</button>
                </div>

                <div className="overflow-y-auto p-3">
                    {products === null ? (
                        <p className="p-4 text-gray-500">Đang tải...</p>
                    ) : products.length === 0 ? (
                        <p className="p-4 text-gray-500 dark:text-gray-400">
                            Bạn chưa có sản phẩm nào đang bán và đã được duyệt.
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {products.map((p) => {
                                const pinned = p.vipPinnedUntil && new Date(p.vipPinnedUntil) > now
                                const hl = p.vipHighlightUntil && new Date(p.vipHighlightUntil) > now
                                return (
                                    <li key={p._id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 p-2">
                                        <img
                                            src={p.images?.[0] || 'https://via.placeholder.com/80x80/cccccc/ffffff?text=No+Image'}
                                            alt=""
                                            className="w-14 h-14 rounded-lg object-cover bg-gray-100"
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/80x80/cccccc/ffffff?text=No+Image' }}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{p.title}</p>
                                            <p className="text-xs text-gray-500">{formatVND(p.price)}</p>
                                            {(pinned || hl) && (
                                                <p className="text-xs text-orange-600">
                                                    {pinned && `Đang ghim đến ${formatDate(p.vipPinnedUntil)}`}
                                                    {pinned && hl && ' · '}
                                                    {hl && `Nổi bật đến ${formatDate(p.vipHighlightUntil)}`}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            disabled={submittingId !== null}
                                            onClick={() => apply(p)}
                                            className="text-sm font-semibold px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white"
                                        >
                                            {submittingId === p._id ? '...' : pinned || hl ? 'Gia hạn' : 'Gắn thẻ'}
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    )
}