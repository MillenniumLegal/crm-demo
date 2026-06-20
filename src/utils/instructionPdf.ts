import jsPDF from 'jspdf';
import { Lead } from '@/types';

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

// Helper functions
function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === undefined || amount === null) return '£0.00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return '£0.00';
  return `£${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
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

// Draw rounded rectangle with light navy background
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

// Draw section title - compact, no underline
function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string): number {
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, x, y);
  
  return y + 5;
}

// Load logo
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

// Draw cover page
async function drawCoverPage(doc: jsPDF, lead: Partial<Lead> & Record<string, any>): Promise<void> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Light gray background
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  // Draw clean, compact background shapes - Two small shapes, stay near right edge only
  // Main navy shape (top right) - very compact, stays very close to right edge
  doc.setFillColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  const navySteps = 300;
  const rightEdgeStart = pageWidth * 0.80; // Start from 80% of page (right 20% area only)
  for (let i = 0; i < navySteps; i++) {
    const t = i / navySteps;
    const curveX = t * t; // Quadratic easing for smooth curve
    const x = pageWidth - (curveX * pageWidth * 0.10); // Only 10% extension
    const y = 0 + (curveX * pageHeight * 0.40); // Reduced vertical reach to 40%
    const maxWidth = Math.max(0, x - rightEdgeStart);
    const width = Math.min(12 + (curveX * 18), maxWidth); // Very small max width
    const height = 1.0; // Compact line height
    if (x > rightEdgeStart && y < pageHeight && x < pageWidth && width > 0) {
      doc.rect(x, y, width, height, 'F');
    }
  }
  
  // Purple accent shape (bottom right) - small, compact curve
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
  
  // Logo and company name (top left)
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
  
  // Company name
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('MILLENNIUM LEGAL', margin, margin + 25);
  
  // Main title - centered
  const centerY = pageHeight / 2 - 30;
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Conveyancing', pageWidth / 2, centerY, { align: 'center' });
  doc.text('Instruction', pageWidth / 2, centerY + 15, { align: 'center' });
  
  // Prepared by
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Prepared by Millennium Legal Conveyancing Ltd', pageWidth / 2, centerY + 35, { align: 'center' });
  
  // Reference
  const referenceCode = (lead as any)?.shortCode || (lead as any)?.short_code || lead.id?.substring(0, 8) || 'N/A';
  doc.setFontSize(10);
  doc.text(`Reference: ${referenceCode}`, pageWidth / 2, centerY + 50, { align: 'center' });
  
  // Date
  const instructionDate = formatFullDate(new Date().toISOString());
  doc.text(`Date: ${instructionDate}`, pageWidth / 2, centerY + 60, { align: 'center' });
  
  // Contact info (bottom left)
  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Millennium Legal Conveyancing Ltd', margin, footerY);
  doc.text('Professional Conveyancing Services', margin, footerY + 8);
  doc.text('support@millenniumlegal.co.uk', margin, footerY + 16);
}

// Main PDF builder
export async function buildInstructionPdf(lead: Partial<Lead> & Record<string, any>): Promise<PDFResult> {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  const cornerRadius = 5;
  let y = margin;

  // ============================================
  // COVER PAGE
  // ============================================
  await drawCoverPage(doc, lead);
  
  // Add new page for content
  doc.addPage();
  y = margin;

  // ============================================
  // CONTENT PAGE HEADER
  // ============================================
  
  // Light header bar with navy border
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.rect(0, 0, pageWidth, 35, 'F');
  
  // Navy bottom border
  doc.setDrawColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setLineWidth(2);
  doc.line(0, 35, pageWidth, 35);
  
  // Try to add logo
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

  // Instruction title on right
  const referenceCode = (lead as any)?.shortCode || (lead as any)?.short_code || lead.id?.substring(0, 8) || 'N/A';
  
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('INSTRUCTION FORM', pageWidth - margin, 18, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text(`Ref: ${referenceCode}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`Date: ${formatDate(new Date().toISOString())}`, pageWidth - margin, 30, { align: 'right' });
  
  y = 45;

  // ============================================
  // INSTRUCTION DETAILS
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'INSTRUCTION DETAILS');
  
  const transactionType = lead.transactionType || 'Not specified';
  const tenure = (lead as any).tenure || 'Not specified';
  const advisor = (lead as any).advisor || 'Not specified';

  const instructionBoxHeight = 24;
  drawRoundedRect(doc, margin, y, contentWidth, instructionBoxHeight, cornerRadius, true, true);
  
  doc.setFontSize(10);
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.setFont('times', 'normal');
  
  const leftCol = margin + 5;
  const labelWidth = 45;
  
  const instructionRowSpacing = 7;
  const instructionNumRows = 3;
  const instructionContentHeight = (instructionNumRows - 1) * instructionRowSpacing;
  const instructionTextY = y + (instructionBoxHeight / 2) - (instructionContentHeight / 2);
  
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Transaction Type', leftCol, instructionTextY);
  doc.text('Tenure', leftCol, instructionTextY + 7);
  doc.text('Advisor', leftCol, instructionTextY + 14);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(transactionType, leftCol + labelWidth, instructionTextY);
  doc.text(tenure, leftCol + labelWidth, instructionTextY + 7);
  doc.text(advisor, leftCol + labelWidth, instructionTextY + 14);
  
  y += instructionBoxHeight + 10;

  // ============================================
  // CLIENT DETAILS
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'CLIENT DETAILS');
  
  const clientBoxHeight = 32;
  drawRoundedRect(doc, margin, y, contentWidth, clientBoxHeight, cornerRadius, true, true);
  
  const clientName = lead.name || (lead as any).clientNames || 'Not provided';
  const clientEmail = lead.email || (lead as any).emails || 'Not provided';
  const clientPhone = lead.phone || (lead as any).phones || 'Not provided';
  const clientAddress = (lead as any).clientAddress || lead.propertyAddress || 'Not provided';
  
  const clientRowSpacing = 7;
  const clientNumRows = 4;
  const clientContentHeight = (clientNumRows - 1) * clientRowSpacing;
  const clientTextY = y + (clientBoxHeight / 2) - (clientContentHeight / 2);
  
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Client Name', leftCol, clientTextY);
  doc.text('Email', leftCol, clientTextY + 7);
  doc.text('Phone', leftCol, clientTextY + 14);
  doc.text('Correspondence Address', leftCol, clientTextY + 21);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  const nameLines = doc.splitTextToSize(clientName, contentWidth / 2 - 10);
  doc.text(nameLines[0] || 'Not provided', leftCol + labelWidth, clientTextY);
  doc.text(clientEmail, leftCol + labelWidth, clientTextY + 7);
  doc.text(clientPhone, leftCol + labelWidth, clientTextY + 14);
  const addressLines = doc.splitTextToSize(clientAddress, contentWidth / 2 - 10);
  doc.text(addressLines[0] || 'Not provided', leftCol + labelWidth, clientTextY + 21);
  
  y += clientBoxHeight + 10;

  // Check if we need a new page
  if (y > pageHeight - 150) {
    doc.addPage();
    y = margin;
  }

  // ============================================
  // TRANSACTION-SPECIFIC SECTIONS
  // ============================================
  
  const tx = (lead.transactionType || '').toLowerCase();
  
  // Purchase Details
  if (tx.includes('purchase')) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    
    y = drawSectionTitle(doc, margin, y, 'PURCHASE DETAILS');
    
    const purchaseBoxHeight = 24;
    drawRoundedRect(doc, margin, y, contentWidth, purchaseBoxHeight, cornerRadius, true, true);
    
    const purchaseAddress = (lead as any).purchasePropertyAddress || (lead as any).propertyAddress || 'Not specified';
    const purchasePrice = formatCurrency((lead as any).purchasePrice);
    const mortgageProvider = (lead as any).mortgageProvider || 'Not specified';
    
    const purchaseRowSpacing = 7;
    const purchaseNumRows = 3;
    const purchaseContentHeight = (purchaseNumRows - 1) * purchaseRowSpacing;
    const purchaseTextY = y + (purchaseBoxHeight / 2) - (purchaseContentHeight / 2);
    
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Purchase Address', leftCol, purchaseTextY);
    doc.text('Purchase Price', leftCol, purchaseTextY + 7);
    doc.text('Mortgage Provider', leftCol, purchaseTextY + 14);
    
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    const purchaseAddressLines = doc.splitTextToSize(purchaseAddress, contentWidth / 2 - 10);
    doc.text(purchaseAddressLines[0] || 'Not specified', leftCol + labelWidth, purchaseTextY);
    doc.text(purchasePrice, leftCol + labelWidth, purchaseTextY + 7);
    doc.text(mortgageProvider, leftCol + labelWidth, purchaseTextY + 14);
    
    y += purchaseBoxHeight + 10;
  }
  
  // Sale Details
  if (tx.includes('sale') && !tx.includes('purchase')) {
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
    
    y = drawSectionTitle(doc, margin, y, 'SALE DETAILS');
    
    const saleBoxHeight = 32;
    drawRoundedRect(doc, margin, y, contentWidth, saleBoxHeight, cornerRadius, true, true);
    
    const saleAddress = (lead as any).salePropertyAddress || 'Not specified';
    const salePrice = formatCurrency((lead as any).salePrice);
    const saleTenure = (lead as any).tenure || 'Not specified';
    const estateAgent = (lead as any).estateAgent || 'Not specified';
    
    const saleRowSpacing = 7;
    const saleNumRows = 4;
    const saleContentHeight = (saleNumRows - 1) * saleRowSpacing;
    const saleTextY = y + (saleBoxHeight / 2) - (saleContentHeight / 2);
    
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Sale Address', leftCol, saleTextY);
    doc.text('Sale Price', leftCol, saleTextY + 7);
    doc.text('Tenure', leftCol, saleTextY + 14);
    doc.text('Estate Agent', leftCol, saleTextY + 21);
    
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    const saleAddressLines = doc.splitTextToSize(saleAddress, contentWidth / 2 - 10);
    doc.text(saleAddressLines[0] || 'Not specified', leftCol + labelWidth, saleTextY);
    doc.text(salePrice, leftCol + labelWidth, saleTextY + 7);
    doc.text(saleTenure, leftCol + labelWidth, saleTextY + 14);
    doc.text(estateAgent, leftCol + labelWidth, saleTextY + 21);
    
    y += saleBoxHeight + 10;
  }
  
  // Remortgage Details
  if (tx.includes('remortgage')) {
    if (y > pageHeight - 120) {
      doc.addPage();
      y = margin;
    }
    
    y = drawSectionTitle(doc, margin, y, 'REMORTGAGE DETAILS');
    
    const remortgageBoxHeight = 40;
    drawRoundedRect(doc, margin, y, contentWidth, remortgageBoxHeight, cornerRadius, true, true);
    
    const propertyAddress = (lead as any).propertyAddress || 'Not specified';
    const propertyValue = formatCurrency((lead as any).propertyValue);
    const remortgageAmount = formatCurrency((lead as any).remortgageAmount);
    const lender = (lead as any).lender || 'Not specified';
    const remortgageTenure = (lead as any).tenure || 'Not specified';
    
    const remortgageRowSpacing = 7;
    const remortgageNumRows = 5;
    const remortgageContentHeight = (remortgageNumRows - 1) * remortgageRowSpacing;
    const remortgageTextY = y + (remortgageBoxHeight / 2) - (remortgageContentHeight / 2);
    
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Property Address', leftCol, remortgageTextY);
    doc.text('Property Value', leftCol, remortgageTextY + 7);
    doc.text('Remortgage Amount', leftCol, remortgageTextY + 14);
    doc.text('Lender', leftCol, remortgageTextY + 21);
    doc.text('Tenure', leftCol, remortgageTextY + 28);
    
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    const remortgageAddressLines = doc.splitTextToSize(propertyAddress, contentWidth / 2 - 10);
    doc.text(remortgageAddressLines[0] || 'Not specified', leftCol + labelWidth, remortgageTextY);
    doc.text(propertyValue, leftCol + labelWidth, remortgageTextY + 7);
    doc.text(remortgageAmount, leftCol + labelWidth, remortgageTextY + 14);
    doc.text(lender, leftCol + labelWidth, remortgageTextY + 21);
    doc.text(remortgageTenure, leftCol + labelWidth, remortgageTextY + 28);
    
    y += remortgageBoxHeight + 10;
  }

  // Check for new page before quote information
  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }

  // ============================================
  // QUOTE INFORMATION
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'QUOTE INFORMATION');
  
  const quoteBoxHeight = 32;
  drawRoundedRect(doc, margin, y, contentWidth, quoteBoxHeight, cornerRadius, true, true);
  
  const latestQuoteTotal = (lead as any).latestQuoteTotalIncVat ? formatCurrency((lead as any).latestQuoteTotalIncVat) : 'Not available';
  const latestLegalFee = (lead as any).latestLegalFeeExVat ? formatCurrency((lead as any).latestLegalFeeExVat) : 'Not available';
  
  const quoteRowSpacing = 7;
  const quoteNumRows = 4;
  const quoteContentHeight = (quoteNumRows - 1) * quoteRowSpacing;
  const quoteTextY = y + (quoteBoxHeight / 2) - (quoteContentHeight / 2);
  
  doc.setFontSize(10);
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Lead Reference', leftCol, quoteTextY);
  doc.text('Transaction Type', leftCol, quoteTextY + 7);
  doc.text('Quote Total (incl. VAT)', leftCol, quoteTextY + 14);
  doc.text('Legal Fee (ex VAT)', leftCol, quoteTextY + 21);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(referenceCode, leftCol + labelWidth, quoteTextY);
  doc.text(transactionType, leftCol + labelWidth, quoteTextY + 7);
  doc.text(latestQuoteTotal, leftCol + labelWidth, quoteTextY + 14);
  doc.text(latestLegalFee, leftCol + labelWidth, quoteTextY + 21);
  
  y += quoteBoxHeight + 10;

  // ============================================
  // FOOTER - Add to all pages
  // ============================================
  
  const totalPages = doc.getNumberOfPages();
  
  // Add footer to all pages
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    
    const footerY = pageHeight - 20;
    
    // Bottom border
    doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
    doc.setLineWidth(0.3);
    doc.line(margin, footerY + 5, pageWidth - margin, footerY + 5);
    
    // Company info and page number
    doc.setFontSize(7);
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Millennium Legal Conveyancing Ltd | Professional Conveyancing Services', margin, footerY + 12);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY + 12, { align: 'right' });
    
    // Disclaimer text only on last page
    if (pageNum === totalPages) {
      doc.setFontSize(8);
      doc.setFont('times', 'italic');
      doc.text('This instruction form is prepared for guidance and may be subject to change based on client circumstances.', margin, footerY - 5, { maxWidth: contentWidth, align: 'left' });
      
      // Generation date only on last page
      const generationDate = formatDate(new Date().toISOString());
      doc.setFont('times', 'normal');
      doc.text(`Generated on ${generationDate}`, margin, footerY);
    }
  }
  
  // Return to last page
  doc.setPage(totalPages);

  // ============================================
  // GENERATE FILENAME
  // ============================================
  
  const leadFirstName = clientName.split(' ')[0] || 'Instruction';
  const cleanFirstName = leadFirstName.replace(/[^a-zA-Z0-9]/g, '');
  const fileName = `Instruction_${referenceCode}_${cleanFirstName}.pdf`;

  return { doc, fileName };
}
