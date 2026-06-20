import { supabase } from '@/lib/supabase';
import { createTask } from './tasksService';
import { updateLead } from './leadsService';
import { logActivity } from './activityService';

// Disqualify ("not a genuine lead") outcome codes. Selecting one of these
// funnel-archives the lead and removes it from the agent's quota (via the
// disqualify_lead RPC) so managers see true lead numbers. These are JUNK
// reasons only — genuine-but-lost outcomes (Not Interested, Gone Elsewhere,
// Getting prices) are NOT here: those were real leads the agent worked.
export type DisqualifyCategory = 'fake' | 'duplicate' | 'wrong_number' | 'test';

export const DISQUALIFY_OUTCOME_CATEGORIES: Record<string, DisqualifyCategory> = {
  'Fake Lead': 'fake',
  'Duplicate Lead': 'duplicate',
  'Fake/Duplicate Quote': 'fake', // legacy combined code → counts as fake
  'Wrong Number': 'wrong_number',
  'Incorrect Number': 'wrong_number',
  'Test Lead': 'test',
};

export const DISQUALIFY_CATEGORY_LABELS: Record<DisqualifyCategory, string> = {
  fake: 'Fake',
  duplicate: 'Duplicate',
  wrong_number: 'Wrong number',
  test: 'Test',
};

export const DISQUALIFY_CATEGORY_ORDER: DisqualifyCategory[] = ['fake', 'duplicate', 'wrong_number', 'test'];

export function getDisqualifyCategory(outcomeCode: string): DisqualifyCategory | null {
  return DISQUALIFY_OUTCOME_CATEGORIES[outcomeCode] || null;
}

export interface OutcomeCodeAction {
  outcomeCode: string;
  autoSendEmail?: boolean;
  autoSendSMS?: boolean;
  emailTemplate?: string;
  smsTemplate?: string;
  createFollowUpTask?: boolean;
  followUpDelayHours?: number;
  nextStage?: string;
  nextTaskTitle?: string;
  nextTaskType?: 'Call' | 'Email' | 'SMS' | 'Follow-up' | 'Payment';
}

/**
 * Outcome code action mappings
 */
export const outcomeCodeActions: { [key: string]: OutcomeCodeAction } = {
  'Called - No Answer': {
    outcomeCode: 'Called - No Answer',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: true,
    followUpDelayHours: 2,
    nextStage: 'Call-2',
    nextTaskTitle: 'Call 2 - Follow-up',
    nextTaskType: 'Call'
  },
  'Called - Voicemail': {
    outcomeCode: 'Called - Voicemail',
    autoSendEmail: true,
    autoSendSMS: true,
    emailTemplate: 'voicemail_followup',
    smsTemplate: 'voicemail_followup',
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: 'Call-2',
    nextTaskTitle: 'Call 2 - Follow-up',
    nextTaskType: 'Call'
  },
  'Called - Busy': {
    outcomeCode: 'Called - Busy',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: true,
    followUpDelayHours: 1,
    nextStage: 'Call-2',
    nextTaskTitle: 'Call 2 - Follow-up',
    nextTaskType: 'Call'
  },
  'Number Invalid': {
    outcomeCode: 'Number Invalid',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Incorrect Number': {
    outcomeCode: 'Incorrect Number',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Interested - Call Back': {
    outcomeCode: 'Interested - Call Back',
    autoSendEmail: true,
    autoSendSMS: true,
    emailTemplate: 'interested_callback',
    smsTemplate: 'interested_callback',
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: 'Interested', // Move to Interested stage, not Call-2
    nextTaskTitle: 'Follow-up - Interested Lead',
    nextTaskType: 'Follow-up'
  },
  'Interested - Reviewing': {
    outcomeCode: 'Interested - Reviewing',
    autoSendEmail: true,
    emailTemplate: 'reviewing_followup',
    createFollowUpTask: true,
    followUpDelayHours: 48,
    nextStage: 'Interested',
    nextTaskTitle: 'Follow-up - Review Status',
    nextTaskType: 'Follow-up'
  },
  'Not Interested': {
    outcomeCode: 'Not Interested',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Sold!': {
    outcomeCode: 'Sold!',
    autoSendEmail: true,
    emailTemplate: 'sold_confirmation',
    autoSendSMS: true,
    smsTemplate: 'sold_confirmation',
    createFollowUpTask: false,
    nextStage: 'Instructed'
  },
  'Wrong Number': {
    outcomeCode: 'Wrong Number',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Callback Scheduled': {
    outcomeCode: 'Callback Scheduled',
    autoSendEmail: true,
    emailTemplate: 'callback_confirmation',
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: undefined, // Will be calculated based on current stage
    nextTaskTitle: 'Scheduled Callback',
    nextTaskType: 'Call'
  },
  'Ready to Solicit': {
    outcomeCode: 'Ready to Solicit',
    autoSendEmail: true,
    emailTemplate: 'ready_to_instruct',
    createFollowUpTask: false,
    nextStage: 'Ready to Solicit'
  },
  'Awaiting Payment': {
    outcomeCode: 'Awaiting Payment',
    autoSendEmail: true,
    emailTemplate: 'payment_reminder',
    createFollowUpTask: true,
    followUpDelayHours: 48,
    nextStage: 'Quote Accepted - Awaiting Payment',
    nextTaskTitle: 'Follow-up Payment',
    nextTaskType: 'Payment'
  },
  'Awaiting Client Info': {
    outcomeCode: 'Awaiting Client Info',
    autoSendEmail: true,
    emailTemplate: 'info_request',
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: 'Payment Completed - Awaiting Client Information',
    nextTaskTitle: 'Follow-up Client Information',
    nextTaskType: 'Follow-up'
  },
  'Payment Completed - Awaiting Client Information': {
    outcomeCode: 'Payment Completed - Awaiting Client Information',
    autoSendEmail: true,
    emailTemplate: 'info_request',
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: 'Payment Completed - Awaiting Client Information',
    nextTaskTitle: 'Follow-up Client Information',
    nextTaskType: 'Follow-up'
  },
  'Gone Elsewhere': {
    outcomeCode: 'Gone Elsewhere',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Getting prices': {
    outcomeCode: 'Getting prices',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Just Getting prices': {
    outcomeCode: 'Getting prices', // Normalize to "Getting prices" for database
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled'
  },
  'Custom Reason': {
    outcomeCode: 'Custom Reason',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: false,
    nextStage: 'Cancelled' // Custom Reason moves to Cancelled stage
  },
  'Recalled': {
    outcomeCode: 'Recalled',
    autoSendEmail: false,
    autoSendSMS: false,
    createFollowUpTask: true,
    followUpDelayHours: 24,
    nextStage: undefined, // Will be calculated based on current stage (stays at Call-5)
    nextTaskTitle: 'Call Back - Recalled',
    nextTaskType: 'Call'
  }
};

