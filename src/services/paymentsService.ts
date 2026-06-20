import { supabase } from '@/lib/supabase';

export interface PaymentRecord {
  id: string;
  leadId: string;
  leadName?: string;
  leadEmail?: string;
  leadShortCode?: string;
  quoteId?: string | null;
  amount: number;
  currency: string;
  status: string;
  stripePaymentLink?: string | null;
  stripePaymentLinkId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCheckoutSessionId?: string | null;
  issuedAt: string;
  dueDate?: string | null;
  paidAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface FetchPaymentsFilters {
  status?: string;
  fromDate?: string;
  toDate?: string;
  searchTerm?: string;
}

const normaliseAmount = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? 0 : parsed;
};

/**
 * Format invoice ID to a shorter, more readable format
 * Examples: INV-2024-001, INV-2024-123
 */
function formatInvoiceId(paymentId: string, issuedAt?: string): string {
  try {
    // Try to extract a sequential number from the payment ID or use last 6 chars
    // If payment ID is a UUID, use last 6 characters
    if (paymentId.length > 8) {
      const lastChars = paymentId.substring(paymentId.length - 6).toUpperCase();
      // Get year from issuedAt if available
      const year = issuedAt ? new Date(issuedAt).getFullYear() : new Date().getFullYear();
      return `INV-${year}-${lastChars}`;
    }
    return `INV-${paymentId}`;
  } catch {
    // Fallback to original ID if formatting fails
    return paymentId.length > 12 ? paymentId.substring(0, 12) : paymentId;
  }
}

const transformPaymentRow = (row: any): PaymentRecord => {
  const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
  return {
    id: row.id,
    leadId: row.lead_id,
    quoteId: row.quote_id,
    amount: normaliseAmount(row.amount),
    currency: (row.currency || 'GBP').toUpperCase(),
    status: row.status || 'Pending',
    stripePaymentLink: row.stripe_payment_link ?? null,
    stripePaymentLinkId: row.stripe_payment_link_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    issuedAt: row.created_at,
    dueDate: row.due_date ?? null,
    paidAt: row.paid_at ?? null,
    metadata: row.metadata ?? null,
    leadName: lead?.name || row.lead_name || undefined,
    leadEmail: lead?.email || row.lead_email || undefined,
    leadShortCode: lead?.short_code || row.lead_short_code || undefined,
  };
};

