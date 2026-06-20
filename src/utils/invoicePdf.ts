import jsPDF from 'jspdf';
import { PaymentRecord } from '@/services/paymentsService';

interface PDFResult {
  doc: jsPDF;
  fileName: string;
}

// Millennium Legal Conveyancing Ltd brand colors (Millennium Legal palette; matches quote PDF)
const COLORS = {
  navy: [1, 30, 65],           // #011E41 - Primary brand color
  navyLight: [230, 238, 247],  // Light #011E41 - Light navy tint
  purple: [55, 48, 163],       // #3730A3 - Secondary brand color
  white: [255, 255, 255],     // #FFFFFF - White
  lightGray: [248, 248, 249],  // #F8F8F9 - Light background
  darkText: [31, 41, 55],      // #1F2937 - Primary text
  mediumGray: [107, 114, 128], // #6B7280 - Secondary text
  border: [229, 231, 235],     // #E5E7EB - Borders
};

function formatCurrency(amount: number): string {
  return `£${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

function formatDate(dateString?: string | null): string {
  if (!dateString) return 'Not specified';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

function formatFullDate(dateString?: string | null): string {
  if (!dateString) return 'Not specified';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return 'Invalid date';
  }
}

function drawRoundedRect(doc: jsPDF, x: number, y: number, width: number, height: number, radius: number, fill?: boolean, stroke?: boolean) {
  if (fill) {
    doc.setFillColor(COLORS.navyLight[0], COLORS.navyLight[1], COLORS.navyLight[2]);
  }
  if (stroke) {
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.5);
  }
  
  const operation = fill && stroke ? 'FD' : fill ? 'F' : 'S';
  doc.roundedRect(x, y, width, height, radius, radius, operation);
}

function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string): number {
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
  
  return y + 5;
}

async function loadLogoAsBase64(): Promise<{ dataUrl: string; width: number; height: number } | null> {
  try {
    const logoPaths = [
      '/millennium-legal-logo.svg',
      '/logo.svg',
      '/images/logo.svg',
    ];
    
    for (const path of logoPaths) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          const svgText = await response.text();
          return await convertSvgToBase64(svgText);
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error('Error loading logo:', error);
    return null;
  }
}

async function convertSvgToBase64(svgText: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.width || 300) * 2;
      canvas.height = (img.height || 100) * 2;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
        const pngDataUrl = canvas.toDataURL('image/png', 1.0);
        URL.revokeObjectURL(url);
        
        const mmWidth = (canvas.width / 2) / 3.779527559;
        const mmHeight = (canvas.height / 2) / 3.779527559;
        
        resolve({ dataUrl: pngDataUrl, width: mmWidth, height: mmHeight });
      } else {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    
    img.src = url;
  });
}

async function drawCoverPage(doc: jsPDF, payment: PaymentRecord): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Light gray background
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Decorative shapes
  doc.setFillColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  const navySteps = 300;
  const rightEdgeStart = pageWidth * 0.80;
  for (let i = 0; i < navySteps; i++) {
    const t = i / navySteps;
    const curveX = t * t;
    const x = pageWidth - (curveX * pageWidth * 0.10);
    const y = 0 + (curveX * pageHeight * 0.40);
    const maxWidth = Math.max(0, x - rightEdgeStart);
    const width = Math.min(12 + (curveX * 18), maxWidth);
    const height = 1.0;
    if (x > rightEdgeStart && y < pageHeight && x < pageWidth && width > 0) {
      doc.rect(x, y, width, height, 'F');
    }
  }
  
  doc.setFillColor(COLORS.purple[0], COLORS.purple[1], COLORS.purple[2]);
  const purpleSteps = 280;
  for (let i = 0; i < purpleSteps; i++) {
    const t = i / purpleSteps;
    const curveX = t * t;
    const x = pageWidth - (curveX * pageWidth * 0.10);
    const y = pageHeight - (curveX * pageHeight * 0.3);
    const maxWidth = Math.max(0, x - rightEdgeStart);
    const width = Math.min(10 + (curveX * 18), maxWidth);
    const height = 1.0;
    if (x > rightEdgeStart && y > 0 && x < pageWidth && width > 0) {
      doc.rect(x, y, width, height, 'F');
    }
  }
  
  // Logo and company name
  const margin = 30;
  try {
    const logoData = await loadLogoAsBase64();
    if (logoData) {
      const logoScale = 0.4;
      const logoW = logoData.width * logoScale;
      const logoH = logoData.height * logoScale;
      doc.addImage(logoData.dataUrl, 'PNG', margin, margin, logoW, logoH);
    }
  } catch (error) {
    // Fallback
  }
  
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MILLENNIUM LEGAL', margin, margin + 25);
  
  // Main title
  const centerY = pageHeight / 2 - 30;
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Invoice', pageWidth / 2, centerY, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Prepared by Millennium Legal Conveyancing Ltd', pageWidth / 2, centerY + 35, { align: 'center' });
  
  // Invoice reference
  doc.setFontSize(10);
  doc.text(`Invoice Number: ${payment.id}`, pageWidth / 2, centerY + 50, { align: 'center' });
  
  // Date
  const invoiceDate = formatFullDate(payment.issuedAt);
  doc.text(`Date: ${invoiceDate}`, pageWidth / 2, centerY + 60, { align: 'center' });
  
  // Contact info
  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Millennium Legal Conveyancing Ltd', margin, footerY);
  doc.text('Professional Conveyancing Services', margin, footerY + 8);
  doc.text('support@millenniumlegal.co.uk', margin, footerY + 16);
}

export async function buildInvoicePdf(payment: PaymentRecord, _leadData?: any, _quoteData?: any): Promise<PDFResult> {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  const cornerRadius = 5;
  let y = margin;

  // Cover page
  await drawCoverPage(doc, payment);
  
  // Add new page for content
  doc.addPage();
  y = margin;

  // Content page header
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  doc.setDrawColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setLineWidth(2);
  doc.line(0, 35, pageWidth, 35);
  
  try {
    const logoData = await loadLogoAsBase64();
    if (logoData) {
      const logoScale = 0.25;
      const logoW = logoData.width * logoScale;
      const logoH = logoData.height * logoScale;
      const logoX = margin;
      const logoY = (35 - logoH) / 2;
      doc.addImage(logoData.dataUrl, 'PNG', logoX, logoY, logoW, logoH);
    } else {
      doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MILLENNIUM LEGAL', margin, 20);
    }
  } catch (error) {
    doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MILLENNIUM LEGAL', margin, 20);
  }

  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth - margin, 18, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text(`Invoice: ${payment.id}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`Date: ${formatDate(payment.issuedAt)}`, pageWidth - margin, 30, { align: 'right' });
  
  y = 45;

  // Invoice details
  y = drawSectionTitle(doc, margin, y, 'INVOICE DETAILS');
  
  const invoiceBoxHeight = 24;
  drawRoundedRect(doc, margin, y, contentWidth, invoiceBoxHeight, cornerRadius, true, true);
  
  doc.setFontSize(10);
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.setFont('times', 'normal');
  
  const leftCol = margin + 5;
  const labelWidth = 45;
  
  const invoiceRowSpacing = 7;
  const invoiceNumRows = 3;
  const invoiceContentHeight = (invoiceNumRows - 1) * invoiceRowSpacing;
  const invoiceTextY = y + (invoiceBoxHeight / 2) - (invoiceContentHeight / 2);
  
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Invoice Number', leftCol, invoiceTextY);
  doc.text('Status', leftCol, invoiceTextY + 7);
  doc.text('Currency', leftCol, invoiceTextY + 14);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(payment.id, leftCol + labelWidth, invoiceTextY);
  doc.text(payment.status, leftCol + labelWidth, invoiceTextY + 7);
  doc.text(payment.currency || 'GBP', leftCol + labelWidth, invoiceTextY + 14);
  
  y += invoiceBoxHeight + 10;

  // Client details
  y = drawSectionTitle(doc, margin, y, 'CLIENT DETAILS');
  
  const clientBoxHeight = 24;
  drawRoundedRect(doc, margin, y, contentWidth, clientBoxHeight, cornerRadius, true, true);
  
  const clientName = payment.leadName || 'Not provided';
  const clientEmail = payment.leadEmail || 'Not provided';
  
  const clientRowSpacing = 7;
  const clientNumRows = 2;
  const clientContentHeight = (clientNumRows - 1) * clientRowSpacing;
  const clientTextY = y + (clientBoxHeight / 2) - (clientContentHeight / 2);
  
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Client Name', leftCol, clientTextY);
  doc.text('Email', leftCol, clientTextY + 7);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(clientName, leftCol + labelWidth, clientTextY);
  doc.text(clientEmail, leftCol + labelWidth, clientTextY + 7);
  
  y += clientBoxHeight + 10;

  // Payment summary
  y = drawSectionTitle(doc, margin, y, 'PAYMENT SUMMARY');
  
  const summaryBoxHeight = 24;
  drawRoundedRect(doc, margin, y, contentWidth, summaryBoxHeight, cornerRadius, true, true);
  
  const summaryRowSpacing = 7;
  const summaryNumRows = 3;
  const summaryContentHeight = (summaryNumRows - 1) * summaryRowSpacing;
  const summaryTextY = y + (summaryBoxHeight / 2) - (summaryContentHeight / 2);
  
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Amount', leftCol, summaryTextY);
  doc.text('Issued Date', leftCol, summaryTextY + 7);
  if (payment.paidAt) {
    doc.text('Paid Date', leftCol, summaryTextY + 14);
  }
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(formatCurrency(payment.amount), leftCol + labelWidth, summaryTextY);
  doc.text(formatDate(payment.issuedAt), leftCol + labelWidth, summaryTextY + 7);
  if (payment.paidAt) {
    doc.text(formatDate(payment.paidAt), leftCol + labelWidth, summaryTextY + 14);
  }
  
  y += summaryBoxHeight + 10;

  // Total box
  const totalBoxHeight = 14;
  doc.setFillColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.roundedRect(margin, y, contentWidth, totalBoxHeight, cornerRadius, cornerRadius, 'F');
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text('Total Amount', leftCol + 3, y + 10);
  doc.text(formatCurrency(payment.amount), pageWidth - margin - 3, y + 10, { align: 'right' });
  
  y += totalBoxHeight + 10;

  // Footer
  const totalPages = doc.getNumberOfPages();
  
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    
    const footerY = pageHeight - 20;
    
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY + 5, pageWidth - margin, footerY + 5);
    
    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Millennium Legal Conveyancing Ltd | Professional Conveyancing Services', margin, footerY + 12);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY + 12, { align: 'right' });
    
    if (pageNum === totalPages) {
      doc.setFontSize(8);
      doc.setFont('times', 'italic');
      doc.text('This invoice is prepared for guidance and may be subject to change based on client circumstances.', margin, footerY - 5, { maxWidth: contentWidth, align: 'left' });
      
      const generationDate = formatDate(new Date().toISOString());
      doc.setFont('times', 'normal');
      doc.text(`Generated on ${generationDate}`, margin, footerY);
    }
  }
  
  doc.setPage(totalPages);

  const fileName = `Invoice_${payment.id}_${clientName.replace(/[^a-zA-Z0-9]/g, '')}.pdf`;

  return { doc, fileName };
}

