import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { FormGroup, Input, MobileInput, AadhaarInput, Select } from '../components/FormControls';
import { QuotationPreview } from '../components/QuotationPreview';
import { CustomerRepository, type Customer } from '../repositories/CustomerRepository';
import { QuotationRepository, type Quotation, type LineItem } from '../repositories/QuotationRepository';
import { LineItemsEditor } from '../components/LineItemsEditor';
import { PDFService } from '../services/PDFService';
import { getStatesList, getDistrictsForState } from '../utils/indiaDistricts';
import { formatCurrency } from '../utils/numberToWords';
import { PrintService } from '../utils/PrintService';
import { getFiscalYear } from '../utils/fiscalYear';
import '../styles/QuotationPage.css';

// HSN and GST mappings from legacy
const MACHINE_HSN: Record<string, string> = {
  'MINI RICE MILL MACHINE': '84378020',
  'MASH FEED PLANT': '8436100',
  'ATTA CHAKKI': '84378010'
};

const MACHINE_GST: Record<string, string> = {
  'MINI RICE MILL MACHINE': '18',
  'MASH FEED PLANT': '18',
  'ATTA CHAKKI': '5'
};

// Preset products
const MINI_MILL_PRESETS = [
  'MINI RICE MILL TKCJ-8',
  'MINI RICE MILL TKCJ-6',
  'MINI RICE MILL TKC-8',
  'MINI RICE MILL TKC-6',
  'MINI RICE MILL NC-6',
  'MINI RICE MILL NC-8',
  'MINI RICE MILL NCJ-6',
  'MINI RICE MILL NCJ-8'
];

const FEED_PLANT_PRESETS = [
  'FEED MIXER-250',
  'FEED MIXER-500',
  'FEED MIXER-1000',
  'FEED GRINDER S-SCREEN',
  'FEED GRINDER D-SCREEN',
  'SCREW CONVEYOR 8x8',
  'SCREW CONVEYOR 8x11',
  'SCREW CONVEYOR 10x10',
  'SCREW CONVEYOR 10x12',
  'BUCKET ELEVATOR 23 ft',
  'BUCKET ELEVATOR 16 ft',
  'BATCH BIN-500',
  'BATCH BIN-1000',
  'MOTOR COST'
];

const ATTA_CHAKKI_PRESETS = [
  'ATTA CHAKKI',
  'OIL EXPELLER',
  'MOBILE ATTA CHAKKI',
  'MOBILE ATTA CHAKKI - OIL EXPELLER'
];



