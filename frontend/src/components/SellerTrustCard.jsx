import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'

/**
 * Thẻ "Độ tin cậy người bán": điểm 0-100 tính theo công thức công khai từ đánh giá sao, cảm xúc bình luận (AI),
 * lịch sử giao dịch và độ tin cậy tài khoản.
 *   variant="compact": gọn, đặt ở trang sản phẩm
 *   variant="public" : đầy đủ, đặt ở trang đánh giá của người bán
 *   variant="owner"  : như public, thêm thông tin kỹ thuật dành cho chính người bán
 */

const LEVEL_STYLE = {
    high: { color: '#16a34a', bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', icon: '🛡️' },
    good: { color: '#65a30d', bg: 'bg-lime-50 dark:bg-lime-900/20', text: 'text-lime-700 dark:text-lime-300', icon: '✅' },
    caution: { color: '#d97706', bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', icon: '⚠️' },
    risk: { color: '#dc2626', bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-300', icon: '🚨' },
    insufficient: { color: '#6b7280', bg: 'bg-gray-50 dark:bg-gray-700/40', text: 'text-gray-600 dark:text-gray-300', icon: 'ℹ️' }
}

const SENTIMENT = {
    positive: { label: 'Tích cực', icon: '😊', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    neutral: { label: 'Trung lập', icon: '😐', cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
    negative: { label: 'Tiêu cực', icon: '😞', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' }
}

const SOURCE_LABEL = {
    'local-model': 'Mô hình tự huấn luyện',
    'local-model-low-confidence': 'Mô hình tự huấn luyện (độ tin cậy thấp)',
    gemini: 'Gemini',
    default: 'Mặc định (không phân tích được)',
    unknown: 'Đánh giá cũ (chưa ghi nguồn)'
}

export function SentimentChip({ sentiment, score }) {
    const s = SENTIMENT[sentiment]
    if (!s) return null
    return (
        <span
            title={`Cảm xúc do AI phân tích${score ? ` (điểm ${score}/5)` : ''}, có thể chưa chính xác`}
            className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${s.cls}`}
        >
      <span aria-hidden="true">{s.icon}</span> {s.label}
    </span>
    )
}

function Gauge({ score, color, size = 96, label }) {
    const r = 40
    const c = 2 * Math.PI * r
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
            <svg viewBox="0 0 100 100" width={size} height={size} className="-rotate-90">
                <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" strokeWidth="9" className="text-gray-200 dark:text-gray-700" />
                <circle
                    cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(Math.max(score, 0), 100) / 100)}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-gray-900 dark:text-white leading-none">{score}</span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400">/100</span>
            </div>
        </div>
    )
}

export default function SellerTrustCard({ userId, variant = 'public' }) {
    const [data, setData] = useState(null)
    const [state, setState] = useState('loading') // loading | ok | error
    const [showFormula, setShowFormula] = useState(false)

    useEffect(() => {
        if (!userId) return undefined
        let cancelled = false
        setState('loading')
        api.get(`/seller-trust/${userId}`)
            .then((res) => { if (!cancelled) { setData(res.data.data); setState('ok') } })
            .catch(() => { if (!cancelled) setState('error') })
        return () => { cancelled = true }
    }, [userId])

    if (!userId) return null
    if (state === 'loading') {
        return <div className="rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse h-24 mb-6" aria-hidden="true" />
    }
    if (state === 'error' || !data) return null

    const st = LEVEL_STYLE[data.level.key] || LEVEL_STYLE.insufficient
    const gaugeLabel = `Điểm tin cậy ${data.score} trên 100, mức ${data.level.label}`

    /* ───────── Gọn: trang sản phẩm ───────── */
    if (variant === 'compact') {
        const top = data.signals.slice(0, 2)
        return (
            <div className={`mt-3 rounded-2xl border border-gray-100 dark:border-gray-700 p-3 ${st.bg}`}>
                <div className="flex items-center gap-3">
                    <Gauge score={data.score} color={st.color} size={56} label={gaugeLabel} />
                    <div className="min-w-0 flex-1">
                        <p className={`text-sm font-extrabold ${st.text}`}>{st.icon} {data.level.label}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                            {data.ratings.count > 0
                                ? `${data.ratings.average}/5 · ${data.ratings.count} đánh giá · ${data.orders.completed} đơn thành công`
                                : 'Chưa có đánh giá nào'}
                        </p>
                    </div>
                    <Link to={`/user/${userId}/reviews`} className="text-xs font-semibold text-orange-600 hover:underline shrink-0">
                        Chi tiết
                    </Link>
                </div>
                {top.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                        {top.map((s, i) => (
                            <li key={i} className="text-xs text-gray-600 dark:text-gray-300">
                                {s.type === 'good' ? '✓' : s.type === 'warn' ? '⚠' : 'ℹ'} {s.text}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )
    }

    /* ───────── Đầy đủ ───────── */
    const sen = data.sentiment
    const total = sen.analyzed || 0
    const owner = variant === 'owner'
    const sourceEntries = Object.entries(data.ai.bySource || {})
    const sourceTotal = sourceEntries.reduce((s, [, c]) => s + c, 0)

    return (
        <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm mb-6 overflow-hidden">
            <div className={`p-5 flex flex-wrap items-center gap-5 ${st.bg}`}>
                <Gauge score={data.score} color={st.color} label={gaugeLabel} />
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Độ tin cậy người bán</p>
                    <h2 className={`text-2xl font-black ${st.text}`}>{st.icon} {data.level.label}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {data.enoughData
                            ? 'Điểm tổng hợp từ đánh giá của người mua, cảm xúc bình luận, lịch sử giao dịch và tài khoản.'
                            : 'Người bán chưa có đủ đánh giá (cần ít nhất 3) nên điểm chỉ mang tính tạm tính.'}
                    </p>
                </div>
            </div>

            <div className="p-5 space-y-6">
                {/* Thành phần điểm */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Điểm được tính từ đâu</h3>
                    <div className="space-y-3">
                        {Object.values(data.components).map((c) => (
                            <div key={c.label}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="text-gray-700 dark:text-gray-300">{c.label}</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">{c.points}/{c.max}</span>
                                </div>
                                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${(c.points / c.max) * 100}%`, backgroundColor: st.color }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Cảm xúc bình luận */}
                <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Cảm xúc trong bình luận của người mua</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                        AI đọc nội dung bình luận (không chỉ số sao). Đã phân tích {total} bình luận
                        {sen.pending > 0 ? `, ${sen.pending} đang chờ phân tích` : ''}
                        {sen.noComment > 0 ? `, ${sen.noComment} đánh giá chỉ có sao` : ''}.
                    </p>
                    {total > 0 ? (
                        <>
                            <div className="flex h-4 rounded-full overflow-hidden" role="img"
                                 aria-label={`Tích cực ${sen.positive}, trung lập ${sen.neutral}, tiêu cực ${sen.negative}`}>
                                <div className="bg-green-500" style={{ width: `${(sen.positive / total) * 100}%` }} />
                                <div className="bg-gray-400" style={{ width: `${(sen.neutral / total) * 100}%` }} />
                                <div className="bg-red-500" style={{ width: `${(sen.negative / total) * 100}%` }} />
                            </div>
                            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm">
                                <span className="text-green-700 dark:text-green-400">😊 Tích cực {sen.positive} ({sen.positiveShare}%)</span>
                                <span className="text-gray-600 dark:text-gray-300">😐 Trung lập {sen.neutral}</span>
                                <span className="text-red-700 dark:text-red-400">😞 Tiêu cực {sen.negative} ({sen.negativeShare}%)</span>
                            </div>
                        </>
                    ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">Chưa có bình luận nào được phân tích.</p>
                    )}
                </div>

                {/* Tín hiệu */}
                {data.signals.length > 0 && (
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Điểm đáng chú ý</h3>
                        <ul className="space-y-1.5">
                            {data.signals.map((s, i) => (
                                <li key={i} className={`text-sm flex gap-2 ${
                                    s.type === 'good' ? 'text-green-700 dark:text-green-400'
                                        : s.type === 'warn' ? 'text-amber-700 dark:text-amber-400'
                                            : 'text-gray-600 dark:text-gray-300'}`}>
                                    <span aria-hidden="true">{s.type === 'good' ? '✓' : s.type === 'warn' ? '⚠' : 'ℹ'}</span>
                                    <span>{s.text}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Dành riêng cho chủ shop */}
                {owner && (
                    <div className="rounded-xl border border-dashed border-orange-300 dark:border-orange-700 p-4 space-y-3">
                        <h3 className="text-sm font-bold text-orange-700 dark:text-orange-300">Thông tin kỹ thuật (chỉ bạn thấy)</h3>
                        {sen.mismatch > 0 && (
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                Có <b>{sen.mismatch}</b> đánh giá mà số sao và nội dung lệch nhau (ví dụ 5 sao nhưng bình luận bị AI xếp tiêu cực).
                                Có thể do AI hiểu chưa đúng, nên đọc lại các đánh giá này.
                            </p>
                        )}
                        {sourceTotal > 0 && (
                            <div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">Nguồn quyết định kết quả phân tích:</p>
                                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-0.5">
                                    {sourceEntries.map(([k, c]) => (
                                        <li key={k}>{SOURCE_LABEL[k] || k}: <b>{c}</b> ({Math.round((c / sourceTotal) * 100)}%)</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}

                {/* Cách tính + lưu ý */}
                <div className="text-xs text-gray-500 dark:text-gray-400 space-y-2">
                    <button type="button" onClick={() => setShowFormula((v) => !v)} aria-expanded={showFormula}
                            className="font-semibold text-orange-600 hover:underline">
                        {showFormula ? 'Ẩn cách tính điểm' : 'Xem cách tính điểm'}
                    </button>
                    {showFormula && (
                        <ul className="list-disc pl-5 space-y-1">
                            <li><b>Điểm sao (tối đa 40):</b> trung bình sao có hiệu chỉnh để người bán ít đánh giá không bị thổi phồng.</li>
                            <li><b>Cảm xúc bình luận (tối đa 25):</b> dựa trên chênh lệch giữa số bình luận tích cực và tiêu cực.</li>
                            <li><b>Giao dịch (tối đa 20):</b> số đơn hoàn thành (tối đa tính 10 đơn) và tỉ lệ đơn bị trả hàng.</li>
                            <li><b>Tài khoản (tối đa 15):</b> đã xác thực 8 điểm, cộng thêm theo tuổi tài khoản (tối đa 180 ngày).</li>
                            <li>Mức: từ 80 rất tin cậy, 65 tin cậy, 50 cần thận trọng, dưới 50 rủi ro cao. Dưới 3 đánh giá thì chưa đủ dữ liệu.</li>
                        </ul>
                    )}
                    <p>
                        Đây là chỉ số tham khảo, không bảo đảm an toàn giao dịch. Cảm xúc bình luận do AI phân tích tự động
                        (mô hình tự huấn luyện kết hợp Gemini) nên có thể sai. Hãy kiểm tra hàng trực tiếp khi giao dịch.
                    </p>
                </div>
            </div>
        </section>
    )
}