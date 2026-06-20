import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      to,
      subject,
      htmlBody,
      textBody,
      saveToSentItems = true,
      leadId,
      leadName,
      metadata,
      attachments
    } = req.body;

    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ error: 'Missing required fields: to, subject, htmlBody' });
    }

    // Log attachment info for debugging
    console.log('[Outlook Vercel] /send-email received request');
    console.log('[Outlook Vercel] Attachments in request:', attachments ? `${attachments.length} attachment(s)` : 'None');
    if (attachments && attachments.length > 0) {
      attachments.forEach((att: any, idx: number) => {
        console.log(`[Outlook Vercel] Attachment ${idx + 1}:`, {
          fileName: att.fileName,
          contentType: att.contentType,
          contentBytesLength: att.contentBytes?.length || 0
        });
      });
    }

    // Get environment variables inside handler (Vercel provides these at runtime)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseServiceKey
      });
      return res.status(500).json({ 
        error: 'Server configuration error: Supabase environment variables not set' 
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Outlook access token from database
    const { data: outlookConfig, error: configError } = await supabase
      .from('outlook_settings')
      .select('access_token, refresh_token, expires_at, email')
      .eq('id', 'shared-mailbox')
      .single();

    if (configError) {
      console.error('Error fetching Outlook config:', configError);
      return res.status(401).json({ error: 'Outlook not connected. Please connect Outlook in settings.' });
    }

    if (!outlookConfig?.access_token) {
      console.error('Outlook config found but no access token');
      return res.status(401).json({ error: 'Outlook not connected. Please connect Outlook in settings.' });
    }

    // Check if token is expired and refresh if needed
    const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';
    let accessToken = outlookConfig.access_token;
    const expiresAt = outlookConfig.expires_at ? new Date(outlookConfig.expires_at) : null;
    
    if (expiresAt && expiresAt < new Date()) {
      // Token expired, refresh it
      const AUTHORITY = `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}/oauth2/v2.0`;
      const refreshResponse = await fetch(`${AUTHORITY}/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.OUTLOOK_CLIENT_ID!,
          client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
          refresh_token: outlookConfig.refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        return res.status(401).json({ error: 'Failed to refresh Outlook token' });
      }

      const refreshData = await refreshResponse.json();
      accessToken = refreshData.access_token;

      // Update token in database
      await supabase
        .from('outlook_settings')
        .update({
          access_token: refreshData.access_token,
          refresh_token: refreshData.refresh_token || outlookConfig.refresh_token,
          expires_at: new Date(Date.now() + refreshData.expires_in * 1000).toISOString(),
        })
        .eq('id', 'shared-mailbox');
    }

    // Process attachments if provided
    const messageAttachments: any[] = [];
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      console.log('[Outlook Vercel] Processing attachments:', attachments.length);
      const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024; // 4MB in bytes
      
      for (const attachment of attachments) {
        try {
          // Clean base64 string - remove data URL prefix if present
          let contentBytes = String(attachment.contentBytes || '');
          if (contentBytes.includes(',')) {
            // Remove data URL prefix (e.g., "data:application/pdf;base64,")
            contentBytes = contentBytes.split(',')[1];
          }
          
          // Validate base64 string
          if (!contentBytes || contentBytes.length === 0) {
            throw new Error(`Invalid attachment content for file: ${attachment.fileName}`);
          }

          // Calculate approximate size (base64 is ~33% larger than binary)
          const approximateSize = (contentBytes.length * 3) / 4;
          if (approximateSize > MAX_ATTACHMENT_SIZE) {
            throw new Error(
              `Attachment "${attachment.fileName}" is too large (${Math.round(approximateSize / 1024 / 1024 * 100) / 100}MB). ` +
              `Microsoft Graph API limit is 4MB per attachment.`
            );
          }

          // Validate base64 format
          if (!/^[A-Za-z0-9+/]*={0,2}$/.test(contentBytes)) {
            throw new Error(`Invalid base64 format for attachment: ${attachment.fileName}`);
          }

          messageAttachments.push({
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: attachment.fileName,
            contentType: attachment.contentType || 'application/octet-stream',
            contentBytes: contentBytes
          });
          
          console.log(`[Outlook Vercel] Successfully processed attachment: ${attachment.fileName}`);
        } catch (attachmentError: any) {
          console.error(`[Outlook Vercel] Error processing attachment ${attachment.fileName}:`, attachmentError);
          // Continue with other attachments, but log the error
        }
      }
      
      console.log(`[Outlook Vercel] Processed ${messageAttachments.length} of ${attachments.length} attachment(s)`);
    }

    // Build message object
    const message: any = {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: Array.isArray(to) 
        ? to.map((email: string) => ({ emailAddress: { address: email } }))
        : [{ emailAddress: { address: to } }],
    };

    // Add attachments if any were processed
    if (messageAttachments.length > 0) {
      message.attachments = messageAttachments;
      console.log(`[Outlook Vercel] Adding ${messageAttachments.length} attachment(s) to message`);
    }

    // Send email via Microsoft Graph API
    const requestBody = {
      message,
      saveToSentItems,
    };

    // Use the shared mailbox email if available, otherwise use /me
    const mailboxEmail = outlookConfig.email;
    const sendUrl = mailboxEmail 
      ? `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailboxEmail)}/sendMail`
      : 'https://graph.microsoft.com/v1.0/me/sendMail';
    
    console.log('[Outlook Vercel] Sending email with', messageAttachments.length, 'attachment(s)');
    console.log('[Outlook Vercel] Using send URL:', sendUrl);
    const graphResponse = await fetch(sendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!graphResponse.ok) {
      const errorText = await graphResponse.text();
      console.error('[Outlook Vercel] Microsoft Graph API error:', errorText);
      console.error('[Outlook Vercel] Response status:', graphResponse.status);
      return res.status(graphResponse.status).json({
        error: `Failed to send email: ${errorText}`,
      });
    }

    console.log('[Outlook Vercel] Email sent successfully with', messageAttachments.length, 'attachment(s)');

    // Log activity for normal email sends (not from automation)
    // Automation emails are logged by the webhook to avoid duplicates
    const isFromAutomation = metadata?.fromAutomation === true ||
                             metadata?.automationTriggered === true ||
                             metadata?.workflowTrigger !== undefined ||
                             metadata?.automationId !== undefined;

    if (!isFromAutomation && leadId) {
      const doneByType = 'user';
      const doneByName = metadata?.userName || 'User';

      await supabase.from('activity_log').insert({
        activity_type: 'email_sent',
        entity_type: 'lead',
        entity_id: leadId,
        lead_id: leadId,
        lead_name: leadName || 'Unknown',
        action_description: `Email sent to ${to}`,
        done_by_type: doneByType,
        done_by_name: doneByName,
        metadata: {
          email: to,
          subject,
          fromAutomation: false,
        },
      });
      console.log('✅ Activity logged for normal email send');
    } else {
      console.log('Activity logging for email skipped (handled by automation/webhook)');
    }

    return res.status(200).json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.status(500).json({
      error: error.message || 'Internal server error',
    });
  }
}



