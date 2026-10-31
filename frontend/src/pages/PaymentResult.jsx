import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../utils/api';

const formatPrice = (p) => new Intl.NumberFormat('vi-VN').format(p);

const VIEWS = {
    checking:  { icon: '⏳', title: 'Đang kiểm tra giao dịch...', color: 'text-gray-700 dark:text-gray-200' },
    success:   { icon: '✅', title: 'Thanh toán thành công!', color: 'text-green-600',
        desc: 'Đơn hàng của bạn đã được thanh toán. Vui lòng chờ người bán xác nhận đơn.' },
    cancelled: { icon: '⚠️', title: 'Bạn đã hủy giao dịch', color: 'text-yellow-600',
        desc: 'Đơn hàng chưa được thanh toán. Bạn có thể thanh toán lại trong vòng 30 phút kể từ lúc tạo giao dịch.' },
    pending:   { icon: '⚠️', title: 'Chưa hoàn tất thanh toán', color: 'text-yellow-600',
        desc: 'Giao dịch chưa thành công. Bạn có thể thanh toán lại trong vòng 30 phút kể từ lúc tạo giao dịch.' },
    expired:   { icon: '❌', title: 'Giao dịch đã hết hạn', color: 'text-red-600',
        desc: 'Đơn hàng đã bị hủy do không thanh toán kịp thời.' },
    error:     { icon: '❌', title: 'Không xác định được giao dịch', color: 'text-red-600',
        desc: 'Vui lòng kiểm tra lại trong mục Đơn mua.' },
};

export default function PaymentResult({ gateway }) {
    const [params] = useSearchParams();
    const [state, setState] = useState('checking');
    const [info, setInfo] = useState(null);

    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let tries = 0;

        const done = (status, data) => {
            if (cancelled) return;
            setInfo(data || null);
            setState(status);
        };

        const checkVnpay = async () => {
            if (!params.get('vnp_TxnRef')) return done('error');
            try {
                // Chuyển nguyên các tham số vnp_* cho backend xác thực chữ ký
                const res = await api.get('/payments/vnpay/return', { params: Object.fromEntries(params) });
                const d = res.data.data;
                if (d.status === 'confirmed') return done('success', d);
                if (d.status === 'rejected') return done('expired', d);
                return done(params.get('vnp_ResponseCode') === '24' ? 'cancelled' : 'pending', d);
            } catch {
                done('error');
            }
        };

        const checkMomo = async () => {
            const momoOrderId = params.get('orderId');
            if (!momoOrderId) return done('error');
            try {
                const res = await api.get(`/payments/momo/status/${momoOrderId}`);
                const d = res.data.data;
                if (d.status === 'confirmed') return done('success', d);
                if (d.status === 'rejected') return done('expired', d);
                // MoMo báo thành công mà IPN chưa về: đợi thêm vài giây
                if (Number(params.get('resultCode')) === 0 && tries < 5) {
                    tries++;
                    timer = setTimeout(checkMomo, 2000);
                    return;
                }
                done('pending', d);
            } catch {
                done('error');
            }
        };

        gateway === 'vnpay' ? checkVnpay() : checkMomo();
        return () => { cancelled = true; if (timer) clearTimeout(timer); };
    }, []);

    const v = VIEWS[state];

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 w-full max-w-md text-center">
                <div className="text-5xl mb-4">{v.icon}</div>
                <h1 className={`text-xl font-bold mb-2 ${v.color}`}>{v.title}</h1>
                {v.desc && <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{v.desc}</p>}

                {state === 'success' && info && (
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 mb-4 text-sm text-left space-y-1">
                        <p className="text-gray-700 dark:text-gray-300">
                            Mã giao dịch: <span className="font-mono font-semibold">{info.transactionCode}</span>
                        </p>
                    </div>
                )}

                {state !== 'checking' && (
                    <div className="flex flex-col gap-2 mt-2">
                        <Link
                            to="/orders?type=buying"
                            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2.5 rounded-xl"
                        >
                            Xem đơn mua của tôi
                        </Link>
                        <Link to="/" className="text-sm text-gray-500 hover:underline">Về trang chủ</Link>
                    </div>
                )}
            </div>
        </div>
    );
}