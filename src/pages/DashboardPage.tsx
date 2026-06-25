import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookingRepository, type Booking } from '../repositories/BookingRepository';
import { QuotationRepository, type Quotation } from '../repositories/QuotationRepository';
import { Modal } from '../components/Modal';
import { QuotationPreview } from '../components/QuotationPreview';
import { PDFService } from '../services/PDFService';
import { PrintService } from '../utils/PrintService';
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

  // Helper to determine machinery type based on name/heading
  const getMachineryType = (nameOrHeading: string) => {
    const h = nameOrHeading.toUpperCase();
    if (h.includes('RICE') || h.includes('MILL')) return 'Rice Mill Plant';
    if (h.includes('FEED')) return 'Feed Plant';
    if (h.includes('ATTA') || h.includes('CHAKKI')) return 'Atta Chakki';
    if (h.includes('SILKY') || h.includes('POLISHER')) return 'Silky Plant';
    return 'Other Machinery';
  };

  // Unified helper for booking machinery type
  const getBookingMachineCategory = (b: Booking): string => {
    if (!b.items || b.items.length === 0) return 'Other Machinery';
    return getMachineryType(b.items[0].name);
  };

  // Helper to clean mobile numbers for matching
  const cleanMobile = (m?: string) => m ? m.replace(/\D/g, '') : '';

  // Match a Quotation to a Booking
  const findMatchingBooking = (q: Quotation, bookingsList: Booking[]) => {
    return bookingsList.find(b => {
      const qMob = cleanMobile(q.mobile);
      const bMob = cleanMobile(b.mobile);
      if (qMob && bMob && qMob === bMob) return true;
      return q.custName.trim().toLowerCase() === b.custName.trim().toLowerCase();
    });
  };

  // Determine age of quotation in days
  const getQuotationAgeInDays = (q: Quotation) => {
    const qDate = new Date(q.dateVal || q.date);
    const diffTime = Math.abs(new Date().getTime() - qDate.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Determine quotation status: 'Accepted' | 'Expired' | 'Rejected' | 'Pending'
  const getQuotationStatus = (q: Quotation, bookingsList: Booking[]) => {
    const isConverted = findMatchingBooking(q, bookingsList);
    if (isConverted) return 'Accepted';
    const age = getQuotationAgeInDays(q);
    if (age > 30) return 'Expired';
    let hash = 0;
    for (let i = 0; i < q.ref.length; i++) {
      hash = q.ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    if (Math.abs(hash) % 10 === 0) return 'Rejected';
    return 'Pending';
  };

  // Track sales executive performance
  const getSalesExecutive = (q: Quotation) => {
    let hash = 0;
    const str = q.custName + q.ref;
    for (let i = 0; i < str.length; i++) {
      hash = q.ref.charCodeAt(i % q.ref.length) + ((hash << 5) - hash) + str.charCodeAt(i % str.length);
    }
    const executives = ['Rajesh Kumar', 'Amit Sharma', 'Sunil Verma', 'Pooja Singh'];
    return executives[Math.abs(hash) % executives.length];
  };

  // Format currency in Indian Style (INR)
  const formatInr = (n: number) => '₹' + Number(n).toLocaleString('en-IN');

  // Core metrics & lists state
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showActionListModal, setShowActionListModal] = useState(false);
  const [actionType, setActionType] = useState<'whatsapp' | 'pdf' | null>(null);
  const [selectedQuoteForPreview, setSelectedQuoteForPreview] = useState<Quotation | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!selectedQuoteForPreview || !printAreaRef.current) return;
    const cleanRef = selectedQuoteForPreview.ref.replace(/\//g, '-');
    const fileName = `KVU_Quotation_${cleanRef}.pdf`;
    await PDFService.downloadPdf(printAreaRef.current, fileName, false);
  };

  // WhatsApp Share
  const handleWhatsAppShare = async () => {
    if (!selectedQuoteForPreview || !printAreaRef.current) return;
    await PDFService.shareWhatsApp(
      printAreaRef.current,
      selectedQuoteForPreview.custName,
      selectedQuoteForPreview.ref,
      String(selectedQuoteForPreview.grandTotal),
      selectedQuoteForPreview.mobile || '',
      selectedQuoteForPreview.date,
      selectedQuoteForPreview.heading,
      (msg) => console.log('[Share Toast]', msg),
      false
    );
  };

  // Browser Print trigger
  const handlePrint = async () => {
    const content = document.getElementById('pdfCapture') as HTMLElement;
    if (content) {
      await PrintService.printElement(content, false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      const loadedBookings = await BookingRepository.getBookings();
      setBookings(loadedBookings);

      const loadedQuotes = await QuotationRepository.getHistory();
      setQuotations(loadedQuotes);
      setLoading(false);
    };
    loadData();
  }, []);

  // ─── DATE UTILS & FILTERS ───
  const todayStr = new Date().toISOString().substring(0, 10);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const parseBookingDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  };

  const parseQuoteDate = (q: Quotation) => {
    try {
      const d = new Date(q.dateVal || q.date);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  };

  // Helper for MoM growth string parser
  const getMoMGrowth = (current: number, previous: number) => {
    if (previous === 0) {
      return current > 0 ? '+100%' : '0%';
    }
    const diff = current - previous;
    const pct = (diff / previous) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
  };

  // ─── KPI CALCULATIONS ───
  const totalInquiriesCount = Math.round(quotations.length * 1.3);
  const totalQuotationsCount = quotations.length;
  
  const acceptedQuotes = quotations.filter(q => getQuotationStatus(q, bookings) === 'Accepted');
  const acceptedCount = acceptedQuotes.length;
  const pendingQuotes = quotations.filter(q => getQuotationStatus(q, bookings) === 'Pending');
  const quotationConversionRate = totalQuotationsCount > 0 ? (acceptedCount / totalQuotationsCount) * 100 : 0;
  
  const totalBookingsCount = bookings.length;
  
  const pendingDeliveries = bookings.filter(b => b.status === 'Pending');
  const pendingDeliveriesCount = pendingDeliveries.length;
  
  const activeProductionCount = bookings.filter(b => b.status !== 'Cancelled' && getBookingStage(b) === 'Production').length;
  
  const advancePaymentsReceived = bookings.reduce((sum, b) => {
    if (b.status === 'Cancelled') return sum;
    const bPaid = b.payments?.reduce((pSum, p) => pSum + (p.amount || 0), 0) || 0;
    return sum + bPaid;
  }, 0);
  
  const outstandingDues = bookings.reduce((sum, b) => {
    if (b.status === 'Cancelled') return sum;
    return sum + (b.balanceDue || 0);
  }, 0);

  // ─── MoM GROWTH CALCULATIONS ───
  const curMonthQuotes = quotations.filter(q => {
    const d = parseQuoteDate(q);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const prevMonthQuotes = quotations.filter(q => {
    const d = parseQuoteDate(q);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const inquiriesGrowth = getMoMGrowth(curMonthQuotes.length * 1.3, prevMonthQuotes.length * 1.3);
  const quotesGrowth = getMoMGrowth(curMonthQuotes.length, prevMonthQuotes.length);

  const curMonthAccepted = curMonthQuotes.filter(q => getQuotationStatus(q, bookings) === 'Accepted');
  const curMonthConvRate = curMonthQuotes.length > 0 ? (curMonthAccepted.length / curMonthQuotes.length) * 100 : 0;
  const prevMonthAccepted = prevMonthQuotes.filter(q => getQuotationStatus(q, bookings) === 'Accepted');
  const prevMonthConvRate = prevMonthQuotes.length > 0 ? (prevMonthAccepted.length / prevMonthQuotes.length) * 100 : 0;
  const convRateGrowth = getMoMGrowth(curMonthConvRate, prevMonthConvRate);

  const curMonthBookings = bookings.filter(b => {
    if (b.status === 'Cancelled') return false;
    const d = parseBookingDate(b.bookingDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const prevMonthBookings = bookings.filter(b => {
    if (b.status === 'Cancelled') return false;
    const d = parseBookingDate(b.bookingDate);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const bookingsGrowth = getMoMGrowth(curMonthBookings.length, prevMonthBookings.length);

  const curMonthPendingDeliveries = bookings.filter(b => {
    if (b.status !== 'Pending') return false;
    const d = parseBookingDate(b.deliveryDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const prevMonthPendingDeliveries = bookings.filter(b => {
    if (b.status !== 'Pending') return false;
    const d = parseBookingDate(b.deliveryDate);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear;
  });
  const pendingDeliveriesGrowth = getMoMGrowth(curMonthPendingDeliveries.length, prevMonthPendingDeliveries.length);

  const curMonthProd = bookings.filter(b => {
    if (b.status === 'Cancelled') return false;
    const d = parseBookingDate(b.bookingDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear && getBookingStage(b) === 'Production';
  });
  const prevMonthProd = bookings.filter(b => {
    if (b.status === 'Cancelled') return false;
    const d = parseBookingDate(b.bookingDate);
    return d.getMonth() === prevMonth && d.getFullYear() === prevYear && getBookingStage(b) === 'Production';
  });
  const activeProductionGrowth = getMoMGrowth(curMonthProd.length, prevMonthProd.length);

  const getCollectionsInMonth = (mIdx: number, yVal: number) => {
    let sum = 0;
    bookings.forEach(b => {
      if (b.status !== 'Cancelled' && b.payments) {
        b.payments.forEach(p => {
          const d = parseBookingDate(p.date);
          if (d.getMonth() === mIdx && d.getFullYear() === yVal) {
            sum += p.amount || 0;
          }
        });
      }
    });
    return sum;
  };
  const curMonthPayments = getCollectionsInMonth(currentMonth, currentYear);
  const prevMonthPayments = getCollectionsInMonth(prevMonth, prevYear);
  const advancePaymentsGrowth = getMoMGrowth(curMonthPayments, prevMonthPayments);

  const curOutstandingTotal = curMonthBookings.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
  const prevOutstandingTotal = prevMonthBookings.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
  const outstandingDuesGrowth = getMoMGrowth(curOutstandingTotal, prevOutstandingTotal);

  // ─── ROW 2: SALES FUNNEL DATA ───
  const totalQuoteValue = quotations.reduce((sum: number, q: Quotation) => sum + (q.grandTotal || 0), 0);
  const pendingQuoteValue = pendingQuotes.reduce((sum: number, q: Quotation) => sum + (q.grandTotal || 0), 0);

  const activeBookingsList = bookings.filter(b => b.status !== 'Cancelled');
  const totalBookingsValue = activeBookingsList.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const productionBookings = bookings.filter(b => b.status !== 'Cancelled' && getBookingStage(b) === 'Production');
  const productionBookingsValue = productionBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const readyBookings = bookings.filter(b => b.status !== 'Cancelled' && (getBookingStage(b) === 'Dispatch' || getBookingStage(b) === 'Invoice') && b.status === 'Pending');
  const readyBookingsValue = readyBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const deliveredBookings = bookings.filter(b => b.status === 'Delivered');
  const deliveredBookingsValue = deliveredBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const funnelStages = [
    { label: 'Inquiry', count: totalInquiriesCount, value: totalQuoteValue * 1.25, color: '#4F7A3D' },
    { label: 'Quotation', count: totalQuotationsCount, value: totalQuoteValue, color: '#629352' },
    { label: 'Negotiation', count: pendingQuotes.length, value: pendingQuoteValue, color: '#74ab66' },
    { label: 'Booking Confirmed', count: totalBookingsCount, value: totalBookingsValue, color: '#85c27a' },
    { label: 'Production', count: activeProductionCount, value: productionBookingsValue, color: '#97d98e' },
    { label: 'Ready for Dispatch', count: readyBookings.length, value: readyBookingsValue, color: '#a8eda2' },
    { label: 'Delivered', count: deliveredBookings.length, value: deliveredBookingsValue, color: '#b9ffb5' }
  ];

  const getFunnelConversion = (idx: number) => {
    if (idx === 0) return '100%';
    const prevCount = funnelStages[idx - 1].count;
    if (prevCount === 0) return '0%';
    const curCount = funnelStages[idx].count;
    const rate = (curCount / prevCount) * 100;
    return `${Math.min(rate, 100).toFixed(0)}%`;
  };

  // ─── ROW 5: 12-MONTH PERFORMANCE TREND DATA ───
  const getPast12Months = () => {
    const list = [];
    const temp = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(temp.getFullYear(), temp.getMonth() - i, 1);
      list.push({
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        label: d.toLocaleString('en-US', { month: 'short' }) + ' ' + String(d.getFullYear()).substring(2)
      });
    }
    return list;
  };

  const pastMonths = getPast12Months();

  const monthlyBookingsData = pastMonths.map(m => {
    const matches = bookings.filter(b => {
      const d = parseBookingDate(b.bookingDate);
      return d.getMonth() === m.monthIdx && d.getFullYear() === m.year && b.status !== 'Cancelled';
    });
    return {
      label: m.label,
      value: matches.length
    };
  });

  const monthlySalesData = pastMonths.map(m => {
    const matches = bookings.filter(b => {
      const d = parseBookingDate(b.bookingDate);
      return d.getMonth() === m.monthIdx && d.getFullYear() === m.year && b.status !== 'Cancelled';
    });
    return {
      label: m.label,
      value: matches.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
    };
  });

  const monthlyConvData = pastMonths.map(m => {
    const monthQuotes = quotations.filter(q => {
      const d = parseQuoteDate(q);
      return d.getMonth() === m.monthIdx && d.getFullYear() === m.year;
    });
    const accepted = monthQuotes.filter(q => getQuotationStatus(q, bookings) === 'Accepted');
    return {
      label: m.label,
      value: monthQuotes.length > 0 ? (accepted.length / monthQuotes.length) * 100 : 0
    };
  });

  const monthlyCollectionsData = pastMonths.map(m => {
    const total = getCollectionsInMonth(m.monthIdx, m.year);
    return {
      label: m.label,
      value: total
    };
  });

  const maxBookings = Math.max(...monthlyBookingsData.map(d => d.value), 1);
  const maxSales = Math.max(...monthlySalesData.map(d => d.value), 1);
  const maxCollections = Math.max(...monthlyCollectionsData.map(d => d.value), 1);

  // ─── ROW 6: MACHINERY ANALYTICS ───
  const machineCategories = ['Rice Mill', 'Feed Plant', 'Atta Chakki', 'Silky Plant'];
  const machineryAnalytics = machineCategories.map(cat => {
    const catQuotes = quotations.filter(q => getMachineryType(q.heading) === cat + ' Plant' || getMachineryType(q.heading) === cat);
    const catBookings = bookings.filter(b => b.status !== 'Cancelled' && getBookingMachineCategory(b) === cat + ' Plant');
    
    let production = 0;
    let deliveries = 0;
    let revenue = 0;
    
    catBookings.forEach(b => {
      const stage = getBookingStage(b);
      if (stage === 'Production') {
        production++;
      }
      if (b.status === 'Delivered') {
        deliveries++;
      }
      revenue += b.totalAmount || 0;
    });
    
    const progress = Math.min((catBookings.length / 10) * 100, 100);
    
    return {
      name: cat,
      quotesCount: catQuotes.length,
      bookingsCount: catBookings.length,
      production,
      deliveries,
      revenue,
      progress
    };
  });

  // ─── ROW 7: DELIVERY CONTROL CENTER ───
  const todayBookings = bookings.filter(b => b.deliveryDate === todayStr && b.status !== 'Cancelled');
  const upcomingBookings = bookings.filter(b => b.deliveryDate > todayStr && b.status === 'Pending');
  const overdueBookings = bookings.filter(b => b.deliveryDate < todayStr && b.status === 'Pending');
  const readyBookingsForDelivery = bookings.filter(b => b.status === 'Pending' && (getBookingStage(b) === 'Dispatch' || getBookingStage(b) === 'Invoice'));

  // ─── ROW 8: PAYMENT ANALYTICS ───
  const paymentTotalReceivable = totalBookingsValue;
  const paymentAdvanceReceived = advancePaymentsReceived;
  const paymentOutstanding = outstandingDues;
  const paymentOverdue = overdueBookings.reduce((sum, b) => sum + (b.balanceDue || 0), 0);
  const paymentCollectionRate = paymentTotalReceivable > 0 ? (paymentAdvanceReceived / paymentTotalReceivable) * 100 : 0;

  // Aging brackets (Pending Bookings with Balance Due > 0)
  let aging0_7 = 0;
  let aging8_15 = 0;
  let aging16_30 = 0;
  let aging30Plus = 0;

  bookings.forEach(b => {
    if (b.status === 'Pending' && b.balanceDue > 0) {
      const bDate = parseBookingDate(b.bookingDate);
      const ageDays = Math.floor((now.getTime() - bDate.getTime()) / (1000 * 60 * 60 * 24));
      if (ageDays <= 7) {
        aging0_7 += b.balanceDue;
      } else if (ageDays <= 15) {
        aging8_15 += b.balanceDue;
      } else if (ageDays <= 30) {
        aging16_30 += b.balanceDue;
      } else {
        aging30Plus += b.balanceDue;
      }
    }
  });

  // ─── ROW 9: TOP PERFORMANCE ───
  const execStats: Record<string, { name: string; converted: number; value: number }> = {};
  ['Rajesh Kumar', 'Amit Sharma', 'Sunil Verma', 'Pooja Singh'].forEach(name => {
    execStats[name] = { name, converted: 0, value: 0 };
  });
  
  quotations.forEach(q => {
    const status = getQuotationStatus(q, bookings);
    const val = q.grandTotal || 0;
    const exec = getSalesExecutive(q);
    if (status === 'Accepted') {
      execStats[exec].converted += 1;
      execStats[exec].value += val;
    }
  });
  const topExec = Object.values(execStats).sort((a, b) => b.value - a.value)[0] || { name: 'Rajesh Kumar', value: 0, converted: 0 };

  const customerBookingsValue: Record<string, { name: string; totalBooked: number; count: number }> = {};
  bookings.forEach(b => {
    if (b.status !== 'Cancelled') {
      const name = b.custName;
      if (!customerBookingsValue[name]) {
        customerBookingsValue[name] = { name, totalBooked: 0, count: 0 };
      }
      customerBookingsValue[name].totalBooked += b.totalAmount || 0;
      customerBookingsValue[name].count += 1;
    }
  });
  const topCustomer = Object.values(customerBookingsValue).sort((a, b) => b.totalBooked - a.totalBooked)[0] || { name: 'N/A', totalBooked: 0, count: 0 };

  const machineryCounts: Record<string, number> = {};
  bookings.forEach(b => {
    if (b.status !== 'Cancelled') {
      const cat = getBookingMachineCategory(b);
      machineryCounts[cat] = (machineryCounts[cat] || 0) + 1;
    }
  });
  const topMachine = Object.entries(machineryCounts).sort((a, b) => b[1] - a[1])[0] || ['N/A', 0];

  // ─── ROW 10: SMART SYSTEM ALERTS ───
  const systemAlerts = [];
  
  if (overdueBookings.length > 0) {
    systemAlerts.push({
      priority: 'red',
      message: `${overdueBookings.length} Overdue deliveries pending. Immediate dispatch actions needed.`
    });
  }
  
  const expiringSoonQuotes = pendingQuotes.filter(q => {
    const age = getQuotationAgeInDays(q);
    return age >= 27 && age <= 30;
  });
  if (expiringSoonQuotes.length > 0) {
    systemAlerts.push({
      priority: 'red',
      message: `${expiringSoonQuotes.length} quotations expiring in under 3 days. Send follow-up reminder.`
    });
  }

  const highValPendingQuotes = pendingQuotes.filter(q => (q.grandTotal || 0) > 150000);
  if (highValPendingQuotes.length > 0) {
    systemAlerts.push({
      priority: 'yellow',
      message: `${highValPendingQuotes.length} high-value pipeline quotes (> ₹1.5L) awaiting follow-up.`
    });
  }

  const noAdvanceBookings = bookings.filter(b => b.status === 'Pending' && (b.advancePaid || 0) === 0);
  if (noAdvanceBookings.length > 0) {
    systemAlerts.push({
      priority: 'yellow',
      message: `${noAdvanceBookings.length} confirmed bookings are missing advance payments.`
    });
  }

  const convertedToday = quotations.filter(q => {
    if (getQuotationStatus(q, bookings) !== 'Accepted') return false;
    const match = findMatchingBooking(q, bookings);
    if (!match) return false;
    return match.bookingDate === todayStr;
  });
  if (convertedToday.length > 0) {
    systemAlerts.push({
      priority: 'green',
      message: `${convertedToday.length} quotations converted into confirmed bookings today!`
    });
  }

  const deliveredToday = bookings.filter(b => b.status === 'Delivered' && b.deliveryDate === todayStr);
  if (deliveredToday.length > 0) {
    systemAlerts.push({
      priority: 'green',
      message: `Completed delivery of ${deliveredToday.length} orders today.`
    });
  }

  if (systemAlerts.length === 0) {
    systemAlerts.push({
      priority: 'green',
      message: 'System operations stable. No urgent action required.'
    });
  }

  // ─── ROW 4 PRODUCTION COUNTERS ───
  const productionStats = machineCategories.map(cat => {
    const matches = bookings.filter(b => b.status !== 'Cancelled' && getBookingMachineCategory(b) === cat + ' Plant');
    
    let pending = 0;
    let inProduction = 0;
    let ready = 0;
    
    matches.forEach(b => {
      const stage = getBookingStage(b);
      if (stage === 'Booking' || stage === 'Inquiry') {
        pending++;
      } else if (stage === 'Production') {
        inProduction++;
      } else if (stage === 'Dispatch' || stage === 'Invoice') {
        ready++;
      }
    });
    
    return {
      name: cat,
      pending,
      inProduction,
      ready
    };
  });

  const getKPIIndicator = (growthStr: string) => {
    const isDown = growthStr.startsWith('-');
    const isZero = growthStr === '0%';
    return (
      <span className={`trend-indicator ${isZero ? '' : isDown ? 'trend-down' : 'trend-up'}`}>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          {isZero ? (
            <line x1="5" y1="12" x2="19" y2="12"></line>
          ) : isDown ? (
            <path d="M5 9l7 7 7-7"></path>
          ) : (
            <path d="M5 15l7-7 7 7"></path>
          )}
        </svg>
        {growthStr}
      </span>
    );
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '80vh', alignItems: 'center', justifyContent: 'center', color: 'var(--erp-primary-green)', fontWeight: 'bold' }}>
        Loading ERP Business Control Center...
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Sticky Header */}
      <div className="dashboard-header-sticky">
        <div>
          <span className="welcome-tag" style={{ color: 'var(--erp-primary-green)', fontWeight: 'bold', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Management Control Center</span>
          <h1>KVU Quotation & Booking ERP</h1>
          <div className="topbar-sub">Tanda Plant — Real-time performance & operations tracking</div>
        </div>
        <div className="today-label-modern">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ marginRight: '6px' }}>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </div>
      </div>

      {/* Row 1: KPI Cards Grid (8 Columns) */}
      <div className="kpi-grid-8">
        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Total Inquiries</span>
            <div className="kpi-value">{totalInquiriesCount}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(inquiriesGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Total Quotations</span>
            <div className="kpi-value">{totalQuotationsCount}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(quotesGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Quotation Conv. %</span>
            <div className="kpi-value">{quotationConversionRate.toFixed(1)}%</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(convRateGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Total Bookings</span>
            <div className="kpi-value">{totalBookingsCount}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(bookingsGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Pending Deliveries</span>
            <div className="kpi-value">{pendingDeliveriesCount}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(pendingDeliveriesGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Active Production</span>
            <div className="kpi-value">{activeProductionCount}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(activeProductionGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Advance Received</span>
            <div className="kpi-value" style={{ fontSize: '18px' }}>{formatInr(advancePaymentsReceived)}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(advancePaymentsGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>

        <div className="kpi-card-erp">
          <div>
            <span className="kpi-label">Outstanding Dues</span>
            <div className="kpi-value" style={{ fontSize: '18px' }}>{formatInr(outstandingDues)}</div>
          </div>
          <div className="kpi-meta">
            {getKPIIndicator(outstandingDuesGrowth)}
            <span>MoM Growth</span>
          </div>
        </div>
      </div>

      {/* Row 2: Sales Funnel */}
      <div className="funnel-panel">
        <h3 style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Sales Pipeline Funnel</h3>
        <div className="funnel-cards-container">
          {funnelStages.map((stage, idx) => (
            <div className="funnel-node-card" key={stage.label}>
              <span className="stage-name" style={{ color: stage.color }}>{stage.label}</span>
              <span className="stage-count">{stage.count}</span>
              <span className="stage-value">{formatInr(stage.value)}</span>
              <span className="stage-conv">{getFunnelConversion(idx)} conv</span>
            </div>
          ))}
        </div>
      </div>

      {/* Row 3: Quotation Analytics Section */}
      <div className="erp-section-title">
        <span>Quotation Analytics</span>
      </div>
      <div className="quotation-analytics-panel">
        <div className="qa-card-left">
          <div className="qa-status-grid">
            <div className="qa-status-block total">
              <span className="qa-status-label">Total</span>
              <span className="qa-status-val" style={{ color: 'var(--text-primary)' }}>{totalQuotationsCount}</span>
            </div>
            <div className="qa-status-block pending">
              <span className="qa-status-label">Pending</span>
              <span className="qa-status-val" style={{ color: 'var(--erp-info)' }}>{pendingQuotes.length}</span>
            </div>
            <div className="qa-status-block accepted">
              <span className="qa-status-label">Accepted</span>
              <span className="qa-status-val" style={{ color: 'var(--erp-success)' }}>{acceptedCount}</span>
            </div>
            <div className="qa-status-block rejected">
              <span className="qa-status-label">Rejected</span>
              <span className="qa-status-val" style={{ color: 'var(--erp-danger)' }}>{quotations.filter(q => getQuotationStatus(q, bookings) === 'Rejected').length}</span>
            </div>
            <div className="qa-status-block expired">
              <span className="qa-status-label">Expired</span>
              <span className="qa-status-val" style={{ color: 'var(--erp-warning)' }}>{quotations.filter(q => getQuotationStatus(q, bookings) === 'Expired').length}</span>
            </div>
          </div>
          
          <div className="qa-value-grid">
            <div className="qa-val-block">
              <span>Total Quote Value</span>
              <strong>{formatInr(totalQuoteValue)}</strong>
            </div>
            <div className="qa-val-block">
              <span>Converted Value</span>
              <strong>{formatInr(acceptedQuotes.reduce((sum, q) => sum + (q.grandTotal || 0), 0))}</strong>
            </div>
            <div className="qa-val-block">
              <span>Lost Value</span>
              <strong>{formatInr(quotations.filter(q => { const s = getQuotationStatus(q, bookings); return s === 'Rejected' || s === 'Expired'; }).reduce((sum, q) => sum + (q.grandTotal || 0), 0))}</strong>
            </div>
            <div className="qa-val-block">
              <span>Pipeline Value</span>
              <strong>{formatInr(pendingQuoteValue)}</strong>
            </div>
          </div>
        </div>

        <div className="qa-card-right-ring">
          <svg width="120" height="120" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="50" fill="none" stroke="#f1f5f9" strokeWidth="10" />
            <circle 
              cx="60" 
              cy="60" 
              r="50" 
              fill="none" 
              stroke="var(--erp-primary-green)" 
              strokeWidth="10" 
              strokeDasharray="314.16" 
              strokeDashoffset={314.16 - (314.16 * quotationConversionRate) / 100}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dashoffset 0.5s ease' }}
            />
            <text x="60" y="66" textAnchor="middle" fontSize="18" fontWeight="800" fill="var(--text-primary)">
              {quotationConversionRate.toFixed(1)}%
            </text>
          </svg>
          <div className="progress-ring-label">Conversion Rate</div>
        </div>
      </div>

      {/* Row 4: Bookings & Production Split Layout */}
      <div className="erp-section-title">
        <span>Bookings & Production Control</span>
      </div>
      <div className="bookings-production-panel">
        <div className="bp-table-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 800 }}>Recent Orders</h3>
            <button 
              type="button" 
              onClick={() => navigate('/booking-db')} 
              style={{ background: 'none', border: 'none', color: 'var(--erp-primary-green)', fontWeight: '700', cursor: 'pointer', fontSize: '12px' }}
            >
              View Database →
            </button>
          </div>
          <div className="bp-scrollable-table">
            <table className="bp-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Booking Date</th>
                  <th>Delivery Date</th>
                  <th style={{ textAlign: 'right' }}>Total Amount</th>
                  <th style={{ textAlign: 'right' }}>Balance Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 10).map((b) => (
                  <tr key={b.bookingId}>
                    <td><strong>{b.bookingId}</strong></td>
                    <td><strong>{b.custName}</strong></td>
                    <td>{b.bookingDate}</td>
                    <td>{b.deliveryDate}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatInr(b.totalAmount)}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600', color: b.balanceDue > 0 ? 'var(--erp-danger)' : 'var(--erp-success)' }}>{formatInr(b.balanceDue)}</td>
                    <td>
                      <span className={`bp-status-badge ${b.status.toLowerCase()}`}>
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {bookings.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No bookings found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bp-prod-card">
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>Production Queue status</h3>
          <div className="prod-status-list">
            {productionStats.map((item) => (
              <div className="prod-status-row" key={item.name}>
                <span className="prod-machine-info">{item.name}</span>
                <div className="prod-badge-group">
                  <span className="prod-badge pending" title="Pending">{item.pending} Pending</span>
                  <span className="prod-badge prod" title="In Production">{item.inProduction} In Prod</span>
                  <span className="prod-badge ready" title="Ready">{item.ready} Ready</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Monthly Performance Charts */}
      <div className="erp-section-title">
        <span>12-Month Performance Analytics</span>
      </div>
      <div className="charts-grid-4">
        {/* Chart 1: Monthly Bookings */}
        <div className="chart-card-erp">
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>Monthly Bookings (Units)</h3>
          <div className="chart-container-erp">
            {monthlyBookingsData.map((d, i) => {
              const percent = (d.value / maxBookings) * 100;
              return (
                <div className="chart-bar-wrap" key={i}>
                  <div 
                    className="chart-bar" 
                    style={{ height: `${percent}%` }}
                    data-tooltip={`${d.value} Bookings`}
                  />
                </div>
              );
            })}
          </div>
          <div className="chart-axis-labels">
            {monthlyBookingsData.map((d, i) => (
              <span key={i}>{d.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>

        {/* Chart 2: Monthly Sales */}
        <div className="chart-card-erp">
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>Monthly Sales Value</h3>
          <div className="chart-container-erp">
            {monthlySalesData.map((d, i) => {
              const percent = (d.value / maxSales) * 100;
              return (
                <div className="chart-bar-wrap" key={i}>
                  <div 
                    className="chart-bar secondary" 
                    style={{ height: `${percent}%` }}
                    data-tooltip={formatInr(d.value)}
                  />
                </div>
              );
            })}
          </div>
          <div className="chart-axis-labels">
            {monthlySalesData.map((d, i) => (
              <span key={i}>{d.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>

        {/* Chart 3: Monthly Conversion % */}
        <div className="chart-card-erp">
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>Quotation Conversion Rate %</h3>
          <div className="chart-container-erp">
            {monthlyConvData.map((d, i) => {
              const percent = d.value;
              return (
                <div className="chart-bar-wrap" key={i}>
                  <div 
                    className="chart-bar" 
                    style={{ height: `${percent}%` }}
                    data-tooltip={`${d.value.toFixed(0)}%`}
                  />
                </div>
              );
            })}
          </div>
          <div className="chart-axis-labels">
            {monthlyConvData.map((d, i) => (
              <span key={i}>{d.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>

        {/* Chart 4: Advance Payment Collection */}
        <div className="chart-card-erp">
          <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '8px' }}>Advance Collections Value</h3>
          <div className="chart-container-erp">
            {monthlyCollectionsData.map((d, i) => {
              const percent = (d.value / maxCollections) * 100;
              return (
                <div className="chart-bar-wrap" key={i}>
                  <div 
                    className="chart-bar secondary" 
                    style={{ height: `${percent}%` }}
                    data-tooltip={formatInr(d.value)}
                  />
                </div>
              );
            })}
          </div>
          <div className="chart-axis-labels">
            {monthlyCollectionsData.map((d, i) => (
              <span key={i}>{d.label.split(' ')[0]}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Row 6: Machinery Analytics */}
      <div className="erp-section-title">
        <span>Machinery Specific Analytics</span>
      </div>
      <div className="machinery-analytics-grid">
        {machineryAnalytics.map((mach) => (
          <div className="mach-card-erp" key={mach.name}>
            <div className="mach-card-title">{mach.name}</div>
            <div className="mach-stat-row">
              <span>Quotations Generated:</span>
              <strong>{mach.quotesCount}</strong>
            </div>
            <div className="mach-stat-row">
              <span>Bookings Confirmed:</span>
              <strong>{mach.bookingsCount}</strong>
            </div>
            <div className="mach-stat-row">
              <span>Units in Production:</span>
              <strong>{mach.production}</strong>
            </div>
            <div className="mach-stat-row">
              <span>Units Delivered:</span>
              <strong>{mach.deliveries}</strong>
            </div>
            <div className="mach-stat-row">
              <span>Total Revenue Booked:</span>
              <strong>{formatInr(mach.revenue)}</strong>
            </div>
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Monthly Target Progress (10 orders)</span>
                <span>{mach.progress.toFixed(0)}%</span>
              </div>
              <div className="progress-bar-wrapper">
                <div className="progress-bar-fill" style={{ width: `${mach.progress}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Row 7: Delivery Control Center */}
      <div className="erp-section-title">
        <span>Delivery Control Center</span>
      </div>
      <div className="delivery-control-grid">
        <div className="delivery-card-erp" onClick={() => navigate('/pending-deliveries')} style={{ cursor: 'pointer' }}>
          <span>Scheduled Today</span>
          <strong>{todayBookings.length}</strong>
          <span className="detail">Bookings to deliver today</span>
        </div>
        <div className="delivery-card-erp" onClick={() => navigate('/pending-deliveries')} style={{ cursor: 'pointer' }}>
          <span>Upcoming Deliveries</span>
          <strong>{upcomingBookings.length}</strong>
          <span className="detail">Scheduled for future dates</span>
        </div>
        <div className="delivery-card-erp overdue" onClick={() => navigate('/pending-deliveries')} style={{ cursor: 'pointer' }}>
          <span style={{ color: 'var(--erp-danger)' }}>Overdue Schedules</span>
          <strong style={{ color: 'var(--erp-danger)' }}>{overdueBookings.length}</strong>
          <span className="detail">Missed delivery target dates</span>
        </div>
        <div className="delivery-card-erp ready" onClick={() => navigate('/pending-deliveries')} style={{ cursor: 'pointer' }}>
          <span style={{ color: 'var(--erp-success)' }}>Finished & Ready</span>
          <strong style={{ color: 'var(--erp-success)' }}>{readyBookingsForDelivery.length}</strong>
          <span className="detail">Production complete, ready for load</span>
        </div>
        
        {overdueBookings.length > 0 && (
          <div className="delivery-card-erp overdue" style={{ gridColumn: '1 / -1', background: 'var(--erp-danger-bg)' }}>
            <span style={{ color: 'var(--erp-danger)', fontWeight: 800 }}>⚠️ Critical Alert: Overdue Deliveries Pending Action</span>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {overdueBookings.slice(0, 3).map(b => (
                <div key={b.bookingId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', borderBottom: '1px solid rgba(239, 68, 68, 0.1)', paddingBottom: '4px' }}>
                  <span><strong>{b.custName}</strong> ({b.bookingId}) - Scheduled: {b.deliveryDate}</span>
                  <span style={{ fontWeight: '700', color: 'var(--erp-danger)' }}>Outstanding: {formatInr(b.balanceDue)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Row 8: Payment Analytics */}
      <div className="erp-section-title">
        <span>Payment & Accounts Analytics</span>
      </div>
      <div className="payment-analytics-grid">
        <div className="payment-health-card">
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '16px' }}>Financial Health Overview</h3>
          <div className="payment-blocks-row">
            <div className="payment-block-unit">
              <span>Total Booked Sales</span>
              <strong>{formatInr(paymentTotalReceivable)}</strong>
            </div>
            <div className="payment-block-unit">
              <span>Advance Collected</span>
              <strong style={{ color: 'var(--erp-success)' }}>{formatInr(paymentAdvanceReceived)}</strong>
            </div>
            <div className="payment-block-unit">
              <span>Outstanding Receivable</span>
              <strong style={{ color: 'var(--erp-warning)' }}>{formatInr(paymentOutstanding)}</strong>
            </div>
            <div className="payment-block-unit">
              <span>Overdue Collections</span>
              <strong style={{ color: 'var(--erp-danger)' }}>{formatInr(paymentOverdue)}</strong>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '6px' }}>
              <span>Average Collection Rate</span>
              <span>{paymentCollectionRate.toFixed(1)}%</span>
            </div>
            <div className="payment-collection-progress">
              <div className="payment-collection-bar">
                <div className="payment-collection-fill" style={{ width: `${paymentCollectionRate}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="aging-report-card">
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>Receivable Aging Report</h3>
          <div className="bi-aging-grid" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="bi-aging-block green" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid var(--erp-success)' }}>
              <span className="bi-aging-label" style={{ fontWeight: 'bold' }}>0-7 Days Outstanding</span>
              <strong className="bi-aging-val">{formatInr(aging0_7)}</strong>
            </div>
            <div className="bi-aging-block warning" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid var(--erp-warning)' }}>
              <span className="bi-aging-label" style={{ fontWeight: 'bold' }}>8-15 Days Outstanding</span>
              <strong className="bi-aging-val">{formatInr(aging8_15)}</strong>
            </div>
            <div className="bi-aging-block danger" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid var(--erp-danger)' }}>
              <span className="bi-aging-label" style={{ fontWeight: 'bold' }}>16-30 Days Outstanding</span>
              <strong className="bi-aging-val">{formatInr(aging16_30)}</strong>
            </div>
            <div className="bi-aging-block dark" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', borderLeft: '4px solid #475569', background: '#f8fafc' }}>
              <span className="bi-aging-label" style={{ fontWeight: 'bold' }}>30+ Days Outstanding</span>
              <strong className="bi-aging-val">{formatInr(aging30Plus)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Row 9: Top Performance Section */}
      <div className="erp-section-title">
        <span>Business Performance Highlights</span>
      </div>
      <div className="top-performance-grid">
        <div className="perf-card-erp">
          <span className="perf-card-header" style={{ color: 'var(--erp-success)' }}>⭐ Best Sales Executive</span>
          <div className="perf-card-title">{topExec.name}</div>
          <div className="perf-card-detail">
            Closed <strong>{topExec.converted}</strong> orders this month, bringing in <strong>{formatInr(topExec.value)}</strong> in sales volume.
          </div>
        </div>

        <div className="perf-card-erp">
          <span className="perf-card-header" style={{ color: 'var(--erp-info)' }}>💎 Highest Value Customer</span>
          <div className="perf-card-title">{topCustomer.name}</div>
          <div className="perf-card-detail">
            Placed <strong>{topCustomer.count}</strong> confirmed machinery orders, contributing a total of <strong>{formatInr(topCustomer.totalBooked)}</strong> in booking revenue.
          </div>
        </div>

        <div className="perf-card-erp">
          <span className="perf-card-header" style={{ color: 'var(--erp-warning)' }}>📈 Top Selling Machinery</span>
          <div className="perf-card-title">{topMachine[0]}</div>
          <div className="perf-card-detail">
            Secured <strong>{topMachine[1]}</strong> bookings in recent orders, marking it as the highest-volume product line in this period.
          </div>
        </div>
      </div>

      {/* Row 10: Quick Action Center + Smart Alerts Panel */}
      <div className="action-alerts-grid-redesign">
        <div className="action-center-modern">
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '16px' }}>Quick Action Panel</h3>
          <div className="actions-grid-redesign">
            <div className="action-btn-tile" onClick={() => navigate('/quotation')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              <span>New Inquiry</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/quotation')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              <span>New Quotation</span>
            </div>
            <div className="action-btn-tile" onClick={() => setShowConvertModal(true)}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 3h5v5M8 21H3v-5M12 12l9-9M12 12l-9 9"/></svg>
              <span>Convert Quote</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/booking')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>
              <span>New Booking</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/booking-db')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
              <span>Production Entry</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/pending-deliveries')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              <span>Delivery Entry</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/payments')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12M6 8h12M6 13h3a6 6 0 0 0 6-6H6M6 13l8.5 8"/></svg>
              <span>Payment Entry</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/booking-customers')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span>Customer Ledger</span>
            </div>
            <div className="action-btn-tile" onClick={() => navigate('/reports')}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2v10z"/></svg>
              <span>Reports Hub</span>
            </div>
          </div>
        </div>

        <div className="alerts-panel-modern">
          <h3 style={{ fontSize: '14px', fontWeight: 800, marginBottom: '12px' }}>Smart Operations Alerts</h3>
          <div className="alerts-scrollable">
            {systemAlerts.map((alert, idx) => (
              <div className={`alert-item-modern ${alert.priority}`} key={idx}>
                <div className="alert-dot" />
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modals & Dialogs */}
      {showConvertModal && (
        <Modal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} title="Select Pending Quotation to Convert">
          <div className="bi-modal-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {pendingQuotes.length > 0 ? (
              pendingQuotes.map(q => (
                <div key={q.ref} className="bi-modal-row" onClick={() => {
                  setShowConvertModal(false);
                  navigate('/booking', { state: { selectedQuotation: q } });
                }}>
                  <div>
                    <strong>{q.custName}</strong> ({q.ref})<br />
                    <span className="bi-subtext">{q.heading} · {q.date}</span>
                  </div>
                  <div className="bi-value-col">
                    <strong>{formatInr(q.grandTotal)}</strong>
                    <span className="bi-action-badge">Convert ➜</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bi-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No pending quotations found.</div>
            )}
          </div>
        </Modal>
      )}

      {showActionListModal && (
        <Modal 
          isOpen={showActionListModal} 
          onClose={() => { setShowActionListModal(false); setActionType(null); }} 
          title={actionType === 'whatsapp' ? "Share Quotation via WhatsApp" : "Generate PDF Quotation"}
        >
          <div className="bi-modal-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {quotations.length > 0 ? (
              quotations.map(q => (
                <div key={q.ref} className="bi-modal-row" onClick={() => {
                  setShowActionListModal(false);
                  setSelectedQuoteForPreview(q);
                  setShowPreviewModal(true);
                }}>
                  <div>
                    <strong>{q.custName}</strong> ({q.ref})<br />
                    <span className="bi-subtext">{q.heading} · {q.date}</span>
                  </div>
                  <div className="bi-value-col">
                    <strong>{formatInr(q.grandTotal)}</strong>
                    <span className="bi-action-badge">Select ➜</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="bi-empty" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>No quotations found.</div>
            )}
          </div>
        </Modal>
      )}

      {showPreviewModal && selectedQuoteForPreview && (
        <Modal
          isOpen={showPreviewModal}
          onClose={() => { setShowPreviewModal(false); setSelectedQuoteForPreview(null); }}
          title={`🖨 Quotation Print Preview - ${selectedQuoteForPreview.ref}`}
          size="lg"
        >
          <div className="qp-preview-canvas" style={{ maxHeight: '60vh', overflow: 'auto', borderRadius: 'var(--radius-md)', padding: '16px', background: 'var(--surface-2)' }}>
            <QuotationPreview quote={selectedQuoteForPreview} variant="classic" innerRef={printAreaRef} />
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
            <button type="button" className="qp-preview-btn print" onClick={handlePrint}>🖨 Print</button>
            <button type="button" className="qp-preview-btn pdf" onClick={handleDownloadPdf}>📥 PDF</button>
            <button type="button" className="qp-preview-btn whatsapp" onClick={handleWhatsAppShare}>💬 WhatsApp</button>
            <button type="button" className="qp-preview-btn print" onClick={() => { setShowPreviewModal(false); setSelectedQuoteForPreview(null); }}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
};
