

/*const orderColumns = [
  { data: "id", title: "Mã giao dịch" },
  { data: "sanpham", title: "Sản phẩm" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];

const dayColumns = [
  { data: "day", title: "Ngày" },
  { data: "sodon", title: "Số đơn" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];

export default function LoadRevanue({ filterType, timeRange, selectedDate, selectedMonth }) {
  const [result, setResult] = useState({ mode: null, rows: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { filterType };
    if (filterType === "range") params.timeRange = timeRange;
    else if (filterType === "date") params.date = selectedDate;
    else params.month = selectedMonth;

    api
      .get("/admin/revenue-table", { params })
      .then((res) => !cancelled && setResult(res.data))
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [filterType, timeRange, selectedDate, selectedMonth]);

  if (loading) return <p className="text-gray-500">Đang tải bảng...</p>;

  if (result.rows.length === 0) {
    return <p className="text-gray-500">Không có dữ liệu trong khoảng thời gian này.</p>;
  }

  const tong = result.rows.reduce((s, r) => s + r.doanhthu, 0);

}*/
/*import { useState, useEffect } from "react";
import "datatables.net-dt/css/dataTables.dataTables.min.css";
import api from "../utils/api";
const FEE_RATE = 0.05; // 5% phí sàn
const fee = (n) => Math.round(Number(n || 0) * FEE_RATE);
const formatVND = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";
const moneyRender = (value, type) => (type === "display" ? formatVND(value) : value);
const toDM = (s) => { const [, m, d] = s.split("-"); return `${d}/${m}`; };
const weekStart = (dayStr) => {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

function buildChartData(result, groupBy) {
  if (result.mode === "orders") {
    return result.rows.map((r) => ({
      key: r.id, label: r.id, sanpham: r.sanpham, sodon: 1, doanhthu: fee(r.doanhthu),
    }));
  }
  const map = new Map();
  for (const r of result.rows) {
    let key, label;
    if (groupBy === "week") { key = weekStart(r.day); label = `Tuần ${toDM(key)}`; }
    else if (groupBy === "month") { key = r.day.slice(0, 7); label = `${key.slice(5)}/${key.slice(0, 4)}`; }
    else { key = r.day; label = toDM(r.day); }
    const cur = map.get(key) || { key, label, sodon: 0, doanhthu: 0 };
    cur.sodon += r.sodon;
    cur.doanhthu += fee(r.doanhthu);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const orderColumns = [
  { data: "id", title: "Mã giao dịch" },
  { data: "sanpham", title: "Sản phẩm" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];
const dayColumns = [
  { data: "day", title: "Ngày" },
  { data: "sodon", title: "Số đơn" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];

const btn = (active) =>
  `px-3 py-1 rounded border text-sm ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
  }`;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded p-2 text-sm shadow">
      <div className="font-semibold">{d.sanpham || d.label}</div>
      <div>Doanh thu: {formatVND(d.doanhthu)}</div>
      {d.sodon > 1 && <div>Số đơn: {d.sodon}</div>}
    </div>
  );
}

export default function LoadRevanue({ filterType, timeRange, selectedDate, selectedMonth }) {
  const [result, setResult] = useState({ mode: null, rows: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("chart");     // "chart" | "table"
  const [groupBy, setGroupBy] = useState("day"); // "day" | "week" | "month"

  // Gợi ý mặc định: xem theo năm -> gom theo tháng, ngược lại theo ngày
  useEffect(() => {
    setGroupBy(filterType === "range" && (timeRange === "year" || timeRange === "all") ? "month" : "day");
  }, [filterType, timeRange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { filterType };
    if (filterType === "range") params.timeRange = timeRange;
    else if (filterType === "date") params.date = selectedDate;
    else params.month = selectedMonth;

    api
      .get("/admin/revenue-table", { params })
      .then((res) => !cancelled && setResult(res.data))
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [filterType, timeRange, selectedDate, selectedMonth]);

  // Hook phải đặt TRƯỚC các lệnh return sớm
  const chartData = useMemo(() => buildChartData(result, groupBy), [result, groupBy]);

  if (loading) return <p className="text-gray-500">Đang tải dữ liệu...</p>;
  if (result.rows.length === 0)
    return <p className="text-gray-500">Không có dữ liệu trong khoảng thời gian này.</p>;

  const tong = result.rows.reduce((s, r) => s + fee(r.doanhthu), 0);
  const isOrders = result.mode === "orders";

  return (
    <div>
      
<div className="flex flex-wrap items-center justify-between gap-2 mb-3">
  <div className="flex gap-2">
    <button className={btn(view === "chart")} onClick={() => setView("chart")}>Biểu đồ</button>
    <button className={btn(view === "table")} onClick={() => setView("table")}>Bảng</button>
  </div>

  {view === "chart" && !isOrders && (
    <div className="flex gap-2">
      <button className={btn(groupBy === "day")} onClick={() => setGroupBy("day")}>Theo ngày</button>
      <button className={btn(groupBy === "week")} onClick={() => setGroupBy("week")}>Theo tuần</button>
      <button className={btn(groupBy === "month")} onClick={() => setGroupBy("month")}>Theo tháng</button>
    </div>
  )}
</div>

{
  view === "chart" ? (
    <div style={{ width: "100%", height: 400 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            interval="preserveStartEnd"
            angle={chartData.length > 12 ? -45 : 0}
            textAnchor={chartData.length > 12 ? "end" : "middle"}
            height={chartData.length > 12 ? 60 : 30}
          />
          <YAxis tickFormatter={formatShort} />
          <Tooltip content={<ChartTooltip />} />
          <Bar dataKey="doanhthu" name="Doanh thu" fill="#2563eb" radius={[4, 4, 0, 0]}>
            {chartData.length <= 12 && (
              <LabelList dataKey="doanhthu" position="top" formatter={formatShort} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  ) : (
  <DataTable
    data={result.rows}
    columns={isOrders ? orderColumns : dayColumns}
    className="display"
    options={{ order: [], pageLength: 10 }}
  />
)
}

<p className="mt-3 font-semibold">Tổng doanh thu: {formatVND(tong)}</p>
    </div >
  );
}*/
import { useState, useEffect, useMemo } from "react";
import DataTable from "datatables.net-react";
import DT from "datatables.net-dt";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import "datatables.net-dt/css/dataTables.dataTables.min.css";
import api from "../utils/api";

