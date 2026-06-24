import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookingRepository, type Booking, type Payment } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { PrintService } from '../utils/PrintService';
import { Modal } from '../components/Modal';
import { BookingThermalPreview } from '../components/BookingThermalPreview';
import { BookingTraditionalPreview } from '../components/BookingTraditionalPreview';
import { PDFService } from '../services/PDFService';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { WorkflowTimeline } from '../components/WorkflowTimeline';
import { LoadingIndicator } from '../components/LoadingIndicator';
import '../styles/BookingDatabasePage.css';


export const BookingDatabasePage: React.FC = () => {
  const navigate = useNavigate();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, isAdmin } = useAuth();

  // States
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Booking Details Modal
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAuditLogs, setShowAuditLogs] = useState(false);

  // Subsequent Payment Sub-Modal Form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  
  // Payment Form States
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'NEFT/RTGS' | 'Cheque'>('Cash');
  const [payBankName, setPayBankName] = useState('');
  const [payTxnNo, setPayTxnNo] = useState('');
  const [payChequeNo, setPayChequeNo] = useState('');
  const [payChequeDate, setPayChequeDate] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payRecordedBy, setPayRecordedBy] = useState('Admin');

  // Specific Payment Print Receipt state
  const [activePrintPaymentIdx, setActivePrintPaymentIdx] = useState<number | undefined>(undefined);
  type PrintFormat = 'Thermal' | 'A4_Traditional';
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printType, setPrintType] = useState<PrintFormat>('A4_Traditional');

  // Customer Payment History Sub-Modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyBooking, setHistoryBooking] = useState<Booking | null>(null);





  // Load Bookings on mount and pull cloud
  useEffect(() => {
    const loadData = async () => {
      const data = await BookingRepository.getBookings();
      setBookings(data);
      setLoading(false);
    };
    loadData();
  }, []);



  // Analytics Strip
  const statsTotalCount = bookings.length;
  let statsDeliveredCount = 0;
  let statsAdvanceCash = 0;
  let statsAdvanceBank = 0;
  let statsBalancePending = 0;

  bookings.forEach((b) => {
    if (b.payments) {
      b.payments.forEach((p) => {
        if (p.method === 'Cash') {
          statsAdvanceCash += p.amount;
        } else if (p.method !== 'None') {
          statsAdvanceBank += p.amount;
        }
      });
    }
    statsBalancePending += b.balanceDue || 0;
    if (b.status === 'Delivered') {
      statsDeliveredCount += 1;
    }
  });

  // Map Bookings with their original index in the list
  const filteredBookings = bookings.map((b, i) => ({ ...b, _origIdx: i }));



  // Actions
  const handleToggleBookingStatus = async (idx: number) => {
    const b = bookings[idx];
    if (b.status === 'Pending' && b.balanceDue > 0) {
      alert(`Cannot deliver! Please clear the pending balance (Rs. ${b.balanceDue}) first.`);
      return;
    }
    
    const updated = await BookingRepository.toggleBookingStatus(idx, b.bookingId);
    setBookings(updated);
    if (selectedIdx === idx && selectedBooking) {
      const refreshed = updated.find(u => u.bookingId === b.bookingId);
      setSelectedBooking(refreshed || updated[idx]);
    }
  };

  const handleCancelBooking = async (idx: number) => {
    const b = bookings[idx];
    const actionText = b.status === 'Cancelled' ? 'restore' : 'cancel';
    if (!window.confirm(`Are you sure you want to ${actionText} this booking (${b.bookingId})?`)) {
      return;
    }
    
    const updated = await BookingRepository.cancelBooking(idx, b.bookingId);
    setBookings(updated);
    if (selectedIdx === idx && selectedBooking) {
      const refreshed = updated.find(u => u.bookingId === b.bookingId);
      setSelectedBooking(refreshed || updated[idx]);
    }
  };

  const handleDeleteBooking = async (idx: number, id: string) => {
    if (!isAdmin()) {
      alert("❌ Access Denied! Only Admin users can delete bookings.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete this booking record (${id})?`)) {
      const updated = await BookingRepository.deleteBooking(idx, id);
      setBookings(updated);
      if (selectedBooking && selectedBooking.bookingId === id) {
        setSelectedBooking(null);
        setSelectedIdx(null);
        setShowDetailsModal(false);
      }
      alert('Booking record deleted! ❌');
    }
  };

  // View Details Modal
  const handleViewDetails = (idx: number) => {
    setSelectedIdx(idx);
    setSelectedBooking(bookings[idx]);
    setShowDetailsModal(true);
    setShowAuditLogs(false);
  };

  const handleEditBooking = () => {
    if (selectedIdx === null || !selectedBooking) return;
    setShowDetailsModal(false);
    navigate('/booking', { state: { editBooking: { booking: selectedBooking, index: selectedIdx } } });
  };

  const handleOpenAddPayment = () => {
    setEditingPaymentId(null);
    setPayAmount('');
    setPayMethod('Cash');
    setPayBankName('');
    setPayTxnNo('');
    setPayChequeNo('');
    setPayChequeDate('');
    setPayRemarks('');
    setPayRecordedBy(currentUser?.username || 'Admin');
    setShowPaymentForm(true);
  };

  const handleOpenEditPayment = (p: Payment) => {
    if (!isAdmin()) {
      alert("❌ Access Denied! Only Admin users can edit payments.");
      return;
    }

    setEditingPaymentId(p.id);
    setPayAmount(String(p.amount));
    setPayMethod(p.method as any);
    setPayBankName(p.bankName || '');
    setPayTxnNo(p.transactionNo || '');
    setPayChequeNo(p.chequeNo || '');
    setPayChequeDate(p.chequeDate || '');
    setPayRemarks(p.remarks || '');
    setPayRecordedBy(p.enteredBy || currentUser?.username || 'Admin');
    setShowPaymentForm(true);
  };

  const handleSavePayment = async () => {
    if (selectedIdx === null || !selectedBooking) return;
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Payment Amount must be greater than 0!');
      return;
    }

    if (payMethod === 'UPI' && !payTxnNo.trim()) {
      alert('UPI Transaction/Reference Number is required!');
      return;
    }
    if (payMethod === 'NEFT/RTGS') {
      if (!payBankName.trim()) { alert('Bank Name is required!'); return; }
      if (!payTxnNo.trim()) { alert('Transaction/Reference Number is required!'); return; }
    }
    if (payMethod === 'Cheque') {
      if (!payBankName.trim()) { alert('Bank Name is required!'); return; }
      if (!payChequeNo.trim()) { alert('Cheque Number is required!'); return; }
      if (!payChequeDate) { alert('Cheque Date is required!'); return; }
    }

    let updatedBookings: Booking[];

    if (editingPaymentId === null) {
      const payment: Payment = {
        id: `pay_sub_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        date: new Date().toISOString(),
        method: payMethod,
        amount: amt,
        bankName: payBankName.trim() || undefined,
        transactionNo: payTxnNo.trim() || undefined,
        chequeNo: payChequeNo.trim() || undefined,
        chequeDate: payChequeDate || undefined,
        remarks: payRemarks.trim() || 'Subsequent payment',
        enteredBy: payRecordedBy.trim() || 'Admin'
      };

      updatedBookings = await BookingRepository.addPayment(selectedIdx, payment, selectedBooking.bookingId);
      alert('Payment transaction record saved! ✅');
    } else {
      const updatedPayment: Partial<Payment> = {
        amount: amt,
        method: payMethod,
        bankName: payBankName.trim() || undefined,
        transactionNo: payTxnNo.trim() || undefined,
        chequeNo: payChequeNo.trim() || undefined,
        chequeDate: payChequeDate || undefined,
        remarks: payRemarks.trim() || undefined,
        enteredBy: payRecordedBy.trim() || undefined
      };

      updatedBookings = await BookingRepository.editPayment(
        selectedIdx, 
        editingPaymentId, 
        updatedPayment, 
        payRecordedBy.trim() || 'Admin',
        selectedBooking.bookingId
      );
      alert('Payment transaction record updated! ✅');
    }

    setBookings(updatedBookings);
    const refreshedBooking = updatedBookings.find(u => u.bookingId === selectedBooking.bookingId);
    setSelectedBooking(refreshedBooking || updatedBookings[selectedIdx]);
    setShowPaymentForm(false);
    setEditingPaymentId(null);
  };

  const handleDeletePayment = async (pId: string) => {
    if (!isAdmin()) {
      alert("❌ Access Denied! Only Admin users can delete payments.");
      return;
    }

    if (selectedIdx === null || !selectedBooking) return;
    
    const p = selectedBooking.payments.find(pay => pay.id === pId);
    if (!p) return;

    if (!window.confirm(`Are you sure you want to delete this payment record (Rs. ${p.amount} via ${p.method})?`)) return;

    const adminName = currentUser?.username || 'Admin';

    const updatedBookings = await BookingRepository.deletePayment(selectedIdx, pId, adminName, selectedBooking.bookingId);
    setBookings(updatedBookings);
    const refreshedBooking = updatedBookings.find(u => u.bookingId === selectedBooking.bookingId);
    setSelectedBooking(refreshedBooking || updatedBookings[selectedIdx]);
    alert('Payment transaction deleted! ❌');
  };

  const handleOpenPrintReceipt = (pIdx?: number, format: PrintFormat = 'A4_Traditional') => {
    setShowDetailsModal(false);
    setActivePrintPaymentIdx(pIdx);
    setPrintType(format);
    setShowPrintModal(true);
  };

  const handleOpenHistory = (booking: Booking) => {
    setHistoryBooking(booking);
    setShowHistoryModal(true);
  };

  const handleOpenPrintReceiptFromHistory = (booking: Booking, pIdx?: number, format: PrintFormat = 'A4_Traditional') => {
    const idx = bookings.findIndex(b => b.bookingId === booking.bookingId);
    setShowHistoryModal(false);
    setSelectedBooking(booking);
    setSelectedIdx(idx !== -1 ? idx : null);
    setActivePrintPaymentIdx(pIdx);
    setPrintType(format);
    setShowPrintModal(true);
  };

  const handlePrint = async () => {
    if (!printAreaRef.current) return;
    let selector = '#bookingTraditionalPrintArea';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }

    const content = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (content) {
      await PrintService.printElement(content, printType === 'Thermal');
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedBooking || !printAreaRef.current) return;
    const cleanId = selectedBooking.bookingId.replace(/\//g, '-');
    let fileName = `KVU_Booking_Receipt_${cleanId}`;
    if (activePrintPaymentIdx !== undefined) {
      fileName += `_P${activePrintPaymentIdx + 1}`;
    }
    fileName += '.pdf';
    
    let selector = '#bookingTraditionalPdfCapture';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }

    const wrapper = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (wrapper) {
      await PDFService.downloadPdf(wrapper, fileName, false);
    }
  };

  const handleWhatsAppShare = async () => {
    if (!selectedBooking || !printAreaRef.current) return;
    let selector = '#bookingTraditionalPdfCapture';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }

    const wrapper = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (wrapper) {
      let label = 'Booking Advance Receipt';
      if (activePrintPaymentIdx !== undefined) {
        label += ` (Payment P${activePrintPaymentIdx + 1})`;
      }
      await PDFService.shareWhatsApp(
        wrapper,
        selectedBooking.custName,
        selectedBooking.bookingId,
        String(selectedBooking.totalAmount),
        selectedBooking.mobile,
        selectedBooking.bookingDate,
        label,
        (msg) => console.log('[Share Toast]', msg),
        false
      );
    }
  };



  const formatDateString = (dStr: string) => {
    if (!dStr) return '';
    const dateVal = new Date(dStr);
    if (isNaN(dateVal.getTime())) return dStr;
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const todayStr = new Date().toISOString().substring(0, 10);

  const columns = [
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (b: any) => (
        <div className="table-actions-container">
          <button 
            type="button" 
            onClick={() => handleOpenHistory(b)}
            title="Payment History Ledger"
            className="action-row-btn"
          >
            📜
          </button>
          <button 
            type="button" 
            onClick={() => handleViewDetails(b._origIdx)}
            title="View Details & Receipt"
            className="action-row-btn view-btn"
          >
            👁️
          </button>
          {isAdmin() && (
            <button 
              type="button" 
              onClick={() => handleDeleteBooking(b._origIdx, b.bookingId)}
              title="Delete Booking"
              className="action-row-btn delete-btn"
            >
              🗑️
            </button>
          )}
        </div>
      )
    },
    {
      key: 'bookingId',
      header: 'Booking ID',
      sortable: true,
      render: (b: Booking) => <span className="font-bold">{b.bookingId}</span>
    },
    {
      key: 'custName',
      header: 'Customer Name',
      sortable: true,
      render: (b: Booking) => <span className="font-medium">{b.custName}</span>
    },
    {
      key: 'bookingDate',
      header: 'Booking Date',
      sortable: true,
      render: (b: Booking) => <span>{formatDateString(b.bookingDate)}</span>
    },
    {
      key: 'deliveryDate',
      header: 'Expected Delivery',
      sortable: true,
      render: (b: Booking) => {
        const isOverdue = b.status === 'Pending' && b.deliveryDate < todayStr;
        const dDateFmt = formatDateString(b.deliveryDate);
        return isOverdue ? (
          <span className="text-danger font-bold">
            {dDateFmt} ⚠️
          </span>
        ) : (
          <span>{dDateFmt}</span>
        );
      }
    },
    {
      key: 'totalAmount',
      header: 'Total Value',
      sortable: true,
      sortValue: (b: Booking) => b.totalAmount,
      render: (b: Booking) => <span className="font-bold" style={{ whiteSpace: 'nowrap' }}>₹ {formatCurrency(b.totalAmount)}</span>
    },
    {
      key: 'advancePaid',
      header: 'Advance Paid',
      sortable: true,
      sortValue: (b: Booking) => b.advancePaid,
      render: (b: Booking) => (
        <span style={{ whiteSpace: 'nowrap' }}>
          ₹ {formatCurrency(b.advancePaid)} <small className="text-muted">({b.paymentMode})</small>
        </span>
      )
    },
    {
      key: 'balanceDue',
      header: 'Balance Due',
      sortable: true,
      sortValue: (b: Booking) => b.balanceDue,
      render: (b: Booking) => (
        <span className={b.balanceDue > 0 ? 'text-danger font-bold' : 'text-success font-bold'} style={{ whiteSpace: 'nowrap' }}>
          ₹ {formatCurrency(b.balanceDue)}
        </span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (b: any) => {
        if (b.status === 'Cancelled') {
          return (
            <span className="status-toggle-btn pending" style={{ background: '#6c757d', color: '#fff', cursor: 'default', opacity: 0.8, display: 'inline-block', textAlign: 'center', minWidth: '100px' }}>
              🚫 Cancelled
            </span>
          );
        }
        return (
          <button 
            type="button" 
            onClick={() => handleToggleBookingStatus(b._origIdx)}
            className={`status-toggle-btn ${b.status === 'Delivered' ? 'delivered' : 'pending'}`}
          >
            {b.status === 'Delivered' ? '✅ Delivered' : '⏳ Pending'}
          </button>
        );
      }
    }
  ];

  return (
    <div className="tab-panel db-container">
      
      {/* Analytics Strip */}
      <div className="booking-dashboard db-stats-grid">
        <div className="db-kpi-card">
          <span className="db-kpi-label">Total Bookings</span>
          <span className="db-kpi-value">{statsTotalCount}</span>
          <span className="db-kpi-footer">Total booked records</span>
        </div>
        <div className="db-kpi-card success-border">
          <span className="db-kpi-label">Delivered Items</span>
          <span className="db-kpi-value success-text">{statsDeliveredCount}</span>
          <span className="db-kpi-footer">Successfully delivered</span>
        </div>
        <div className="db-kpi-card primary-border">
          <span className="db-kpi-label">Advance (Cash)</span>
          <span className="db-kpi-value">₹ {formatCurrency(statsAdvanceCash)}</span>
          <span className="db-kpi-footer">Received in Cash</span>
        </div>
        <div className="db-kpi-card primary-border">
          <span className="db-kpi-label">Advance (Bank A/c)</span>
          <span className="db-kpi-value">₹ {formatCurrency(statsAdvanceBank)}</span>
          <span className="db-kpi-footer">Bank / UPI / Cheque</span>
        </div>
        <div className="db-kpi-card danger-border">
          <span className="db-kpi-label">Pending Balance</span>
          <span className="db-kpi-value danger-text">₹ {formatCurrency(statsBalancePending)}</span>
          <span className="db-kpi-footer">To be collected</span>
        </div>
      </div>

      {/* Booking History Panel */}
      <div className="db-panel" style={{ background: 'transparent', padding: 0, marginBottom: '32px' }}>
        <div 
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
              Booking Records Database
            </h1>
          </div>
        </div>

        {loading ? (
          <LoadingIndicator message="Loading bookings..." />
        ) : (
          <DataTable
            data={filteredBookings}
            columns={columns}
            searchPlaceholder="Search booking, client, tractor, specs..."
            searchFields={['bookingId', 'custName', 'tractor', 'hp', 'pullySize', 'ptoShaft']}
            exportFileName="bookings-database"
          />
        )}
      </div>



      {/* Selected Booking Details & Payment Manager Modal */}
      {showDetailsModal && selectedBooking && (
        <Modal
          isOpen={showDetailsModal}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedBooking(null);
          }}
          title={`📋 Booking Details: ${selectedBooking.bookingId}`}
          size="lg"
        >
          {/* Timeline tracking visualizer */}
          <div className="modal-timeline-container">
            <h4 className="modal-timeline-title">Production Timeline Status</h4>
            <WorkflowTimeline booking={selectedBooking} />
          </div>

          {/* Customer / Booking Info Grid */}
          <div className="modal-details-grid">
            <div>
              <h4 className="modal-details-col-title">👤 Customer Information</h4>
              <div><b>Name:</b> {selectedBooking.custGender === 'female' ? 'SMT. ' : 'SRI. '}{selectedBooking.custName}</div>
              <div><b>Relation:</b> {selectedBooking.relation} {selectedBooking.fatherName}</div>
              <div><b>Address:</b> {[selectedBooking.address, selectedBooking.post, selectedBooking.district, selectedBooking.state].filter(Boolean).join(', ') + (selectedBooking.pincode ? ` - ${selectedBooking.pincode}` : '')}</div>
              <div><b>Mobile No:</b> {selectedBooking.mobile}</div>
            </div>
            <div>
              <h4 className="modal-details-col-title">📅 Booking Information</h4>
              <div><b>Booking ID:</b> <b style={{ color: 'var(--primary)' }}>{selectedBooking.bookingId}</b></div>
              <div><b>Booking Date:</b> {formatDateString(selectedBooking.bookingDate)}</div>
              <div><b>Expected Delivery:</b> {formatDateString(selectedBooking.deliveryDate)}</div>
              <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <b>Status:</b> 
                {selectedBooking.status !== 'Cancelled' ? (
                  <>
                    <button 
                      type="button" 
                      className={`status-toggle-btn ${selectedBooking.status === 'Delivered' ? 'delivered' : 'pending'}`}
                      onClick={() => selectedIdx !== null && handleToggleBookingStatus(selectedIdx)}
                    >
                      {selectedBooking.status === 'Delivered' ? '✅ Delivered' : '⏳ Pending'}
                    </button>
                    <button
                      type="button"
                      className="status-toggle-btn"
                      style={{ background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => selectedIdx !== null && handleCancelBooking(selectedIdx)}
                    >
                      🚫 Cancel Booking
                    </button>
                  </>
                ) : (
                  <>
                    <span className="status-toggle-btn pending" style={{ background: '#6c757d', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                      🚫 Cancelled
                    </span>
                    <button
                      type="button"
                      className="status-toggle-btn"
                      style={{ background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => selectedIdx !== null && handleCancelBooking(selectedIdx)}
                    >
                      🔄 Restore Booking
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Booked Items Table */}
          <h4 className="modal-section-subtitle">🛒 Booked Machines / Items</h4>
          <table className="dues-table-view" style={{ marginBottom: '15px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-table-hdr)' }}>
                <th>#</th>
                <th>Machine/Item Name & Description</th>
                <th>Qty</th>
                <th style={{ textAlign: 'right' }}>Rate (Rs.)</th>
                <th style={{ textAlign: 'right' }}>Total (Rs.)</th>
              </tr>
            </thead>
            <tbody>
              {selectedBooking.items.map((item, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>
                    <b>{item.name}</b>
                    {item.desc && <><br /><small style={{ color: 'var(--text-secondary)' }}>{item.desc}</small></>}
                  </td>
                  <td>{item.qty}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={5} style={{ padding: '12px', background: 'var(--bg-page)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', fontSize: '13px' }}>
                    <div>🌪️ <b>Cyclone:</b> {selectedBooking.cyclone || 'No'}</div>
                    <div>🌾 <b>Jhanna:</b> {selectedBooking.jhanna || 'No'}</div>
                    <div>🚜 <b>Tractor:</b> {selectedBooking.tractor || '—'}</div>
                    <div>⚡ <b>HP:</b> {selectedBooking.hp || '—'}</div>
                    <div>⚙️ <b>Pully Size:</b> {selectedBooking.pullySize || '—'}</div>
                    <div>🔧 <b>PTO Shaft:</b> {selectedBooking.ptoShaft || '—'}</div>
                  </div>
                </td>
              </tr>
              {selectedBooking.notes && (
                <tr>
                  <td colSpan={2} style={{ padding: '8px', background: 'var(--bg-page)', fontStyle: 'italic' }}>📝 <b>Notes:</b> {selectedBooking.notes}</td>
                  <td colSpan={3} style={{ background: 'var(--bg-page)' }}></td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pricing Breakdown Grid */}
          <div className="modal-pricing-grid">
            <div className="pricing-summary-card">
              <h4 className="modal-details-col-title">💰 Pricing Breakdown</h4>
              <div className="pricing-summary-row">
                <span>Items Subtotal:</span>
                <span>₹ {formatCurrency(selectedBooking.originalPrice)}</span>
              </div>
              <div className="pricing-summary-row" style={{ color: 'var(--success)' }}>
                <span>Additional Charges:</span>
                <span>+ ₹ {formatCurrency(selectedBooking.additionalCharges)}</span>
              </div>
              <div className="pricing-summary-row" style={{ color: 'var(--danger)' }}>
                <span>Discount / Reduction:</span>
                <span>- ₹ {formatCurrency(selectedBooking.discount)}</span>
              </div>
              <div className="pricing-summary-row total-row" style={{ color: 'var(--danger)' }}>
                <span>Final Booking Value:</span>
                <span>₹ {formatCurrency(selectedBooking.totalAmount)}</span>
              </div>
            </div>
            
            <div className="pricing-summary-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 className="modal-details-col-title">💳 Payment Status &amp; Balance</h4>
              <div className="pricing-summary-row">
                <span>Total Received:</span>
                <span style={{ fontWeight: '700', color: 'var(--success)' }}>₹ {formatCurrency(selectedBooking.advancePaid)}</span>
              </div>
              <div className="pricing-summary-row">
                <span>Balance Due:</span>
                <span style={{ fontWeight: '700', color: 'var(--danger)' }}>₹ {formatCurrency(selectedBooking.balanceDue)}</span>
              </div>
              <div className="pricing-summary-row" style={{ alignItems: 'center', marginTop: '6px' }}>
                <span>Status:</span>
                <span style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: '11px',
                  fontWeight: '700',
                  border: '1px solid var(--border)'
                }}>{selectedBooking.paymentStatus}</span>
              </div>
            </div>
          </div>

          {/* Payment History List */}
          <div className="payment-section-header">
            <h4 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '13px', fontWeight: '700' }}>💳 Advance Payment Transactions</h4>
            <button 
              type="button" 
              onClick={handleOpenAddPayment}
              className="payment-add-btn"
            >
              ➕ Add Payment
            </button>
          </div>

          {/* Payment Form Overlay inside details */}
          {showPaymentForm && (
            <div className="payment-form-overlay-card">
              <h5 className="payment-form-overlay-title">
                {editingPaymentId ? '✏️ Edit Payment Transaction' : '➕ Add Payment Transaction'}
              </h5>
              
              <div className="payment-form-grid-2">
                <div>
                  <label>Amount (Rs.) *</label>
                  <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                </div>
                <div>
                  <label>Method *</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value as any)}>
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT/RTGS">NEFT/RTGS</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {(payMethod === 'NEFT/RTGS' || payMethod === 'Cheque') && (
                <div className="payment-form-single-col">
                  <label>Bank Name *</label>
                  <input type="text" placeholder="Bank Name" value={payBankName} onChange={e => setPayBankName(e.target.value)} />
                </div>
              )}

              {payMethod !== 'Cash' && (
                <div className="payment-form-single-col">
                  {(payMethod === 'UPI' || payMethod === 'NEFT/RTGS') && (
                    <div>
                      <label>Transaction / Ref No. *</label>
                      <input type="text" placeholder="Ref No." value={payTxnNo} onChange={e => setPayTxnNo(e.target.value)} />
                    </div>
                  )}
                  {payMethod === 'Cheque' && (
                    <div className="payment-form-grid-2">
                      <div>
                        <label>Cheque Number *</label>
                        <input type="text" placeholder="6-digit No." value={payChequeNo} onChange={e => setPayChequeNo(e.target.value)} />
                      </div>
                      <div>
                        <label>Cheque Date *</label>
                        <input type="date" value={payChequeDate} onChange={e => setPayChequeDate(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="payment-form-grid-2" style={{ gridTemplateColumns: '1.5fr 1fr' }}>
                <div>
                  <label>Remarks</label>
                  <input type="text" placeholder="Remarks (optional)" value={payRemarks} onChange={e => setPayRemarks(e.target.value)} />
                </div>
                <div>
                  <label>Recorded By *</label>
                  <input type="text" value={payRecordedBy} onChange={e => setPayRecordedBy(e.target.value)} />
                </div>
              </div>

              <div className="table-actions-container" style={{ justifyContent: 'flex-end' }}>
                <Button onClick={handleSavePayment} variant="primary" style={{ padding: '6px 12px', fontSize: '11px', margin: 0 }}>Save</Button>
                <Button onClick={() => setShowPaymentForm(false)} variant="secondary" style={{ padding: '6px 12px', fontSize: '11px', margin: 0 }}>Cancel</Button>
              </div>
            </div>
          )}

          {(!selectedBooking.payments || selectedBooking.payments.length === 0) ? (
            <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '15px' }}>
              No payments recorded yet.
            </div>
          ) : (
            <table className="dues-table-view" style={{ fontSize: '11.5px', marginBottom: '15px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-table-hdr)' }}>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Details</th>
                  <th>Entered By</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedBooking.payments.map((p, pIdx) => {
                  let payDetails = '';
                  if (p.method === 'Cash') {
                    payDetails = p.remarks || 'Cash payment';
                  } else if (p.method === 'UPI') {
                    payDetails = `Ref: ${p.transactionNo || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                  } else if (p.method === 'NEFT/RTGS') {
                    payDetails = `Bank: ${p.bankName || 'N/A'}, Ref: ${p.transactionNo || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                  } else if (p.method === 'Cheque') {
                    payDetails = `Bank: ${p.bankName || 'N/A'}, No: ${p.chequeNo || 'N/A'}, Date: ${p.chequeDate || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                  }

                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                      <td style={{ fontWeight: '700' }}>₹ {formatCurrency(p.amount)}</td>
                      <td>{p.method}</td>
                      <td>{payDetails}</td>
                      <td>{p.enteredBy}</td>
                      <td>
                        <div className="table-actions-container">
                          <button 
                            type="button" 
                            style={{ padding: '2px 6px', fontSize: '10px', minHeight: 'auto', background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            onClick={() => handleOpenPrintReceipt(pIdx, 'A4_Traditional')}
                            title="Print A4 Receipt"
                          >
                            🖨️ A4
                          </button>
                          <button 
                            type="button" 
                            style={{ padding: '2px 6px', fontSize: '10px', minHeight: 'auto', background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
                            onClick={() => handleOpenPrintReceipt(pIdx, 'Thermal')}
                            title="Print Thermal Receipt"
                          >
                            🧾 Th
                          </button>
                          {isAdmin() && (
                            <>
                              <button 
                                type="button" 
                                style={{ padding: '2px 4px', fontSize: '10px', minHeight: 'auto', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                onClick={() => handleOpenEditPayment(p)}
                                title="Edit Payment"
                              >
                                ✏️
                              </button>
                              <button 
                                type="button" 
                                style={{ padding: '2px 4px', fontSize: '10px', minHeight: 'auto', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--danger)', cursor: 'pointer' }}
                                onClick={() => handleDeletePayment(p.id)}
                                title="Delete Payment"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Audit Logs Section */}
          <div style={{ marginBottom: '20px' }}>
            <button 
              onClick={() => setShowAuditLogs(!showAuditLogs)} 
              style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', cursor: 'pointer', margin: 0 }}
            >
              <span>📜 Audit Trails History</span>
              <span>{showAuditLogs ? '▼' : '▶'}</span>
            </button>
            
            {showAuditLogs && (
              <pre style={{ margin: '5px 0 0 0', padding: '12px', background: '#1e293b', color: '#f8fafc', fontSize: '11px', borderRadius: 'var(--radius-sm)', overflowX: 'auto', whiteSpace: 'pre-wrap', maxHeight: '120px', overflowY: 'auto' }}>
                {selectedBooking.auditLog && selectedBooking.auditLog.length > 0 ? (
                  selectedBooking.auditLog.map(log => 
                    `[${new Date(log.timestamp).toLocaleString('en-GB')}] ${log.user}: ${log.action} - ${log.details}`
                  ).join('\n')
                ) : (
                  'No audit logs recorded.'
                )}
              </pre>
            )}
          </div>

          {/* Actions Toolbar */}
          <div className="modal-actions-toolbar">
            <Button onClick={() => handleOpenPrintReceipt(undefined, 'A4_Traditional')} style={{ background: 'var(--primary)', color: 'white', margin: 0 }}>🖨 Print A4</Button>
            <Button onClick={() => handleOpenPrintReceipt(undefined, 'Thermal')} style={{ background: 'var(--primary)', color: 'white', margin: 0 }}>🖨 Print Thermal</Button>
            {isAdmin() && (
              <Button onClick={handleEditBooking} style={{ background: 'var(--primary)', color: 'white', margin: 0 }}>✏️ Edit Booking</Button>
            )}
            <Button onClick={() => {
              setShowDetailsModal(false);
              setSelectedBooking(null);
            }} variant="secondary" style={{ margin: 0 }}>Close</Button>
          </div>
        </Modal>
      )}

      {/* Customer Payment History Modal */}
      {showHistoryModal && historyBooking && (
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title={`📜 Payment History: ${historyBooking.custName}`}
          size="lg"
        >
          <div style={{ marginBottom: '20px', padding: '16px', background: 'var(--primary-bg)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
              <div><b>Booking ID:</b> {historyBooking.bookingId}</div>
              <div><b>Booking Date:</b> {formatDateString(historyBooking.bookingDate)}</div>
              <div><b>Customer Name:</b> {historyBooking.custName}</div>
              <div><b>Mobile:</b> {historyBooking.mobile}</div>
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>TOTAL VALUE</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>₹ {formatCurrency(historyBooking.totalAmount)}</div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>TOTAL PAID</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--success)' }}>
                  ₹ {formatCurrency(historyBooking.payments ? historyBooking.payments.reduce((sum, p) => sum + p.amount, 0) : historyBooking.advancePaid)}
                </div>
              </div>
              <div style={{ flex: 1, textAlign: 'center', background: 'var(--bg-card)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>BALANCE DUE</div>
                <div style={{ fontSize: '16px', fontWeight: '800', color: historyBooking.balanceDue > 0 ? 'var(--danger)' : 'var(--success)' }}>
                  ₹ {formatCurrency(historyBooking.balanceDue)}
                </div>
              </div>
            </div>
          </div>

          <h4 style={{ margin: '16px 0 8px 0', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px', fontWeight: '700' }}>💳 Advance Payment Transactions</h4>
          {(!historyBooking.payments || historyBooking.payments.length === 0) ? (
            <div style={{ padding: '16px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: '12px' }}>
              No payments recorded yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dues-table-view">
                <thead>
                  <tr style={{ background: 'var(--bg-table-hdr)' }}>
                    <th>Date</th>
                    <th>Amount Paid</th>
                    <th>Method</th>
                    <th>Details</th>
                    <th>Entered By</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyBooking.payments.map((p, pIdx) => {
                    let payDetails = '';
                    if (p.method === 'Cash') {
                      payDetails = p.remarks || 'Cash payment';
                    } else if (p.method === 'UPI') {
                      payDetails = `Ref: ${p.transactionNo || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                    } else if (p.method === 'NEFT/RTGS') {
                      payDetails = `Bank: ${p.bankName || 'N/A'}, Ref: ${p.transactionNo || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                    } else if (p.method === 'Cheque') {
                      payDetails = `Bank: ${p.bankName || 'N/A'}, No: ${p.chequeNo || 'N/A'}, Date: ${p.chequeDate || 'N/A'}` + (p.remarks ? ` (${p.remarks})` : '');
                    }

                    return (
                      <tr key={p.id}>
                        <td>{new Date(p.date).toLocaleDateString('en-GB')}</td>
                        <td style={{ fontWeight: '700' }}>₹ {formatCurrency(p.amount)}</td>
                        <td>{p.method}</td>
                        <td>{payDetails}</td>
                        <td>{p.enteredBy}</td>
                        <td>
                          <div className="table-actions-container">
                            <button 
                              type="button" 
                              style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'auto', background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                              onClick={() => handleOpenPrintReceiptFromHistory(historyBooking, pIdx, 'A4_Traditional')}
                              title="Print A4 Receipt"
                            >
                              🖨️ A4
                            </button>
                            <button 
                              type="button" 
                              style={{ padding: '4px 8px', fontSize: '10px', minHeight: 'auto', background: 'var(--primary-bg)', color: 'var(--primary)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                              onClick={() => handleOpenPrintReceiptFromHistory(historyBooking, pIdx, 'Thermal')}
                              title="Print Thermal Receipt"
                            >
                              🧾 Th
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
            <Button onClick={() => setShowHistoryModal(false)} variant="secondary" style={{ margin: 0 }}>Close</Button>
          </div>
        </Modal>
      )}

      {/* Print Overlay Preview Modal */}
      {showPrintModal && selectedBooking && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title={`🖨 Receipt Preview ${activePrintPaymentIdx !== undefined ? `(Payment P${activePrintPaymentIdx + 1})` : ''}`}
          size="lg"
        >
          {/* Print type selector */}
          <div className="print-format-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPrintType('A4_Traditional')}
              className={`print-format-btn ${printType === 'A4_Traditional' ? 'active' : ''}`}
            >📟 A4 Traditional</button>
            <button
              onClick={() => setPrintType('Thermal')}
              className={`print-format-btn ${printType === 'Thermal' ? 'active' : ''}`}
            >🖨 Thermal Slip</button>
          </div>

          <div ref={printAreaRef} style={{ maxHeight: '60vh', overflow: 'auto', padding: '16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {printType === 'A4_Traditional' && (
              <BookingTraditionalPreview booking={selectedBooking} paymentIndex={activePrintPaymentIdx} />
            )}
            {printType === 'Thermal' && (
              <BookingThermalPreview booking={selectedBooking} paymentIndex={activePrintPaymentIdx} />
            )}
          </div>

          <div className="modal-actions-toolbar" style={{ marginTop: '20px' }}>
            <Button onClick={handlePrint} variant="primary" style={{ margin: 0 }}>🖨 Print Receipt</Button>
            <Button onClick={handleDownloadPdf} variant="success" style={{ margin: 0 }}>📥 Download PDF</Button>
            <button 
              onClick={handleWhatsAppShare} 
              className="whatsapp-share-button"
            >
              💬 Share WhatsApp
            </button>
            <Button onClick={() => setShowPrintModal(false)} variant="secondary" style={{ margin: 0 }}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingDatabasePage;
