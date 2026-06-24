import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const PDFService = {
  // Generate and download PDF directly using standard window.print() fallback or canvas
  downloadPdf: async (
    captureTarget: HTMLElement, 
    fileName: string, 
    wrapInA4Border: boolean = true
  ): Promise<boolean> => {
    try {
      let canvas: HTMLCanvasElement;

      if (wrapInA4Border) {
        const parent = captureTarget.parentNode;
        const nextSibling = captureTarget.nextSibling;

        if (!parent) return false;

        // Recreate the double border wrapper for html2canvas to look identical to A4 print
        const outerWrap = document.createElement('div');
        outerWrap.style.padding = '3px';
        outerWrap.style.border = '3px solid #000';
        outerWrap.style.width = '210mm';
        outerWrap.style.background = '#fff';
        outerWrap.style.boxSizing = 'border-box';

        const innerWrap = document.createElement('div');
        innerWrap.style.border = '1px solid #000';
        innerWrap.style.padding = '6mm 7mm';
        innerWrap.style.boxSizing = 'border-box';

        innerWrap.appendChild(captureTarget);
        outerWrap.appendChild(innerWrap);

        if (nextSibling) {
          parent.insertBefore(outerWrap, nextSibling);
        } else {
          parent.appendChild(outerWrap);
        }

        try {
          canvas = await html2canvas(outerWrap, { scale: 2, useCORS: true });
        } finally {
          // Restore elements back immediately
          if (nextSibling) {
            parent.insertBefore(captureTarget, outerWrap);
          } else {
            parent.appendChild(captureTarget);
          }
          parent.removeChild(outerWrap);
        }
      } else {
        canvas = await html2canvas(captureTarget, { scale: 2, useCORS: true });
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const orientation = canvas.width > canvas.height ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(fileName);
      return true;
    } catch (err) {
      console.error('[PDFService] Error generating PDF:', err);
      return false;
    }
  },

  // Share via WhatsApp with PDF generation fallback
  shareWhatsApp: async (
    captureTarget: HTMLElement,
    custName: string,
    refText: string,
    grandTotal: string,
    mobileNum: string,
    dateText: string,
    headingText: string,
    toastFn: (msg: string) => void,
    wrapInA4Border: boolean = true
  ): Promise<void> => {
    const textMsg = `📄 *Quotation Details*\n` +
      `🏢 *KRISHI VIKAS UDYOG*\n\n` +
      `👤 Customer: ${custName}\n` +
      `📅 Date: ${dateText}\n` +
      `🛒 Ref No: ${refText}\n` +
      `📦 Item: ${headingText}\n\n` +
      `💰 *Grand Total: Rs. ${grandTotal}*\n\n` +
      `Please find the attached PDF Quotation! 🙏`;

    let whatsappUrl = 'https://wa.me/';
    const cleanMobile = mobileNum.replace(/\D/g, '');
    if (cleanMobile && cleanMobile.length === 10) {
      whatsappUrl += `91${cleanMobile}`;
    }
    whatsappUrl += `?text=${encodeURIComponent(textMsg)}`;

    toastFn('⏳ Generating PDF for Sharing...');

    try {
      let canvas: HTMLCanvasElement;

      if (wrapInA4Border) {
        const parent = captureTarget.parentNode;
        const nextSibling = captureTarget.nextSibling;
        if (!parent) return;

        const outerWrap = document.createElement('div');
        outerWrap.style.padding = '3px';
        outerWrap.style.border = '3px solid #000';
        outerWrap.style.width = '210mm';
        outerWrap.style.background = '#fff';
        outerWrap.style.boxSizing = 'border-box';

        const innerWrap = document.createElement('div');
        innerWrap.style.border = '1px solid #000';
        innerWrap.style.padding = '6mm 7mm';
        innerWrap.style.boxSizing = 'border-box';

        innerWrap.appendChild(captureTarget);
        outerWrap.appendChild(innerWrap);

        if (nextSibling) {
          parent.insertBefore(outerWrap, nextSibling);
        } else {
          parent.appendChild(outerWrap);
        }

        try {
          canvas = await html2canvas(outerWrap, { scale: 2, useCORS: true });
        } finally {
          // Restore wrappers back immediately
          if (nextSibling) {
            parent.insertBefore(captureTarget, outerWrap);
          } else {
            parent.appendChild(captureTarget);
          }
          parent.removeChild(outerWrap);
        }
      } else {
        canvas = await html2canvas(captureTarget, { scale: 2, useCORS: true });
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const orientation = canvas.width > canvas.height ? 'l' : 'p';
      const pdf = new jsPDF(orientation, 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const blob = pdf.output('blob');
      const fileName = `KVU_Quotation_${refText.replace(/\//g, '-')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });

      // Check if browser supports direct file sharing (mobile native share tray)
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Quotation PDF',
          text: textMsg
        });
        toastFn('✅ Mobile Share Dialog Opened!');
      } else {
        // Fallback for Desktop: Copy image to clipboard and open WhatsApp URL
        toastFn('📋 Copying image to clipboard... Opening WhatsApp Web...');
        canvas.toBlob(async (blobImg) => {
          if (blobImg) {
            try {
              // Copy image to clipboard so user can press Ctrl+V in WhatsApp Web
              const item = new ClipboardItem({ 'image/png': blobImg });
              await navigator.clipboard.write([item]);
            } catch (clipErr) {
              console.warn('[PDFService] Clipboard write failed:', clipErr);
            }
          }
          window.open(whatsappUrl, '_blank');
        }, 'image/png');
      }
    } catch (err) {
      console.error('[PDFService] Error in shareWhatsApp:', err);
      alert('❌ Sharing failed: ' + (err as Error).message);
    }
  }
};
