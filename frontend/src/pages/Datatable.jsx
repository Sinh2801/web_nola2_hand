import { useState, useEffect, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, LabelList, PieChart, Pie, Cell,
} from "recharts";
import api from "../utils/api";

/* ====================== Cấu hình & helper ====================== */

const FEE_RATE = 0.05; // 5% phí sàn
const ORANGE = "#f97316";
const AXIS = "#9ca3af";

const fee = (n) => Math.round(Number(n || 0) * FEE_RATE);

// Chuẩn VND: 40.750 ₫
const vndFormatter = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const formatVND = (n) => vndFormatter.format(Number(n || 0));

// Rút gọn cho trục biểu đồ: 500k, 1,5 tr, 2 tỷ
const trim1 = (x) => String(Math.round(x * 10) / 10).replace(".", ",");
const formatShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1e9) return `${trim1(v / 1e9)} tỷ`;
  if (v >= 1e6) return `${trim1(v / 1e6)} tr`;
  if (v >= 1e3) return `${trim1(v / 1e3)}k`;
  return String(v);
};

// Mốc trục Y tròn (0, 5k, 10k, ...)
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

/* ---- Ngày tháng (chuỗi YYYY-MM-DD, tính theo UTC) ---- */
const parseDay = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const dayStr = (dt) => dt.toISOString().slice(0, 10);
const addDays = (s, n) => {
  const dt = parseDay(s);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dayStr(dt);
};
const toDM = (s) => {
  const [, m, d] = s.split("-");
  return `${d}/${m}`;
};
const toDMY = (s) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};
const weekStart = (s) => {
  const dt = parseDay(s);
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dayStr(dt);
};

const makeKeyLabel = (s, groupBy) => {
  if (groupBy === "week") {
    const key = weekStart(s);
    return { key, label: `Tuần ${toDM(key)}`, full: `Tuần bắt đầu ${toDMY(key)}` };
  }
  if (groupBy === "month") {
    const key = s.slice(0, 7);
    const label = `${key.slice(5)}/${key.slice(0, 4)}`;
    return { key, label, full: `Tháng ${label}` };
  }
  return { key: s, label: toDM(s), full: toDMY(s) };
};

// Điền các mốc không có đơn bằng 0 để trục thời gian liền mạch
function fillGaps(items, groupBy) {
  if (items.length < 2) return items;
  const byKey = new Map(items.map((i) => [i.key, i]));
  const first = items[0].key;
  const last = items[items.length - 1].key;
  const out = [];

  if (groupBy === "month") {
    let [y, m] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    while (y < ly || (y === ly && m <= lm)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      out.push(byKey.get(key) || { ...makeKeyLabel(`${key}-01`, "month"), sodon: 0, doanhthu: 0 });
      m += 1;
      if (m > 12) { m = 1; y += 1; }
    }
    return out;
  }

  const stepDays = groupBy === "week" ? 7 : 1;
  let cur = first;
  let guard = 0;
  while (cur <= last && guard < 800) {
    out.push(byKey.get(cur) || { ...makeKeyLabel(cur, groupBy), sodon: 0, doanhthu: 0 });
    cur = addDays(cur, stepDays);
    guard += 1;
  }
  return out;
}