/**
 * Process outcome code and trigger auto-actions
 */
export async function processOutcomeCode(
  leadId: string,
  leadName: string,
  _leadEmail: string,
  leadPhone: string,
  outcomeCode: string,
  assignedTo: string,
  customReason?: string,
  currentStage?: string,
  leadData?: any // Optional full lead data to avoid extra fetch
): Promise<{ success: boolean; message: string }> {
  try {
    // Special validation ONLY for "Ready to Solicit" outcome code
    // "Payment Received" or "Payment Completed - Awaiting Client Information" should NOT trigger this validation
    // They are used to MARK payment as received, not to move to Ready to Solicit
    // NOTE: Payment validation is handled in the UI (LeadManagement.tsx) which shows the override modal
    // This service function should NOT block payment override - let the UI handle it
    if (outcomeCode === 'Ready to Solicit') {
      const { supabase } = await import('@/lib/supabase');
      
      // Fetch full lead data if not provided
      let fullLeadData = leadData;
      if (!fullLeadData) {
        const { data: fetchedLead, error: leadError } = await supabase
          .from('leads')
          .select('id, stage, instruction_form_status, instruction_pdf_url, payment_link_status, quote_id, client_address, client_dob, client_ni, property_address, property_value, transaction_type')
          .eq('id', leadId)
          .single();
        
        if (leadError || !fetchedLead) {
          return {
            success: false,
            message: 'Lead not found. Cannot proceed with outcome code.'
          };
        }
        fullLeadData = fetchedLead;
      }

      // Check if payment has been completed (including manual override)
      // Payment is completed if:
      // 1. payment_link_status is 'paid' (includes manual override)
      // 2. Quote status is "Accepted" (payment completed via Stripe)
      // 3. Stage is "Payment Completed - Awaiting Client Information" or beyond
      const hasCompletedPayment = 
        fullLeadData.payment_link_status === 'paid' || // This includes manual override
        fullLeadData.stage === 'Payment Completed - Awaiting Client Information' ||
        fullLeadData.stage === 'Ready to Solicit' ||
        fullLeadData.stage === 'Completed';

      // For "Ready to Solicit", require BOTH payment AND instruction form
      // But don't block if payment_link_status is 'paid' (could be manual override)
      // The UI will handle showing the override modal before calling this function
      if (!hasCompletedPayment) {
        // Check if quote is accepted (Stripe payment)
        let hasAcceptedQuote = false;
        if (fullLeadData.quote_id) {
          try {
            const { data: quote, error: quoteError } = await supabase
              .from('quotes')
              .select('status')
              .eq('id', fullLeadData.quote_id)
              .single();
            
            if (!quoteError && quote && quote.status === 'Accepted') {
              hasAcceptedQuote = true;
            }
          } catch (error) {
            console.warn('Could not check quote status:', error);
          }
        }
        
        // Only return error if payment is truly not completed (not even via override)
        // If payment_link_status is 'paid', it means override was already done
        if (!hasAcceptedQuote && fullLeadData.payment_link_status !== 'paid') {
          return {
            success: false,
            message: 'Cannot move to "Ready to Solicit" stage. The client must complete payment (£230 deposit) first. Please use the payment override option if payment was received outside the system.'
          };
        }
      }

      // Check both snake_case and camelCase field names for PDF URL
      const hasInstructionPdf = !!(fullLeadData.instruction_pdf_url || fullLeadData.instructionPdfUrl);
      // Check for instruction form data fields (clientAddress, clientDob, clientNi, propertyAddress, propertyValue, transactionType)
      const hasInstructionFormData = !!(
        fullLeadData.client_address || fullLeadData.clientAddress ||
        fullLeadData.client_dob || fullLeadData.clientDob ||
        fullLeadData.client_ni || fullLeadData.clientNi ||
        fullLeadData.property_address || fullLeadData.propertyAddress ||
        fullLeadData.property_value || fullLeadData.propertyValue ||
        fullLeadData.transaction_type || fullLeadData.transactionType
      );
      
      // Allow if already in Ready to Solicit, Completed, or Instructed stage
      const isAlreadyInCorrectStage = fullLeadData.stage === 'Ready to Solicit' || 
                                       fullLeadData.stage === 'Completed' || 
                                       fullLeadData.stage === 'Instructed';
      
      // If instruction form status is 'submitted', allow (form was submitted even if PDF is still generating)
      const isFormSubmitted = fullLeadData.instruction_form_status === 'submitted';
      
      // Validation: If not already in correct stage and form not submitted, require BOTH PDF AND form data
      // Error if EITHER is missing - this prevents saving the outcome code
      if (!isAlreadyInCorrectStage && !isFormSubmitted) {
        if (!hasInstructionPdf || !hasInstructionFormData) {
          return {
            success: false,
            message: 'Cannot move to "Ready to Solicit" stage. The instruction form must be submitted first. Please ensure the instruction form is submitted before proceeding.'
          };
        }
      }
    }

    // Special validation for "Sold!" outcome code
    // Requires: Payment completed + Instruction form submitted + At least "Ready to Solicit" stage
    if (outcomeCode === 'Sold!') {
      const { supabase } = await import('@/lib/supabase');
      
      // Fetch full lead data if not provided
      let fullLeadData = leadData;
      if (!fullLeadData) {
        const { data: fetchedLead, error: leadError } = await supabase
          .from('leads')
          .select('id, stage, instruction_form_status, instruction_pdf_url, payment_link_status, quote_id')
          .eq('id', leadId)
          .single();
        
        if (leadError || !fetchedLead) {
          return {
            success: false,
            message: 'Lead not found. Cannot proceed with outcome code.'
          };
        }
        fullLeadData = fetchedLead;
      }

      // Check if lead has an accepted quote (payment completed via Stripe)
      let hasAcceptedQuote = false;
      if (fullLeadData.quote_id) {
        try {
          const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select('status')
            .eq('id', fullLeadData.quote_id)
            .single();
          
          if (!quoteError && quote && quote.status === 'Accepted') {
            hasAcceptedQuote = true;
          }
        } catch (error) {
          console.warn('Could not check quote status:', error);
        }
      }

      // Check if payment has been completed
      const hasCompletedPayment = 
        hasAcceptedQuote ||
        fullLeadData.stage === 'Payment Completed - Awaiting Client Information' ||
        fullLeadData.stage === 'Ready to Solicit' ||
        fullLeadData.stage === 'Completed' ||
        fullLeadData.instruction_form_status === 'submitted' ||
        fullLeadData.payment_link_status === 'paid';

      // Check if instruction form has been submitted
      // Instruction form is considered submitted if:
      // 1. instruction_form_status is 'submitted'
      // 2. instruction_pdf_url or instructionPdfUrl exists (PDF is available)
      // 3. Stage is already 'Ready to Solicit' or 'Completed'
      // Check both snake_case and camelCase field names for PDF URL
      const hasInstructionPdf = !!(fullLeadData.instruction_pdf_url || fullLeadData.instructionPdfUrl);
      const hasSubmittedInstructionForm = 
        fullLeadData.instruction_form_status === 'submitted' ||
        hasInstructionPdf || // PDF exists = form is submitted
        fullLeadData.stage === 'Ready to Solicit' ||
        fullLeadData.stage === 'Completed';

      // Build error message based on what's missing
      if (!hasCompletedPayment && !hasSubmittedInstructionForm) {
        return {
          success: false,
          message: 'Cannot mark lead as "Sold". The client must complete payment (£230 deposit) and submit the instruction form first. Please ensure both payment and instruction form submission are completed before proceeding.'
        };
      }

      if (!hasCompletedPayment) {
        // Determine current stage for better error message
        const currentStage = fullLeadData.stage || 'Unknown';
        if (currentStage === 'Quote Accepted - Awaiting Payment' || currentStage.startsWith('Call-')) {
          return {
            success: false,
            message: `Cannot mark lead as "Sold". The client must complete payment (£230 deposit) first. Current stage: "${currentStage}". Please ensure payment is completed before proceeding.`
          };
        }
        return {
          success: false,
          message: `Cannot mark lead as "Sold". Payment (£230 deposit) has not been completed. Current stage: "${currentStage}". Please ensure payment is completed before proceeding.`
        };
      }

      if (!hasSubmittedInstructionForm) {
        // Determine current stage for better error message
        const currentStage = fullLeadData.stage || 'Unknown';
        if (currentStage === 'Payment Completed - Awaiting Client Information') {
          return {
            success: false,
            message: 'Cannot mark lead as "Sold". The instruction form must be submitted first. Current stage: "Payment Completed - Awaiting Client Information". Please send the instruction form to the client and wait for submission before proceeding.'
          };
        }
        return {
          success: false,
          message: `Cannot mark lead as "Sold". The instruction form has not been submitted yet. Current stage: "${currentStage}". Please ensure the instruction form is submitted before proceeding.`
        };
      }

      // Check if lead is at least in "Ready to Solicit" stage
      // If not, they should use "Ready to Solicit" outcome code first
      if (fullLeadData.stage !== 'Ready to Solicit' && fullLeadData.stage !== 'Completed') {
        return {
          success: false,
          message: `Cannot mark lead as "Sold". The lead must be in "Ready to Solicit" stage first. Current stage: "${fullLeadData.stage}". Please select "Ready to Solicit" outcome code first, then instruct the solicitor before marking as "Sold".`
        };
      }
    }

    // Fetch current lead to get stage and payment/instruction status if not provided
    let leadStage = currentStage;
    let paymentStatus = null;
    let instructionFormStatus = null;
    
    if (!leadData) {
      const { supabase } = await import('@/lib/supabase');
      const { data: fetchedLeadData } = await supabase
        .from('leads')
        .select('stage, payment_link_status, instruction_form_status, instruction_pdf_url')
        .eq('id', leadId)
        .single();
      if (fetchedLeadData) {
        leadStage = fetchedLeadData.stage || 'New';
        paymentStatus = fetchedLeadData.payment_link_status;
        instructionFormStatus = fetchedLeadData.instruction_form_status;
      } else {
        leadStage = 'New';
      }
    } else {
      paymentStatus = leadData.payment_link_status;
      instructionFormStatus = leadData.instruction_form_status;
    }

    // Determine next stage based on current stage and outcome code
    // getNextStage() handles stage progression (Call-1 → Call-2 → Call-3, etc.)
    const nextStage = getNextStage(leadStage || 'New', outcomeCode);
    
    const action = outcomeCodeActions[outcomeCode];
    
    // Use getNextStage() as primary source of truth for stage progression
    // Only use action.nextStage for direct stage transitions that don't depend on current stage
    // (e.g., 'Ready to Solicit', 'Completed', 'Interested' when coming from any stage)
    let finalStage = nextStage;
    
    // Only override with action.nextStage if:
    // 1. It's a direct transition (not a Call-X progression)
    // 2. OR if getNextStage() returned the same stage (no progression found)
    const actionNextStage = action?.nextStage;
    const isDirectTransition = actionNextStage && 
      !actionNextStage.startsWith('Call-') && 
      actionNextStage !== nextStage;
    
    if (isDirectTransition) {
      finalStage = actionNextStage;
      console.log('Using direct transition from action:', actionNextStage);
    } else if (nextStage === leadStage && actionNextStage) {
      // If getNextStage didn't find a progression, use action.nextStage as fallback
      finalStage = actionNextStage;
      console.log('No progression found, using action.nextStage as fallback:', actionNextStage);
    } else {
      // Use the calculated nextStage from getNextStage()
      finalStage = nextStage;
      console.log('Using calculated nextStage from getNextStage():', nextStage);
    }
    
    // Override: If payment received AND instruction form already submitted, move to "Ready to Solicit"
    if ((outcomeCode === 'Payment Completed - Awaiting Client Information' || 
         outcomeCode === 'Payment Received' ||
         (outcomeCode === 'Custom Reason' && customReason?.toLowerCase().includes('payment'))) &&
        paymentStatus === 'paid' &&
        instructionFormStatus === 'submitted') {
      finalStage = 'Ready to Solicit';
      console.log('✅ Payment received + instruction form submitted → Moving directly to "Ready to Solicit"');
    }
    
    console.log('📊 Stage Update:', {
      leadId,
      currentStage: leadStage,
      outcomeCode,
      calculatedNextStage: nextStage,
      actionNextStage: action?.nextStage,
      finalStage
    });

    // Update lead with outcome code and calculated next stage
    const updateData: any = {
      stage: finalStage
    };
    
    // If "Quote Accepted - Awaiting Payment" outcome code, set priority to High and status to Interested
    if (outcomeCode === 'Quote Accepted - Awaiting Payment' || outcomeCode === 'Awaiting Payment') {
      updateData.priority = 'High';
      updateData.status = 'Interested';
    }
    
    // If "Payment Received" or "Payment Completed" outcome code, also update payment status
    if (outcomeCode === 'Payment Completed - Awaiting Client Information' || 
        outcomeCode === 'Payment Received' ||
        (outcomeCode === 'Custom Reason' && customReason?.toLowerCase().includes('payment'))) {
      updateData.payment_link_status = 'paid';
    }

    let statusUpdate: string | undefined;
    if (outcomeCode === 'Sold!') {
      statusUpdate = 'Sold';
    } else if (['Not Interested', 'Wrong Number', 'Gone Elsewhere', 'Incorrect Number', 'Fake/Duplicate Quote', 'Fake Lead', 'Duplicate Lead', 'Test Lead', 'Getting prices', 'Custom Reason'].includes(outcomeCode) || finalStage === 'Cancelled') {
      statusUpdate = 'Closed';
    } else if (finalStage === 'Instructed') {
      statusUpdate = 'Sold';
    }

    if (statusUpdate) {
      updateData.status = statusUpdate;
    }
    
    // Add outcome code if provided (will be skipped if column doesn't exist)
    // Normalize "Just Getting prices" to "Getting prices" for consistency
    if (outcomeCode) {
      const normalizedOutcomeCode = outcomeCode === 'Just Getting prices' ? 'Getting prices' : outcomeCode;
      updateData.outcomeCode = normalizedOutcomeCode;
    }
    
    // Add custom reason if provided
    // Also set "Call Attempts Exceeded" if cancelling from Call-5 with repeat outcomes
    if (customReason) {
      updateData.customOutcomeReason = customReason;
    } else if (leadStage === 'Call-5' && 
               ['Called - No Answer', 'Called - Voicemail', 'Called - Busy'].includes(outcomeCode) &&
               finalStage === 'Cancelled') {
      updateData.customOutcomeReason = 'Call Attempts Exceeded';
    }
    
    // Store outcome code in notes as fallback if outcome_code column doesn't exist
    // This ensures we don't lose the outcome information
    const outcomeNote = `[Outcome: ${outcomeCode}${customReason ? ` - ${customReason}` : ''}]`;
    // We'll update notes separately if outcome_code column doesn't exist

    console.log('📤 Attempting to update lead:', {
      leadId,
      updateData,
      expectedStage: finalStage
    });
    
    const updatedLead = await updateLead(leadId, updateData);

    // Junk-lead disqualification: funnel-archive the lead and take it off the
    // agent's quota so managers see true numbers. Graceful if the RPC isn't
    // deployed yet — the lead is still Closed/Cancelled from the update above.
    const disqualifyCategory = DISQUALIFY_OUTCOME_CATEGORIES[outcomeCode];
    if (disqualifyCategory && updatedLead) {
      const { error: disqualifyError } = await supabase.rpc('disqualify_lead', {
        p_lead_id: leadId,
        p_category: disqualifyCategory,
        p_reason: customReason || outcomeCode,
      });
      if (disqualifyError) {
        console.warn('disqualify_lead RPC unavailable (run add_lead_disqualification.sql):', disqualifyError.message);
      }
    }

    // Create quote_accepted notification if outcome code is "Quote Accepted - Awaiting Payment"
    if ((outcomeCode === 'Quote Accepted - Awaiting Payment' || outcomeCode === 'Awaiting Payment') && updatedLead) {
      try {
        // Get quote info for notification
        let quoteShortCode = 'UNKNOWN';
        let quoteId = updatedLead.quoteId || '';
        
        if (quoteId) {
          const { data: quoteData } = await supabase
            .from('quotes')
            .select('id, short_code')
            .eq('id', quoteId)
            .maybeSingle();
          
          if (quoteData) {
            quoteShortCode = quoteData.short_code || quoteId.substring(0, 8).toUpperCase();
          }
        }
        
        await logActivity({
          activityType: 'quote_accepted' as any, // Type assertion needed until TypeScript refreshes
          entityType: 'quote',
          entityId: quoteId || leadId,
          leadId: leadId,
          leadName: leadName,
          actionDescription: `Quote ${quoteShortCode} - Accepted`,
          doneByType: 'user',
          doneById: assignedTo,
          doneByName: 'Agent',
          metadata: {
            quoteId: quoteId || '',
            quoteShortCode,
            notificationType: 'quote_accepted',
            stage: finalStage,
            priority: 'High',
            assignedTo: updatedLead.assignedTo || assignedTo
          }
        });
        
        console.log('✅ Quote accepted notification created for outcome code');
      } catch (notifError) {
        console.error('Error creating quote accepted notification:', notifError);
        // Don't fail the outcome code processing if notification fails
      }
    }
    
    if (!updatedLead) {
      console.error('❌ Failed to update lead:', leadId);
      // Try updating just the stage as a last resort
      console.log('🔄 Attempting stage-only update as fallback...');
      const stageOnlyUpdate = await updateLead(leadId, { stage: finalStage as any });
      if (stageOnlyUpdate) {
        console.log('✅ Stage updated successfully (stage-only fallback):', stageOnlyUpdate.stage);
        return { 
          success: true, 
          message: `Stage updated to: ${finalStage}. Note: outcome code column may not exist in database.` 
        };
      }
      console.error('❌ Stage-only update also failed');
      return { success: false, message: 'Failed to update lead stage' };
    }
    
    // Verify the stage was actually updated
    if (updatedLead.stage !== finalStage) {
      console.warn('⚠️ Stage mismatch! Expected:', finalStage, 'Got:', updatedLead.stage);
      console.warn('⚠️ This might indicate the stage column is missing or the update failed');
      
      // Try one more time with just the stage
      console.log('🔄 Attempting stage-only correction update...');
      const stageOnlyUpdate = await updateLead(leadId, { stage: finalStage as any });
      if (stageOnlyUpdate) {
        if (stageOnlyUpdate.stage === finalStage) {
          console.log('✅ Stage corrected with stage-only update');
          return { 
            success: true, 
            message: `Stage updated to: ${finalStage}` 
          };
        } else {
          console.error('❌ Stage-only update did not match expected stage. Got:', stageOnlyUpdate.stage);
          // Check if the stage column might be missing
          if (stageOnlyUpdate.stage === updatedLead.stage) {
            console.error('❌ Stage unchanged after update - stage column may not exist in database!');
            return { 
              success: false, 
              message: 'Stage update failed - stage column may not exist in database. Please check your database schema.' 
            };
          }
        }
      } else {
        console.error('❌ Stage-only update returned null');
      }
    }
    
    // If outcome_code column doesn't exist, try to append to notes
    // Check if the outcome code was actually saved by checking if it's in the response
    if (!updatedLead.outcomeCode && outcomeCode) {
      const currentNotes = updatedLead.notes || '';
      const newNotes = currentNotes ? `${currentNotes}\n${outcomeNote}` : outcomeNote;
      await updateLead(leadId, { notes: newNotes });
      console.log('📝 Outcome code stored in notes as fallback');
    }
    
    // Trigger outcome code workflow (async, don't wait)
    import('./workflowEngine').then(({ triggerOutcomeCodeWorkflow }) => {
      triggerOutcomeCodeWorkflow(leadId, outcomeCode, assignedTo).catch(err => {
        console.error('Error triggering outcome code workflow:', err);
      });
    });

    console.log('✅ Lead updated successfully:', {
      leadId,
      newStage: updatedLead.stage,
      expectedStage: finalStage,
      stageMatch: updatedLead.stage === finalStage,
      outcomeCode: updatedLead.outcomeCode
    });

    // Auto-send email if configured
    if (action?.autoSendEmail && action.emailTemplate) {
      try {
        // Call Edge Function to send email
        const { data, error } = await supabase.functions.invoke('send-client-email', {
          body: {
            leadId,
            templateType: action.emailTemplate
          }
        });

        if (error) {
          console.error('Error sending auto-email:', error);
        } else {
          console.log('✅ Auto-email sent:', data);
        }
      } catch (err) {
        console.error('Error invoking email function:', err);
      }
    }

    // Auto-send SMS if configured
    if (action?.autoSendSMS && action.smsTemplate) {
      try {
        // TODO: Implement SMS sending via Edge Function or Twilio
        console.log(`📱 Auto-SMS would be sent to ${leadPhone} with template: ${action.smsTemplate}`);
        // For now, just log it
      } catch (err) {
        console.error('Error sending auto-SMS:', err);
      }
    }

    // Create follow-up task if configured
    if (action?.createFollowUpTask && action.followUpDelayHours && action.nextTaskTitle) {
      try {
        // Special case: If first call (Call-1) results in Voicemail or No Answer, schedule follow-up in 30 minutes
        let delayHours = action.followUpDelayHours;
        let taskTitle = action.nextTaskTitle;
        if (leadStage === 'Call-1' && (outcomeCode === 'Called - Voicemail' || outcomeCode === 'Called - No Answer')) {
          delayHours = 0.5; // 30 minutes for first call voicemail or no answer
          if (outcomeCode === 'Called - Voicemail') {
            taskTitle = 'Call 1 - Voicemail Follow-up (30 min)';
            console.log('📞 First call voicemail detected - scheduling follow-up in 30 minutes');
          } else if (outcomeCode === 'Called - No Answer') {
            taskTitle = 'Call 2 - Follow-up (30 min)';
            console.log('📞 First call no answer detected - scheduling follow-up in 30 minutes');
          }
        }
        
        const followUpDate = new Date();
        // Calculate delay in milliseconds (hours * 60 * 60 * 1000)
        followUpDate.setTime(followUpDate.getTime() + (delayHours * 60 * 60 * 1000));

        const task = await createTask({
          leadId,
          leadName,
          assignedTo,
          taskType: action.nextTaskType || 'Call',
          title: taskTitle,
          description: `Follow-up task for ${leadName} - Outcome: ${outcomeCode}${delayHours === 0.5 ? ' (30 min follow-up for first call)' : ''}`,
          dueDate: followUpDate.toISOString().split('T')[0],
          dueTime: followUpDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          priority: 'Medium',
          status: 'Pending'
        });

        if (task) {
          console.log('✅ Follow-up task created:', task.id);
          
          // Log activity
          await logActivity({
            activityType: 'task_created',
            entityType: 'task',
            entityId: task.id,
            leadId,
            leadName,
            actionDescription: `Follow-up task created: ${action.nextTaskTitle}`,
            doneByType: 'system',
            doneByName: 'System',
          });
        }
      } catch (err) {
        console.error('Error creating follow-up task:', err);
      }
    }

    // Log activity
    await logActivity({
      activityType: 'outcome_code_set',
      entityType: 'lead',
      entityId: leadId,
      leadId,
      leadName,
      actionDescription: `Outcome code selected: ${outcomeCode}${customReason ? ` - ${customReason}` : ''}`,
      doneByType: 'user',
      doneById: assignedTo,
      doneByName: 'Agent',
      metadata: {
        outcomeCode,
        customReason,
        stage: finalStage, // Store the stage for contact attempt counting
        previousStage: leadStage || 'New',
        autoActions: {
          emailSent: action?.autoSendEmail || false,
          smsSent: action?.autoSendSMS || false,
          followUpTaskCreated: action?.createFollowUpTask || false
        }
      }
    });

    // Build message with only implemented features (stage update and task scheduling)
    const messageParts: string[] = []
    
    // Special message for Call-5 cancellation due to repeated failed attempts
    if (leadStage === 'Call-5' && 
        ['Called - No Answer', 'Called - Voicemail', 'Called - Busy'].includes(outcomeCode) &&
        finalStage === 'Cancelled') {
      messageParts.push(`Lead moved to Cancelled stage (Call attempts exceeded - maximum 5 attempts reached)`)
    } else if (finalStage) {
      messageParts.push(`Stage updated to: ${finalStage}`)
    }
    
    if (action?.createFollowUpTask) {
      messageParts.push('Follow-up task scheduled')
    }
    
    const message = messageParts.length > 0 
      ? `Outcome code processed. ${messageParts.join('. ')}.`
      : 'Outcome code processed successfully.'
    
    return { 
      success: true, 
      message
    };
  } catch (error) {
    console.error('Error processing outcome code:', error);
    return { success: false, message: 'Failed to process outcome code' };
  }
}

