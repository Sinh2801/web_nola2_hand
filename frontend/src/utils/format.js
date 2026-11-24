// Định dạng tiền chuẩn VND: 1.250.000 ₫
const vndFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0
})

export const formatVND = (n) => vndFormatter.format(Math.round(Number(n) || 0))

const CONDITION_LABELS = {
    New: 'Mới',
    'Like New': 'Như mới',
    Excellent: 'Rất tốt',
    Good: 'Tốt',
    Fair: 'Khá',
    Used: 'Đã dùng nhiều',
    NeedsRepair: 'Cần sửa chữa'
}
export const conditionLabel = (c) => CONDITION_LABELS[c] || c || ''

const LOCATION_LABELS = {
    Campus: 'Khuôn viên trường',
    Dormitory: 'Ký túc xá',
    Nearby: 'Khu vực lân cận'
}
export const locationLabel = (l) => LOCATION_LABELS[l] || l || ''

// "3 phút trước", "2 ngày trước"...
export const timeAgo = (date) => {
    if (!date) return ''
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'vừa xong'
    if (m < 60) return `${m} phút trước`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h} giờ trước`
    const d = Math.floor(h / 24)
    if (d < 30) return `${d} ngày trước`
    return new Date(date).toLocaleDateString('vi-VN')
}

// Rút gọn tiền: 50k, 1,5tr, 2 tỷ (dùng cho nhãn ngắn)
const trim1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',')
export const formatShort = (n) => {
    const v = Number(n) || 0
    if (v >= 1e9) return `${trim1(v / 1e9)} tỷ`
    if (v >= 1e6) return `${trim1(v / 1e6)}tr`
    if (v >= 1e3) return `${trim1(v / 1e3)}k`
    return String(v)
}

// Danh mục của mã giảm giá (tiếng Anh trong DB) -> tiếng Việt
const COUPON_CATEGORY_LABELS = {
    Books: 'Sách',
    Electronics: 'Điện tử',
    Furniture: 'Nội thất',
    Clothing: 'Quần áo',
    Stationery: 'Văn phòng phẩm',
    Sports: 'Thể thao',
    Other: 'Khác'
}
export const couponCategoryLabel = (c) => COUPON_CATEGORY_LABELS[c] || c