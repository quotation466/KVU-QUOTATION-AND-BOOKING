import React from 'react';
import { formatCurrency } from '../utils/numberToWords';
import { Header } from './Header';

interface LedgerPrintPreviewProps {
  customer: {
    custName: string;
    mobile: string;
    fatherName: string;
    address: string;
    post: string;
    district: string;
    state: string;
    pincode: string;
    aadhar?: string;
    bookings: any[];
    totalBooked: number;
    totalPaid: number;
    balanceDue: number;
  };
}

export const LedgerPrintPreview: React.FC<LedgerPrintPreviewProps> = ({ customer }) => {
  if (!customer) return null;

  // Gather bookings and payments
  const transactions: Array<{
    date: string;
    type: 'booking' | 'payment';
    refId: string;
    description: string;
    debit: number;
    credit: number;
  }> = [];

  customer.bookings.forEach((b: any) => {
    // 1. Booking transaction
    transactions.push({
      date: b.bookingDate,
      type: 'booking',
      refId: b.bookingId,
      description: `Booking Created: ${b.bookingId} (${b.items.map((i: any) => i.name).join(', ')})`,
      debit: b.totalAmount || 0,
      credit: 0,
    });

    // 2. Payments transaction
    if (b.payments) {
      b.payments.forEach((p: any) => {
        transactions.push({
          date: p.date,
          type: 'payment',
          refId: b.bookingId,
          description: `Payment Received (${p.method}) ${p.remarks ? `- ${p.remarks}` : ''}`,
          debit: 0,
          credit: p.amount || 0,
        });
      });
    }
  });

  // Sort chronologically by date
  transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Compute running balance
  let currentBalance = 0;
  const ledgerRows = transactions.map((t) => {
    currentBalance += t.debit - t.credit;
    return {
      ...t,
      runningBalance: currentBalance,
    };
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  return (
    <div className="ledger-print-wrapper" id="ledgerPrintArea">
      <style dangerouslySetInnerHTML={{
        __html: `
        .ledger-print-wrapper {
          width: 210mm;
          min-height: 297mm;
          padding: 8mm 10mm;
          background: #ffffff;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          color: #000000;
          font-size: 11pt;
        }

        /* Header Styles */
        .ledger-print-wrapper .header-box {
          border: 2px solid black;
          margin-bottom: 5mm;
        }

        .ledger-print-wrapper .header-top {
          display: flex;
          align-items: center;
          padding: 5px 8px;
          border-bottom: 1px solid black;
        }

        .ledger-print-wrapper .logo {
          margin-left: 18px;
          margin-right: 8px;
          flex-shrink: 0;
          text-align: center;
        }

        .ledger-print-wrapper .estd-left {
          font-size: 11px;
          color: #555;
          font-weight: bold;
          letter-spacing: 1px;
          margin-bottom: 4px;
          text-align: center;
        }

        .ledger-print-wrapper .logo img {
          width: 110px;
          height: auto;
          display: block;
        }

        .ledger-print-wrapper .company-center {
          flex-grow: 1;
          text-align: center;
        }

        .ledger-print-wrapper .company-center h1 {
          font-size: 20pt;
          font-weight: 800;
          margin: 0;
          color: #000;
          letter-spacing: 0.5px;
        }

        .ledger-print-wrapper .company-center h1 .reg-sym {
          font-size: 10pt;
          vertical-align: super;
        }

        .ledger-print-wrapper .company-center .estd {
          font-size: 10pt;
          font-weight: bold;
          letter-spacing: 2px;
          color: #444;
        }

        .ledger-print-wrapper .company-center .iso {
          font-size: 8pt;
          font-weight: bold;
          margin-top: 1mm;
        }

        .ledger-print-wrapper .company-center .tagline {
          font-size: 9pt;
          font-weight: bold;
          margin-top: 1mm;
          color: #333;
        }

        .ledger-print-wrapper .company-center .sub {
          font-size: 8.5pt;
          font-weight: bold;
          margin-top: 0.8mm;
        }

        .ledger-print-wrapper .header-bottom {
          display: flex;
          justify-content: space-between;
          padding: 2mm 3mm;
          font-size: 9pt;
          font-weight: bold;
        }

        .ledger-print-wrapper .header-bottom .gstn {
          text-align: right;
        }

        .ledger-print-title {
          text-align: center;
          font-size: 15pt;
          font-weight: bold;
          letter-spacing: 1px;
          margin: 4mm 0;
          text-decoration: underline;
        }

        .ledger-info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6mm;
        }

        .ledger-info-table td {
          padding: 1.5mm 0;
          vertical-align: top;
          font-size: 10.5pt;
          line-height: 1.4;
        }

        .ledger-summary-bar {
          display: flex;
          justify-content: space-between;
          border: 1px solid #000000;
          background: #f5f5f5;
          padding: 3mm 4mm;
          margin-bottom: 6mm;
        }

        .ledger-summary-item {
          text-align: center;
          flex: 1;
        }

        .ledger-summary-item:not(:last-child) {
          border-right: 1px solid #cccccc;
        }

        .ledger-summary-item span {
          display: block;
          font-size: 9pt;
          text-transform: uppercase;
          color: #555555;
          margin-bottom: 1mm;
        }

        .ledger-summary-item strong {
          font-size: 12.5pt;
        }

        .ledger-main-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
          margin-bottom: 10mm;
        }

        .ledger-main-table th {
          border-top: 1.2px solid #000000;
          border-bottom: 1.2px solid #000000;
          padding: 2.5mm 1.5mm;
          text-align: left;
          font-weight: bold;
        }

        .ledger-main-table td {
          border-bottom: 1px solid #dddddd;
          padding: 2.5mm 1.5mm;
          vertical-align: top;
        }

        .ledger-main-table tr.total-row td {
          border-top: 1.2px solid #000000;
          border-bottom: 1.2px solid #000000;
          font-weight: bold;
          font-size: 10.5pt;
        }

        .ledger-signatures-row {
          display: flex;
          justify-content: space-between;
          margin-top: 15mm;
          padding: 0 10mm;
        }

        .ledger-sig-box {
          text-align: center;
          width: 50mm;
        }

        .ledger-sig-line {
          border-top: 1px solid #000000;
          margin-bottom: 2mm;
        }

        .ledger-sig-label {
          font-size: 9.5pt;
          font-weight: bold;
        }
      `
      }} />

      <Header title="ACCOUNT LEDGER" />

      <div className="ledger-print-title">CUSTOMER ACCOUNT LEDGER</div>

      <table className="ledger-info-table">
        <tbody>
          <tr>
            <td style={{ width: '60%' }}>
              <strong>M/S. {customer.custName.toUpperCase()}</strong>
              {customer.fatherName && (
                <>
                  <br />
                  S/O: {customer.fatherName.toUpperCase()}
                </>
              )}
              <br />
              VILL: {(customer.address || '').toUpperCase()}
              {customer.post && <>, POST: {customer.post.toUpperCase()}</>}
              <br />
              DIST: {(customer.district || '').toUpperCase()} ({customer.state.toUpperCase()}) - {customer.pincode}
            </td>
            <td style={{ width: '40%', textAlign: 'right' }}>
              <strong>Mobile No.:</strong> {customer.mobile}
              {customer.aadhar && (
                <>
                  <br />
                  <strong>Aadhaar No.:</strong> {customer.aadhar}
                </>
              )}
              <br />
              <strong>Statement Date:</strong> {formatDate(new Date().toISOString())}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ledger-summary-bar">
        <div className="ledger-summary-item">
          <span>Total Booked</span>
          <strong>₹ {formatCurrency(customer.totalBooked)}</strong>
        </div>
        <div className="ledger-summary-item">
          <span>Total Paid</span>
          <strong>₹ {formatCurrency(customer.totalPaid)}</strong>
        </div>
        <div className="ledger-summary-item">
          <span>Outstanding Due</span>
          <strong style={{ color: customer.balanceDue > 0 ? '#d9534f' : '#5cb85c' }}>
            ₹ {formatCurrency(customer.balanceDue)}
          </strong>
        </div>
      </div>

      <table className="ledger-main-table">
        <thead>
          <tr>
            <th style={{ width: '12%' }}>Date</th>
            <th style={{ width: '18%' }}>Ref / Booking ID</th>
            <th style={{ width: '42%' }}>Particulars</th>
            <th style={{ width: '14%', textAlign: 'right' }}>Debit (Dr)</th>
            <th style={{ width: '14%', textAlign: 'right' }}>Credit (Cr)</th>
          </tr>
        </thead>
        <tbody>
          {ledgerRows.map((row, idx) => (
            <tr key={idx}>
              <td>{formatDate(row.date)}</td>
              <td style={{ fontWeight: 'bold' }}>{row.refId}</td>
              <td>{row.description}</td>
              <td style={{ textAlign: 'right' }}>
                {row.debit > 0 ? `₹ ${formatCurrency(row.debit)}` : '—'}
              </td>
              <td style={{ textAlign: 'right' }}>
                {row.credit > 0 ? `₹ ${formatCurrency(row.credit)}` : '—'}
              </td>
            </tr>
          ))}
          <tr className="total-row">
            <td colSpan={3} style={{ textAlign: 'right' }}>Grand Total:</td>
            <td style={{ textAlign: 'right' }}>₹ {formatCurrency(customer.totalBooked)}</td>
            <td style={{ textAlign: 'right' }}>₹ {formatCurrency(customer.totalPaid)}</td>
          </tr>
          <tr className="total-row" style={{ background: '#fafafa' }}>
            <td colSpan={3} style={{ textAlign: 'right' }}>Outstanding Balance Due:</td>
            <td colSpan={2} style={{ textAlign: 'right', color: customer.balanceDue > 0 ? '#d9534f' : '#5cb85c', fontSize: '11pt' }}>
              ₹ {formatCurrency(customer.balanceDue)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ledger-signatures-row">
        <div className="ledger-sig-box">
          <div className="ledger-sig-line"></div>
          <div className="ledger-sig-label">Customer Signature</div>
        </div>
        <div className="ledger-sig-box">
          <div className="ledger-sig-line"></div>
          <div className="ledger-sig-label">Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
};
