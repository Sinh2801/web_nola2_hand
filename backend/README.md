# Backend Setup Guide - MongoDB Local

Hướng dẫn chi tiết cách setup backend DNU Marketplace sử dụng MongoDB local.

## 📋 Mục lục

1. [Yêu cầu hệ thống](#yêu-cầu-hệ-thống)
2. [Cài đặt MongoDB Local](#cài-đặt-mongodb-local)
3. [Cài đặt Backend](#cài-đặt-backend)
4. [Cấu hình Environment Variables](#cấu-hình-environment-variables)
5. [Chạy Backend](#chạy-backend)
6. [Kiểm tra](#kiểm-tra)
7. [Troubleshooting](#troubleshooting)
8. [Cấu trúc Database](#cấu-trúc-database)

---

## 🎯 Yêu cầu hệ thống

- **Node.js**: Phiên bản 16 trở lên ([Download](https://nodejs.org/))
- **MongoDB**: Phiên bản 4.4 trở lên ([Download](https://www.mongodb.com/try/download/community))
- **npm**: Được cài đặt kèm theo Node.js
- **Git** (tùy chọn): Để clone repository

---

## 💾 Cài đặt MongoDB Local

### Windows

1. **Download MongoDB Community Server**
   - Truy cập: https://www.mongodb.com/try/download/community
   - Chọn Windows, version mới nhất
   - Chọn `.msi` installer
   - Download file

2. **Cài đặt MongoDB**
   - Chạy file `.msi` vừa download
   - Chọn "Complete" installation
   - Chọn "Install MongoDB as a Service"
   - Tích "Install MongoDB Compass" (GUI tool - tùy chọn)
   - Click "Install"

3. **Kiểm tra MongoDB đã chạy**
   ```powershell
   # Kiểm tra service
   Get-Service MongoDB
   
   # Khởi động MongoDB (nếu chưa chạy)
   Start-Service MongoDB
   ```

4. **Kiểm tra kết nối**
   ```powershell
   # Kết nối đến MongoDB
   mongosh
   
   # Hoặc (phiên bản cũ)
   mongo
   ```

### macOS

```bash
# Cài đặt qua Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Khởi động MongoDB
brew services start mongodb-community

# Kiểm tra trạng thái
brew services list
```

### Linux (Ubuntu/Debian)

```bash
# Cài đặt MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org

# Khởi động MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Kiểm tra trạng thái
sudo systemctl status mongod
```

---

## 🚀 Cài đặt Backend

### Bước 1: Di chuyển vào thư mục backend

```powershell
cd backend
```

### Bước 2: Cài đặt dependencies

```powershell
npm install
```

Lần đầu tiên cài đặt có thể mất 2-5 phút.

## 🤖 Mô hình gợi ý sản phẩm

Mô hình xếp hạng sản phẩm dùng các đơn đã xác nhận/hoàn tất, đánh giá của người mua,
bookmark, danh mục, tag, điểm sao và lượt xem. Kết quả được dùng cho cả
`/api/products/recommended` và hai API sản phẩm tương tự.

Admin có thể xem chỉ số và lịch sử huấn luyện tại `GET /api/admin/recommendation-model`
và huấn luyện lại bằng `POST /api/admin/recommendation-model/train`. Hai API này yêu cầu
quyền admin; lần huấn luyện được lưu trong collection `recommendationmodels`.

### Bước 3: Tạo file `.env`

Tạo file mới tên `.env` trong thư mục `backend/` và copy nội dung dưới đây:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# MongoDB - Local Database
MONGODB_URI=mongodb://localhost:27017/dnu-marketplace

# JWT Authentication
JWT_SECRET=dnu-marketplace-secret-key-2024-change-in-production
JWT_EXPIRE=7d

# Cloudinary (Optional - để upload ảnh)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email Service (Optional - để gửi email xác minh)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

---

## ⚙️ Cấu hình Environment Variables

### Các biến bắt buộc

| Biến | Mô tả | Giá trị mặc định |
|------|-------|-----------------|
| `MONGODB_URI` | Connection string đến MongoDB | `mongodb://localhost:27017/dnu-marketplace` |
| `JWT_SECRET` | Secret key để tạo JWT tokens | Nên thay đổi trong production |
| `PORT` | Port chạy backend server | `5000` |

### Các biến tùy chọn

| Biến | Mô tả | Giá trị |
|------|-------|---------|
| `CLOUDINARY_*` | Thông tin Cloudinary để upload ảnh | Có thể để trống |
| `EMAIL_*` | Thông tin email service | Có thể để trống |
| `FRONTEND_URL` | URL của frontend app | `http://localhost:3000` |

### Cấu hình Cloudinary (Tùy chọn)

1. Đăng ký tài khoản tại: https://cloudinary.com/users/register_free
2. Vào Dashboard > Settings
3. Copy các thông tin:
   - Cloud Name
   - API Key
   - API Secret
4. Paste vào file `.env`

### Cấu hình Email với Gmail (Tùy chọn)

1. Vào Google Account Settings
2. Security > 2-Step Verification (bật nếu chưa bật)
3. Security > App Passwords
4. Tạo app password mới
5. Copy password và paste vào `.env`

---

## 🎮 Chạy Backend

### Development Mode (với nodemon - tự động restart khi code thay đổi)

```powershell
npm run dev
```

### Production Mode

```powershell
npm start
```

### Kết quả mong đợi

Nếu thành công, bạn sẽ thấy output tương tự:

```
MongoDB Connected: localhost:27017
Server running on port 5000
```

Backend sẽ chạy tại: **http://localhost:5000**

---

## ✅ Kiểm tra

### 1. Kiểm tra MongoDB connection

```powershell
# Mở terminal mới
mongosh

# Hoặc
mongo

# Chạy lệnh
show dbs
# Bạn sẽ thấy database "dnu-marketplace" nếu đã kết nối thành công
```

### 2. Kiểm tra Backend API

Mở browser hoặc dùng Postman/curl:

```powershell
# Health check
curl http://localhost:5000/api/health

# Response:
# {"status":"OK","message":"Server is running"}
```

### 3. Test MongoDB trong Backend

```powershell
# Với backend đang chạy, test kết nối
node -e "require('mongoose').connect('mongodb://localhost:27017/dnu-marketplace').then(() => console.log('Connected!')).catch(err => console.log('Error:', err))"
```

---

## 🔧 Troubleshooting

### Lỗi: "MongooseError: connect ECONNREFUSED"

**Nguyên nhân:** MongoDB chưa được cài đặt hoặc service chưa chạy.

**Giải pháp:**

```powershell
# Windows
Get-Service MongoDB
Start-Service MongoDB

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Lỗi: "Port 5000 already in use"

**Nguyên nhân:** Port 5000 đã bị ứng dụng khác sử dụng.

**Giải pháp 1:** Đổi port trong file `.env`:
```env
PORT=5001
```

**Giải pháp 2:** Tìm và kill process đang dùng port 5000:
```powershell
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5000 | xargs kill
```

### Lỗi: "Cannot find module"

**Nguyên nhân:** Dependencies chưa được cài đặt.

**Giải pháp:**
```powershell
# Xóa node_modules và cài lại
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

### Lỗi: "EADDRINUSE"

**Nguyên nhân:** Port đã được sử dụng.

**Giải pháp:** Đổi port trong `.env` hoặc tắt process khác.

### Lỗi: "MongooseError: Operation `users.find()` buffering timed out"

**Nguyên nhân:** Không kết nối được đến MongoDB.

**Giải pháp:**
1. Kiểm tra MongoDB đang chạy
2. Kiểm tra `MONGODB_URI` trong `.env`
3. Kiểm tra firewall không block port 27017

---

## 🗄️ Cấu trúc Database

Backend sử dụng MongoDB với các collections sau:

### Collections

1. **`users`** - Thông tin người dùng
   - Thông tin cá nhân
   - Mã số sinh viên
   - Email (phải có đuôi @dnu.edu.vn)
   - Favorite products

2. **`products`** - Sản phẩm
   - Thông tin sản phẩm
   - Hình ảnh (lưu trên Cloudinary)
   - Danh mục, giá, tình trạng
   - Trạng thái duyệt (admin)

3. **`messages`** - Tin nhắn chat
   - Chat giữa người mua và người bán
   - Real-time với Socket.IO

4. **`comments`** - Bình luận sản phẩm
   - Bình luận công khai trên sản phẩm

5. **`reviews`** - Đánh giá sau giao dịch
   - Rating và review sau khi giao dịch

### Database Operations

```powershell
# Kết nối MongoDB shell
mongosh

# Switch database
use dnu-marketplace

# Xem tất cả collections
show collections

# Đếm số documents
db.users.countDocuments()
db.products.countDocuments()

# Xem một document
db.users.findOne()
db.products.findOne()

# Xóa tất cả dữ liệu (CẨN THẬN!)
db.dropDatabase()
```

---

## 📂 Cấu trúc thư mục Backend

```
backend/
├── config/
│   └── db.js              # MongoDB connection
├── controllers/            # Business logic
│   ├── authController.js
│   ├── userController.js
│   ├── productController.js
│   ├── messageController.js
│   ├── adminController.js
│   └── commentController.js
├── middleware/
│   └── auth.js            # JWT authentication
├── models/                # Mongoose schemas
│   ├── User.js
│   ├── Product.js
│   ├── Message.js
│   ├── Comment.js
│   └── Review.js
├── routes/                # API routes
│   ├── auth.js
│   ├── user.js
│   ├── product.js
│   ├── message.js
│   └── admin.js
├── utils/                 # Helper functions
│   ├── generateToken.js
│   ├── sendEmail.js
│   └── uploadImage.js
├── .env                   # Environment variables (TẠO MỚI)
├── env.example            # Template cho .env
├── server.js             # Main entry point
└── package.json          # Dependencies
```

---

## 📚 API Documentation

### Endpoints

Sau khi backend chạy, truy cập các endpoints:

- `GET /api/health` - Health check
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `GET /api/products` - Lấy danh sách sản phẩm
- `POST /api/products` - Tạo sản phẩm mới
- `GET /api/products/:id` - Lấy chi tiết sản phẩm
- `PUT /api/products/:id` - Cập nhật sản phẩm
- `DELETE /api/products/:id` - Xóa sản phẩm
- `GET /api/messages/conversations` - Lấy danh sách chat
- `GET /api/admin/stats` - Thống kê (admin only)

Xem chi tiết tại: `README.md` (root directory)

---

## 🔐 Security Features

- **JWT Authentication**: Token-based authentication
- **Password Hashing**: bcryptjs với salt rounds = 10
- **Rate Limiting**: Giới hạn số request
- **Helmet.js**: Security headers
- **CORS**: Cross-Origin Resource Sharing protection
- **Input Validation**: express-validator

---

## 🎯 Next Steps

1. ✅ Backend đang chạy tại http://localhost:5000
2. ✅ MongoDB đã kết nối thành công
3. 📝 Setup Frontend (xem `../frontend/README.md`)
4. 🔐 Cấu hình Cloudinary (optional)
5. 📧 Cấu hình Email service (optional)

---

## 📞 Cần hỗ trợ?

Nếu gặp vấn đề, kiểm tra:

1. ✅ Node.js version >= 16
2. ✅ MongoDB đang chạy và kết nối được
3. ✅ File `.env` được tạo đúng
4. ✅ Port 5000 chưa bị sử dụng
5. ✅ Đã chạy `npm install`

---

## 📖 Tài liệu tham khảo

- MongoDB: https://docs.mongodb.com/
- Express.js: https://expressjs.com/
- Mongoose: https://mongoosejs.com/
- Socket.IO: https://socket.io/
- Cloudinary: https://cloudinary.com/documentation

---

**Happy Coding! 🚀**
