import React from 'react';
import type { Booking } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { getFiscalYear } from '../utils/fiscalYear';

interface BookingTraditionalPreviewProps {
  booking: Booking;
  paymentIndex?: number;
}

export const BookingTraditionalPreview: React.FC<BookingTraditionalPreviewProps> = ({
  booking,
  paymentIndex
}) => {
  const seqNo = booking.bookingId.split('/')[1] || '0000';
  let recNo = `KVUR/${seqNo}/${getFiscalYear()}`;
  if (paymentIndex !== undefined && paymentIndex >= 0) {
    recNo += ` - P${paymentIndex + 1}`;
  }

  // Determine pricing, advance, balance, target date based on paymentIndex
  let targetDate = booking.bookingDate;
  let advAmt = booking.advancePaid;
  let balanceAmt = booking.balanceDue;

  if (paymentIndex !== undefined && paymentIndex >= 0 && booking.payments && booking.payments[paymentIndex]) {
    const p = booking.payments[paymentIndex];
    targetDate = p.date;
    advAmt = p.amount;

    let cumPaid = 0;
    for (let i = 0; i <= paymentIndex; i++) {
      cumPaid += booking.payments[i].amount;
    }
    balanceAmt = booking.totalAmount - cumPaid;
  } else {
    if (booking.payments && booking.payments.length > 0) {
      const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
      advAmt = totalPaid;
      balanceAmt = booking.totalAmount - totalPaid;
    }
  }

  const formatDateString = (dStr: string) => {
    if (!dStr) return '';
    const dateVal = new Date(dStr);
    if (isNaN(dateVal.getTime())) return dStr;
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    let formatted = `${day}-${month}-${year}`;
    if (dStr.includes('T') || dStr.includes(':')) {
      const hours = String(dateVal.getHours()).padStart(2, '0');
      const minutes = String(dateVal.getMinutes()).padStart(2, '0');
      formatted += ` ${hours}:${minutes}`;
    }
    return formatted;
  };

  const targetDateStr = formatDateString(targetDate).split(' ')[0]; // only show date
  const getDeliveryDateWithDay = (dStr: string) => {
    if (!dStr) return '';
    const dateVal = new Date(dStr);
    if (isNaN(dateVal.getTime())) return dStr;
    const day = String(dateVal.getDate()).padStart(2, '0');
    const month = String(dateVal.getMonth() + 1).padStart(2, '0');
    const year = dateVal.getFullYear();
    const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    const weekdayName = weekdays[dateVal.getDay()];
    return `${day}-${month}-${year} (${weekdayName})`;
  };
  const deliveryDateStr = getDeliveryDateWithDay(booking.deliveryDate);

  const paymentsToShow = booking.payments || [];
  const displayPayments = paymentIndex !== undefined && paymentIndex >= 0
    ? paymentsToShow.slice(0, paymentIndex + 1)
    : paymentsToShow;

  // Format customer name
  let formattedCustName = (booking.custName || '').toUpperCase();
  if (booking.fatherName) {
    const relationStr = (booking.relation || 'S/O').toUpperCase();
    formattedCustName += ` ${relationStr} ${(booking.fatherName || '').toUpperCase()}`;
  }

  const itemsToRender = [...booking.items];
  while (itemsToRender.length < 1) {
    itemsToRender.push({ name: '', desc: '', qty: 0, rate: 0, amount: 0 });
  }

  const isCycloneYes = booking.cyclone === 'Yes';
  const isJhannaYes = booking.jhanna === 'Yes';

  // const balanceInWords = numberToWords(balanceAmt);

  const renderReceiptSide = (label: 'CUSTOMER COPY' | 'OFFICE COPY') => {
    return (
      <div className="receipt-side-wrap">
        {/* Top Tag & Copy Type */}
        <div className="trad-top-tag-row">
          <span className="receipt-tag">BOOKING-[{seqNo}]</span>
          <span className="copy-label">{label}</span>
        </div>

        {/* Company Header */}
        <div className="company-header-block">
          <div className="company-title">KRISHI VIKAS UDYOG</div>
        </div>

        {/* Customer & Info Table */}
        <div className="middle-group-box">
          <table className="bordered-table">
            <tbody>
              <tr>
                <td className="cust-left-col">
                  {formattedCustName}<br />
                  VILL: {(booking.address || '').toUpperCase()}<br />
                  DIST: {(booking.district || '').toUpperCase()}<br />
                </td>
                <td className="cust-right-col">
                  DATE : {targetDateStr}<br />
                  MOBILE : {booking.mobile || ''}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Specifications Strip */}
          <table className="bordered-table spec-table">
            <tbody>
              <tr>
                <td style={{ width: '50%', verticalAlign: 'middle' }}>
                  <b style={{ fontSize: '10pt' }}>TRACTOR : {(booking.tractor || '').toUpperCase()}</b>
                </td>
                <td style={{ width: '50%', verticalAlign: 'middle' }}>
                  <b style={{ fontSize: '10pt' }}>DELIVERY DATE: {deliveryDateStr}</b>
                </td>
              </tr>
              <tr>
                <td style={{ width: '50%' }}>
                  PULLY SIZE : {booking.pullySize || ''}
                </td>
                <td style={{ width: '50%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '4mm' }}>
                    <span>CYCLONE : {isCycloneYes ? 'YES' : 'NO'}</span>
                    <span>JHANNA : {isJhannaYes ? 'YES' : 'NO'}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Particulars Table */}
          <table className="particulars-table">
            <thead>
              <tr className="table-header-row">
                <th style={{ textAlign: 'left', paddingLeft: '2mm', width: '55%' }}>PARTICULARS</th>
                <th style={{ textAlign: 'center', width: '10%' }}>QTY</th>
                <th style={{ textAlign: 'right', paddingRight: '2mm', width: '17%' }}>RATE</th>
                <th style={{ textAlign: 'right', paddingRight: '2mm', width: '18%' }}>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {itemsToRender.map((item, idx) => (
                <tr key={idx} className="item-row">
                  <td style={{ textAlign: 'left', paddingLeft: '2mm' }}>
                    {item.name ? <span style={{ fontSize: '11.5pt' }}>{item.name.toUpperCase()}</span> : <>&nbsp;</>}
                    {item.desc && <div className="item-desc-inline">— {item.desc.toUpperCase()}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.name ? item.qty : <>&nbsp;</>}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '2mm' }}>
                    {item.name ? formatCurrency(item.rate) : <>&nbsp;</>}
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '2mm' }}>
                    {item.name ? formatCurrency(item.amount) : <>&nbsp;</>}
                  </td>
                </tr>
              ))}
              {/* Spacer row to extend vertical lines downwards */}
              <tr style={{ height: '100%' }}>
                <td style={{ borderBottom: '0.25px solid black' }}></td>
                <td style={{ borderBottom: '0.25px solid black' }}></td>
                <td style={{ borderBottom: '0.25px solid black' }}></td>
                <td style={{ borderBottom: '0.25px solid black' }}></td>
              </tr>
            </tbody>
          </table>

          {/* Advance Payment Breakdown */}
          {displayPayments.length > 0 && (
            <table className="bordered-table payments-breakdown-table">
              <thead>
                <tr>
                  <th colSpan={3} style={{ textAlign: 'left', paddingLeft: '2mm', borderBottom: '0.25px solid black', fontWeight: 'bold', fontSize: '11.5pt' }}>
                    ADVANCE PAYMENT (CASH / NEFT / UPI)
                  </th>
                </tr>
                <tr style={{ fontSize: '9.5pt', fontWeight: 'bold' }}>
                  <th style={{ textAlign: 'left', paddingLeft: '2mm', width: '40%', borderBottom: '0.25px solid black' }}>DATE RECEIVED</th>
                  <th style={{ textAlign: 'center', width: '30%', borderBottom: '0.25px solid black' }}>PAYMENT MODE</th>
                  <th style={{ textAlign: 'right', paddingRight: '2mm', width: '30%', borderBottom: '0.25px solid black' }}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {displayPayments.map((p, idx) => (
                  <tr key={p.id || idx} className="payment-row" style={{ fontSize: '9.5pt', fontWeight: 'bold' }}>
                    <td style={{ textAlign: 'left', paddingLeft: '2mm' }}>{formatDateString(p.date)}</td>
                    <td style={{ textAlign: 'center' }}>{p.method.toUpperCase()}</td>
                    <td style={{ textAlign: 'right', paddingRight: '2mm' }}>₹ {formatCurrency(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bottom Section */}
        <div className="bottom-section">
          {/* Words & Terms */}
          <div className="footer-left">
            <div className="terms-box">
              SUNDAY CLOSED<br />
              OFFICE PHONE TIME: 10:00 AM TO 5:00 PM
            </div>
          </div>

          {/* Totals Summary & Sign */}
          <div className="footer-right-col">
            <table className="summary-table">
              <tbody>
                <tr>
                  <td className="lbl">Goods Value</td>
                  <td className="val">{formatCurrency(booking.totalAmount)}</td>
                </tr>
                <tr>
                  <td className="lbl">Net Amount</td>
                  <td className="val">{formatCurrency(booking.totalAmount)}</td>
                </tr>
                <tr>
                  <td className="lbl">Advance Paid</td>
                  <td className="val">{formatCurrency(advAmt)}</td>
                </tr>
                <tr className="balance-row">
                  <td className="lbl">Net Balance</td>
                  <td className="val">{formatCurrency(balanceAmt)}</td>
                </tr>
              </tbody>
            </table>

            <div className="signature-area">
              <div className="signature-line"></div>
              <div className="signature-label">Auth. Sign</div>
            </div>
          </div>
        </div>

      </div>
    );
  };

  return (
    <div
      className="traditional-receipt-container"
      id="bookingTraditionalPrintArea"
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '20px',
        background: '#f0f2f5',
        width: '100%',
        overflowX: 'auto',
      }}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
        .traditional-receipt-container {
          --font-family: 'Courier New', Courier, monospace;
          --border-color: #000000;
          width: 100%;
        }

        @media screen {
          .traditional-receipt-container {
            justify-content: flex-start !important;
          }
        }

        .a4-landscape-receipt {
          width: 297mm;
          height: 210mm;
          min-width: 297mm;
          background: #ffffff;
          position: relative;
          display: flex;
          padding: 10mm;
          box-sizing: border-box;
          overflow: hidden;
          border: 1px solid #d0d0d0;
          font-family: var(--font-family);
        }

        /* Vertical cutting line with scissors */
        .a4-landscape-receipt .cut-line-separator {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 148.5mm;
          width: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
          pointer-events: none;
        }

        .a4-landscape-receipt .cut-line-separator .dotted-vertical {
          flex: 1;
          border-left: 1px dashed var(--border-color);
          width: 0;
        }

        .a4-landscape-receipt .cut-line-separator .scissors {
          width: 20px;
          height: 20px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          color: #000000;
        }
        
        .a4-landscape-receipt .cut-line-separator .scissors.top {
          margin-top: 4mm;
          transform: rotate(90deg);
        }
        
        .a4-landscape-receipt .cut-line-separator .scissors.bottom {
          margin-bottom: 4mm;
          transform: rotate(270deg);
        }

        /* Each Copy Wrapper */
        .receipt-side-wrap {
          width: 133.5mm;
          height: 190mm;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 2mm;
          border: 1px solid var(--border-color);
          box-sizing: border-box;
        }

        .trad-top-tag-row {
          display: flex;
          justify-content: space-between;
          font-size: 8.5pt;
          font-weight: bold;
          margin-bottom: 1mm;
        }

        .trad-top-tag-row .receipt-tag {
          letter-spacing: 0.5px;
        }

        .trad-top-tag-row .copy-label {
          border: 1px dashed var(--border-color);
          padding: 1px 6px;
          font-size: 7.5pt;
        }

        .company-header-block {
          text-align: center;
          margin-bottom: 1.5mm;
          margin-top: -7px;
        }

        .company-header-block .company-title {
          font-size: 16pt;
          font-weight: bold;
          letter-spacing: 0.5px;
        }

        .company-header-block .company-sub {
          font-size: 7.5pt;
          margin-top: 0.3mm;
        }

        .receipt-side-wrap .bordered-table {
          width: 100%;
          border-collapse: collapse;
          border: 0.25px solid black;
        }

        /* Middle Group Box */
        .receipt-side-wrap .middle-group-box {
          flex: 1;
          display: flex;
          flex-direction: column;
          margin-bottom: 120px;
        }
      
        .receipt-side-wrap .middle-group-box > table {
          margin-bottom: 0;
        }
        
        .receipt-side-wrap .middle-group-box > table + table {
          border-top: none;
        }

        .receipt-side-wrap .bordered-table td {
          padding: 1.2mm 2mm;
          border: 1px dashed var(--border-color);
          font-size: 8pt;
          line-height: 1.35;
          vertical-align: top;
        }

        .receipt-side-wrap .cust-left-col {
          width: 50%;
          font-weight: bold;
          font-size: 36pt;
          padding: 3mm 3mm;
          line-height: 1.5;
        }

        .receipt-side-wrap .cust-right-col {
          width: 50%;
          white-space: nowrap;
          font-weight: bold;
          font-size: 36pt;
          padding: 3mm 3mm;
          line-height: 1.5;
        }

        .receipt-side-wrap .spec-table td {
          font-size: 9.5pt;
          font-weight: bold;
          white-space: nowrap;
          border: none;
        }

        /* Particulars Table */
        .receipt-side-wrap .particulars-table {
          width: 100%;
          border-collapse: collapse;
          border: 0.25px solid black;
          border-bottom: none;
          flex: 1;
        }

        .receipt-side-wrap .particulars-table th {
          font-size: 9.5pt;
          font-weight: bold;
          border-left: 1px dashed var(--border-color);
          border-right: 1px dashed var(--border-color);
          border-top: none;
          border-bottom: 0.25px solid black;
          padding: 1.2mm 1mm;
        }

        .receipt-side-wrap .particulars-table td {
          padding: 1mm 1.5mm;
          border-left: 1px dashed var(--border-color);
          border-right: 1px dashed var(--border-color);
          font-size: 9.5pt;
          line-height: 1.25;
          font-weight: bold;
        }

        .receipt-side-wrap .particulars-table tr {
          height: 6mm;
        }

        .receipt-side-wrap .particulars-table tr.item-row td {
          border-bottom: none;
        }
        
        .receipt-side-wrap .particulars-table tr:last-child td {
          border-bottom: none;
        }

        .receipt-side-wrap .item-desc-inline {
          font-size: 7.2pt;
          color: #444;
          margin-top: 0.3mm;
        }

        /* Bottom Section */
        .receipt-side-wrap .bottom-section {
          display: flex;
          justify-content: space-between;
          align-items: stretch;
          height: 35mm;
        }

        .receipt-side-wrap .footer-left {
          width: 54%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .receipt-side-wrap .amount-words-box {
          border: 1px dashed var(--border-color);
          padding: 1.5mm 2mm;
          font-size: 9.5pt;
          font-weight: bold;
          min-height: 9mm;
          display: flex;
          align-items: center;
        }

        .receipt-side-wrap .terms-box {
          font-size: 14pt;
          line-height: 1.4;
          color: #000;
          font-weight: bold;
        }

        .receipt-side-wrap .footer-right-col {
          width: 60%;
          height: 150%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border: 0.25px solid black;
          padding: 1.5mm 2mm;
          position: relative;
          top: -60px;
        }

        .receipt-side-wrap .summary-table {
          width: 100%;
          border-collapse: collapse;
        }

        .receipt-side-wrap .summary-table td {
          padding: 0.6mm 0;
          font-size: 9.5pt;
          font-weight: bold;
        }

        .receipt-side-wrap .summary-table .lbl {
          font-weight: bold;
        }

        .receipt-side-wrap .summary-table .val {
          text-align: right;
        }

        .receipt-side-wrap .summary-table .balance-row td {
          border-top: 0.25px solid black;
          font-weight: bold;
          padding-top: 0.8mm;
        }

        .receipt-side-wrap .signature-area {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          margin-top: auto;
        }

        .receipt-side-wrap .signature-line {
          width: 30mm;
          border-top: 1px dashed var(--border-color);
          margin-bottom: 0.5mm;
        }

        .receipt-side-wrap .signature-label {
          width: 30mm;
          text-align: center;
          font-size: 7.2pt;
          font-weight: bold;
        }

        /* ===== Print specific settings ===== */
        @media print {
          @page {
            size: A4 landscape;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .traditional-receipt-container {
            padding: 0 !important;
            background: #ffffff !important;
            margin: 0 !important;
            width: auto !important;
            overflow: visible !important;
          }
          .a4-landscape-receipt {
            border: none !important;
            padding: 10mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-inside: avoid;
            page-break-after: avoid;
          }
        }
      ` }} />

      {/* A4 Landscape Page */}
      <div className="a4-page-scale-wrap" style={{ width: '297mm', overflow: 'hidden' }}>
        <div className="a4-landscape-receipt" id="bookingTraditionalPdfCapture">

          {/* Vertical cutting line with scissors */}
          <div className="cut-line-separator">
            <div className="scissors top">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="9.8" y1="8.2" x2="20" y2="17"></line>
                <line x1="9.8" y1="15.8" x2="20" y2="7"></line>
              </svg>
            </div>
            <div className="dotted-vertical"></div>
            <div className="scissors bottom">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="9.8" y1="8.2" x2="20" y2="17"></line>
                <line x1="9.8" y1="15.8" x2="20" y2="7"></line>
              </svg>
            </div>
          </div>

          {/* LEFT COPY: CUSTOMER COPY */}
          {renderReceiptSide('CUSTOMER COPY')}

          {/* RIGHT COPY: OFFICE COPY */}
          <div style={{ marginLeft: '10mm' }}>
            {renderReceiptSide('OFFICE COPY')}
          </div>

        </div>
      </div>

    </div>
  );
};
