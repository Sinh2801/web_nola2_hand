import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'

import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'

function App() {
  console.log(' App component rendered')

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-otp" element={<VerifyOTP />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/verify-otp-reset-password" element={<VerifyOTPResetPassword />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/posts/:id" element={<PostDetailPage />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/hashtags/:hashtag" element={<Explore />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/category/:categoryName" element={<CategoryPage />} />
        <Route path="/user/:userId" element={<UserProfile />} />
        <Route path="/users/:userId/profile" element={<UserProfile />} />
        <Route path="/user/:userId/reviews" element={<UserReviews />} />
        <Route path="/help" element={<Help />} />

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/create-product" element={<CreateProduct />} />
          <Route path="/products/:id/edit" element={<EditProduct />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/favorites" element={<Favorites />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:userId" element={<Chat />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/payments" element={<MyPayments />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/seller-dashboard" element={<SellerDashboard />} />
          <Route path="/seller-dashboard/:userId" element={<SellerDashboard />} />
          <Route path="/compare" element={<CompareProducts />} />
          <Route path="/feedback" element={<Feedback />} />
          <Route path="/my-promotions" element={<MyPromotions />} />
          <Route path="/notifications/settings" element={<NotificationSettings />} />
          <Route path="/shipper" element={<ShipperDashboard />} />
        </Route>

        {/* Admin Routes */}
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/payments" element={<PaymentManagement />} />
          <Route path="/admin/bankqr" element={<BankQRManagement />} />
          <Route path="/admin/revenue" element={<RevenueStats />} />
        </Route>
      </Routes>
    </Layout>
  )
}

export default App






