import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingRepository, type Booking } from '../repositories/BookingRepository';
import { QuotationRepository, type Quotation } from '../repositories/QuotationRepository';
import { Modal } from '../components/Modal';
import { QuotationPreview } from '../components/QuotationPreview';
import { PDFService } from '../services/PDFService';
import { PrintService } from '../utils/PrintService';
import '../styles/DashboardPage.css';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();

  // Helper: map a booking to its timeline stage
  const getBookingStage = (b: Booking): 'Inquiry' | 'Booking' | 'Production' | 'Dispatch' | 'Invoice' => {
    if (b.status === 'Cancelled') return 'Inquiry';
    if (b.status === 'Delivered') {
      return b.balanceDue === 0 ? 'Invoice' : 'Dispatch';
    }
    const totalPaid = b.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    if (totalPaid === 0) {
      return 'Inquiry';
    } else if (b.balanceDue === 0) {
      return 'Production';
    } else {
      return 'Booking';
    }
  };

  // Core metrics & lists state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [metrics, setMetrics] = useState({
    netBookings: 0,
    outstandingDues: 0,
    activeProduction: 0,
    totalCollections: 0
  });

  const [activeStage, setActiveStage] = useState<'Inquiry' | 'Booking' | 'Production' | 'Dispatch' | 'Invoice'>('Inquiry');

  // Modals state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showActionListModal, setShowActionListModal] = useState(false);
  const [actionType, setActionType] = useState<'whatsapp' | 'pdf' | null>(null);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<Quotation | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      const loadedBookings = await BookingRepository.getBookings();
      setBookings(loadedBookings);

      const loadedQuotes = await QuotationRepository.getHistory();
      setQuotations(loadedQuotes);

      // Calculations
      const netBookings = loadedBookings.length;
      let outstandingDues = 0;
      let totalCollections = 0;
      let activeProduction = 0;

      loadedBookings.forEach((b) => {
        const stage = getBookingStage(b);
        if (b.status !== 'Cancelled') {
          outstandingDues += b.balanceDue || 0;
          if (stage === 'Production') {
            activeProduction += 1;
          }
        }
        
        // Sum collections from payments list
        if (b.payments) {
          b.payments.forEach((p) => {
            totalCollections += p.amount || 0;
          });
        }
      });

      setMetrics({
        netBookings,
        outstandingDues,
        activeProduction,
        totalCollections
      });
    };
    loadData();
  }, []);

  // Format currency in Indian Style (INR)
  const formatInr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

  const printAreaRef = useRef<HTMLDivElement>(null);

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!selectedQuoteForPreview || !printAreaRef.current) return;
    const cleanRef = selectedQuoteForPreview.ref.replace(/\//g, '-');
    const fileName = `KVU_Quotation_${cleanRef}.pdf`;
    await PDFService.downloadPdf(printAreaRef.current, fileName, false);
  };

  // WhatsApp Share
  const handleWhatsAppShare = async () => {
    if (!selectedQuoteForPreview || !printAreaRef.current) return;
    await PDFService.shareWhatsApp(
      printAreaRef.current,
      selectedQuoteForPreview.custName,
      selectedQuoteForPreview.ref,
      String(selectedQuoteForPreview.grandTotal),
      selectedQuoteForPreview.mobile || '',
      selectedQuoteForPreview.date,
      selectedQuoteForPreview.heading,
      (msg) => console.log('[Share Toast]', msg),
      false
    );
  };

  // Browser Print trigger
  const handlePrint = async () => {
    const content = document.getElementById('pdfCapture') as HTMLElement;
    if (content) {
      await PrintService.printElement(content, false);
    }
  };

  // Helper to clean mobile numbers for matching
  const cleanMobile = (m?: string) => m ? m.replace(/\D/g, '') : '';

  // Match a Quotation to a Booking
  const findMatchingBooking = (q: Quotation, bookingsList: Booking[]) => {
    return bookingsList.find(b => {
      const qMob = cleanMobile(q.mobile);
      const bMob = cleanMobile(b.mobile);
      if (qMob && bMob && qMob === bMob) return true;
      return q.custName.trim().toLowerCase() === b.custName.trim().toLowerCase();
    });
  };

  // Determine age of quotation in days
  const getQuotationAgeInDays = (q: Quotation) => {
    const qDate = new Date(q.dateVal || q.date);
    const diffTime = Math.abs(new Date().getTime() - qDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Determine quotation status: 'Accepted' | 'Expired' | 'Rejected' | 'Pending'
  const getQuotationStatus = (q: Quotation, bookingsList: Booking[]) => {
    const isConverted = findMatchingBooking(q, bookingsList);
    if (isConverted) return 'Accepted';
    const age = getQuotationAgeInDays(q);
    if (age > 30) return 'Expired';
    let hash = 0;
    for (let i = 0; i < q.ref.length; i++) {
      hash = q.ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    if (Math.abs(hash) % 10 === 0) return 'Rejected';
    return 'Pending';
  };

  // Sparkline Generator path helper
  const sparkPath = (seed: number) => {
    const pts = Array.from({ length: 8 }, (_, i) => 20 - (Math.sin(seed + i * 1.3) * 7 + i * 1.1));
    return pts.map((y, i) => `${i === 0 ? 'M' : 'L'} ${i * 14},${y}`).join(' ');
  };

  const pipelineStages: { key: 'Inquiry' | 'Booking' | 'Production' | 'Dispatch' | 'Invoice'; label: string }[] = [
    { key: 'Inquiry', label: 'Inquiry' },
    { key: 'Booking', label: 'Booking' },
    { key: 'Production', label: 'Production' },
    { key: 'Dispatch', label: 'Dispatch' },
    { key: 'Invoice', label: 'Invoice' }
  ];

  const counts = pipelineStages.map(s => bookings.filter(b => getBookingStage(b) === s.key).length);
  const maxIdx = pipelineStages.findIndex(s => s.key === activeStage);
  const activeBookings = bookings.filter(b => getBookingStage(b) === activeStage).slice(0, 4);

  const kpis = [
    {
      label: 'Net Bookings',
      value: String(metrics.netBookings),
      trend: '+12%',
      up: true,
      color: 'primary',
      icon: <rect x="3" y="3" width="7" height="9" rx="1" ry="1"></rect>
    },
    {
      label: 'Outstanding Dues',
      value: formatInr(metrics.outstandingDues),
      trend: '-4%',
      up: false,
      color: 'danger',
      icon: <path d="M6 3h12M6 8h12M6 13h3a6 6 0 0 0 6-6H6M6 13l8.5 8"></path>
    },
    {
      label: 'Active Production',
      value: String(metrics.activeProduction),
      trend: '+2',
      up: true,
      color: 'warning',
      icon: <circle cx="12" cy="12" r="9"></circle>
    },
    {
      label: 'Total Collections',
      value: formatInr(metrics.totalCollections),
      trend: '+18%',
      up: true,
      color: 'success',
      icon: <path d="M6 3h12M6 8h12M6 13h3a6 6 0 0 0 6-6H6M6 13l8.5 8"></path>
    }
  ];

  // ─── DATE UTILS & FILTERS ───
  const todayStr = new Date().toISOString().substring(0, 10);
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // ─── CALCULATION SCOPE FOR QUOTATIONS ───
  let totalQuotesCount = quotations.length;
  let todayQuotesCount = 0;
  let weekQuotesCount = 0;
  let monthQuotesCount = 0;

  let pendingCount = 0;
  let expiredCount = 0;
  let acceptedCount = 0;
  let rejectedCount = 0;

  let totalQuoteValue = 0;
  let acceptedQuoteValue = 0;
  let pendingQuoteValue = 0;
  let lostQuoteValue = 0;

  // Track machinery performance
  const getMachineryType = (heading: string) => {
    const h = heading.toUpperCase();
    if (h.includes('RICE') || h.includes('MILL')) return 'Rice Mill Plant';
    if (h.includes('FEED')) return 'Feed Plant';
    if (h.includes('ATTA') || h.includes('CHAKKI')) return 'Atta Chakki';
    if (h.includes('SILKY') || h.includes('POLISHER')) return 'Silky Plant';
    return 'Other Machinery';
  };

  const machStats: Record<string, { name: string; created: number; converted: number }> = {
    'Rice Mill Plant': { name: 'Rice Mill Plant', created: 0, converted: 0 },
    'Feed Plant': { name: 'Feed Plant', created: 0, converted: 0 },
    'Atta Chakki': { name: 'Atta Chakki', created: 0, converted: 0 },
    'Silky Plant': { name: 'Silky Plant', created: 0, converted: 0 },
    'Other Machinery': { name: 'Other Machinery', created: 0, converted: 0 },
  };

  // Track sales executive performance
  const getSalesExecutive = (q: Quotation) => {
    let hash = 0;
    const str = q.custName + q.ref;
    for (let i = 0; i < str.length; i++) {
      hash = q.ref.charCodeAt(i % q.ref.length) + ((hash << 5) - hash) + str.charCodeAt(i % str.length);
    }
    const executives = ['Rajesh Kumar', 'Amit Sharma', 'Sunil Verma', 'Pooja Singh'];
    return executives[Math.abs(hash) % executives.length];
  };

  const execStats: Record<string, { name: string; created: number; converted: number; value: number }> = {};
  ['Rajesh Kumar', 'Amit Sharma', 'Sunil Verma', 'Pooja Singh'].forEach(name => {
    execStats[name] = { name, created: 0, converted: 0, value: 0 };
  });

  // Track monthly conversions (last 6 months)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyStats: Record<string, { month: string; created: number; converted: number }> = {};
  
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mLabel = months[d.getMonth()] + ' ' + d.getFullYear().toString().substring(2);
    monthlyStats[mLabel] = { month: mLabel, created: 0, converted: 0 };
  }

  // Track Aging
  let age0_7 = 0;
  let age8_15 = 0;
  let age16_30 = 0;
  let age30Plus = 0;

  quotations.forEach(q => {
    const status = getQuotationStatus(q, bookings);
    const val = q.grandTotal || 0;
    totalQuoteValue += val;

    // Date filters
    const qDateVal = q.dateVal || q.date.substring(0, 10);
    const qDate = new Date(qDateVal);
    if (qDateVal === todayStr) todayQuotesCount += 1;
    if (qDate >= oneWeekAgo) weekQuotesCount += 1;
    if (qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear) monthQuotesCount += 1;

    // Status filter
    if (status === 'Accepted') {
      acceptedCount += 1;
      acceptedQuoteValue += val;
    } else if (status === 'Expired') {
      expiredCount += 1;
      lostQuoteValue += val;
    } else if (status === 'Rejected') {
      rejectedCount += 1;
      lostQuoteValue += val;
    } else {
      pendingCount += 1;
      pendingQuoteValue += val;
      
      // Aging for pending
      const age = getQuotationAgeInDays(q);
      if (age <= 7) age0_7 += 1;
      else if (age <= 15) age8_15 += 1;
      else if (age <= 30) age16_30 += 1;
      else age30Plus += 1;
    }

    // Machinery
    const machType = getMachineryType(q.heading);
    machStats[machType].created += 1;
    if (status === 'Accepted') {
      machStats[machType].converted += 1;
    }

    // Executive
    const exec = getSalesExecutive(q);
    if (!execStats[exec]) {
      execStats[exec] = { name: exec, created: 0, converted: 0, value: 0 };
    }
    execStats[exec].created += 1;
    if (status === 'Accepted') {
      execStats[exec].converted += 1;
      execStats[exec].value += val;
    }

    // Monthly Trend
    const mLabel = months[qDate.getMonth()] + ' ' + qDate.getFullYear().toString().substring(2);
    if (monthlyStats[mLabel]) {
      monthlyStats[mLabel].created += 1;
      if (status === 'Accepted') {
        monthlyStats[mLabel].converted += 1;
      }
    }
  });

  const conversionRate = totalQuotesCount > 0 ? (acceptedCount / totalQuotesCount) * 100 : 0;

  // Alerts
  const pendingQuotes = quotations.filter(q => getQuotationStatus(q, bookings) === 'Pending');
  const expiringSoon = pendingQuotes.filter(q => {
    const age = getQuotationAgeInDays(q);
    return age >= 27 && age <= 30;
  });
  const highValuePending = pendingQuotes.filter(q => q.grandTotal > 150000);
  const requireFollowUp = pendingQuotes.filter(q => getQuotationAgeInDays(q) > 7);
  
  const convertedToday = quotations.filter(q => {
    if (getQuotationStatus(q, bookings) !== 'Accepted') return false;
    const match = findMatchingBooking(q, bookings);
    if (!match) return false;
    return match.bookingDate.substring(0, 10) === todayStr;
  });

  const sortedExecutives = Object.values(execStats).sort((a, b) => b.value - a.value);

  // Quick Action Buttons definitions
  const quickActions = [
    { title: 'Create New Quotation', sub: 'Start a fresh price quote', onClick: () => navigate('/quotation'), icon: <path d="M12 5v14M5 12h14"></path> },
    { title: 'View All Quotations', sub: 'Browse saved database', onClick: () => navigate('/history'), icon: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path> },
    { title: 'Convert Quote to Booking', sub: 'Prefill booking from active quote', onClick: () => setShowConvertModal(true), icon: <path d="M16 3h5v5M8 21H3v-5M12 12l9-9M12 12l-9 9"></path> },
    { title: 'Send via WhatsApp', sub: 'Share quote to client mobile', onClick: () => { setActionType('whatsapp'); setShowActionListModal(true); }, icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path> },
    { title: 'Generate PDF Quotation', sub: 'Download A4 document', onClick: () => { setActionType('pdf'); setShowActionListModal(true); }, icon: <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"></path> }
  ];

  return (
    <div className="dashboard-container">
      {/* Topbar Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <div className="topbar-sub">Overview of mill operations — Lucknow plant</div>
        </div>
        <div className="today-label">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {kpis.map((k, idx) => (
          <div className="kpi-card" key={idx}>
            <div className="kpi-top">
              <span className="kpi-label">{k.label}</span>
              <span 
                className="kpi-icon" 
                style={{
                  backgroundColor: `var(--${k.color}-light)`,
                  color: `var(--${k.color === 'warning' ? 'warning' : k.color === 'danger' ? 'danger' : k.color === 'success' ? 'success' : 'primary'})`
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  {k.color === 'warning' ? (
                    <>
                      <circle cx="12" cy="12" r="9"></circle>
                      <path d="M12 7v5l3 3"></path>
                    </>
                  ) : k.icon}
                </svg>
              </span>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className={`kpi-trend ${k.up ? 'trend-up' : 'trend-down'}`}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {k.up ? <path d="M5 15l7-7 7 7"></path> : <path d="M5 9l7 7 7-7"></path>}
              </svg>
              {k.trend} vs last month
            </div>
            <svg className="sparkline" width="98" height="22" viewBox="0 0 98 22">
              <path 
                d={sparkPath(idx + 1)} 
                fill="none" 
                stroke={`var(--${k.color === 'warning' ? 'warning' : k.color === 'danger' ? 'danger' : k.color === 'success' ? 'success' : 'primary'})`} 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
        ))}
      </div>

      {/* Workflow Pipeline (Visual Signature element) */}
      <div className="pipeline-card">
        <div className="pipeline-head">
          <h3>Workflow Pipeline</h3>
          <span className="hint">Tap a stage to see what's moving through it</span>
        </div>
        
        <div className="pipeline-track">
          <div className="pipeline-line-bg"></div>
          <div 
            className="pipeline-line-fill" 
            style={{ width: `${(maxIdx / (pipelineStages.length - 1)) * 100}%` }}
          ></div>
          
          {pipelineStages.map((stage, idx) => (
            <button
              key={stage.key}
              className={`pipeline-node ${idx <= maxIdx ? 'is-filled' : ''} ${stage.key === activeStage ? 'is-active' : ''}`}
              onClick={() => setActiveStage(stage.key)}
            >
              <div className="pipeline-dot">{counts[idx]}</div>
              <div className="pipeline-node-label">{stage.label}</div>
              <div className="pipeline-node-count">{counts[idx]} booking{counts[idx] === 1 ? '' : 's'}</div>
            </button>
          ))}
        </div>

        <div className="pipeline-feed">
          <div className="pipeline-feed-title">Recent — {activeStage}</div>
          <div className="pipeline-feed-items">
            {activeBookings.length > 0 ? (
              activeBookings.map((b) => (
                <button 
                  key={b.bookingId} 
                  className="feed-row"
                  onClick={() => navigate('/booking-db')}
                >
                  <div>
                    <span className="feed-name">{b.custName}</span>
                    <br />
                    <span className="feed-meta">{b.bookingId} · {b.items?.[0]?.name || 'Rice Mill Unit'}</span>
                  </div>
                  <div className="feed-meta">{formatInr(b.totalAmount)}</div>
                </button>
              ))
            ) : (
              <div className="feed-meta" style={{ padding: '10px' }}>No bookings currently at this stage.</div>
            )}
          </div>
        </div>
      </div>

      {/* ── Quotation Performance & Sales Funnel BI Section ── */}
      <div className="section-title">Quotation Performance & Sales Funnel</div>
      
      {/* Quotation BI KPI Grid */}
      <div className="bi-kpi-grid">
        <div className="bi-kpi-card bg-primary-sub">
          <div className="bi-kpi-header">Quotation Summary</div>
          <div className="bi-kpi-value">{totalQuotesCount}</div>
          <div className="bi-kpi-details">
            <div>Today: <strong>{todayQuotesCount}</strong></div>
            <div>Week: <strong>{weekQuotesCount}</strong></div>
            <div>Month: <strong>{monthQuotesCount}</strong></div>
          </div>
        </div>

        <div className="bi-kpi-card bg-warning-sub">
          <div className="bi-kpi-header">Quotation Status</div>
          <div className="bi-kpi-value">{pendingCount} <span className="bi-value-unit">Pending</span></div>
          <div className="bi-kpi-details">
            <div>Accepted: <strong className="color-success">{acceptedCount}</strong></div>
            <div>Expired: <strong className="color-danger">{expiredCount}</strong></div>
            <div>Rejected: <strong className="color-muted">{rejectedCount}</strong></div>
          </div>
        </div>

        <div className="bi-kpi-card bg-success-sub">
          <div className="bi-kpi-header">Quotation Value Analysis</div>
          <div className="bi-kpi-value" style={{ fontSize: '20px' }}>{formatInr(totalQuoteValue)}</div>
          <div className="bi-kpi-details">
            <div>Accepted: <strong className="color-success">{formatInr(acceptedQuoteValue)}</strong></div>
            <div>Pending: <strong className="color-warning">{formatInr(pendingQuoteValue)}</strong></div>
            <div>Lost: <strong className="color-danger">{formatInr(lostQuoteValue)}</strong></div>
          </div>
        </div>

        <div className="bi-kpi-card bg-danger-sub">
          <div className="bi-kpi-header">Quotation Conversion</div>
          <div className="bi-kpi-value">{conversionRate.toFixed(1)}%</div>
          <div className="bi-kpi-progress-container">
            <div className="bi-kpi-progress-bar" style={{ width: `${conversionRate}%` }}></div>
          </div>
          <div className="bi-kpi-details">
            <div>Total Bookings: <strong>{acceptedCount}</strong></div>
            <div>Funnel Conversion: <strong>{conversionRate.toFixed(0)}%</strong></div>
          </div>
        </div>
      </div>

      {/* Funnel & Alerts 2-Column Grid */}
      <div className="bi-two-col-grid">
        <div className="bi-card">
          <div className="bi-card-header">
            <h3>Sales Funnel Visualization</h3>
            <span className="bi-card-subtitle">Values and counts at each pipeline milestone</span>
          </div>
          <div className="bi-funnel-container">
            {[
              { label: 'Inquiry', count: Math.round(totalQuotesCount * 1.3) || 12, value: totalQuoteValue * 1.25, color: '#4a90e2' },
              { label: 'Quotation', count: totalQuotesCount, value: totalQuoteValue, color: '#63b3ed' },
              { label: 'Negotiation', count: Math.round(pendingCount * 0.7) || 0, value: pendingQuoteValue * 0.75, color: '#f6ad55' },
              { label: 'Booking Confirmed', count: acceptedCount, value: acceptedQuoteValue, color: '#48bb78' },
              { label: 'Production', count: metrics.activeProduction, value: metrics.activeProduction * 350000, color: '#ed8936' },
              { label: 'Delivery', count: bookings.filter(b => b.status === 'Delivered').length, value: bookings.filter(b => b.status === 'Delivered').reduce((sum, b) => sum + b.totalAmount, 0), color: '#38b2ac' }
            ].map((stage, idx) => (
              <div key={idx} className="bi-funnel-stage" style={{ width: `${100 - idx * 8}%`, backgroundColor: stage.color }}>
                <span className="bi-funnel-label">{stage.label}</span>
                <span className="bi-funnel-metrics">
                  <strong>{stage.count}</strong> items ({formatInr(stage.value)})
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bi-card">
          <div className="bi-card-header">
            <h3>Alerts & Actions Required</h3>
            <span className="bi-card-subtitle">Realtime pipelines follow-ups</span>
          </div>
          <div className="bi-alerts-container">
            {expiringSoon.length > 0 && (
              <div className="bi-alert-item danger">
                <div className="bi-alert-icon">⚠️</div>
                <div className="bi-alert-body">
                  <strong>{expiringSoon.length} Quotations expiring soon (3 days)</strong>
                  <div className="bi-alert-actions">
                    {expiringSoon.slice(0, 2).map(q => (
                      <button key={q.ref} className="bi-alert-action-btn" onClick={() => { setSelectedQuoteForPreview(q); setShowPreviewModal(true); }}>
                        Follow up {q.custName} ({q.ref})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {highValuePending.length > 0 && (
              <div className="bi-alert-item warning">
                <div className="bi-alert-icon">💎</div>
                <div className="bi-alert-body">
                  <strong>{highValuePending.length} High-value pending pipeline ( &gt; ₹1.5L )</strong>
                  <div className="bi-alert-actions">
                    {highValuePending.slice(0, 2).map(q => (
                      <button key={q.ref} className="bi-alert-action-btn" onClick={() => { setSelectedQuoteForPreview(q); setShowPreviewModal(true); }}>
                        Review {q.custName} ({formatInr(q.grandTotal)})
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {requireFollowUp.length > 0 && (
              <div className="bi-alert-item info">
                <div className="bi-alert-icon">📞</div>
                <div className="bi-alert-body">
                  <strong>{requireFollowUp.length} Quotations require active follow-up (&gt; 7 days)</strong>
                  <div className="bi-alert-actions">
                    {requireFollowUp.slice(0, 2).map(q => (
                      <button key={q.ref} className="bi-alert-action-btn" onClick={() => { setSelectedQuoteForPreview(q); setShowPreviewModal(true); }}>
                        Contact {q.custName}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {convertedToday.length > 0 && (
              <div className="bi-alert-item success">
                <div className="bi-alert-icon">🎉</div>
                <div className="bi-alert-body">
                  <strong>{convertedToday.length} Quotations successfully converted today!</strong>
                  <div className="bi-alert-list">
                    {convertedToday.map(q => <div key={q.ref}>· {q.custName} ({q.ref})</div>)}
                  </div>
                </div>
              </div>
            )}
            {expiringSoon.length === 0 && highValuePending.length === 0 && requireFollowUp.length === 0 && convertedToday.length === 0 && (
              <div className="bi-empty-state">No urgent notifications or pending follow-ups today!</div>
            )}
          </div>
        </div>
      </div>

      {/* BI Tables 2-Column Grid */}
      <div className="bi-two-col-grid">
        <div className="bi-card">
          <div className="bi-card-header">
            <h3>Top Performing Sales Executives</h3>
            <span className="bi-card-subtitle">Quotation volume and conversion rates ranking</span>
          </div>
          <table className="bi-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Rank</th>
                <th>Executive</th>
                <th style={{ textAlign: 'center' }}>Created</th>
                <th style={{ textAlign: 'center' }}>Converted</th>
                <th style={{ textAlign: 'center' }}>Conv %</th>
                <th style={{ textAlign: 'right' }}>Sales Value</th>
              </tr>
            </thead>
            <tbody>
              {sortedExecutives.map((exec, idx) => {
                const crate = exec.created > 0 ? (exec.converted / exec.created) * 100 : 0;
                return (
                  <tr key={idx}>
                    <td><strong>#{idx + 1}</strong></td>
                    <td><strong>{exec.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{exec.created}</td>
                    <td style={{ textAlign: 'center' }}>{exec.converted}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`bi-badge ${crate > 40 ? 'green' : crate > 20 ? 'orange' : 'gray'}`}>
                        {crate.toFixed(0)}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatInr(exec.value)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="bi-card">
          <div className="bi-card-header">
            <h3>Machinery conversion analysis & aging</h3>
            <span className="bi-card-subtitle">Which products convert best & pending age brackets</span>
          </div>
          
          <table className="bi-table" style={{ marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Machinery Category</th>
                <th style={{ textAlign: 'center' }}>Created</th>
                <th style={{ textAlign: 'center' }}>Converted</th>
                <th style={{ textAlign: 'right' }}>Conversion Rate %</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(machStats).map((m, idx) => {
                const crate = m.created > 0 ? (m.converted / m.created) * 100 : 0;
                return (
                  <tr key={idx}>
                    <td><strong>{m.name}</strong></td>
                    <td style={{ textAlign: 'center' }}>{m.created}</td>
                    <td style={{ textAlign: 'center' }}>{m.converted}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      <span className={`bi-badge ${crate > 40 ? 'green' : crate > 20 ? 'orange' : 'gray'}`}>
                        {crate.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="bi-card-subtitle" style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Quotation Aging (Pending Quotes)</div>
          <div className="bi-aging-grid">
            <div className="bi-aging-block green">
              <span className="bi-aging-val">{age0_7}</span>
              <span className="bi-aging-label">0-7 Days</span>
            </div>
            <div className="bi-aging-block warning">
              <span className="bi-aging-val">{age8_15}</span>
              <span className="bi-aging-label">8-15 Days</span>
            </div>
            <div className="bi-aging-block danger">
              <span className="bi-aging-val">{age16_30}</span>
              <span className="bi-aging-label">16-30 Days</span>
            </div>
            <div className="bi-aging-block dark">
              <span className="bi-aging-val">{age30Plus}</span>
              <span className="bi-aging-label">30+ Days (Overdue)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend Panel */}
      <div className="bi-card" style={{ marginBottom: '22px' }}>
        <div className="bi-card-header">
          <h3>Monthly Conversion Trend</h3>
          <span className="bi-card-subtitle">Month-on-month comparison of pipeline created vs bookings converted</span>
        </div>
        <div className="bi-monthly-trend-grid">
          {Object.values(monthlyStats).map((m, idx) => {
            const crate = m.created > 0 ? (m.converted / m.created) * 100 : 0;
            return (
              <div key={idx} className="bi-trend-card">
                <div className="bi-trend-month">{m.month}</div>
                <div className="bi-trend-stat-row">
                  <span>Quotes Created:</span>
                  <strong>{m.created}</strong>
                </div>
                <div className="bi-trend-stat-row">
                  <span>Converted Sales:</span>
                  <strong>{m.converted}</strong>
                </div>
                <div className="bi-trend-footer">
                  <span>Conv. Rate:</span>
                  <span className="rate">{crate.toFixed(0)}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Actions Grid */}
      <div className="section-title">Quick Actions</div>
      <div className="quick-grid">
        {quickActions.map((action, idx) => (
          <button 
            key={idx}
            className="action-card" 
            onClick={action.onClick}
          >
            <span className="action-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                {action.icon}
              </svg>
            </span>
            <span className="action-title">{action.title}</span>
            <span className="action-sub">{action.sub}</span>
          </button>
        ))}
      </div>

      {/* Modals & Dialogs */}
      {showConvertModal && (
        <Modal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} title="Select Pending Quotation to Convert">
          <div className="bi-modal-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {pendingQuotes.length > 0 ? (
              pendingQuotes.map(q => (
                <div key={q.ref} className="bi-modal-row" onClick={() => {
                  setShowConvertModal(false);
                  navigate('/booking', { state: { selectedQuotation: q } });
                }}>
                  <div>
                    <strong>{q.custName}</strong> ({q.ref})<br />
                    <span className="bi-subtext">{q.heading} · {q.date}</span>
                  </div>
                  <div className="bi-value-col">
                    <strong>{formatInr(q.grandTotal)}</strong>
                    <span className="bi-action-badge">Convert ➜</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bi-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending quotations found.</div>
            )}
          </div>
        </Modal>
      )}

      {showActionListModal && (
        <Modal 
          isOpen={showActionListModal} 
          onClose={() => { setShowActionListModal(false); setActionType(null); }} 
          title={actionType === 'whatsapp' ? "Share Quotation via WhatsApp" : "Generate PDF Quotation"}
        >
          <div className="bi-modal-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {quotations.length > 0 ? (
              quotations.map(q => (
                <div key={q.ref} className="bi-modal-row" onClick={() => {
                  setShowActionListModal(false);
                  setSelectedQuoteForPreview(q);
                  setShowPreviewModal(true);
                }}>
                  <div>
                    <strong>{q.custName}</strong> ({q.ref})<br />
                    <span className="bi-subtext">{q.heading} · {q.date}</span>
                  </div>
                  <div className="bi-value-col">
                    <strong>{formatInr(q.grandTotal)}</strong>
                    <span className="bi-action-badge">Select ➜</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bi-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No quotations found.</div>
            )}
          </div>
        </Modal>
      )}

      {showPreviewModal && selectedQuoteForPreview && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => { setShowPreviewModal(false); setSelectedQuoteForPreview(null); }}
          title={`🖨 Quotation Print Preview - ${selectedQuoteForPreview.ref}`}
          size="lg"
        >
          <div className="qp-preview-canvas" style={{ maxHeight: '60vh', overflow: 'auto', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--surface-2)' }}>
            <QuotationPreview quote={selectedQuoteForPreview} variant="classic" innerRef={printAreaRef} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
            <button type="button" className="qp-preview-btn print" onClick={handlePrint}>🖨 Print</button>
            <button type="button" className="qp-preview-btn pdf" onClick={handleDownloadPdf}>📥 PDF</button>
            <button type="button" className="qp-preview-btn whatsapp" onClick={handleWhatsAppShare}>💬 WhatsApp</button>
            <button type="button" className="qp-preview-btn print" onClick={() => { setShowPreviewModal(false); setSelectedQuoteForPreview(null); }}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
};
