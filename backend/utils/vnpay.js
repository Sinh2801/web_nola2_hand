const {
    VNPay, ProductCode, VnpLocale, dateFormat,
    IpnSuccess, IpnFailChecksum, IpnOrderNotFound, IpnInvalidAmount,
    InpOrderAlreadyConfirmed, IpnUnknownError,
} = require('vnpay');
const Order = require('../models/Order');
const { createAndEmitNotification } = require('./notifications');

const vnpay = new VNPay({
    tmnCode: process.env.VNPAY_TMN_CODE,
    secureSecret: process.env.VNPAY_HASH_SECRET,
    testMode: true,
    hashAlgorithm: 'SHA512',
});

exports.IPN = { IpnSuccess, IpnFailChecksum, IpnOrderNotFound, IpnInvalidAmount, InpOrderAlreadyConfirmed, IpnUnknownError };

exports.buildPayUrl = ({ txnRef, amount, orderInfo, ipAddr, expireMinutes = 30 }) => {
    const now = new Date();
    return vnpay.buildPaymentUrl({
        vnp_Amount: amount,
        vnp_IpAddr: ipAddr,
        vnp_TxnRef: txnRef,
        vnp_OrderInfo: orderInfo,
        vnp_OrderType: ProductCode.Other,
        vnp_ReturnUrl: process.env.VNPAY_RETURN_URL,
        vnp_Locale: VnpLocale.VN,
        vnp_CreateDate: dateFormat(now),
        vnp_ExpireDate: dateFormat(new Date(now.getTime() + expireMinutes * 60 * 1000)),
    });
};

exports.verifyIpn = (query) => vnpay.verifyIpnCall(query);
exports.verifyReturn = (query) => vnpay.verifyReturnUrl(query);

exports.applyVnpayResult = async (payment, { isSuccess, transId, code }, io) => {
    if (payment.status === 'confirmed') return payment;
    payment.vnpayResponseCode = String(code || '');

    if (!isSuccess) { await payment.save(); return payment; }

    if (payment.status === 'rejected') {
        console.warn('[VNPay] Thanh toán thành công sau khi bị hủy, cần hoàn tiền:', payment._id);
        payment.vnpayTransId = String(transId || '');
        await payment.save();
        return payment;
    }

    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    payment.adminApproved = true;
    payment.adminApprovedAt = new Date();
    payment.vnpayTransId = String(transId || '');
    await payment.save();

    if (io) {
        const order = await Order.findById(payment.orderId._id || payment.orderId);
        await createAndEmitNotification(io, payment.buyerId._id || payment.buyerId, 'payment_confirmed',
            'Thanh toán VNPay thành công', 'Bạn đã thanh toán thành công. Đang chờ người bán xác nhận đơn.',
            { paymentId: payment._id, orderId: order._id });
        await createAndEmitNotification(io, order.sellerId, 'payment_admin_approved',
            'Khách đã thanh toán qua VNPay', `Mã GD: ${payment.transactionCode}. Vui lòng xác nhận đơn hàng.`,
            { orderId: order._id });
    }
    return payment;
};