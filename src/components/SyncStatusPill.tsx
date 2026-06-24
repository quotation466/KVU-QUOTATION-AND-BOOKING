import React from 'react';

export type SyncStatus = 'offline' | 'syncing' | 'synced';

interface SyncStatusPillProps {
  status: SyncStatus;
  label?: string;
  style?: React.CSSProperties;
}

export const SyncStatusPill: React.FC<SyncStatusPillProps> = ({ 
  status, 
  label, 
  style 
}) => {
  const getLabel = () => {
    if (label) return label;
    switch (status) {
      case 'offline':
        return '🔴 Offline';
      case 'syncing':
        return '🟡 Syncing...';
      case 'synced':
        return '🟢 Synced';
      default:
        return '🔴 Offline';
    }
  };

  return (
    <div className={`sync-pill ${status}`} id="syncStatusPill" style={style}>
      {getLabel()}
    </div>
  );
};
