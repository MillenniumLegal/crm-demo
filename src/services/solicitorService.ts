import { supabase } from '@/lib/supabase';

/**
 * Auto-assign solicitor firm to a lead based on capacity
 */
export async function autoAssignSolicitor(leadId: string): Promise<{
  success: boolean;
  solicitorFirmId?: string;
  solicitorFirmName?: string;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('auto-assign-solicitor', {
      body: { leadId },
    });

    if (error) {
      console.error('Error auto-assigning solicitor:', error);
      return { success: false, error: error.message || 'Failed to auto-assign solicitor' };
    }

    if (!data?.success) {
      return { success: false, error: data?.error || 'Auto-assignment failed' };
    }

    return {
      success: true,
      solicitorFirmId: data.data?.solicitorFirmId,
      solicitorFirmName: data.data?.solicitorFirmName,
    };
  } catch (err: any) {
    console.error('Error in autoAssignSolicitor:', err);
    return { success: false, error: err.message || 'Unexpected error during auto-assignment' };
  }
}

/**
 * Get solicitor firm capacity status (daily quota only)
 */
export async function getSolicitorCapacity(firmId: string): Promise<{
  dailyLimit: number;
  dailyUsed: number;
  available: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from('solicitor_firms')
      .select('daily_capacity_limit, daily_capacity_used, is_active')
      .eq('id', firmId)
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Firm not found');
    }

    return {
      dailyLimit: data.daily_capacity_limit || 0,
      dailyUsed: data.daily_capacity_used || 0,
      available: data.is_active && (data.daily_capacity_used || 0) < (data.daily_capacity_limit || 0),
    };
  } catch (err: any) {
    console.error('Error getting solicitor capacity:', err);
    throw err;
  }
}

/**
 * Increment solicitor firm daily capacity
 */
export async function incrementSolicitorCapacity(firmId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_solicitor_capacity', {
      firm_id: firmId
    });
    if (error) {
      throw error;
    }
  } catch (err) {
    console.error('Error incrementing solicitor capacity:', err);
    throw err;
  }
}

/**
 * Reset daily capacity (should be called daily via cron)
 */
export async function resetDailyCapacity(): Promise<void> {
  try {
    const { error } = await supabase.rpc('reset_daily_solicitor_capacity');
    if (error) {
      throw error;
    }
  } catch (err) {
    console.error('Error resetting daily capacity:', err);
    throw err;
  }
}

