import { Quote } from '@/services/quotesService';

interface EmailTemplateParams {
  quote: Quote;
  acceptanceUrl?: string;
  clientName?: string;
  clientEmail?: string;
  propertyAddress?: string;
  transactionType?: string;
  expiryDate?: string;
}

/**
 * Generates the HTML version of the quote email
 */
export function generateQuoteEmailHTML(params: EmailTemplateParams | Quote, acceptanceUrl?: string): string {
  // Handle both old signature (Quote, string) and new signature (EmailTemplateParams)
  let quote: Quote;
  let clientName: string;
  let transactionType: string;
  let acceptanceUrlParam: string | undefined;

  if ('quote' in params || 'id' in params) {
    // New signature with EmailTemplateParams
    if ('quote' in params) {
      quote = params.quote;
      clientName = params.clientName || quote.leadName || 'Valued Client';
      transactionType = params.transactionType || quote.quoteType || quote.transactionType || 'Conveyancing';
      acceptanceUrlParam = params.acceptanceUrl || acceptanceUrl;
    } else {
      // Old signature (Quote, string)
      quote = params;
      acceptanceUrlParam = acceptanceUrl;
      clientName = quote.leadName || 'Valued Client';
      transactionType = quote.quoteType || quote.transactionType || 'Conveyancing';
    }
  } else {
    // Fallback
    quote = params as Quote;
    acceptanceUrlParam = acceptanceUrl;
    clientName = quote.leadName || 'Valued Client';
    transactionType = quote.quoteType || quote.transactionType || 'Conveyancing';
  }

  // Determine reference code: prefer system lead reference, then Hoowla number only, then fallback
  let referenceCode = 'N/A';
  if (quote.leadShortCode) {
    // Use system lead reference (e.g., LD-9E489F) - preferred
    referenceCode = quote.leadShortCode;
  } else if (quote.hoowlaQuoteId) {
    // Extract just the number from Hoowla quote ID (e.g., "3946609" from "HOOWLA-Q-3946609" or just "3946609")
    const hoowlaId = quote.hoowlaQuoteId.toString();
    // If it contains "HOOWLA-Q-", extract the number after it
    const match = hoowlaId.match(/HOOWLA-Q-(\d+)/i);
    if (match) {
      referenceCode = match[1]; // Just the number
    } else if (/^\d+$/.test(hoowlaId)) {
      // If it's already just a number, use it
      referenceCode = hoowlaId;
    } else {
      // Fallback: try to extract any number from the string
      const numberMatch = hoowlaId.match(/\d+/);
      referenceCode = numberMatch ? numberMatch[0] : hoowlaId;
    }
  } else if (quote.shortCode) {
    referenceCode = quote.shortCode;
  } else if (quote.id) {
    referenceCode = quote.id.substring(0, 8);
  }
  
  // Format currency
  const formatCurrency = (amount: number | string | undefined | null): string => {
    if (!amount) return '£0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  // Parse fees
  const parseFee = (fee: string | number | undefined | null): number => {
    if (!fee) return 0;
    if (typeof fee === 'number') return fee;
    const parsed = parseFloat(String(fee));
    return isNaN(parsed) ? 0 : parsed;
  };

  // Calculate totals
  const legalFeeExVat = parseFee(quote.legalFeeExVat || quote.legalFee || 0);
  const legalFeeIncVat = parseFee(quote.legalFeeIncVat || (legalFeeExVat * 1.2));
  const supplements = quote.supplements || [];
  const disbursements = quote.disbursements || [];
  const supplementTotal = supplements.reduce((sum, item) => sum + parseFee(item.fee), 0);
  const disbursementTotal = disbursements.reduce((sum, item) => sum + parseFee(item.fee), 0);
  const vatAmount = parseFee(quote.vatAmount || (legalFeeIncVat - legalFeeExVat));
  const totalExVat = parseFee(quote.totalExVat || quote.netAmount || (legalFeeExVat + supplementTotal + disbursementTotal));
  const totalIncVat = parseFee(quote.totalAmount || quote.totalIncVat || (totalExVat + vatAmount));
  
  // Calculate fees section subtotal (legal fees + supplements + VAT)
  // Note: legalFeeIncVat already includes VAT on legal fee
  // supplements are typically ex VAT, but we'll add VAT on supplements if needed
  // For now, assume supplements are inc VAT or ex VAT based on quote data
  // The fees section total should be: legalFeeIncVat + supplementTotal (if supplements are inc VAT)
  // OR: (legalFeeExVat + supplementTotal) + totalVatOnFees
  // To be safe, calculate: legalFeeIncVat + supplementTotal (assuming supplements include their own VAT if applicable)
  const feesSectionTotal = legalFeeIncVat + supplementTotal;

  // Build supplements HTML
  const supplementsHTML = supplements.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
      <tr>
        <td style="padding: 15px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            Your ${transactionType} Conveyancing Fees
          </h3>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="margin-bottom: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px; table-layout: fixed;">
            <colgroup>
              <col style="width: 60%;">
              <col style="width: 40%;">
            </colgroup>
            <tr>
              <td style="color: #374151; font-size: 17px; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                Legal Fees (ex VAT)
              </td>
              <td align="right" valign="top" style="color: #011E41; font-size: 17px; font-weight: 600; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                ${formatCurrency(legalFeeExVat)}
              </td>
            </tr>
            ${supplements.map(item => {
              const fee = parseFee(item.fee);
              if (fee > 0) {
                return `
              <tr>
                <td style="color: #374151; font-size: 17px; padding: 8px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                  ${item.name || 'Supplement'}
                </td>
                <td align="right" valign="top" style="color: #011E41; font-size: 17px; padding: 8px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                  ${formatCurrency(fee)}
                </td>
              </tr>
            `;
              }
              return '';
            }).join('')}
          </table>
          <div style="background-color: #011E41; color: #FFFFFF; border-radius: 8px; padding: 16px 12px; margin-top: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; table-layout: fixed;">
              <colgroup>
                <col style="width: 60%;">
                <col style="width: 40%;">
              </colgroup>
              <tr>
                <td style="font-size: 18px; font-weight: 600; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                  Total
                </td>
                <td align="right" valign="top" style="font-size: 18px; font-weight: 600; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                  ${formatCurrency(feesSectionTotal)}
                </td>
              </tr>
            </table>
          </div>
        </td>
      </tr>
    </table>
  ` : '';

  // Build disbursements HTML (payable to us)
  const disbursementsPayableToUs = disbursements.filter(item => 
    item.name?.toLowerCase().includes('anti money') || 
    item.name?.toLowerCase().includes('aml') ||
    item.name?.toLowerCase().includes('identity') ||
    item.name?.toLowerCase().includes('office copy')
  );
  
  const disbursementsPayableToUsHTML = disbursementsPayableToUs.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
      <tr>
        <td style="padding: 15px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            Your ${transactionType} Conveyancing disbursements payable to us on instruction
          </h3>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px; table-layout: fixed;">
            <colgroup>
              <col style="width: 60%;">
              <col style="width: 40%;">
            </colgroup>
            <tr>
              <td style="color: #374151; font-size: 17px; padding: 4px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                Legal file set up and completion statement preparation
              </td>
              <td align="right" valign="top" style="color: #011E41; font-size: 17px; padding: 4px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                Included
              </td>
            </tr>
            ${disbursementsPayableToUs.map(item => {
              const fee = parseFee(item.fee);
              return `
              <tr>
                <td style="color: #374151; font-size: 17px; padding: 4px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                  ${item.name}
                </td>
                <td align="right" valign="top" style="color: #011E41; font-size: 17px; padding: 4px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                  ${formatCurrency(fee)}
                </td>
              </tr>
            `;
            }).join('')}
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  // Build searches HTML
  // Exclude AML/Identity checks - they belong in "disbursements payable to us" section
  const searches = disbursements.filter(item => {
    const nameLower = item.name?.toLowerCase() || '';
    const isAML = nameLower.includes('anti money') || nameLower.includes('aml') || nameLower.includes('identity');
    const isSearch = nameLower.includes('search') || nameLower.includes('local authority');
    // Only include if it's a search-related item but NOT AML/Identity
    return isSearch && !isAML;
  });
  
  const searchesHTML = searches.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
      <tr>
        <td style="padding: 15px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            Searches - costs payable to us, depending on which searches are required
          </h3>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px; table-layout: fixed;">
            <colgroup>
              <col style="width: 60%;">
              <col style="width: 40%;">
            </colgroup>
            ${searches.map(item => {
              const fee = parseFee(item.fee);
              return `
              <tr>
                <td style="color: #374151; font-size: 17px; padding: 4px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                  ${item.name}
                </td>
                <td align="right" valign="top" style="color: #011E41; font-size: 17px; padding: 4px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                  ${formatCurrency(fee)}
                </td>
              </tr>
            `;
            }).join('')}
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  // Build other disbursements HTML (payable to conveyancer/solicitor)
  const otherDisbursements = disbursements.filter(item => 
    !item.name?.toLowerCase().includes('anti money') && 
    !item.name?.toLowerCase().includes('aml') &&
    !item.name?.toLowerCase().includes('identity') &&
    !item.name?.toLowerCase().includes('office copy') &&
    !item.name?.toLowerCase().includes('search') &&
    !item.name?.toLowerCase().includes('local authority')
  );
  
  const otherDisbursementsHTML = otherDisbursements.length > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
      <tr>
        <td style="padding: 15px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
          <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            Your ${transactionType} Conveyancing costs and disbursements payable to your conveyancer/solicitor
          </h3>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px; table-layout: fixed;">
            <colgroup>
              <col style="width: 60%;">
              <col style="width: 40%;">
            </colgroup>
            ${otherDisbursements.map(item => {
              const fee = parseFee(item.fee);
              return `
              <tr>
                <td style="color: #374151; font-size: 17px; padding: 4px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                  ${item.name}
                </td>
                <td align="right" valign="top" style="color: #011E41; font-size: 17px; padding: 4px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                  ${formatCurrency(fee)}
                </td>
              </tr>
            `;
            }).join('')}
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  // Build total section
  // Note: totalIncVat already includes legal fees, supplements, disbursements, and VAT
  // So we should use totalIncVat directly, not add disbursementTotal again
  const totalSectionHTML = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
      <tr>
        <td style="padding: 20px; background-color: #011E41; border-radius: 4px;">
          <h3 style="margin: 0 0 15px 0; color: #FFFFFF; font-size: 18px; font-weight: 600;">
            The bottom line
          </h3>
          <table width="100%" cellpadding="8" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 18px; table-layout: fixed;">
            <colgroup>
              <col style="width: 60%;">
              <col style="width: 40%;">
            </colgroup>
            <tr>
              <td style="color: #F8F8F9; font-size: 18px; padding: 8px 0; padding-right: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; word-wrap: break-word;">
                Fees and all disbursements together
              </td>
              <td align="right" valign="top" style="color: #FFFFFF; font-size: 20px; font-weight: 700; padding: 8px 0; padding-left: 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; white-space: nowrap;">
                ${formatCurrency(totalIncVat)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  // Build action buttons
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://www.apcmcrm.co.uk';
  const callbackUrl = 'https://form.jotform.com/Connor_McGrath/request-a-callback-from-millennium-';
  
  const actionButtonsHTML = acceptanceUrlParam ? `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <tr>
              <td align="center" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <table cellpadding="0" cellspacing="0" border="0" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <tr>
              <td align="center" style="padding: 0 10px;">
                <a href="${acceptanceUrlParam}" 
                       style="display: inline-block; 
                              padding: 14px 32px; 
                              background-color: #011E41; 
                              color: #FFFFFF; 
                              text-decoration: none; 
                              border-radius: 6px; 
                              font-weight: 600; 
                              font-size: 17px;
                              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Accept Quote
                    </a>
                  </td>
                  <td align="center" style="padding: 0 10px;">
                    <a href="${callbackUrl}" 
             style="display: inline-block; 
                              padding: 14px 32px; 
                              background-color: #FFFFFF; 
                              color: #011E41; 
                    text-decoration: none; 
                              border: 2px solid #011E41;
                              border-radius: 6px; 
                    font-weight: 600; 
                              font-size: 17px;
                              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      Arrange a callback
          </a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <meta name="format-detection" content="telephone=no">
  <title>Your ${transactionType} Quote - Millennium Legal</title>
  <style type="text/css">
    /* Mobile email fixes */
    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
      }
      .email-content {
        padding: 20px !important;
      }
      table[class="mobile-table"] {
        width: 100% !important;
      }
      td[class="mobile-cell"] {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        padding: 4px 0 !important;
      }
    }
    /* Prevent iOS auto-zoom */
    input, select, textarea {
      font-size: 16px !important;
    }
  </style>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px; background-color: #F9FAFB; line-height: 1.6; color: #374151;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #F9FAFB; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 17px;">
          
          <!-- Logo Section (Plain White Background) -->
          <tr>
            <td style="background-color: #FFFFFF; padding: 30px 40px 20px 40px; text-align: center;">
              <img src="https://d2mwtfjtwex6ir.cloudfront.net/logo-be4c34777c4dd1c817eecdc0d36e409ea128f0c3.jpg" 
                   alt="Millennium Legal Conveyancing Ltd"
                   style="max-width: 200px; height: auto; display: block; margin: 0 auto;" />
            </td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td style="background-color: #011E41; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Your ${transactionType} Quote
              </h1>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px;">
              
              <!-- Greeting -->
              <p style="margin: 0 0 20px 0; color: #374151; font-size: 20px; line-height: 1.6;">
                Hi ${clientName.split(' ')[0] || clientName}
              </p>
              
              <p style="margin: 0 0 10px 0; color: #374151; font-size: 20px; line-height: 1.6;">
                Your quote reference is <strong style="color: #011E41;">${referenceCode}</strong>
              </p>
              
              <p style="margin: 0 0 30px 0; color: #374151; font-size: 20px; line-height: 1.6;">
                Thank you for requesting a ${transactionType} quote through us.
              </p>

              ${supplementsHTML}

              ${disbursementsPayableToUsHTML}

              ${searchesHTML}

              ${otherDisbursementsHTML}

              ${totalSectionHTML}

              ${actionButtonsHTML}

              <!-- Trust/Contact Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <tr>
                  <td align="center" style="padding: 20px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <p style="margin: 0 0 10px 0; color: #6B7280; font-size: 20px;">
                          Or call us on: <a href="tel:01704773288" style="color: #011E41; text-decoration: none; font-weight: 600;">01704 773288</a> to speak with one of our dedicated team members.
                        </p>
                        </td>
                      </tr>
                    </table>

              <!-- Why Choose Us Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <tr>
                  <td style="padding: 20px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600;">
                          Why you should choose us
                        </h3>
                        <div style="margin: 0; color: #374151; font-size: 20px; line-height: 1.8;">
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>Our fixed legal fee policy</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>Our no move no legal fee policy</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>Our 5* reviews on Trustpilot and Google</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>We only use trusted professionals to help you through your journey</div>
                          <div style="margin-bottom: 0;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>Our award-winning online identity checking solution saves you valuable time</div>
                        </div>
                  </td>
                </tr>
              </table>

              <!-- Free Stuff Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <tr>
                  <td style="padding: 20px; background-color: #F8F8F9; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <h3 style="margin: 0 0 15px 0; color: #011E41; font-size: 17px; font-weight: 600;">
                          Free stuff and other useful services
                        </h3>
                    <h4 style="margin: 10px 0 5px 0; color: #011E41; font-size: 19px; font-weight: 600;">
                      What is our role in your transaction?
                    </h4>
                    <div style="margin: 0; color: #374151; font-size: 20px; line-height: 1.8;">
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>Our arrangements with the conveyancing companies on our panel, allows us to offer you lower fees</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>We support you in your conveyancing journey, ensuring a smooth and professional service</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>We facilitate your anti-money laundering (AML) checks, identity verification, and property searches</div>
                          <div style="margin-bottom: 8px;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>We help to bridge any communication gaps between you and your conveyancer</div>
                          <div style="margin-bottom: 0;"><span style="color: #011E41; font-size: 22px; font-weight: bold; margin-right: 8px;">✓</span>We offer you access to other useful services such as surveys and Estate Planning Reports.</div>
                    </div>
                        </td>
                      </tr>
                    </table>

              <!-- Terms Section -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 30px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                <tr>
                  <td style="padding: 20px; background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
                    <h4 style="margin: 0 0 10px 0; color: #92400E; font-size: 19px; font-weight: 600;">
                      The "not-so-fine" print
                    </h4>
                    <p style="margin: 0 0 10px 0; color: #92400E; font-size: 20px; line-height: 1.6;">
                      ${quote.terms || `Please read our terms and conditions and take particular note that, should the most commonly required Environmental, Drainage and Water searches be necessary, and ordered together with the Local Authority search, the full discounted cost will be £350. Please note, that in limited cases, further searches such as a coal or a flood search may also be required.`}
                    </p>
                    <p style="margin: 15px 0 0 0; color: #92400E; font-size: 20px; line-height: 1.6;">
                      When you accept our quote, you also confirm that you have read and accepted our <a href="https://millenniumlegal.co.uk/terms-and-conditions/" style="color: #92400E; text-decoration: underline;">Terms and Conditions</a> and <a href="${baseUrl}/privacy" style="color: #92400E; text-decoration: underline;">Privacy Policy</a>.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F8F9; padding: 30px 40px; border-top: 1px solid #E5E7EB;">
                  <p style="margin: 0 0 10px 0; color: #011E41; font-size: 18px; font-weight: 600; text-align: center;">
                    Millennium Legal Conveyancing Ltd
                  </p>
                  <p style="margin: 0; color: #6B7280; font-size: 18px; text-align: center; line-height: 1.5;">
                    701 Merlin Business Park<br>
                    Ringtail Road, Burscough Industrial Estate<br>
                    ORMSKIRK<br>
                    Lancashire L40 8JY
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generates the plain text version of the quote email
 */
