import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import LoadRevanue from "./Datatable.jsx";

// Nút chọn dạng segmented (đồng bộ với Datatable.jsx)
function Segmented({ options, value, onChange, label }) {
  return (
      <div
          role="group"
          aria-label={label}
          className="inline-flex rounded-xl bg-orange-50 dark:bg-gray-800 p-1 border border-orange-100 dark:border-gray-700"
      >
        {options.map((o) => (
            <button
                key={o.value}
                type="button"
                onClick={() => onChange(o.value)}
                className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                    value === o.value
                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/30'
                        : 'text-gray-600 dark:text-gray-300 hover:text-orange-600'
                }`}
            >
              {o.label}
            </button>
        ))}
      </div>
  );
}

const fieldClass =
    'px-3.5 py-2 border border-orange-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition-all';

const toISO = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const shiftDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const toDMY = (s) => {
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
};

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

  // Khoảng tùy chọn: từ ngày -> đến ngày (mặc định từ đầu tháng đến hôm nay)
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toISO(new Date()));

  useEffect(() => {
    if (user && user.isAdmin) {
      loadStats();
    }
  }, [user, filterType, timeRange, selectedDate, selectedMonth, startDate, endDate]);

  const loadStats = async () => {
    try {
      setLoading(true);
      // 'custom' dùng dữ liệu của 'range/all' rồi lọc theo ngày ở phía giao diện
      const params = new URLSearchParams({ filterType: filterType === 'custom' ? 'range' : filterType });
      if (filterType === 'custom') {
        params.set('timeRange', 'all');
        params.set('startDate', startDate);
        params.set('endDate', endDate);
      } else if (filterType === 'range') {
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

  const getTimeRangeText = () => {
    if (filterType === 'date') {
      const [year, month, day] = selectedDate.split('-');
      return `${day}/${month}/${year}`;
    }
    if (filterType === 'custom') {
      return `${toDMY(startDate)} – ${toDMY(endDate)}`;
    }
    if (filterType === 'specificMonth') {
      const [year, month] = selectedMonth.split('-');
      return `Tháng ${month}/${year}`;
    }

    const texts = {
      day: 'Hôm nay',
      week: '7 ngày qua',
      month: '30 ngày qua',
      year: '12 tháng qua',
      all: 'Tất cả thời gian'
    };
    return texts[timeRange] || timeRange;
  };

  // Chọn tháng bằng 2 ô select để luôn hiển thị tiếng Việt (input type="month" phụ thuộc ngôn ngữ trình duyệt)
  const [selYear, selMonth] = selectedMonth.split('-');
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
  if (!years.includes(Number(selYear))) years.push(Number(selYear));
  years.sort((a, b) => b - a);

  const changeMonthPart = (part, value) => {
    const y = part === 'year' ? value : selYear;
    const m = part === 'month' ? value : selMonth;
    setSelectedMonth(`${y}-${m}`);
  };

  const changeStart = (v) => {
    if (!v) return;
    setStartDate(v);
    if (v > endDate) setEndDate(v);
  };
  const changeEnd = (v) => {
    if (!v) return;
    setEndDate(v);
    if (v < startDate) setStartDate(v);
  };
  const applyLastDays = (n) => {
    setEndDate(shiftDays(0));
    setStartDate(shiftDays(-(n - 1)));
  };
  const applyThisMonth = () => {
    const now = new Date();
    setStartDate(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
    setEndDate(toISO(now));
  };

  const todayStr = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  if (!user || !user.isAdmin) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl max-w-md w-full text-center border border-gray-100 dark:border-gray-700">
            <span className="text-5xl">🔒</span>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">Quyền truy cập bị từ chối</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Bạn không có quyền truy cập trang thống kê doanh thu.</p>
            <Link to="/admin" className="inline-block bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-md shadow-orange-500/30">
              Quay lại Dashboard
            </Link>
          </div>
        </div>
    );
  }

  // Chỉ hiện màn hình chờ ở lần tải đầu; các lần đổi bộ lọc giữ nguyên trang để không bị nháy
  if (loading && !stats) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 dark:text-gray-400 font-medium">Đang tổng hợp dữ liệu doanh thu...</p>
        </div>
    );
  }

  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900/40 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-orange-500/20 mb-6">
            <div className="absolute -top-24 -right-20 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-yellow-300/10 rounded-full blur-3xl" />
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
              <div>
                <p className="text-sm font-semibold text-orange-100">Báo cáo tài chính</p>
                <h1 className="text-3xl font-black mt-1 text-white drop-shadow-sm leading-normal">Thống kê doanh thu</h1>
                <p className="text-orange-50/90 text-sm mt-1">Phân tích doanh số, hiệu suất bán hàng và giao dịch</p>
              </div>
              <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-xl transition-all duration-300 font-medium text-sm backdrop-blur-md">
                ← Quay lại Dashboard
              </Link>
            </div>
          </div>

          {/* Bộ lọc thời gian */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-orange-100 dark:border-gray-700/50 p-4 sm:p-5 mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-orange-100 dark:bg-orange-500/15 flex items-center justify-center text-lg">
                  📅
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800 dark:text-white">Khoảng thời gian</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Đang xem:{' '}
                    <span className="font-bold text-orange-600 dark:text-orange-400">{getTimeRangeText()}</span>
                    {loading && <span className="ml-2 text-xs text-gray-400">Đang cập nhật...</span>}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                    label="Loại bộ lọc thời gian"
                    value={filterType}
                    onChange={setFilterType}
                    options={[
                      { value: 'date', label: 'Ngày' },
                      { value: 'specificMonth', label: 'Tháng' },
                      { value: 'range', label: 'Khoảng' },
                      { value: 'custom', label: 'Từ – đến' },
                    ]}
                />

                {filterType === 'custom' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Từ
                        <input
                            type="date"
                            lang="vi"
                            value={startDate}
                            max={toISO(new Date())}
                            onChange={(e) => changeStart(e.target.value)}
                            aria-label="Từ ngày"
                            className={fieldClass}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
                        Đến
                        <input
                            type="date"
                            lang="vi"
                            value={endDate}
                            min={startDate}
                            max={toISO(new Date())}
                            onChange={(e) => changeEnd(e.target.value)}
                            aria-label="Đến ngày"
                            className={fieldClass}
                        />
                      </label>
                      <div className="flex items-center gap-1.5">
                        {[
                          { label: '7 ngày', run: () => applyLastDays(7) },
                          { label: '30 ngày', run: () => applyLastDays(30) },
                          { label: 'Tháng này', run: applyThisMonth },
                        ].map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={p.run}
                                className="px-3 py-2 text-xs font-semibold rounded-xl border border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                            >
                              {p.label}
                            </button>
                        ))}
                      </div>
                    </div>
                )}

                {filterType === 'range' && (
                    <Segmented
                        label="Khoảng thời gian"
                        value={timeRange}
                        onChange={setTimeRange}
                        options={[
                          { value: 'year', label: '12 tháng qua' },
                          { value: 'all', label: 'Tất cả' },
                        ]}
                    />
                )}

                {filterType === 'date' && (
                    <div className="flex items-center gap-2">
                      <input
                          type="date"
                          lang="vi"
                          value={selectedDate}
                          onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                          aria-label="Chọn ngày"
                          className={fieldClass}
                      />
                      <button
                          type="button"
                          onClick={() => setSelectedDate(todayStr())}
                          className="px-3 py-2 text-sm font-semibold rounded-xl border border-orange-200 dark:border-gray-600 text-orange-600 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        Hôm nay
                      </button>
                    </div>
                )}

                {filterType === 'specificMonth' && (
                    <div className="flex items-center gap-2">
                      <select
                          value={selMonth}
                          onChange={(e) => changeMonthPart('month', e.target.value)}
                          aria-label="Chọn tháng"
                          className={fieldClass}
                      >
                        {Array.from({ length: 12 }, (_, i) => {
                          const v = String(i + 1).padStart(2, '0');
                          return <option key={v} value={v}>Tháng {i + 1}</option>;
                        })}
                      </select>
                      <select
                          value={selYear}
                          onChange={(e) => changeMonthPart('year', e.target.value)}
                          aria-label="Chọn năm"
                          className={fieldClass}
                      >
                        {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
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
                    startDate={startDate}
                    endDate={endDate}
                />
              </div>
          )}
        </div>
      </div>
  );
}