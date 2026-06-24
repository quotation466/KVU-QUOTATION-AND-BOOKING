import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  style?: React.CSSProperties;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  size = 'medium',
  style
}) => {
  const getSpinnerSize = () => {
    switch (size) {
      case 'small': return { width: '16px', height: '16px', borderSize: '2px' };
      case 'large': return { width: '40px', height: '40px', borderSize: '4px' };
      case 'medium':
      default:
        return { width: '24px', height: '24px', borderSize: '3px' };
    }
  };

  const spinnerStyle = getSpinnerSize();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px', ...style }}>
      <div 
        style={{
          width: spinnerStyle.width,
          height: spinnerStyle.height,
          border: `${spinnerStyle.borderSize} solid #f3f3f3`,
          borderTop: `${spinnerStyle.borderSize} solid #cc0000`,
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {message && <span style={{ fontSize: '12px', color: '#666', fontWeight: 'bold' }}>{message}</span>}
    </div>
  );
};
