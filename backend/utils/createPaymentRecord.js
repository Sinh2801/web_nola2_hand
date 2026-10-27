const Payment = require('../models/Payment');
const generateTransactionCode = require('./generateTransactionCode');

const PLATFORM_FEE_PERCENT = 5;  // 5% phí sàn
const VAT_PERCENT = 10;          // 10% VAT trên phí sàn

// order phải được populate buyerId (name, phone)
module.exports = async function createPaymentRecord(order, extra = {}) {
    let transactionCode;
    for (let i = 0; i < 10; i++) {
        const code = generateTransactionCode();
        if (!(await Payment.findOne({ transactionCode: code }))) { transactionCode = code; break; }
    }
    if (!transactionCode) throw new Error('Không thể tạo mã giao dịch. Vui lòng thử lại');

    const amount = order.finalPrice;
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT / 100);
    const vatAmount = Math.round(platformFee * VAT_PERCENT / 100);
    const sellerAmount = amount - platformFee - vatAmount;

    return Payment.create({
        orderId: order._id,
        buyerId: order.buyerId._id,
        buyerName: order.buyerId.name,
        buyerPhone: order.buyerId.phone,
        amount,
        platformFeePercent: PLATFORM_FEE_PERCENT,
        vatPercent: VAT_PERCENT,
        platformFee,
        vatAmount,
        sellerAmount,
        transactionCode,
        shippingAddress: order.shippingAddress,
        status: 'pending',
        ...extra,
    });
};