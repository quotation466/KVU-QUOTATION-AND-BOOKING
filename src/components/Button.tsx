import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'tab' | 'model';
  active?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  active = false,
  icon,
  children,
  className = '',
  style,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'btn-primary';
      case 'secondary':
        return 'btn-secondary';
      case 'danger':
        return 'btn-danger';
      case 'success':
        return 'btn-success';
      case 'outline':
        return 'btn-outline';
      case 'tab':
        return `tab-btn ${active ? 'active' : ''}`;
      case 'model':
        return `mill-model-btn ${active ? 'active' : ''}`;
      default:
        return '';
    }
  };

  return (
    <button
      className={`${getVariantClass()} ${className}`.trim()}
      style={style}
      {...props}
    >
      {icon && <span style={{ marginRight: '6px', display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      {children}
    </button>
  );
};
