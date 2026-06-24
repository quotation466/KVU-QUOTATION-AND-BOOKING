import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingRepository, type Booking } from '../repositories/BookingRepository';
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
  const [metrics, setMetrics] = useState({
    netBookings: 0,
    outstandingDues: 0,
    activeProduction: 0,
    totalCollections: 0
  });

  const [activeStage, setActiveStage] = useState<'Inquiry' | 'Booking' | 'Production' | 'Dispatch' | 'Invoice'>('Inquiry');

  useEffect(() => {
    const loadData = async () => {
      const loadedBookings = await BookingRepository.getBookings();
      setBookings(loadedBookings);

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
      icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
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
      icon: <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
    }
  ];

  const quickActions = [
    { title: 'Create New Quotation', sub: 'Start a fresh price quote', page: '/quotation', icon: <path d="M12 5v14M5 12h14"></path> },
    { title: 'Add Payment Entry', sub: 'Log a new transaction', page: '/payments', icon: <rect x="2" y="5" width="20" height="14" rx="2"></rect> },
    { title: 'Verify CRM Records', sub: 'Review customer database', page: '/customers', icon: <circle cx="12" cy="8" r="4"></circle> },
    { title: 'Check Sync Health', sub: 'Confirm offline data is current', page: '/reports', icon: <path d="M21 12a9 9 0 11-2.6-6.4M21 4v6h-6"></path> }
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

      {/* Quick Actions Grid */}
      <div className="section-title">Quick Actions</div>
      <div className="quick-grid">
        {quickActions.map((action, idx) => (
          <button 
            key={idx}
            className="action-card" 
            onClick={() => navigate(action.page)}
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
    </div>
  );
};
