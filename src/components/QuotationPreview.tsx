import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { Quotation } from '../repositories/QuotationRepository';
import { logoBase64 } from '../assets/logo';
import { formatCurrency, numberToWords } from '../utils/numberToWords';
import { Header } from './Header';

interface QuotationPreviewProps {
  quote: Quotation;
  innerRef?: React.RefObject<HTMLDivElement | null>;
  variant?: 'classic';
}

export const QuotationPreview: React.FC<QuotationPreviewProps> = ({ quote, innerRef, variant = 'classic' }) => {
  const [qrUrl, setQrUrl] = useState<string>('');

  useEffect(() => {
    const qrText = `KRISHI VIKAS UDYOG\nRef: ${quote.ref}\nDate: ${quote.date}\nTotal: Rs.${quote.grandTotal}`;
    QRCode.toDataURL(qrText, { width: 180, margin: 1 })
      .then((url) => setQrUrl(url))
      .catch((err) => console.error('[QR] Error generating QR code:', err));
  }, [quote]);

  // Format customer name in Sri/Smt + relation + father name
  const prefix = quote.gender === 'female' ? 'SMT.' : 'SRI.';
  let formattedCustName = `${prefix} ${quote.custName.toUpperCase()}`;
  if (quote.fatherName) {
    const relationStr = `${quote.relation.toUpperCase()} SRI.`;
    formattedCustName += ` ${relationStr} ${quote.fatherName.toUpperCase()}`;
  }

  // Format address lines
  const addressLines: string[] = [];
  if (quote.address) addressLines.push(quote.address);
  if (quote.post) addressLines.push(`POST .: ${quote.post.toUpperCase()}`);
  
  let loc = '';
  if (quote.district) loc += `DIST.: ${quote.district.toUpperCase()}`;
  if (quote.state) loc += ` (${quote.state.toUpperCase()})`;
  if (quote.pincode) loc += `   PIN CODE.: ${quote.pincode}`;
  if (loc) addressLines.push(loc);

  // Calculate values
  const totalAmt = quote.items.reduce((sum, item) => sum + item.amount, 0);
  const afterDisc = totalAmt - quote.discount;
  const gstAmt = afterDisc * (quote.gstRate / 100);
  const grandExact = afterDisc + gstAmt;
  const roundoff = quote.grandTotal - grandExact;
  const isUP = quote.state && quote.state.trim().toLowerCase() === 'uttar pradesh';

  const renderClassic = () => {
    const classicPadLength = Math.max(0, 8 - quote.items.length);
    const classicPadRows = Array.from({ length: classicPadLength });
    return (
      <div id="printArea">
        {/* Watermark logo */}
        <img
          src={logoBase64}
          className="watermark"
          alt=""
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />

        {/* Header Component */}
        <Header title="QUOTATION" />

        {/* Ref and Date */}
        <div className="ref-date">
          <span>
            <b>REF NO. :</b> &nbsp;<span>{quote.ref}</span>
          </span>
          <span>
            <b>DATE:</b> &nbsp;<span>{quote.date}</span>
          </span>
        </div>

        {/* Customer Info */}
        <div className="to-label">TO,</div>
        <div className="cust-name">{formattedCustName}</div>
        <div className="cust-addr">
          {addressLines.map((line, idx) => (
            <React.Fragment key={idx}>
              {line}
              {idx < addressLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div className="mob-row">
          <span>
            <b>MOB NO. :</b> &nbsp;<span>{quote.mobile || '—'}</span>
          </span>
          <span>
            <b>AADHAAR NO. :</b> &nbsp;<span>{quote.aadhar || '—'}</span>
          </span>
        </div>

        {/* Heading & HSN */}
        <div
          style={{
            textAlign: 'center',
            fontWeight: 'bold',
            fontSize: '13px',
            margin: '3px 0 0',
            border: '1px solid black',
            padding: '4px',
            boxSizing: 'border-box'
          }}
        >
          <span>{quote.heading || 'MINI RICE MILL MACHINE'}</span>
          {quote.hsn && <span> &nbsp;&nbsp;(HSN CODE-{quote.hsn})</span>}
        </div>

        {/* Line Items Table */}
        <table id="final" style={{ marginTop: '-1px', width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: '7%', border: '1px solid black', textAlign: 'center' }}>S.NO.</th>
              <th style={{ border: '1px solid black', textAlign: 'left', paddingLeft: '8px' }}>PRODUCT NAME & DESCRIPTION</th>
              <th style={{ width: '8%', border: '1px solid black', textAlign: 'center' }}>QTY</th>
              <th style={{ width: '15%', border: '1px solid black', textAlign: 'right', paddingRight: '8px' }}>RATE (Rs.)</th>
              <th style={{ width: '15%', border: '1px solid black', textAlign: 'right', paddingRight: '8px' }}>AMOUNT (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item, idx) => (
              <tr key={idx}>
                <td className="center" style={{ border: '1px solid black', verticalAlign: 'middle' }}>
                  {idx + 1}
                </td>
                <td style={{ border: '1px solid black', padding: '6px 8px', verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{item.name}</div>
                  {item.desc && (
                    <div style={{ fontSize: '10.5px', color: '#333', marginTop: '2px', lineHeight: '1.7', whiteSpace: 'pre-line' }}>
                      {item.desc}
                    </div>
                  )}
                </td>
                <td className="center" style={{ border: '1px solid black', verticalAlign: 'middle' }}>
                  {item.qty}
                </td>
                <td className="right" style={{ border: '1px solid black', verticalAlign: 'middle', paddingRight: '8px' }}>
                  {formatCurrency(item.rate)}
                </td>
                <td className="right" style={{ border: '1px solid black', verticalAlign: 'middle', paddingRight: '8px' }}>
                  {formatCurrency(item.amount)}
                </td>
              </tr>
            ))}
            {/* Pad empty rows */}
            {classicPadRows.map((_, idx) => (
              <tr key={`pad-${idx}`}>
                <td style={{ border: '1px solid black', padding: '4px' }}>&nbsp;</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>&nbsp;</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>&nbsp;</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>&nbsp;</td>
                <td style={{ border: '1px solid black', padding: '4px' }}>&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Table 1 */}
        <table style={{ marginTop: '-1px', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td rowSpan={quote.discount > 0 ? 2 : 1} style={{ border: 'none', width: '55%' }}></td>
              <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>TOTAL</td>
              <td className="right" style={{ border: '1px solid black', padding: '3px 8px', width: '110px', paddingRight: '8px' }}>
                {formatCurrency(totalAmt)}
              </td>
            </tr>
            {quote.discount > 0 && (
              <tr>
                <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>DISCOUNT</td>
                <td className="right" style={{ border: '1px solid black', padding: '3px 8px', paddingRight: '8px' }}>
                  {formatCurrency(quote.discount)}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Totals Table 2 */}
        <table style={{ marginTop: '-1px', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td rowSpan={isUP ? 5 : 4} style={{ border: '1px solid black', padding: '6px 8px', width: '55%', verticalAlign: 'top' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', textDecoration: 'underline' }}>VALUE IN WORDS</div>
                <div style={{ textAlign: 'center', marginTop: '5px', fontWeight: 'bold' }}>{numberToWords(quote.grandTotal)}</div>
              </td>
              <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>
                {isUP ? (
                  <>CGST@ &nbsp;<span>{quote.gstRate / 2}</span>%</>
                ) : (
                  <>IGST@ &nbsp;<span>{quote.gstRate}</span>%</>
                )}
              </td>
              <td className="right" style={{ border: '1px solid black', padding: '3px 8px', width: '110px', paddingRight: '8px' }}>
                {formatCurrency(isUP ? gstAmt / 2 : gstAmt)}
              </td>
            </tr>
            {isUP && (
              <tr>
                <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>
                  SGST@ &nbsp;<span>{quote.gstRate / 2}</span>%
                </td>
                <td className="right" style={{ border: '1px solid black', padding: '3px 8px', paddingRight: '8px' }}>
                  {formatCurrency(gstAmt / 2)}
                </td>
              </tr>
            )}
            <tr>
              <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>TOTAL</td>
              <td className="right" style={{ border: '1px solid black', padding: '3px 8px', paddingRight: '8px' }}>
                <b>{formatCurrency(grandExact)}</b>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}>ROUNDOFF</td>
              <td className="right" style={{ border: '1px solid black', padding: '3px 8px', paddingRight: '8px' }}>
                {(roundoff >= 0 ? '+' : '') + formatCurrency(roundoff)}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid black', padding: '3px 8px', fontWeight: 'bold' }}><b>GRAND TOTAL</b></td>
              <td className="right" style={{ border: '1px solid black', padding: '3px 8px', paddingRight: '8px' }}>
                <b>{formatCurrency(quote.grandTotal)}</b>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Capacity and Power */}
        <table style={{ marginTop: '-1px', borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid black', padding: '3px 8px', width: '50%' }}>
                <b>CAPACITY:</b> &nbsp;<span>{quote.capacity || ''}</span>
                {quote.capacity && <span> Ton/h</span>}
              </td>
              <td style={{ border: '1px solid black', padding: '3px 8px' }}>
                <b>POWER:</b> &nbsp;<span>{quote.power || ''}</span>
                {quote.power && <span> kWh</span>}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Spacer to prevent touching */}
        <div style={{ height: '5px' }}></div>

        {/* Footer section (bank info, qr code, signature) */}
        <div className="footer-container">
          <div className="bank-tc-box">
            <div className="bank-tc-content">
              <div className="bank-section">
                <b>
                  ICICI BANK
                  <br />
                  A/C No :- 105205002837
                  <br />
                  IFSC :- ICIC0001052
                  <br />
                  BRANCH:- TANDA
                </b>
              </div>
              <div className="separator-line"></div>
              <div className="tc-section">
                VALIDITY OF QUOTATION 30 DAYS
                <br />
                TAXES ARE APPLICABLE AS PER GST
                <br />
                {quote.incInst && (
                  <span id="instTextRow">
                    INSTALLATION & TRIAL CHARGES ARE EXTRA - 25000
                    <br />
                  </span>
                )}
                ALL DISPUTE SUBJECT TO AMBEDKER NAGAR JURISDICTION
              </div>
            </div>
            <div className="qr-section">
              <div id="qrcode" className="qr-code-container">
                {qrUrl && <img src={qrUrl} alt="QR Code" style={{ width: '100%', height: '100%' }} />}
              </div>
            </div>
          </div>
          <div className="signature-box">
            <img
              src="/stamp.png"
              className="stamp-img"
              alt="Stamp"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="signature-text">KRISHI VIKAS UDYOG</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div id="pdfCapture" ref={innerRef} className={`legacy-print-scope template-${variant}`}>
      <div id="page-border-outer">
        <div id="page-border-inner" />
      </div>
      <div id="pageContent">
        {renderClassic()}
      </div>
      <div className="electronically-generated-note">
        * THIS IS A COMPUTER-GENERATED QUOTATION AND BUT REQUIRES  PHYSICAL SIGNATURE & STAMP
      </div>
    </div>
  );
};
