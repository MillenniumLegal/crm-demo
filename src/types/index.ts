// User Types
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Agent';
  createdAt: string;
  updatedAt: string;
}

// Lead Types
export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  quoteId?: string;
  quoteAmount?: number; // Calculated from quote
  assignedTo?: string;
  assignedToName?: string; // Joined from users table
  status: 'New' | 'Assigned' | 'Contacted' | 'Interested' | 'Quote Sent' | 'Sold' | 'Closed' | 'Archived';
  stage:
    | 'New'
    | 'Call-1'
    | 'Call-2'
    | 'Call-3'
    | 'Call-4'
    | 'Call-5'
    | 'Interested'
    | 'Ready to Solicit'
    | 'Quote Accepted - Awaiting Payment'
    | 'Payment Completed - Awaiting Client Information'
    | 'Instructed'
    | 'Cancelled';
  outcomeCode?: string;
  transactionType?: 'Purchase' | 'Sale' | 'Sale & Purchase' | 'Purchase and Sale' | 'Remortgage' | 'Remortgage Cashback' | 'Transfer of Equity' | 'Equity Release';
  instructedFirm?: string; // Solicitor firm ID
  customOutcomeReason?: string; // For "Gone Elsewhere" or custom reasons
  createdAt: string;
  updatedAt: string;
  lastActionAt?: string;
  isFunnelArchived?: boolean;
  funnelArchivedAt?: string;
  funnelArchivedBy?: string;
  funnelArchivedReason?: string;
  funnelArchivedAuto?: boolean;
  notes?: string;
  contactAttempts: number;
  maxAttempts: number;
  priority: 'High' | 'Medium' | 'Low';
  
  // Hoowla-specific fields
  externalId?: string;
  hoowlaQuoteId?: string;
  propertyAddress?: string;
  propertyValue?: number;
  propertyTenure?: string;
  propertyTitleNumber?: string;
  propertyRegion?: string;
  clientAddress?: string;
  clientDob?: string;
  clientNi?: string;
  clientSource?: string;
  isMortgaged?: boolean;
  isUnregistered?: boolean;
  isFirstTimeBuyer?: boolean;
  isNewBuild?: boolean;
  isSharedOwnership?: boolean;
  isBuyToLet?: boolean;
  customSituations?: string[];
  
  // Quote-related fields for lead creation/editing
  legalFees?: string;
  sdtlVersion?: string;
  numberOfPeople?: string;
  quoteStatus?: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired'; // Quote status from quotes table
  
  // Instruction form and PDF fields
  instructionPdfUrl?: string;
  instructionFormStatus?: string;
  customMessage?: string;
  quoteSupplements?: Array<{ id: string; name: string; amount: number }>;
  quoteDisbursements?: Array<{ id: string; name: string; amount: number }>;
  whereThingsUpTo?: string;
  whereThingsUpToSale?: string;

  // Comparison/ad attribution fields
  comparisonLeadId?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gadSource?: string;
  gadCampaignId?: string;
  gclid?: string;
  msclkid?: string;
  gbraid?: string;
  wbraid?: string;
  landingPage?: string;
  referrer?: string;
  attributionCapturedAt?: string;
  rawAttributionJson?: Record<string, unknown>;

  // Manual instruction tracking fields
  isManuallyInstructed?: boolean;
  manualInstructionStatus?: string;
  manualInstructedAt?: string;
  manualInstructedBy?: string;
  manualInstructedByName?: string;
  instructionCreditUserId?: string;
  instructionCreditUserName?: string;
  assignedToAtInstruction?: string;
  assignedToNameAtInstruction?: string;
  instructionMarkSource?: string;
  instructionMarkNotes?: string;
  
  // Computed fields for UI
  ageInHours?: number;
  isOverdue?: boolean;
  
  // Quote-to-instruction workflow fields
  shortCode?: string;
  paymentLinkUrl?: string;
  paymentIntentId?: string;
  instructionFormToken?: string;
  instructionFormLink?: string;
  instructionFormSubmittedAt?: string;
  instructionPdfGeneratedAt?: string;
  lastQuoteAcceptUrl?: string;

  // Callback request lifecycle (comparison-site callbacks)
  callbackStatus?: 'requested' | 'contacted' | 'completed' | 'cancelled' | string;
  callbackRequested?: boolean;
  callbackRequestedAt?: string;
  callbackContactedAt?: string;
  callbackCompletedAt?: string;
  callbackAssignedTo?: string;
  callbackFirmName?: string;
  callbackResolution?: string;

  // Quote-accepted milestone (distinct from instruction / payment / conversion)
  quoteAcceptedAt?: string;
  acceptedQuoteId?: string;

  // Instruction request (comparison-site "Instruct This Solicitor") — a request/intent
  // signal, DISTINCT from the formal "Instructed" milestone (isManuallyInstructed)
  instructionRequestStatus?: 'requested' | 'contacted' | 'completed' | 'cancelled' | string;
  instructionRequested?: boolean;
  instructionRequestedAt?: string;
  instructionRequestContactedAt?: string;
  instructionRequestCompletedAt?: string;
  instructionRequestAssignedTo?: string;
  instructionRequestFirmName?: string;
  instructionRequestResolution?: string;
}

