import React from 'react';
import type { Booking } from '../repositories/BookingRepository';
import { formatCurrency } from '../utils/numberToWords';
import { getFiscalYear } from '../utils/fiscalYear';

interface BookingThermalPreviewProps {
  booking: Booking;
  paymentIndex?: number;
}

export const BookingThermalPreview: React.FC<BookingThermalPreviewProps> = ({ booking, paymentIndex }) => {
  const seqNo = booking.bookingId.split('/')[1] || '0000';
  let recNo = `KVUR/${seqNo}/${getFiscalYear()}`;
  if (paymentIndex !== undefined && paymentIndex >= 0) {
    recNo += ` - P${paymentIndex + 1}`;
  }

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

  const formatDeliveryDate = (dStr: string) => {
    if (!dStr) return '';
    const dateVal = new Date(dStr);
    if (isNaN(dateVal.getTime())) return dStr;
    const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayName = days[dateVal.getDay()];
    const day = dateVal.getDate();
    const monthName = months[dateVal.getMonth()];
    const year = dateVal.getFullYear();
    return `${dayName} ${day} ${monthName} ${year}`;
  };

  // Determine pricing, advance, balance, target date based on paymentIndex
  let targetDate = booking.bookingDate;
  let payMode = booking.paymentMode;
  let advAmt = booking.advancePaid;
  let balanceAmt = booking.balanceDue;
  let payDetailsStr = '';

  if (paymentIndex !== undefined && paymentIndex >= 0 && booking.payments && booking.payments[paymentIndex]) {
    const p = booking.payments[paymentIndex];
    targetDate = p.date;
    payMode = p.method;
    advAmt = p.amount;

    let cumPaid = 0;
    for (let i = 0; i <= paymentIndex; i++) {
      cumPaid += booking.payments[i].amount;
    }
    balanceAmt = booking.totalAmount - cumPaid;

    if (p.method === 'UPI') {
      payDetailsStr = ` (Ref: ${p.transactionNo || 'N/A'})`;
    } else if (p.method === 'NEFT/RTGS') {
      payDetailsStr = ` (Bank: ${p.bankName || 'N/A'}, Ref: ${p.transactionNo || 'N/A'})`;
    } else if (p.method === 'Cheque') {
      payDetailsStr = ` (Bank: ${p.bankName || 'N/A'}, No: ${p.chequeNo || 'N/A'}, Date: ${p.chequeDate || 'N/A'})`;
    } else {
      payDetailsStr = ' (Cash)';
    }
  } else {
    // Overall latest details
    if (booking.payments && booking.payments.length > 0) {
      const latestP = booking.payments[booking.payments.length - 1];
      payMode = latestP.method;
      const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
      advAmt = totalPaid;
      if (latestP.method === 'UPI') {
        payDetailsStr = ` (Ref: ${latestP.transactionNo || 'N/A'})`;
      } else if (latestP.method === 'NEFT/RTGS') {
        payDetailsStr = ` (Bank: ${latestP.bankName || 'N/A'}, Ref: ${latestP.transactionNo || 'N/A'})`;
      } else if (latestP.method === 'Cheque') {
        payDetailsStr = ` (Bank: ${latestP.bankName || 'N/A'}, No: ${latestP.chequeNo || 'N/A'}, Date: ${latestP.chequeDate || 'N/A'})`;
      } else {
        payDetailsStr = ' (Cash)';
      }
    } else {
      payMode = 'None';
      payDetailsStr = '';
    }
  }

  const isDelivered = booking.status === 'Delivered';
  const isFullyPaid = balanceAmt === 0;
  let payLabel = 'Advance Received';
  if (isDelivered || isFullyPaid) {
    payLabel = 'TOTAL RECEIVED';
  } else if (paymentIndex !== undefined && paymentIndex > 0) {
    payLabel = 'Payment Received';
  }

  const bookingDateStr = formatDateString(targetDate);

  // We only display the payments that happened up to the selected transaction (if printing a transaction receipt)
  const paymentsToShow = booking.payments || [];
  const displayPayments = paymentIndex !== undefined && paymentIndex >= 0 
    ? paymentsToShow.slice(0, paymentIndex + 1)
    : paymentsToShow;

  return (
    <div id="bookingThermalPrintArea" style={{ 
      fontFamily: "'Courier New', Courier, monospace", 
      width: '100%', 
      maxWidth: '420px', 
      margin: '0 auto', 
      padding: '8px 10px', 
      boxSizing: 'border-box', 
      background: '#fff', 
      color: '#000' 
    }}>
      {/* 1. Header Section */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '24px', margin: '8px 0 4px' }}>
        KRISHI VIKAS UDYOG
      </div>
      
      {/* Receipt ID (Left) & Date (Right) Split */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '900', padding: '6px 0 4px' }}>
        <span>{booking.bookingId}</span>
        <span>{bookingDateStr}</span>
      </div>

      {/* Double line separator */}
      <div style={{ borderTop: '3px double #000', margin: '4px 0 8px' }}></div>

      {/* Customer Info Block */}
      <div style={{ fontSize: '15px', fontWeight: '900', lineHeight: '1.5', margin: '8px 0' }}>
        CUSTOMER NAME : {(booking.custName || '').toUpperCase()}<br />
        CONTACT NUMBER : {booking.mobile}<br />
        EXPECTED DELIVERY DATE : {formatDeliveryDate(booking.deliveryDate).toUpperCase()}
      </div>

      {/* Single line separator */}
      <div style={{ borderTop: '1.5px solid #000', margin: '8px 0' }}></div>

      {/* Booking Receipt title */}
      <div style={{ fontWeight: '900', textAlign: 'center', fontSize: '17px', letterSpacing: '2.5px', margin: '8px 0' }}>
        BOOKING RECEIPT
      </div>

      {/* Dashed separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

      {/* Booked Machines Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '15px', fontWeight: '900', margin: '8px 0' }}>
        <thead>
          <tr style={{ borderBottom: '1.5px solid #000' }}>
            <th style={{ textAlign: 'left', padding: '4px 0' }}>MACHINE</th>
            <th style={{ textAlign: 'center', padding: '4px 0', width: '40px' }}>QTY</th>
            <th style={{ textAlign: 'right', padding: '4px 0', width: '110px' }}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {booking.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: idx === booking.items.length - 1 ? 'none' : '1px dashed #000' }}>
              <td style={{ padding: '6px 0', textAlign: 'left', verticalAlign: 'top' }}>
                {item.name}
                {item.desc && (
                  <div style={{ fontSize: '13px', fontStyle: 'italic', fontWeight: 'normal', color: '#333', marginTop: '2px' }}>
                    {item.desc}
                  </div>
                )}
              </td>
              <td style={{ padding: '6px 0', textAlign: 'center', verticalAlign: 'top' }}>{item.qty}</td>
              <td style={{ padding: '6px 0', textAlign: 'right', verticalAlign: 'top' }}>
                ₹ {formatCurrency(item.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Machinery Specs Section */}
      <div style={{ margin: '12px 0 8px', fontSize: '14px', fontWeight: '900', lineHeight: '1.4' }}>
        <div style={{ textDecoration: 'underline', marginBottom: '4px' }}>SPECIFICATIONS</div>
        <div>CYCLONE: {booking.cyclone || 'No'}</div>
        <div>JHANNA: {booking.jhanna || 'No'}</div>
        {booking.tractor && <div>TRACTOR: {booking.tractor.toUpperCase()}</div>}
        {booking.hp && <div>HP: {booking.hp.toUpperCase()}</div>}
        {booking.pullySize && <div>PULLY SIZE: {booking.pullySize.toUpperCase()}</div>}
        {booking.ptoShaft && <div>PTO SHAFT: {booking.ptoShaft.toUpperCase()}</div>}
      </div>
      {booking.notes && (
        <div style={{ margin: '12px 0 8px', fontSize: '15px', fontWeight: '900', lineHeight: '1.4' }}>
          <div style={{ textDecoration: 'underline', marginBottom: '4px' }}>NOTES</div>
          <div style={{ whiteSpace: 'pre-wrap', fontWeight: '900' }}>{booking.notes}</div>
        </div>
      )}

      {/* Dashed separator */}
      <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

      {/* Booking Summary */}
      <div style={{ fontWeight: '900', textAlign: 'center', fontSize: '17px', letterSpacing: '2.5px', margin: '14px 0 6px' }}>
        BOOKING SUMMARY
      </div>
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0 8px' }}></div>

      <table style={{ width: '100%', fontSize: '15px', fontWeight: '900', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '4px 0' }}>Booking Amount</td>
            <td style={{ textAlign: 'right', padding: '4px 0' }}>₹ {formatCurrency(booking.totalAmount)}</td>
          </tr>
          <tr>
            <td style={{ padding: '4px 0' }}>{payLabel}</td>
            <td style={{ textAlign: 'right', padding: '4px 0' }}>₹ {formatCurrency(advAmt)}</td>
          </tr>
          <tr style={{ borderTop: '3px double #000' }}>
            <td style={{ padding: '6px 0', fontWeight: '900' }}>Remaining Balance</td>
            <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '900' }}>₹ {formatCurrency(balanceAmt)}</td>
          </tr>
        </tbody>
      </table>

      {/* Payment Received History */}
      {displayPayments.length > 0 && (
        <>
          <div style={{ fontWeight: '900', textAlign: 'center', fontSize: '17px', letterSpacing: '2.5px', margin: '20px 0 6px' }}>
            PAYMENT RECEIVED
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '4px 0 8px' }}></div>
          <table style={{ width: '100%', fontSize: '15px', fontWeight: '900', borderCollapse: 'collapse' }}>
            <tbody>
              {displayPayments.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: idx === displayPayments.length - 1 ? 'none' : '1px dashed #000' }}>
                  <td style={{ padding: '5px 0' }}>
                    {formatDateString(p.date).split(' ')[0]} ({p.method})
                  </td>
                  <td style={{ textAlign: 'right', padding: '5px 0' }}>
                    ₹ {formatCurrency(p.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Bottom Separators & Info */}
      <div style={{ borderTop: '3px double #000', margin: '12px 0 8px' }}></div>
      
      <div style={{ fontSize: '15px', fontWeight: '900', lineHeight: '1.5' }}>
        <b>Payment Mode:</b> {payMode}{payDetailsStr}<br />
        <b>Status:</b> {booking.paymentStatus}
      </div>

      {/* Footer block */}
      <div style={{ fontWeight: 'bold', marginTop: '12px', textAlign: 'center', fontSize: '15px', letterSpacing: '1px' }}>
        THANKS & REGARDS
      </div>
      <div style={{ fontSize: '15px', fontWeight: 'bold', marginTop: '4px', textAlign: 'center', paddingBottom: '8px' }}>
        KRISHI VIKAS UDYOG
      </div>
    </div>
  );
};
