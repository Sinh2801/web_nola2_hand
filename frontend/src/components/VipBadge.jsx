import React from 'react'

const active = (d) => !!d && new Date(d) > new Date()

export const isPinned = (product) => active(product?.vipPinnedUntil)
export const isHighlighted = (product) => active(product?.vipHighlightUntil)

// Viền nổi bật cho thẻ sản phẩm (nối vào className của khung card)
export const vipCardClass = (product) =>
    isHighlighted(product) ? 'ring-2 ring-orange-400 shadow-orange-200 dark:shadow-orange-900/40' : ''

// Huy hiệu góc phải trên của ảnh (góc trái dành cho nhãn AI). Đặt trong phần tử có class "relative".
export default function VipBadge({ product, className = 'absolute top-2 right-2 z-10' }) {
    const pinned = isPinned(product)
    const highlighted = isHighlighted(product)
    if (!pinned && !highlighted) return null

    return (
        <div className={`${className} flex flex-col gap-1 items-end`}>
            {pinned && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shadow bg-gradient-to-r from-orange-500 to-amber-400 text-white">
          👑 VIP
        </span>
            )}
            {highlighted && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shadow bg-white text-orange-600 border border-orange-300">
          ⭐ Nổi bật
        </span>
            )}
        </div>
    )
}