// 3CX / APCM AI Call Intelligence
export interface CrmCallRecord {
  id: string;
  threecxCallId: string;
  leadId?: string;
  direction?: string;
  callerNumber?: string;
  calledNumber?: string;
  agentExtension?: string;
  agentUserId?: string;
  agentName?: string;
  queueName?: string;
  startedAt?: string;
  answeredAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  callStatus?: string;
  transcript?: string;
  transcriptAvailable: boolean;
  cdrSummary?: string;
  cdrCallType?: string;
  recordingReference?: string;
  matchStatus: 'matched' | 'unmatched' | 'ambiguous';
  matchConfidence: number;
  matchReason?: string;
  aiAnalysisStatus: 'not_analyzed' | 'analyzing' | 'completed' | 'failed';
  latestAiAnalysisId?: string;
  reviewStatus?: 'pending_review' | 'reviewed' | 'ignored';
  reviewNote?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  manualLinkedAt?: string;
  manualLinkedByName?: string;
  manualLinkReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmCallAiAnalysis {
  id: string;
  callRecordId: string;
  leadId?: string;
  analysisStatus: 'completed' | 'failed';
  summary?: string;
  callType?: string;
  outcome?: string;
  clientPosition?: string;
  objections: string[];
  tags: string[];
  knockBackReason?: string;
  rejectionReason?: string;
  positiveSignals: string[];
  uspMentioned?: boolean;
  priceConcern?: boolean;
  instructionIntent?: boolean;
  followUpRequired?: boolean;
  followUpReason?: string;
  recommendedAction?: string;
  agentNotes?: string;
  managerRiskFlags: string[];
  confidence?: number;
  voicemailDetected?: boolean;
  meaningfulConversation?: boolean;
  objectionCategory?: string;
  confidenceReason?: string;
  promptVersion?: string;
  model?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
}

// Quote Types
export interface Quote {
  id: string;
  shortCode?: string;
  leadId: string;
  amount: number;
  details: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  createdAt: string;
  lastEditedAt: string;
  version: number;
}

// Attempt Types
export interface Attempt {
  id: string;
  leadId: string;
  attemptType: 'call' | 'sms' | 'email';
  status: 'scheduled' | 'completed' | 'failed' | 'no_answer';
  timestamp: string;
  notes?: string;
  userId: string;
  outcomeCode?: string;
}

// Invoice Types
export interface Invoice {
  id: string;
  leadId: string;
  stripePaymentId?: string;
  amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  issuedAt: string;
  paidAt?: string;
  dueDate: string;
}

// Log Types
export interface Log {
  id: string;
  userId: string;
  action: string;
  targetType: 'lead' | 'quote' | 'attempt' | 'invoice' | 'user';
  targetId: string;
  timestamp: string;
  details?: string;
}

// Outcome Code Types
export interface OutcomeCode {
  id: string;
  code: string;
  name: string;
  description: string;
  nextAction: 'sms' | 'email' | 'call' | 'schedule' | 'delete' | 'archive';
  autoSchedule?: boolean;
  scheduleDelay?: number; // hours
  isActive: boolean;
}

// Dashboard Stats
export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  activeLeads: number;
  closedLeads: number;
  conversionRate: number;
  totalSales: number;
  assignedLeads: number;
  unassignedLeads: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthUser extends User {
  token: string;
}

// Filter Types
export interface LeadFilters {
  dateRange?: {
    start: string;
    end: string;
  };
  source?: string;
  assignedTo?: string;
  status?: string;
  outcomeCode?: string;
}

// Assignment Types
export interface AssignmentRule {
  id: string;
  name: string;
  conditions: {
    source?: string;
    status?: string;
    dateRange?: {
      start: string;
      end: string;
    };
  };
  assignTo: string;
  isActive: boolean;
}

// Task Types
export interface DiaryTask {
  id: string;
  leadId: string;
  leadName: string;
  assignedTo?: string;
  taskType: 'Call' | 'SMS' | 'Email' | 'Follow-up' | 'Quote' | 'Payment';
  title: string;
  description?: string;
  dueDate: string;
  dueTime?: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed' | 'Cancelled';
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  leadStatus?: string;
  leadStage?: string;
}
