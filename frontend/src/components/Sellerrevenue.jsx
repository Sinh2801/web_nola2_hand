import React, { useState, useMemo } from 'react';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LabelList,
} from 'recharts';

/* ====================== Helper ====================== */

const ORANGE = '#f97316';
const AXIS = '#9ca3af';

// Chuẩn VND: 17.905.000 ₫ (làm tròn, không có phần lẻ)
const vndFormatter = new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
});
const formatVND = (n) => vndFormatter.format(Math.round(Number(n || 0)));

const trim1 = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const formatShort = (n) => {
    const v = Number(n || 0);
    if (v >= 1e9) return `${trim1(v / 1e9)} tỷ`;
    if (v >= 1e6) return `${trim1(v / 1e6)} tr`;
    if (v >= 1e3) return `${trim1(v / 1e3)}k`;
    return String(v);
};

const niceTicks = (max, count = 4) => {
    if (!max || max <= 0) return { ticks: [0, 1], top: 1 };
    const rough = max / count;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const norm = rough / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const top = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
    return { ticks, top };
};

const pad2 = (n) => String(n).padStart(2, '0');
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};
const toDM = (s) => { const [, m, d] = s.split('-'); return `${d}/${m}`; };
const toDMY = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };

// Điền các ngày không có đơn bằng 0 (tối thiểu 30 ngày gần nhất)
function buildDaily(rows) {
    const map = new Map((rows || []).map((r) => [r._id, r]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const keys = [...map.keys()].sort();
    const minDay = new Date(today);
    minDay.setDate(minDay.getDate() - 29);
    let start = minDay;
    let end = today;
    if (keys.length) {
        const first = parseISO(keys[0]);
        const last = parseISO(keys[keys.length - 1]);
        if (first < start) start = first;
        if (last > end) end = last;
    }
    const out = [];
    const cur = new Date(start);
    let guard = 0;
    while (cur <= end && guard < 400) {
        const key = toISO(cur);
        const r = map.get(key);
        out.push({
            key,
            label: toDM(key),
            full: toDMY(key),
            revenue: r ? Number(r.revenue || 0) : 0,
            count: r ? Number(r.count || 0) : 0,
        });
        cur.setDate(cur.getDate() + 1);
        guard += 1;
    }
    return out;
}

// Điền các tháng không có đơn bằng 0 (tối thiểu 12 tháng gần nhất)
function buildMonthly(rows) {
    const map = new Map((rows || []).map((r) => [r._id, r]));
    const now = new Date();
    let sy = now.getFullYear();
    let sm = now.getMonth() + 1 - 11;
    while (sm < 1) { sm += 12; sy -= 1; }
    let ey = now.getFullYear();
    let em = now.getMonth() + 1;
    const keys = [...map.keys()].sort();
    if (keys.length) {
        const [fy, fm] = keys[0].split('-').map(Number);
        if (fy < sy || (fy === sy && fm < sm)) { sy = fy; sm = fm; }
        const [ly, lm] = keys[keys.length - 1].split('-').map(Number);
        if (ly > ey || (ly === ey && lm > em)) { ey = ly; em = lm; }
    }
    const out = [];
    let y = sy, m = sm, guard = 0;
    while ((y < ey || (y === ey && m <= em)) && guard < 120) {
        const key = `${y}-${pad2(m)}`;
        const r = map.get(key);
        out.push({
            key,
            label: `${pad2(m)}/${y}`,
            full: `Tháng ${pad2(m)}/${y}`,
            revenue: r ? Number(r.revenue || 0) : 0,
            count: r ? Number(r.count || 0) : 0,
        });
        m += 1;
        if (m > 12) { m = 1; y += 1; }
        guard += 1;
    }
    return out;
}

/* ====================== UI nhỏ ====================== */

function Segmented({ options, value, onChange, label }) {
    return (
        <div role="group" aria-label={label} className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-900/60 p-1">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                        value === o.value
                            ? 'bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-300 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function HeroCard({ value, hint }) {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/25">
            <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full bg-white/10" />
            <p className="relative text-sm font-medium text-orange-50">Tổng doanh thu</p>
            <p className="relative mt-1 text-3xl font-black tracking-tight">{value}</p>
            <p className="relative mt-1 text-xs text-orange-100">{hint}</p>
        </div>
    );
}

function StatCard({ icon, label, value, hint }) {
    return (
        <div className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400">
        <span className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-500/15 flex items-center justify-center text-sm">
          {icon}
        </span>
                {label}
            </div>
            <p className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-white truncate">{value}</p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{hint}</p>
        </div>
    );
}

function ChartTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="rounded-xl border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-xl min-w-[170px]">
            <p className="font-bold text-gray-900 dark:text-white">{d.full}</p>
            <div className="mt-2 flex items-center justify-between gap-6">
                <span className="text-gray-500 dark:text-gray-400">Doanh thu</span>
                <span className="font-bold text-orange-600 dark:text-orange-400">{formatVND(d.revenue)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-6">
                <span className="text-gray-500 dark:text-gray-400">Giao dịch</span>
                <span className="font-semibold text-gray-800 dark:text-gray-100">{d.count}</span>
            </div>
        </div>
    );
}

/* ====================== Component chính ====================== */

export default function SellerRevenue({ stats, rangeText }) {
    const [view, setView] = useState('day'); // 'day' | 'month'

    const daily = useMemo(() => buildDaily(stats.dailyRevenue), [stats.dailyRevenue]);
    const monthly = useMemo(() => buildMonthly(stats.monthlyRevenue), [stats.monthlyRevenue]);
    const data = view === 'day' ? daily : monthly;

    const totalRevenue = Number(stats.totalRevenue || 0);
    const totalOrders = Number(stats.totalOrders || 0);
    const avg = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    const { ticks, top } = useMemo(() => niceTicks(Math.max(0, ...data.map((d) => d.revenue))), [data]);
    const hasData = data.some((d) => d.revenue > 0);
    const peak = data.reduce((best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best), null);

    const tableRows = useMemo(
        () => data.filter((d) => d.revenue > 0 || d.count > 0).sort((a, b) => b.key.localeCompare(a.key)),
        [data]
    );
    const tableTotal = tableRows.reduce((s, r) => s + r.revenue, 0);

    const categories = stats.revenueByCategory || [];
    const catTotal = categories.reduce((s, c) => s + Number(c.revenue || 0), 0);

    const rotate = data.length > 14;
    const axes = (
        <>
            <CartesianGrid stroke={AXIS} strokeOpacity={0.2} vertical={false} />
            <XAxis
                dataKey="label"
                interval={data.length > 16 ? 'preserveStartEnd' : 0}
                angle={rotate ? -45 : 0}
                textAnchor={rotate ? 'end' : 'middle'}
                height={rotate ? 56 : 30}
                tick={{ fontSize: 12, fill: AXIS }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
            />
            <YAxis
                domain={[0, top]}
                ticks={ticks}
                tickFormatter={formatShort}
                width={52}
                tick={{ fontSize: 12, fill: AXIS }}
                axisLine={false}
                tickLine={false}
            />
            <Tooltip
                content={<ChartTooltip />}
                cursor={view === 'day' ? { stroke: ORANGE, strokeDasharray: '4 4' } : { fill: 'rgba(249,115,22,0.08)' }}
            />
        </>
    );

    return (
        <div className="space-y-6 mb-6">
            {/* Thẻ tổng quan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <HeroCard value={formatVND(totalRevenue)} hint={rangeText} />
                <StatCard icon="🧾" label="Số giao dịch" value={totalOrders.toLocaleString('vi-VN')} hint="Đơn hàng đã hoàn thành" />
                <StatCard icon="📊" label="Trung bình mỗi đơn" value={formatVND(avg)} hint="Giá trị trung bình" />
            </div>

            {/* Biểu đồ theo thời gian */}
            <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                    <div>
                        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                            Doanh thu theo {view === 'day' ? 'ngày' : 'tháng'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {view === 'day' ? '30 ngày gần nhất' : '12 tháng gần nhất'}
                            {peak && peak.revenue > 0 && (
                                <> · cao nhất <span className="font-semibold text-orange-600 dark:text-orange-400">{peak.full}</span> ({formatVND(peak.revenue)})</>
                            )}
                        </p>
                    </div>
                    <Segmented
                        label="Gom nhóm"
                        value={view}
                        onChange={setView}
                        options={[
                            { value: 'day', label: 'Theo ngày' },
                            { value: 'month', label: 'Theo tháng' },
                        ]}
                    />
                </div>

                {hasData ? (
                    <div style={{ width: '100%', height: 320 }}>
                        <ResponsiveContainer>
                            {view === 'day' ? (
                                <AreaChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                                    <defs>
                                        <linearGradient id="sellerArea" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                                            <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                                        </linearGradient>
                                    </defs>
                                    {axes}
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke={ORANGE}
                                        strokeWidth={2.5}
                                        fill="url(#sellerArea)"
                                        dot={false}
                                        activeDot={{ r: 6, fill: ORANGE, stroke: '#fff', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            ) : (
                                <BarChart data={data} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
                                    <defs>
                                        <linearGradient id="sellerBar" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#fb923c" />
                                            <stop offset="100%" stopColor="#ea580c" />
                                        </linearGradient>
                                    </defs>
                                    {axes}
                                    <Bar dataKey="revenue" fill="url(#sellerBar)" radius={[8, 8, 0, 0]} maxBarSize={48}>
                                        <LabelList
                                            dataKey="revenue"
                                            position="top"
                                            formatter={(v) => (v ? formatShort(v) : '')}
                                            style={{ fontSize: 11, fontWeight: 600, fill: ORANGE }}
                                        />
                                    </Bar>
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-orange-200 dark:border-gray-700 bg-orange-50/40 dark:bg-gray-800/40 py-12 text-center">
                        <div className="text-3xl mb-1">📭</div>
                        <p className="font-bold text-gray-800 dark:text-gray-200">Chưa có doanh thu</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Doanh thu sẽ hiển thị khi có đơn hàng hoàn thành.</p>
                    </div>
                )}
            </section>

            {/* Bảng chi tiết */}
            {tableRows.length > 0 && (
                <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
                    <div className="p-5 sm:p-6 pb-4">
                        <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                            Chi tiết theo {view === 'day' ? 'ngày' : 'tháng'}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {tableRows.length} {view === 'day' ? 'ngày' : 'tháng'} có doanh thu
                        </p>
                    </div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0">
                            <tr className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 border-y border-gray-100 dark:border-gray-700">
                                <th className="px-5 py-3 font-semibold text-left">{view === 'day' ? 'Ngày' : 'Tháng'}</th>
                                <th className="px-5 py-3 font-semibold text-right">Giao dịch</th>
                                <th className="px-5 py-3 font-semibold text-right">Doanh thu</th>
                            </tr>
                            </thead>
                            <tbody>
                            {tableRows.map((r) => (
                                <tr key={r.key} className="border-b border-gray-50 dark:border-gray-700/60 hover:bg-orange-50/50 dark:hover:bg-gray-700/40 transition-colors">
                                    <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-gray-100">{view === 'day' ? r.full : r.label}</td>
                                    <td className="px-5 py-3.5 text-right text-gray-600 dark:text-gray-300">{r.count}</td>
                                    <td className="px-5 py-3.5 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">{formatVND(r.revenue)}</td>
                                </tr>
                            ))}
                            </tbody>
                            <tfoot className="sticky bottom-0">
                            <tr className="bg-orange-50 dark:bg-gray-900">
                                <td className="px-5 py-3.5 font-extrabold text-gray-900 dark:text-white" colSpan={2}>Tổng cộng</td>
                                <td className="px-5 py-3.5 text-right font-extrabold text-orange-600 dark:text-orange-400 whitespace-nowrap">{formatVND(tableTotal)}</td>
                            </tr>
                            </tfoot>
                        </table>
                    </div>
                </section>
            )}

            {/* Doanh thu theo danh mục */}
            {categories.length > 0 && (
                <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Doanh thu theo danh mục</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 mb-5">Tỷ trọng so với tổng doanh thu các danh mục</p>
                    <div className="space-y-4">
                        {[...categories]
                            .sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0))
                            .map((cat) => {
                                const pct = catTotal > 0 ? (Number(cat.revenue || 0) / catTotal) * 100 : 0;
                                return (
                                    <div key={cat._id}>
                                        <div className="flex items-center justify-between gap-3 mb-1.5">
                                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{cat._id}</span>
                                            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        <span className="font-bold text-gray-900 dark:text-white">{formatVND(cat.revenue)}</span>
                                                {' · '}{cat.count} sản phẩm · {pct.toFixed(0)}%
                      </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-orange-100 dark:bg-gray-700 overflow-hidden">
                                            <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-500" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </section>
            )}
        </div>
    );
}