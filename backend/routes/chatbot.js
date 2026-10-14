const express = require('express');
const router = express.Router();
const { chatWithGemini, clearChatHistory } = require('../controllers/chatbotController');
const rateLimit = require('express-rate-limit');

// Rate limiting để tránh spam
const chatbotLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, 
  max: 20, 
  message: {
    success: false,
    message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng đợi một chút rồi thử lại.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});


router.post('/chat', chatbotLimiter, chatWithGemini);


router.post('/clear-history', clearChatHistory);

module.exports = router;

