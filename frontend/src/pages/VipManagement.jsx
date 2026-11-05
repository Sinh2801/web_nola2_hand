import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../utils/api'

const ORANGE = '#f97316'
const formatVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(Number(n || 0))) + ' ₫'
const formatDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN') : '—')
const pad2 = (n) => String(n).padStart(2, '0')

const TYPE_LABEL = { pin: '🚀 Đẩy top', highlight: '⭐ Nổi bật', combo: '👑 Combo' }
const STATUS = {
    pending: ['Chờ thanh toán', 'bg-yellow-100 text-yellow-700'],
    paid: ['Đã thanh toán', 'bg-green-100 text-green-700'],
    expired: ['Hết hạn', 'bg-gray-100 text-gray-600'],
    cancelled: ['Đã hủy', 'bg-red-100 text-red-600']
}

const EMPTY_FORM = {
    name: '', description: '', type: 'pin', durationDays: 1, quantity: 1,
    validDays: 90, price: 10000, originalPrice: 0, badge: '', sortOrder: 0, isActive: true
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm'

export default function VipManagement() {
    const [tab, setTab] = useState('overview')
    const [notice, setNotice] = useState(null)
    const flash = (type, text) => setNotice({ type, text })

    return (
        <div className="max-w-6xl mx-auto px-4 py-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <div>
                    <Link to="/admin" className="text-sm text-gray-500 hover:underline">← Bảng điều khiển</Link>
                    <h1 className="text-2xl font-black text-gray-900 dark:text-white mt-1">Quản lý thẻ VIP</h1>
                </div>
            </div>

            {notice && (
                <div role="alert" className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium flex justify-between gap-3 ${
                    notice.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    <span>{notice.text}</span>
                    <button type="button" aria-label="Đóng thông báo" onClick={() => setNotice(null)} className="font-bold">×</button>
                </div>
            )}

            <div className="inline-flex flex-wrap rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6" role="tablist">
                {[['overview', 'Tổng quan'], ['packages', 'Gói thẻ'], ['purchases', 'Giao dịch'], ['grant', 'Tặng thẻ']].map(([k, label]) => (
                    <button
                        key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                        className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                            tab === k ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-300 shadow-sm'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}`}
                    >{label}</button>
                ))}
            </div>

            {tab === 'overview' && <Overview flash={flash} />}
            {tab === 'packages' && <Packages flash={flash} />}
            {tab === 'purchases' && <Purchases flash={flash} />}
            {tab === 'grant' && <Grant flash={flash} />}
        </div>
    )
}

/* ───────── Tổng quan ───────── */
function Overview({ flash }) {
    const [stats, setStats] = useState(null)

    useEffect(() => {
        api.get('/vip/admin/stats')
            .then((r) => setStats(r.data.data))
            .catch((e) => flash('error', e.response?.data?.message || 'Không tải được thống kê'))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Điền 0 cho ngày không có đơn để trục thời gian liền mạch (30 ngày gần nhất)
    const daily = useMemo(() => {
        if (!stats) return []
        const map = new Map(stats.dailyRevenue.map((d) => [d._id, d]))
        const out = []
        const today = new Date()
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i)
            const key = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
            const r = map.get(key)
            out.push({ label: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`, revenue: r?.revenue || 0, count: r?.count || 0 })
        }
        return out
    }, [stats])

    if (!stats) return <p className="text-gray-500">Đang tải...</p>

    const cards = [
        ['Doanh thu thẻ VIP', formatVND(stats.totalRevenue), 'Chỉ tính thẻ khách mua'],
        ['Số thẻ đã bán', stats.totalSold, `${stats.grantedCount} thẻ tặng không tính`],
        ['Sản phẩm đang được ghim', stats.activeBoostedProducts, 'Còn hạn thẻ đẩy top'],
        ['Đơn chờ thanh toán', stats.pendingCount, 'Tự hết hạn sau 30 phút']
    ]

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {cards.map(([label, value, hint], i) => (
                    <div key={label} className={`rounded-2xl p-5 ${i === 0
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                        : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700'}`}>
                        <p className={`text-sm font-medium ${i === 0 ? 'text-orange-50' : 'text-gray-500 dark:text-gray-400'}`}>{label}</p>
                        <p className={`mt-1 text-2xl font-black ${i === 0 ? '' : 'text-gray-900 dark:text-white'}`}>{value}</p>
                        <p className={`text-xs mt-0.5 ${i === 0 ? 'text-orange-100' : 'text-gray-400'}`}>{hint}</p>
                    </div>
                ))}
            </div>

            <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <h2 className="font-extrabold text-gray-900 dark:text-white mb-4">Doanh thu 30 ngày gần nhất</h2>
                <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                        <AreaChart data={daily} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="vipFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                                    <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="#9ca3af" strokeOpacity={0.2} vertical={false} />
                            <XAxis dataKey="label" interval="preserveStartEnd" tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} width={44} tick={{ fontSize: 12, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                            <Tooltip formatter={(v) => [formatVND(v), 'Doanh thu']} labelFormatter={(l) => `Ngày ${l}`} />
                            <Area type="monotone" dataKey="revenue" stroke={ORANGE} strokeWidth={2.5} fill="url(#vipFill)" />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
                <h2 className="font-extrabold text-gray-900 dark:text-white mb-4">Doanh thu theo gói</h2>
                {stats.byPackage.length === 0 ? (
                    <p className="text-sm text-gray-500">Chưa bán được thẻ nào.</p>
                ) : (
                    <div className="space-y-3">
                        {stats.byPackage.map((p) => (
                            <div key={p._id}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700 dark:text-gray-200">{p._id}</span>
                                    <span><b>{formatVND(p.revenue)}</b> <span className="text-gray-400 text-xs">({p.count} thẻ)</span></span>
                                </div>
                                <div className="h-2.5 rounded-full bg-orange-100 dark:bg-gray-700 overflow-hidden">
                                    <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                                         style={{ width: `${stats.totalRevenue ? (p.revenue / stats.totalRevenue) * 100 : 0}%` }} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

/* ───────── Gói thẻ ───────── */
function Packages({ flash }) {
    const [list, setList] = useState(null)
    const [form, setForm] = useState(null) // null | object (có _id nếu đang sửa)
    const [saving, setSaving] = useState(false)

    const load = useCallback(() => {
        api.get('/vip/admin/packages')
            .then((r) => setList(r.data.data))
            .catch((e) => flash('error', e.response?.data?.message || 'Không tải được gói thẻ'))
    }, [flash])
    useEffect(() => { load() }, [load])

    const save = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            const body = { ...form }
            delete body._id
            if (form._id) await api.put(`/vip/admin/packages/${form._id}`, body)
            else await api.post('/vip/admin/packages', body)
            flash('success', form._id ? 'Đã cập nhật gói thẻ' : 'Đã tạo gói thẻ')
            setForm(null)
            load()
        } catch (err) {
            flash('error', err.response?.data?.message || 'Không lưu được gói thẻ')
        } finally {
            setSaving(false)
        }
    }

    const toggle = async (p) => {
        try { await api.put(`/vip/admin/packages/${p._id}`, { isActive: !p.isActive }); load() }
        catch (err) { flash('error', err.response?.data?.message || 'Không đổi được trạng thái') }
    }

    const remove = async (p) => {
        if (!window.confirm(`Xóa gói "${p.name}"? Gói đã có người mua sẽ chỉ bị ẩn.`)) return
        try {
            const r = await api.delete(`/vip/admin/packages/${p._id}`)
            flash('success', r.data.message || 'Đã xóa')
            load()
        } catch (err) { flash('error', err.response?.data?.message || 'Không xóa được') }
    }

    const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

    return (
        <div>
            <div className="flex justify-end mb-4">
                <button type="button" onClick={() => setForm({ ...EMPTY_FORM })}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm">+ Thêm gói thẻ</button>
            </div>

            {list === null ? <p className="text-gray-500">Đang tải...</p> : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <table className="w-full text-sm">
                        <thead className="bg-orange-50/60 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Tên</th>
                            <th className="px-4 py-3 text-left font-semibold">Loại</th>
                            <th className="px-4 py-3 text-right font-semibold">Ngày × lượt</th>
                            <th className="px-4 py-3 text-right font-semibold">Giá</th>
                            <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                            <th className="px-4 py-3" />
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {list.map((p) => (
                            <tr key={p._id}>
                                <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-100">
                                    {p.name} {p.badge && <span className="ml-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">{p.badge}</span>}
                                </td>
                                <td className="px-4 py-3">{TYPE_LABEL[p.type]}</td>
                                <td className="px-4 py-3 text-right">{p.durationDays} ngày × {p.quantity}</td>
                                <td className="px-4 py-3 text-right font-bold text-orange-600">{formatVND(p.price)}</td>
                                <td className="px-4 py-3">
                                    <button type="button" onClick={() => toggle(p)}
                                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {p.isActive ? 'Đang bán' : 'Đã ẩn'}
                                    </button>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button type="button" onClick={() => setForm({ ...p })} className="text-orange-600 hover:underline mr-3">Sửa</button>
                                    <button type="button" onClick={() => remove(p)} className="text-red-600 hover:underline">Xóa</button>
                                </td>
                            </tr>
                        ))}
                        {list.length === 0 && (
                            <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">Chưa có gói thẻ. Chạy <code>node scripts/seedVipPackages.js</code> hoặc bấm “Thêm gói thẻ”.</td></tr>
                        )}
                        </tbody>
                    </table>
                </div>
            )}

            {form && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setForm(null)}>
                    <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Gói thẻ"
                          className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
                          onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">{form._id ? 'Sửa gói thẻ' : 'Thêm gói thẻ'}</h3>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Tên thẻ *
                            <input required className={inputCls} value={form.name} onChange={set('name')} maxLength={80} />
                        </label>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mô tả
                            <textarea rows="2" className={inputCls} value={form.description} onChange={set('description')} maxLength={300} />
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Loại thẻ *
                                <select className={inputCls} value={form.type} onChange={set('type')}>
                                    <option value="pin">Đẩy top</option>
                                    <option value="highlight">Nổi bật</option>
                                    <option value="combo">Combo (đẩy top + nổi bật)</option>
                                </select>
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nhãn (tùy chọn)
                                <input className={inputCls} value={form.badge} onChange={set('badge')} maxLength={30} placeholder="Phổ biến" />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số ngày / lượt *
                                <input required type="number" min="1" max="365" className={inputCls} value={form.durationDays} onChange={set('durationDays')} />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Số lượt dùng *
                                <input required type="number" min="1" max="100" className={inputCls} value={form.quantity} onChange={set('quantity')} />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giá (₫) *
                                <input required type="number" min="1000" step="500" className={inputCls} value={form.price} onChange={set('price')} />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Giá gốc (gạch ngang)
                                <input type="number" min="0" step="500" className={inputCls} value={form.originalPrice} onChange={set('originalPrice')} />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Hạn dùng thẻ (ngày)
                                <input type="number" min="1" max="730" className={inputCls} value={form.validDays} onChange={set('validDays')} />
                            </label>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Thứ tự hiển thị
                                <input type="number" className={inputCls} value={form.sortOrder} onChange={set('sortOrder')} />
                            </label>
                        </div>

                        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <input type="checkbox" checked={!!form.isActive} onChange={set('isActive')} /> Đang bán
                        </label>

                        <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setForm(null)} className="px-4 py-2 rounded-xl text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">Hủy</button>
                            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white">
                                {saving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

/* ───────── Giao dịch ───────── */
function Purchases({ flash }) {
    const [rows, setRows] = useState(null)
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 })
    const [status, setStatus] = useState('')
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

    const load = useCallback(() => {
        api.get('/vip/admin/purchases', { params: { status: status || undefined, search: search || undefined, page, limit: 20 } })
            .then((r) => { setRows(r.data.data); setPagination(r.data.pagination) })
            .catch((e) => flash('error', e.response?.data?.message || 'Không tải được giao dịch'))
    }, [status, search, page, flash])
    useEffect(() => { load() }, [load])

    const activate = async (p) => {
        if (!window.confirm(`Kích hoạt thủ công đơn ${p.transactionCode}? Chỉ làm khi đã chắc chắn nhận được tiền.`)) return
        try { await api.put(`/vip/admin/purchases/${p._id}/activate`, {}); flash('success', 'Đã kích hoạt thẻ'); load() }
        catch (e) { flash('error', e.response?.data?.message || 'Không kích hoạt được') }
    }

    return (
        <div>
            <div className="flex flex-wrap gap-2 mb-4">
                <select aria-label="Lọc trạng thái" className={`${inputCls} !w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
                    <option value="">Tất cả trạng thái</option>
                    {Object.entries(STATUS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
                </select>
                <input aria-label="Tìm theo mã giao dịch" className={`${inputCls} !w-64`} placeholder="Tìm theo mã giao dịch"
                       value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
            </div>

            {rows === null ? <p className="text-gray-500">Đang tải...</p> : (
                <div className="overflow-x-auto rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <table className="w-full text-sm">
                        <thead className="bg-orange-50/60 dark:bg-gray-900/40 text-gray-500 dark:text-gray-400">
                        <tr>
                            <th className="px-4 py-3 text-left font-semibold">Mã GD</th>
                            <th className="px-4 py-3 text-left font-semibold">Người mua</th>
                            <th className="px-4 py-3 text-left font-semibold">Thẻ</th>
                            <th className="px-4 py-3 text-right font-semibold">Số tiền</th>
                            <th className="px-4 py-3 text-left font-semibold">Ngày tạo</th>
                            <th className="px-4 py-3 text-left font-semibold">Trạng thái</th>
                            <th className="px-4 py-3" />
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {rows.map((p) => {
                            const [label, cls] = STATUS[p.status] || STATUS.paid
                            return (
                                <tr key={p._id}>
                                    <td className="px-4 py-3 font-mono text-xs">{p.transactionCode}</td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-gray-800 dark:text-gray-100">{p.userId?.name || '—'}</div>
                                        <div className="text-xs text-gray-400">{p.userId?.email}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {p.packageSnapshot?.name}
                                        {p.source === 'admin_grant' && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Tặng</span>}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-orange-600">{formatVND(p.amount)}</td>
                                    <td className="px-4 py-3 text-gray-500">{formatDateTime(p.createdAt)}</td>
                                    <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span></td>
                                    <td className="px-4 py-3 text-right">
                                        {(p.status === 'pending' || p.status === 'expired') && (
                                            <button type="button" onClick={() => activate(p)} className="text-orange-600 hover:underline">Kích hoạt</button>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {rows.length === 0 && <tr><td colSpan="7" className="px-4 py-8 text-center text-gray-500">Không có giao dịch.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {pagination.pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4 text-sm">
                    <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 rounded-lg border disabled:opacity-40">Trước</button>
                    <span>Trang {pagination.page}/{pagination.pages}</span>
                    <button type="button" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 rounded-lg border disabled:opacity-40">Sau</button>
                </div>
            )}
        </div>
    )
}

/* ───────── Tặng thẻ ───────── */
function Grant({ flash }) {
    const [packages, setPackages] = useState([])
    const [email, setEmail] = useState('')
    const [packageId, setPackageId] = useState('')
    const [note, setNote] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        api.get('/vip/admin/packages').then((r) => {
            setPackages(r.data.data)
            if (r.data.data[0]) setPackageId(r.data.data[0]._id)
        }).catch(() => {})
    }, [])

    const submit = async (e) => {
        e.preventDefault()
        setSaving(true)
        try {
            await api.post('/vip/admin/grant', { email, packageId, note })
            flash('success', `Đã tặng thẻ cho ${email}`)
            setEmail(''); setNote('')
        } catch (err) {
            flash('error', err.response?.data?.message || 'Không tặng được thẻ')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={submit} className="max-w-md rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Tặng thẻ miễn phí cho khuyến mãi hoặc bồi thường. Thẻ tặng không tính vào doanh thu.</p>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email người nhận *
                <input required type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="22130001@st.hcmuaf.edu.vn" />
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Gói thẻ *
                <select required className={inputCls} value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                    {packages.map((p) => <option key={p._id} value={p._id}>{p.name} ({formatVND(p.price)})</option>)}
                </select>
            </label>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Ghi chú
                <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lý do tặng" />
            </label>
            <button type="submit" disabled={saving || !packageId} className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl">
                {saving ? 'Đang tặng...' : 'Tặng thẻ'}
            </button>
        </form>
    )
}