DataTable.use(DT);

const FEE_RATE = 0.05;
const fee = (n) => Math.round(Number(n || 0) * FEE_RATE);
const formatVND = (n) => Number(n || 0).toLocaleString("vi-VN") + " ₫";
const formatShort = (n) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "tr" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
const moneyRender = (value, type) => (type === "display" ? formatVND(fee(value)) : value);

const toDM = (s) => { const [, m, d] = s.split("-"); return `${d}/${m}`; };
const weekStart = (dayStr) => {
  const [y, m, d] = dayStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
};

function buildChartData(result, groupBy) {
  if (result.mode === "orders") {
    return result.rows.map((r) => ({
      key: r.id, label: r.id, sanpham: r.sanpham, sodon: 1, doanhthu: fee(r.doanhthu),
    }));
  }
  const map = new Map();
  for (const r of result.rows) {
    let key, label;
    if (groupBy === "week") { key = weekStart(r.day); label = `Tuần ${toDM(key)}`; }
    else if (groupBy === "month") { key = r.day.slice(0, 7); label = `${key.slice(5)}/${key.slice(0, 4)}`; }
    else { key = r.day; label = toDM(r.day); }
    const cur = map.get(key) || { key, label, sodon: 0, doanhthu: 0 };
    cur.sodon += r.sodon;
    cur.doanhthu += fee(r.doanhthu);
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

const orderColumns = [
  { data: "id", title: "Mã giao dịch" },
  { data: "sanpham", title: "Sản phẩm" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];
const dayColumns = [
  { data: "day", title: "Ngày" },
  { data: "sodon", title: "Số đơn" },
  { data: "doanhthu", title: "Doanh thu", render: moneyRender },
];

const btn = (active) =>
  `px-3 py-1 rounded border text-sm ${active ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-700 border-gray-300"
  }`;

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border rounded p-2 text-sm shadow">
      <div className="font-semibold">{d.sanpham || d.label}</div>
      <div>Doanh thu: {formatVND(d.doanhthu)}</div>
      {d.sodon > 1 && <div>Số đơn: {d.sodon}</div>}
    </div>
  );
}

export default function LoadRevanue({ filterType, timeRange, selectedDate, selectedMonth }) {
  const [result, setResult] = useState({ mode: null, rows: [] });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("chart");     // "chart" | "table"
  const [groupBy, setGroupBy] = useState("day"); // "day" | "week" | "month"

  // Gợi ý mặc định: xem theo năm -> gom theo tháng, ngược lại theo ngày
  useEffect(() => {
    setGroupBy(filterType === "range" && (timeRange === "year" || timeRange === "all") ? "month" : "day");
  }, [filterType, timeRange]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = { filterType };
    if (filterType === "range") params.timeRange = timeRange;
    else if (filterType === "date") params.date = selectedDate;
    else params.month = selectedMonth;

    api
      .get("/admin/revenue-table", { params })
      .then((res) => !cancelled && setResult(res.data))
      .catch(console.error)
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [filterType, timeRange, selectedDate, selectedMonth]);

  // Hook phải đặt TRƯỚC các lệnh return sớm
  const chartData = useMemo(() => buildChartData(result, groupBy), [result, groupBy]);

  if (loading) return <p className="text-gray-500">Đang tải dữ liệu...</p>;
  if (result.rows.length === 0)
    return <p className="text-gray-500">Không có dữ liệu trong khoảng thời gian này.</p>;

  const tong = result.rows.reduce((s, r) => s + fee(r.doanhthu), 0);
  const isOrders = result.mode === "orders";

  return (
    <div>
      {/* Thanh điều khiển */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex gap-2">
          <button className={btn(view === "chart")} onClick={() => setView("chart")}>Biểu đồ</button>
          <button className={btn(view === "table")} onClick={() => setView("table")}>Bảng</button>
        </div>

        {view === "chart" && !isOrders && (
          <div className="flex gap-2">
            <button className={btn(groupBy === "day")} onClick={() => setGroupBy("day")}>Theo ngày</button>
            <button className={btn(groupBy === "week")} onClick={() => setGroupBy("week")}>Theo tuần</button>
            <button className={btn(groupBy === "month")} onClick={() => setGroupBy("month")}>Theo tháng</button>
          </div>
        )}
      </div>

      {view === "chart" ? (
        <div style={{ width: "100%", height: 400 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                interval="preserveStartEnd"
                angle={chartData.length > 12 ? -45 : 0}
                textAnchor={chartData.length > 12 ? "end" : "middle"}
                height={chartData.length > 12 ? 60 : 30}
              />
              <YAxis tickFormatter={formatShort} />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="doanhthu" name="Doanh thu" fill="#2563eb" radius={[4, 4, 0, 0]}>
                {chartData.length <= 12 && (
                  <LabelList dataKey="doanhthu" position="top" formatter={formatShort} />
                )}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <DataTable
          data={result.rows}
          columns={isOrders ? orderColumns : dayColumns}
          className="display"
          options={{ order: [], pageLength: 10 }}
        />
      )}

      <p className="mt-3 font-semibold">Tổng doanh thu: {formatVND(tong)}</p>
    </div>
  );
}