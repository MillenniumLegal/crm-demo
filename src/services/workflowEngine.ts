import { supabase } from '@/lib/supabase';
import { fetchAutomations, Automation, AutomationStep } from './automationService';
import { fetchLeadById, updateLead } from './leadsService';
import { fetchTemplates } from './templatesService';
import { createTask } from './tasksService';
import { logActivity } from './activityService';
import { createSolicitorInstruction } from './automationService';
import { fetchQuotes, ensureQuoteAcceptanceToken, updateQuote } from './quotesService';
import { generateQuoteEmailHTML, generateQuoteEmailText } from '@/utils/quoteEmailTemplate';
import { buildQuotePdf } from '@/utils/quotePdf';
import { sendOutlookEmail } from './outlookService';
import { sendSMS } from './smsService';

export interface WorkflowContext {
  leadId?: string;
  quoteId?: string;
  paymentId?: string;
  taskId?: string;
  userId?: string;
  triggerData?: Record<string, any>;
}

/**
 * Execute automation workflows based on triggers
 */
export class WorkflowEngine {
  /**
   * Trigger workflow execution for a specific event
   */
  static async triggerWorkflow(
    triggerType: Automation['triggerType'],
    context: WorkflowContext
  ): Promise<void> {
    try {
      // Fetch all active automations that match the trigger
      const automations = await fetchAutomations();
      const matchingAutomations = automations.filter(
        (auto) => auto.isActive && auto.triggerType === triggerType
      );

      // Check trigger conditions for each automation
      for (const automation of matchingAutomations) {
        if (await this.checkTriggerConditions(automation, context)) {
          await this.executeAutomation(automation, context);
        }
      }
    } catch (error) {
      console.error('Error triggering workflow:', error);
    }
  }

