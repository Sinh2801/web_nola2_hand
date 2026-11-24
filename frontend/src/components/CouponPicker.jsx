import React, { useState } from 'react'
import { formatVND, formatShort, couponCategoryLabel } from '../utils/format'

const fmtDate = (d) => new Date(d).toLocaleDateString('vi-VN')

function CouponCard({ c, applied, onApply, onRemove }) {
    const disabled = !c.eligible
    const big = c.discountType === 'percentage' ? `${c.discountValue}%` : formatShort(c.discountValue)

    return (
        <div className={`flex rounded-2xl border overflow-hidden ${
            applied
                ? 'border-orange-400 ring-2 ring-orange-200 dark:ring-orange-500/30'
                : 'border-gray-200 dark:border-gray-700'
        } ${disabled ? 'opacity-70' : ''}`}>
            {/* Phần trái kiểu vé */}
            <div className={`relative w-24 sm:w-28 shrink-0 flex flex-col items-center justify-center text-center px-2 py-4 ${
                disabled ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-300' : 'bg-gradient-to-br from-orange-500 to-orange-600 text-white'
            }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-90">Giảm</span>
                <span className="text-2xl font-black leading-tight">{big}</span>
                {c.discountType === 'percentage' && c.maxDiscount > 0 && (
                    <span className="text-[10px] opacity-90 mt-0.5">tối đa {formatShort(c.maxDiscount)}</span>
                )}
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white dark:bg-gray-800" />
            </div>

            <div className="flex-1 min-w-0 p-3 sm:p-4 bg-white dark:bg-gray-800 border-l-2 border-dashed border-gray-200 dark:border-gray-600">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="font-black tracking-wide text-gray-900 dark:text-white">{c.code}</p>
                        {c.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{c.description}</p>
                        )}
                    </div>
                    {applied ? (
                        <button
                            type="button"
                            onClick={onRemove}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                            Bỏ chọn
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onApply}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                            Áp dụng
                        </button>
                    )}
                </div>

                <ul className="mt-2 space-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {c.minPurchase > 0 && <li>• Sản phẩm từ {formatVND(c.minPurchase)}</li>}
                    {c.applicableCategories?.length > 0 && (
                        <li>• Danh mục: {c.applicableCategories.map(couponCategoryLabel).join(', ')}</li>
                    )}
                    <li>• HSD: {fmtDate(c.expiryDate)}</li>
                </ul>

                {c.eligible ? (
                    <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Giảm {formatVND(c.discountAmount)} cho "{c.targetTitle}"
                    </p>
                ) : (
                    <p className="mt-2 text-xs font-semibold text-red-500 dark:text-red-400">⚠ {c.reason}</p>
                )}
            </div>
        </div>
    )
}

/**
 * Hộp thoại chọn mã giảm giá. coupons đã được backend đánh giá theo các sản phẩm đang chọn trong giỏ.
 */
export default function CouponPicker({ isOpen, onClose, coupons, loading, appliedCode, onApply, onRemove, onApplyCode }) {
    const [code, setCode] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    if (!isOpen) return null

    const usable = coupons.filter((c) => c.eligible)
    const others = coupons.filter((c) => !c.eligible)

    const submit = async (e) => {
        e.preventDefault()
        if (!code.trim()) return
        setBusy(true)
        setError('')
        const err = await onApplyCode(code.trim())
        setBusy(false)
        if (err) setError(err)
        else setCode('')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
            <div
                className="bg-gray-50 dark:bg-gray-900 w-full sm:max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label="Chọn mã giảm giá"
            >
                <div className="flex items-center justify-between px-5 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Mã giảm giá</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Đóng"
                        className="w-9 h-9 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
                    >
                        ×
                    </button>
                </div>

                <form onSubmit={submit} className="px-5 py-3 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex gap-2">
                        <input
                            value={code}
                            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
                            placeholder="Nhập mã giảm giá"
                            maxLength={20}
                            className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                        />
                        <button
                            type="submit"
                            disabled={busy || !code.trim()}
                            className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold disabled:opacity-50"
                        >
                            {busy ? '...' : 'Áp dụng'}
                        </button>
                    </div>
                    {error && <p className="mt-1.5 text-xs text-red-600 dark:text-red-400">⚠ {error}</p>}
                </form>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                    {loading && coupons.length === 0 && <p className="text-center text-sm text-gray-500 py-8">Đang tải mã giảm giá...</p>}

                    {!loading && coupons.length === 0 && (
                        <div className="text-center py-10">
                            <div className="text-4xl mb-2">🎟️</div>
                            <p className="font-bold text-gray-800 dark:text-gray-200">Hiện chưa có mã giảm giá nào</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hãy quay lại sau hoặc nhập mã bạn đang có ở ô phía trên.</p>
                        </div>
                    )}

                    {usable.length > 0 && (
                        <section>
                            <h4 className="text-sm font-extrabold text-gray-900 dark:text-white mb-2">Có thể áp dụng ({usable.length})</h4>
                            <div className="space-y-3">
                                {usable.map((c) => (
                                    <CouponCard key={c._id} c={c} applied={c.code === appliedCode} onApply={() => onApply(c)} onRemove={onRemove} />
                                ))}
                            </div>
                        </section>
                    )}

                    {others.length > 0 && (
                        <section>
                            <h4 className="text-sm font-extrabold text-gray-500 dark:text-gray-400 mb-2">Chưa đủ điều kiện ({others.length})</h4>
                            <div className="space-y-3">
                                {others.map((c) => (
                                    <CouponCard key={c._id} c={c} applied={false} onApply={() => {}} onRemove={() => {}} />
                                ))}
                            </div>
                        </section>
                    )}

                    <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                        Mỗi lần đặt hàng, mỗi mã được dùng cho 1 sản phẩm phù hợp nhất (giảm nhiều nhất) trong các sản phẩm đã chọn.
                    </p>
                </div>
            </div>
        </div>
    )
}