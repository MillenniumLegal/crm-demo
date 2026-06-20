import { supabase } from '@/lib/supabase';

export interface AutomationStep {
  type: 'send_template' | 'assign_agent' | 'update_stage' | 'update_status' | 'create_task' | 'send_email' | 'send_sms' | 'instruct_solicitor' | 'send_quote_email' | 'send_quote_sms' | 'wait' | 'condition';
  config: Record<string, any>;
  order: number;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  triggerType: 'new_lead' | 'new_quote' | 'lead_assigned' | 'lead_stage_changed' | 'outcome_code_selected' | 'payment_received' | 'quote_accepted' | 'quote_sent' | 'task_completed' | 'custom';
  triggerConditions: Record<string, any>;
  steps: AutomationStep[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationExecution {
  id: string;
  automationId: string;
  entityType: string;
  entityId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errorMessage?: string;
  executedSteps: any[];
  createdAt: string;
  completedAt?: string;
}

export interface SolicitorFirm {
  id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  postcode?: string;
  contactPerson?: string;
  isActive: boolean;
  maxCapacity?: number;
  currentCapacity?: number;
  dailyCapacityLimit?: number;
  dailyCapacityUsed?: number;
  commissionRate?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SolicitorInstruction {
  id: string;
  leadId: string;
  solicitorFirmId: string;
  clientInfo: Record<string, any>;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed';
  sentAt?: string;
  sentBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fetch all automations
 */
export async function fetchAutomations(): Promise<Automation[]> {
  try {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching automations:', error);
      throw error;
    }

    return (data || []).map(transformAutomation);
  } catch (error) {
    console.error('Error in fetchAutomations:', error);
    return [];
  }
}

/**
 * Fetch automation by ID
 */
export async function fetchAutomationById(id: string): Promise<Automation | null> {
  try {
    const { data, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching automation:', error);
      return null;
    }

    return data ? transformAutomation(data) : null;
  } catch (error) {
    console.error('Error in fetchAutomationById:', error);
    return null;
  }
}

/**
 * Create a new automation
 */
export async function createAutomation(automation: Partial<Automation>): Promise<Automation | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('automations')
      .insert({
        name: automation.name,
        description: automation.description,
        is_active: automation.isActive ?? true,
        trigger_type: automation.triggerType,
        trigger_conditions: automation.triggerConditions || {},
        steps: automation.steps || [],
        created_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating automation:', error);
      throw error;
    }

    return data ? transformAutomation(data) : null;
  } catch (error) {
    console.error('Error in createAutomation:', error);
    return null;
  }
}

/**
 * Update an automation
 */
export async function updateAutomation(id: string, updates: Partial<Automation>): Promise<Automation | null> {
  try {
    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.triggerType !== undefined) updateData.trigger_type = updates.triggerType;
    if (updates.triggerConditions !== undefined) updateData.trigger_conditions = updates.triggerConditions;
    if (updates.steps !== undefined) updateData.steps = updates.steps;
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('automations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating automation:', error);
      throw error;
    }

    return data ? transformAutomation(data) : null;
  } catch (error) {
    console.error('Error in updateAutomation:', error);
    return null;
  }
}

/**
 * Delete an automation
 */
export async function deleteAutomation(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting automation:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteAutomation:', error);
    return false;
  }
}

/**
 * Fetch solicitor firms for CRM use (instruction, assignment, etc.)
 * Only returns firms with firm_type 'crm' or 'both' — excludes comparison-only firms.
 */
export async function fetchSolicitorFirms(): Promise<SolicitorFirm[]> {
  try {
    const { data, error } = await supabase
      .from('solicitor_firms')
      .select('*')
      .eq('is_active', true)
      .in('firm_type', ['crm', 'both'])
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching solicitor firms:', error);
      throw error;
    }

    return (data || []).map(transformSolicitorFirm);
  } catch (error) {
    console.error('Error in fetchSolicitorFirms:', error);
    return [];
  }
}

/**
 * Create solicitor instruction
 */
export async function createSolicitorInstruction(instruction: Partial<SolicitorInstruction>): Promise<SolicitorInstruction | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('solicitor_instructions')
      .insert({
        lead_id: instruction.leadId,
        solicitor_firm_id: instruction.solicitorFirmId,
        client_info: instruction.clientInfo || {},
        status: 'pending',
        sent_by: user?.id,
        notes: instruction.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating solicitor instruction:', error);
      throw error;
    }

    return data ? transformSolicitorInstruction(data) : null;
  } catch (error) {
    console.error('Error in createSolicitorInstruction:', error);
    return null;
  }
}

/**
 * Transform database automation to frontend format
 */
function transformAutomation(dbAutomation: any): Automation {
  return {
    id: dbAutomation.id,
    name: dbAutomation.name,
    description: dbAutomation.description,
    isActive: dbAutomation.is_active ?? true,
    triggerType: dbAutomation.trigger_type,
    triggerConditions: dbAutomation.trigger_conditions || {},
    steps: dbAutomation.steps || [],
    createdBy: dbAutomation.created_by,
    createdAt: dbAutomation.created_at,
    updatedAt: dbAutomation.updated_at,
  };
}

/**
 * Transform database solicitor firm to frontend format
 */
function transformSolicitorFirm(dbFirm: any): SolicitorFirm {
  return {
    id: dbFirm.id,
    name: dbFirm.name,
    email: dbFirm.email,
    phone: dbFirm.phone,
    address: dbFirm.address,
    city: dbFirm.city,
    postcode: dbFirm.postcode,
    contactPerson: dbFirm.contact_person,
    isActive: dbFirm.is_active ?? true,
    maxCapacity: dbFirm.max_capacity,
    currentCapacity: dbFirm.current_capacity,
    dailyCapacityLimit: dbFirm.daily_capacity_limit,
    dailyCapacityUsed: dbFirm.daily_capacity_used,
    commissionRate: dbFirm.commission_rate,
    notes: dbFirm.notes,
    createdAt: dbFirm.created_at,
    updatedAt: dbFirm.updated_at,
  };
}

/**
 * Transform database solicitor instruction to frontend format
 */
function transformSolicitorInstruction(dbInstruction: any): SolicitorInstruction {
  return {
    id: dbInstruction.id,
    leadId: dbInstruction.lead_id,
    solicitorFirmId: dbInstruction.solicitor_firm_id,
    clientInfo: dbInstruction.client_info || {},
    status: dbInstruction.status,
    sentAt: dbInstruction.sent_at,
    sentBy: dbInstruction.sent_by,
    notes: dbInstruction.notes,
    createdAt: dbInstruction.created_at,
    updatedAt: dbInstruction.updated_at,
  };
}

