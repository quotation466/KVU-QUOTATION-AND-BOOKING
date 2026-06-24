import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuotationRepository, type Quotation } from '../repositories/QuotationRepository';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { QuotationPreview } from '../components/QuotationPreview';
import { PDFService } from '../services/PDFService';
import { formatCurrency } from '../utils/numberToWords';
import { PrintService } from '../utils/PrintService';
import { DataTable } from '../components/DataTable';
import '../styles/HistoryPage.css';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const printAreaRef = useRef<HTMLDivElement>(null);

  const [history, setHistory] = useState<Quotation[]>([]);
  
  // Modal State for Previewing
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const templateVariant = 'classic';

  // Load history on mount
  useEffect(() => {
    const loadData = async () => {
      const data = await QuotationRepository.getHistory();
      setHistory(data);
    };
    loadData();
  }, []);

  // Action: View/Reprint Modal
  const handleView = (quote: Quotation) => {
    setSelectedQuote(quote);
    setIsModalOpen(true);
  };

  // Action: Edit (route to /quotation with state)
  const handleEdit = (quote: Quotation, origIdx: number) => {
    navigate('/quotation', { state: { editQuotation: { quotation: quote, index: origIdx } } });
  };

  // Action: Delete Quotation
  const handleDelete = async (origIdx: number, ref: string) => {
    if (window.confirm(`⚠️ Are you sure you want to delete Reference ${ref}?`)) {
      const updatedHistory = await QuotationRepository.deleteQuotation(origIdx, ref);
      setHistory(updatedHistory);
    }
  };

  // PDF Export from Modal
  const handleDownloadPdf = async () => {
    if (!selectedQuote || !printAreaRef.current) return;
    const cleanRef = selectedQuote.ref.replace(/\//g, '-');
    const fileName = `KVU_Quotation_${cleanRef}.pdf`;
    
    await PDFService.downloadPdf(printAreaRef.current, fileName, false);
  };

  // WhatsApp Share from Modal
  const handleWhatsAppShare = async () => {
    if (!selectedQuote || !printAreaRef.current) return;
    await PDFService.shareWhatsApp(
      printAreaRef.current,
      selectedQuote.custName,
      selectedQuote.ref,
      String(selectedQuote.grandTotal),
      selectedQuote.mobile || '',
      selectedQuote.date,
      selectedQuote.heading,
      (msg) => console.log('[Share Toast]', msg),
      false
    );
  };

  const handlePrint = async () => {
    const content = document.getElementById('pdfCapture') as HTMLElement;
    if (content) {
      await PrintService.printElement(content, false);
    }
  };

  // DataTable columns definition
  const columns = [
    {
      key: 'serial',
      header: 'S.No',
      render: (_: any, idx: number) => <span>{idx + 1}</span>,
      sortable: false
    },
    {
      key: 'ref',
      header: 'Ref Number',
      sortable: true,
      render: (q: Quotation) => <span style={{ fontWeight: '600' }}>{q.ref}</span>
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true
    },
    {
      key: 'custName',
      header: 'Customer Name',
      sortable: true,
      render: (q: Quotation) => <span style={{ fontWeight: '600' }}>{q.custName}</span>
    },
    {
      key: 'district',
      header: 'District',
      sortable: true,
      render: (q: Quotation) => <span>{q.district || '—'}</span>
    },
    {
      key: 'grandTotal',
      header: 'Grand Total',
      sortable: true,
      sortValue: (q: Quotation) => q.grandTotal || 0,
      render: (q: Quotation) => <span style={{ fontWeight: '700' }}>Rs. {formatCurrency(q.grandTotal)}</span>
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      render: (q: Quotation, idx: number) => (
        <div className="history-actions-wrapper">
          <button
            className="history-action-btn view"
            onClick={() => handleView(q)}
          >
            👁️ View
          </button>
          <button
            className="history-action-btn edit"
            onClick={() => handleEdit(q, idx)}
          >
            ✏️ Edit
          </button>
          <button
            className="history-action-btn delete"
            onClick={() => handleDelete(idx, q.ref)}
          >
            🗑️ Delete
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="tab-panel history-container">
      
      {/* Header Banner */}
      <div className="history-header-row">
        <div className="history-title-section">
          <h1>Quotation History</h1>
          <p>Browse and reprint previously saved customer quotations.</p>
        </div>

        <div className="history-counter-box">
          <span className="history-counter-label">Total Quotations:</span>
          <span className="history-counter-badge">
            {history.length}
          </span>
        </div>
      </div>

      {/* Main Quotation List Table */}
      <DataTable
        data={history}
        columns={columns}
        searchPlaceholder="Search Ref, Customer Name, Date or District..."
        searchFields={['ref', 'custName', 'date', 'district']}
        exportFileName="quotation-history"
      />

      {/* Modal for Reprint/Preview */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`Reprint Quotation - ${selectedQuote?.ref}`}
        size="lg"
      >
        {selectedQuote && (
          <div>
             <div className="history-modal-actions">
              <Button variant="primary" onClick={handlePrint}>🖨️ Print Dialog</Button>
              <Button variant="success" onClick={handleDownloadPdf}>📥 Download PDF</Button>
              <Button variant="outline" onClick={handleWhatsAppShare}>💬 Share WhatsApp</Button>
            </div>
            
            <div className="history-modal-preview-wrapper">
              <QuotationPreview quote={selectedQuote} variant={templateVariant} innerRef={printAreaRef} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default HistoryPage;
