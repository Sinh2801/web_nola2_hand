const crypto = require('crypto');
const axios = require('axios');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { createAndEmitNotification } = require('./notifications');

const BASE = process.env.MOMO_BASE_URL || 'https://test-payment.momo.vn/v2/gateway/api';
const { MOMO_PARTNER_CODE: PC, MOMO_ACCESS_KEY: AK, MOMO_SECRET_KEY: SK,
    MOMO_REDIRECT_URL, MOMO_IPN_URL } = process.env;

const sign = (raw) => crypto.createHmac('sha256', SK).update(raw).digest('hex');

exports.createAtmPayment = async ({ momoOrderId, amount, orderInfo }) => {
    const requestId = momoOrderId, requestType = 'payWithATM', extraData = '';
    const raw = `accessKey=${AK}&amount=${amount}&extraData=${extraData}&ipnUrl=${MOMO_IPN_URL}` +
        `&orderId=${momoOrderId}&orderInfo=${orderInfo}&partnerCode=${PC}` +
        `&redirectUrl=${MOMO_REDIRECT_URL}&requestId=${requestId}&requestType=${requestType}`;
    const { data } = await axios.post(`${BASE}/create`, {
        partnerCode: PC, partnerName: 'Hội Chợ 2hand', storeId: 'Store2hand',
        requestId, orderId: momoOrderId, amount, orderInfo, extraData, requestType,
        redirectUrl: MOMO_REDIRECT_URL, ipnUrl: MOMO_IPN_URL, lang: 'vi',
        signature: sign(raw),
    });
    return data;
};

exports.queryPayment = async (momoOrderId) => {
    const requestId = `${momoOrderId}-q${Date.now()}`;
    const raw = `accessKey=${AK}&orderId=${momoOrderId}&partnerCode=${PC}&requestId=${requestId}`;
    const { data } = await axios.post(`${BASE}/query`,
        { partnerCode: PC, requestId, orderId: momoOrderId, lang: 'vi', signature: sign(raw) });
    return data;
};

exports.verifyIpn = (b) => {
    const raw = `accessKey=${AK}&amount=${b.amount}&extraData=${b.extraData}&message=${b.message}` +
        `&orderId=${b.orderId}&orderInfo=${b.orderInfo}&orderType=${b.orderType}&partnerCode=${b.partnerCode}` +
        `&payType=${b.payType}&requestId=${b.requestId}&responseTime=${b.responseTime}` +
        `&resultCode=${b.resultCode}&transId=${b.transId}`;
    return sign(raw) === b.signature;
};

exports.applyMomoResult = async (payment, { resultCode, transId }, io) => {
    if (payment.status === 'confirmed') return payment;
    payment.momoResultCode = resultCode;

    if (resultCode !== 0) { await payment.save(); return payment; }

    if (payment.status === 'rejected') {
        console.warn('[MoMo] Thanh toán thành công sau khi hết hạn, cần hoàn tiền:', payment._id);
        payment.momoTransId = String(transId);
        await payment.save();
        return payment;
    }

    payment.status = 'confirmed';
    payment.confirmedAt = new Date();
    payment.adminApproved = true;
    payment.adminApprovedAt = new Date();
    payment.momoTransId = String(transId);
    await payment.save();

    if (io) {
        const order = await Order.findById(payment.orderId._id || payment.orderId);
        await createAndEmitNotification(io, payment.buyerId._id || payment.buyerId, 'payment_confirmed',
            'Thanh toán MoMo thành công', 'Bạn đã thanh toán thành công. Đang chờ người bán xác nhận đơn.',
            { paymentId: payment._id, orderId: order._id });
        await createAndEmitNotification(io, order.sellerId, 'payment_admin_approved',
            'Khách đã thanh toán qua MoMo', `Mã GD: ${payment.transactionCode}. Vui lòng xác nhận đơn hàng.`,
            { orderId: order._id });
    }
    return payment;
};