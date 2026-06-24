import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CustomerRepository, type Customer } from '../repositories/CustomerRepository';
import { BookingRepository, type Booking, type BookingLineItem, type Payment, type AuditLog } from '../repositories/BookingRepository';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { getStatesList, getDistrictsForState } from '../utils/indiaDistricts';
import { getFiscalYear } from '../utils/fiscalYear';
import { BookingThermalPreview } from '../components/BookingThermalPreview';
import { BookingTraditionalPreview } from '../components/BookingTraditionalPreview';
import { Modal } from '../components/Modal';
import { Button } from '../components/Button';
import { PDFService } from '../services/PDFService';
import { PrintService } from '../utils/PrintService';
import { useAuth } from '../contexts/AuthContext';
import '../styles/BookingsPage.css';

export const BookingsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Accordion step navigation state
  const [activeSection, setActiveSection] = useState<'customer' | 'machinery' | 'logistics' | 'pricing'>('customer');

  // Flag to suppress district auto-reset during edit booking load
  const suppressDistrictReset = useRef(false);

  // Reference for capturing print area
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Load customer database for autocompletion
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [originalBooking, setOriginalBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      const data = await CustomerRepository.getCustomers();
      setDbCustomers(data);
    };
    loadCustomers();
  }, []);

  // Form edit state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string>('');

  // 1. Customer Details Fields
  const [custGender, setCustGender] = useState<'male' | 'female'>('male');
  const [custName, setCustName] = useState('');
  const [relation, setRelation] = useState('S/O');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [post, setPost] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const list = await BookingRepository.getBookings();
        setExistingBookings(list || []);
      } catch (e) {
        console.error('Error fetching bookings:', e);
      }
    };
    fetchBookings();
  }, []);

  // Auto-complete suggestions for Customer
  const [custSearchQuery, setCustSearchQuery] = useState('');
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);

  // Inline search filtering for customers
  const filteredCustomers = dbCustomers.filter((c) => {
    const q = custSearchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.district || '').toLowerCase().includes(q)
    );
  });

  // States & Districts
  const statesList = getStatesList();
  const [districtsList, setDistrictsList] = useState<string[]>([]);
  useEffect(() => {
    const loadDistricts = async () => {
      if (state) {
        const list = await getDistrictsForState(state);
        setDistrictsList(list);
        // Only auto-reset district if not suppressed (e.g., during edit load)
        if (!suppressDistrictReset.current && list.length > 0 && !list.includes(district)) {
          setDistrict(list[0]);
        }
      }
    };
    loadDistricts();
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Booking Metadata
  const [sequence, setSequence] = useState('0001');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [deliveryDate, setDeliveryDate] = useState(() => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().substring(0, 10);
  });
  const [deliveryStatus, setDeliveryStatus] = useState<'Pending' | 'Delivered'>('Pending');

  const [recordedBy, setRecordedBy] = useState('Admin');

  // 4. Repeatable Payments (Advance Payments)
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [requiredAdvance, setRequiredAdvance] = useState('0');

  // Form states for adding a new transaction row
  const [payMethod, setPayMethod] = useState<'Cash' | 'UPI' | 'NEFT/RTGS' | 'Cheque'>('Cash');
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [payRefNo, setPayRefNo] = useState('');
  const [payBankName, setPayBankName] = useState('');
  const [payChequeDate, setPayChequeDate] = useState('');
  const [payRemarks, setPayRemarks] = useState('');

  // 5. Line Items Builder (managed by shared LineItemsEditor)
  const [items, setItems] = useState<BookingLineItem[]>([]);


  // Pricing adjustments
  const [additionalCharges, setAdditionalCharges] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [cyclone, setCyclone] = useState('No');
  const [jhanna, setJhanna] = useState('No');
  const [tractor, setTractor] = useState('');
  const [hp, setHp] = useState('');
  const [pullySize, setPullySize] = useState('');
  const [ptoShaft, setPtoShaft] = useState('');
  const [notes, setNotes] = useState('');

  // Preview Modal
  const [savedBookingData, setSavedBookingData] = useState<Booking | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [printType, setPrintType] = useState<'Thermal' | 'A4_Traditional'>('A4_Traditional');

  // Load Fiscal Year
  const fiscalYear = getFiscalYear();

  // Load initial sequence
  useEffect(() => {
    const stateData = location.state as { editBooking?: any } | null;
    if (stateData?.editBooking) return; // skip if editing
    
    const loadSeq = async () => {
      if (editingIndex === null) {
        const lastUsed = await BookingRepository.getSequence();
        setSequence(String(lastUsed + 1).padStart(4, '0'));
      }
    };
    loadSeq();
  }, [editingIndex, location]);

  // Handle Edit/Customer Preloading from location state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const stateData = location.state as {
      selectedCustomer?: Customer;
      editBooking?: { booking: Booking; index: number };
    } | null;

    if (stateData?.selectedCustomer) {
      const c = stateData.selectedCustomer;
      setCustName(c.name);
      setCustGender(c.gender as 'male' | 'female' || 'male');
      setFatherName(c.father || '');
      setAddress(c.address || '');
      setPost(c.post || '');
      setState(c.state || 'Uttar Pradesh');
      setDistrict(c.district || '');
      setPincode(c.pincode || '');
      setMobile(c.mobile || '');
      setAadhar(c.aadhar || '');
      
      // Clear location state
      window.history.replaceState({}, document.title);
    } else if (stateData?.editBooking) {
      const { booking, index } = stateData.editBooking;
      
      // Suppress district auto-reset while we load all edit fields
      suppressDistrictReset.current = true;

      setOriginalBooking(booking);
      setEditingIndex(index);
      setEditingBookingId(booking.bookingId);
      
      setCustName(booking.custName);
      setCustGender(booking.custGender);
      setRelation(booking.relation);
      setFatherName(booking.fatherName);
      setAddress(booking.address);
      setPost(booking.post);
      setState(booking.state);
      setDistrict(booking.district);
      setPincode(booking.pincode);
      setMobile(booking.mobile);
      setAadhar(booking.aadhar || '');

      setBookingDate(booking.bookingDate.substring(0, 10));
      setDeliveryDate(booking.deliveryDate);
      setDeliveryStatus(booking.status === 'Cancelled' ? 'Pending' : (booking.status as 'Pending' | 'Delivered'));

      setItems(booking.items || []);
      setAdditionalCharges(String(booking.additionalCharges || 0));
      setDiscount(String(booking.discount || 0));
      setCyclone(booking.cyclone || 'No');
      setJhanna(booking.jhanna || 'No');
      setTractor(booking.tractor || '');
      setHp(booking.hp || '');
      setPullySize(booking.pullySize || '');
      setPtoShaft(booking.ptoShaft || '');
      setNotes(booking.notes || '');
      setPaymentsList(booking.payments || []);
      setRequiredAdvance(String(booking.requiredAdvance || 0));

      const refParts = booking.bookingId.split('/');
      if (refParts.length >= 2) {
        setSequence(refParts[1]);
      }
      
      // Re-enable district auto-reset after a tick (async districts load will complete)
      setTimeout(() => { suppressDistrictReset.current = false; }, 500);

      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Auto-save form draft to localStorage
  useEffect(() => {
    if (editingIndex !== null) return; // Do not overwrite when editing an existing booking
    
    const draft = {
      custGender,
      custName,
      relation,
      fatherName,
      address,
      post,
      state,
      district,
      pincode,
      mobile,
      aadhar,
      bookingDate,
      deliveryDate,
      items,
      additionalCharges,
      discount,
      cyclone,
      jhanna,
      tractor,
      hp,
      pullySize,
      ptoShaft,
      notes,
      paymentsList,
      requiredAdvance,
    };
    
    const hasData = custName.trim() || fatherName.trim() || address.trim() || items.length > 0 || paymentsList.length > 0;
    if (hasData) {
      localStorage.setItem('kvu_booking_draft', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kvu_booking_draft');
    }
  }, [
    editingIndex, custGender, custName, relation, fatherName, address, post, state, district,
    pincode, mobile, aadhar, bookingDate, deliveryDate, items, additionalCharges, discount,
    cyclone, jhanna, tractor, hp, pullySize, ptoShaft, notes, paymentsList, requiredAdvance
  ]);

  // Load draft on mount
  useEffect(() => {
    const stateData = location.state as {
      selectedCustomer?: Customer;
      editBooking?: { booking: Booking; index: number };
    } | null;

    if (!stateData?.selectedCustomer && !stateData?.editBooking) {
      const saved = localStorage.getItem('kvu_booking_draft');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          suppressDistrictReset.current = true;
          if (draft.custName) setCustName(draft.custName);
          if (draft.custGender) setCustGender(draft.custGender);
          if (draft.relation) setRelation(draft.relation);
          if (draft.fatherName) setFatherName(draft.fatherName);
          if (draft.address) setAddress(draft.address);
          if (draft.post) setPost(draft.post);
          if (draft.state) setState(draft.state);
          if (draft.district) setDistrict(draft.district);
          if (draft.pincode) setPincode(draft.pincode);
          if (draft.mobile) setMobile(draft.mobile);
          if (draft.aadhar) setAadhar(draft.aadhar);
          if (draft.bookingDate) setBookingDate(draft.bookingDate);
          if (draft.deliveryDate) setDeliveryDate(draft.deliveryDate);
          if (Array.isArray(draft.items)) setItems(draft.items);
          if (draft.additionalCharges) setAdditionalCharges(draft.additionalCharges);
          if (draft.discount) setDiscount(draft.discount);
          if (draft.cyclone) setCyclone(draft.cyclone);
          if (draft.jhanna) setJhanna(draft.jhanna);
          if (draft.tractor) setTractor(draft.tractor);
          if (draft.hp) setHp(draft.hp);
          if (draft.pullySize) setPullySize(draft.pullySize);
          if (draft.ptoShaft) setPtoShaft(draft.ptoShaft);
          if (draft.notes) setNotes(draft.notes);
          if (Array.isArray(draft.paymentsList)) setPaymentsList(draft.paymentsList);
          if (draft.requiredAdvance) setRequiredAdvance(draft.requiredAdvance);
          
          setTimeout(() => { suppressDistrictReset.current = false; }, 600);
        } catch (e) {
          console.warn('Failed to parse booking draft:', e);
        }
      }
    }
  }, []);

  // Product presets for LineItemsEditor autocomplete
  const BOOKING_PRESETS = [
    { name: 'MINI RICE MILL TKCJ-8' },
    { name: 'MINI RICE MILL TKCJ-6' },
    { name: 'MINI RICE MILL TKC-8'  },
    { name: 'MINI RICE MILL TKC-6'  },
    { name: 'MINI RICE MILL NC-6'   },
    { name: 'MINI RICE MILL NC-8'   },
    { name: 'MINI RICE MILL NCJ-6'  },
    { name: 'MINI RICE MILL NCJ-8'  },
    { name: 'FEED MIXER-250'        },
    { name: 'FEED MIXER-500'        },
    { name: 'FEED MIXER-1000'       },
    { name: 'FEED GRINDER S-SCREEN' },
    { name: 'FEED GRINDER D-SCREEN' },
    { name: 'SCREW CONVEYOR 8x8'    },
    { name: 'SCREW CONVEYOR 8x11'   },
    { name: 'BUCKET ELEVATOR 23 ft' },
    { name: 'BUCKET ELEVATOR 16 ft' },
    { name: 'BATCH BIN-500'         },
    { name: 'BATCH BIN-1000'        },
    { name: 'ATTA CHAKKI'           },
    { name: 'OIL EXPELLER'          },
  ];

  // Item list is fully controlled by LineItemsEditor
  const handleSelectCustomer = (c: Customer) => {
    setCustName(c.name);
    setCustGender(c.gender as 'male' | 'female' || 'male');
    setFatherName(c.father || '');
    setAddress(c.address || '');
    setPost(c.post || '');
    setState(c.state || 'Uttar Pradesh');
    setDistrict(c.district || '');
    setPincode(c.pincode || '');
    setMobile(c.mobile || '');
    setAadhar(c.aadhar || '');
    setShowCustSuggestions(false);
  };

  // Financial Calculations
  const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
  const addChargesVal = parseFloat(additionalCharges) || 0;
  const discountVal = parseFloat(discount) || 0;
  const finalAmount = Math.max(0, itemsTotal + addChargesVal - discountVal);
  const advancePaidVal = paymentsList.reduce((sum, p) => sum + p.amount, 0);

  // Reset form helper
  const handleResetForm = (force = false) => {
    if (!force && !window.confirm('Are you sure you want to reset the booking form?')) return;

    setCustName('');
    setCustGender('male');
    setRelation('S/O');
    setFatherName('');
    setAddress('');
    setPost('');
    setState('Uttar Pradesh');
    setDistrict('');
    setPincode('');
    setMobile('');
    setAadhar('');
    setCustSearchQuery('');
    
    setBookingDate(new Date().toISOString().substring(0, 10));
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDeliveryDate(nextWeek.toISOString().substring(0, 10));
    setDeliveryStatus('Pending');

    setRecordedBy('Admin');

    setItems([]);
    setAdditionalCharges('0');
    setDiscount('0');
    setCyclone('No');
    setJhanna('No');
    setTractor('');
    setHp('');
    setPullySize('');
    setPtoShaft('');
    setNotes('');
    
    setPaymentsList([]);
    setRequiredAdvance('0');
    setPayMethod('Cash');
    setPayAmount('');
    setPayDate(new Date().toISOString().substring(0, 10));
    setPayRefNo('');
    setPayBankName('');
    setPayChequeDate('');
    setPayRemarks('');

    setEditingIndex(null);
    setEditingBookingId('');

    // Reload next sequence
    const loadNextSeq = async () => {
      const lastUsed = await BookingRepository.getSequence();
      setSequence(String(lastUsed + 1).padStart(4, '0'));
    };
    loadNextSeq();
  };

  // Reset sequence in DB helper
  const handleResetSequence = async () => {
    if (window.confirm(`Reset booking sequence to 0000?\nNext will start from KVUB/0001/${fiscalYear}`)) {
      await BookingRepository.resetSequence();
      setSequence('0001');
    }
  };

  // repeatable payment handlers
  const handleAddTransaction = () => {
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Enter a valid amount (> 0)!');
      return;
    }

    if (payMethod === 'UPI' && !payRefNo.trim()) {
      alert('UPI Transaction/Reference Number is required!');
      return;
    }
    if (payMethod === 'NEFT/RTGS') {
      if (!payBankName.trim()) { alert('Bank Name is required!'); return; }
      if (!payRefNo.trim()) { alert('Transaction/Reference Number/UTR is required!'); return; }
    }
    if (payMethod === 'Cheque') {
      if (!payBankName.trim()) { alert('Bank Name is required!'); return; }
      if (!payRefNo.trim()) { alert('Cheque Number is required!'); return; }
      if (!payChequeDate) { alert('Cheque Date is required!'); return; }
    }

    const newPay: Payment = {
      id: `pay_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date: payDate,
      method: payMethod,
      amount: amt,
      bankName: ['NEFT/RTGS', 'Cheque'].includes(payMethod) ? payBankName.trim() : undefined,
      transactionNo: ['UPI', 'NEFT/RTGS'].includes(payMethod) ? payRefNo.trim() : undefined,
      chequeNo: payMethod === 'Cheque' ? payRefNo.trim() : undefined,
      chequeDate: payMethod === 'Cheque' ? payChequeDate : undefined,
      remarks: payRemarks.trim() || undefined,
      enteredBy: recordedBy.trim() || 'Admin'
    };

    setPaymentsList([...paymentsList, newPay]);
    
    // Reset transaction form row inputs
    setPayAmount('');
    setPayRefNo('');
    setPayBankName('');
    setPayChequeDate('');
    setPayRemarks('');
  };

  const handleRemoveTransaction = (id: string) => {
    setPaymentsList(paymentsList.filter(p => p.id !== id));
  };

  // Save booking form
  const handleSaveBooking = async () => {
    if (!custName.trim()) return alert('Please enter customer name first!');
    if (mobile.trim().length !== 10) return alert('Mobile No. must be 10-digit!');
    if (!items.length) return alert('Please add at least one product!');
    if (!deliveryDate) return alert('Expected Delivery Date is required!');

    // 10-delivery daily limit check
    const deliveryCount = existingBookings.filter(b => 
      b.deliveryDate === deliveryDate && 
      b.status !== 'Cancelled' && 
      (editingIndex === null || b.bookingId !== editingBookingId)
    ).length;

    if (deliveryCount >= 10) {
      alert(`⚠️ Delivery Limit Exceeded!\nThere are already ${deliveryCount} active deliveries scheduled on ${deliveryDate}.\nThe limit is 10 deliveries per day. Please select a different expected delivery date first.`);
      return;
    }

    // Admin validation check for Edit Mode
    if (editingIndex !== null && !isAdmin()) {
      alert("❌ Access Denied! Only Admin users can edit bookings.");
      return;
    }

    // 1. Save Customer
    const custRec: Customer = {
      name: custName.trim(),
      father: fatherName.trim() || undefined,
      address: address.trim() || undefined,
      post: post.trim() || undefined,
      district: district || undefined,
      state: state || undefined,
      pincode: pincode.trim() || undefined,
      mobile: mobile.trim() || undefined,
      gender: custGender,
      savedAt: new Date().toISOString()
    };
    
    await CustomerRepository.saveCustomer(custRec);

    // 2. Prepare Booking ID
    const bookingId = editingIndex !== null ? editingBookingId : `KVUB/${sequence}/${fiscalYear}`;

    // 3. Create payments list
    const finalPayments: Payment[] = paymentsList;

    // Recalculate totals
    const finalAdvancePaid = advancePaidVal;

    // Payment status
    let payStatus: Booking['paymentStatus'] = 'No Advance';
    if (finalAdvancePaid > 0) {
      if (finalAdvancePaid >= finalAmount) {
        payStatus = 'Fully Paid';
      } else if (finalPayments.length === 1) {
        payStatus = 'Advance Received';
      } else {
        payStatus = 'Partially Paid';
      }
    }

    // Audit Log
    let finalAuditLog: AuditLog[] = [];
    if (editingIndex !== null && originalBooking) {
      finalAuditLog = originalBooking.auditLog || [];
      finalAuditLog.push({
        timestamp: new Date().toISOString(),
        user: recordedBy.trim() || 'Admin',
        action: 'Booking Details Edited',
        details: `Booking details updated. New final amount: Rs. ${finalAmount}`
      });
    } else {
      finalAuditLog.push({
        timestamp: new Date().toISOString(),
        user: recordedBy.trim() || 'Admin',
        action: 'Booking Created',
        details: `Booking created with final amount Rs. ${finalAmount}` + 
                 (finalAdvancePaid > 0 ? ` and initial advance Rs. ${finalAdvancePaid} across ${finalPayments.length} payments.` : ' and no advance.')
      });
    }

    const newBooking: Booking = {
      bookingId,
      bookingDate: editingIndex !== null ? bookingDate : `${bookingDate}T${new Date().toTimeString().split(' ')[0]}`,
      deliveryDate,
      custName: custName.trim(),
      custGender,
      relation,
      fatherName: fatherName.trim(),
      address: address.trim(),
      post: post.trim(),
      district,
      state,
      pincode: pincode.trim(),
      mobile: mobile.trim(),
      aadhar: aadhar.trim() || undefined,
      items,
      
      originalPrice: itemsTotal,
      additionalCharges: addChargesVal,
      discount: discountVal,
      totalAmount: finalAmount,
      
      advancePaid: finalAdvancePaid,
      paymentMode: finalPayments.length > 0 ? finalPayments[finalPayments.length - 1].method : 'None',
      balanceDue: finalAmount - finalAdvancePaid,
      paymentStatus: payStatus,
      payments: finalPayments,
      requiredAdvance: parseFloat(requiredAdvance) || 0,
      auditLog: finalAuditLog,

      cyclone,
      jhanna,
      tractor: tractor.trim() || undefined,
      hp: hp.trim() || undefined,
      pullySize: pullySize.trim() || undefined,
      ptoShaft: ptoShaft.trim() || undefined,
      notes: notes.trim() || undefined,
      status: editingIndex !== null ? (deliveryStatus === 'Delivered' ? 'Delivered' : 'Pending') : 'Pending',
      savedAt: new Date().toISOString()
    };

    // Save booking — capture returned nextSeq to update sequence display
    const { nextSeq } = await BookingRepository.saveBooking(newBooking, editingIndex !== null ? editingIndex : undefined);

    // Show message
    if (editingIndex !== null) {
      alert('Booking record updated! ✅');
    } else {
      alert('New Booking record saved! ✅');
      // Update sequence immediately so next booking gets correct number
      setSequence(String(nextSeq + 1).padStart(4, '0'));
    }

    // Set preview modal to show the receipt
    setSavedBookingData(newBooking);
    localStorage.removeItem('kvu_booking_draft');
    setShowPreviewModal(true);
  };

  // Direct Print action
  const handlePrint = async () => {
    if (!printAreaRef.current) return;
    let selector = '#bookingTraditionalPrintArea';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }
    const content = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (content) {
      await PrintService.printElement(content, printType === 'Thermal');
    }
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!savedBookingData || !printAreaRef.current) return;
    const cleanId = savedBookingData.bookingId.replace(/\//g, '-');
    const fileName = `KVU_Booking_Receipt_${cleanId}.pdf`;
    
    let selector = '#bookingTraditionalPdfCapture';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }
    const wrapper = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (wrapper) {
      await PDFService.downloadPdf(wrapper, fileName, false);
    }
  };

  // WhatsApp sharing
  const handleWhatsAppShare = async () => {
    if (!savedBookingData || !printAreaRef.current) return;
    let selector = '#bookingTraditionalPdfCapture';
    if (printType === 'Thermal') {
      selector = '#bookingThermalPrintArea';
    }
    const wrapper = printAreaRef.current.querySelector(selector) as HTMLElement;
    if (wrapper) {
      await PDFService.shareWhatsApp(
        wrapper,
        savedBookingData.custName,
        savedBookingData.bookingId,
        String(savedBookingData.totalAmount),
        savedBookingData.mobile,
        savedBookingData.bookingDate,
        'Booking Advance Receipt',
        (msg) => console.log('[Share Toast]', msg),
        false
      );
    }
  };

  const handleCloseModal = () => {
    setShowPreviewModal(false);
    setSavedBookingData(null);
    handleResetForm(true);
    // Redirect to booking db view
    navigate('/booking-db');
  };

  // Section completion checks
  const isCustCompleted = custName.trim().length > 0 && mobile.trim().length === 10;
  const isMachineryCompleted = items.length > 0;
  const isLogisticsCompleted = deliveryDate.length > 0 && sequence.trim().length > 0;
  const isPricingCompleted = true;

  return (
    <div className="bp-page">
      {/* Editing Banner */}
      {editingIndex !== null && (
        <div className="bp-edit-banner">
          <div className="bp-edit-banner-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              Edit Mode — Booking ID: <span style={{ fontWeight: '800' }}>{editingBookingId}</span> (Original payments & logs will be preserved)
            </span>
          </div>
          <button type="button" className="bp-edit-cancel-btn" onClick={() => handleResetForm(true)}>
            Cancel Edit
          </button>
        </div>
      )}

      <div className="bp-accordion">
        {/* Step 1: Customer Details */}
        <div className={`bp-panel ${activeSection === 'customer' ? 'active' : ''} ${isCustCompleted ? 'completed' : ''}`}>
          <div className="bp-panel-header" onClick={() => setActiveSection('customer')}>
            <div className="bp-panel-header-title">
              <div className="bp-step-badge">
                {isCustCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : '1'}
              </div>
              <span className="bp-panel-title-text">Customer Details &amp; Contact Info</span>
            </div>
            <svg className="bp-panel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div className="bp-panel-content">
            <div className="bp-grid-2">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Customer Name *</label>
                <div className="bp-autocomplete-wrap">
                  <input 
                    type="text" 
                    placeholder="Type to search / Enter name" 
                    value={custName}
                    onChange={(e) => {
                      setCustName(e.target.value);
                      setCustSearchQuery(e.target.value);
                      setShowCustSuggestions(true);
                    }}
                    onFocus={() => setShowCustSuggestions(true)}
                    autoComplete="off"
                  />
                  {showCustSuggestions && filteredCustomers.length > 0 && (
                    <div className="bp-autocomplete-list">
                      {filteredCustomers.slice(0, 8).map((c, i) => (
                        <div 
                          key={i} 
                          className="bp-autocomplete-item" 
                          onClick={() => handleSelectCustomer(c)}
                        >
                          <div className="bp-ac-main">{c.name}</div>
                          <div className="bp-ac-sub">
                            {[c.district, c.state, c.mobile].filter(Boolean).join(' · ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Relation &amp; Name</label>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select 
                    value={relation}
                    onChange={(e) => setRelation(e.target.value)}
                    style={{ width: '80px', flexShrink: 0, fontWeight: 'bold', background: 'var(--surface-1)' }}
                  >
                    <option value="S/O">S/O</option>
                    <option value="W/O">W/O</option>
                    <option value="D/O">D/O</option>
                  </select>
                  <input 
                    type="text" 
                    placeholder="Father's / Husband's Name" 
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="bp-grid-3">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>House No. / Address</label>
                <input 
                  type="text" 
                  placeholder="Address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Post Office</label>
                <input 
                  type="text" 
                  placeholder="Post office" 
                  value={post}
                  onChange={(e) => setPost(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Gender</label>
                <select 
                  value={custGender}
                  onChange={(e) => setCustGender(e.target.value as any)}
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            <div className="bp-grid-3">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>State</label>
                <select 
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">-- Select State --</option>
                  {statesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>District</label>
                <select 
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                >
                  <option value="">-- Select District --</option>
                  {districtsList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Pincode</label>
                <input 
                  type="text" 
                  placeholder="6-digit Pincode" 
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="bp-grid-2">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Mobile No. *</label>
                <input 
                  type="text" 
                  placeholder="10-digit mobile" 
                  maxLength={10}
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Aadhaar Card No.</label>
                <input 
                  type="text" 
                  placeholder="12-digit Aadhaar No." 
                  maxLength={12}
                  value={aadhar}
                  onChange={(e) => setAadhar(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>

            <div className="bp-action-row">
              <div></div>
              <button 
                type="button" 
                className="bp-btn-next" 
                onClick={() => {
                  if (!isCustCompleted) {
                    alert('Please enter a valid Customer Name and 10-digit Mobile Number.');
                    return;
                  }
                  setActiveSection('machinery');
                }}
              >
                Next: Machinery Details
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Machinery Details */}
        <div className={`bp-panel ${activeSection === 'machinery' ? 'active' : ''} ${isMachineryCompleted ? 'completed' : ''}`}>
          <div className="bp-panel-header" onClick={() => {
            if (isCustCompleted) setActiveSection('machinery');
          }}>
            <div className="bp-panel-header-title">
              <div className="bp-step-badge">
                {isMachineryCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : '2'}
              </div>
              <span className="bp-panel-title-text">Machinery &amp; Booked Items ({items.length})</span>
            </div>
            <svg className="bp-panel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div className="bp-panel-content">
            <LineItemsEditor
              items={items}
              onChange={setItems}
              presetMode="autocomplete"
              presets={BOOKING_PRESETS}
              descLayout="none"
              nameInputId="bpNameInput"
              qtyInputId="bpQtyInput"
            />

            <div className="bp-grid-3" style={{ marginTop: '20px' }}>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>CYCLONE</label>
                <div className="switch-container" style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={cyclone === 'Yes'} 
                      onChange={(e) => setCyclone(e.target.checked ? 'Yes' : 'No')}
                    />
                    <span className="slider"></span>
                  </label>
                  <span style={{ marginLeft: '10px', fontWeight: '700', fontSize: '14px', color: cyclone === 'Yes' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {cyclone}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>JHANNA</label>
                <div className="switch-container" style={{ height: '40px', display: 'flex', alignItems: 'center' }}>
                  <label className="switch">
                    <input 
                      type="checkbox" 
                      checked={jhanna === 'Yes'} 
                      onChange={(e) => setJhanna(e.target.checked ? 'Yes' : 'No')}
                    />
                    <span className="slider"></span>
                  </label>
                  <span style={{ marginLeft: '10px', fontWeight: '700', fontSize: '14px', color: jhanna === 'Yes' ? 'var(--primary)' : 'var(--text-secondary)' }}>
                    {jhanna}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>TRACTOR</label>
                <input 
                  type="text" 
                  placeholder="e.g. Mahindra 575 DI" 
                  value={tractor}
                  onChange={(e) => setTractor(e.target.value)}
                />
              </div>
            </div>

            <div className="bp-grid-3">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>HP</label>
                <input 
                  type="text" 
                  placeholder="e.g. 50 HP / 7.5 HP" 
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>PULLY SIZE</label>
                <input 
                  type="text" 
                  placeholder="e.g. 10 inch" 
                  value={pullySize}
                  onChange={(e) => setPullySize(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>PTO SHAFT</label>
                <input 
                  type="text" 
                  placeholder="e.g. 6 Spline / 36 inch" 
                  value={ptoShaft}
                  onChange={(e) => setPtoShaft(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: '10px' }}>
              <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Customer Notes / Instructions</label>
              <textarea 
                placeholder="Special instructions or requests..." 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                style={{ minHeight: '60px', width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div className="bp-action-row">
              <button type="button" className="bp-btn-back" onClick={() => setActiveSection('customer')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
              </button>
              <button 
                type="button" 
                className="bp-btn-next" 
                onClick={() => {
                  if (!isMachineryCompleted) {
                    alert('Please add at least one item to the booking list.');
                    return;
                  }
                  setActiveSection('logistics');
                }}
              >
                Next: Logistics &amp; Dates
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: Logistics Details */}
        <div className={`bp-panel ${activeSection === 'logistics' ? 'active' : ''} ${isLogisticsCompleted ? 'completed' : ''}`}>
          <div className="bp-panel-header" onClick={() => {
            if (isCustCompleted && isMachineryCompleted) setActiveSection('logistics');
          }}>
            <div className="bp-panel-header-title">
              <div className="bp-step-badge">
                {isLogisticsCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : '3'}
              </div>
              <span className="bp-panel-title-text">Logistics, Dates &amp; References</span>
            </div>
            <svg className="bp-panel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div className="bp-panel-content">
            <div className="bp-grid-3">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Booking Ref ID</label>
                <div className="bp-seq-container">
                  <span className="bp-seq-prefix">KVUB/</span>
                  <input 
                    type="text" 
                    className="bp-seq-input" 
                    value={sequence} 
                    maxLength={4}
                    onChange={(e) => setSequence(e.target.value.replace(/\D/g, ''))}
                  />
                  <span className="bp-seq-suffix">/{fiscalYear}</span>
                </div>
                {editingIndex === null && (
                  <button type="button" onClick={handleResetSequence} className="bp-inline-reset-btn">🔄 Reset Seq</button>
                )}
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Booking Date</label>
                <input 
                  type="date" 
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Expected Delivery Date *</label>
                <input 
                  type="date" 
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                />
                {deliveryDate && (() => {
                  const count = existingBookings.filter(b => 
                    b.deliveryDate === deliveryDate && 
                    b.status !== 'Cancelled' && 
                    (editingIndex === null || b.bookingId !== editingBookingId)
                  ).length;
                  if (count >= 10) {
                    return (
                      <span style={{ color: '#cc0000', fontSize: '12px', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>
                        ⚠️ {count} deliveries scheduled. Change date first!
                      </span>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {editingIndex !== null && (
              <div className="bp-grid-3">
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Delivery Status</label>
                  <select 
                    value={deliveryStatus}
                    onChange={(e) => setDeliveryStatus(e.target.value as any)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Delivered">Delivered</option>
                  </select>
                </div>
              </div>
            )}

            <div className="bp-action-row">
              <button type="button" className="bp-btn-back" onClick={() => setActiveSection('machinery')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
              </button>
              <button 
                type="button" 
                className="bp-btn-next" 
                onClick={() => {
                  if (!isLogisticsCompleted) {
                    alert('Please make sure Reference sequence and Expected Delivery Date are entered.');
                    return;
                  }
                  setActiveSection('pricing');
                }}
              >
                Next: Pricing &amp; Payments
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </button>
            </div>
          </div>
        </div>

        {/* Step 4: Pricing & Advance Payment */}
        <div className={`bp-panel ${activeSection === 'pricing' ? 'active' : ''} ${isPricingCompleted ? 'completed' : ''}`}>
          <div className="bp-panel-header" onClick={() => {
            if (isCustCompleted && isMachineryCompleted && isLogisticsCompleted) setActiveSection('pricing');
          }}>
            <div className="bp-panel-header-title">
              <div className="bp-step-badge">
                {isPricingCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                ) : '4'}
              </div>
              <span className="bp-panel-title-text">Pricing &amp; Advance Payment</span>
            </div>
            <svg className="bp-panel-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
          <div className="bp-panel-content">
            <div className="bp-grid-3">
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Additional Charges (Rs.)</label>
                <input 
                  type="number" 
                  value={additionalCharges} 
                  min="0"
                  onChange={(e) => setAdditionalCharges(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Discount (Rs.)</label>
                <input 
                  type="number" 
                  value={discount} 
                  min="0"
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Required Advance (Rs.)</label>
                <input 
                  type="number" 
                  value={requiredAdvance} 
                  min="0"
                  onChange={(e) => setRequiredAdvance(e.target.value)}
                />
              </div>
            </div>

            {/* Repeatable Payments Add Row Form */}
            <div style={{ border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-md)', background: 'var(--surface-1)', marginBottom: '24px', marginTop: '16px' }}>
              <span className="bp-panel-title-text" style={{ display: 'block', marginBottom: '16px', fontSize: '15px' }}>➕ Record Advance Payment Transaction</span>
              
              <div className="bp-grid-3" style={{ marginBottom: '12px' }}>
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Payment Mode</label>
                  <select 
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as any)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="NEFT/RTGS">NEFT / Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Amount (Rs.) *</label>
                  <input 
                    type="number" 
                    placeholder="Enter amount"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Date *</label>
                  <input 
                    type="date" 
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Conditional fields based on payMethod */}
              {(payMethod === 'UPI' || payMethod === 'NEFT/RTGS' || payMethod === 'Cheque') && (
                <div className="bp-grid-2" style={{ marginBottom: '12px' }}>
                  {(payMethod === 'NEFT/RTGS' || payMethod === 'Cheque') && (
                    <div>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Bank Name *</label>
                      <input 
                        type="text" 
                        placeholder="e.g. State Bank of India"
                        value={payBankName}
                        onChange={(e) => setPayBankName(e.target.value)}
                      />
                    </div>
                  )}
                  {payMethod === 'UPI' && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>UPI Transaction ID / UTR *</label>
                      <input 
                        type="text" 
                        placeholder="Enter 12-digit UTR or Ref ID"
                        value={payRefNo}
                        onChange={(e) => setPayRefNo(e.target.value)}
                      />
                    </div>
                  )}
                  {payMethod === 'NEFT/RTGS' && (
                    <div>
                      <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Transaction Ref No. / UTR *</label>
                      <input 
                        type="text" 
                        placeholder="Enter UTR / Ref No."
                        value={payRefNo}
                        onChange={(e) => setPayRefNo(e.target.value)}
                      />
                    </div>
                  )}
                  {payMethod === 'Cheque' && (
                    <>
                      <div>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Cheque Number *</label>
                        <input 
                          type="text" 
                          placeholder="6-digit Cheque No."
                          value={payRefNo}
                          onChange={(e) => setPayRefNo(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Cheque Date *</label>
                        <input 
                          type="date" 
                          value={payChequeDate}
                          onChange={(e) => setPayChequeDate(e.target.value)}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="bp-grid-2" style={{ marginBottom: '16px' }}>
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Remarks</label>
                  <input 
                    type="text" 
                    placeholder="Remarks / notes for this payment (optional)"
                    value={payRemarks}
                    onChange={(e) => setPayRemarks(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontWeight: '600', display: 'block', marginBottom: '6px' }}>Recorded By *</label>
                  <input 
                    type="text" 
                    value={recordedBy}
                    onChange={(e) => setRecordedBy(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={handleAddTransaction}
                  style={{
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    padding: '8px 20px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  📥 Add Payment Row
                </button>
              </div>
            </div>

            {/* Repeatable Payments Table */}
            <div style={{ marginBottom: '24px' }}>
              <span className="bp-panel-title-text" style={{ display: 'block', marginBottom: '10px' }}>💳 Entered Payments ({paymentsList.length})</span>
              {paymentsList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', background: 'var(--surface-2)' }}>
                  No payment entered (No Advance). Add details above to record advance payments.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <table className="lie-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-1)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>S.No</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>Date</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>Mode</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600' }}>Reference Details</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }}>Amount</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', width: '50px' }}>Remove</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsList.map((p, idx) => {
                        let refDetails = '—';
                        if (p.method === 'UPI') refDetails = `UTR: ${p.transactionNo || '—'}`;
                        else if (p.method === 'NEFT/RTGS') refDetails = `Bank: ${p.bankName || '—'} · UTR: ${p.transactionNo || '—'}`;
                        else if (p.method === 'Cheque') refDetails = `Bank: ${p.bankName || '—'} · Chq No: ${p.chequeNo || '—'} · Date: ${p.chequeDate || '—'}`;
                        
                        return (
                          <tr key={p.id} style={{ borderBottom: idx < paymentsList.length - 1 ? '1px solid var(--border)' : 'none' }}>
                            <td style={{ padding: '10px 12px' }}>{idx + 1}</td>
                            <td style={{ padding: '10px 12px' }}>{p.date}</td>
                            <td style={{ padding: '10px 12px' }}>
                              <span className="payment-method-badge" style={{ background: 'var(--surface-3)', border: '1px solid var(--border)' }}>
                                {p.method === 'NEFT/RTGS' ? 'NEFT/Bank' : p.method}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{refDetails}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>₹ {p.amount.toLocaleString('en-IN')}</td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveTransaction(p.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'var(--danger)',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto'
                                }}
                                title="Delete payment row"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Target Advance Indicator Alert */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '20px',
              fontWeight: '600',
              fontSize: '13px',
              border: '1px solid',
              background: advancePaidVal < (parseFloat(requiredAdvance) || 0)
                ? 'var(--warning-bg)'
                : advancePaidVal === (parseFloat(requiredAdvance) || 0)
                  ? 'var(--success-bg)'
                  : 'rgba(59, 130, 246, 0.08)',
              borderColor: advancePaidVal < (parseFloat(requiredAdvance) || 0)
                ? 'var(--warning-light)'
                : advancePaidVal === (parseFloat(requiredAdvance) || 0)
                  ? 'var(--success)'
                  : '#93c5fd',
              color: advancePaidVal < (parseFloat(requiredAdvance) || 0)
                ? '#b45309'
                : advancePaidVal === (parseFloat(requiredAdvance) || 0)
                  ? 'var(--success)'
                  : '#1d4ed8'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {advancePaidVal < (parseFloat(requiredAdvance) || 0) ? (
                  <>⚠️ <span>Short of required advance by <strong>₹ {((parseFloat(requiredAdvance) || 0) - advancePaidVal).toLocaleString('en-IN')}</strong></span></>
                ) : advancePaidVal === (parseFloat(requiredAdvance) || 0) ? (
                  <>✅ <span>Payments matching the required advance of <strong>₹ {advancePaidVal.toLocaleString('en-IN')}</strong> exactly</span></>
                ) : (
                  <>ℹ️ <span>Over required advance by <strong>₹ {(advancePaidVal - (parseFloat(requiredAdvance) || 0)).toLocaleString('en-IN')}</strong></span></>
                )}
              </div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', opacity: 0.8 }}>
                Required: ₹{(parseFloat(requiredAdvance) || 0).toLocaleString('en-IN')} · Entered: ₹{advancePaidVal.toLocaleString('en-IN')}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bp-pricing-summary">
              <div className="bp-pricing-row">
                <span>Subtotal (Items Total):</span>
                <span>₹{itemsTotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="bp-pricing-row">
                <span>Additional Charges:</span>
                <span>+ ₹{addChargesVal.toLocaleString('en-IN')}</span>
              </div>
              <div className="bp-pricing-row">
                <span>Discount / Reduction:</span>
                <span>- ₹{discountVal.toLocaleString('en-IN')}</span>
              </div>
              <div className="bp-pricing-row total">
                <span>Grand Total:</span>
                <span>₹{finalAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="bp-pricing-row">
                <span>Advance Paid:</span>
                <span>₹{advancePaidVal.toLocaleString('en-IN')}</span>
              </div>
              <div className="bp-pricing-row due">
                <span>Balance Due:</span>
                <span>₹{(finalAmount - advancePaidVal).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bp-save-bar">
              <button type="button" className="bp-btn-reset" onClick={() => handleResetForm()}>
                🔄 Reset Form
              </button>
              <button type="button" className="bp-btn-save" onClick={handleSaveBooking}>
                💾 Save &amp; Print Receipt
              </button>
            </div>

            <div className="bp-action-row">
              <button type="button" className="bp-btn-back" onClick={() => setActiveSection('logistics')}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                Back
              </button>
              <div></div>
            </div>
          </div>
        </div>
      </div>

      {/* Booking Receipt Preview Modal */}
      {showPreviewModal && savedBookingData && (
        <Modal 
          isOpen={showPreviewModal} 
          onClose={handleCloseModal}
          title="🖨 Booking Receipt Preview"
          size="lg"
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <Button
              onClick={() => setPrintType('A4_Traditional')}
              style={{ background: printType === 'A4_Traditional' ? 'var(--primary)' : 'var(--surface-3)', color: printType === 'A4_Traditional' ? '#fff' : 'var(--text-primary)', fontSize: '12px', padding: '6px 14px' }}
            >📟 A4 Traditional</Button>
            <Button
              onClick={() => setPrintType('Thermal')}
              style={{ background: printType === 'Thermal' ? 'var(--text-primary)' : 'var(--surface-3)', color: printType === 'Thermal' ? '#fff' : 'var(--text-primary)', fontSize: '12px', padding: '6px 14px' }}
            >🖨 Thermal Print</Button>
          </div>
          <div ref={printAreaRef} style={{ maxHeight: '60vh', overflow: 'auto', padding: '16px', background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            {printType === 'A4_Traditional' && (
              <BookingTraditionalPreview booking={savedBookingData} />
            )}
            {printType === 'Thermal' && (
              <BookingThermalPreview booking={savedBookingData} />
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px', flexWrap: 'wrap' }}>
            <Button onClick={handlePrint} variant="primary">🖨 Print Receipt</Button>
            <Button onClick={handleDownloadPdf} variant="success">📥 Download PDF</Button>
            <Button onClick={handleWhatsAppShare} style={{ background: '#25D366', color: 'white' }}>💬 Share WhatsApp</Button>
            <Button onClick={handleCloseModal} variant="secondary">Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default BookingsPage;
