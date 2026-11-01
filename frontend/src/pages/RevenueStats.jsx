import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import LoadRevanue from "./Datatable.jsx";

export default function RevenueStats() {
  const { user } = useSelector(state => state.auth);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('date');
  const [timeRange, setTimeRange] = useState('year');
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    if (user && user.isAdmin) {
      loadStats();
    }
  }, [user, filterType, timeRange, selectedDate, selectedMonth]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ filterType });
      if (filterType === 'range') {
        params.set('timeRange', timeRange);
      } else if (filterType === 'date') {
        params.set('date', selectedDate);
      } else {
        params.set('month', selectedMonth);
      }

      const response = await api.get(`/admin/revenue-stats?${params.toString()}`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error loading revenue stats:', error);
      alert('Không thể tải thống kê doanh thu');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN').format(price || 0);
  };

  const getTimeRangeText = () => {
    if (filterType === 'date') {
      const [year, month, day] = selectedDate.split('-');
      return `${day}/${month}/${year}`;
    }
    if (filterType === 'specificMonth') {
      const [year, month] = selectedMonth.split('-');
      return `${month}/${year}`;
    }

    const texts = {
      day: 'Hôm nay',
      week: '7 ngày qua',
      month: '30 ngày qua',
      year: '12 tháng qua',
      all: 'Tất cả'
    };
    return texts[timeRange] || timeRange;
  };

  if (!user || !user.isAdmin) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
            <span className="text-5xl">🔒</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Quyền truy cập bị từ chối</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Bạn không có quyền truy cập trang thống kê doanh thu.</p>
            <Link to="/admin" className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md">
              Quay lại Dashboard
            </Link>
          </div>
        </div>
    );
  }

  if (loading) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Đang tổng hợp dữ liệu doanh thu...</p>
        </div>
    );
  }
  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900/40 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Modern Header Card */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-orange-500/20 mb-8">
            <div className="absolute inset-0 bg-grid-white/[0.03] bg-[size:20px_20px]" />
            <div className="absolute -top-24 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-yellow-300/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-orange-100">Báo cáo tài chính</span>
                <h1 className="text-3xl font-black mt-1 text-white drop-shadow-sm leading-normal">THỐNG KÊ DOANH THU</h1>
                <p className="text-orange-50/90 text-sm mt-1">Phân tích doanh số, hiệu suất bán hàng và giao dịch</p>
              </div>
              <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-xl transition-all duration-300 font-medium text-sm backdrop-blur-md">
                ← Quay lại Dashboard
              </Link>
            </div>
          </div>

          {/* Time Range Selector */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700/50 p-5 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-lg">📅</span>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Chọn khoảng thời gian lọc</p>
                  <p className="text-xs text-gray-400">Xem doanh thu theo ngày, tuần, tháng hoặc năm</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    aria-label="Loại bộ lọc thời gian"
                    className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-900 dark:text-white text-sm font-bold shadow-sm"
                >
                  <option value="date">Ngày cụ thể</option>
                  <option value="specificMonth">Tháng cụ thể</option>
                  <option value="range">Khoảng thời gian</option>
                </select>
                {filterType === 'range' ? (
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value)}
                        aria-label="Khoảng thời gian"
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-900 dark:text-white text-sm font-bold shadow-sm"
                    >
                      <option value="year">12 tháng </option>
                      <option value="all">Tất cả</option>
                    </select>
                ) : (
                    <input
                        type={filterType === 'date' ? 'date' : 'month'}
                        value={filterType === 'date' ? selectedDate : selectedMonth}
                        onChange={(e) => {
                          if (filterType === 'date') {
                            setSelectedDate(e.target.value);
                          } else {
                            setSelectedMonth(e.target.value);
                          }
                        }}
                        aria-label={filterType === 'date' ? 'Chọn ngày' : 'Chọn tháng'}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:bg-gray-900 dark:text-white text-sm font-bold shadow-sm"
                    />
                )}
              </div>
            </div>
          </div>

          {stats && (
              <div className="space-y-8">
                <LoadRevanue
                    filterType={filterType}
                    timeRange={timeRange}
                    selectedDate={selectedDate}
                    selectedMonth={selectedMonth}
                />
              </div>
          )}
        </div>
      </div>
  );
}
