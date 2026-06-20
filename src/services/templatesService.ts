import { supabase } from '@/lib/supabase';

export interface CommunicationTemplate {
  id: string;
  name: string;
  type: 'SMS' | 'Email';
  subject?: string;
  content: string;
  variables?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Transform database template to frontend interface
 */
function transformTemplate(dbTemplate: any): CommunicationTemplate {
  let variables: string[] = [];
  if (dbTemplate.variables) {
    if (typeof dbTemplate.variables === 'string') {
      try {
        variables = JSON.parse(dbTemplate.variables);
      } catch (e) {
        console.warn('Error parsing template variables:', e);
      }
    } else if (Array.isArray(dbTemplate.variables)) {
      variables = dbTemplate.variables;
    }
  }

  return {
    id: dbTemplate.id,
    name: dbTemplate.name,
    type: dbTemplate.type,
    subject: dbTemplate.subject || undefined,
    content: dbTemplate.content,
    variables,
    isActive: dbTemplate.is_active !== undefined ? dbTemplate.is_active : true,
    createdAt: dbTemplate.created_at,
    updatedAt: dbTemplate.updated_at
  };
}

/**
 * Fetch all active templates
 */
export async function fetchTemplates(type?: 'SMS' | 'Email'): Promise<CommunicationTemplate[]> {
  try {
    let query = supabase
      .from('communication_templates')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }

    return (data || []).map(transformTemplate);
  } catch (error) {
    console.error('Error in fetchTemplates:', error);
    return [];
  }
}

/**
 * Fetch a single template by ID
 */
export async function fetchTemplateById(id: string): Promise<CommunicationTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('communication_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return transformTemplate(data);
  } catch (error) {
    console.error('Error in fetchTemplateById:', error);
    return null;
  }
}

/**
 * Create a new template
 */
export async function createTemplate(template: Partial<CommunicationTemplate>): Promise<CommunicationTemplate | null> {
  try {
    const dbData: any = {
      name: template.name,
      type: template.type,
      content: template.content,
      is_active: template.isActive !== undefined ? template.isActive : true,
      variables: template.variables ? JSON.stringify(template.variables) : '[]',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (template.subject) {
      dbData.subject = template.subject;
    }

    const { data, error } = await supabase
      .from('communication_templates')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      throw error;
    }

    return transformTemplate(data);
  } catch (error) {
    console.error('Error in createTemplate:', error);
    return null;
  }
}

/**
 * Update an existing template
 */
export async function updateTemplate(id: string, updates: Partial<CommunicationTemplate>): Promise<CommunicationTemplate | null> {
  try {
    const dbUpdates: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.subject !== undefined) dbUpdates.subject = updates.subject;
    if (updates.content !== undefined) dbUpdates.content = updates.content;
    if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
    if (updates.variables !== undefined) dbUpdates.variables = JSON.stringify(updates.variables);

    const { data, error } = await supabase
      .from('communication_templates')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      throw error;
    }

    return transformTemplate(data);
  } catch (error) {
    console.error('Error in updateTemplate:', error);
    return null;
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('communication_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      throw error;
    }

    return true;
  } catch (error) {
    console.error('Error in deleteTemplate:', error);
    return false;
  }
}

/**
 * Sync default templates to database
 * This will insert templates if they don't exist (based on name + type)
 */
export async function syncDefaultTemplates(): Promise<{ success: boolean; message: string; synced: number }> {
  try {
    const defaultTemplates = [
      // SMS Templates
      {
        name: 'Initial Follow-up',
        type: 'SMS',
        subject: null,
        content: 'Hi {name}, just following up on your conveyancing quote. Please let me know if you have any questions.',
        variables: ['name']
      },
      {
        name: 'Quote Reminder',
        type: 'SMS',
        subject: null,
        content: 'Hi {name}, your quote of £{amount} is still valid. Would you like to proceed with your conveyancing?',
        variables: ['name', 'amount']
      },
      {
        name: 'Sold Confirmation',
        type: 'SMS',
        subject: null,
        content: 'Hi {name}, congratulations! Your conveyancing is now in progress. We\'ll be in touch soon.',
        variables: ['name']
      },
      {
        name: 'Callback Reminder',
        type: 'SMS',
        subject: null,
        content: 'Hi {name}, just a reminder that we\'ll call you at {time} today to discuss your conveyancing quote.',
        variables: ['name', 'time']
      },
      // Email Templates
      {
        name: 'Initial Quote',
        type: 'Email',
        subject: 'Your Conveyancing Quote - {name}',
        content: 'Dear {name},\n\nThank you for your interest in our conveyancing services. Please find attached your detailed quote for £{amount}.\n\nBest regards,\nMillennium Legal Team',
        variables: ['name', 'amount']
      },
      {
        name: 'Follow-up 1',
        type: 'Email',
        subject: 'Follow-up on Your Conveyancing Quote - {name}',
        content: 'Dear {name},\n\nI hope you\'re well. I wanted to follow up on the conveyancing quote we sent you. Do you have any questions?\n\nBest regards,\nMillennium Legal Team',
        variables: ['name']
      },
      {
        name: 'Follow-up 2',
        type: 'Email',
        subject: 'Final Follow-up on Your Conveyancing Quote - {name}',
        content: 'Dear {name},\n\nThis is our final follow-up regarding your conveyancing quote. The offer expires on {expiry_date}.\n\nBest regards,\nMillennium Legal Team',
        variables: ['name', 'expiry_date']
      },
      {
        name: 'Final Notice',
        type: 'Email',
        subject: 'Your Conveyancing Quote Expiring Soon - {name}',
        content: 'Dear {name},\n\nYour conveyancing quote will expire soon. Please contact us if you\'d like to proceed.\n\nBest regards,\nMillennium Legal Team',
        variables: ['name']
      }
    ];

    let syncedCount = 0;

    for (const template of defaultTemplates) {
      // Check if template already exists
      const { data: existing } = await supabase
        .from('communication_templates')
        .select('id')
        .eq('name', template.name)
        .eq('type', template.type)
        .single();

      if (!existing) {
        // Insert new template
        const { error } = await supabase
          .from('communication_templates')
          .insert({
            name: template.name,
            type: template.type,
            subject: template.subject,
            content: template.content,
            variables: JSON.stringify(template.variables),
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (!error) {
          syncedCount++;
        } else {
          console.error(`Error syncing template ${template.name}:`, error);
        }
      }
    }

    return {
      success: true,
      message: `Successfully synced ${syncedCount} template(s) to database.`,
      synced: syncedCount
    };
  } catch (error) {
    console.error('Error syncing templates:', error);
    return {
      success: false,
      message: `Failed to sync templates: ${error instanceof Error ? error.message : 'Unknown error'}`,
      synced: 0
    };
  }
}