  /**
   * Check if trigger conditions are met
   */
  private static async checkTriggerConditions(
    automation: Automation,
    context: WorkflowContext
  ): Promise<boolean> {
    const conditions = automation.triggerConditions || {};

    // If no conditions, trigger matches
    if (Object.keys(conditions).length === 0) {
      return true;
    }

    // Check source condition
    if (conditions.source && context.leadId) {
      const lead = await fetchLeadById(context.leadId);
      if (!lead || lead.source !== conditions.source) {
        return false;
      }
    }

    // Check stage condition
    if (conditions.stage && context.leadId) {
      const lead = await fetchLeadById(context.leadId);
      if (!lead || lead.stage !== conditions.stage) {
        return false;
      }
    }

    // Check status condition
    if (conditions.status && context.leadId) {
      const lead = await fetchLeadById(context.leadId);
      if (!lead || lead.status !== conditions.status) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute an automation workflow
   */
  private static async executeAutomation(
    automation: Automation,
    context: WorkflowContext
  ): Promise<void> {
    // Create execution record
    const executionId = await this.createExecutionRecord(automation.id, context);

    try {
      // Update execution status to running
      await this.updateExecutionStatus(executionId, 'running');

      const executedSteps: any[] = [];

      // Execute steps in order
      let skipUntilNextCondition = false;
      for (const step of automation.steps.sort((a, b) => a.order - b.order)) {
        // Skip steps if we're in a condition block that failed
        if (skipUntilNextCondition && step.type !== 'condition') {
          executedSteps.push({
            step: step.order,
            type: step.type,
            skipped: true,
            reason: 'Condition not met',
          });
          continue;
        }

        // Reset skip flag when we hit a new condition
        if (step.type === 'condition') {
          skipUntilNextCondition = false;
        }

        try {
          const stepResult = await this.executeStep(step, context);
          
          // Handle condition step result
          if (step.type === 'condition' && stepResult) {
            if (!stepResult.conditionMet) {
              // Condition failed - skip subsequent steps until next condition
              skipUntilNextCondition = true;
            }
            executedSteps.push({
              step: step.order,
              type: step.type,
              success: true,
              result: stepResult,
              conditionMet: stepResult.conditionMet,
            });
          } else {
            executedSteps.push({
              step: step.order,
              type: step.type,
              success: true,
              result: stepResult,
            });
          }
        } catch (error: any) {
          executedSteps.push({
            step: step.order,
            type: step.type,
            success: false,
            error: error.message,
          });
          // Continue with next step even if one fails
          console.error(`Error executing step ${step.order}:`, error);
        }

        // Update execution with completed steps
        await this.updateExecutionSteps(executionId, executedSteps);
      }

      // Mark execution as completed
      await this.updateExecutionStatus(executionId, 'completed');
    } catch (error: any) {
      // Mark execution as failed
      await this.updateExecutionStatus(executionId, 'failed', error.message);
      console.error('Error executing automation:', error);
    }
  }

  /**
   * Execute a single automation step
   */
  private static async executeStep(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    switch (step.type) {
      case 'send_sms':
      case 'send_email':
      case 'send_template':
        return await this.executeSendTemplate(step, context);

      case 'assign_agent':
        return await this.executeAssignAgent(step, context);

      case 'update_stage':
        return await this.executeUpdateStage(step, context);

      case 'update_status':
        return await this.executeUpdateStatus(step, context);

      case 'create_task':
        return await this.executeCreateTask(step, context);

      case 'wait':
        return await this.executeWait(step);

      case 'condition':
        return await this.executeCondition(step, context);

      case 'instruct_solicitor':
        return await this.executeInstructSolicitor(step, context);

      case 'send_quote_email':
        return await this.executeSendQuoteEmail(step, context);

      case 'send_quote_sms':
        return await this.executeSendQuoteSMS(step, context);

      default:
        console.warn(`Unknown step type: ${step.type}`);
        return null;
    }
  }

  /**
   * Execute send template step
   */
  private static async executeSendTemplate(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId || !step.config.templateId) {
      throw new Error('Missing leadId or templateId');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    const templates = await fetchTemplates();
    const template = templates.find((t) => t.id === step.config.templateId);

    if (!template) {
      throw new Error('Template not found');
    }

    // Determine template type
    const templateType = step.type === 'send_sms' ? 'SMS' : 
                        step.type === 'send_email' ? 'Email' : 
                        step.config.type || template.type;

    // Log activity (actual sending would be handled by your communication service)
    await logActivity({
      activityType: 'note_added',
      entityType: 'lead',
      entityId: context.leadId,
      leadId: context.leadId,
      leadName: lead.name,
      actionDescription: `Automated ${templateType} sent via template: ${template.name}`,
      doneByType: 'system',
      doneById: undefined,
      doneByName: 'Automation System',
    });

    return { sent: true, templateType, templateName: template.name };
  }

  /**
   * Execute assign agent step
   */
  private static async executeAssignAgent(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId || !step.config.agentId) {
      throw new Error('Missing leadId or agentId');
    }

    const updated = await updateLead(context.leadId, {
      assignedTo: step.config.agentId,
      status: 'Assigned',
    });

    if (!updated) {
      throw new Error('Failed to assign agent');
    }

    return { assigned: true, agentId: step.config.agentId };
  }

  /**
   * Execute update stage step
   */
  private static async executeUpdateStage(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId || !step.config.stage) {
      throw new Error('Missing leadId or stage');
    }

    const updated = await updateLead(context.leadId, {
      stage: step.config.stage,
    });

    if (!updated) {
      throw new Error('Failed to update stage');
    }

    return { stageUpdated: true, newStage: step.config.stage };
  }

  /**
   * Execute update status step
   */
  private static async executeUpdateStatus(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId || !step.config.status) {
      throw new Error('Missing leadId or status');
    }

    const updated = await updateLead(context.leadId, {
      status: step.config.status,
    });

    if (!updated) {
      throw new Error('Failed to update status');
    }

