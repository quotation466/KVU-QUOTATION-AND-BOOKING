export const PrintService = {
  /**
   * Prints the contents of a specific DOM element using an isolated iframe.
   * This bypasses any complex CSS layout issues in the main React application.
   * 
   * @param element The DOM element to print
   * @param isThermal Whether this is a thermal print (adjusts margins)
   */
  printElement: (element: HTMLElement, isThermal: boolean = false) => {
    return new Promise<void>((resolve, reject) => {
      try {
        const originalId = element.id;
        const tempId = originalId || 'print-target-' + Date.now();
        
        // Temporarily assign ID to guarantee we can select it
        if (!originalId) {
          element.id = tempId;
        }
        const printContent = element.outerHTML;
        // Restore
        if (!originalId) {
          element.removeAttribute('id');
        }

        const printWindow = document.createElement('iframe');
        
        // Hide the iframe
        printWindow.style.position = 'absolute';
        printWindow.style.top = '-10000px';
        printWindow.style.left = '-10000px';
        printWindow.style.width = '0px';
        printWindow.style.height = '0px';
        
        document.body.appendChild(printWindow);

        // Copy all styles from the parent document and resolve links to absolute URLs
        const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
          .map(s => {
            if (s.tagName === 'LINK') {
              const href = (s as HTMLLinkElement).href;
              return `<link rel="stylesheet" href="${href}">`;
            }
            return s.outerHTML;
          })
          .join('\n');

        // Page margin logic based on thermal vs A4
        const pageCss = isThermal 
          ? `@page { margin: 0; } body { margin: 0; padding: 5px; width: 80mm; }` 
          : `@page { margin: 10mm; size: A4; } body { margin: 0; padding: 0; }`;

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Print Receipt</title>
              ${styles}
              <style>
                ${pageCss}
                /* Ensure background colors and images print */
                * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                
                /* Force visibility of the print target and override any display: none rules */
                #${tempId} {
                  display: block !important;
                  visibility: visible !important;
                }
                
                ${isThermal ? `
                  #${tempId} {
                    width: 100% !important;
                    max-width: 80mm !important;
                    margin: 0 auto !important;
                    padding: 5px !important;
                    box-sizing: border-box !important;
                  }
                ` : ''}

                /* Hide anything else just in case */
                body > *:not(#${tempId}) {
                  display: none !important;
                }
              </style>
            </head>
            <body>
              ${printContent}
            </body>
          </html>
        `;

        const doc = printWindow.contentDocument || printWindow.contentWindow?.document;
        if (!doc) {
          throw new Error('Could not access iframe document');
        }

        doc.open();
        doc.write(html);
        doc.close();

        // Wait a short moment for images and styles to load in the iframe
        setTimeout(() => {
          if (printWindow.contentWindow) {
            printWindow.contentWindow.focus();
            printWindow.contentWindow.print();
          }
          // Cleanup iframe after print dialog closes
          setTimeout(() => {
            if (document.body.contains(printWindow)) {
              document.body.removeChild(printWindow);
            }
            resolve();
          }, 1000);
        }, 500);

      } catch (error) {
        console.error('[PrintService] Error during print:', error);
        reject(error);
      }
    });
  }
};