export function generateQuoteEmailText(params: EmailTemplateParams | Quote, acceptanceUrl?: string): string {
  // Handle both old signature (Quote, string) and new signature (EmailTemplateParams)
  let quote: Quote;
  let clientName: string;
  let transactionType: string;
  let acceptanceUrlParam: string | undefined;

  if ('quote' in params || 'id' in params) {
    if ('quote' in params) {
      quote = params.quote;
      clientName = params.clientName || quote.leadName || 'Valued Client';
      transactionType = params.transactionType || quote.quoteType || quote.transactionType || 'Conveyancing';
      acceptanceUrlParam = params.acceptanceUrl || acceptanceUrl;
    } else {
      quote = params;
      acceptanceUrlParam = acceptanceUrl;
      clientName = quote.leadName || 'Valued Client';
      transactionType = quote.quoteType || quote.transactionType || 'Conveyancing';
    }
  } else {
    quote = params as Quote;
    acceptanceUrlParam = acceptanceUrl;
    clientName = quote.leadName || 'Valued Client';
    transactionType = quote.quoteType || quote.transactionType || 'Conveyancing';
  }

  // Determine reference code: prefer system lead reference, then Hoowla number only, then fallback
  let referenceCode = 'N/A';
  if (quote.leadShortCode) {
    // Use system lead reference (e.g., LD-9E489F) - preferred
    referenceCode = quote.leadShortCode;
  } else if (quote.hoowlaQuoteId) {
    // Extract just the number from Hoowla quote ID (e.g., "3946609" from "HOOWLA-Q-3946609" or just "3946609")
    const hoowlaId = quote.hoowlaQuoteId.toString();
    // If it contains "HOOWLA-Q-", extract the number after it
    const match = hoowlaId.match(/HOOWLA-Q-(\d+)/i);
    if (match) {
      referenceCode = match[1]; // Just the number
    } else if (/^\d+$/.test(hoowlaId)) {
      // If it's already just a number, use it
      referenceCode = hoowlaId;
    } else {
      // Fallback: try to extract any number from the string
      const numberMatch = hoowlaId.match(/\d+/);
      referenceCode = numberMatch ? numberMatch[0] : hoowlaId;
    }
  } else if (quote.shortCode) {
    referenceCode = quote.shortCode;
  } else if (quote.id) {
    referenceCode = quote.id.substring(0, 8);
  }
  
  const formatCurrency = (amount: number | string | undefined | null): string => {
    if (!amount) return '£0.00';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2
    }).format(numAmount);
  };

  const parseFee = (fee: string | number | undefined | null): number => {
    if (!fee) return 0;
    if (typeof fee === 'number') return fee;
    const parsed = parseFloat(String(fee));
    return isNaN(parsed) ? 0 : parsed;
  };

  const supplements = quote.supplements || [];
  const disbursements = quote.disbursements || [];
  const totalIncVat = parseFee(quote.totalAmount || quote.totalIncVat || 0);

  const supplementsText = supplements.length > 0 ? supplements.map(item => 
    `  ${item.name || 'Supplement'}: ${formatCurrency(item.fee)}`
  ).join('\n') : '';

  const disbursementsText = disbursements.length > 0 ? disbursements.map(item => 
    `  ${item.name}: ${formatCurrency(item.fee)}`
  ).join('\n') : '';

  const acceptUrlSection = acceptanceUrlParam
    ? `\n\nACCEPT YOUR QUOTE:\n${acceptanceUrlParam}\n`
    : '';

  return `
MILLENNIUM LEGAL
${transactionType} Quote

Hi ${clientName.split(' ')[0] || clientName}

Your quote reference is ${referenceCode}

Thank you for requesting a ${transactionType} quote through us.

YOUR ${transactionType.toUpperCase()} CONVEYANCING FEES
${supplementsText ? supplementsText + '\n' : ''}
Total: ${formatCurrency(totalIncVat)}

DISBURSEMENTS
${disbursementsText}

THE BOTTOM LINE
Fees and all disbursements together: ${formatCurrency(totalIncVat)}
${acceptUrlSection}
Or call us on: 01704 773288 to speak with one of our dedicated team members.

WHY YOU SHOULD CHOOSE US
- Our fixed legal fee policy
- Our no move no legal fee policy
- Our 5* reviews on Trustpilot and Google
- We only use trusted professionals to help you through your journey
- Our award-winning online identity checking solution saves you valuable time

FREE STUFF AND OTHER USEFUL SERVICES
What is our role in your transaction?
- Our arrangements with the conveyancing companies on our panel, allows us to offer you lower fees
- We support you in your conveyancing journey, ensuring a smooth and professional service
- We facilitate your anti-money laundering (AML) checks, identity verification, and property searches
- We help to bridge any communication gaps between you and your conveyancer
- We offer you access to other useful services such as surveys and Estate Planning Reports.

THE "NOT-SO-FINE" PRINT
${quote.terms || 'Please read our terms and conditions carefully.'}

When you accept our quote, you also confirm that you have read and accepted our Terms and Conditions and Privacy Policy.

---

Millennium Legal Conveyancing Ltd
701 Merlin Business Park
Ringtail Road, Burscough Industrial Estate
ORMSKIRK
Lancashire L40 8JY
  `.trim();
}


























