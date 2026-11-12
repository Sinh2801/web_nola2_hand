import React, { useEffect, useState } from 'react'
import api from '../utils/api'

const formatDate = (value) => value
  ? new Date(value).toLocaleString('vi-VN')
  : 'Chưa huấn luyện'

function MetricCard({ label, value, suffix = '%' }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-black text-gray-900 dark:text-white">
        {Number(value || 0).toFixed(1)}{suffix}
      </p>
    </div>
  )
}

export default function AdminRecommendationModel({ onMessage }) {
  const [model, setModel] = useState(null)
  const [loading, setLoading] = useState(true)
  const [training, setTraining] = useState(false)

  const loadModel = async () => {
    try {
      setLoading(true)
      const response = await api.get('/admin/recommendation-model')
      setModel(response.data.data)
    } catch (error) {
      onMessage(error.response?.data?.message || 'Không thể tải mô hình gợi ý', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModel()
  }, [])

  const train = async () => {
    try {
      setTraining(true)
      const response = await api.post('/admin/recommendation-model/train')
      setModel(response.data.data)
      onMessage('Đã huấn luyện lại mô hình thành công', 'success')
    } catch (error) {
      onMessage(error.response?.data?.message || 'Không thể huấn luyện mô hình', 'error')
    } finally {
      setTraining(false)
    }
  }

  if (loading) return <div className="py-12 text-center text-gray-500">Đang tải mô hình...</div>

  const metrics = model?.metrics || {}
  const summary = model?.dataSummary || {}
  const history = [...(model?.trainingHistory || [])].reverse()
  const productPairs = model?.productPairs || []

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Hệ thống › Mô hình gợi ý</p>
          <h2 className="text-3xl font-black text-gray-900 dark:text-white">Mô hình gợi ý sản phẩm</h2>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Học từ lịch sử mua và đánh giá để xếp hạng “Có thể bạn sẽ thích” và “Sản phẩm tương tự”.
          </p>
        </div>
        <button onClick={train} disabled={training} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white disabled:opacity-60">
          {training ? 'Đang huấn luyện...' : '↻ Huấn luyện lại'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Hit rate@4" value={metrics.hitRateAt4} />
        <MetricCard label="Precision@4" value={metrics.precisionAt4} />
        <MetricCard label="So với “bán chạy”" value={metrics.popularBaselineAt4} />
        <MetricCard label="Dữ liệu huấn luyện" value={summary.purchases} suffix=" lượt mua" />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Lần huấn luyện gần nhất: {formatDate(model?.trainedAt)} · {summary.customers || 0} khách · {summary.reviews || 0} đánh giá.
      </p>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 font-bold text-gray-900 dark:text-white">
          Các cặp sản phẩm mô hình học được
        </div>
        {productPairs.length === 0 ? (
          <p className="p-5 text-gray-500">Chưa đủ lịch sử mua để tính các cặp sản phẩm.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500">
                <tr>
                  <th className="px-5 py-3">Sản phẩm</th>
                  <th className="px-5 py-3">Hay mua cùng</th>
                  <th className="px-5 py-3 text-right">Từ lịch sử mua</th>
                  <th className="px-5 py-3 text-right">Điểm tổng</th>
                </tr>
              </thead>
              <tbody>
                {productPairs.map((pair, index) => (
                  <tr key={`${pair.productId?._id}-${pair.pairedProductId?._id}-${index}`} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{pair.productId?.title || 'Sản phẩm đã xóa'}</td>
                    <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{pair.pairedProductId?.title || 'Sản phẩm đã xóa'}</td>
                    <td className="px-5 py-3 text-right">{Number(pair.purchaseScore || 0).toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-bold">{Number(pair.totalScore || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 dark:border-gray-700 px-5 py-4 font-bold text-gray-900 dark:text-white">Lịch sử huấn luyện</div>
        {history.length === 0 ? (
          <p className="p-5 text-gray-500">Chưa có lần huấn luyện nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500">
                <tr><th className="px-5 py-3">Thời gian</th><th className="px-5 py-3">Cách chạy</th><th className="px-5 py-3">Lượt mua</th><th className="px-5 py-3">Hit rate</th></tr>
              </thead>
              <tbody>
                {history.map((run, index) => (
                  <tr key={`${run.trainedAt}-${index}`} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-5 py-3">{formatDate(run.trainedAt)}</td>
                    <td className="px-5 py-3">{run.mode === 'manual' ? 'Bấm tay' : 'Tự động'}</td>
                    <td className="px-5 py-3">{run.trainingPurchases}</td>
                    <td className="px-5 py-3 font-bold">{Number(run.hitRateAt4 || 0).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
