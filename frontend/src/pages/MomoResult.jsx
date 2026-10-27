import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

const VIEWS = {
    checking: { icon: '⏳', title: 'Đang kiểm tra giao dịch...', color: 'text-gray-700' },
    success:  { icon: '✅', title: 'Thanh toán thành công!', color: 'text-green-600',
        desc: 'Đơn hàng của bạn đã được thanh toán. Vui lòng chờ người bán xác nhận.' },
    pending:  { icon: '⚠️', title: 'Chưa hoàn tất thanh toán', color: 'text-yellow-600',
        desc: 'Giao dịch chưa thành công hoặc bạn đã hủy. Bạn có thể thanh toán lại trong vòng 30 phút kể từ lúc tạo giao dịch.' },
    expired:  { icon: '❌', title: 'Giao dịch đã hết hạn', color: 'text-red-600',
        desc: 'Đơn hàng đã bị hủy do không thanh toán kịp thời.' },
    error:    { icon: '❌', title: 'Không xác định được giao dịch', color: 'text-red-600',
        desc: 'Vui lòng kiểm tra lại trong mục Đơn mua.' },
};

export default function MomoResult() {
    const [params] = useSearchParams();
    const momoOrderId = params.get('orderId');
    const resultCode = Number(params.get('resultCode'));
    const [state, setState] = useState('checking');

    useEffect(() => {
        if (!momoOrderId) { setState('error'); return; }
        let cancelled = false;
        let timer = null;
        let tries = 0;

        const check = async () => {
            try {
                const res = await api.get(`/payments/momo/status/${momoOrderId}`);
                if (cancelled) return;
                const { status } = res.data.data;
                if (status === 'confirmed') return setState('success');
                if (status === 'rejected') return setState('expired');
                // vẫn pending: nếu MoMo báo thành công thì đợi IPN thêm vài giây
                if (resultCode === 0 && tries < 5) {
                    tries++;
                    timer = setTimeout(check, 2000);
                    return;
                }
                setState('pending');
            } catch (e) {
                if (!cancelled) setState('error');
            }
        };

        check();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, [momoOrderId, resultCode]);

    const v = VIEWS[state];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
                <div className="text-5xl mb-4">{v.icon}</div>
                <h1 className={`text-xl font-bold mb-2 ${v.color}`}>{v.title}</h1>
                {v.desc && <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{v.desc}</p>}
                {state !== 'checking' && (
                    <div className="flex flex-col gap-2">
                        <Link to="/orders?type=buying"
                              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-xl">
                            Xem đơn mua của tôi
                        </Link>
                        <Link to="/" className="text-sm text-gray-500 hover:underline">Về trang chủ</Link>
                    </div>
                )}
            </div>
        </div>
    );
}