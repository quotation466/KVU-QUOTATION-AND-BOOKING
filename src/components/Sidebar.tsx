import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  counts: {
    history: number;
    customers: number;
    bookings: number;
    payments: number;
    bookingCustomers: number;
  };
  collapsed: boolean;
  onCollapse: (val: boolean) => void;
  online: boolean;
  syncing: boolean;
  onSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  counts, 
  collapsed, 
  onCollapse,
  online,
  syncing,
  onSync
}) => {
  const { currentUser, logout, isAdmin } = useAuth();

  return (
    <aside 
      className={`kvu-sidebar ${collapsed ? 'collapsed' : ''}`}
      style={{
        width: collapsed ? '72px' : '260px',
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 150,
        transition: 'width 200ms ease',
        flexShrink: 0
      }}
    >
      {/* Sidebar Header */}
      <div 
        className="sidebar-header"
        style={{
          padding: '16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: '12px'
        }}
      >
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ flexShrink: 0 }}>
              <img
                src="/logo.png"
                alt="KV"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '6px',
                  objectFit: 'contain'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Krishi Vikas Udyog
              </span>
            </div>
          </div>
        )}
        {collapsed && (
          <img
            src="/logo.png"
            alt="KV"
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              objectFit: 'contain'
            }}
          />
        )}

        <button
          onClick={() => onCollapse(!collapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: 0,
            minHeight: '28px'
          }}
          title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}>
            <line x1="18" y1="20" x2="18" y2="4"></line>
            <polyline points="12 4 4 12 12 20"></polyline>
          </svg>
        </button>
      </div>

      {/* Navigation Links */}
      <nav 
        style={{
          padding: '12px 8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: 1,
          overflowY: 'auto'
        }}
      >
        <NavLink to="/dashboard" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
          {!collapsed && <span>Dashboard</span>}
        </NavLink>

        <div style={{ margin: '8px 8px 4px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
          {!collapsed ? 'Sales & Quotations' : <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />}
        </div>

        <NavLink to="/quotation" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          {!collapsed && <span>New Quotation</span>}
        </NavLink>

        <NavLink to="/history" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          {!collapsed && <span>Quotation History</span>}
          {counts.history > 0 && <span className="sidebar-badge">{counts.history}</span>}
        </NavLink>

        <div style={{ margin: '8px 8px 4px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
          {!collapsed ? 'Bookings & Production' : <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />}
        </div>

        <NavLink to="/booking" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
          {!collapsed && <span>New Booking</span>}
        </NavLink>

        <NavLink to="/booking-db" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          {!collapsed && <span>Booking Database</span>}
          {counts.bookings > 0 && <span className="sidebar-badge">{counts.bookings}</span>}
        </NavLink>

        <NavLink to="/booking-customers" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M16 11l2 2 4-4"></path></svg>
          {!collapsed && <span>Booking Customers</span>}
          {counts.bookingCustomers > 0 && <span className="sidebar-badge">{counts.bookingCustomers}</span>}
        </NavLink>

        <NavLink to="/pending-deliveries" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
          {!collapsed && <span>Pending Deliveries</span>}
        </NavLink>

        <div style={{ margin: '8px 8px 4px 8px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>
          {!collapsed ? 'Accounting & Admin' : <div style={{ borderBottom: '1px solid var(--border)', margin: '4px 0' }} />}
        </div>

        <NavLink to="/payments" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
          {!collapsed && <span>Payments Ledger</span>}
          {counts.payments > 0 && <span className="sidebar-badge">{counts.payments}</span>}
        </NavLink>

        <NavLink to="/customers" className="sidebar-link">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          {!collapsed && <span>CRM Customers</span>}
          {counts.customers > 0 && <span className="sidebar-badge">{counts.customers}</span>}
        </NavLink>

        {isAdmin() && (
          <NavLink to="/reports" className="sidebar-link">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            {!collapsed && <span>Reports & Tools</span>}
          </NavLink>
        )}
      </nav>

      {/* Sidebar Footer — Sync indicators & trigger */}
      <div 
        className="sidebar-footer" 
        style={{ 
          padding: '14px', 
          borderTop: '1px solid var(--border-light)' 
        }}
      >
        {/* User Profile Chip */}
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              background: 'var(--border-light)',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '10px',
              justifyContent: collapsed ? 'center' : 'flex-start'
            }}
          >
            <div
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '12px',
                flexShrink: 0
              }}
            >
              {(currentUser.username || currentUser.userId).substring(0, 1).toUpperCase()}
            </div>
            {!collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', textAlign: 'left' }}>
                  {currentUser.username}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600, textAlign: 'left' }}>
                  {currentUser.role}
                </span>
              </div>
            )}
          </div>
        )}

        <div 
          className="sync-pill"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: online ? 'var(--success-light)' : 'var(--danger-light)',
            color: online ? '#1B6E48' : '#C8503C',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: '600',
            marginBottom: '8px',
            justifyContent: collapsed ? 'center' : 'flex-start'
          }}
        >
          <span 
            className={`sync-dot ${syncing ? 'syncing' : ''}`}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: online ? 'var(--success)' : 'var(--danger)',
              flexShrink: 0,
              animation: syncing ? 'pulse 1s ease-in-out infinite' : 'none'
            }}
          />
          {!collapsed && (
            <span className="sync-text">
              {online ? (syncing ? 'Syncing...' : 'Synced just now') : 'Offline'}
            </span>
          )}
        </div>
        
        <button 
          className="sync-btn" 
          onClick={onSync}
          disabled={syncing}
          style={{
            width: '100%',
            backgroundColor: 'var(--bg-page)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            opacity: syncing ? 0.7 : 1,
            transition: 'background 0.15s ease, border-color 0.15s ease'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={syncing ? 'spin-anim' : ''} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}>
            <path d="M21 12a9 9 0 11-2.6-6.4M21 4v6h-6"/>
          </svg>
          {!collapsed && <span className="sync-text">Sync Now</span>}
        </button>

        {/* Logout Button */}
        <button 
          className="logout-btn" 
          onClick={logout}
          style={{
            width: '100%',
            backgroundColor: 'transparent',
            border: '1px solid var(--danger-light)',
            color: 'var(--danger)',
            borderRadius: 'var(--radius-sm)',
            padding: '8px',
            fontSize: '12px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            cursor: 'pointer',
            marginTop: '8px',
            transition: 'all 0.15s ease'
          }}
          title="Logout Session"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          {!collapsed && <span className="logout-text">Logout</span>}
        </button>
      </div>

    </aside>
  );
};
