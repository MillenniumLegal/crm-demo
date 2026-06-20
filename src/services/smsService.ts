export interface SendSMSPayload {
  to: string;
  message: string;
  leadId?: string;
  leadName?: string;
  metadata?: Record<string, unknown>;
}

export interface SendSMSResult {
  success: boolean;
  message: string;
  sid?: string;
  status?: string;
  to?: string;
  leadId?: string;
  leadName?: string;
  metadata?: Record<string, unknown>;
}

export interface TwilioStatus {
  connected: boolean;
  accountSid?: string;
  phoneNumber?: string;
  accountName?: string;
  error?: string;
}

/**
 * Format phone number to ensure +44 format for UK numbers
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // If it starts with 0, replace with +44
  if (cleaned.startsWith('0')) {
    cleaned = '+44' + cleaned.substring(1);
  }
  // If it starts with 44 but no +, add +
  else if (cleaned.startsWith('44') && !cleaned.startsWith('+44')) {
    cleaned = '+' + cleaned;
  }
  // If it doesn't start with +, add +44 (assuming UK number)
  else if (!cleaned.startsWith('+')) {
    cleaned = '+44' + cleaned;
  }
  
  return cleaned;
}

/**
 * Get Supabase Edge Function URL
 */
function getSupabaseFunctionUrl(functionName: string): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  if (!supabaseUrl) {
    throw new Error('VITE_SUPABASE_URL is not configured');
  }
  // Remove trailing slash if present
  const baseUrl = supabaseUrl.replace(/\/$/, '');
  return `${baseUrl}/functions/v1/${functionName}`;
}

export async function sendSMS(
  payload: SendSMSPayload
): Promise<SendSMSResult> {
  // Format phone number before sending
  const formattedPayload = {
    ...payload,
    to: formatPhoneNumber(payload.to)
  };
  
  const functionUrl = getSupabaseFunctionUrl('sms-send');
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify(formattedPayload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let details: string | undefined;
    try {
      const parsed = JSON.parse(errorText);
      details = parsed?.error || parsed?.details || errorText;
    } catch {
      details = errorText;
    }
    throw new Error(details || `SMS send failed (${response.status}).`);
  }

  const data = (await response.json()) as SendSMSResult;
  return data;
}

export async function fetchTwilioStatus(): Promise<TwilioStatus> {
  try {
    const functionUrl = getSupabaseFunctionUrl('sms-status');
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    
    const response = await fetch(functionUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    
    if (!response.ok) {
      return { connected: false, error: 'Failed to check Twilio status' };
    }
    const json = await response.json();
    return {
      connected: Boolean(json?.connected),
      accountSid: json?.accountSid || undefined,
      phoneNumber: json?.phoneNumber || undefined,
      accountName: json?.accountName || undefined,
      error: json?.error || undefined
    };
  } catch (error: any) {
    console.error('Failed to check Twilio connection status:', error);
    return { connected: false, error: error?.message || 'Connection check failed' };
  }
}

export async function isTwilioConnected(): Promise<boolean> {
  const status = await fetchTwilioStatus();
  return status.connected;
}

