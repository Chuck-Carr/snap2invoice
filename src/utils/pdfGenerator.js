import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generatePDF = async (elementRef, filename = 'invoice.pdf') => {
  if (!elementRef.current) {
    throw new Error('Element reference not found');
  }

  try {
    // Get the element to capture
    const element = elementRef.current;
    
    // Temporarily modify styles for better PDF rendering
    const originalOverflow = element.style.overflow;
    const originalMaxWidth = element.style.maxWidth;
    const originalBoxShadow = element.style.boxShadow;
    
    element.style.overflow = 'visible';
    element.style.maxWidth = 'none';
    element.style.boxShadow = 'none';

    // Create canvas from the element
    const canvas = await html2canvas(element, {
      scale: 2, // Higher scale for better quality
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      ignoreElements: (element) => {
        // Ignore any elements that might cause issues
        return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
      },
      onclone: (clonedDoc) => {
        // Fix any styling issues in the cloned document
        const clonedElement = clonedDoc.querySelector('.invoice-template');
        if (clonedElement) {
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.width = '800px';
          clonedElement.style.margin = '0';
          clonedElement.style.padding = '40px';
          clonedElement.style.fontFamily = 'Arial, Helvetica, sans-serif';
          clonedElement.style.backgroundColor = '#ffffff';
          
          // Ensure clean backgrounds
          const headers = clonedElement.querySelectorAll('[class*="bg-"]');
          headers.forEach(header => {
            if (header.classList.contains('bg-white')) {
              header.style.backgroundColor = '#ffffff';
            }
          });
          
          // Ensure table styling
          const tables = clonedElement.querySelectorAll('table');
          tables.forEach(table => {
            table.style.borderCollapse = 'collapse';
            table.style.width = '100%';
            table.style.border = '1px solid #d1d5db';
          });
          
          // Fix all colors to standard hex/rgb
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach(el => {
            // Convert any lab(), oklch(), or other modern color functions to standard colors
            const computedStyle = window.getComputedStyle(el);
            
            // Force standard colors
            el.style.color = el.style.color || computedStyle.color || '#000000';
            el.style.backgroundColor = el.style.backgroundColor || computedStyle.backgroundColor || 'transparent';
            el.style.borderColor = el.style.borderColor || computedStyle.borderColor || '#d1d5db';
            
            // Remove any CSS custom properties that might use modern color functions
            el.style.removeProperty('--tw-text-opacity');
            el.style.removeProperty('--tw-bg-opacity');
            el.style.removeProperty('--tw-border-opacity');
            
            // Ensure text colors are readable
            if (el.classList.contains('text-gray-800')) el.style.color = '#1f2937';
            if (el.classList.contains('text-gray-700')) el.style.color = '#374151';
            if (el.classList.contains('text-gray-600')) el.style.color = '#4b5563';
            if (el.classList.contains('text-gray-500')) el.style.color = '#6b7280';
            if (el.classList.contains('text-gray-400')) el.style.color = '#9ca3af';
            
            // Ensure background colors are standard
            if (el.classList.contains('bg-white')) el.style.backgroundColor = '#ffffff';
            if (el.classList.contains('bg-gray-50')) el.style.backgroundColor = '#f9fafb';
            if (el.classList.contains('bg-gray-100')) el.style.backgroundColor = '#f3f4f6';
            if (el.classList.contains('text-blue-600')) el.style.color = '#2563eb';
          });
        }
      }
    });

    // Restore original styles
    element.style.overflow = originalOverflow;
    element.style.maxWidth = originalMaxWidth;
    element.style.boxShadow = originalBoxShadow;

    // Get canvas dimensions
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 295; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    // Add the first page
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, '', 'FAST');
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, '', 'FAST');
      heightLeft -= pageHeight;
    }

    // Save the PDF
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF: ' + error.message);
  }
};

export const generatePDFBlob = async (elementRef) => {
  if (!elementRef.current) {
    throw new Error('Element reference not found');
  }

  try {
    const element = elementRef.current;
    
    // Temporarily modify styles for better PDF rendering
    const originalOverflow = element.style.overflow;
    const originalMaxWidth = element.style.maxWidth;
    const originalBoxShadow = element.style.boxShadow;
    
    element.style.overflow = 'visible';
    element.style.maxWidth = 'none';
    element.style.boxShadow = 'none';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      ignoreElements: (element) => {
        return element.tagName === 'SCRIPT' || element.tagName === 'STYLE';
      },
      onclone: (clonedDoc) => {
        const clonedElement = clonedDoc.querySelector('.invoice-template');
        if (clonedElement) {
          clonedElement.style.maxWidth = 'none';
          clonedElement.style.width = '800px';
          clonedElement.style.margin = '0';
          clonedElement.style.padding = '40px';
          clonedElement.style.fontFamily = 'Arial, Helvetica, sans-serif';
          clonedElement.style.backgroundColor = '#ffffff';
          
          // Ensure clean backgrounds
          const headers = clonedElement.querySelectorAll('[class*="bg-"]');
          headers.forEach(header => {
            if (header.classList.contains('bg-white')) {
              header.style.backgroundColor = '#ffffff';
            }
          });
          
          // Fix colors for all elements
          const allElements = clonedElement.querySelectorAll('*');
          allElements.forEach(el => {
            el.style.removeProperty('--tw-text-opacity');
            el.style.removeProperty('--tw-bg-opacity');
            el.style.removeProperty('--tw-border-opacity');
            
            if (el.classList.contains('text-gray-800')) el.style.color = '#1f2937';
            if (el.classList.contains('text-gray-700')) el.style.color = '#374151';
            if (el.classList.contains('text-gray-600')) el.style.color = '#4b5563';
            if (el.classList.contains('bg-white')) el.style.backgroundColor = '#ffffff';
            if (el.classList.contains('text-blue-600')) el.style.color = '#2563eb';
          });
        }
      }
    });

    // Restore original styles
    element.style.overflow = originalOverflow;
    element.style.maxWidth = originalMaxWidth;
    element.style.boxShadow = originalBoxShadow;

    const imgWidth = 210;
    const pageHeight = 295;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;

    const pdf = new jsPDF('p', 'mm', 'a4');
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, '', 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, '', 'FAST');
      heightLeft -= pageHeight;
    }

    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw new Error('Failed to generate PDF blob: ' + error.message);
  }
};