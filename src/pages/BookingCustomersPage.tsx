import React, { useState, useEffect, useRef } from 'react';
import { BookingRepository, type Booking, type Payment } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { PrintService } from '../utils/PrintService';
import { Modal } from '../components/Modal';
import { BookingThermalPreview } from '../components/BookingThermalPreview';
import { BookingTraditionalPreview } from '../components/BookingTraditionalPreview';
import { PDFService } from '../services/PDFService';
import { Button } from '../components/Button';
import { DataTable } from '../components/DataTable';
import { LoadingIndicator } from '../components/LoadingIndicator';
import '../styles/CustomersPage.css';

interface BookingCustomer {
  custName: string;
  mobile: string;
  fatherName: string;
  address: string;
  post: string;
  district: string;
  state: string;
  pincode: string;
  aadhar?: string;
  bookings: Booking[];
  totalBooked: number;
  totalPaid: number;
  balanceDue: number;
}

export const BookingCustomersPage: React.FC = () => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  // States
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<BookingCustomer | null>(null);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'items' | 'payments'>('items');

  // Print Preview Modal states
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printBooking, setPrintBooking] = useState<Booking | null>(null);
  const [activePrintPaymentIdx, setActivePrintPaymentIdx] = useState<number | undefined>(undefined);
  const [printType, setPrintType] = useState<'Thermal' | 'A4_Traditional'>('A4_Traditional');

  // Load Bookings
  useEffect(() => {
    const load = async () => {
      const data = await BookingRepository.getBookings();
      setBookings(data);
      setLoading(false);
    };
    load();
  }, []);

  // Group Bookings by Customer
  const customerMap = new Map<string, BookingCustomer>();

  bookings.forEach((b) => {
    const nameKey = b.custName.trim().toLowerCase();
    const mobileKey = (b.mobile || '').replace(/\D/g, '');
    const key = `${nameKey}::${mobileKey}`;

    let cust = customerMap.get(key);
    if (!cust) {
      cust = {
        custName: b.custName,
        mobile: b.mobile,
        fatherName: b.fatherName || '',
        address: b.address || '',
        post: b.post || '',
        district: b.district || '',
        state: b.state || '',
        pincode: b.pincode || '',
        aadhar: b.aadhar || '',
        bookings: [],
        totalBooked: 0,
        totalPaid: 0,
        balanceDue: 0
      };
      customerMap.set(key, cust);
    }

    cust.bookings.push(b);
    cust.totalBooked += b.totalAmount || 0;
    
    // Paid amount so far is totalAmount minus balanceDue
    const paid = (b.totalAmount || 0) - (b.balanceDue || 0);
    cust.totalPaid += paid;
    cust.balanceDue += b.balanceDue || 0;

    // Fill missing details from newer records
    if (!cust.fatherName && b.fatherName) cust.fatherName = b.fatherName;
    if (!cust.address && b.address) cust.address = b.address;
    if (!cust.post && b.post) cust.post = b.post;
    if (!cust.district && b.district) cust.district = b.district;
    if (!cust.state && b.state) cust.state = b.state;
    if (!cust.pincode && b.pincode) cust.pincode = b.pincode;
    if (!cust.aadhar && b.aadhar) cust.aadhar = b.aadhar;
  });

  const customersList = Array.from(customerMap.values());

  // Sort bookings inside each customer by date (newest first)
  customersList.forEach((c) => {
    c.bookings.sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());
  });

  // Global totals for booking customers
  const totalUniqueCustomers = customersList.length;
  const totalBookedValue = customersList.reduce((sum, c) => sum + c.totalBooked, 0);
  const totalPaidReceived = customersList.reduce((sum, c) => sum + c.totalPaid, 0);
  const totalOutstandingDue = customersList.reduce((sum, c) => sum + c.balanceDue, 0);

  // Action: Open Ledger
  const handleOpenLedger = (cust: BookingCustomer) => {
    setSelectedCustomer(cust);
    setActiveTab('items');
    setShowLedgerModal(true);
  };

  // Action: Open Print Preview for a booking receipt (entire booking or specific payment)
  const handleOpenPrintPreview = (booking: Booking, paymentId?: string, format: 'Thermal' | 'A4_Traditional' = 'A4_Traditional') => {
    setPrintBooking(booking);
    setPrintType(format);

    if (paymentId && booking.payments) {
      const idx = booking.payments.findIndex((p) => p.id === paymentId);
      setActivePrintPaymentIdx(idx !== -1 ? idx : undefined);
    } else {
      setActivePrintPaymentIdx(undefined);
    }

    setShowPrintModal(true);
  };

  // Printing logic
  const handlePrint = async () => {
    if (!printBooking || !printAreaRef.current) return;
    let selector = '#bookingTraditionalPrintArea';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }
    const content = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (content) {
      await PrintService.printElement(content, printType === 'Thermal');
    }
  };

  // PDF download logic
  const handleDownloadPdf = async () => {
    if (!printBooking || !printAreaRef.current) return;
    const isThermal = printType === 'Thermal';
    const selector = isThermal 
      ? '#bookingThermalPrintArea' 
      : '#bookingTraditionalPdfCapture';
    const content = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (!content) return;

    const pIdx = activePrintPaymentIdx !== undefined ? `_P${activePrintPaymentIdx + 1}` : '';
    const cleanId = printBooking.bookingId.replace(/\//g, '-');
    const fileName = `KVU_Booking_Receipt_${cleanId}${pIdx}.pdf`;

    await PDFService.downloadPdf(content, fileName, false);
  };

  // WhatsApp sharing logic
  const handleWhatsAppShare = () => {
    if (!printBooking) return;
    
    let msg = `*KRISHI VIKAS UDYOG*\n`;
    msg += `Hello *${printBooking.custName}*,\n`;
    if (activePrintPaymentIdx !== undefined && printBooking.payments) {
      const p = printBooking.payments[activePrintPaymentIdx];
      msg += `Your payment of *Rs. ${formatCurrency(p.amount)}* via *${p.method}* was received successfully.\n`;
    } else {
      msg += `Here is your booking receipt summary for Booking *${printBooking.bookingId}*.\n`;
    }
    msg += `Total Amount: Rs. ${formatCurrency(printBooking.totalAmount)}\n`;
    msg += `Total Paid: Rs. ${formatCurrency(printBooking.totalAmount - printBooking.balanceDue)}\n`;
    msg += `Pending Balance: Rs. ${formatCurrency(printBooking.balanceDue)}\n`;
    msg += `Expected Delivery: ${new Date(printBooking.deliveryDate).toLocaleDateString('en-GB').replace(/\//g, '-')}\n\n`;
    msg += `Thank you for choosing Krishi Vikas Udyog! 🙏`;

    const waUrl = `https://wa.me/91${printBooking.mobile}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const columns = [
    {
      key: 'serial',
      header: 'S.No',
      render: (_: any, idx: number) => <span>{idx + 1}</span>,
      sortable: false
    },
    {
      key: 'custName',
      header: 'Customer Name',
      sortable: true,
      render: (c: BookingCustomer) => <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{c.custName}</span>
    },
    {
      key: 'fatherName',
      header: "Father's Name",
      sortable: true,
      render: (c: BookingCustomer) => <span>{c.fatherName || '—'}</span>
    },
    {
      key: 'mobile',
      header: 'Mobile Number',
      sortable: true,
      render: (c: BookingCustomer) => <span>{c.mobile || '—'}</span>
    },
    {
      key: 'district',
      header: 'District',
      sortable: true,
      render: (c: BookingCustomer) => <span>{c.district || '—'}</span>
    },
    {
      key: 'bookingsCount',
      header: 'Bookings',
      sortable: true,
      sortValue: (c: BookingCustomer) => c.bookings.length,
      render: (c: BookingCustomer) => (
        <span className="payment-method-badge">
          {c.bookings.length}
        </span>
      )
    },
    {
      key: 'totalBooked',
      header: 'Total Booked',
      sortable: true,
      sortValue: (c: BookingCustomer) => c.totalBooked,
      render: (c: BookingCustomer) => <span style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>₹ {formatCurrency(c.totalBooked)}</span>
    },
    {
      key: 'totalPaid',
      header: 'Total Paid',
      sortable: true,
      sortValue: (c: BookingCustomer) => c.totalPaid,
      render: (c: BookingCustomer) => <span style={{ fontWeight: '700', color: 'var(--success)', whiteSpace: 'nowrap' }}>₹ {formatCurrency(c.totalPaid)}</span>
    },
    {
      key: 'balanceDue',
      header: 'Balance Due',
      sortable: true,
      sortValue: (c: BookingCustomer) => c.balanceDue,
      render: (c: BookingCustomer) => (
        <span style={{ fontWeight: '700', color: c.balanceDue > 0 ? 'var(--danger)' : 'var(--success)', whiteSpace: 'nowrap' }}>
          ₹ {formatCurrency(c.balanceDue)}
        </span>
      )
    },
    {
      key: 'action',
      header: 'Action',
      sortable: false,
      render: (c: BookingCustomer) => (
        <Button
          onClick={() => handleOpenLedger(c)}
          variant="primary"
          style={{ margin: 0, minHeight: '28px', fontSize: '12px', padding: '4px 10px' }}
        >
          📜 Ledger
        </Button>
      )
    }
  ];

  return (
    <div className="tab-panel booking-cust-container">
      
      {/* Summary Analytics Strip */}
      <div className="booking-cust-stats-grid">
        <div className="booking-cust-kpi-card">
          <span className="booking-cust-kpi-label">Booking Customers</span>
          <span className="booking-cust-kpi-value">{totalUniqueCustomers}</span>
          <span className="booking-cust-kpi-footer">Active customers with bookings</span>
        </div>
        <div className="booking-cust-kpi-card primary-border">
          <span className="booking-cust-kpi-label">Total Booked Value</span>
          <span className="booking-cust-kpi-value primary-text">₹ {formatCurrency(totalBookedValue)}</span>
          <span className="booking-cust-kpi-footer">Sum of all booking order values</span>
        </div>
        <div className="booking-cust-kpi-card success-border">
          <span className="booking-cust-kpi-label">Total Payments Received</span>
          <span className="booking-cust-kpi-value success-text">₹ {formatCurrency(totalPaidReceived)}</span>
          <span className="booking-cust-kpi-footer">Overall advance & partial payments</span>
        </div>
        <div className="booking-cust-kpi-card danger-border">
          <span className="booking-cust-kpi-label">Outstanding Dues</span>
          <span className="booking-cust-kpi-value danger-text">₹ {formatCurrency(totalOutstandingDue)}</span>
          <span className="booking-cust-kpi-footer">Balance remaining to collect</span>
        </div>
      </div>

      {/* Main Customers List */}
      <div className="db-panel" style={{ background: 'transparent', padding: 0 }}>
        <div className="crm-header-row">
          <div className="crm-title-section">
            <h1>Booking Customers Ledger</h1>
            <p>Select a customer to view their machine ledger statements and receipts.</p>
          </div>
        </div>

        {loading ? (
          <LoadingIndicator message="Loading booking customers..." />
        ) : (
          <DataTable
            data={customersList}
            columns={columns}
            searchPlaceholder="Search booking customer name, mobile, father name..."
            searchFields={['custName', 'mobile', 'fatherName', 'district']}
            exportFileName="booking-customers"
          />
        )}
      </div>

      {/* Customer Ledger Detailed Modal */}
      {showLedgerModal && selectedCustomer && (
        <Modal
          isOpen={showLedgerModal}
          onClose={() => setShowLedgerModal(false)}
          title={`📜 Customer Account Ledger — ${selectedCustomer.custName}`}
          size="lg"
        >
          {/* Customer Profile Banner */}
          <div className="ledger-cust-profile-banner">
            <div className="ledger-cust-profile-grid">
              <div className="ledger-profile-item">
                <span>Customer Details</span>
                <strong>{selectedCustomer.custName}</strong>
                <span className="sub-detail">s/o {selectedCustomer.fatherName || '—'}</span>
              </div>
              <div className="ledger-profile-item">
                <span>Contact info</span>
                <strong>📞 {selectedCustomer.mobile}</strong>
                {selectedCustomer.aadhar && <span className="sub-detail">💳 Aadhar: {selectedCustomer.aadhar}</span>}
              </div>
              <div className="ledger-profile-item">
                <span>Address</span>
                <span className="sub-detail">
                  {selectedCustomer.address}{selectedCustomer.post ? `, Post: ${selectedCustomer.post}` : ''}
                </span>
                <span className="sub-detail">
                  {selectedCustomer.district}, {selectedCustomer.state} - {selectedCustomer.pincode}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Stats Panel for the Customer */}
          <div className="ledger-cust-quick-stats">
            <div className="ledger-stat-card">
              <span>Bookings</span>
              <strong>{selectedCustomer.bookings.length} Orders</strong>
            </div>
            <div className="ledger-stat-card primary-text">
              <span>Total Booked</span>
              <strong>₹ {formatCurrency(selectedCustomer.totalBooked)}</strong>
            </div>
            <div className="ledger-stat-card success-text">
              <span>Total Paid</span>
              <strong>₹ {formatCurrency(selectedCustomer.totalPaid)}</strong>
            </div>
            <div className={`ledger-stat-card ${selectedCustomer.balanceDue > 0 ? 'danger-text' : 'success-bg-text'}`}>
              <span>Outstanding</span>
              <strong>
                ₹ {formatCurrency(selectedCustomer.balanceDue)}
              </strong>
            </div>
          </div>

          {/* Tabs header */}
          <div className="ledger-tabs-row">
            <button
              onClick={() => setActiveTab('items')}
              className={`ledger-tab-btn ${activeTab === 'items' ? 'active' : ''}`}
            >
              📦 Booked Items & Machines
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className={`ledger-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
            >
              💳 Payment Records & Receipts
            </button>
          </div>

          {/* Tab Content */}
          <div className="ledger-scrollable-table">
            {activeTab === 'items' ? (
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Booking ID</th>
                    <th>Item Name</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate (₹)</th>
                    <th style={{ textAlign: 'right' }}>Total (₹)</th>
                    <th style={{ textAlign: 'center' }}>Delivery Status</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCustomer.bookings.flatMap((b) => 
                    b.items.map((item, itemIdx) => (
                      <tr key={`${b.bookingId}-${itemIdx}`}>
                        <td>{formatDate(b.bookingDate)}</td>
                        <td style={{ fontWeight: 'bold' }}>{b.bookingId}</td>
                        <td style={{ fontWeight: '600' }}>{item.name}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.rate)}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(item.amount)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ 
                            background: b.status === 'Delivered' ? 'var(--success-light)' : 'var(--primary-bg)', 
                            color: b.status === 'Delivered' ? 'var(--success)' : 'var(--primary)',
                            padding: '2px 8px', 
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 'bold'
                          }}>
                            {b.status}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="receipt-mini-actions">
                            <button
                              onClick={() => handleOpenPrintPreview(b, undefined, 'A4_Traditional')}
                              className="receipt-mini-btn"
                              title="Print A4 Full Receipt"
                            >
                              📄 A4
                            </button>
                            <button
                              onClick={() => handleOpenPrintPreview(b, undefined, 'Thermal')}
                              className="receipt-mini-btn"
                              title="Print Thermal Slip"
                            >
                              🧾 Th
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Payment Date</th>
                    <th>Booking ID</th>
                    <th>Method</th>
                    <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                    <th>Reference / Details</th>
                    <th>Remarks</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'center' }}>Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedCustomer.bookings
                    .flatMap((b) => {
                      const list: Array<{ p: Payment; b: Booking }> = [];
                      if (b.payments) {
                        b.payments.forEach(pay => {
                          list.push({ p: pay, b });
                        });
                      }
                      return list;
                    })
                    .sort((a, b) => new Date(b.p.date).getTime() - new Date(a.p.date).getTime())
                    .map(({ p, b }) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.date)}</td>
                        <td style={{ fontWeight: 'bold' }}>{b.bookingId}</td>
                        <td>
                          <span className="payment-method-badge">
                            {p.method}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                          ₹ {formatCurrency(p.amount)}
                        </td>
                        <td>
                          {p.method === 'UPI' && p.transactionNo && <span>UPI Ref: {p.transactionNo}</span>}
                          {p.method === 'Cheque' && p.chequeNo && <span>Chq No: {p.chequeNo} ({formatDate(p.chequeDate || '')})</span>}
                          {p.bankName && <span> ({p.bankName})</span>}
                          {!p.transactionNo && !p.chequeNo && !p.bankName && <span>—</span>}
                        </td>
                        <td>{p.remarks || '—'}</td>
                        <td>{p.enteredBy}</td>
                        <td style={{ textAlign: 'center' }}>
                          <div className="receipt-mini-actions">
                            <button
                              onClick={() => handleOpenPrintPreview(b, p.id, 'A4_Traditional')}
                              className="receipt-mini-btn primary"
                              title="Print A4 Receipt for this payment"
                            >
                              📄 A4
                            </button>
                            <button
                              onClick={() => handleOpenPrintPreview(b, p.id, 'Thermal')}
                              className="receipt-mini-btn primary"
                              title="Print Thermal receipt for this payment"
                            >
                              🧾 Th
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  }
                </tbody>
              </table>
            )}
          </div>

          <div className="modal-actions-container">
            <Button onClick={() => setShowLedgerModal(false)} variant="secondary" style={{ margin: 0 }}>Close Ledger</Button>
          </div>
        </Modal>
      )}

      {/* Print Overlay Preview Modal */}
      {showPrintModal && printBooking && (
        <Modal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          title={`🖨 Receipt Preview ${activePrintPaymentIdx !== undefined ? `(Payment P${activePrintPaymentIdx + 1})` : ''}`}
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
              <BookingTraditionalPreview booking={printBooking} paymentIndex={activePrintPaymentIdx} />
            )}
            {printType === 'Thermal' && (
              <BookingThermalPreview booking={printBooking} paymentIndex={activePrintPaymentIdx} />
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
            <Button onClick={() => setShowPrintModal(false)} variant="secondary" style={{ margin: 0 }}>Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingCustomersPage;
