import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../utils/api'

const CLOSE_KEY = 'vipMarqueeClosed'

const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n || 0))) + '₫'

const TYPE_TEXT = {
    pin: { icon: '🚀', text: 'đưa tin lên ĐẦU TRANG' },
    highlight: { icon: '⭐', text: 'viền cam + huy hiệu Nổi bật' },
    combo: { icon: '👑', text: 'vừa lên đầu trang vừa Nổi bật' },
    hot: { icon: '🔥', text: 'nhãn HOT đỏ thu hút' },
    ultimate: { icon: '💎', text: 'đủ bộ đẩy top + nổi bật + HOT' },
    seller_vip: { icon: '🏪', text: 'huy hiệu Shop VIP trên mọi tin của bạn' }
}

// Các câu cố định, luôn hiện kể cả khi chưa tải được danh sách gói
const INTRO = [
    '👑 Thẻ VIP NOLA2HAND: đưa tin về shop của bạn lên đầu trang để người mua thấy trước',
    '🔥 Tin gắn thẻ VIP luôn nằm trên cùng trang chủ và danh sách sản phẩm'
]
const OUTRO = ['👉 Bấm vào đây để chọn gói thẻ phù hợp cho shop của bạn']

const readClosed = () => {
    try { return sessionStorage.getItem(CLOSE_KEY) === '1' } catch { return false }
}

export default function VipMarquee() {
    const [packages, setPackages] = useState([])
    const [closed, setClosed] = useState(readClosed)

    useEffect(() => {
        if (closed) return
        let cancelled = false
        api.get('/vip/packages')
            .then((res) => { if (!cancelled) setPackages(res.data.data || []) })
            .catch(() => {}) // lỗi mạng: vẫn chạy các câu cố định
        return () => { cancelled = true }
    }, [closed])

    const messages = useMemo(() => {
        const fromPackages = packages.slice(0, 6).map((p) => {
            const t = TYPE_TEXT[p.type] || TYPE_TEXT.pin
            const discount = p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : 0
            return `${t.icon} ${p.name}: ${t.text}, chỉ ${formatVND(p.price)}${discount > 0 ? ` (giảm ${discount}%)` : ''}`
        })
        return [...INTRO, ...fromPackages, ...OUTRO]
    }, [packages])

    if (closed) return null

    const close = () => {
        try { sessionStorage.setItem(CLOSE_KEY, '1') } catch { /* bỏ qua */ }
        setClosed(true)
    }

    const total = messages.join('').length
    const duration = Math.max(25, Math.round(total * 0.28)) // chữ càng dài chạy càng chậm, dễ đọc

    const track = (hidden) => (
        <div className="vip-marquee-group" aria-hidden={hidden || undefined}>
            {messages.map((m, i) => (
                <span key={i} className="vip-marquee-item">
          {m}
                    <span className="mx-6 opacity-70">✦</span>
        </span>
            ))}
        </div>
    )

    return (
        <div className="relative flex items-stretch bg-gradient-to-r from-orange-500 via-orange-500 to-amber-500 text-white text-sm font-semibold">
            <style>{`
        .vip-marquee-viewport { overflow: hidden; flex: 1; }
        .vip-marquee-track { display: flex; width: max-content; animation: vip-marquee ${duration}s linear infinite; }
        .vip-marquee-group { display: flex; flex-shrink: 0; }
        .vip-marquee-item { white-space: nowrap; }
        .vip-marquee-viewport:hover .vip-marquee-track,
        .vip-marquee-link:focus-visible .vip-marquee-track { animation-play-state: paused; }
        @keyframes vip-marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) {
          .vip-marquee-viewport { overflow-x: auto; }
          .vip-marquee-track { animation: none; }
        }
      `}</style>

            <Link
                to="/vip"
                aria-label="Xem các gói thẻ VIP đẩy tin"
                className="vip-marquee-link flex-1 min-w-0 py-2 hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
            >
                <div className="vip-marquee-viewport">
                    <div className="vip-marquee-track">
                        {track(false)}
                        {track(true)}
                    </div>
                </div>
            </Link>

            <button
                type="button"
                onClick={close}
                aria-label="Tắt thông báo thẻ VIP"
                className="px-3 text-lg leading-none bg-orange-600/60 hover:bg-orange-700/70 transition-colors"
            >
                ×
            </button>
        </div>
    )
}