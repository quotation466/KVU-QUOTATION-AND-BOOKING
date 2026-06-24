import React from 'react';
import { SyncStatusPill } from './SyncStatusPill';

interface MobileNavProps {
  counts: {
    history: number;
    customers: number;
    bookings: number;
    payments: number;
    bookingCustomers: number;
  };
  online: boolean;
  syncing: boolean;
  onSync: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ online, syncing, onSync }) => {
  return (
    <div 
      className="mobile-sync-floating-widget"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--bg-card)',
        padding: '8px 12px',
        borderRadius: '30px',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-lg)'
      }}
    >
      <button
        onClick={onSync}
        disabled={syncing || !online}
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-page)',
          color: 'var(--text-primary)',
          padding: '6px 12px',
          borderRadius: '20px',
          cursor: syncing ? 'wait' : 'pointer',
          fontSize: '11px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          boxShadow: 'var(--shadow-sm)',
          margin: 0,
          fontWeight: 600
        }}
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={syncing ? { animation: 'spin 1.5s linear infinite' } : undefined}>
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
      </button>
      <SyncStatusPill status={online ? (syncing ? 'syncing' : 'synced') : 'offline'} />
    </div>
  );
};
