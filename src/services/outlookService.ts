export interface OutlookAttachment {
  fileName: string;
  contentType?: string;
  contentBytes: string;
}

export interface SendOutlookEmailPayload {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  htmlBody?: string;
  textBody?: string;
  saveToSentItems?: boolean;
  leadId?: string;
  leadName?: string;
  metadata?: Record<string, unknown>;
  attachments?: OutlookAttachment[];
}

export interface SendOutlookEmailResult {
  success: boolean;
  message: string;
  leadId?: string;
  leadName?: string;
  metadata?: Record<string, unknown>;
}

export interface OutlookStatus {
  connected: boolean;
  email?: string;
  lastSynced?: string | null;
  expiresAt?: number;
}

export interface ScheduleOutlookEmailPayload extends SendOutlookEmailPayload {
  sendAt: string;
  scheduledBy?: string;
  scheduledByName?: string;
}

export async function sendOutlookEmail(
  payload: SendOutlookEmailPayload
): Promise<SendOutlookEmailResult> {
  const response = await fetch('/api/outlook/send-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
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
    throw new Error(details || `Outlook send email failed (${response.status}).`);
  }

  const data = (await response.json()) as SendOutlookEmailResult;
  return data;
}

export async function fetchOutlookStatus(): Promise<OutlookStatus> {
  try {
    const response = await fetch('/api/outlook/status');
    if (!response.ok) {
      return { connected: false };
    }
    const json = await response.json();
    return {
      connected: Boolean(json?.connected),
      email: json?.email || undefined,
      lastSynced: json?.lastSynced || null,
      expiresAt: typeof json?.expiresAt === 'number' ? json.expiresAt : undefined
    };
  } catch (error) {
    console.error('Failed to check Outlook connection status:', error);
    return { connected: false };
  }
}

export async function isOutlookConnected(): Promise<boolean> {
  const status = await fetchOutlookStatus();
  return status.connected;
}

export async function scheduleOutlookEmail(
  payload: ScheduleOutlookEmailPayload
): Promise<SendOutlookEmailResult> {
  const response = await fetch('/api/outlook/schedule-email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
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
    throw new Error(details || `Outlook schedule email failed (${response.status}).`);
  }

  const data = (await response.json()) as SendOutlookEmailResult & { sendAt?: string };
  return data;
}


