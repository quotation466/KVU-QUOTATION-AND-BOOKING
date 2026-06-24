import React, { useState, useEffect } from 'react';
import { CustomerRepository, type Customer } from '../repositories/CustomerRepository';
import { QuotationRepository, type Quotation } from '../repositories/QuotationRepository';
import { BookingRepository, type Booking } from '../repositories/BookingRepository';
import { SupabaseService } from '../services/SupabaseService';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { formatCurrency } from '../utils/numberToWords';
import type { ERPBackup } from '../types/Backup';
import { UserRepository, type User as BaseUser } from '../repositories/UserRepository';

type User = BaseUser & { passwordText?: string };
import { useAuth } from '../contexts/AuthContext';
import '../styles/ReportsPage.css';

export const ReportsPage: React.FC = () => {
  // Local state for calculations
  const [history, setHistory] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Filter and Toast states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'warning' | 'error' } | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Auth & Tab navigation state
  const { currentUser, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');

  // User Management state
  const [userList, setUserList] = useState<User[]>([]);
  const [newUserId, setNewUserId] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'Admin' | 'Staff'>('Staff');
  const [showCreatedModal, setShowCreatedModal] = useState(false);
  const [newlyCreatedUser, setNewlyCreatedUser] = useState<User | null>(null);

  // Load data on mount
  const loadData = async () => {
    try {
      const [historyList, customersList, bookingsList, usersList] = await Promise.all([
        QuotationRepository.getHistory(),
        CustomerRepository.getCustomers(),
        BookingRepository.getBookings(),
        UserRepository.refreshFromCloud()
      ]);
      setHistory(historyList);
      setCustomers(customersList);
      setBookings(bookingsList);
      setUserList(usersList);
    } catch (e) {
      console.warn('[ReportsPage] Loading data failed:', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  const triggerToast = (text: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Helper date string
  const getLocalDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getLocalDateString(new Date());

  // Aggregate metrics
  const totalQuoteCount = history.length;
  const totalQuoteValue = history.reduce((sum, q) => sum + (q.grandTotal || 0), 0);
  const totalCustCount = customers.length;
  
  const totalBookingCount = bookings.length;
  const pendingBookings = bookings.filter(b => b.status === 'Pending').length;
  const completedBookings = bookings.filter(b => b.status === 'Delivered').length;
  const cancelledBookings = bookings.filter(b => b.status === 'Cancelled').length;
  const totalBookingValue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  // Outstanding active dues
  const totalOutstandingDues = bookings
    .filter(b => b.status !== 'Cancelled')
    .reduce((sum, b) => sum + (b.balanceDue || 0), 0);

  // Collections metrics
  let allTimeCollection = 0;
  let todayCollection = 0;
  let rangeFilteredCollection = 0;

  // Monthly trends map
  const monthlyMap: Record<string, number> = {};

  bookings.forEach(b => {
    if (b.payments) {
      b.payments.forEach(p => {
        const amt = Number(p.amount) || 0;
        allTimeCollection += amt;

        // Check if today
        const pDateStr = (p.date || '').substring(0, 10);
        if (pDateStr === todayStr) {
          todayCollection += amt;
        }

        // Date range match
        let isMatched = true;
        if (startDate && pDateStr < startDate) isMatched = false;
        if (endDate && pDateStr > endDate) isMatched = false;
        if (isMatched) {
          rangeFilteredCollection += amt;
        }

        // Monthly trends
        const monthStr = (p.date || '').substring(0, 7); // "YYYY-MM"
        if (monthStr && monthStr.length === 7) {
          monthlyMap[monthStr] = (monthlyMap[monthStr] || 0) + amt;
        }
      });
    }
  });

  // Prepare monthly trend data (take last 6 months chronologically)
  const displayMonths = Object.keys(monthlyMap).sort().slice(-6);
  const maxMonthlyVal = displayMonths.length > 0 ? Math.max(...displayMonths.map(m => monthlyMap[m]), 1) : 1;

  const formatMonthLabel = (ym: string): string => {
    const [y, m] = ym.split('-');
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
    if (isNaN(date.getTime())) return ym;
    return date.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  // Clear filters
  const resetFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  // 1. Export JSON Backup
  const handleExportBackup = async () => {
    try {
      const [hist, custs, bks, qSeq, bSeq] = await Promise.all([
        QuotationRepository.getHistory(),
        CustomerRepository.getCustomers(),
        BookingRepository.getBookings(),
        QuotationRepository.getSequence(),
        BookingRepository.getSequence()
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: 2,
        history: hist,
        customers: custs,
        bookings: bks,
        sequence: qSeq,
        booking_sequence: bSeq,
        products: [],
        deleted_history: [],
        deleted_customers: [],
        deleted_bookings: []
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      
      a.href = url;
      a.download = `KVU_Backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      triggerToast(`✅ Backup file generated successfully! (${backup.history.length} quotes, ${backup.bookings.length} bookings, ${backup.customers.length} customers)`);
    } catch (e) {
      console.error(e);
      triggerToast('❌ Export failed! Real-time cloud data extraction error.', 'error');
    }
  };

  // 2. Import JSON Backup File Handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as ERPBackup;
        if (!backup || typeof backup !== 'object') {
          throw new Error('Selected file is not a valid JSON structure.');
        }

        // Validate basic properties
        if (!Array.isArray(backup.history) && !Array.isArray(backup.bookings) && !Array.isArray(backup.customers)) {
          throw new Error('Selected backup contains no recognizable records (quotations, bookings, or customers).');
        }

        // Legacy format check
        const histCount = Array.isArray(backup.history) ? backup.history.length : 0;
        const bookingsCount = Array.isArray(backup.bookings) ? backup.bookings.length : 0;
        const custsCount = Array.isArray(backup.customers) ? backup.customers.length : 0;

        const mergeChoice = window.confirm(
          `📥 Backup File Loaded:\n` +
          `• Quotations: ${histCount}\n` +
          `• Bookings: ${bookingsCount}\n` +
          `• Customers: ${custsCount}\n\n` +
          `Would you like to MERGE this backup with your existing data?\n` +
          `- Click "OK" to MERGE (retains existing records, appends new ones).\n` +
          `- Click "Cancel" to REPLACE (overwrites everything, requires Admin PIN).`
        );

        if (mergeChoice) {
          // Trigger MERGE strategy
          setSyncing(true);
          await mergeBackupData(backup);
          setSyncing(false);
        } else {
          // REPLACE strategy directly with confirmation
          const doubleCheck = window.confirm(
            '⚠️ DANGER: Are you absolutely sure? This will DELETE all current quotations, bookings, customers, and payment transaction history. This action CANNOT be undone!'
          );
          if (doubleCheck) {
            replaceBackupData(file);
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown JSON parsing error';
        alert(`❌ Import failed: ${errMsg}`);
      }
      // Reset input element value so same file can be selected again
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // Merge Backup Logic
  const mergeBackupData = async (backup: ERPBackup) => {
    try {
      setSyncing(true);
      
      // 1. Merge Customers
      const backupC = Array.isArray(backup.customers) ? backup.customers : [];
      for (const c of backupC) {
        await CustomerRepository.saveCustomer(c);
      }

      // 2. Merge Quotations
      const backupH = Array.isArray(backup.history) ? backup.history : [];
      for (const q of backupH) {
        await QuotationRepository.saveQuotation(q, true);
      }

      // 3. Merge Bookings
      const backupB = Array.isArray(backup.bookings) ? backup.bookings : [];
      for (const b of backupB) {
        await BookingRepository.saveBooking(b, 0);
      }

      // 4. Merge Sequences
      const newSeq = Number(backup.sequence) || 0;
      const currentSeq = await QuotationRepository.getSequence();
      if (newSeq > currentSeq) {
        await SupabaseService.setSequence('quotation', newSeq);
      }

      const newBookingSeq = Number(backup.booking_sequence) || 0;
      const currentBookingSeq = await BookingRepository.getSequence();
      if (newBookingSeq > currentBookingSeq) {
        await SupabaseService.setSequence('booking', newBookingSeq);
      }

      await loadData();
      setSyncing(false);
      triggerToast(`✅ Merged successfully: ${backupH.length} quotations, ${backupC.length} customers, ${backupB.length} bookings.`);
    } catch (e) {
      console.error(e);
      setSyncing(false);
      alert('❌ Failed to merge data. Cloud connection issue.');
    }
  };

  // Replace Backup Logic (PIN verified)
  const replaceBackupData = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backup = JSON.parse(event.target?.result as string) as ERPBackup;
        setSyncing(true);

        const targetH = Array.isArray(backup.history) ? backup.history : [];
        const targetC = Array.isArray(backup.customers) ? backup.customers : [];
        const targetB = Array.isArray(backup.bookings) ? backup.bookings : [];
        const targetSeq = Number(backup.sequence) || 0;
        const targetBookingSeq = Number(backup.booking_sequence) || 0;

        // Wipe cloud tables first
        await SupabaseService.clearAllTables();

        // Upload everything to cloud in sequence
        for (const c of targetC) {
          await SupabaseService.upsertCustomer(c);
        }

        for (const q of targetH) {
          await SupabaseService.upsertQuotation(q);
        }

        for (const b of targetB) {
          await SupabaseService.upsertBooking(b);
        }

        await SupabaseService.setSequence('quotation', targetSeq);
        await SupabaseService.setSequence('booking', targetBookingSeq);

        await loadData();
        setSyncing(false);
        triggerToast('✅ Database completely replaced with backup successfully!');
      } catch (err) {
        setSyncing(false);
        const errMsg = err instanceof Error ? err.message : 'JSON reading error.';
        alert(`❌ Replace failed: ${errMsg}`);
      }
    };
    reader.readAsText(file);
  };

  // 3. Reset Database utility
  const triggerResetDatabase = () => {
    const doubleCheck = window.confirm(
      '⚠️ DANGER: This will WIPE the entire ERP database, resetting sequences and clearing all transactions locally and in the Supabase cloud. Do you want to proceed?'
    );
    if (doubleCheck) {
      executeResetDatabase();
    }
  };

  const executeResetDatabase = async () => {
    try {
      setSyncing(true);

      // Clear cloud tables directly
      await SupabaseService.clearAllTables();

      await loadData();
      setSyncing(false);
      triggerToast('💥 Database reset successfully! Supabase tables are empty.', 'warning');
    } catch (e) {
      setSyncing(false);
      alert('❌ Reset failed. Could not push empty structures to cloud.');
    }
  };

  // User database methods
  const loadUsers = async () => {
    const users = await UserRepository.refreshFromCloud();
    setUserList(users);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[CreateUser] Submitting:', { newUserId, newUsername, newRole });
    try {
      const result = await UserRepository.createUser(newUserId, newUsername, newPassword, newRole);
      console.log('[CreateUser] Success:', result.user.userId);
      setNewlyCreatedUser({ ...result.user, passwordText: result.plainPassword });
      setShowCreatedModal(true);
      setNewUserId('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('Staff');
      await loadUsers();
    } catch (err: any) {
      console.error('[CreateUser] Error:', err.message);
      alert(`❌ Error: ${err.message}`);
    }
  };

  const generateRandomPassword = () => {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const specials = '@$!%*?&';
    const all = uppercase + lowercase + numbers + specials;
    
    let pass = '';
    // Ensure at least one of each required type
    pass += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    pass += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pass += specials.charAt(Math.floor(Math.random() * specials.length));
    
    // Fill the rest to reach 12 characters
    for (let i = 0; i < 8; i++) {
      pass += all.charAt(Math.floor(Math.random() * all.length));
    }
    
    // Shuffle the characters
    const shuffled = pass.split('').sort(() => 0.5 - Math.random()).join('');
    setNewPassword(shuffled);
  };

  const handleDeleteUser = async (userIdToDelete: string) => {
    if (currentUser?.userId === userIdToDelete) {
      alert('❌ You cannot delete your own account!');
      return;
    }
    if (userIdToDelete === 'admin') {
      alert('❌ The primary "admin" account cannot be deleted!');
      return;
    }
    if (window.confirm(`Are you sure you want to delete user "${userIdToDelete}"?`)) {
      await UserRepository.deleteUser(userIdToDelete);
      await loadUsers();
      triggerToast('👤 User deleted successfully!');
    }
  };

  const handleUpdateRole = async (userIdToUpdate: string, currentRole: 'Admin' | 'Staff') => {
    if (userIdToUpdate === 'admin') {
      alert('❌ The role of the primary "admin" cannot be updated!');
      return;
    }
    const nextRole = currentRole === 'Admin' ? 'Staff' : 'Admin';
    if (window.confirm(`Are you sure you want to change the role of "${userIdToUpdate}" to "${nextRole}"?`)) {
      await UserRepository.updateUser(userIdToUpdate, { role: nextRole });
      await loadUsers();
      triggerToast(`Role updated to ${nextRole}!`);
    }
  };

  return (
    <div className="reports-container">
      {/* Toast Alert */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.text}
        </div>
      )}

      {/* Syncing overlay blocker */}
      {syncing && (
        <div className="loading-overlay">
          <div className="loading-overlay-spinner"></div>
          <span className="loading-overlay-text">Syncing database stores to Supabase...</span>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="reports-tabs-bar" style={{
        display: 'flex',
        borderBottom: '2.5px solid var(--border)',
        marginBottom: '20px',
        gap: '10px'
      }}>
        <button
          onClick={() => setActiveTab('reports')}
          style={{
            padding: '12px 20px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'reports' ? '3px solid var(--primary)' : '3px solid transparent',
            color: activeTab === 'reports' ? 'var(--primary)' : 'var(--text-secondary)',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          📊 Reports & Analytics
        </button>
        {isAdmin() && (
          <button
            onClick={() => setActiveTab('users')}
            style={{
              padding: '12px 20px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'users' ? '3px solid var(--primary)' : '3px solid transparent',
              color: activeTab === 'users' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            👥 User Management
          </button>
        )}
      </div>

      {activeTab === 'reports' ? (
        <>
          {/* Section 1: Business Performance Analytics Summary */}
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-title">Quotations</span>
              <span className="stat-value">{totalQuoteCount}</span>
              <span className="stat-sub">Value: ₹ {formatCurrency(totalQuoteValue)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Total Customers</span>
              <span className="stat-value">{totalCustCount}</span>
              <span className="stat-sub">Registered Registry</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Active Bookings</span>
              <span className="stat-value">{totalBookingCount}</span>
              <span className="stat-sub" style={{ display: 'flex', gap: '5px' }}>
                <span style={{ color: '#f59e0b' }}>⌛{pendingBookings} Pend</span> | 
                <span style={{ color: '#10b981' }}>✅{completedBookings} Del</span> | 
                <span style={{ color: '#ef4444' }}>❌{cancelledBookings} Can</span>
              </span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Cumulative Collections</span>
              <span className="stat-value" style={{ color: '#10b981' }}>₹ {formatCurrency(allTimeCollection)}</span>
              <span className="stat-sub">From bookings: ₹ {formatCurrency(totalBookingValue)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-title">Outstanding Dues</span>
              <span className="stat-value" style={{ color: '#ef4444' }}>₹ {formatCurrency(totalOutstandingDues)}</span>
              <span className="stat-sub">Pending customer collection</span>
            </div>
          </div>

          {/* Section 2: Collection Details with Range Filter */}
          <div className="dashboard-section">
            <h2 className="section-title">📊 Collections & Range Reports</h2>
            
            <div className="reports-filter-row">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>START DATE</label>
                <input 
                  type="date" 
                  value={startDate} 
                  onChange={e => setStartDate(e.target.value)} 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)' }}>END DATE</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={e => setEndDate(e.target.value)} 
                />
              </div>
              <div>
                <Button variant="secondary" onClick={resetFilters}>
                  Reset Range
                </Button>
              </div>
            </div>

            {/* Collections results summary */}
            <div className="reports-collection-summary">
              <div className="reports-collection-card">
                <span className="reports-collection-card-label">TODAY'S COLLECTION</span>
                <span className="reports-collection-card-val danger">₹ {formatCurrency(todayCollection)}</span>
              </div>
              <div className="reports-collection-card">
                <span className="reports-collection-card-label">
                  {startDate || endDate ? 'FILTERED RANGE COLLECTION' : 'ALL TIME COLLECTION'}
                </span>
                <span className="reports-collection-card-val">₹ {formatCurrency(rangeFilteredCollection)}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Charts Layout Grid */}
          <div className="reports-charts-grid">
            
            {/* CSS Monthly trend bar chart */}
            <div className="dashboard-section">
              <h2 className="section-title">📈 Monthly Collection Trends (Last 6 Months)</h2>
              {displayMonths.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '12px', color: '#999' }}>
                  No payments logged to chart collections.
                </div>
              ) : (
                <div className="chart-container">
                  {displayMonths.map(ym => {
                    const val = monthlyMap[ym] || 0;
                    const pct = (val / maxMonthlyVal) * 100;
                    return (
                      <div key={ym} className="chart-bar-wrapper">
                        <div className="chart-bar-tooltip">₹ {formatCurrency(val)}</div>
                        <div 
                          className="chart-bar" 
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        ></div>
                        <span className="chart-label">{formatMonthLabel(ym)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>



          {/* Section 5: Data Management Backups & Recovery */}
          <div className="dashboard-section">
            <h2 className="section-title">⚙️ Data Management & Backup Console</h2>
            <p style={{ margin: 0, fontSize: '11px', color: '#718096' }}>
              Manage your ERP records, download full database backups, restore previous points, or reset local database states.
            </p>

            <div className="util-grid">
              
              {/* Card 1: Export */}
              <div className="util-card">
                <h3>📥 Export JSON Backup</h3>
                <p>Download your quotations, customers, bookings, and payments registry as a single .json file to store securely.</p>
                <Button 
                  variant="primary" 
                  onClick={handleExportBackup} 
                >
                  Export Database
                </Button>
              </div>

              {/* Card 2: Import */}
              <div className="util-card">
                <h3>📤 Import JSON Backup</h3>
                <p>Load previous backups. Supports merging records (non-duplicate append) or full overwrite replacement.</p>
                <div style={{ marginTop: 'auto' }}>
                  <label 
                    htmlFor="backup-file-upload" 
                    className="btn-primary"
                    style={{ 
                      display: 'inline-block', 
                      padding: '10px 18px', 
                      fontSize: '12px', 
                      fontWeight: 'bold', 
                      borderRadius: 'var(--radius-sm)', 
                      cursor: 'pointer', 
                      textAlign: 'center' 
                    }}
                  >
                    Upload Backup File
                  </label>
                  <input 
                    id="backup-file-upload"
                    type="file" 
                    accept=".json" 
                    onChange={handleFileSelect} 
                    style={{ display: 'none' }} 
                  />
                </div>
              </div>

              {/* Card 3: Reset */}
              <div className="util-card">
                <h3 style={{ color: 'var(--danger)' }}>💥 System Reset</h3>
                <p>Wipe all local and cloud synchronized Supabase transaction registries. Reset all sequence numbers. Highly destructive!</p>
                <Button 
                  variant="danger" 
                  onClick={triggerResetDatabase} 
                >
                  Reset Database
                </Button>
              </div>

            </div>
          </div>
        </>
      ) : (
        /* User Management Tab Content */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section: Create New Credentials */}
          <div className="dashboard-section">
            <h2 className="section-title">👤 Generate Staff & Admin Credentials</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#718096', marginBottom: '20px' }}>
              Generate credentials for new staff or admin users. User ID must be unique and alphanumeric.
            </p>

            <form onSubmit={handleCreateUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>USER ID (LOGIN ID)</label>
                <input
                  type="text"
                  placeholder="e.g. staff_aman"
                  value={newUserId}
                  onChange={e => setNewUserId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>DISPLAY NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Aman Kumar"
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  required
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>PASSWORD</label>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <input
                    type="text"
                    placeholder="Enter Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', flex: 1 }}
                  />
                  <Button type="button" variant="secondary" onClick={generateRandomPassword} style={{ padding: '8px 10px', fontSize: '11px' }}>
                    ⚡ Auto
                  </Button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>ROLE</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value as 'Admin' | 'Staff')}
                  style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', backgroundColor: '#fff', height: '37px' }}
                >
                  <option value="Staff">Staff (Daily Operations)</option>
                  <option value="Admin">Admin (Full Control)</option>
                </select>
              </div>

              <div>
                <Button type="submit" variant="primary" style={{ width: '100%', height: '37px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  ➕ Generate User
                </Button>
              </div>
            </form>
          </div>

          {/* Section: User Registry Table */}
          <div className="dashboard-section">
            <h2 className="section-title">👥 Active User Registry</h2>
            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table className="db-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ textAlign: 'left', padding: '10px' }}>User ID</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Name</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Role</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Password</th>
                    <th style={{ textAlign: 'left', padding: '10px' }}>Created At</th>
                    <th style={{ textAlign: 'center', padding: '10px', width: '180px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {userList.map(u => (
                    <tr key={u.userId} style={{ borderBottom: '1px solid #edf2f7' }}>
                      <td style={{ padding: '10px', fontWeight: 'bold' }}>{u.userId}</td>
                      <td style={{ padding: '10px' }}>{u.username}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          background: u.role === 'Admin' ? 'var(--danger-light)' : 'var(--primary-light)',
                          color: u.role === 'Admin' ? 'var(--danger)' : 'var(--primary)'
                        }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '10px', fontFamily: 'monospace' }}>
                        {u.passwordText}
                      </td>
                      <td style={{ padding: '10px', fontSize: '11px', color: '#718096' }}>
                        {new Date(u.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'center', display: 'flex', gap: '5px', justifyContent: 'center' }}>
                        <Button
                          variant="secondary"
                          onClick={() => handleUpdateRole(u.userId, u.role)}
                          disabled={u.userId === 'admin'}
                          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          🔄 Toggle Role
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleDeleteUser(u.userId)}
                          disabled={u.userId === 'admin' || currentUser?.userId === u.userId}
                          style={{ padding: '4px 8px', fontSize: '11px', whiteSpace: 'nowrap' }}
                        >
                          🗑️ Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Newly Generated Credentials Alert Modal */}
      <Modal
        isOpen={showCreatedModal}
        onClose={() => setShowCreatedModal(false)}
        title="🔑 Credentials Generated Successfully!"
        footerActions={
          <Button variant="primary" onClick={() => setShowCreatedModal(false)}>
            Ok, Noted
          </Button>
        }
      >
        {newlyCreatedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '5px' }}>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              New user record has been registered. You can share these credentials:
            </p>
            <div style={{
              background: 'var(--bg-page)',
              border: '1.5px dashed var(--primary)',
              borderRadius: '8px',
              padding: '15px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontFamily: 'monospace'
            }}>
              <div><strong>User ID:</strong> <span style={{ color: 'var(--primary)', fontSize: '14px', fontWeight: 'bold' }}>{newlyCreatedUser.userId}</span></div>
              <div><strong>Password:</strong> <span style={{ color: 'var(--clay)', fontSize: '14px', fontWeight: 'bold' }}>{newlyCreatedUser.passwordText}</span></div>
              <div><strong>Role:</strong> <span>{newlyCreatedUser.role}</span></div>
            </div>
            <p style={{ margin: 0, fontSize: '10px', color: 'var(--danger)', fontWeight: '600' }}>
              ⚠️ Note: Instruct the user to change the password after sharing it.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
