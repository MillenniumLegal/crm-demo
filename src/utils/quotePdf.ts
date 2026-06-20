import jsPDF from 'jspdf';
import { Quote } from '@/services/quotesService';

interface PDFResult {
  doc: jsPDF;
  fileName: string;
}

// Millennium Legal Conveyancing Ltd brand colors (Millennium Legal palette)
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
function parseFee(fee: string | number | undefined | null): number {
  if (fee === undefined || fee === null) return 0;
  if (typeof fee === 'number') return fee;
  const parsed = parseFloat(String(fee).replace(/[^\d.-]/g, ''));
  return isNaN(parsed) ? 0 : parsed;
}

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

// Draw rounded rectangle with light navy background
function drawRoundedRect(doc: jsPDF, x: number, y: number, width: number, height: number, radius: number, fill?: boolean, stroke?: boolean) {
  if (fill) {
    // Light navy background for section content boxes
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
  
  return y + 5; // More compact spacing
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
async function drawCoverPage(doc: jsPDF, quote: Quote): Promise<void> {
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
    // Smooth quadratic curve from top right, very constrained to right edge
    const curveX = t * t; // Quadratic easing for smooth curve
    const x = pageWidth - (curveX * pageWidth * 0.10); // Only 10% extension (stays very close to edge)
    const y = 0 + (curveX * pageHeight * 0.40); // Reduced vertical reach to 40%
    // Small, compact width that stays on right side only
    const maxWidth = Math.max(0, x - rightEdgeStart); // Don't go past 80% mark
    const width = Math.min(12 + (curveX * 18), maxWidth); // Very small max width (max 30mm)
    const height = 1.0; // Compact line height
    if (x > rightEdgeStart && y < pageHeight && x < pageWidth && width > 0) {
      doc.rect(x, y, width, height, 'F');
    }
  }
  
  // Purple accent shape (bottom right) - small, compact curve, stays very close to right edge
  doc.setFillColor(COLORS.purple[0], COLORS.purple[1], COLORS.purple[2]);
  const purpleSteps = 280;
  for (let i = 0; i < purpleSteps; i++) {
    const t = i / purpleSteps;
    const curveX = t * t; // Smooth quadratic curve
    const x = pageWidth - (curveX * pageWidth * 0.10); // Only 10% extension (matches navy shape)
    const y = pageHeight - (curveX * pageHeight * 0.3); // Reduced vertical reach to 30%
    // Small, compact width that stays on right side only
    const maxWidth = Math.max(0, x - rightEdgeStart); // Don't go past 80% mark
    const width = Math.min(10 + (curveX * 18), maxWidth); // Very small max width (max 28mm)
    const height = 1.0; // Compact line height
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
  doc.text('Quote', pageWidth / 2, centerY + 15, { align: 'center' });
  
  // Prepared by
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Prepared by Millennium Legal Conveyancing Ltd', pageWidth / 2, centerY + 35, { align: 'center' });
  
  // Quote reference
  const referenceCode = quote.lead?.shortCode || quote.leadShortCode || quote.shortCode || quote.id?.substring(0, 8) || 'N/A';
  doc.setFontSize(10);
  doc.text(`Reference: ${referenceCode}`, pageWidth / 2, centerY + 50, { align: 'center' });
  
  // Date
  const quoteDate = formatFullDate(quote.createdAt);
  doc.text(`Date: ${quoteDate}`, pageWidth / 2, centerY + 60, { align: 'center' });
  
  // Contact info (bottom left)
  const footerY = pageHeight - 40;
  doc.setFontSize(9);
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Millennium Legal Conveyancing Ltd', margin, footerY);
  doc.text('Professional Conveyancing Services', margin, footerY + 8);
  doc.text('support@millenniumlegal.co.uk', margin, footerY + 16);
  }

// Main PDF builder
export async function buildQuotePdf(quote: Quote): Promise<PDFResult> {
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
  await drawCoverPage(doc, quote);
  
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

  // Quote title on right
  const referenceCode = quote.lead?.shortCode || quote.leadShortCode || quote.shortCode || quote.id?.substring(0, 8) || 'N/A';
  const status = quote.status || 'Draft';
  
  doc.setTextColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('QUOTATION', pageWidth - margin, 18, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text(`Ref: ${referenceCode}`, pageWidth - margin, 25, { align: 'right' });
  doc.text(`Status: ${status}`, pageWidth - margin, 30, { align: 'right' });
  
  y = 45;

  // ============================================
  // QUOTE OVERVIEW
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'QUOTE OVERVIEW');
  
  const version = quote.version ? `v${quote.version}` : 'v1';
  const quoteType = quote.transactionType || quote.quoteType || 'Not specified';
  const createdDate = formatDate(quote.createdAt);
  const updatedDate = formatDate(quote.updatedAt || quote.createdAt);

  // Calculate height based on number of rows (removed Reference and Status - 4 rows remaining)
  const overviewBoxHeight = 32;
  drawRoundedRect(doc, margin, y, contentWidth, overviewBoxHeight, cornerRadius, true, true);
  
  doc.setFontSize(10);
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.setFont('times', 'normal');
  
  const leftCol = margin + 5;
  const labelWidth = 45;
  
    // Calculate content height and center it vertically
    const overviewRowSpacing = 7;
    const overviewNumRows = 4;
    const overviewContentHeight = (overviewNumRows - 1) * overviewRowSpacing;
    const overviewTextY = y + (overviewBoxHeight / 2) - (overviewContentHeight / 2);
  
  // Vertical arrangement - all in one column
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Version', leftCol, overviewTextY);
  doc.text('Quote Type', leftCol, overviewTextY + 7);
  doc.text('Created', leftCol, overviewTextY + 14);
  doc.text('Last Updated', leftCol, overviewTextY + 21);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(version, leftCol + labelWidth, overviewTextY);
  doc.text(quoteType, leftCol + labelWidth, overviewTextY + 7);
  doc.text(createdDate, leftCol + labelWidth, overviewTextY + 14);
  doc.text(updatedDate, leftCol + labelWidth, overviewTextY + 21);
  
  y += overviewBoxHeight + 10; // Reduced from 15

  // ============================================
  // CLIENT DETAILS
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'CLIENT DETAILS');
  
  const clientBoxHeight = 32;
  drawRoundedRect(doc, margin, y, contentWidth, clientBoxHeight, cornerRadius, true, true);
  
  const clientName = quote.lead?.name || quote.leadName || 'Not provided';
  const clientEmail = quote.lead?.email || quote.leadEmail || 'Not provided';
  const clientPhone = quote.lead?.phone || quote.leadPhone || 'Not provided';
  
  // Calculate content height and center it vertically
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
  doc.text('Lead Reference', leftCol, clientTextY + 21);
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(clientName, leftCol + labelWidth, clientTextY);
  doc.text(clientEmail, leftCol + labelWidth, clientTextY + 7);
  doc.text(clientPhone, leftCol + labelWidth, clientTextY + 14);
  doc.text(referenceCode, leftCol + labelWidth, clientTextY + 21);
  
  y += clientBoxHeight + 10; // Reduced from 15

  // Calculate fees (needed for supplements and disbursements display)
  const legalFeeExVat = parseFee(quote.legalFeeExVat || quote.legalFee);
  const legalFeeIncVat = parseFee(quote.legalFeeIncVat || (legalFeeExVat * 1.2));
  const supplements = quote.supplements || [];
  const disbursements = quote.disbursements || [];
  const supplementTotal = supplements.reduce((sum, item) => sum + parseFee(item.fee), 0);
  const disbursementTotal = disbursements.reduce((sum, item) => sum + parseFee(item.fee), 0);
  const vatAmount = parseFee(quote.vatAmount || (legalFeeIncVat - legalFeeExVat));
  const totalExVat = parseFee(quote.totalExVat || quote.netAmount || (legalFeeExVat + supplementTotal + disbursementTotal));
  const totalIncVat = parseFee(quote.totalAmount || quote.totalIncVat || (totalExVat + vatAmount));

  // Check if we need a new page
  if (y > pageHeight - 150) {
    doc.addPage();
    y = margin;
  }

  // ============================================
  // SUPPLEMENTS
  // ============================================
  
  if (supplements.length > 0) {
    y = drawSectionTitle(doc, margin, y, `SUPPLEMENTS (${supplements.length})`);
    
    const validSupplements = supplements.filter(item => parseFee(item.fee) > 0);
    const supplementBoxHeight = Math.min((validSupplements.length * 7) + 10, pageHeight - y - 50);
    drawRoundedRect(doc, margin, y, contentWidth, supplementBoxHeight, cornerRadius, true, true);
  
    // Calculate content height and center it vertically
    const supplementRowSpacing = 7;
    const supplementNumRows = validSupplements.length;
    const supplementContentHeight = supplementNumRows > 0 ? (supplementNumRows - 1) * supplementRowSpacing : 0;
    const supplementTextY = supplementNumRows > 0 ? y + (supplementBoxHeight / 2) - (supplementContentHeight / 2) : y + supplementBoxHeight / 2;
    
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    
    let currentY = supplementTextY;
    validSupplements.forEach((item) => {
      const fee = parseFee(item.fee);
      doc.text(item.name || 'Supplement', leftCol, currentY);
      doc.text(formatCurrency(fee), pageWidth - margin - 5, currentY, { align: 'right' });
      currentY += 7;
    });
    
    y += supplementBoxHeight + 10; // Reduced from 15
    
    if (y > pageHeight - 100) {
      doc.addPage();
      y = margin;
    }
  }

  // ============================================
  // DISBURSEMENTS
  // ============================================
  
  if (disbursements.length > 0) {
    y = drawSectionTitle(doc, margin, y, `DISBURSEMENTS (${disbursements.length})`);
    
    const validDisbursements = disbursements.filter(item => parseFee(item.fee) >= 0);
    const disbursementBoxHeight = Math.min((validDisbursements.length * 7) + 10, pageHeight - y - 50);
    drawRoundedRect(doc, margin, y, contentWidth, disbursementBoxHeight, cornerRadius, true, true);
    
    // Calculate content height and center it vertically
    const disbursementRowSpacing = 7;
    const disbursementNumRows = validDisbursements.length;
    const disbursementContentHeight = disbursementNumRows > 0 ? (disbursementNumRows - 1) * disbursementRowSpacing : 0;
    const disbursementTextY = disbursementNumRows > 0 ? y + (disbursementBoxHeight / 2) - (disbursementContentHeight / 2) : y + disbursementBoxHeight / 2;
    
    doc.setFontSize(10);
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    
    let currentY = disbursementTextY;
    validDisbursements.forEach((item) => {
      const fee = parseFee(item.fee);
      doc.text(item.name || 'Disbursement', leftCol, currentY);
      doc.text(formatCurrency(fee), pageWidth - margin - 5, currentY, { align: 'right' });
      currentY += 7;
    });
    
    y += disbursementBoxHeight + 10; // Reduced from 15
    
    if (y > pageHeight - 50) {
      doc.addPage();
      y = margin;
    }
  }

  // ============================================
  // FINANCIAL SUMMARY - After Disbursements
  // ============================================
  
  y = drawSectionTitle(doc, margin, y, 'FINANCIAL SUMMARY');

  // Compact box height - reduced spacing
  const summaryBoxHeight = 24;
  drawRoundedRect(doc, margin, y, contentWidth, summaryBoxHeight, cornerRadius, true, true);
  
  // Calculate content height and center it vertically
  const summaryRowSpacing = 5.5;
  const summaryNumRows = 4;
  const summaryContentHeight = (summaryNumRows - 1) * summaryRowSpacing;
  const summaryTextY = y + (summaryBoxHeight / 2) - (summaryContentHeight / 2);
  
  doc.setFontSize(9); // Reduced from 10
  doc.setFont('times', 'bold');
  doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
  doc.text('Legal Fee (excl. VAT)', leftCol, summaryTextY);
  doc.text('Legal Fee (incl. VAT)', leftCol, summaryTextY + 5.5); // Reduced from 7
  doc.text('VAT Amount', leftCol, summaryTextY + 11); // Reduced from 14
  doc.text('Total (excl. VAT)', leftCol, summaryTextY + 16.5); // Reduced from 21
  
  doc.setFont('times', 'normal');
  doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
  doc.text(formatCurrency(legalFeeExVat), pageWidth - margin - 5, summaryTextY, { align: 'right' });
  doc.text(formatCurrency(legalFeeIncVat), pageWidth - margin - 5, summaryTextY + 5.5, { align: 'right' });
  doc.text(formatCurrency(vatAmount), pageWidth - margin - 5, summaryTextY + 11, { align: 'right' });
  doc.setFont('times', 'bold');
  doc.text(formatCurrency(totalExVat), pageWidth - margin - 5, summaryTextY + 16.5, { align: 'right' });
  
  y += summaryBoxHeight + 10; // Reduced from 12

  // Check if we need a new page
  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }

  // ============================================
  // PROPERTY INFORMATION
  // ============================================
  
  if (quote.propertyAddress || quote.propertyPostcode || quote.propertyValue) {
    if (y > pageHeight - 80) {
      doc.addPage();
      y = margin;
    }
    
    y = drawSectionTitle(doc, margin, y, 'PROPERTY INFORMATION');
    
    const propertyAddress = quote.propertyAddress || 'Not specified';
    const propertyPostcode = quote.propertyPostcode || 'Not specified';
    const propertyRegion = quote.propertyRegion || quote.propertyCounty || 'Not specified';
    const propertyTenure = quote.propertyTenure || 'Not specified';
    const propertyValue = quote.propertyValue ? formatCurrency(parseFloat(quote.propertyValue.toString())) : 'Not specified';
    
    const propertyBoxHeight = 40;
    drawRoundedRect(doc, margin, y, contentWidth, propertyBoxHeight, cornerRadius, true, true);
    
    // Calculate content height and center it vertically
    const propRowSpacing = 7;
    const propNumRows = 5;
    const propContentHeight = (propNumRows - 1) * propRowSpacing;
    const propTextY = y + (propertyBoxHeight / 2) - (propContentHeight / 2);
    doc.setFontSize(10);
    doc.setFont('times', 'bold');
    doc.setTextColor(COLORS.mediumGray[0], COLORS.mediumGray[1], COLORS.mediumGray[2]);
    doc.text('Address', leftCol, propTextY);
    doc.text('Postcode', leftCol, propTextY + 7);
    doc.text('Region', leftCol, propTextY + 14);
    doc.text('Tenure', leftCol, propTextY + 21);
    doc.text('Property Value', leftCol, propTextY + 28);
  
    doc.setFont('times', 'normal');
    doc.setTextColor(COLORS.darkText[0], COLORS.darkText[1], COLORS.darkText[2]);
    const addressLines = doc.splitTextToSize(propertyAddress, contentWidth / 2 - 10);
    doc.text(addressLines[0] || 'Not specified', leftCol + labelWidth, propTextY);
    doc.text(propertyPostcode, leftCol + labelWidth, propTextY + 7);
    doc.text(propertyRegion, leftCol + labelWidth, propTextY + 14);
    doc.text(propertyTenure, leftCol + labelWidth, propTextY + 21);
    doc.text(propertyValue, leftCol + labelWidth, propTextY + 28);
    
    y += propertyBoxHeight + 10; // Reduced from 15
  }

  // Check for new page before total
  if (y > pageHeight - 70) {
    doc.addPage();
    y = margin;
  }

  // ============================================
  // TOTAL (INCL. VAT) - After Property Information
  // ============================================
  
  // Compact total box similar to email template (16px 12px padding)
  const totalBoxHeight = 14; // More compact height
  // Draw navy colored total box
  doc.setFillColor(COLORS.navy[0], COLORS.navy[1], COLORS.navy[2]);
  doc.roundedRect(margin, y, contentWidth, totalBoxHeight, cornerRadius, cornerRadius, 'F');
  
  doc.setFontSize(12); // Slightly reduced from 13
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.white[0], COLORS.white[1], COLORS.white[2]);
  doc.text('Total (incl. VAT)', leftCol + 3, y + 10); // Left padding (3mm ≈ 12px)
  doc.text(formatCurrency(totalIncVat), pageWidth - margin - 3, y + 10, { align: 'right' }); // Right padding (3mm ≈ 12px)
  
  y += totalBoxHeight + 10; // Spacing after total

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
      doc.text('This quote is prepared for guidance and may be subject to change based on client circumstances.', margin, footerY - 5, { maxWidth: contentWidth, align: 'left' });
      
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
  
  const leadFirstName = clientName.split(' ')[0] || 'Quote';
  const cleanFirstName = leadFirstName.replace(/[^a-zA-Z0-9]/g, '');
  const fileName = `Quote_${referenceCode}_${cleanFirstName}.pdf`;

  return { doc, fileName };
}
