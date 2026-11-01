import { useState, useEffect } from "react";
import DataTable from "datatables.net-react";
import DT from "datatables.net-dt";
import "datatables.net-dt/css/dataTables.dataTables.min.css";
import api from "../utils/api";

DataTable.use(DT);

const formatVND = (n) => Number(n || 0).toLocaleString("vi-VN") * 0.05 + " ₫";
const moneyRender = (value, type) => (type === "display" ? formatVND(value) : value);

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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm">
      <h5 className="text-lg font-bold mb-3">Tổng doanh thu: {formatVND(tong)}</h5>
      <DataTable
        key={`${result.mode}-${filterType}-${timeRange}-${selectedDate}-${selectedMonth}`}
        data={result.rows}
        columns={result.mode === "orders" ? orderColumns : dayColumns}
        className="display"
        options={{ pageLength: 31, order: [[0, "desc"]] }}
      />
    </div>
  );
}