export async function fetchPayments(filters: FetchPaymentsFilters = {}): Promise<PaymentRecord[]> {
  try {
    let query = supabase
      .from('payments')
      .select(
        `
          *,
          leads:lead_id (
            id,
            name,
            email,
            short_code
          )
        `
      )
      .order('created_at', { ascending: false });

    if (filters.status && filters.status !== 'All') {
      query = query.eq('status', filters.status);
    }

    if (filters.fromDate) {
      query = query.gte('created_at', filters.fromDate);
    }

    if (filters.toDate) {
      query = query.lte('created_at', filters.toDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
      throw error;
    }

    return (data ?? []).map(transformPaymentRow);
  } catch (error) {
    console.error('fetchPayments failed:', error);
    throw error;
  }
}

export interface GeneratePaymentLinkParams {
  leadId: string;
  quoteId?: string;
  amount: number;
  currency?: string;
  description?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface GeneratePaymentLinkResponse {
  url: string;
  paymentLinkId?: string;
  priceId?: string;
}

export async function generateStripePaymentLink(
  params: GeneratePaymentLinkParams
): Promise<GeneratePaymentLinkResponse> {
  try {
    const { data, error } = await supabase.functions.invoke('generate-payment-link', {
      body: {
        leadId: params.leadId,
        quoteId: params.quoteId,
        amount: params.amount,
        currency: params.currency || 'GBP',
        description: params.description,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl,
      },
    });

    if (error) {
      console.error('Error generating Stripe payment link:', error);
      throw error;
    }

    if (!data || (!data.url && !data.payment_link)) {
      throw new Error('Payment link response missing URL');
    }

    const url = data.url || data.payment_link;

    return {
      url,
      paymentLinkId: data.paymentLinkId || data.payment_link_id,
      priceId: data.priceId || data.stripe_price_id,
    };
  } catch (err) {
    console.error('generateStripePaymentLink failed:', err);
    throw err;
  }
}

export interface CreateInvoiceParams {
  leadId: string;
  quoteId?: string | null;
  amount: number;
  currency?: string;
  dueDate?: string;
  description?: string;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<PaymentRecord> {
  try {
    const { data, error } = await supabase
      .from('payments')
      .insert({
        lead_id: params.leadId,
        quote_id: params.quoteId || null,
        amount: params.amount,
        currency: (params.currency || 'GBP').toUpperCase(),
        status: 'Draft',
        due_date: params.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: params.description ? { description: params.description } : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select(`
        *,
        leads:lead_id (
          id,
          name,
          email,
          short_code
        )
      `)
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }

    return transformPaymentRow(data);
  } catch (err) {
    console.error('createInvoice failed:', err);
    throw err;
  }
}

export interface SendInvoiceParams {
  paymentId: string;
  to: string;
  subject: string;
  message: string;
  attachInvoice?: boolean;
}

export async function sendInvoice(params: SendInvoiceParams): Promise<void> {
  try {
    // First, get the payment record to generate invoice PDF if needed
    const { data: paymentData, error: fetchError } = await supabase
      .from('payments')
      .select(`
        *,
        leads:lead_id (*),
        quotes:quote_id (*)
      `)
      .eq('id', params.paymentId)
      .single();

    if (fetchError || !paymentData) {
      throw new Error('Payment not found');
    }

    const payment = transformPaymentRow(paymentData);
    let invoicePdfBlob: Blob | null = null;

    // Generate invoice PDF if attaching
    if (params.attachInvoice) {
      const { buildInvoicePdf } = await import('@/utils/invoicePdf');
      const leadData = Array.isArray(paymentData.leads) ? paymentData.leads[0] : paymentData.leads;
      const quoteData = Array.isArray(paymentData.quotes) ? paymentData.quotes[0] : paymentData.quotes;
      
      const { doc } = await buildInvoicePdf(payment, leadData, quoteData);
      const pdfBlob = doc.output('blob');
      invoicePdfBlob = pdfBlob;
    }

    // Send email via Outlook
    const { sendOutlookEmail } = await import('@/services/outlookService');
    
    // Convert PDF blob to base64 for attachment
    // Use FileReader API for efficient base64 encoding (handles large files without stack overflow)
    let attachments: Array<{ fileName: string; contentType: string; contentBytes: string }> = [];
    if (params.attachInvoice && invoicePdfBlob) {
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix (data:application/pdf;base64,)
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = () => reject(new Error('Failed to read PDF file'));
        reader.readAsDataURL(invoicePdfBlob);
      });
      
      // Generate shorter invoice ID for filename
      const shortInvoiceId = formatInvoiceId(payment.id, payment.issuedAt);
      
      attachments = [{
        fileName: `Invoice-${shortInvoiceId}.pdf`,
        contentType: 'application/pdf',
        contentBytes: base64String
      }];
    }

    await sendOutlookEmail({
      to: params.to,
      subject: params.subject,
      htmlBody: params.message.replace(/\n/g, '<br>'),
      textBody: params.message,
      attachments,
      leadId: payment.leadId,
      leadName: payment.leadName,
    });

    // Update payment status to 'Sent'
    await supabase
      .from('payments')
      .update({
        status: 'Sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.paymentId);

    // Log activity
    try {
      await supabase
        .from('activity_log')
        .insert({
          activity_type: 'invoice_sent',
          entity_type: 'payment',
          entity_id: params.paymentId,
          lead_id: payment.leadId,
          lead_name: payment.leadName,
          action_description: `Invoice sent to ${params.to}`,
          done_by_type: 'user',
          done_by_name: 'User',
          metadata: {
            email: params.to,
            subject: params.subject,
            invoiceAttached: params.attachInvoice || false,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    } catch (activityError) {
      console.warn('Could not log activity:', activityError);
    }
  } catch (err) {
    console.error('sendInvoice failed:', err);
    throw err;
  }
}