export const QuotationPage: React.FC = () => {
  const location = useLocation();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const suppressDistrictReset = useRef(false);

  // Load fiscal year
  const fiscalYear = getFiscalYear();

  // Load database customers for inline search
  const [dbCustomers, setDbCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState('');
  const [showCustList, setShowCustList] = useState(false);

  // Customer Form State
  const [custName, setCustName] = useState('');
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [relation, setRelation] = useState('S/O');
  const [fatherName, setFatherName] = useState('');
  const [address, setAddress] = useState('');
  const [post, setPost] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [pincode, setPincode] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhar, setAadhar] = useState('');

  // Machine Parameters State
  const [heading, setHeading] = useState('MINI RICE MILL MACHINE');
  const [customHeading, setCustomHeading] = useState('');
  const [hsn, setHsn] = useState('84378020');
  const [capacity, setCapacity] = useState('');
  const [power, setPower] = useState('');

  // Line Items State (managed by LineItemsEditor)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Calculations State
  const [discount, setDiscount] = useState('');
  const [gstRate, setGstRate] = useState('18');
  const [incInst, setIncInst] = useState(false);

  // Sequence and Preview State
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  const [seqInput, setSeqInput] = useState('');
  const [generatedQuote, setGeneratedQuote] = useState<Quotation | null>(null);
  const templateVariant = 'classic';

  // Autofill chosen customer
  const applyCustomerData = (c: Customer) => {
    setCustName(c.name);
    setFatherName(c.father || '');
    setAddress(c.address || '');
    setPost(c.post || '');
    setState(c.state || '');
    setDistrict(c.district || '');
    setPincode(c.pincode || '');
    setMobile(c.mobile || '');
    setAadhar(c.aadhar || '');
    setCustSearch('');
    setShowCustList(false);
  };

  // States & Districts
  const [districtsList, setDistrictsList] = useState<string[]>([]);
  const statesList = getStatesList().map((s) => ({ value: s, label: s }));

  // Load states/customers and check routed location state
  useEffect(() => {
    const preloadData = async () => {
      // Load customers
      const custs = await CustomerRepository.getCustomers();
      setDbCustomers(custs);

      // Get current sequence (only if not editing)
      if (!location.state?.editQuotation) {
        const currentSeq = await QuotationRepository.getSequence();
        setSeqInput(String(currentSeq + 1).padStart(4, '0'));
      }

      // Check if customer was passed via navigation
      const routedCust = location.state?.selectedCustomer as Customer | undefined;
      if (routedCust) {
        applyCustomerData(routedCust);
        // Clear location state so refreshes don't lock it
        window.history.replaceState({}, document.title);
      }
    };
    preloadData();
  }, [location]);

  // Auto-save form draft to localStorage
  useEffect(() => {
    if (editingIndex !== undefined) return; // Do not overwrite when editing an existing quotation
    
    const draft = {
      custName,
      gender,
      relation,
      fatherName,
      address,
      post,
      state,
      district,
      pincode,
      mobile,
      aadhar,
      heading,
      customHeading,
      hsn,
      capacity,
      power,
      lineItems,
      discount,
      gstRate,
      incInst
    };
    
    const hasData = custName.trim() || fatherName.trim() || address.trim() || lineItems.length > 0;
    if (hasData) {
      localStorage.setItem('kvu_quotation_draft', JSON.stringify(draft));
    } else {
      localStorage.removeItem('kvu_quotation_draft');
    }
  }, [
    editingIndex, custName, gender, relation, fatherName, address, post, state, district,
    pincode, mobile, aadhar, heading, customHeading, hsn, capacity, power, lineItems,
    discount, gstRate, incInst
  ]);

  // Load draft on mount
  useEffect(() => {
    const editEntry = location.state?.editQuotation;
    const routedCust = location.state?.selectedCustomer;
    
    if (!editEntry && !routedCust) {
      const saved = localStorage.getItem('kvu_quotation_draft');
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          if (draft.custName) setCustName(draft.custName);
          if (draft.gender) setGender(draft.gender);
          if (draft.relation) setRelation(draft.relation);
          if (draft.fatherName) setFatherName(draft.fatherName);
          if (draft.address) setAddress(draft.address);
          if (draft.post) setPost(draft.post);
          if (draft.state) setState(draft.state);
          if (draft.district) setDistrict(draft.district);
          if (draft.pincode) setPincode(draft.pincode);
          if (draft.mobile) setMobile(draft.mobile);
          if (draft.aadhar) setAadhar(draft.aadhar);
          if (draft.heading) setHeading(draft.heading);
          if (draft.customHeading) setCustomHeading(draft.customHeading);
          if (draft.hsn) setHsn(draft.hsn);
          if (draft.capacity) setCapacity(draft.capacity);
          if (draft.power) setPower(draft.power);
          if (Array.isArray(draft.lineItems)) setLineItems(draft.lineItems);
          if (draft.discount) setDiscount(draft.discount);
          if (draft.gstRate) setGstRate(draft.gstRate);
          if (draft.incInst !== undefined) setIncInst(draft.incInst);
        } catch (e) {
          console.warn('Failed to parse quotation draft:', e);
        }
      }
    }
  }, []);

  // Load districts on state change
  useEffect(() => {
    const fetchDistricts = async () => {
      if (state) {
        const list = await getDistrictsForState(state);
        setDistrictsList(list);
        if (!suppressDistrictReset.current && list.length > 0 && !list.includes(district)) {
          setDistrict(list[0]);
        }
      } else {
        setDistrictsList([]);
        if (!suppressDistrictReset.current) {
          setDistrict('');
        }
      }
    };
    fetchDistricts();
  }, [state]);

  // Check if we are editing an entry passed from HistoryPage
  useEffect(() => {
    const editEntry = location.state?.editQuotation as { quotation: Quotation; index: number } | undefined;
    if (editEntry) {
      // Suppress district auto-reset while we load all edit fields
      suppressDistrictReset.current = true;

      const { quotation, index } = editEntry;
      setEditingIndex(index);
      
      // Load customer data
      setCustName(quotation.custName);
      setGender(quotation.gender);
      setRelation(quotation.relation);
      setFatherName(quotation.fatherName || '');
      setAddress(quotation.address || '');
      setPost(quotation.post || '');
      setState(quotation.state || '');
      setDistrict(quotation.district || '');
      setPincode(quotation.pincode || '');
      setMobile(quotation.mobile || '');
      setAadhar(quotation.aadhar || '');

      // Load machine metadata
      if (['MINI RICE MILL MACHINE', 'MASH FEED PLANT', 'ATTA CHAKKI'].includes(quotation.heading)) {
        setHeading(quotation.heading);
      } else {
        setHeading('Custom...');
        setCustomHeading(quotation.heading);
      }
      setHsn(quotation.hsn || '');
      setCapacity(quotation.capacity || '');
      setPower(quotation.power || '');

      // Load items & calculations
      setLineItems(quotation.items);
      setDiscount(String(quotation.discount));
      setGstRate(String(quotation.gstRate));
      setIncInst(quotation.incInst);

      // Set sequence input from original ref
      const refParts = quotation.ref.split('/');
      if (refParts.length >= 2) {
        setSeqInput(refParts[1]);
      }

      setGeneratedQuote(quotation);

      // Re-enable district auto-reset after a tick (async districts load will complete)
      setTimeout(() => { suppressDistrictReset.current = false; }, 500);

      // Clear location state
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Handle heading change to auto HSN and GST
  const handleHeadingChange = (val: string) => {
    setHeading(val);
    if (val !== 'Custom...') {
      setHsn(MACHINE_HSN[val] || '');
      setGstRate(MACHINE_GST[val] || '18');
    }
  };

  // Inline search filtering
  const filteredCustomers = dbCustomers.filter((c) => {
    const q = custSearch.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.mobile || '').includes(q) ||
      (c.district || '').toLowerCase().includes(q)
    );
  });

  // Item list is fully controlled by LineItemsEditor — no local item handlers needed

  // Save / Generate Quotation
  const handleGenerate = async () => {
    if (lineItems.length === 0) {
      alert('Please add at least one product!');
      return;
    }

    if (!custName.trim()) {
      alert('Customer Name is required!');
      return;
    }

    // Validation checks for formats
    const cleanMobile = mobile.replace(/\D/g, '');
    const cleanAadhar = aadhar.replace(/\D/g, '');
    if (cleanMobile.length > 0 && (cleanMobile.length !== 10 || !/^[6-9]/.test(cleanMobile))) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }
    if (cleanAadhar.length > 0 && cleanAadhar.length !== 12) {
      alert('Please enter a valid 12-digit Aadhaar number');
      return;
    }

    const seqNum = parseInt(seqInput, 10) || 0;
    const finalRef = `KVUQ/${String(seqNum).padStart(4, '0')}/${fiscalYear}`;

    // Calculations
    const totalAmt = lineItems.reduce((sum, item) => sum + item.amount, 0);
    const discAmt = parseFloat(discount) || 0;
    
    if (discAmt > totalAmt) {
      alert('Discount cannot be greater than total amount!');
      return;
    }

    const parsedGstRate = parseFloat(gstRate) || 18;
    const afterDisc = totalAmt - discAmt;
    const gstAmt = afterDisc * (parsedGstRate / 100);
    const grandExact = afterDisc + gstAmt;
    const grandRounded = Math.round(grandExact);

    const dateStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });

    const quoteRecord: Quotation = {
      ref: finalRef,
      date: dateStr,
      dateVal: new Date().toISOString().split('T')[0],
      custName: custName.trim(),
      gender,
      relation,
      fatherName: fatherName.trim() || undefined,
      address: address.trim() || undefined,
      post: post.trim() || undefined,
      district: district || undefined,
      state: state || undefined,
      pincode: pincode.trim() || undefined,
      mobile: mobile.trim() || undefined,
      aadhar: aadhar.trim() || undefined,
      heading: heading === 'Custom...' ? customHeading.trim() : heading,
      hsn: hsn.trim() || undefined,
      capacity: capacity.trim() || undefined,
      power: power.trim() || undefined,
      items: lineItems,
      discount: discAmt,
      gstRate: parsedGstRate,
      incInst,
      grandTotal: grandRounded,
      grandTotalFmt: formatCurrency(grandRounded),
      savedAt: new Date().toISOString()
    };

    // Save quotation in Supabase directly
    const { nextRefNum } = await QuotationRepository.saveQuotation(quoteRecord, editingIndex !== undefined);

    // Save customer details if they don't exist
    const cleanName = custName.trim().toLowerCase();
    const cleanMob = mobile.trim().replace(/\D/g, '');
    const custExists = dbCustomers.find(
      (c) => c.name.trim().toLowerCase() === cleanName && (c.mobile || '').replace(/\D/g, '') === cleanMob
    );

    if (!custExists) {
      const newCust: Customer = {
        name: custName.trim(),
        gender,
        father: fatherName.trim() || undefined,
        address: address.trim() || undefined,
        post: post.trim() || undefined,
        district: district || undefined,
        state: state || undefined,
        pincode: pincode.trim() || undefined,
        mobile: mobile.trim() || undefined,
        aadhar: aadhar.trim() || undefined,
        savedAt: new Date().toISOString()
      };
      const updatedCusts = await CustomerRepository.saveCustomer(newCust);
      setDbCustomers(updatedCusts);
    }

    // Update screen state
    setGeneratedQuote(quoteRecord);
    localStorage.removeItem('kvu_quotation_draft');

    if (editingIndex === undefined) {
      // Set sequence for next new quote
      setSeqInput(String(nextRefNum + 1).padStart(4, '0'));
      alert(`✅ Quotation Generated: ${finalRef}`);
    } else {
      alert(`✅ Quotation Updated: ${finalRef}`);
    }

    // Scroll to print view smoothly
    setTimeout(() => {
      const previewEl = document.getElementById('preview-section');
      if (previewEl) previewEl.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Reset form / Cancel editing
  const handleCancelEdit = () => {
    setEditingIndex(undefined);
    setGeneratedQuote(null);
    setLineItems([]);
    setDiscount('');
    setIncInst(false);
    
    // Clear customer
    setCustName('');
    setFatherName('');
    setAddress('');
    setPost('');
    setState('');
    setDistrict('');
    setPincode('');
    setMobile('');
    setAadhar('');

    // Reset sequence input
    const loadSeq = async () => {
      const currentSeq = await QuotationRepository.getSequence();
      setSeqInput(String(currentSeq + 1).padStart(4, '0'));
    };
    loadSeq();
  };

  // PDF Export
  const handleDownloadPdf = async () => {
    if (!generatedQuote || !printAreaRef.current) return;
    const cleanRef = generatedQuote.ref.replace(/\//g, '-');
    const fileName = `KVU_Quotation_${cleanRef}.pdf`;
    
    await PDFService.downloadPdf(printAreaRef.current, fileName, false);
  };

  // WhatsApp Share
  const handleWhatsAppShare = async () => {
    if (!generatedQuote || !printAreaRef.current) return;
    await PDFService.shareWhatsApp(
      printAreaRef.current,
      generatedQuote.custName,
      generatedQuote.ref,
      String(generatedQuote.grandTotal),
      generatedQuote.mobile || '',
      generatedQuote.date,
      generatedQuote.heading,
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

  return (
    <div className="qp-page">

      {/* ── Edit Mode Banner ── */}
      {editingIndex !== undefined && (
        <div className="qp-edit-banner">
          <div className="qp-edit-banner-info">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span>
              Edit Mode — Editing Ref: <span className="qp-edit-banner-ref">{generatedQuote?.ref}</span>
            </span>
          </div>
          <button type="button" className="qp-edit-cancel-btn" onClick={handleCancelEdit}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Cancel Edit
          </button>
        </div>
      )}

      <div className="tab-panel active" id="tab-quotation">

        {/* ══════════════════════════════════════════════
            SECTION 1 — Customer Details
            ══════════════════════════════════════════════ */}
        <div className="qp-section">
          <div className="qp-section-header">
            <span className="qp-step-chip" aria-hidden="true">1</span>
            <h2 className="qp-section-title">Customer Details</h2>
          </div>
          <div className="qp-section-body">

            {/* Customer Search */}
            <div className="qp-search-wrap">
              <span className="qp-search-icon" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </span>
              <input
                type="text"
                className="qp-search-input"
                placeholder="Search existing customer by name, mobile, or district…"
                value={custSearch}
                onChange={(e) => { setCustSearch(e.target.value); setShowCustList(true); }}
                onBlur={() => setTimeout(() => setShowCustList(false), 180)}
                aria-label="Search existing customer"
                aria-autocomplete="list"
                aria-expanded={showCustList && custSearch.trim().length > 0}
              />
              {showCustList && custSearch.trim().length > 0 && (
                <div className="qp-search-results" role="listbox" aria-label="Customer suggestions">
                  {filteredCustomers.length === 0 ? (
                    <div className="qp-search-empty">No matching customer found.</div>
                  ) : (
                    filteredCustomers.map((c, idx) => (
                      <div
                        key={idx}
                        className="qp-search-item"
                        role="option"
                        aria-selected="false"
                        onMouseDown={() => applyCustomerData(c)}
                      >
                        <div className="qp-search-item-avatar" aria-hidden="true">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="qp-search-item-info">
                          <span className="qp-search-item-name">{c.name}{c.mobile ? ` — ${c.mobile}` : ''}</span>
                          <span className="qp-search-item-meta">{[c.district, c.state].filter(Boolean).join(', ') || 'No location'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Name + Relation + Father */}
            <div className="qp-grid-name-row">
              <FormGroup label="Gender">
                <div className="qp-gender-group">
                  <button
                    type="button"
                    className={`qp-gender-pill ${gender === 'male' ? 'active' : ''}`}
                    onClick={() => {
                      setGender('male');
                      setRelation('S/O');
                    }}
                  >
                    Male
                  </button>
                  <button
                    type="button"
                    className={`qp-gender-pill ${gender === 'female' ? 'active' : ''}`}
                    onClick={() => {
                      setGender('female');
                      setRelation('W/O');
                    }}
                  >
                    Female
                  </button>
                </div>
              </FormGroup>
              <FormGroup label="Customer Name" required>
                <Input value={custName} onChange={setCustName} placeholder="Full name" required />
              </FormGroup>
              <FormGroup label="Relation">
                <Select
                  value={relation}
                  onChange={setRelation}
                  options={[
                    { value: 'S/O', label: 'S/O' },
                    { value: 'W/O', label: 'W/O' },
                    { value: 'D/O', label: 'D/O' },
                    { value: 'C/O', label: 'C/O' }
                  ]}
                />
              </FormGroup>
              <FormGroup label="Father / Husband Name">
                <Input value={fatherName} onChange={setFatherName} placeholder="Father / Husband name" />
              </FormGroup>
            </div>

            {/* Address + Post */}
            <div className="qp-grid-2 qp-mt">
              <FormGroup label="Address">
                <Input value={address} onChange={setAddress} placeholder="Village / Street" />
              </FormGroup>
              <FormGroup label="Post Office">
                <Input value={post} onChange={setPost} placeholder="Post office" />
              </FormGroup>
            </div>

            {/* State + District + Pincode */}
            <div className="qp-grid-3 qp-mt">
              <FormGroup label="State">
                <Select value={state} onChange={setState} options={[{ value: '', label: '— Select State —' }, ...statesList]} />
              </FormGroup>
              <FormGroup label="District">
                <Select
                  value={district}
                  onChange={setDistrict}
                  options={[
                    { value: '', label: state ? '— Select District —' : '— Select State first —' },
                    ...districtsList.slice().sort().map((d) => ({ value: d, label: d }))
                  ]}
                  disabled={!state}
                />
              </FormGroup>
              <FormGroup label="Pincode">
                <Input value={pincode} onChange={setPincode} placeholder="6-digit PIN" maxLength={6} />
              </FormGroup>
            </div>

            {/* Mobile + Aadhaar + Ref Code */}
            <div className="qp-grid-3 qp-mt">
              <FormGroup label="Mobile Number">
                <MobileInput value={mobile} onChange={setMobile} placeholder="10-digit mobile" />
              </FormGroup>
              <FormGroup label="Aadhaar Number">
                <AadhaarInput value={aadhar} onChange={setAadhar} placeholder="0000 0000 0000" />
              </FormGroup>
              <FormGroup label="Ref / Sequence No.">
                <Input value={seqInput} onChange={setSeqInput} placeholder="0001" disabled={editingIndex !== undefined} />
              </FormGroup>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 2 — Machine Specifications
            ══════════════════════════════════════════════ */}
        <div className="qp-section">
          <div className="qp-section-header">
            <span className="qp-step-chip" aria-hidden="true">2</span>
            <h2 className="qp-section-title">Machine Specifications</h2>
          </div>
          <div className="qp-section-body">

            {/* Machine Type Chip Selector */}
            <div className="qp-machine-chips" role="radiogroup" aria-label="Machine type">
              {/* Rice Mill */}
              <button
                type="button"
                className={`qp-machine-chip${heading === 'MINI RICE MILL MACHINE' ? ' active' : ''}`}
                onClick={() => handleHeadingChange('MINI RICE MILL MACHINE')}
                aria-pressed={heading === 'MINI RICE MILL MACHINE'}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                Rice Mill
              </button>

              {/* Feed Plant */}
              <button
                type="button"
                className={`qp-machine-chip feed-chip${heading === 'MASH FEED PLANT' ? ' active feed-active' : ''}`}
                onClick={() => handleHeadingChange('MASH FEED PLANT')}
                aria-pressed={heading === 'MASH FEED PLANT'}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
                Feed Plant
              </button>

              {/* Atta Chakki */}
              <button
                type="button"
                className={`qp-machine-chip atta-chip${heading === 'ATTA CHAKKI' ? ' active atta-active' : ''}`}
                onClick={() => handleHeadingChange('ATTA CHAKKI')}
                aria-pressed={heading === 'ATTA CHAKKI'}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                  <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
                Atta Chakki
              </button>
            </div>

            {/* Custom Heading field */}
            {heading === 'Custom...' && (
              <div className="qp-mt">
                <FormGroup label="Specify Custom Heading">
                  <Input value={customHeading} onChange={setCustomHeading} placeholder="Enter custom machine heading" />
                </FormGroup>
              </div>
            )}

            {/* HSN + Capacity + Power */}
            <div className="qp-spec-grid">
              <FormGroup label="HSN Code">
                <Input value={hsn} onChange={setHsn} placeholder="e.g. 84378020" />
              </FormGroup>
              <FormGroup label="Capacity (MT/hr)">
                <Input value={capacity} onChange={setCapacity} placeholder="e.g. 0.5 – 1.0" />
              </FormGroup>
              <FormGroup label="Power (HP)">
                <Input value={power} onChange={setPower} placeholder="e.g. 5.5 – 7.5" />
              </FormGroup>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 3 — Line Items
            ══════════════════════════════════════════════ */}
        <div className="qp-section">
          <div className="qp-section-header">
            <span className="qp-step-chip" aria-hidden="true">3</span>
            <h2 className="qp-section-title">Add Line Items</h2>
            {lineItems.length > 0 && (
              <span className="kvu-badge" style={{ marginLeft: 'auto' }}>{lineItems.length}</span>
            )}
          </div>
          <div className="qp-section-body">
            <LineItemsEditor
              items={lineItems}
              onChange={setLineItems}
              presetMode="chips"
              chipGroups={[
                { label: 'Quick Select — Rice Mill Models',      chipClass: '',      names: MINI_MILL_PRESETS   },
                { label: 'Quick Select — Feed Plant Components', chipClass: 'feed',  names: heading === 'MASH FEED PLANT' ? FEED_PLANT_PRESETS : [] },
                { label: 'Quick Select — Atta Chakki Models',    chipClass: 'atta',  names: heading === 'ATTA CHAKKI'     ? ATTA_CHAKKI_PRESETS  : [] },
              ].filter(g => g.names.length > 0 && (
                (g.label.includes('Rice Mill') && heading === 'MINI RICE MILL MACHINE') ||
                (g.label.includes('Feed Plant') && heading === 'MASH FEED PLANT') ||
                (g.label.includes('Atta Chakki') && heading === 'ATTA CHAKKI')
              ))}
              showGstCheckbox
              gstRate={parseFloat(gstRate) || 18}
              descLayout="inline"
              nameInputId="qpNameInput"
              qtyInputId="qpQtyInput"
            />
          </div>
        </div>

        {/* ══════════════════════════════════════════════
            SECTION 4 — Billing & Discounts
            ══════════════════════════════════════════════ */}
        <div className="qp-section">
          <div className="qp-section-header">
            <span className="qp-step-chip" aria-hidden="true">4</span>
            <h2 className="qp-section-title">Billing &amp; Discounts</h2>
          </div>
          <div className="qp-section-body">
            <div className="qp-billing-grid">
              <FormGroup label="Discount (Rs.)">
                <Input type="number" value={discount} onChange={setDiscount} placeholder="0.00" />
              </FormGroup>
              <FormGroup label="GST Rate (%)">
                <Select
                  value={gstRate}
                  onChange={setGstRate}
                  options={[
                    { value: '0',  label: '0% — Exempt' },
                    { value: '5',  label: '5% GST' },
                    { value: '12', label: '12% GST' },
                    { value: '18', label: '18% GST' },
                    { value: '28', label: '28% GST' }
                  ]}
                />
              </FormGroup>
              {/* Installation Checkbox Card */}
              <label className="qp-checkbox-card">
                <input
                  type="checkbox"
                  checked={incInst}
                  onChange={(e) => setIncInst(e.target.checked)}
                  aria-label="Include installation and trial charges"
                />
                <div>
                  <div className="qp-checkbox-card-text">Include Installation &amp; Trial Charges</div>
                  <div className="qp-checkbox-card-sub">+Rs. 25,000 extra text added to quotation</div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* ── CTA Bar ── */}
        <div className="qp-cta-bar">
          <button type="button" className="qp-cta-primary" onClick={handleGenerate}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v14a2 2 0 0 1-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {editingIndex !== undefined ? 'Update & Generate Preview' : 'Save & Generate Quotation'}
          </button>
          {editingIndex !== undefined && (
            <button type="button" className="qp-cta-secondary" onClick={handleCancelEdit}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* ── Preview Block ── */}
      {generatedQuote && (
        <div id="preview-section" className="qp-preview-section">
          <div className="qp-preview-header">
            <div className="qp-preview-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              Quotation Print Preview
              <span className="kvu-badge" style={{ background: 'var(--text-muted)', fontSize: '10px' }}>{generatedQuote.ref}</span>
            </div>
            <div className="qp-preview-actions">
              <button type="button" className="qp-preview-btn print" onClick={handlePrint}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Print
              </button>
              <button type="button" className="qp-preview-btn pdf" onClick={handleDownloadPdf}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download PDF
              </button>
              <button type="button" className="qp-preview-btn whatsapp" onClick={handleWhatsAppShare}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Share WhatsApp
              </button>
            </div>
          </div>
          <div className="qp-preview-canvas">
            <QuotationPreview quote={generatedQuote} variant={templateVariant} innerRef={printAreaRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default QuotationPage;