/**
 * Get next stage based on current stage and outcome
 */
export function getNextStage(currentStage: string, outcomeCode: string): string {
  // Direct stage transitions (these take priority)
  const directTransitions: { [key: string]: string } = {
    'Ready to Solicit': 'Ready to Solicit',
    'Awaiting Payment': 'Quote Accepted - Awaiting Payment',
    'Awaiting Client Info': 'Payment Completed - Awaiting Client Information',
    'Payment Completed - Awaiting Client Information': 'Payment Completed - Awaiting Client Information',
    'Quote Accepted - Awaiting Payment': 'Quote Accepted - Awaiting Payment',
    'Sold!': 'Instructed',
    'Not Interested': 'Cancelled',
    'Gone Elsewhere': 'Cancelled',
    'Wrong Number': 'Cancelled',
    'Number Invalid': 'Cancelled',
    'Incorrect Number': 'Cancelled',
    'Fake/Duplicate Quote': 'Cancelled',
    'Fake Lead': 'Cancelled',
    'Duplicate Lead': 'Cancelled',
    'Test Lead': 'Cancelled',
    'Getting prices': 'Cancelled',
    'Just Getting prices': 'Cancelled', // Also handle "Just Getting prices"
    'Custom Reason': 'Cancelled'
  };

  // Check for direct transitions first
  if (directTransitions[outcomeCode]) {
    return directTransitions[outcomeCode];
  }

  // Stage progression based on current stage and outcome code
  const stageProgression: { [key: string]: { [key: string]: string } } = {
    'New': {
      'Called - No Answer': 'Call-1',
      'Called - Voicemail': 'Call-1',
      'Called - Busy': 'Call-1',
      'Callback Scheduled': 'Call-1',
      'Interested - Call Back': 'Interested'
    },
    'Call-1': {
      'Called - No Answer': 'Call-2',
      'Called - Voicemail': 'Call-2',
      'Called - Busy': 'Call-2',
      'Callback Scheduled': 'Call-2',
      'Interested - Call Back': 'Interested',
      'Interested - Reviewing': 'Interested'
    },
    'Call-2': {
      'Called - No Answer': 'Call-3',
      'Called - Voicemail': 'Call-3',
      'Called - Busy': 'Call-3',
      'Callback Scheduled': 'Call-3',
      'Interested - Call Back': 'Interested',
      'Interested - Reviewing': 'Interested'
    },
    'Call-3': {
      'Called - No Answer': 'Call-4',
      'Called - Voicemail': 'Call-4',
      'Called - Busy': 'Call-4',
      'Callback Scheduled': 'Call-4',
      'Interested - Call Back': 'Interested',
      'Interested - Reviewing': 'Interested'
    },
    'Call-4': {
      'Called - No Answer': 'Call-5',
      'Called - Voicemail': 'Call-5',
      'Called - Busy': 'Call-5',
      'Callback Scheduled': 'Call-5',
      'Interested - Call Back': 'Interested',
      'Interested - Reviewing': 'Interested'
    },
    'Call-5': {
      'Interested - Call Back': 'Interested',
      'Interested - Reviewing': 'Interested',
      'Called - No Answer': 'Cancelled', // Cancel if same outcome after Call-5
      'Called - Voicemail': 'Cancelled', // Cancel if same outcome after Call-5
      'Called - Busy': 'Cancelled', // Cancel if same outcome after Call-5
      'Recalled': 'Call-5' // Stay at Call-5 if recalled
    },
    'Interested': {
      'Ready to Solicit': 'Ready to Solicit',
      'Sold!': 'Instructed',
      'Interested - Call Back': 'Interested', // Stay at Interested
      'Interested - Reviewing': 'Interested' // Stay at Interested
    },
    'Ready to Solicit': {
      'Awaiting Payment': 'Quote Accepted - Awaiting Payment',
      'Awaiting Client Info': 'Payment Completed - Awaiting Client Information',
      'Sold!': 'Instructed'
    },
    'Quote Accepted - Awaiting Payment': {
      'Sold!': 'Instructed',
      'Awaiting Client Info': 'Payment Completed - Awaiting Client Information'
    },
    'Payment Completed - Awaiting Client Information': {
      'Ready to Solicit': 'Ready to Solicit',
      'Awaiting Payment': 'Quote Accepted - Awaiting Payment',
      'Sold!': 'Instructed'
    }
  };

  // Get the next stage for current stage and outcome code
  const nextStage = stageProgression[currentStage]?.[outcomeCode];
  
  // If no progression found, return current stage (don't change it)
  return nextStage || currentStage;
}
