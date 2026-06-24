import React from 'react';
import type { Booking } from '../repositories/BookingRepository';

interface WorkflowTimelineProps {
  booking: Booking;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ booking }) => {
  // Determine current active step index
  let activeStep = 0; // 0: Booked

  const hasPayments = booking.payments && booking.payments.length > 0;
  const totalPaid = booking.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const isPending = booking.status === 'Pending';
  const isDelivered = booking.status === 'Delivered';
  const isCancelled = booking.status === 'Cancelled';

  if (isCancelled) {
    activeStep = -1; // Special canceled state
  } else if (isDelivered) {
    if (booking.balanceDue === 0) {
      activeStep = 4; // Completed (Delivered + Paid)
    } else {
      activeStep = 3; // Dispatched (Delivered, but pending dues)
    }
  } else if (isPending) {
    if (booking.balanceDue === 0) {
      activeStep = 3; // Ready to Dispatch (Full paid)
    } else if (totalPaid > 0) {
      activeStep = 2; // In Production (Advance Paid)
    } else {
      activeStep = 1; // Booked (Wait Advance)
    }
  }

  const steps = [
    { label: 'Booked', desc: 'Order Created' },
    { label: 'Advance Paid', desc: hasPayments ? `Rs. ${totalPaid} collected` : 'Pending advance' },
    { label: 'In Production', desc: 'Machinery manufacturing' },
    { label: 'Ready', desc: booking.balanceDue === 0 ? 'Balance settled' : `Rs. ${booking.balanceDue} due` },
    { label: 'Delivered', desc: isDelivered ? 'Handed over' : 'Pending dispatch' }
  ];

  if (isCancelled) {
    return (
      <div 
        style={{
          background: 'var(--success-light)',
          backgroundColor: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 16px',
          color: '#DC2626',
          fontSize: '13px',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
        <span>This booking is Cancelled.</span>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          width: '100%',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          gap: '12px'
        }}
      >
        {steps.map((step, idx) => {
          const isCompleted = activeStep >= idx;
          const isCurrent = activeStep === idx;
          
          return (
            <React.Fragment key={idx}>
              <div 
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: '100px',
                  textAlign: 'center',
                  position: 'relative',
                  flex: 1
                }}
              >
                {/* Circle Icon */}
                <div 
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: isCompleted ? 'var(--primary)' : 'var(--bg-page)',
                    color: isCompleted ? '#ffffff' : 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    border: `2px solid ${isCompleted ? 'var(--primary)' : 'var(--border)'}`,
                    marginBottom: '6px',
                    boxShadow: isCurrent ? '0 0 0 3px var(--primary-light)' : 'none',
                    transition: 'all 200ms ease'
                  }}
                >
                  {isCompleted && activeStep > idx ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  ) : (
                    idx + 1
                  )}
                </div>

                {/* Labels */}
                <span style={{ fontSize: '11px', fontWeight: '700', color: isCompleted ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'block' }}>
                  {step.label}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', display: 'block', marginTop: '2px', lineHeight: 1.1 }}>
                  {step.desc}
                </span>
              </div>

              {/* Connecting Line */}
              {idx < steps.length - 1 && (
                <div 
                  style={{
                    height: '2px',
                    background: activeStep > idx ? 'var(--primary)' : 'var(--border)',
                    flex: 2,
                    minWidth: '20px',
                    alignSelf: 'center',
                    marginBottom: '26px',
                    transition: 'background-color 200ms ease'
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
