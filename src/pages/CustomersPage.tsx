import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../hooks/useCustomers';
import type { Customer } from '../repositories/CustomerRepository';
import { Modal } from '../components/Modal';
import { CustomerForm } from './CustomerForm';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { DataTable } from '../components/DataTable';
import '../styles/CustomersPage.css';

export const CustomersPage: React.FC = () => {
  const {
    customers,
    loading,
    saveCustomer,
    deleteCustomer
  } = useCustomers();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);

  // Action chooser popover state
  const [actionPopoverCustomer, setActionPopoverCustomer] = useState<Customer | null>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActionPopoverCustomer(null);
        setPopoverAnchor(null);
      }
    };
    if (actionPopoverCustomer) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [actionPopoverCustomer]);

  const handleAddClick = () => {
    setEditingIndex(undefined);
    setCurrentCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (customer: Customer, index: number) => {
    setEditingIndex(index);
    setCurrentCustomer(customer);
    setIsModalOpen(true);
  };

  const handleSave = async (customer: Customer) => {
    await saveCustomer(customer);
    setIsModalOpen(false);
  };

  const handleUseClick = (customer: Customer, e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setActionPopoverCustomer(customer);
    setPopoverAnchor({
      top: rect.bottom + window.scrollY + 6,
      left: rect.left + window.scrollX,
    });
  };

  const handleGoToQuotation = () => {
    if (!actionPopoverCustomer) return;
    setActionPopoverCustomer(null);
    navigate('/quotation', { state: { selectedCustomer: actionPopoverCustomer } });
  };

  const handleGoToBooking = () => {
    if (!actionPopoverCustomer) return;
    setActionPopoverCustomer(null);
    navigate('/booking', { state: { selectedCustomer: actionPopoverCustomer } });
  };

  const columns = [
    {
      key: 'serial',
      header: 'S.No',
      render: (_: any, idx: number) => <span>{idx + 1}</span>,
      sortable: false
    },
    {
      key: 'name',
      header: 'Customer Name',
      sortable: true,
      render: (c: Customer) => <span style={{ fontWeight: '600' }}>{c.name}</span>
    },
    {
      key: 'father',
      header: "Father's Name",
      sortable: true,
      render: (c: Customer) => <span>{c.father || '—'}</span>
    },
    {
      key: 'district',
      header: 'District',
      sortable: true,
      render: (c: Customer) => <span>{c.district || '—'}</span>
    },
    {
      key: 'state',
      header: 'State',
      sortable: true,
      render: (c: Customer) => <span>{c.state || '—'}</span>
    },
    {
      key: 'mobile',
      header: 'Mobile',
      sortable: true,
      render: (c: Customer) => <span>{c.mobile || '—'}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (c: Customer, idx: number) => (
        <div className="crm-actions-wrapper">
          <button
            className="crm-action-btn use"
            onClick={(e) => handleUseClick(c, e)}
            id={`crm-use-btn-${idx}`}
            title="Create Quotation or Booking for this customer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
            </svg>
            Use
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          <button
            className="crm-action-btn edit"
            onClick={() => handleEditClick(c, idx)}
            aria-label="Edit customer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
            </svg>
          </button>
          <button
            className="crm-action-btn delete"
            onClick={() => deleteCustomer(idx, c.name, c.mobile)}
            aria-label="Delete customer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18"></path>
              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="crm-customers-container">

      {/* Header and Add Button */}
      <div className="crm-header-row">
        <div className="crm-title-section">
          <h1>CRM Customers</h1>
          <p>Manage and view lead contacts, addresses, and mobile numbers.</p>
        </div>

        <button
          onClick={handleAddClick}
          className="crm-add-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Customer
        </button>
      </div>

      {/* Main Customers List */}
      {loading ? (
        <LoadingIndicator message="Syncing customers database..." />
      ) : (
        <DataTable
          data={customers}
          columns={columns}
          searchPlaceholder="Search by Name, District, Mobile..."
          searchFields={['name', 'district', 'mobile']}
          exportFileName="customers-database"
        />
      )}

      {/* Action Chooser Popover */}
      {actionPopoverCustomer && popoverAnchor && (
        <div
          ref={popoverRef}
          className="crm-action-popover"
          style={{
            position: 'absolute',
            top: popoverAnchor.top,
            left: popoverAnchor.left,
            zIndex: 2000,
          }}
          role="menu"
          aria-label="Choose action for customer"
        >
          <div className="crm-action-popover-header">
            <span className="crm-action-popover-name">{actionPopoverCustomer.name}</span>
            <span className="crm-action-popover-sub">Select what to create</span>
          </div>
          <div className="crm-action-popover-options">
            <button
              className="crm-popover-option quotation"
              onClick={handleGoToQuotation}
              role="menuitem"
            >
              <div className="crm-popover-option-icon quotation-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
              </div>
              <div className="crm-popover-option-text">
                <span className="crm-popover-option-title">New Quotation</span>
                <span className="crm-popover-option-desc">Create a price quote / estimate</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            <button
              className="crm-popover-option booking"
              onClick={handleGoToBooking}
              role="menuitem"
            >
              <div className="crm-popover-option-icon booking-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                  <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                </svg>
              </div>
              <div className="crm-popover-option-text">
                <span className="crm-popover-option-title">New Booking</span>
                <span className="crm-popover-option-desc">Book an order with advance &amp; delivery</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingIndex !== undefined ? 'Edit Customer Details' : 'Add New Customer'}
      >
        <CustomerForm
          initialCustomer={currentCustomer}
          onSave={handleSave}
          onCancel={() => setIsModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default CustomersPage;
