import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BookingRepository, type Booking } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { Modal } from '../components/Modal';
import '../styles/PendingDeliveriesPage.css';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

type StatusFilter = 'All' | 'Pending' | 'Delivered' | 'Cancelled';
type SortKey = 'deliveryDate' | 'custName' | 'totalAmount' | 'bookingDate';

/**
 * Determines a visual "production stage" from the booking's financial and status fields.
 * This mirrors the dashboard pipeline logic.
 */
const getProductionStage = (b: Booking): string => {
  if (b.status === 'Cancelled') return 'Cancelled';
  if (b.status === 'Delivered') return 'Delivered';

  // Pending status — derive stage from payment state
  const hasPayments = b.payments && b.payments.length > 0;
  const fullyPaid = (b.balanceDue || 0) <= 0;

  if (!hasPayments && !fullyPaid) return 'Pending';
  if (fullyPaid) return 'In Production';
  return 'Scheduled';
};

const getBadgeClass = (stage: string): string => {
  switch (stage) {
    case 'Pending': return 'pdm-badge pdm-badge-pending';
    case 'In Production': return 'pdm-badge pdm-badge-production';
    case 'Scheduled': return 'pdm-badge pdm-badge-scheduled';
    case 'Delivered': return 'pdm-badge pdm-badge-delivered';
    case 'Cancelled': return 'pdm-badge pdm-badge-cancelled';
    default: return 'pdm-badge pdm-badge-pending';
  }
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const PendingDeliveriesPage: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Modal state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [sortBy, setSortBy] = useState<SortKey>('deliveryDate');
  const printRef = useRef<HTMLDivElement>(null);

  // Load bookings
  useEffect(() => {
    const load = async () => {
      const data = await BookingRepository.getBookings();
      setBookings(data);
    };
    load();
  }, []);

  // Current month info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // Filter pending bookings (not Delivered, not Cancelled)
  const pendingBookings = useMemo(() =>
    bookings.filter(b => b.status !== 'Delivered' && b.status !== 'Cancelled'),
    [bookings]
  );

  // Group by delivery month for selected year
  const monthlyData = useMemo(() => {
    const data: { count: number; value: number; pending: number }[] =
      Array.from({ length: 12 }, () => ({ count: 0, value: 0, pending: 0 }));

    pendingBookings.forEach(b => {
      const dd = new Date(b.deliveryDate);
      if (isNaN(dd.getTime())) return;
      if (dd.getFullYear() !== selectedYear) return;

      const m = dd.getMonth();
      data[m].count += 1;
      data[m].value += (b.totalAmount || 0);
      data[m].pending += (b.balanceDue || 0);
    });

    return data;
  }, [pendingBookings, selectedYear]);

  // Global summary for the year
  const yearSummary = useMemo(() => {
    let total = 0;
    let value = 0;
    let pending = 0;
    monthlyData.forEach(m => {
      total += m.count;
      value += m.value;
      pending += m.pending;
    });
    return { total, value, pending };
  }, [monthlyData]);

  // Get bookings for the selected month
  const selectedMonthBookings = useMemo(() => {
    if (selectedMonth === null) return [];

    return bookings.filter(b => {
      // Include all non-cancelled bookings whose delivery date falls in the selected month
      if (b.status === 'Cancelled' && statusFilter !== 'Cancelled' && statusFilter !== 'All') return false;

      const dd = new Date(b.deliveryDate);
      if (isNaN(dd.getTime())) return false;
      if (dd.getFullYear() !== selectedYear) return false;
      if (dd.getMonth() !== selectedMonth) return false;

      // For the grid card click, we show pending only; in the modal, we allow filter changes
      // Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Pending') {
          return b.status === 'Pending';
        }
        if (statusFilter === 'Delivered') {
          return b.status === 'Delivered';
        }
        if (statusFilter === 'Cancelled') {
          return b.status === 'Cancelled';
        }
      }

      return true;
    });
  }, [bookings, selectedMonth, selectedYear, statusFilter]);

  // Apply search
  const searchFiltered = useMemo(() => {
    if (!search.trim()) return selectedMonthBookings;
    const q = search.toLowerCase();
    return selectedMonthBookings.filter(b =>
      (b.bookingId || '').toLowerCase().includes(q) ||
      (b.custName || '').toLowerCase().includes(q) ||
      (b.mobile || '').includes(q) ||
      (b.items || []).some(item => (item.name || '').toLowerCase().includes(q))
    );
  }, [selectedMonthBookings, search]);

  // Apply sorting
  const sortedBookings = useMemo(() => {
    const sorted = [...searchFiltered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'deliveryDate':
          return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
        case 'bookingDate':
          return new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime();
        case 'custName':
          return (a.custName || '').localeCompare(b.custName || '');
        case 'totalAmount':
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [searchFiltered, sortBy]);

  // Modal summary for selected month
  const modalSummary = useMemo(() => {
    let totalValue = 0;
    let totalPending = 0;
    searchFiltered.forEach(b => {
      totalValue += (b.totalAmount || 0);
      totalPending += (b.balanceDue || 0);
    });
    return { count: searchFiltered.length, totalValue, totalPending };
  }, [searchFiltered]);

  // Open modal
  const handleMonthClick = useCallback((monthIdx: number) => {
    setSelectedMonth(monthIdx);
    setSearch('');
    setStatusFilter('All');
    setSortBy('deliveryDate');
    setShowModal(true);
  }, []);

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (sortedBookings.length === 0) return;
    const headers = ['Booking ID', 'Customer Name', 'Mobile', 'Product', 'Booking Date',
      'Delivery Date', 'Total Amount', 'Advance Paid', 'Balance Due', 'Status', 'Stage', 'Notes'];

    const rows = sortedBookings.map(b => [
      b.bookingId,
      b.custName,
      b.mobile,
      (b.items || []).map(i => i.name).join('; '),
      formatDate(b.bookingDate),
      formatDate(b.deliveryDate),
      (b.totalAmount || 0).toString(),
      (b.advancePaid || 0).toString(),
      (b.balanceDue || 0).toString(),
      b.status,
      getProductionStage(b),
      b.notes || ''
    ]);

    const csvContent = [headers, ...rows].map(r =>
      r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const monthName = selectedMonth !== null ? MONTH_SHORT[selectedMonth] : 'All';
    a.href = url;
    a.download = `Pending_Deliveries_${monthName}_${selectedYear}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sortedBookings, selectedMonth, selectedYear]);

  // Print
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Count class
  const getCountClass = (count: number): string => {
    if (count === 0) return 'count-zero';
    if (count <= 3) return 'count-low';
    if (count <= 7) return 'count-med';
    return 'count-high';
  };

  return (
    <div className="pdm-container">
      {/* Header */}
      <div className="pdm-header">
        <h1>📦 Pending Deliveries</h1>
      </div>
      <p className="pdm-header-sub">
        Monthly overview of pending deliveries &amp; production status. Click any month to view details.
      </p>

      {/* Year selector */}
      <div className="pdm-year-row">
        <button
          className="pdm-year-btn"
          onClick={() => setSelectedYear(y => y - 1)}
          title="Previous year"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="pdm-year-label">{selectedYear}</span>
        <button
          className="pdm-year-btn"
          onClick={() => setSelectedYear(y => y + 1)}
          title="Next year"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Year summary */}
      <div className="pdm-summary-row">
        <div className="pdm-summary-card">
          <div className="pdm-summary-label">Total Pending Deliveries</div>
          <div className="pdm-summary-value">{yearSummary.total}</div>
        </div>
        <div className="pdm-summary-card">
          <div className="pdm-summary-label">Total Booking Value</div>
          <div className="pdm-summary-value success">₹ {formatCurrency(yearSummary.value)}</div>
        </div>
        <div className="pdm-summary-card">
          <div className="pdm-summary-label">Total Pending Amount</div>
          <div className="pdm-summary-value danger">₹ {formatCurrency(yearSummary.pending)}</div>
        </div>
      </div>

      {/* 6x2 Month Grid */}
      <div className="pdm-grid">
        {MONTH_NAMES.map((name, idx) => {
          const data = monthlyData[idx];
          const isCurrent = selectedYear === currentYear && idx === currentMonth;
          return (
            <button
              key={idx}
              className={`pdm-month-card ${isCurrent ? 'is-current' : ''}`}
              onClick={() => handleMonthClick(idx)}
              title={`${name} ${selectedYear}: ${data.count} pending deliveries`}
            >
              <span className="pdm-month-name">{MONTH_SHORT[idx]}</span>
              <span className={`pdm-month-count ${getCountClass(data.count)}`}>
                {data.count}
              </span>
              <span className="pdm-month-sub">
                {data.count === 0 ? 'No pending' : `₹${formatCurrency(data.pending)} due`}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={selectedMonth !== null
          ? `📦 ${MONTH_NAMES[selectedMonth]} ${selectedYear} — Deliveries`
          : 'Deliveries'
        }
        size="full"
      >
        <div ref={printRef}>
          {/* Modal Toolbar */}
          <div className="pdm-modal-toolbar">
            {/* Search */}
            <div className="pdm-search-box">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by name, booking ID, mobile, product..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            {/* Status Filter Pills */}
            <div className="pdm-filter-group">
              {(['All', 'Pending', 'Delivered', 'Cancelled'] as StatusFilter[]).map(f => (
                <button
                  key={f}
                  className={`pdm-filter-pill ${statusFilter === f ? 'active' : ''}`}
                  onClick={() => setStatusFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              className="pdm-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as SortKey)}
            >
              <option value="deliveryDate">Sort: Delivery Date</option>
              <option value="bookingDate">Sort: Booking Date</option>
              <option value="custName">Sort: Customer Name</option>
              <option value="totalAmount">Sort: Booking Value</option>
            </select>

            {/* Export Buttons */}
            <div className="pdm-export-group">
              <button className="pdm-export-btn" onClick={handleExportCSV} title="Export as Excel/CSV">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Excel
              </button>
              <button className="pdm-export-btn" onClick={handlePrint} title="Print report">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 6 2 18 2 18 9" />
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                  <rect x="6" y="14" width="12" height="8" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="pdm-modal-stats">
            <div className="pdm-modal-stat">
              <div className="pdm-modal-stat-label">Total Records</div>
              <div className="pdm-modal-stat-value">{modalSummary.count}</div>
            </div>
            <div className="pdm-modal-stat">
              <div className="pdm-modal-stat-label">Total Booking Value</div>
              <div className="pdm-modal-stat-value">₹ {formatCurrency(modalSummary.totalValue)}</div>
            </div>
            <div className="pdm-modal-stat">
              <div className="pdm-modal-stat-label">Total Pending Amount</div>
              <div className="pdm-modal-stat-value" style={{ color: 'var(--danger)' }}>
                ₹ {formatCurrency(modalSummary.totalPending)}
              </div>
            </div>
          </div>

          {/* Data Table */}
          {sortedBookings.length === 0 ? (
            <div className="pdm-empty">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <div className="pdm-empty-title">No deliveries found</div>
              <div>No records match your current filters for {selectedMonth !== null ? MONTH_NAMES[selectedMonth] : ''} {selectedYear}.</div>
            </div>
          ) : (
            <div className="pdm-table-wrap">
              <table className="pdm-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Customer Name</th>
                    <th>Mobile</th>
                    <th>Product/Machine</th>
                    <th>Booking Date</th>
                    <th>Delivery Date</th>
                    <th style={{ textAlign: 'right' }}>Total Amount</th>
                    <th style={{ textAlign: 'right' }}>Advance</th>
                    <th style={{ textAlign: 'right' }}>Balance Due</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBookings.map(b => {
                    const stage = getProductionStage(b);
                    const isOverdue = b.status === 'Pending' && new Date(b.deliveryDate) < now;
                    return (
                      <tr key={b.bookingId}>
                        <td className="pdm-cell-strong">{b.bookingId}</td>
                        <td className="pdm-cell-strong">{b.custName}</td>
                        <td>{b.mobile || '—'}</td>
                        <td>{(b.items || []).map(i => i.name).join(', ') || '—'}</td>
                        <td>{formatDate(b.bookingDate)}</td>
                        <td style={{ color: isOverdue ? 'var(--danger)' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
                          {formatDate(b.deliveryDate)}
                          {isOverdue && ' ⚠️'}
                        </td>
                        <td className="pdm-cell-amount">₹ {formatCurrency(b.totalAmount)}</td>
                        <td className="pdm-cell-amount">₹ {formatCurrency(b.advancePaid)}</td>
                        <td className="pdm-cell-amount" style={{ color: (b.balanceDue || 0) > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                          ₹ {formatCurrency(b.balanceDue)}
                        </td>
                        <td>
                          <span className={getBadgeClass(b.status === 'Pending' ? 'Pending' : b.status === 'Delivered' ? 'Delivered' : 'Cancelled')}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <span className={getBadgeClass(stage)}>{stage}</span>
                        </td>
                        <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.notes || '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
