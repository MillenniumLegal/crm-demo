import { supabase } from '@/lib/supabase';
import { QuoteNotification } from '@/components/QuoteNotificationPopup';

/**
 * Fetch unread quote notifications for a user
 */
export async function fetchQuoteNotifications(
  userId: string,
  role: 'Admin' | 'Manager' | 'Agent'
): Promise<QuoteNotification[]> {
  try {
    let query = supabase
      .from('activity_log')
      .select(`
        id,
        entity_id,
        lead_id,
        lead_name,
        action_description,
        created_at,
        metadata
      `)
      .in('activity_type', ['quote_accepted', 'payment_received', 'client_info_returned'])
      .order('created_at', { ascending: false })
      .limit(50);

    // For agents, only show notifications for their assigned leads
    if (role === 'Agent') {
      // Get leads assigned to this agent
      const { data: assignedLeads } = await supabase
        .from('leads')
        .select('id')
        .eq('assigned_to', userId);

      if (assignedLeads && assignedLeads.length > 0) {
        const leadIds = assignedLeads.map(l => l.id);
        query = query.in('lead_id', leadIds);
      } else {
        // No assigned leads, return empty
        return [];
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching quote notifications:', error);
      return [];
    }

    if (!data) return [];

    // Transform to QuoteNotification format
    const notifications: QuoteNotification[] = data.map((item: any) => {
      const metadata = item.metadata || {};
      const quoteId = metadata.quoteId || item.entity_id || '';
      const quoteShortCode = metadata.quoteShortCode || quoteId.substring(0, 8).toUpperCase();

      let message = item.action_description || '';
      if (!message) {
        switch (item.activity_type) {
          case 'quote_accepted':
            message = `Quote ${quoteShortCode} - Accepted`;
            break;
          case 'payment_received':
            message = `Quote ${quoteShortCode}, Payment received`;
            break;
          case 'client_info_returned':
            message = `Quote ${quoteShortCode} - Client info returned`;
            break;
        }
      }

      return {
        id: item.id,
        type: item.activity_type as 'quote_accepted' | 'payment_received' | 'client_info_returned',
        quoteId,
        quoteShortCode,
        leadId: item.lead_id || '',
        leadName: item.lead_name || 'Unknown',
        message,
        createdAt: item.created_at,
        read: false // TODO: Add read status tracking if needed
      };
    });

    return notifications;
  } catch (error) {
    console.error('Error in fetchQuoteNotifications:', error);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationRead(_notificationId: string): Promise<boolean> {
  try {
    // TODO: If you add a read status column to activity_log or create a separate notifications table
    // For now, we'll just return true as the notifications are based on activity_log
    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
}

/**
 * Create a quote notification activity log entry
 */
export async function createQuoteNotification(
  type: 'quote_accepted' | 'payment_received' | 'client_info_returned',
  quoteId: string,
  leadId: string,
  leadName: string,
  quoteShortCode?: string,
  assignedTo?: string
): Promise<boolean> {
  try {
    let message = '';
    switch (type) {
      case 'quote_accepted':
        message = `Quote ${quoteShortCode || quoteId.substring(0, 8).toUpperCase()} - Accepted`;
        break;
      case 'payment_received':
        message = `Quote ${quoteShortCode || quoteId.substring(0, 8).toUpperCase()}, Payment received`;
        break;
      case 'client_info_returned':
        message = `Quote ${quoteShortCode || quoteId.substring(0, 8).toUpperCase()} - Client info returned`;
        break;
    }

    const { error } = await supabase
      .from('activity_log')
      .insert({
        activity_type: type,
        entity_type: 'quote',
        entity_id: quoteId,
        lead_id: leadId,
        lead_name: leadName,
        action_description: message,
        done_by_type: 'system',
        done_by_name: 'System',
        metadata: {
          quoteId,
          quoteShortCode: quoteShortCode || quoteId.substring(0, 8).toUpperCase(),
          notificationType: type,
          assignedTo
        }
      });

    if (error) {
      console.error('Error creating quote notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in createQuoteNotification:', error);
    return false;
  }
}
