import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoadingIndicator } from './components/LoadingIndicator';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const QuotationPage = lazy(() => import('./pages/QuotationPage').then(m => ({ default: m.QuotationPage })));
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.HistoryPage })));
const CustomersPage = lazy(() => import('./pages/CustomersPage').then(m => ({ default: m.CustomersPage })));
const BookingsPage = lazy(() => import('./pages/BookingsPage').then(m => ({ default: m.BookingsPage })));
const BookingDatabasePage = lazy(() => import('./pages/BookingDatabasePage').then(m => ({ default: m.BookingDatabasePage })));
const BookingCustomersPage = lazy(() => import('./pages/BookingCustomersPage').then(m => ({ default: m.BookingCustomersPage })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then(m => ({ default: m.PaymentPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const PendingDeliveriesPage = lazy(() => import('./pages/PendingDeliveriesPage').then(m => ({ default: m.PendingDeliveriesPage })));

import { SyncService } from './services/SyncService';
import { QuotationRepository } from './repositories/QuotationRepository';
import { CustomerRepository } from './repositories/CustomerRepository';
import { BookingRepository } from './repositories/BookingRepository';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AnimatePresence, motion } from 'framer-motion';
import './styles/legacyStyles.css';
import './App.css';

const NavigationLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [counts, setCounts] = useState({ history: 0, customers: 0, bookings: 0, payments: 0, bookingCustomers: 0 });
  const [online, setOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const refreshCounts = async () => {
    try {
      const [hist, custs, bookings] = await Promise.all([
        QuotationRepository.getHistory(),
        CustomerRepository.getCustomers(),
        BookingRepository.getBookings()
      ]);
      
      let payCount = 0;
      if (Array.isArray(bookings)) {
        bookings.forEach((b) => {
          if (b.payments) payCount += b.payments.length;
        });
      }

      // Group booking customers to count unique ones
      const bCustKeys = new Set<string>();
      if (Array.isArray(bookings)) {
        bookings.forEach((b) => {
          if (b.custName) {
            const nameKey = b.custName.trim().toLowerCase();
            const mobileKey = (b.mobile || '').replace(/\D/g, '');
            bCustKeys.add(`${nameKey}::${mobileKey}`);
          }
        });
      }

      setCounts({
        history: Array.isArray(hist) ? hist.length : 0,
        customers: Array.isArray(custs) ? custs.length : 0,
        bookings: Array.isArray(bookings) ? bookings.length : 0,
        payments: payCount,
        bookingCustomers: bCustKeys.size
      });
    } catch (e) {
      console.warn('[Navbar] Error parsing counts:', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCounts();
  }, [location]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Register auto-sync connection listener daemon
    const cleanupSync = SyncService.registerConnectionListeners();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      cleanupSync();
    };
  }, []);

  const triggerSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      await SyncService.fullSync();
      refreshCounts();
    } catch (e) {
      console.error('[Sync] Full sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="kvu-app-shell">
      <Sidebar 
        counts={counts} 
        collapsed={sidebarCollapsed} 
        onCollapse={setSidebarCollapsed} 
        online={online}
        syncing={syncing}
        onSync={triggerSync}
      />
      <div className={`kvu-main-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <main className="kvu-main-content" id="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.22, ease: 'easeInOut' }}
              style={{ width: '100%', height: '100%', boxSizing: 'border-box' }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <MobileNav counts={counts} online={online} syncing={syncing} onSync={triggerSync} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <NavigationLayout>
                      <Suspense fallback={<LoadingIndicator style={{ height: '70vh' }} />}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/dashboard" replace />} />
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/quotation" element={<QuotationPage />} />
                          <Route path="/history" element={<HistoryPage />} />
                          <Route path="/customers" element={<CustomersPage />} />
                          <Route path="/booking" element={<BookingsPage />} />
                          <Route path="/booking-db" element={<BookingDatabasePage />} />
                          <Route path="/booking-customers" element={<BookingCustomersPage />} />
                          <Route path="/pending-deliveries" element={<PendingDeliveriesPage />} />
                          <Route path="/payments" element={<PaymentPage />} />
                          <Route path="/reports" element={<ReportsPage />} />
                          <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                      </Suspense>
                    </NavigationLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