function buildChartData(result, groupBy, bounds) {
  if (result.mode === "orders") {
    return result.rows.map((r) => ({
      key: r.id, label: r.id, full: r.id, sanpham: r.sanpham, sodon: 1, doanhthu: fee(r.doanhthu),
    }));
  }
  const map = new Map();
  for (const r of result.rows) {
    const { key, label, full } = makeKeyLabel(r.day, groupBy);
    const cur = map.get(key) || { key, label, full, sodon: 0, doanhthu: 0 };
    cur.sodon += r.sodon;
    cur.doanhthu += fee(r.doanhthu);
    map.set(key, cur);
  }
  // Khoảng tùy chọn: kéo trục thời gian phủ đủ từ ngày bắt đầu đến ngày kết thúc
  if (bounds) {
    for (const d of [bounds.start, bounds.end]) {
      const kl = makeKeyLabel(d, groupBy);
      if (!map.has(kl.key)) map.set(kl.key, { ...kl, sodon: 0, doanhthu: 0 });
    }
  }
  const sorted = [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  return fillGaps(sorted, groupBy);
}

// Danh sách số trang có dấu "…"
const pageList = (cur, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  const arr = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  arr.forEach((p, i) => {
    if (i && p - arr[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
};

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/* ====================== UI nhỏ ====================== */

function Segmented({ options, value, onChange, label, size = "md" }) {
  const pad = size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm";
  return (
      <div
          role="group"
          aria-label={label}
          className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-900/60 p-1"
      >
        {options.map((o) => (
            <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={`${pad} font-semibold rounded-lg transition-all whitespace-nowrap ${
                    value === o.value
                        ? "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-300 shadow-sm"
                        : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
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
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-5 text-white shadow-lg shadow-orange-500/25 col-span-2 lg:col-span-1">
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
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate min-h-[1rem]">{hint}</p>
      </div>
  );
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
      <div className="rounded-xl border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-xl min-w-[170px]">
        <p className="font-bold text-gray-900 dark:text-white">{d.sanpham || d.full}</p>
        <div className="mt-2 flex items-center justify-between gap-6">
          <span className="text-gray-500 dark:text-gray-400">Doanh thu</span>
          <span className="font-bold text-orange-600 dark:text-orange-400">{formatVND(d.doanhthu)}</span>
        </div>
        {!d.sanpham && (
            <div className="mt-1 flex items-center justify-between gap-6">
              <span className="text-gray-500 dark:text-gray-400">Số đơn</span>
              <span className="font-semibold text-gray-800 dark:text-gray-100">{d.sodon}</span>
            </div>
        )}
      </div>
  );
}

function Skeleton() {
  return (
      <div className="animate-pulse space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
        <div className="h-96 rounded-2xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-72 rounded-2xl bg-gray-100 dark:bg-gray-800" />
      </div>
  );
}

function Empty() {
  return (
      <div className="rounded-2xl border border-dashed border-orange-200 dark:border-gray-700 bg-orange-50/40 dark:bg-gray-800/40 py-16 text-center">
        <div className="text-4xl mb-2">📭</div>
        <p className="font-bold text-gray-800 dark:text-gray-200">Chưa có doanh thu</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Không có giao dịch nào trong khoảng thời gian này. Hãy thử chọn kỳ khác.
        </p>
      </div>
  );
}

function SortHead({ label, k, sort, onSort, align = "left" }) {
  const active = sort?.key === k;
  return (
      <th className={`px-5 py-3 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
        <button
            type="button"
            onClick={() => onSort(k)}
            className={`inline-flex items-center gap-1 hover:text-orange-600 dark:hover:text-orange-300 transition-colors ${
                active ? "text-orange-600 dark:text-orange-300" : ""
            }`}
        >
          {label}
          <span className="text-[10px] leading-none">{active ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}</span>
        </button>
      </th>
  );
}

/* ====================== Biểu đồ tròn: cơ cấu doanh thu ====================== */

const PIE_COLORS = ["#f97316", "#6366f1", "#14b8a6", "#f43f5e", "#fbbf24", "#8b5cf6", "#94a3b8"];
const METHOD_NAMES = { bank_transfer: "Chuyển khoản", momo: "Ví MoMo", vnpay: "VNPay" };
const STATUS_META = {
  confirmed: { name: "Thành công", color: "#22c55e" },
  pending: { name: "Chờ duyệt", color: "#f59e0b" },
  rejected: { name: "Bị từ chối", color: "#ef4444" },
};
const MAX_SLICES = 6;

// Giữ tối đa MAX_SLICES lát, phần còn lại gộp thành "Khác"
function limitSlices(items) {
  const sorted = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  if (sorted.length <= MAX_SLICES) return sorted;
  const head = sorted.slice(0, MAX_SLICES - 1);
  const rest = sorted.slice(MAX_SLICES - 1);
  return [
    ...head,
    {
      name: "Khác",
      value: rest.reduce((s, i) => s + i.value, 0),
      count: rest.reduce((s, i) => s + (i.count || 0), 0),
      color: "#94a3b8",
    },
  ];
}

// Gom dữ liệu từ /admin/revenue-stats thành các biểu đồ tròn
function buildPies(d) {
  if (!d) return [];
  const pies = [];

  if (d.categoryStats?.length) {
    pies.push({
      id: "category", label: "Danh mục", unit: "money", center: "Doanh thu",
      sub: "Doanh thu sàn theo danh mục sản phẩm",
      items: limitSlices(d.categoryStats.map((c) => ({ name: c._id || "Khác", value: fee(c.revenue), count: c.count }))),
    });
  }
  if (d.methodStats?.length) {
    pies.push({
      id: "method", label: "Thanh toán", unit: "money", center: "Doanh thu",
      sub: "Doanh thu sàn theo phương thức thanh toán",
      items: limitSlices(d.methodStats.map((m) => ({ name: METHOD_NAMES[m._id] || m._id || "Khác", value: fee(m.revenue), count: m.count }))),
    });
  }
  if (d.topProducts?.length) {
    pies.push({
      id: "product", label: "Sản phẩm", unit: "money", center: "Top 10",
      sub: "Doanh thu sàn của các sản phẩm bán chạy nhất",
      items: limitSlices(d.topProducts.map((p) => ({ name: p.title || "Sản phẩm", value: fee(p.revenue), count: p.count }))),
    });
  }
  const st = d.statusStats;
  if (st && Object.keys(st).length) {
    pies.push({
      id: "status", label: "Trạng thái", unit: "count", center: "Giao dịch",
      sub: "Số giao dịch theo trạng thái trong kỳ",
      items: ["confirmed", "pending", "rejected"]
          .filter((k) => st[k]?.count > 0)
          .map((k) => ({ name: STATUS_META[k].name, value: st[k].count, count: st[k].count, color: STATUS_META[k].color })),
    });
  }
  return pies.filter((p) => p.items.length > 0);
}

function RevenuePie({ data }) {
  const pies = useMemo(() => buildPies(data), [data]);
  const [tab, setTab] = useState("category");

  if (!pies.length) return null;

  const cur = pies.find((p) => p.id === tab) || pies[0];
  const total = cur.items.reduce((s, i) => s + i.value, 0);
  const isMoney = cur.unit === "money";
  const fmt = (v) => (isMoney ? formatVND(v) : `${Number(v).toLocaleString("vi-VN")} giao dịch`);
  const pctOf = (v) => (total > 0 ? ((v / total) * 100).toFixed(1).replace(".", ",") : "0");
  const colorOf = (it, i) => it.color || PIE_COLORS[i % PIE_COLORS.length];

  return (
      <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">Cơ cấu doanh thu</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{cur.sub}</p>
          </div>
          {pies.length > 1 && (
              <Segmented
                  size="sm"
                  label="Loại biểu đồ tròn"
                  value={cur.id}
                  onChange={setTab}
                  options={pies.map((p) => ({ value: p.id, label: p.label }))}
              />
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6 items-center">
          <div className="relative" style={{ height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                    data={cur.items}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="none"
                >
                  {cur.items.map((it, i) => (
                      <Cell key={it.name + i} fill={colorOf(it, i)} />
                  ))}
                </Pie>
                <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0];
                      return (
                          <div className="rounded-xl border border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-sm shadow-xl">
                            <p className="font-bold text-gray-900 dark:text-white max-w-[220px]">{p.name}</p>
                            <p className="mt-1 font-semibold text-orange-600 dark:text-orange-400">{fmt(p.value)}</p>
                            <p className="text-gray-500 dark:text-gray-400">{pctOf(p.value)}% tổng</p>
                          </div>
                      );
                    }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{cur.center}</span>
              <span className="text-2xl font-black text-gray-900 dark:text-white">
              {isMoney ? `${formatShort(total)} ₫` : total.toLocaleString("vi-VN")}
            </span>
            </div>
          </div>

          <ul className="space-y-3">
            {cur.items.map((it, i) => (
                <li key={it.name + i} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: colorOf(it, i) }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{it.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{it.count} {cur.unit === "money" ? "đơn" : "giao dịch"}</p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{fmt(it.value)}</p>
                    <p className="text-xs font-semibold text-orange-600 dark:text-orange-400">{pctOf(it.value)}%</p>
                  </div>
                </li>
            ))}
          </ul>
        </div>
      </section>
  );
}

/* ====================== Component chính ====================== */

export default function LoadRevanue({ filterType, timeRange, selectedDate, selectedMonth, startDate, endDate, breakdown }) {
  const [result, setResult] = useState({ mode: null, rows: [] });
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState("day");      // "day" | "week" | "month"
  const [metric, setMetric] = useState("doanhthu");   // "doanhthu" | "sodon"
  const [chartType, setChartType] = useState("auto"); // "auto" | "area" | "bar"
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(null);             // { key, dir }
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  // Gợi ý mặc định: xem theo năm -> gom theo tháng, ngược lại theo ngày
  useEffect(() => {
    if (filterType === "custom" && startDate && endDate) {
      const span = Math.round((parseDay(endDate) - parseDay(startDate)) / 86400000) + 1;
      setGroupBy(span <= 45 ? "day" : span <= 180 ? "week" : "month");
      return;
    }
    setGroupBy(filterType === "range" && (timeRange === "year" || timeRange === "all") ? "month" : "day");
  }, [filterType, timeRange, startDate, endDate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    // 'custom': lấy toàn bộ dữ liệu theo ngày rồi lọc từ ngày -> đến ngày ở bên dưới
    const isCustom = filterType === "custom";
    const params = { filterType: isCustom ? "range" : filterType };
    if (isCustom) {
      params.timeRange = "all";
      params.startDate = startDate;
      params.endDate = endDate;
    } else if (filterType === "range") params.timeRange = timeRange;
    else if (filterType === "date") params.date = selectedDate;
    else params.month = selectedMonth;

    api
        .get("/admin/revenue-table", { params })
        .then((res) => {
          if (!cancelled) {
            const data = res.data;
            const next =
                isCustom && data.mode !== "orders"
                    ? { ...data, rows: (data.rows || []).filter((r) => r.day >= startDate && r.day <= endDate) }
                    : data;
            setResult(next);
            setPage(1);
            setQuery("");
            setSort(null);
          }
        })
        .catch(console.error)
        .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [filterType, timeRange, selectedDate, selectedMonth, startDate, endDate]);

  const isOrders = result.mode === "orders";

  // ---- Dữ liệu biểu đồ ----
  const chartData = useMemo(
      () =>
          buildChartData(
              result,
              groupBy,
              filterType === "custom" && startDate && endDate ? { start: startDate, end: endDate } : null
          ),
      [result, groupBy, filterType, startDate, endDate]
  );
  const activeMetric = isOrders ? "doanhthu" : metric;
  const isMoney = activeMetric === "doanhthu";
  const fmtAxis = isMoney ? formatShort : (n) => String(n);

  const { ticks, top } = useMemo(
      () => niceTicks(Math.max(0, ...chartData.map((c) => c[activeMetric]))),
      [chartData, activeMetric]
  );

  const stats = useMemo(() => {
    const tong = result.rows.reduce((s, r) => s + fee(r.doanhthu), 0);
    const soDon = isOrders
        ? result.rows.length
        : result.rows.reduce((s, r) => s + Number(r.sodon || 0), 0);
    const tb = soDon ? Math.round(tong / soDon) : 0;
    const peak = chartData.reduce((best, c) => (c.doanhthu > (best?.doanhthu ?? -1) ? c : best), null);
    const avgPeriod = chartData.length ? chartData.reduce((s, c) => s + c[activeMetric], 0) / chartData.length : 0;
    return { tong, soDon, tb, peak, avgPeriod };
  }, [result, chartData, isOrders, activeMetric]);

  // ---- Dữ liệu bảng ----
  const rowsAll = useMemo(
      () =>
          result.rows.map((r) =>
              isOrders
                  ? { id: r.id, sanpham: r.sanpham, day: null, sodon: 1, value: fee(r.doanhthu) }
                  : { id: null, sanpham: null, day: r.day, sodon: Number(r.sodon || 0), value: fee(r.doanhthu) }
          ),
      [result, isOrders]
  );

  const maxValue = useMemo(() => Math.max(1, ...rowsAll.map((r) => r.value)), [rowsAll]);

  const activeSort = sort || (isOrders ? null : { key: "day", dir: "desc" });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rowsAll;
    return rowsAll.filter((r) =>
        isOrders
            ? `${r.id} ${r.sanpham}`.toLowerCase().includes(q)
            : `${toDMY(r.day)} ${r.day}`.includes(q)
    );
  }, [rowsAll, query, isOrders]);

  const sorted = useMemo(() => {
    if (!activeSort) return filtered;
    const { key, dir } = activeSort;
    const mul = dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const x = a[key], y = b[key];
      if (typeof x === "number" && typeof y === "number") return (x - y) * mul;
      return String(x ?? "").localeCompare(String(y ?? ""), "vi") * mul;
    });
  }, [filtered, activeSort]);

  const onSort = (key) => {
    setPage(1);
    setSort((prev) => {
      const cur = prev || activeSort;
      if (cur?.key === key) return { key, dir: cur.dir === "asc" ? "desc" : "asc" };
      return { key, dir: key === "id" || key === "sanpham" ? "asc" : "desc" };
    });
  };

  const totalFiltered = filtered.reduce((s, r) => s + r.value, 0);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const curPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((curPage - 1) * pageSize, curPage * pageSize);
  const from = sorted.length ? (curPage - 1) * pageSize + 1 : 0;
  const to = Math.min(curPage * pageSize, sorted.length);

  const exportCSV = () => {
    const head = isOrders
        ? ["Mã giao dịch", "Sản phẩm", "Doanh thu (VND)"]
        : ["Ngày", "Số đơn", "Doanh thu (VND)"];
    const lines = sorted.map((r) =>
        (isOrders ? [r.id, r.sanpham, r.value] : [toDMY(r.day), r.sodon, r.value]).map(csvCell).join(",")
    );
    const csv = "\uFEFF" + [head.map(csvCell).join(","), ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doanh-thu-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Skeleton />;
  if (result.rows.length === 0) return <Empty />;

  const useArea = chartType === "area" || (chartType === "auto" && chartData.length >= 4);
  const showLabels = chartData.length <= 12;
  const rotate = chartData.length > 12;
  const groupLabel = isOrders ? "từng giao dịch" : { day: "ngày", week: "tuần", month: "tháng" }[groupBy];

  const axes = (
      <>
        <CartesianGrid stroke={AXIS} strokeOpacity={0.2} vertical={false} />
        <XAxis
            dataKey="label"
            interval={chartData.length > 16 ? "preserveStartEnd" : 0}
            angle={rotate ? -45 : 0}
            textAnchor={rotate ? "end" : "middle"}
            height={rotate ? 60 : 32}
            tick={{ fontSize: 12, fill: AXIS }}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
        />
        <YAxis
            domain={[0, top]}
            ticks={ticks}
            tickFormatter={fmtAxis}
            width={52}
            tick={{ fontSize: 12, fill: AXIS }}
            axisLine={false}
            tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={useArea ? { stroke: ORANGE, strokeDasharray: "4 4" } : { fill: "rgba(249,115,22,0.08)" }} />
        {chartData.length >= 3 && stats.avgPeriod > 0 && (
            <ReferenceLine
                y={stats.avgPeriod}
                stroke="#fb923c"
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                label={{
                  value: `TB ${fmtAxis(Math.round(stats.avgPeriod))}`,
                  position: "insideTopRight",
                  fill: "#ea580c",
                  fontSize: 11,
                  fontWeight: 600,
                }}
            />
        )}
      </>
  );

  return (
      <div className="space-y-6">
        {/* ===== Thẻ tổng quan ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <HeroCard value={formatVND(stats.tong)} hint="Tính theo 5% phí sàn mỗi giao dịch" />
          <StatCard icon="🧾" label="Số đơn" value={stats.soDon.toLocaleString("vi-VN")} hint="Đơn đã thanh toán" />
          <StatCard icon="📊" label="Trung bình mỗi đơn" value={formatVND(stats.tb)} hint="Doanh thu sàn / đơn" />
          <StatCard
              icon="🏆"
              label={isOrders ? "Giao dịch cao nhất" : "Cao nhất"}
              value={stats.peak ? formatVND(stats.peak.doanhthu) : "—"}
              hint={stats.peak ? (stats.peak.sanpham || stats.peak.full) : ""}
          />
        </div>

        {/* ===== Biểu đồ ===== */}
        <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                {isMoney ? "Doanh thu" : "Số đơn"} theo {groupLabel}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {chartData.length} mốc thời gian
                {stats.peak && !isOrders && isMoney && (
                    <> · cao nhất <span className="font-semibold text-orange-600 dark:text-orange-400">{stats.peak.full}</span></>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isOrders && (
                  <Segmented
                      size="sm"
                      label="Chỉ số"
                      value={metric}
                      onChange={setMetric}
                      options={[
                        { value: "doanhthu", label: "Doanh thu" },
                        { value: "sodon", label: "Số đơn" },
                      ]}
                  />
              )}
              {!isOrders && (
                  <Segmented
                      size="sm"
                      label="Gom nhóm"
                      value={groupBy}
                      onChange={setGroupBy}
                      options={[
                        { value: "day", label: "Ngày" },
                        { value: "week", label: "Tuần" },
                        { value: "month", label: "Tháng" },
                      ]}
                  />
              )}
              <Segmented
                  size="sm"
                  label="Kiểu biểu đồ"
                  value={useArea ? "area" : "bar"}
                  onChange={setChartType}
                  options={[
                    { value: "area", label: "Vùng" },
                    { value: "bar", label: "Cột" },
                  ]}
              />
            </div>
          </div>

          <div style={{ width: "100%", height: 360 }}>
            <ResponsiveContainer>
              {useArea ? (
                  <AreaChart data={chartData} margin={{ top: 16, right: 12, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={ORANGE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    {axes}
                    <Area
                        type="monotone"
                        dataKey={activeMetric}
                        stroke={ORANGE}
                        strokeWidth={2.5}
                        fill="url(#areaFill)"
                        dot={chartData.length <= 14 ? { r: 3.5, fill: "#fff", stroke: ORANGE, strokeWidth: 2 } : false}
                        activeDot={{ r: 6, fill: ORANGE, stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
              ) : (
                  <BarChart data={chartData} margin={{ top: 24, right: 12, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb923c" />
                        <stop offset="100%" stopColor="#ea580c" />
                      </linearGradient>
                    </defs>
                    {axes}
                    <Bar dataKey={activeMetric} fill="url(#barFill)" radius={[8, 8, 0, 0]} maxBarSize={56}>
                      {showLabels && (
                          <LabelList
                              dataKey={activeMetric}
                              position="top"
                              formatter={(v) => (v ? fmtAxis(v) : "")}
                              style={{ fontSize: 12, fontWeight: 600, fill: ORANGE }}
                          />
                      )}
                    </Bar>
                  </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* ===== Biểu đồ tròn: cơ cấu doanh thu ===== */}
        <RevenuePie data={breakdown} />

        {/* ===== Bảng chi tiết ===== */}
        <section className="rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                {isOrders ? "Chi tiết giao dịch" : "Chi tiết theo ngày"}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {filtered.length.toLocaleString("vi-VN")} {isOrders ? "giao dịch" : "ngày có doanh thu"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 text-sm pointer-events-none">🔍</span>
                <input
                    type="search"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    placeholder={isOrders ? "Tìm mã hoặc sản phẩm" : "Tìm ngày, vd: 15/01"}
                    aria-label="Tìm kiếm trong bảng"
                    className="w-56 pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500"
                />
              </div>
              <button
                  type="button"
                  onClick={exportCSV}
                  className="px-3.5 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
              >
                Xuất CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 border-y border-gray-100 dark:border-gray-700">
                {isOrders ? (
                    <>
                      <SortHead label="Mã giao dịch" k="id" sort={activeSort} onSort={onSort} />
                      <SortHead label="Sản phẩm" k="sanpham" sort={activeSort} onSort={onSort} />
                    </>
                ) : (
                    <>
                      <SortHead label="Ngày" k="day" sort={activeSort} onSort={onSort} />
                      <SortHead label="Số đơn" k="sodon" sort={activeSort} onSort={onSort} align="right" />
                    </>
                )}
                <SortHead label="Doanh thu" k="value" sort={activeSort} onSort={onSort} align="right" />
                <th className="px-5 py-3 font-semibold text-left w-48 hidden md:table-cell">Tỷ trọng</th>
              </tr>
              </thead>
              <tbody>
              {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center text-gray-500 dark:text-gray-400">
                      Không tìm thấy kết quả cho “{query}”.
                    </td>
                  </tr>
              )}
              {pageRows.map((r, i) => {
                const pct = Math.round((r.value / maxValue) * 100);
                return (
                    <tr
                        key={(r.id || r.day) + "-" + i}
                        className="border-b border-gray-50 dark:border-gray-700/60 hover:bg-orange-50/50 dark:hover:bg-gray-700/40 transition-colors"
                    >
                      {isOrders ? (
                          <>
                            <td className="px-5 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">{r.id}</td>
                            <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-gray-100">{r.sanpham}</td>
                          </>
                      ) : (
                          <>
                            <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-gray-100">{toDMY(r.day)}</td>
                            <td className="px-5 py-3.5 text-right text-gray-600 dark:text-gray-300">{r.sodon}</td>
                          </>
                      )}
                      <td className="px-5 py-3.5 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                        {formatVND(r.value)}
                      </td>
                      <td className="px-5 py-3.5 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-orange-100 dark:bg-gray-700 overflow-hidden">
                            <div className="h-full rounded-full bg-orange-500" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-9 text-right text-xs text-gray-400">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                );
              })}
              </tbody>
              <tfoot>
              <tr className="bg-orange-50/70 dark:bg-gray-900/50">
                <td className="px-5 py-3.5 font-extrabold text-gray-900 dark:text-white" colSpan={2}>
                  {query.trim() ? "Tổng kết quả lọc" : "Tổng cộng"}
                </td>
                <td className="px-5 py-3.5 text-right font-extrabold text-orange-600 dark:text-orange-400 whitespace-nowrap">
                  {formatVND(totalFiltered)}
                </td>
                <td className="hidden md:table-cell" />
              </tr>
              </tfoot>
            </table>
          </div>

          {/* Phân trang */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-gray-700 text-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <span>Hiển thị</span>
              <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  aria-label="Số dòng mỗi trang"
                  className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40"
              >
                {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <span>dòng · {from}–{to} / {sorted.length}</span>
            </div>

            <nav className="flex items-center gap-1" aria-label="Phân trang">
              <button
                  type="button"
                  disabled={curPage === 1}
                  onClick={() => setPage(curPage - 1)}
                  className="px-3 py-1.5 rounded-lg font-semibold text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              {pageList(curPage, totalPages).map((p) =>
                  typeof p === "string" ? (
                      <span key={p} className="px-1 text-gray-400">…</span>
                  ) : (
                      <button
                          key={p}
                          type="button"
                          onClick={() => setPage(p)}
                          aria-current={p === curPage ? "page" : undefined}
                          className={`min-w-[2.1rem] px-2 py-1.5 rounded-lg font-semibold transition-colors ${
                              p === curPage
                                  ? "bg-orange-500 text-white shadow-sm shadow-orange-500/30"
                                  : "text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700"
                          }`}
                      >
                        {p}
                      </button>
                  )
              )}
              <button
                  type="button"
                  disabled={curPage === totalPages}
                  onClick={() => setPage(curPage + 1)}
                  className="px-3 py-1.5 rounded-lg font-semibold text-gray-600 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </nav>
          </div>
        </section>
      </div>
  );
}