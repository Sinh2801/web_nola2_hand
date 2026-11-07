import { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import api from "../utils/api";

ChartJS.register(ArcElement, Tooltip, Legend);

const COLORS = ["#3b82f6", "#22c55e", "#facc15", "#ef4444", "#a855f7", "#14b8a6", "#f97316", "#64748b"];

export default function RevenuePie({ filterType,month }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!month) return;
        let cancelled = false;
        setLoading(true);

        api
            .get("/admin/revenue-pie", { params: { month } })
            .then((res) => !cancelled && setItems(res.data.data || []))
            .catch(console.error)
            .finally(() => !cancelled && setLoading(false));

        return () => { cancelled = true; };
    }, [month]);

    if (loading) return <p className="text-gray-500">Đang tải biểu đồ...</p>;
    if (items.length === 0) return <p className="text-gray-500">Không có dữ liệu để vẽ biểu đồ.</p>;

    const data = {
        labels: items.map((i) => i.label),
        datasets: [{
            data: items.map((i) => i.value),
            backgroundColor: COLORS,
        }],
    };

    const options = {
        plugins: {
            tooltip: {
                callbacks: {
                    label: (ctx) => ` ${ctx.label}: ${Number(ctx.parsed).toLocaleString("vi-VN")} ₫`,
                },
            },
        },
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm max-w-md">
            <h5 className="text-lg font-bold mb-3">Doanh thu theo sản phẩm (tháng {month})</h5>
            <Pie data={data} options={options} />
        </div>
    );
}