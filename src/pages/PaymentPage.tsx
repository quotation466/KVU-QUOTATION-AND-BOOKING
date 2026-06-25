import React, { useState, useEffect, useRef } from 'react';
import { PaymentRepository, type AggregatedPayment } from '../repositories/PaymentRepository';
import { useAuth } from '../contexts/AuthContext';
import { BookingRepository, type Booking, type Payment } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { Modal } from '../components/Modal';
import { BookingThermalPreview } from '../components/BookingThermalPreview';
import { BookingTraditionalPreview } from '../components/BookingTraditionalPreview';
import { PDFService } from '../services/PDFService';
import { Button } from '../components/Button';
import { PrintService } from '../utils/PrintService';
import { getFiscalYear } from '../utils/fiscalYear';
import { DataTable } from '../components/DataTable';
import '../styles/PaymentPage.css';

export const PaymentPage: React.FC = () => {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const { currentUser, isAdmin } = useAuth();

  // States
  const [payments, setPayments] = useState<AggregatedPayment[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('All');
  
  // Date Range Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Edit Payment Form Modal Overlay
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedPay, setSelectedPay] = useState<AggregatedPayment | null>(null);

  // Form Fields
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'NEFT/RTGS' | 'Cheque'>('Cash');
  const [payBankName, setPayBankName] = useState('');
  const [payTxnNo, setPayTxnNo] = useState('');
  const [payChequeNo, setPayChequeNo] = useState('');
  const [payChequeDate, setPayChequeDate] = useState('');
  const [payRemarks, setPayRemarks] = useState('');
  const [payRecordedBy, setPayRecordedBy] = useState('Admin');

  // Print Modal
  type PrintFormat = 'Thermal' | 'A4_Traditional';
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [printPaymentIdx, setPrintPaymentIdx] = useState<number | undefined>(undefined);
  const [printType, setPrintType] = useState<PrintFormat>('A4_Traditional');
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Load payments and bookings
  const loadData = async () => {
    const list = await PaymentRepository.getAllPayments();
    setPayments(list);
    const bkList = await BookingRepository.getBookings();
    setBookings(bkList);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const todayStr = new Date().toISOString().substring(0, 10);
  
  const filteredPayments = payments.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const pDateStr = p.date.substring(0, 10);

    const matchesSearch = !q || 
      p.custName.toLowerCase().includes(q) ||
      p.bookingId.toLowerCase().includes(q) ||
      (p.transactionNo || '').toLowerCase().includes(q) ||
      (p.remarks || '').toLowerCase().includes(q);

    const matchesMethod = methodFilter === 'All' || p.method === methodFilter;

    let matchesDates = true;
    if (startDate && pDateStr < startDate) matchesDates = false;
    if (endDate && pDateStr > endDate) matchesDates = false;

    return matchesSearch && matchesMethod && matchesDates;
  });

  // Analytics Collections
  let totalCash = 0;
  let totalBank = 0;
  let todayCollection = 0;
  let rangeCollection = 0;

  payments.forEach((p) => {
    const amt = p.amount || 0;
    const pDateStr = p.date.substring(0, 10);

    if (p.method === 'Cash') {
      totalCash += amt;
    } else {
      totalBank += amt;
    }

    if (pDateStr === todayStr) {
      todayCollection += amt;
    }
  });

  filteredPayments.forEach((p) => {
    rangeCollection += p.amount || 0;
  });

  // Action: Open Print Preview Modal
  const handleOpenPrint = (p: AggregatedPayment) => {
    const b = bookings.find((book) => book.bookingId === p.bookingId);
    if (!b) return;

    const idx = b.payments?.findIndex((pay) => pay.id === p.id);
    setPrintBooking(b);
    setPrintPaymentIdx(idx !== -1 ? idx : undefined);
    setShowPrintModal(true);
  };

  // Action: Open Edit Payment
  const handleOpenEdit = (p: AggregatedPayment) => {
    if (!isAdmin()) {
      alert("❌ Access Denied! Only Admin users can edit payments.");
      return;
    }

    setSelectedPay(p);
    setPayAmount(String(p.amount));
    setPayMethod(p.method as any);
    setPayBankName(p.bankName || '');
    setPayTxnNo(p.transactionNo || '');
    setPayChequeNo(p.chequeNo || '');
    setPayChequeDate(p.chequeDate || '');
    setPayRemarks(p.remarks || '');
    setPayRecordedBy(p.enteredBy || currentUser?.username || 'Admin');
    setShowEditForm(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedPay) return;

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

    const updatedFields: Partial<Payment> = {
      amount: amt,
      method: payMethod,
      bankName: payBankName.trim() || undefined,
      transactionNo: payTxnNo.trim() || undefined,
      chequeNo: payChequeNo.trim() || undefined,
      chequeDate: payChequeDate || undefined,
      remarks: payRemarks.trim() || undefined,
      enteredBy: payRecordedBy.trim() || 'Admin'
    };

    await PaymentRepository.editPayment(
      selectedPay.bookingIndex,
      selectedPay.id,
      updatedFields,
      payRecordedBy.trim() || 'Admin',
      selectedPay.bookingId
    );

    alert('Payment transaction record updated successfully! ✅');
    setShowEditForm(false);
    setSelectedPay(null);
    loadData();
  };

  // Action: Delete Payment
  const handleDelete = async (p: AggregatedPayment) => {
    if (!isAdmin()) {
      alert("❌ Access Denied! Only Admin users can delete payments.");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete this payment record (Rs. ${p.amount} via ${p.method})?`)) return;

    const adminName = currentUser?.username || 'Admin';

    await PaymentRepository.deletePayment(p.bookingIndex, p.id, adminName, p.bookingId);
    alert('Payment transaction deleted! ❌');
    loadData();
  };

  // Printing & PDF Exports
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
    if (!printBooking || !printAreaRef.current) return;
    const cleanId = printBooking.bookingId.replace(/\//g, '-');
    let fileName = `KVU_Booking_Receipt_${cleanId}`;
    if (printPaymentIdx !== undefined) {
      fileName += `_P${printPaymentIdx + 1}`;
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
    if (!printBooking || !printAreaRef.current) return;
    let selector = '#bookingTraditionalPdfCapture';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }

    const wrapper = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (wrapper) {
      let label = 'Booking Advance Receipt';
      if (printPaymentIdx !== undefined) {
        label += ` (Payment P${printPaymentIdx + 1})`;
      }
      await PDFService.shareWhatsApp(
        wrapper,
        printBooking.custName,
        printBooking.bookingId,
        String(printBooking.totalAmount),
        printBooking.mobile,
        printBooking.bookingDate,
        label,
        (msg) => console.log('[Share Toast]', msg),
        false
      );
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setMethodFilter('All');
    setStartDate('');
    setEndDate('');
  };

  const formatDateString = (dStr: string) => {
    if (!dStr) return '';
    const dateVal = new Date(dStr);
    if (isNaN(dateVal.getTime())) return dStr;
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    let formatted = `${day}-${month}-${year}`;
    if (dStr.includes('T')) {
      const hours = String(dateVal.getHours()).padStart(2, '0');
      const minutes = String(dateVal.getMinutes()).padStart(2, '0');
      formatted += ` ${hours}:${minutes}`;
    }
    return formatted;
  };

  const columns = [
    {
      key: 'date',
      header: 'Date & Time',
      sortable: true,
      render: (p: AggregatedPayment) => <span>{formatDateString(p.date)}</span>
    },
    {
      key: 'receiptNo',
      header: 'Receipt No',
      sortable: true,
      render: (p: AggregatedPayment) => {
        const b = bookings.find(book => book.bookingId === p.bookingId);
        const printIdx = b?.payments?.findIndex(pay => pay.id === p.id);
        const displayReceiptNo = `KVUR/${p.bookingSeqNo}/${getFiscalYear()}` + (printIdx !== undefined && printIdx >= 0 ? ` - P${printIdx + 1}` : '');
        return <span style={{ fontWeight: '700' }}>{displayReceiptNo}</span>;
      }
    },
    {
      key: 'bookingId',
      header: 'Booking ID',
      sortable: true,
      render: (p: AggregatedPayment) => <span style={{ fontWeight: '700' }}>{p.bookingId}</span>
    },
    {
      key: 'custName',
      header: 'Customer Name',
      sortable: true,
      render: (p: AggregatedPayment) => <span style={{ fontWeight: '600' }}>{p.custName}</span>
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      sortValue: (p: AggregatedPayment) => p.amount || 0,
      render: (p: AggregatedPayment) => <span style={{ fontWeight: '700', color: 'var(--success)' }}>₹ {formatCurrency(p.amount)}</span>
    },
    {
      key: 'method',
      header: 'Method',
      sortable: true,
      render: (p: AggregatedPayment) => (
        <span className="payment-method-badge">
          {p.method}
        </span>
      )
    },
    {
      key: 'details',
      header: 'Reference Details',
      sortable: false,
      render: (p: AggregatedPayment) => {
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
        return <span className="payment-details-text">{payDetails}</span>;
      }
    },
    {
      key: 'enteredBy',
      header: 'Recorded By',
      sortable: true,
      render: (p: AggregatedPayment) => <span>{p.enteredBy || 'Admin'}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (p: AggregatedPayment) => (
        <div className="payment-actions-wrapper">
          <button
            type="button"
            className="payment-row-btn print"
            onClick={() => handleOpenPrint(p)}
            title="Print Receipt"
          >
            🖨️
          </button>
          {isAdmin() && (
            <>
              <button
                type="button"
                className="payment-row-btn edit"
                onClick={() => handleOpenEdit(p)}
                title="Edit Transaction"
              >
                ✏️
              </button>
              <button
                type="button"
                className="payment-row-btn delete"
                onClick={() => handleDelete(p)}
                title="Delete Transaction"
              >
                🗑️
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="tab-panel payments-container">
      
      {/* Collections Analytics Card Grid */}
      <div className="payments-stats-grid">
        <div className="payments-kpi-card success-border">
          <span className="payments-kpi-label">All-Time Cash Collection</span>
          <span className="payments-kpi-value success-text">₹ {formatCurrency(totalCash)}</span>
          <span className="payments-kpi-footer">Cumulative Cash receipts</span>
        </div>
        <div className="payments-kpi-card primary-border">
          <span className="payments-kpi-label">All-Time Bank/UPI</span>
          <span className="payments-kpi-value primary-text">₹ {formatCurrency(totalBank)}</span>
          <span className="payments-kpi-footer">Bank accounts collections</span>
        </div>
        <div className="payments-kpi-card dark-border">
          <span className="payments-kpi-label">Today's Collection</span>
          <span className="payments-kpi-value">₹ {formatCurrency(todayCollection)}</span>
          <span className="payments-kpi-footer">Total collections today</span>
        </div>
        <div className="payments-kpi-card primary-border">
          <span className="payments-kpi-label">Range Collection</span>
          <span className="payments-kpi-value primary-text">₹ {formatCurrency(rangeCollection)}</span>
          <span className="payments-kpi-footer">Based on filters below</span>
        </div>
      </div>

      {/* Filter Options Panel */}
      <div className="payments-filter-panel">
        <h2 className="payments-panel-title">
          💳 Centralized Payments Ledger
        </h2>

        <div className="payments-filter-grid">
          <div className="payments-filter-item">
            <label>🔍 Search</label>
            <input
              type="text"
              placeholder="Search Customer, ID, Ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="payments-filter-item">
            <label>💳 Method</label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="All">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="UPI">UPI</option>
              <option value="NEFT/RTGS">NEFT/RTGS</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>

          <div className="payments-filter-item">
            <label>📅 Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="payments-filter-item">
            <label>📅 End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <button 
              onClick={handleResetFilters}
              className="payments-reset-btn"
            >
              🔄 Reset
            </button>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <DataTable
        data={filteredPayments}
        columns={columns}
        searchPlaceholder="Filter aggregated entries..."
        searchFields={['custName', 'bookingId', 'transactionNo', 'remarks']}
        exportFileName="payment-transactions-ledger"
      />

      {/* Edit Payment Overlay Modal */}
      {showEditForm && selectedPay && (
        <Modal
          isOpen={showEditForm}
          onClose={() => {
            setShowEditForm(false);
            setSelectedPay(null);
          }}
          title={`✏️ Edit Payment: Booking ${selectedPay.bookingId}`}
        >
          <div className="modal-form-wrapper">
            <div className="modal-form-grid-2">
              <div className="modal-form-field">
                <label>Amount (Rs.) *</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div className="modal-form-field">
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
              <div className="modal-form-field">
                <label>Bank Name *</label>
                <input type="text" placeholder="Bank Name" value={payBankName} onChange={e => setPayBankName(e.target.value)} />
              </div>
            )}

            {payMethod !== 'Cash' && (
              <div>
                {(payMethod === 'UPI' || payMethod === 'NEFT/RTGS') && (
                  <div className="modal-form-field">
                    <label>Transaction / Ref No. *</label>
                    <input type="text" placeholder="Ref No." value={payTxnNo} onChange={e => setPayTxnNo(e.target.value)} />
                  </div>
                )}
                {payMethod === 'Cheque' && (
                  <div className="modal-form-grid-2">
                    <div className="modal-form-field">
                      <label>Cheque Number *</label>
                      <input type="text" placeholder="6-digit No." value={payChequeNo} onChange={e => setPayChequeNo(e.target.value)} />
                    </div>
                    <div className="modal-form-field">
                      <label>Cheque Date *</label>
                      <input type="date" value={payChequeDate} onChange={e => setPayChequeDate(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="modal-form-grid-3">
              <div className="modal-form-field">
                <label>Remarks</label>
                <input type="text" placeholder="Remarks (optional)" value={payRemarks} onChange={e => setPayRemarks(e.target.value)} />
              </div>
            </div>

            <div className="modal-actions-container">
              <Button onClick={handleSaveEdit} variant="primary" style={{ margin: 0 }}>Save Changes</Button>
              <Button onClick={() => {
                setShowEditForm(false);
                setSelectedPay(null);
              }} variant="secondary" style={{ margin: 0 }}>Cancel</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Print Overlay Receipt Preview Modal */}
      {showPrintModal && printBooking && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => {
            setShowPrintModal(false);
            setPrintBooking(null);
          }}
          title={`🖨 Receipt Preview ${printPaymentIdx !== undefined ? `(Payment P${printPaymentIdx + 1})` : ''}`}
          size="lg"
        >
          {/* Print type selector */}
          <div className="print-format-bar" style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPrintType('A4_Traditional')}
              className={`print-format-tab-btn ${printType === 'A4_Traditional' ? 'active' : ''}`}
            >📟 A4 Traditional</button>
            <button
              onClick={() => setPrintType('Thermal')}
              className={`print-format-tab-btn ${printType === 'Thermal' ? 'active' : ''}`}
            >🖨 Thermal Slip</button>
          </div>
          <div ref={printAreaRef} className="print-preview-box">
            {printType === 'A4_Traditional' && (
              <BookingTraditionalPreview booking={printBooking} paymentIndex={printPaymentIdx} />
            )}
            {printType === 'Thermal' && (
              <BookingThermalPreview booking={printBooking} paymentIndex={printPaymentIdx} />
            )}
          </div>

          <div className="modal-actions-container">
            <Button onClick={handlePrint} variant="primary" style={{ margin: 0 }}>🖨 Print Receipt</Button>
            <Button onClick={handleDownloadPdf} variant="success" style={{ margin: 0 }}>📥 Download PDF</Button>
            <button 
              onClick={handleWhatsAppShare} 
              className="whatsapp-share-btn"
            >
              💬 Share WhatsApp
            </button>
            <Button onClick={() => {
              setShowPrintModal(false);
              setPrintBooking(null);
            }} variant="secondary" style={{ margin: 0 }}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PaymentPage;