    return { statusUpdated: true, newStatus: step.config.status };
  }

  /**
   * Execute create task step
   */
  private static async executeCreateTask(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId) {
      throw new Error('Missing leadId');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Calculate due date if specified
    let dueDate: Date | undefined;
    if (step.config.dueDate) {
      dueDate = new Date(step.config.dueDate);
    } else if (step.config.delayHours) {
      dueDate = new Date();
      dueDate.setHours(dueDate.getHours() + step.config.delayHours);
    }

    const task = await createTask({
      leadId: context.leadId,
      title: step.config.title || 'Automated Task',
      description: step.config.description || '',
      priority: step.config.priority || 'Medium',
      dueDate: dueDate?.toISOString(),
      assignedTo: context.userId || lead.assignedTo,
    });

    if (!task) {
      throw new Error('Failed to create task');
    }

    return { taskCreated: true, taskId: task.id };
  }

  /**
   * Execute wait step
   */
  private static async executeWait(step: AutomationStep): Promise<any> {
    const duration = step.config.duration || 0;
    const unit = step.config.unit || 'minutes';

    let milliseconds = 0;
    switch (unit) {
      case 'minutes':
        milliseconds = duration * 60 * 1000;
        break;
      case 'hours':
        milliseconds = duration * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = duration * 24 * 60 * 60 * 1000;
        break;
    }

    // For long waits, we'd typically use a job queue
    // For now, we'll just log it and return
    if (milliseconds > 0 && milliseconds < 60000) {
      // Only wait if less than 1 minute
      await new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    return { waited: true, duration, unit };
  }

  /**
   * Execute condition step - evaluates condition and returns result
   */
  private static async executeCondition(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId) {
      throw new Error('Condition step requires leadId in context');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found for condition evaluation');
    }

    const field = step.config.field || 'email';
    const operator = step.config.operator || 'exists';
    const value = step.config.value || '';

    // Get field value from lead based on field name
    let fieldValue: any = null;
    
    switch (field) {
      case 'email':
        fieldValue = lead.email;
        break;
      case 'phone':
        fieldValue = lead.phone;
        break;
      case 'name':
        fieldValue = lead.name;
        break;
      case 'status':
        fieldValue = lead.status;
        break;
      case 'stage':
        fieldValue = lead.stage;
        break;
      case 'source':
        fieldValue = lead.source;
        break;
      case 'assignedTo':
        fieldValue = lead.assignedTo;
        break;
      case 'transactionType':
        fieldValue = lead.transactionType;
        break;
      case 'propertyValue':
        fieldValue = lead.propertyValue;
        break;
      case 'hasQuote':
        fieldValue = lead.quoteId ? true : false;
        break;
      case 'quoteStatus':
        // Fetch quote to get status
        if (context.quoteId) {
          const { supabase } = await import('@/lib/supabase');
          const { data: quote } = await supabase
            .from('quotes')
            .select('status')
            .eq('id', context.quoteId)
            .single();
          fieldValue = quote?.status || null;
        } else if (lead.quoteId) {
          const { supabase } = await import('@/lib/supabase');
          const { data: quote } = await supabase
            .from('quotes')
            .select('status')
            .eq('id', lead.quoteId)
            .single();
          fieldValue = quote?.status || null;
        }
        break;
      case 'quoteAmount':
        fieldValue = lead.quoteAmount;
        break;
      default:
        fieldValue = (lead as any)[field];
    }

    // Evaluate condition
    let conditionResult = false;

    switch (operator) {
      case 'exists':
        conditionResult = fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
        break;
      case 'not_exists':
        conditionResult = fieldValue === null || fieldValue === undefined || fieldValue === '';
        break;
      case 'equals':
        conditionResult = String(fieldValue).toLowerCase() === String(value).toLowerCase();
        break;
      case 'not_equals':
        conditionResult = String(fieldValue).toLowerCase() !== String(value).toLowerCase();
        break;
      case 'contains':
        conditionResult = String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
        break;
      case 'starts_with':
        conditionResult = String(fieldValue).toLowerCase().startsWith(String(value).toLowerCase());
        break;
      case 'ends_with':
        conditionResult = String(fieldValue).toLowerCase().endsWith(String(value).toLowerCase());
        break;
      case 'matches':
        try {
          const regex = new RegExp(value, 'i');
          conditionResult = regex.test(String(fieldValue));
        } catch (e) {
          console.error('Invalid regex pattern:', value);
          conditionResult = false;
        }
        break;
      case 'in':
        const inList = value.split(',').map((v: string) => v.trim().toLowerCase());
        conditionResult = inList.includes(String(fieldValue).toLowerCase());
        break;
      case 'not_in':
        const notInList = value.split(',').map((v: string) => v.trim().toLowerCase());
        conditionResult = !notInList.includes(String(fieldValue).toLowerCase());
        break;
      case 'greater_than':
        conditionResult = Number(fieldValue) > Number(value);
        break;
      case 'less_than':
        conditionResult = Number(fieldValue) < Number(value);
        break;
      case 'greater_or_equal':
        conditionResult = Number(fieldValue) >= Number(value);
        break;
      case 'less_or_equal':
        conditionResult = Number(fieldValue) <= Number(value);
        break;
      default:
        conditionResult = false;
    }

    return {
      conditionMet: conditionResult,
      field,
      operator,
      value,
      fieldValue,
      shouldContinue: conditionResult, // If true, continue to next step; if false, skip
    };
  }

  /**
   * Execute instruct solicitor step
   */
  private static async executeInstructSolicitor(
    step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId || !step.config.solicitorFirmId) {
      throw new Error('Missing leadId or solicitorFirmId');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    // Collect client info from lead
    const clientInfo = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      propertyAddress: lead.propertyAddress,
      transactionType: lead.transactionType,
      propertyValue: lead.propertyValue,
      ...step.config.clientInfo, // Additional info from step config
    };

    // Create solicitor instruction
    const instruction = await createSolicitorInstruction({
      leadId: context.leadId,
      solicitorFirmId: step.config.solicitorFirmId,
      clientInfo,
      notes: step.config.notes,
    });

    if (!instruction) {
      throw new Error('Failed to create solicitor instruction');
    }

    // Update lead stage if specified
    if (step.config.updateStage) {
      await updateLead(context.leadId, {
        stage: 'Payment Completed - Awaiting Client Information',
      });
    }

    return { instructionCreated: true, instructionId: instruction.id };
  }

  /**
   * Execute send quote email step
   */
  private static async executeSendQuoteEmail(
    _step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId) {
      throw new Error('Missing leadId for send_quote_email step');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (!lead.email) {
      throw new Error('Lead email address is missing');
    }

    // Fetch the latest quote for the lead
    const quotes = await fetchQuotes({ leadId: context.leadId });
    if (!quotes || quotes.length === 0) {
      // Skip gracefully if no quote exists - this is expected for new leads
      console.log(`No quote found for lead ${context.leadId} - skipping send_quote_email step`);
      return { 
        skipped: true, 
        reason: 'No quote found for lead',
        leadId: context.leadId
      };
    }

    // Get the latest quote (most recently created)
    const leadQuote = quotes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    try {
      // Generate acceptance URL
      let acceptanceUrl: string | null = null;
      try {
        acceptanceUrl = await ensureQuoteAcceptanceToken(leadQuote.id);
      } catch (error) {
        console.warn('Could not generate acceptance URL:', error);
        // Continue without acceptance URL
      }

      // Generate email HTML and text using the template
      const emailHTML = generateQuoteEmailHTML({
        quote: leadQuote,
        acceptanceUrl: acceptanceUrl || undefined,
        clientName: lead.name,
        clientEmail: lead.email,
        propertyAddress: leadQuote.propertyAddress || lead.propertyAddress,
        transactionType: leadQuote.quoteType || leadQuote.transactionType || lead.transactionType || 'Conveyancing',
        expiryDate: leadQuote.expiryDate || leadQuote.validUntil
      });

      const emailText = generateQuoteEmailText({
        quote: leadQuote,
        acceptanceUrl: acceptanceUrl || undefined,
        clientName: lead.name,
        clientEmail: lead.email,
        propertyAddress: leadQuote.propertyAddress || lead.propertyAddress,
        transactionType: leadQuote.quoteType || leadQuote.transactionType || lead.transactionType || 'Conveyancing',
        expiryDate: leadQuote.expiryDate || leadQuote.validUntil
      });

      // Generate PDF attachment
      let quoteAttachment: { fileName: string; contentType: string; contentBytes: string } | undefined = undefined;
      try {
        const { doc, fileName } = await buildQuotePdf(leadQuote);
        const arrayBuffer = doc.output('arraybuffer');
        // Convert ArrayBuffer to Base64
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        
        quoteAttachment = {
          fileName,
          contentType: 'application/pdf',
          contentBytes: base64
        };
      } catch (error) {
        console.error('Error generating quote PDF:', error);
        // Continue without PDF attachment
      }

      // Send email via Outlook
      const transactionType = leadQuote.quoteType || leadQuote.transactionType || lead.transactionType || 'Conveyancing';
      const subject = `Your ${transactionType} Quote - Millennium Legal`;

      await sendOutlookEmail({
        to: lead.email,
        subject,
        htmlBody: emailHTML,
        textBody: emailText,
        leadId: lead.id,
        leadName: lead.name,
        metadata: {
          templateType: 'quote',
          quoteId: leadQuote.id,
          sentBy: context.userId || null,
          sentByName: 'Automation System',
          automationTriggered: true
        },
        attachments: quoteAttachment ? [quoteAttachment] : undefined,
        saveToSentItems: true
      });

      // Update quote status to "Sent" and set sentAt timestamp
      try {
        await updateQuote(leadQuote.id, {
          status: 'Sent' as const,
          sentAt: new Date().toISOString()
        }, context.userId, 'Automation System');
      } catch (error) {
        console.warn('Could not update quote status:', error);
        // Continue anyway - email was sent
      }

      // Log contact history
      // Generate a UUID for the contact attempt entity
      const contactAttemptId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
      
      await logActivity({
        activityType: 'contact_attempt',
        entityType: 'contact_attempt',
        entityId: contactAttemptId,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Quote email sent to ${lead.email} (via automation)`,
        doneByType: 'system',
        doneById: context.userId,
        doneByName: 'Automation System',
        metadata: {
          channel: 'email',
          subject,
          templateType: 'quote',
          quoteId: leadQuote.id,
          automationTriggered: true
        }
      });

      return { 
        sent: true, 
        quoteId: leadQuote.id,
        email: lead.email,
        subject 
      };
    } catch (error) {
      console.error('Error in executeSendQuoteEmail:', error);
      throw error;
    }
  }

  /**
   * Execute send quote SMS step
   */
  private static async executeSendQuoteSMS(
    _step: AutomationStep,
    context: WorkflowContext
  ): Promise<any> {
    if (!context.leadId) {
      throw new Error('Missing leadId for send_quote_sms step');
    }

    const lead = await fetchLeadById(context.leadId);
    if (!lead) {
      throw new Error('Lead not found');
    }

    if (!lead.phone) {
      throw new Error('Lead phone number is missing');
    }

    // Fetch the latest quote for the lead
    const quotes = await fetchQuotes({ leadId: context.leadId });
    if (!quotes || quotes.length === 0) {
      // Skip gracefully if no quote exists - this is expected for new leads
      console.log(`No quote found for lead ${context.leadId} - skipping send_quote_sms step`);
      return { 
        skipped: true, 
        reason: 'No quote found for lead',
        leadId: context.leadId
      };
    }

    // Get the latest quote (most recently created)
    const leadQuote = quotes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    try {
      // Generate SMS content with template
      const smsContent = `Thanks for getting a quote from Millennium Legal.

Look out for our quote email (possibly in spam).

Call us on 01704 773288 to discuss your quote.`;

      // Send SMS via Twilio
      const smsResult = await sendSMS({
        to: lead.phone,
        message: smsContent,
        leadId: lead.id,
        leadName: lead.name,
        metadata: {
          templateType: 'quote',
          quoteId: leadQuote.id,
          sentBy: context.userId || null,
          sentByName: 'Automation System',
          automationTriggered: true
        }
      });

      // Log contact history
      await logActivity({
        activityType: 'sms_sent',
        entityType: 'quote',
        entityId: leadQuote.id,
        leadId: lead.id,
        leadName: lead.name,
        actionDescription: `Quote SMS sent to ${lead.phone} - Done by: Auto Send Quote SMS on New Quote`,
        doneByType: 'system',
        doneById: context.userId,
        doneByName: 'Auto Send Quote SMS on New Quote',
        metadata: {
          channel: 'sms',
          templateType: 'quote',
          quoteId: leadQuote.id,
          automationTriggered: true,
          phone: lead.phone
        }
      });

      return { 
        sent: true, 
        quoteId: leadQuote.id,
        phone: lead.phone,
        sid: smsResult.sid
      };
    } catch (error) {
      console.error('Error in executeSendQuoteSMS:', error);
      throw error;
    }
  }

  /**
   * Create execution record
   */
  private static async createExecutionRecord(
    automationId: string,
    context: WorkflowContext
  ): Promise<string> {
    const entityType = context.leadId ? 'lead' : 
                      context.quoteId ? 'quote' : 
                      context.paymentId ? 'payment' : 'unknown';
    const entityId = context.leadId || context.quoteId || context.paymentId || '';

    const { data, error } = await supabase
      .from('automation_executions')
      .insert({
        automation_id: automationId,
        entity_type: entityType,
        entity_id: entityId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create execution record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update execution status
   */
  private static async updateExecutionStatus(
    executionId: string,
    status: 'running' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString(),
    };

    if (status === 'completed' || status === 'failed') {
      updateData.completed_at = new Date().toISOString();
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabase
      .from('automation_executions')
      .update(updateData)
      .eq('id', executionId);

    if (error) {
      console.error('Error updating execution status:', error);
    }
  }

  /**
   * Update executed steps
   */
  private static async updateExecutionSteps(
    executionId: string,
    executedSteps: any[]
  ): Promise<void> {
    const { error } = await supabase
      .from('automation_executions')
      .update({
        executed_steps: executedSteps,
        updated_at: new Date().toISOString(),
      })
      .eq('id', executionId);

    if (error) {
      console.error('Error updating execution steps:', error);
    }
  }
}

/**
 * Helper functions to trigger workflows from various parts of the app
 */
export const triggerNewLeadWorkflow = async (leadId: string, userId?: string) => {
  await WorkflowEngine.triggerWorkflow('new_lead', {
    leadId,
    userId,
    triggerData: { event: 'lead_created' },
  });
};

export const triggerLeadAssignedWorkflow = async (leadId: string, userId?: string) => {
  await WorkflowEngine.triggerWorkflow('lead_assigned', {
    leadId,
    userId,
    triggerData: { event: 'lead_assigned' },
  });
};

export const triggerStageChangedWorkflow = async (
  leadId: string,
  oldStage: string,
  newStage: string,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('lead_stage_changed', {
    leadId,
    userId,
    triggerData: { oldStage, newStage },
  });
};

export const triggerOutcomeCodeWorkflow = async (
  leadId: string,
  outcomeCode: string,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('outcome_code_selected', {
    leadId,
    userId,
    triggerData: { outcomeCode },
  });
};

export const triggerPaymentReceivedWorkflow = async (
  leadId: string,
  paymentId: string,
  amount: number,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('payment_received', {
    leadId,
    paymentId,
    userId,
    triggerData: { amount, event: 'payment_received' },
  });
};

export const triggerQuoteAcceptedWorkflow = async (
  leadId: string,
  quoteId: string,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('quote_accepted', {
    leadId,
    quoteId,
    userId,
    triggerData: { event: 'quote_accepted' },
  });
};

export const triggerQuoteSentWorkflow = async (
  leadId: string,
  quoteId: string,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('quote_sent', {
    leadId,
    quoteId,
    userId,
    triggerData: { event: 'quote_sent' },
  });
};

export const triggerNewQuoteWorkflow = async (
  leadId: string,
  quoteId: string,
  userId?: string
) => {
  await WorkflowEngine.triggerWorkflow('new_quote', {
    leadId,
    quoteId,
    userId,
    triggerData: { event: 'quote_created' },
  });
};
