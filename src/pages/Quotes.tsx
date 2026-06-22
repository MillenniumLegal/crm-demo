import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Search, Plus, Eye, Edit, Download, Send, FileText, Save, History, Trash2, X, Loader2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Split, Settings } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchQuotes, fetchQuotesPage, updateQuote, ensureQuoteAcceptanceToken, Quote } from '@/services/quotesService';
import { fetchQuoteFeeConfig } from '@/services/feeConfigService';
import { applyFeeConfig } from '@/utils/feeCalculationEngine';
import { buildQuotePdf } from '@/utils/quotePdf';
import { generateQuoteEmailHTML, generateQuoteEmailText } from '@/utils/quoteEmailTemplate';
import { fetchLeadById, fetchLeadsPage, createLead } from '@/services/leadsService';
import { Lead } from '@/types';
import { sendOutlookEmail } from '@/services/outlookService';
import { StackedDistributionBar } from '@/components/analytics/StackedDistributionBar';

// Quote interface is now imported from quotesService

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

// Helper function - must be defined outside component to be used in useMemo
const parseDateValue = (value?: string | null) => (value ? new Date(value).getTime() : 0);

const normalizeQuoteLeadSearch = (value: string) =>
  value
    .replace(/[,%()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const leadMatchesSearch = (lead: Lead, rawTerm: string) => {
  const term = normalizeQuoteLeadSearch(rawTerm);
  if (!term) return true;

  const compactTerm = term.replace(/\s+/g, '');
  const digits = term.replace(/\D/g, '');
  const haystack = [
    lead.name,
    lead.email,
    lead.phone,
    lead.shortCode,
    lead.assignedToName,
  ].filter(Boolean).join(' ').toLowerCase();
  const compactHaystack = haystack.replace(/\s+/g, '');
  const phoneDigits = (lead.phone || '').replace(/\D/g, '');

  if (haystack.includes(term) || compactHaystack.includes(compactTerm)) return true;
  if (digits.length >= 4 && phoneDigits.includes(digits.slice(-7))) return true;

  const tokens = term.split(' ').filter(Boolean);
  return tokens.length > 1 && tokens.every(token => haystack.includes(token));
};

export const Quotes: React.FC = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuotes, setHistoryQuotes] = useState<Quote[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [totalQuotesCount, setTotalQuotesCount] = useState(0);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterTransactionType, setFilterTransactionType] = useState('All');
  const [filterRange, setFilterRange] = useState<'all' | '7' | '30' | '90'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const quotesPerPage = 8;
  const quotesRequestRef = useRef(0);
  
  // Store the originating leadId from URL params (for navigation back after save)
  const [originatingLeadId, setOriginatingLeadId] = useState<string | null>(null);

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error'>('success');
  const [isSaving, setIsSaving] = useState(false);
  const [feeConfig, setFeeConfig] = useState<Awaited<ReturnType<typeof fetchQuoteFeeConfig>> | null>(null);
  const [downloadingQuoteId, setDownloadingQuoteId] = useState<string | null>(null);
  const [isGeneratingQuoteAttachment, setIsGeneratingQuoteAttachment] = useState(false);
  const [quoteAttachment, setQuoteAttachment] = useState<{
    fileName: string;
    contentType: string;
    contentBytes: string;
  } | null>(null);
  const [sendEmailData, setSendEmailData] = useState({
    email: '',
    subject: '',
    message: ''
  });
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Pipeline-wide quotes (ALL quotes, unpaginated) for the "Pipeline totals" KPI card.
  // Additive: separate from the paginated `quotes` state used by the table + on-page strip.
  const [allQuotes, setAllQuotes] = useState<Quote[]>([]);
  const [isLoadingAllQuotes, setIsLoadingAllQuotes] = useState(true);

  const historyRecords = useMemo(() => {
    if (!editingQuote) return [] as Quote[];
    const sourceQuotes = historyQuotes.length > 0 ? historyQuotes : quotes;
    
    // Get all quotes for the same lead (since quotes are now matched by email/lead)
    // This ensures we show all versions regardless of shortCode or quoteType
    const related = sourceQuotes.filter((quote) => {
      // Primary match: same leadId
      if (quote.leadId && editingQuote.leadId && quote.leadId === editingQuote.leadId) {
        return true;
      }
      
      // Fallback: if shortCode exists and matches, include it
      if (editingQuote.shortCode && quote.shortCode === editingQuote.shortCode) {
        return true;
      }
      
      // Additional fallback: same leadId + quoteType (for backward compatibility)
      if (editingQuote.leadId && quote.leadId === editingQuote.leadId && 
          editingQuote.quoteType && quote.quoteType === editingQuote.quoteType) {
        return true;
      }
      
      return false;
    });
    
    // Sort by version (descending) first, then by date (newest first) if versions are equal
    const sorted = [...related].sort((a, b) => {
      // First sort by version (higher version first)
      const versionA = a.version || 1;
      const versionB = b.version || 1;
      if (versionA !== versionB) {
        return versionB - versionA;
      }
      // If versions are equal, sort by date (newest first)
      return parseDateValue(b.updatedAt || b.createdAt) - parseDateValue(a.updatedAt || a.createdAt);
    });
    
    // Return all versions (removed the 5 version limit to show complete history)
    return sorted;
  }, [editingQuote, historyQuotes, quotes]);

  const handleHistoryClose = useCallback(() => {
    setShowHistory(false);
  }, [setShowHistory]);

  const handleOpenHistory = useCallback(async () => {
    if (!editingQuote?.leadId) {
      setHistoryQuotes([]);
      setShowHistory(true);
      return;
    }

    setIsLoadingHistory(true);
    setShowHistory(true);
    try {
      const relatedQuotes = await fetchQuotes({ leadId: editingQuote.leadId });
      setHistoryQuotes(relatedQuotes);
    } catch (error) {
      console.error('Error loading quote history:', error);
      setHistoryQuotes([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [editingQuote?.leadId]);

  const handleHistorySelect = useCallback((record: Quote) => {
    const recalculated = recalcTotals({ ...record });
    setEditingQuote(recalculated);
    setSelectedQuote(recalculated);
    setIsEditing(true);
    setShowHistory(false);
  }, [setEditingQuote, setSelectedQuote, setIsEditing, setShowHistory]);

  const [leadOptions, setLeadOptions] = useState<Lead[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
  const [leadSelectionMode, setLeadSelectionMode] = useState<'existing' | 'new'>('existing');
  const [newLeadData, setNewLeadData] = useState({ name: '', email: '', phone: '' });

  const isNewQuote = selectedQuote?.id === 'NEW';
const editingItems = editingQuote?.items ?? [];
const editingSupplements = editingQuote?.supplements ?? [];
const editingDisbursements = editingQuote?.disbursements ?? [];
const selectedSupplements = selectedQuote?.supplements ?? [];
const selectedDisbursements = selectedQuote?.disbursements ?? [];
const selectedItemsForView = selectedQuote?.items ?? [];
const hasStructuredFeeData =
  selectedSupplements.length > 0 ||
  selectedDisbursements.length > 0 ||
  selectedQuote?.legalFeeExVat !== undefined ||
  selectedQuote?.legalFeeIncVat !== undefined;
const shouldShowItemListFallback =
  selectedItemsForView.length > 0 && !hasStructuredFeeData;
const editingNetAmount =
  editingQuote?.netAmount ??
  (editingQuote?.totalExVat ?? editingItems.reduce((sum, item) => sum + (item.total || 0), 0));
const editingTotalAmount =
  editingQuote?.totalIncVat ??
  editingQuote?.totalAmount ??
  (editingQuote?.totalExVat !== undefined ? editingQuote.totalExVat + (editingQuote.vatAmount ?? 0) : editingNetAmount);
const editingVatAmount =
  editingQuote?.vatAmount ??
  Math.max((editingTotalAmount ?? 0) - (editingNetAmount ?? 0), 0);

const VAT_RATE = 0.2;

const toNumberOrUndefined = (value: any): number | undefined => {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isNaN(numeric) ? undefined : numeric;
};

const sumMonetaryList = (list: any[] | undefined): number => {
  if (!list || list.length === 0) return 0;
  return list.reduce((total, entry) => {
    // Handle both fee and amount fields, and ensure null/undefined become 0
    const feeValue = entry?.fee ?? entry?.amount;
    const fee = toNumberOrUndefined(feeValue);
    // If fee is null/undefined/NaN, treat as 0 to prevent calculation errors
    return total + (fee ?? 0);
  }, 0);
};

const roundCurrency = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const recalcTotals = (quote: Quote, options?: { updateIdAml?: boolean }): Quote => {
  // Always recalculate from scratch - ignore any existing calculated values
  // Use only the base legal fee inputs (Ex VAT or Inc VAT)
  const legalFeeExInput = toNumberOrUndefined(quote.legalFeeExVat);
  const legalFeeIncInput = toNumberOrUndefined(quote.legalFeeIncVat);

  // Derive legal fee Ex VAT from inputs
  const derivedLegalEx =
    legalFeeExInput !== undefined
      ? legalFeeExInput
      : legalFeeIncInput !== undefined
      ? legalFeeIncInput / (1 + VAT_RATE)
      : 0;

  // Calculate legal fees with proper rounding
  const legalExAmount = roundCurrency(derivedLegalEx);
  const legalIncAmount = roundCurrency(legalExAmount * (1 + VAT_RATE));

  // Calculate ID/AML fees based on peopleCount
  // ID Check: £25 per person, AML Check: £25 per person = £50 per person total
  const peopleCount = quote.peopleCount || 1;
  const ID_FEE_PER_PERSON = 25;
  const AML_FEE_PER_PERSON = 25;

  // Only update ID/AML if explicitly requested (e.g., when peopleCount changes)
  // Otherwise, preserve existing supplements to avoid price changes when entering edit mode
  let updatedSupplements = quote.supplements || [];
  
  // Only update ID/AML if explicitly requested
  if (options?.updateIdAml === true) {
    // Check if ID/AML entries already exist and match expected values
    const existingIdAml = (quote.supplements || []).filter((s: any) => {
      if (!s.name) return false;
      const nameLower = s.name.toLowerCase();
      return nameLower.includes('id check') || nameLower.includes('aml check');
    });

    const expectedIdFee = roundCurrency(peopleCount * ID_FEE_PER_PERSON);
    const expectedAmlFee = roundCurrency(peopleCount * AML_FEE_PER_PERSON);
    
    // Check if existing ID/AML entries match expected values
    const hasIdCheck = existingIdAml.some((s: any) => {
      const nameLower = s.name.toLowerCase();
      return nameLower.includes('id check') && Math.abs((s.fee || 0) - expectedIdFee) < 0.01;
    });
    const hasAmlCheck = existingIdAml.some((s: any) => {
      const nameLower = s.name.toLowerCase();
      return nameLower.includes('aml check') && Math.abs((s.fee || 0) - expectedAmlFee) < 0.01;
    });

    // Only update ID/AML if they don't exist, don't match expected values, or there are duplicates
    if (!hasIdCheck || !hasAmlCheck || existingIdAml.length > 2) {
      // Remove existing ID/AML entries (including duplicates and variations)
      const supplementsWithoutIdAml = (quote.supplements || []).filter(
        (s: any) => {
          if (!s.name) return true;
          const nameLower = s.name.toLowerCase();
          // Keep supplements that are NOT ID Check, AML Check, or any ID+AML/ID/AML variations
          return !nameLower.includes('id check') && 
                 !nameLower.includes('aml check') &&
                 !nameLower.includes('id+aml') &&
                 !nameLower.includes('id/aml') &&
                 !nameLower.includes('id & aml') &&
                 nameLower !== 'id+aml' &&
                 nameLower !== 'id/aml';
        }
      );
      
      // Also remove ID/AML from disbursements if they exist there
      const disbursementsWithoutIdAml = (quote.disbursements || []).filter(
        (d: any) => {
          if (!d.name) return true;
          const nameLower = d.name.toLowerCase();
          return !nameLower.includes('id check') && 
                 !nameLower.includes('aml check') &&
                 !nameLower.includes('id+aml') &&
                 !nameLower.includes('id/aml') &&
                 !nameLower.includes('id & aml') &&
                 nameLower !== 'id+aml' &&
                 nameLower !== 'id/aml';
        }
      );

      // Add ID and AML fees as separate supplements
      const idAmlSupplements = [];
      if (peopleCount > 0) {
        idAmlSupplements.push(
          { name: 'ID Check', fee: expectedIdFee },
          { name: 'AML Check', fee: expectedAmlFee }
        );
      }

      updatedSupplements = [...supplementsWithoutIdAml, ...idAmlSupplements];
      // Update quote with cleaned disbursements
      quote = { ...quote, disbursements: disbursementsWithoutIdAml };
    }
  }

  // Always clean ID/AML from disbursements (they should only be in supplements)
  const cleanedDisbursements = (quote.disbursements || []).filter(
    (d: any) => {
      if (!d.name) return true;
      const nameLower = d.name.toLowerCase();
      return !nameLower.includes('id check') && 
             !nameLower.includes('aml check') &&
             !nameLower.includes('id+aml') &&
             !nameLower.includes('id/aml') &&
             !nameLower.includes('id & aml') &&
             nameLower !== 'id+aml' &&
             nameLower !== 'id/aml';
    }
  );

  // Calculate totals from supplements and disbursements
  // Ensure all values are properly converted to numbers and null/undefined become 0
  const supplementTotal = roundCurrency(sumMonetaryList(updatedSupplements));
  const disbursementTotal = roundCurrency(sumMonetaryList(cleanedDisbursements));

  // Calculate VAT base (legal fee + supplements only - disbursements are VAT-free)
  const vatBase = roundCurrency(legalExAmount + supplementTotal);
  const vatAmount = roundCurrency(vatBase * VAT_RATE);

  // Calculate totals: Ex VAT = legal + supplements + disbursements (disbursements are VAT-free)
  const totalExVat = roundCurrency(legalExAmount + supplementTotal + disbursementTotal);
  // Total Inc VAT = Ex VAT + VAT
  const totalIncVat = roundCurrency(totalExVat + vatAmount);

  return {
    ...quote,
    supplements: updatedSupplements,
    disbursements: cleanedDisbursements,
    legalFeeExVat: legalExAmount,
    legalFeeIncVat: legalIncAmount,
    netAmount: totalExVat,
    totalExVat,
    vatAmount,
    totalIncVat,
    totalAmount: totalIncVat
  };
};

  const buildBaseQuote = (overrides?: Partial<Quote>): Quote => {
    const now = new Date();
    const defaultValidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nowIso = now.toISOString();
    const base: Quote = {
      id: 'NEW',
      shortCode: undefined,
      leadId: overrides?.leadId || '',
      leadName: overrides?.leadName || '',
      leadEmail: overrides?.leadEmail || '',
      leadPhone: overrides?.leadPhone || '',
      version: 1,
      status: overrides?.status || 'Draft',
      totalAmount: overrides?.totalAmount || 0,
      vatAmount: overrides?.vatAmount || 0,
      netAmount: overrides?.netAmount || 0,
      totalExVat: overrides?.totalExVat,
      totalIncVat: overrides?.totalIncVat,
      legalFeeExVat: overrides?.legalFeeExVat,
      legalFeeIncVat: overrides?.legalFeeIncVat,
      validUntil: overrides?.validUntil || defaultValidUntil.toISOString(),
      createdAt: overrides?.createdAt || nowIso,
      updatedAt: overrides?.updatedAt || nowIso,
      sentAt: overrides?.sentAt,
      acceptedAt: overrides?.acceptedAt,
      rejectedAt: overrides?.rejectedAt,
      items: overrides?.items || [],
      supplements: overrides?.supplements || [],
      disbursements: overrides?.disbursements || [],
      notes: overrides?.notes || '',
      terms: overrides?.terms || '',
      hoowlaQuoteId: overrides?.hoowlaQuoteId,
      externalId: overrides?.externalId,
      quoteType: overrides?.quoteType,
      propertyAddress: overrides?.propertyAddress,
      propertyValue: overrides?.propertyValue,
      propertyTenure: overrides?.propertyTenure,
      propertyTitleNumber: overrides?.propertyTitleNumber,
      propertyCity: overrides?.propertyCity,
      propertyCounty: overrides?.propertyCounty,
      propertyPostcode: overrides?.propertyPostcode,
      propertyRegion: overrides?.propertyRegion,
      peopleCount: overrides?.peopleCount || 1,
      expiryDate: overrides?.expiryDate,
      customSituations: overrides?.customSituations || []
    };

    return recalcTotals(base);
  };

  const showNotificationMessage = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setNotificationMessage(message);
    setNotificationType(type);
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  }, []);

const formatCurrency = (value?: number | string | null) => {
  if (value === undefined || value === null) return '£0.00';
  const numeric = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(numeric)) return '£0.00';
  return `£${numeric.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

  const getQuoteDateRange = useCallback(() => {
    if (filterRange === 'all') {
      return {};
    }

    const days = Number(filterRange);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    return {
      dateFrom: start.toISOString(),
    };
  }, [filterRange]);

  const loadQuotesPage = useCallback(async (page = currentPage) => {
    const requestId = ++quotesRequestRef.current;
    setIsLoading(true);
    setQuotesError(null);
    try {
      const result = await fetchQuotesPage({
        page,
        pageSize: quotesPerPage,
        search: debouncedSearchTerm || undefined,
        status: filterStatus !== 'All' ? filterStatus : undefined,
        transactionType: filterTransactionType !== 'All' ? filterTransactionType : undefined,
        sortBy: 'created_at',
        sortDirection: 'desc',
        ...getQuoteDateRange(),
      });

      if (requestId !== quotesRequestRef.current) {
        return;
      }

      setQuotes(result.quotes);
      setTotalQuotesCount(result.totalCount);
      setCurrentPage(result.page);
    } catch (err: any) {
      if (requestId !== quotesRequestRef.current) {
        return;
      }
      console.error('Error loading quotes page:', err);
      const msg = err?.message || 'Failed to load quotes. Please try again.';
      setQuotesError(msg);
      setQuotes([]);
      setTotalQuotesCount(0);
      showNotificationMessage(msg, 'error');
    } finally {
      if (requestId === quotesRequestRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPage, debouncedSearchTerm, filterStatus, filterTransactionType, getQuoteDateRange, quotesPerPage, showNotificationMessage]);

  const loadLeadOptions = useCallback(async () => {
    try {
      setIsLoadingLeads(true);
      const result = await fetchLeadsPage(
        { searchTerm: leadSearchTerm.trim() || undefined },
        { limit: 50, offset: 0, activeOnly: false }
      );
      setLeadOptions(result.leads);
    } catch (error) {
      console.error('Error loading leads:', error);
      showNotificationMessage('Failed to load leads. Please try again.', 'error');
    } finally {
      setIsLoadingLeads(false);
    }
  }, [leadSearchTerm, showNotificationMessage]);

  const filteredLeadOptions = useMemo(() => {
    if (!leadSearchTerm.trim()) {
      return (leadOptions || []).slice(0, 50);
    }
    return (leadOptions || [])
      .filter((lead) => leadMatchesSearch(lead, leadSearchTerm))
      .slice(0, 50);
  }, [leadOptions, leadSearchTerm]);

  const selectedLeadOption = useMemo(() => {
    if (!editingQuote?.leadId) return undefined;
    return leadOptions.find((lead) => lead.id === editingQuote.leadId);
  }, [editingQuote?.leadId, leadOptions]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim());
      setCurrentPage(1);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    loadQuotesPage(currentPage);
  }, [loadQuotesPage, currentPage]);

  // Additive: fetch ALL quotes once (unpaginated) to power the pipeline-wide KPI card.
  // fetchQuotes() with no filters is the legacy full-fetch (returns every quote).
  useEffect(() => {
    let cancelled = false;
    setIsLoadingAllQuotes(true);
    fetchQuotes()
      .then((all) => {
        if (!cancelled) setAllQuotes(all);
      })
      .catch((err) => {
        console.error('Error loading pipeline-wide quotes:', err);
        if (!cancelled) setAllQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingAllQuotes(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Additive: pipeline-wide KPIs across ALL quotes (not just the visible page).
  const pipelineTotals = useMemo(() => {
    const quoteValue = (q: Quote) => q.totalIncVat ?? q.totalAmount ?? 0;
    const total = allQuotes.length;
    const totalQuotedValue = allQuotes.reduce((sum, q) => sum + quoteValue(q), 0);
    const acceptedQuotes = allQuotes.filter((q) => q.status === 'Accepted');
    const sentQuotes = allQuotes.filter((q) => q.status === 'Sent');
    const acceptedValue = acceptedQuotes.reduce((sum, q) => sum + quoteValue(q), 0);
    // True acceptance rate = Accepted / (Sent + Accepted); guard divide-by-zero.
    const decisionBase = sentQuotes.length + acceptedQuotes.length;
    const acceptanceRate = decisionBase > 0 ? (acceptedQuotes.length / decisionBase) * 100 : 0;
    const averageQuoteValue = total > 0 ? totalQuotedValue / total : 0;
    return {
      total,
      totalQuotedValue,
      acceptedValue,
      acceptedCount: acceptedQuotes.length,
      decisionBase,
      acceptanceRate,
      averageQuoteValue,
    };
  }, [allQuotes]);

  useEffect(() => {
    if (showEditor && isNewQuote && leadSelectionMode === 'existing' && leadOptions.length === 0 && !isLoadingLeads) {
      loadLeadOptions();
    }
  }, [showEditor, isNewQuote, leadSelectionMode, leadOptions.length, isLoadingLeads, loadLeadOptions]);

  useEffect(() => {
    if (!showEditor || !isNewQuote || leadSelectionMode !== 'existing') return;
    const timeout = window.setTimeout(() => {
      loadLeadOptions();
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [showEditor, isNewQuote, leadSelectionMode, leadSearchTerm, loadLeadOptions]);

  // Load fee config when quote editor is open (for Hoowla-style auto-calculation)
  useEffect(() => {
    if (showEditor && isEditing) {
      fetchQuoteFeeConfig()
        .then(setFeeConfig)
        .catch((err: any) => {
          setFeeConfig(null);
          const msg = err?.message || 'Failed to load fee configuration. Auto-calculation may be unavailable.';
          showNotificationMessage(msg, 'error');
        });
    } else {
      setFeeConfig(null);
    }
  }, [showEditor, isEditing, showNotificationMessage]);

  // Handle create action via URL parameters
  useEffect(() => {
    const action = searchParams.get('action');
    const leadId = searchParams.get('leadId');
    const quoteId = searchParams.get('quoteId');
    const quoteShort = searchParams.get('quoteShort');
    
    // If leadId is provided in URL (e.g., when navigating from lead detail), store it for navigation back
    if (leadId && !originatingLeadId) {
      setOriginatingLeadId(leadId);
    }
    
    if (action === 'create') {
      const prepareNewQuote = async () => {
        try {
          const lead = leadId ? await fetchLeadById(leadId) : null;
          if (!lead && !leadId) {
            console.warn('Create quote action requires a lead');
            return;
          }

          // Store the leadId for navigation back after save
          if (leadId) {
            setOriginatingLeadId(leadId);
          }

          const baseQuote = buildBaseQuote({
            leadId: lead?.id || leadId || '',
            leadName: lead?.name || '',
            leadEmail: lead?.email || '',
            leadPhone: lead?.phone || '',
            peopleCount: lead?.numberOfPeople ? parseInt(lead.numberOfPeople) : 1
          });

          setSelectedQuote(baseQuote);
          setEditingQuote(baseQuote);
          setLeadSelectionMode('existing');
          setLeadSearchTerm('');
          setNewLeadData({ name: '', email: '', phone: '' });
          if (!isLoadingLeads && leadOptions.length === 0) {
            loadLeadOptions();
          }
          setShowEditor(true);
          setIsEditing(true);

          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('action');
          if (leadId) {
            newSearchParams.delete('leadId');
          }
          window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
          );
        } catch (error) {
          console.error('Error preparing new quote:', error);
        }
      };

      prepareNewQuote();
      return;
    }

    const loadQuoteByShortCode = async (shortCode: string) => {
      try {
        const { fetchQuoteByShortCode } = await import('@/services/quotesService');
        const quote = await fetchQuoteByShortCode(shortCode);
        if (!quote) {
          showNotificationMessage('Quote could not be found. It may have been deleted.', 'error');
          return;
        }
        setSelectedQuote(quote);
        // Preserve quote as-is when loading for editing (don't recalculate to avoid price changes)
        const quoteCopy: Quote = {
          ...quote,
          supplements: quote.supplements ? [...quote.supplements.map(s => ({ ...s }))] : [],
          disbursements: quote.disbursements ? [...quote.disbursements.map(d => ({ ...d }))] : []
        };
        setEditingQuote(quoteCopy);
        setShowEditor(true);
        setIsEditing(true);
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('quoteShort');
        // Keep leadId in URL if it exists (for navigation back)
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
        );
      } catch (err) {
        console.error('Error loading quote by short code:', err);
        showNotificationMessage('Failed to load quote for editing.', 'error');
      }
    };

    if (quoteShort) {
      if (quotes.length > 0) {
        const matched = quotes.find((q) => q.shortCode === quoteShort);
        if (matched) {
          setSelectedQuote(matched);
          // Preserve quote as-is when loading for editing (don't recalculate to avoid price changes)
          const quoteCopy: Quote = {
            ...matched,
            supplements: matched.supplements ? [...matched.supplements.map(s => ({ ...s }))] : [],
            disbursements: matched.disbursements ? [...matched.disbursements.map(d => ({ ...d }))] : []
          };
          setEditingQuote(quoteCopy);
          setShowEditor(true);
          setIsEditing(true);
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('quoteShort');
          // Keep leadId in URL if it exists (for navigation back)
          window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
          );
        } else {
          loadQuoteByShortCode(quoteShort);
        }
      } else {
        loadQuoteByShortCode(quoteShort);
      }
      return;
    }

    if (quoteId) {
      // Fetch the quote by ID if not already loaded
      const loadQuote = async () => {
        try {
          const { fetchQuoteById } = await import('@/services/quotesService');
          const quote = await fetchQuoteById(quoteId);
          if (quote) {
            setSelectedQuote(quote);
            setShowEditor(true);
            setIsEditing(true);
            // Clean up URL parameter
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.delete('quoteId');
            window.history.replaceState({}, '', `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
          } else {
            // If not found via fetch, try to find it in existing quotes
            const existingQuote = quotes.find(q => q.id === quoteId);
            if (existingQuote) {
              setSelectedQuote(existingQuote);
              setShowEditor(true);
              setIsEditing(true);
              const newSearchParams = new URLSearchParams(searchParams);
              newSearchParams.delete('quoteId');
              window.history.replaceState({}, '', `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
            }
          }
        } catch (err) {
          console.error('Error loading quote:', err);
        }
      };
      
      if (quotes.length > 0) {
        // Try to find in existing quotes first
        const quote = quotes.find(q => q.id === quoteId);
        if (quote) {
          setSelectedQuote(quote);
          setShowEditor(true);
          setIsEditing(true);
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('quoteId');
          window.history.replaceState({}, '', `${window.location.pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`);
        } else {
          loadQuote();
        }
      } else {
        loadQuote();
      }
    }
  }, [searchParams, quotes]);

  // Mock data removed - now using Supabase

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-800';
      case 'Sent': return 'bg-blue-100 text-blue-800';
      case 'Accepted': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Expired': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleEditQuote = (quote: Quote) => {
    // Create a deep copy for editing - preserve all existing data including supplements/disbursements
    // Do NOT recalculate totals to avoid price changes when entering edit mode
    const quoteCopy: Quote = {
      ...quote,
      shortCode: quote.shortCode,
      items: quote.items ? [...quote.items.map(item => ({ ...item }))] : [],
      supplements: quote.supplements ? [...quote.supplements.map(s => ({ ...s }))] : [],
      disbursements: quote.disbursements ? [...quote.disbursements.map(d => ({ ...d }))] : []
    };
    setSelectedQuote(quote);
    setEditingQuote(quoteCopy);
    setShowEditor(true);
    setIsEditing(true);
    setHistoryQuotes([]);
    setLeadSelectionMode('existing');
    setLeadSearchTerm('');
    setNewLeadData({ name: '', email: '', phone: '' });
  };

  const handleViewQuote = (quote: Quote) => {
    setSelectedQuote(quote);
    setEditingQuote(null);
    setShowEditor(true);
    setIsEditing(false);
    setHistoryQuotes([]);
    setLeadSelectionMode('existing');
    setLeadSearchTerm('');
    setNewLeadData({ name: '', email: '', phone: '' });
  };

  const handleSplitQuote = async (quote: Quote) => {
    // Check if quote is Sale & Purchase
    const transactionType = quote.transactionType || quote.quoteType || '';
    const isSaleAndPurchase = transactionType === 'Sale & Purchase' || 
                              transactionType === 'Purchase and Sale' ||
                              transactionType?.toLowerCase().includes('sale') && transactionType?.toLowerCase().includes('purchase');

    if (!isSaleAndPurchase) {
      showNotificationMessage('This quote is not a Sale & Purchase transaction. Split is only available for Sale & Purchase quotes.', 'error');
      return;
    }

    if (!quote.leadId) {
      showNotificationMessage('Quote must be linked to a lead to split.', 'error');
      return;
    }

    if (!window.confirm('This will create two separate quotes: one for Sale and one for Purchase. Continue?')) {
      return;
    }

    try {
      const { createQuote } = await import('@/services/quotesService');
      
      // Create Sale quote
      const saleQuote = await createQuote({
        leadId: quote.leadId,
        status: quote.status || 'Draft',
        validUntil: quote.validUntil,
        items: quote.items || [],
        supplements: quote.supplements || [],
        disbursements: quote.disbursements || [],
        netAmount: quote.netAmount ? quote.netAmount / 2 : 0,
        vatAmount: quote.vatAmount ? quote.vatAmount / 2 : 0,
        totalAmount: quote.totalAmount ? quote.totalAmount / 2 : 0,
        totalExVat: quote.totalExVat ? quote.totalExVat / 2 : 0,
        totalIncVat: quote.totalIncVat ? quote.totalIncVat / 2 : 0,
        legalFeeExVat: quote.legalFeeExVat ? quote.legalFeeExVat / 2 : 0,
        legalFeeIncVat: quote.legalFeeIncVat ? quote.legalFeeIncVat / 2 : 0,
        propertyAddress: quote.propertyAddress,
        propertyCity: quote.propertyCity,
        propertyPostcode: quote.propertyPostcode,
        propertyTenure: quote.propertyTenure,
        propertyRegion: quote.propertyRegion,
        propertyValue: quote.propertyValue,
        peopleCount: quote.peopleCount,
        version: 1,
        quoteType: 'Sale',
        transactionType: 'Sale'
      });

      // Create Purchase quote
      const purchaseQuote = await createQuote({
        leadId: quote.leadId,
        status: quote.status || 'Draft',
        validUntil: quote.validUntil,
        items: quote.items || [],
        supplements: quote.supplements || [],
        disbursements: quote.disbursements || [],
        netAmount: quote.netAmount ? quote.netAmount / 2 : 0,
        vatAmount: quote.vatAmount ? quote.vatAmount / 2 : 0,
        totalAmount: quote.totalAmount ? quote.totalAmount / 2 : 0,
        totalExVat: quote.totalExVat ? quote.totalExVat / 2 : 0,
        totalIncVat: quote.totalIncVat ? quote.totalIncVat / 2 : 0,
        legalFeeExVat: quote.legalFeeExVat ? quote.legalFeeExVat / 2 : 0,
        legalFeeIncVat: quote.legalFeeIncVat ? quote.legalFeeIncVat / 2 : 0,
        propertyAddress: quote.propertyAddress,
        propertyCity: quote.propertyCity,
        propertyPostcode: quote.propertyPostcode,
        propertyTenure: quote.propertyTenure,
        propertyRegion: quote.propertyRegion,
        propertyValue: quote.propertyValue,
        peopleCount: quote.peopleCount,
        version: 1,
        quoteType: 'Purchase',
        transactionType: 'Purchase'
      });

      if (saleQuote && purchaseQuote) {
        showNotificationMessage(`Quote split successfully! Created Sale quote (${saleQuote.shortCode || saleQuote.id}) and Purchase quote (${purchaseQuote.shortCode || purchaseQuote.id}).`, 'success');
        await loadQuotesPage(currentPage);
      } else {
        showNotificationMessage('Failed to create one or both split quotes. Please try again.', 'error');
      }
    } catch (error: any) {
      console.error('Error splitting quote:', error);
      showNotificationMessage(`Failed to split quote: ${error?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleDownloadQuote = useCallback(async (quote: Quote | null) => {
    if (!quote) {
      showNotificationMessage('Quote details are unavailable for download.', 'error');
      return;
    }

    if (quote.id === 'NEW') {
      showNotificationMessage('Save the quote before downloading a PDF.', 'error');
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    setDownloadingQuoteId(quote.id);

    try {
      const { doc, fileName } = await buildQuotePdf(quote);
      doc.save(fileName);
      showNotificationMessage('Quote PDF generated successfully.', 'success');
    } catch (error) {
      console.error('Error generating quote PDF:', error);
      showNotificationMessage('Failed to generate quote PDF. Please try again.', 'error');
    } finally {
      setDownloadingQuoteId(null);
    }
  }, [formatCurrency, showNotificationMessage]);

  const normalizeCurrencyInput = (raw: string) => {
    if (raw === '' || raw === null || raw === undefined) return 0; // Return 0 instead of null for empty values
    const parsed = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
    return Number.isNaN(parsed) ? 0 : parsed; // Return 0 instead of null for invalid values
  };

  const handleUpdateSupplement = (index: number, field: 'name' | 'fee', value: any) => {
     if (!editingQuote) return;
     const updated = [...editingSupplements];
     const current = { ...updated[index] };
     // Normalize fee value and round to prevent precision issues
     if (field === 'fee') {
       const normalized = normalizeCurrencyInput(value);
       current[field] = roundCurrency(normalized);
     } else {
       current[field] = value;
     }
     updated[index] = current;
     // Recalculate totals with fresh values - ensure we use the updated supplements array
     const recalculated = recalcTotals({
       ...editingQuote,
       supplements: updated,
       // Reset calculated fields to force fresh calculation
       totalExVat: undefined,
       totalIncVat: undefined,
       vatAmount: 0,
       netAmount: 0,
       totalAmount: 0
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
   };
 
   const handleAddSupplement = () => {
     if (!editingQuote) return;
     const recalculated = recalcTotals({
       ...editingQuote,
       supplements: [...editingSupplements, { name: '', fee: 0 }]
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
   };
 
   const handleRemoveSupplement = (index: number) => {
     if (!editingQuote) return;
     const updated = editingSupplements.filter((_, idx) => idx !== index);
     const recalculated = recalcTotals({
       ...editingQuote,
       supplements: updated
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
   };
 
   const handleUpdateDisbursement = (index: number, field: 'name' | 'fee', value: any) => {
     if (!editingQuote) return;
     const updated = [...editingDisbursements];
     const current = { ...updated[index] };
     // Normalize fee value and round to prevent precision issues
     if (field === 'fee') {
       const normalized = normalizeCurrencyInput(value);
       current[field] = roundCurrency(normalized);
     } else {
       current[field] = value;
     }
     updated[index] = current;
     // Recalculate totals with fresh values - ensure we use the updated disbursements array
     const recalculated = recalcTotals({
       ...editingQuote,
       disbursements: updated,
       // Reset calculated fields to force fresh calculation
       totalExVat: undefined,
       totalIncVat: undefined,
       vatAmount: 0,
       netAmount: 0,
       totalAmount: 0
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
   };
 
   const handleAddDisbursement = () => {
     if (!editingQuote) return;
     const recalculated = recalcTotals({
       ...editingQuote,
       disbursements: [...editingDisbursements, { name: '', fee: 0 }]
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
   };
 
   const handleRemoveDisbursement = (index: number) => {
     if (!editingQuote) return;
     const updated = editingDisbursements.filter((_, idx) => idx !== index);
     const recalculated = recalcTotals({
       ...editingQuote,
       disbursements: updated
     });
     setEditingQuote(recalculated);
     setSelectedQuote(recalculated);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
    setSelectedQuote(null);
    setEditingQuote(null);
    setIsEditing(false);
    setLeadSelectionMode('existing');
    setLeadSearchTerm('');
    setNewLeadData({ name: '', email: '', phone: '' });
  };

  const handleSaveQuote = async () => {
    if (!editingQuote) return;

    // When saving, ensure ID/AML is correct based on peopleCount
    let quoteForSave = recalcTotals({ ...editingQuote }, { updateIdAml: true });
    setIsSaving(true);

    try {
      if (isNewQuote) {
        if (leadSelectionMode === 'existing') {
          if (!quoteForSave.leadId) {
            showNotificationMessage('Please select a lead to link this quote to.', 'error');
            return;
          }
        } else {
          const trimmedName = newLeadData.name.trim();
          const trimmedEmail = newLeadData.email.trim();
          const trimmedPhone = newLeadData.phone.trim();

          if (!trimmedName || !trimmedEmail) {
            showNotificationMessage('Lead name and email are required to create a new lead.', 'error');
            return;
          }

          const createdLead = await createLead({
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone || undefined,
            source: 'Direct',
            status: 'New',
            stage: 'New'
          });

          if (!createdLead) {
            showNotificationMessage('Failed to create lead. Please try again.', 'error');
            return;
          }

          quoteForSave = recalcTotals({
            ...quoteForSave,
            leadId: createdLead.id,
            leadName: createdLead.name || trimmedName,
            leadEmail: createdLead.email || trimmedEmail,
            leadPhone: createdLead.phone || trimmedPhone || ''
          });

          setLeadOptions((prev) => [createdLead, ...prev.filter((lead) => lead.id !== createdLead.id)]);
          setLeadSelectionMode('existing');
          setLeadSearchTerm('');
          setNewLeadData({ name: '', email: '', phone: '' });
        }
      }

      setEditingQuote(quoteForSave);
      setSelectedQuote(quoteForSave);

      const sanitizeMoneyList = (list: any[] = []) =>
        list.map((entry) => {
          // Ensure fee values are properly normalized - convert null/undefined/empty to 0
          const feeValue =
            entry?.fee === '' || entry?.fee === null || entry?.fee === undefined
              ? 0
              : typeof entry?.fee === 'number'
              ? entry.fee
              : Number.parseFloat(String(entry.fee).replace(/[^0-9.-]/g, ''));
          return {
            ...entry,
            fee: Number.isNaN(feeValue) ? 0 : roundCurrency(feeValue) // Use 0 and round to prevent precision issues
          };
        });

      const items = (quoteForSave.items || []).map((item) => {
        const quantity =
          typeof item.quantity === 'number'
            ? item.quantity
            : Number.parseFloat(item.quantity ? `${item.quantity}` : '0');
        const unitPrice =
          typeof item.unitPrice === 'number'
            ? item.unitPrice
            : Number.parseFloat(item.unitPrice ? `${item.unitPrice}` : '0');
        const computedTotal =
          typeof item.total === 'number'
            ? item.total
            : Number.parseFloat(item.total ? `${item.total}` : '0');
        const total =
          Number.isNaN(computedTotal) || computedTotal === 0
            ? Number((quantity || 0) * (unitPrice || 0))
            : computedTotal;

        return {
          ...item,
          quantity: Number.isNaN(quantity) ? 0 : quantity,
          unitPrice: Number.isNaN(unitPrice) ? 0 : unitPrice,
          total: Number.isNaN(total) ? 0 : total
        };
      });
      const supplements = sanitizeMoneyList(quoteForSave.supplements);
      const disbursements = sanitizeMoneyList(quoteForSave.disbursements);

      // Use values directly from recalcTotals - it already calculates everything correctly
      // Don't recalculate here as it can cause VAT duplication
      const netAmount = quoteForSave.totalExVat ?? quoteForSave.netAmount ?? 0;
      const vatAmount = quoteForSave.vatAmount ?? 0;
      const totalAmount = quoteForSave.totalIncVat ?? quoteForSave.totalAmount ?? (netAmount + vatAmount);

      if (!selectedQuote || isNewQuote) {
        if (!quoteForSave.leadId) {
          showNotificationMessage('Lead information is required to create a quote.', 'error');
          return;
        }

        const { createQuote } = await import('@/services/quotesService');
        const created = await createQuote({
          leadId: quoteForSave.leadId,
          status: 'Draft', // New quotes start as Draft
          validUntil: quoteForSave.validUntil,
          items,
          supplements,
          disbursements,
          netAmount,
          vatAmount,
          totalAmount,
          totalExVat: netAmount,
          totalIncVat: totalAmount,
          legalFeeExVat: quoteForSave.legalFeeExVat,
          legalFeeIncVat: quoteForSave.legalFeeIncVat,
          propertyAddress: quoteForSave.propertyAddress,
          propertyCity: quoteForSave.propertyCity,
          propertyCounty: quoteForSave.propertyCounty,
          propertyPostcode: quoteForSave.propertyPostcode,
          propertyTenure: quoteForSave.propertyTenure,
          propertyRegion: quoteForSave.propertyRegion,
          propertyValue: quoteForSave.propertyValue,
          peopleCount: quoteForSave.peopleCount,
          version: 1,
          sdltVersion: quoteForSave.sdltVersion,
          landRegistryVersion: quoteForSave.landRegistryVersion,
          electronicSubmission: quoteForSave.electronicSubmission,
          referralFee: quoteForSave.referralFee,
          panelMemberId: quoteForSave.panelMemberId,
          employeeId: quoteForSave.employeeId,
          emailSenderId: quoteForSave.emailSenderId,
          propertyType: quoteForSave.propertyType,
          isCompanyClaimingRelief: quoteForSave.isCompanyClaimingRelief,
          isMortgaged: quoteForSave.isMortgaged,
          isFirstTimeBuyer: quoteForSave.isFirstTimeBuyer,
          isUnregistered: quoteForSave.isUnregistered,
          isNewBuild: quoteForSave.isNewBuild,
          isSharedOwnership: quoteForSave.isSharedOwnership,
          isBuyToLet: quoteForSave.isBuyToLet,
          isHelpToBuyEquityLoan: quoteForSave.isHelpToBuyEquityLoan,
          isHelpToBuyIsa: quoteForSave.isHelpToBuyIsa,
          isRightToBuy: quoteForSave.isRightToBuy,
          isIslamicMortgage: quoteForSave.isIslamicMortgage,
          isAuctionRepossession: quoteForSave.isAuctionRepossession,
          isGiftedDeposit: quoteForSave.isGiftedDeposit,
          isNonUkResident: quoteForSave.isNonUkResident,
          isClientCompany: quoteForSave.isClientCompany,
          notes: quoteForSave.notes,
          terms: quoteForSave.terms
        });

        if (created) {
          // Update lead's number_of_people if it changed
          if (quoteForSave.leadId && quoteForSave.peopleCount) {
            try {
              const { updateLead } = await import('@/services/leadsService');
              await updateLead(quoteForSave.leadId, {
                numberOfPeople: quoteForSave.peopleCount.toString()
              });
            } catch (error: any) {
              console.warn('Failed to update lead number_of_people:', error);
              showNotificationMessage(
                error?.message || 'Quote saved, but updating lead details failed. You can update the lead separately.',
                'error'
              );
            }
          }

          const { fetchQuoteById } = await import('@/services/quotesService');
          const refreshed = await fetchQuoteById(created.id);
          const finalQuote = recalcTotals(refreshed ?? created);

          await loadQuotesPage(currentPage);

          setSelectedQuote(finalQuote);
          setEditingQuote(null);
    setIsEditing(false);
          setShowEditor(false);
          showNotificationMessage('Quote created successfully!', 'success');

          // If we came from a lead view, navigate back to that lead
          if (originatingLeadId) {
            setTimeout(() => {
              navigate(`/lead-management?leadId=${originatingLeadId}`);
              setOriginatingLeadId(null);
            }, 1000); // Small delay to show success message
          }
        } else {
          showNotificationMessage('Failed to create quote. Please try again.', 'error');
        }
      } else {
        // When updating a quote, create a new version instead of updating the existing one
        // This allows the history to show multiple versions
        const { createQuote } = await import('@/services/quotesService');
        const { supabase } = await import('@/lib/supabase');
        
        // Get the current version to increment it
        const currentVersion = selectedQuote.version || 1;
        const newVersion = currentVersion + 1;
        
        // Create a new quote record with incremented version
        // When editing a quote, set status to "Draft" unless it's being sent
        // Only keep "Sent" status when explicitly sending via handleSendQuote
        const newVersionQuote = await createQuote({
          leadId: quoteForSave.leadId,
          status: 'Draft', // Always set to Draft when editing (will be set to Sent when sending)
          validUntil: quoteForSave.validUntil,
          items,
          supplements,
          disbursements,
          netAmount,
          vatAmount,
          totalAmount,
          totalExVat: netAmount,
          totalIncVat: totalAmount,
          legalFeeExVat: quoteForSave.legalFeeExVat,
          legalFeeIncVat: quoteForSave.legalFeeIncVat,
          propertyAddress: quoteForSave.propertyAddress,
          propertyCity: quoteForSave.propertyCity,
          propertyCounty: quoteForSave.propertyCounty,
          propertyPostcode: quoteForSave.propertyPostcode,
          propertyTenure: quoteForSave.propertyTenure,
          propertyRegion: quoteForSave.propertyRegion,
          propertyValue: quoteForSave.propertyValue,
          peopleCount: quoteForSave.peopleCount,
          version: newVersion,
          quoteType: quoteForSave.quoteType || selectedQuote.quoteType,
          notes: quoteForSave.notes,
          terms: quoteForSave.terms,
          sdltVersion: quoteForSave.sdltVersion,
          landRegistryVersion: quoteForSave.landRegistryVersion,
          electronicSubmission: quoteForSave.electronicSubmission,
          referralFee: quoteForSave.referralFee,
          panelMemberId: quoteForSave.panelMemberId,
          employeeId: quoteForSave.employeeId,
          emailSenderId: quoteForSave.emailSenderId,
          propertyType: quoteForSave.propertyType,
          isCompanyClaimingRelief: quoteForSave.isCompanyClaimingRelief,
          isMortgaged: quoteForSave.isMortgaged,
          isFirstTimeBuyer: quoteForSave.isFirstTimeBuyer,
          isUnregistered: quoteForSave.isUnregistered,
          isNewBuild: quoteForSave.isNewBuild,
          isSharedOwnership: quoteForSave.isSharedOwnership,
          isBuyToLet: quoteForSave.isBuyToLet,
          isHelpToBuyEquityLoan: quoteForSave.isHelpToBuyEquityLoan,
          isHelpToBuyIsa: quoteForSave.isHelpToBuyIsa,
          isRightToBuy: quoteForSave.isRightToBuy,
          isIslamicMortgage: quoteForSave.isIslamicMortgage,
          isAuctionRepossession: quoteForSave.isAuctionRepossession,
          isGiftedDeposit: quoteForSave.isGiftedDeposit,
          isNonUkResident: quoteForSave.isNonUkResident,
          isClientCompany: quoteForSave.isClientCompany
        });
        
        // Update the shortCode of the new version to match the original (if it exists)
        // This ensures all versions share the same shortCode for history tracking
        if (selectedQuote.shortCode && newVersionQuote) {
          await supabase
            .from('quotes')
            .update({ short_code: selectedQuote.shortCode })
            .eq('id', newVersionQuote.id);
          
          // Refresh the quote to get the updated shortCode
          const { fetchQuoteById } = await import('@/services/quotesService');
          const refreshed = await fetchQuoteById(newVersionQuote.id);
          if (refreshed) {
            Object.assign(newVersionQuote, refreshed);
          }
        }
        
        const updated = newVersionQuote;

        // Update lead's number_of_people if it changed
        if (quoteForSave.leadId && quoteForSave.peopleCount) {
          try {
            const { updateLead } = await import('@/services/leadsService');
            await updateLead(quoteForSave.leadId, {
              numberOfPeople: quoteForSave.peopleCount.toString()
            });
          } catch (error: any) {
            console.warn('Failed to update lead number_of_people:', error);
            showNotificationMessage(
              error?.message || 'Quote saved, but updating lead details failed. You can update the lead separately.',
              'error'
            );
          }
        }

        if (updated) {
          const { fetchQuoteById } = await import('@/services/quotesService');
          const refreshed = await fetchQuoteById(updated.id);
          const finalQuote = recalcTotals(refreshed ?? updated, { updateIdAml: false });

          await loadQuotesPage(currentPage);
          
          setSelectedQuote(finalQuote);
          setEditingQuote(finalQuote);
          showNotificationMessage(`Quote updated successfully! New version ${finalQuote.version} created.`, 'success');
          
          // If we came from a lead view, navigate back to that lead
          if (originatingLeadId) {
            setTimeout(() => {
              navigate(`/lead-management?leadId=${originatingLeadId}`);
              setOriginatingLeadId(null);
            }, 1000); // Small delay to show success message
          } else {
            // Only close editor if we're not viewing from a lead detail page
            setShowEditor(false);
            setIsEditing(false);
          }
        } else {
          showNotificationMessage('Failed to update quote. Please try again.', 'error');
        }
      }
    } catch (err: any) {
      console.error('Error saving quote:', err);
      const errorMessage =
        err?.message ||
        err?.details ||
        err?.error_description ||
        (typeof err === 'string' ? err : 'Failed to save quote. Please try again.');
      showNotificationMessage(
        errorMessage.startsWith('Failed') ? errorMessage : `Failed to save quote: ${errorMessage}`,
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAttachQuote = async () => {
    // Check if attachment exists - if so, remove it
    const currentAttachment = quoteAttachment;
    if (currentAttachment) {
      setQuoteAttachment(null);
      return;
    }

    // Otherwise, generate and attach
    if (!selectedQuote) {
      showNotificationMessage('No quote selected to attach.', 'error');
      return;
    }

    try {
      setIsGeneratingQuoteAttachment(true);
      const { doc, fileName } = await buildQuotePdf(selectedQuote);
      const arrayBuffer = doc.output('arraybuffer');
      const base64 = arrayBufferToBase64(arrayBuffer);
      setQuoteAttachment({
        fileName,
        contentType: 'application/pdf',
        contentBytes: base64
      });
    } catch (error) {
      console.error('Error generating quote attachment:', error);
      showNotificationMessage('Unable to generate the quote PDF. Please try again.', 'error');
    } finally {
      setIsGeneratingQuoteAttachment(false);
    }
  };

  const handleCloseSendModal = useCallback(() => {
    setShowSendModal(false);
    setQuoteAttachment(null);
    setIsGeneratingQuoteAttachment(false);
  }, []);

  const handleSendQuote = async (quote?: Quote) => {
    // Use provided quote or selectedQuote from state
    const quoteToSend = quote || selectedQuote;
    if (!quoteToSend) return;

    // Set selected quote if it's different
    if (quote && quote.id !== selectedQuote?.id) {
      setSelectedQuote(quote);
    }

    // Generate acceptance URL
    let acceptanceUrl: string | null = null;
    try {
      acceptanceUrl = await ensureQuoteAcceptanceToken(quoteToSend.id);
    } catch (error) {
      console.error('Error generating acceptance URL:', error);
      // Continue without acceptance URL - email will still be sent
    }

    // Generate HTML email template
    const emailHTML = generateQuoteEmailHTML({
      quote: quoteToSend,
      acceptanceUrl: acceptanceUrl || undefined,
      clientName: quoteToSend.leadName || 'there',
      clientEmail: quoteToSend.leadEmail || '',
      propertyAddress: quoteToSend.propertyAddress,
      transactionType: quoteToSend.quoteType || 'Conveyancing',
      expiryDate: quoteToSend.expiryDate || quoteToSend.validUntil
    });

    setSendEmailData({
      email: quoteToSend.leadEmail || '',
      subject: `Your ${quoteToSend.quoteType || 'Conveyancing'} Quote - Millennium Legal`,
      message: emailHTML // Store HTML in message field
    });
    
    // Automatically generate and attach quote PDF
    setQuoteAttachment(null);
    setIsGeneratingQuoteAttachment(true);
    setShowSendModal(true);

    try {
      const { doc, fileName } = await buildQuotePdf(quoteToSend);
      const arrayBuffer = doc.output('arraybuffer');
      const base64 = arrayBufferToBase64(arrayBuffer);
      setQuoteAttachment({
        fileName,
        contentType: 'application/pdf',
        contentBytes: base64
      });
    } catch (error) {
      console.error('Error generating quote attachment:', error);
      showNotificationMessage('Unable to generate the quote PDF. You can still send the email without attachment.', 'error');
    } finally {
      setIsGeneratingQuoteAttachment(false);
    }
  };

  const handleSendEmail = async () => {
    if (!selectedQuote || !sendEmailData.email) {
      showNotificationMessage('Please enter a valid email address.', 'error');
      return;
    }

    try {
      setIsSendingEmail(true);

      // Generate email content if not already generated
      let emailHTML = sendEmailData.message;
      let emailText = sendEmailData.message;

      // Check if message is already HTML (contains HTML tags)
      if (!sendEmailData.message.includes('<html>')) {
        // Generate acceptance URL if not already generated
        let acceptanceUrl: string | null = null;
        try {
          acceptanceUrl = await ensureQuoteAcceptanceToken(selectedQuote.id);
        } catch (error) {
          console.error('Error generating acceptance URL:', error);
        }

        // Generate HTML email template
        emailHTML = generateQuoteEmailHTML({
          quote: selectedQuote,
          acceptanceUrl: acceptanceUrl || undefined,
          clientName: selectedQuote.leadName || 'there',
          clientEmail: selectedQuote.leadEmail || '',
          propertyAddress: selectedQuote.propertyAddress,
          transactionType: selectedQuote.quoteType || 'Conveyancing',
          expiryDate: selectedQuote.expiryDate || selectedQuote.validUntil
        });

        emailText = generateQuoteEmailText({
          quote: selectedQuote,
          acceptanceUrl: acceptanceUrl || undefined,
          clientName: selectedQuote.leadName || 'there',
          clientEmail: selectedQuote.leadEmail || '',
          propertyAddress: selectedQuote.propertyAddress,
          transactionType: selectedQuote.quoteType || 'Conveyancing',
          expiryDate: selectedQuote.expiryDate || selectedQuote.validUntil
        });
      } else {
        // Message is already HTML, extract text version
        emailText = sendEmailData.message.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n\n');
      }

      await sendOutlookEmail({
        to: sendEmailData.email,
        subject: sendEmailData.subject,
        htmlBody: emailHTML,
        textBody: emailText,
        leadId: selectedQuote.leadId,
        leadName: selectedQuote.leadName,
        attachments: quoteAttachment ? [quoteAttachment] : undefined
      });

      // Update quote status to 'Sent'
      try {
        await updateQuote(selectedQuote.id, {
          status: 'Sent',
          sentAt: new Date().toISOString()
        }, user?.id, user?.name);
      } catch (updateError) {
        console.error('Error updating quote status:', updateError);
        // Don't fail the entire operation if status update fails
      }

      showNotificationMessage('Quote sent successfully!', 'success');
      handleCloseSendModal();
      
      // Reload quotes to reflect status change
      try {
        await loadQuotesPage(currentPage);
      } catch (err) {
        console.error('Error reloading quotes:', err);
      }
    } catch (error) {
      console.error('Error sending quote email:', error);
      showNotificationMessage(
        error instanceof Error ? error.message : 'Failed to send quote email. Please try again.',
        'error'
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleCreateQuoteClick = () => {
    const baseQuote = buildBaseQuote();
    setSelectedQuote(baseQuote);
    setEditingQuote(baseQuote);
    setLeadSelectionMode('existing');
    setLeadSearchTerm('');
    setNewLeadData({ name: '', email: '', phone: '' });
    if (!isLoadingLeads && leadOptions.length === 0) {
      loadLeadOptions();
    }
    setShowEditor(true);
    setIsEditing(true);
  };

  const handleLeadModeChange = (mode: 'existing' | 'new') => {
    setLeadSelectionMode(mode);
    if (mode === 'existing') {
      if (!isLoadingLeads && leadOptions.length === 0) {
        loadLeadOptions();
      }
    } else {
      const base = editingQuote ?? buildBaseQuote();
      const updated = recalcTotals({
        ...base,
        leadId: '',
        leadName: newLeadData.name,
        leadEmail: newLeadData.email,
        leadPhone: newLeadData.phone
      });
      setEditingQuote(updated);
      setSelectedQuote(updated);
    }
  };

  const handleSelectLead = (leadId: string) => {
    const base = editingQuote ?? buildBaseQuote();
    if (!leadId) {
      const cleared = recalcTotals({
        ...base,
        leadId: '',
        leadName: '',
        leadEmail: '',
        leadPhone: ''
      });
      setEditingQuote(cleared);
      setSelectedQuote(cleared);
      setLeadSearchTerm('');
      return;
    }

    const lead = leadOptions.find((option) => option.id === leadId);
    if (!lead) return;

    const updated = recalcTotals({
      ...base,
      leadId: lead.id,
      leadName: lead.name || '',
      leadEmail: lead.email || '',
      leadPhone: lead.phone || ''
    });
    setEditingQuote(updated);
    setSelectedQuote(updated);
    setLeadSearchTerm(lead.name || '');
  };

  const handleNewLeadFieldChange = (field: 'name' | 'email' | 'phone', value: string) => {
    setNewLeadData((prev) => {
      const next = { ...prev, [field]: value };
      const base = editingQuote ?? buildBaseQuote();
      const updated = recalcTotals({
        ...base,
        leadId: '',
        leadName: field === 'name' ? value : next.name,
        leadEmail: field === 'email' ? value : next.email,
        leadPhone: field === 'phone' ? value : next.phone
      });
      setEditingQuote(updated);
      setSelectedQuote(updated);
      return next;
    });
  };

  const FEE_ENGINE_FIELDS: (keyof Quote)[] = [
    'propertyValue', 'propertyType', 'propertyRegion', 'quoteType',
    'isMortgaged', 'isUnregistered', 'isFirstTimeBuyer', 'isNewBuild',
    'isSharedOwnership', 'isBuyToLet', 'isHelpToBuyEquityLoan', 'isHelpToBuyIsa',
    'isRightToBuy', 'isIslamicMortgage', 'isAuctionRepossession', 'isGiftedDeposit',
    'isNonUkResident', 'isClientCompany', 'isCompanyClaimingRelief',
    'sdltVersion', 'landRegistryVersion', 'electronicSubmission'
  ];

  const handleUpdateQuoteField = (field: keyof Quote, value: any) => {
    if (!editingQuote) return;
    let updatedQuote = {
      ...editingQuote,
      [field]: value
    } as Quote;

    // Hoowla-style: apply fee config when relevant fields change
    if (feeConfig && FEE_ENGINE_FIELDS.includes(field)) {
      try {
        const result = applyFeeConfig(
          {
            propertyValue: updatedQuote.propertyValue,
            propertyType: updatedQuote.propertyType,
            propertyRegion: updatedQuote.propertyRegion,
            quoteType: updatedQuote.quoteType,
            legalFeeExVat: updatedQuote.legalFeeExVat,
            supplements: updatedQuote.supplements,
            disbursements: updatedQuote.disbursements,
            isMortgaged: updatedQuote.isMortgaged,
            isUnregistered: updatedQuote.isUnregistered,
            isFirstTimeBuyer: updatedQuote.isFirstTimeBuyer,
            isNewBuild: updatedQuote.isNewBuild,
            isSharedOwnership: updatedQuote.isSharedOwnership,
            isBuyToLet: updatedQuote.isBuyToLet,
            isHelpToBuyEquityLoan: updatedQuote.isHelpToBuyEquityLoan,
            isHelpToBuyIsa: updatedQuote.isHelpToBuyIsa,
            isRightToBuy: updatedQuote.isRightToBuy,
            isIslamicMortgage: updatedQuote.isIslamicMortgage,
            isAuctionRepossession: updatedQuote.isAuctionRepossession,
            isGiftedDeposit: updatedQuote.isGiftedDeposit,
            isNonUkResident: updatedQuote.isNonUkResident,
            isClientCompany: updatedQuote.isClientCompany,
            isCompanyClaimingRelief: updatedQuote.isCompanyClaimingRelief,
            sdltVersion: updatedQuote.sdltVersion,
            landRegistryVersion: updatedQuote.landRegistryVersion,
            electronicSubmission: updatedQuote.electronicSubmission
          },
          feeConfig
        );
        if (result.legalFeeExVat !== undefined) {
          updatedQuote = { ...updatedQuote, legalFeeExVat: result.legalFeeExVat };
        }
        updatedQuote = {
          ...updatedQuote,
          supplements: result.supplements,
          disbursements: result.disbursements
        };
      } catch (err: any) {
        const msg = err?.message || 'Fee auto-calculation failed. You can still edit amounts manually.';
        showNotificationMessage(msg, 'error');
        return;
      }
    }

    const shouldUpdateIdAml = field === 'peopleCount';
    const recalculated = recalcTotals(updatedQuote, { updateIdAml: shouldUpdateIdAml });
    setEditingQuote(recalculated);
    setSelectedQuote(recalculated);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

const renderQuoteModal = () => {
  if (!selectedQuote || !showEditor) return null;

  if (isEditing) {
    if (!editingQuote) {
      return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Edit Quote {selectedQuote.shortCode || selectedQuote.id}
              </h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={handleCloseEditor}>
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 text-sm text-gray-600">
              Unable to load quote for editing. Please close and try again.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {isNewQuote
                ? `Create Quote${selectedQuote.leadName ? ` for ${selectedQuote.leadName}` : ''}`
                : `Edit Quote ${selectedQuote.shortCode || selectedQuote.id} - Version ${selectedQuote.version}`}
            </h3>
            <button className="text-gray-400 hover:text-gray-600" onClick={handleCloseEditor}>
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left column: People, Address, Property type, Settings */}
              <div className="space-y-6">
            <div className="card">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Quote Information
              </h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Quote ID:</span>
                  <span className="font-medium text-gray-900">{selectedQuote.shortCode || selectedQuote.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Created:</span>
                  <span className="font-medium text-gray-900">{formatDateTime(selectedQuote.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Status:</span>
                  <select
                    className="input-field text-sm w-40"
                    value={editingQuote.status}
                    onChange={(e) => handleUpdateQuoteField('status', e.target.value as any)}
                  >
                    <option value="Draft">Draft</option>
                    <option value="Sent">Sent</option>
                    <option value="Accepted">Accepted</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Expired">Expired</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Valid Until:</span>
                  <input
                    type="datetime-local"
                    className="input-field text-sm w-48"
                    value={editingQuote.validUntil ? new Date(editingQuote.validUntil).toISOString().slice(0, 16) : ''}
                    onChange={(e) => handleUpdateQuoteField('validUntil', e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="font-medium text-gray-900 text-sm">Lead Information</div>
                    {isNewQuote ? (
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="radio"
                              className="form-radio text-[#011E41]"
                              checked={leadSelectionMode === 'existing'}
                              onChange={() => handleLeadModeChange('existing')}
                            />
                            <span>Use existing lead</span>
                          </label>
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="radio"
                              className="form-radio text-[#011E41]"
                              checked={leadSelectionMode === 'new'}
                              onChange={() => handleLeadModeChange('new')}
                            />
                            <span>Create new lead</span>
                          </label>
                        </div>

                        {leadSelectionMode === 'existing' ? (
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs uppercase tracking-wide block mb-1 text-gray-600">
                                Search Leads
                              </label>
                              <input
                                className="input-field text-sm"
                                value={leadSearchTerm}
                                onChange={(e) => setLeadSearchTerm(e.target.value)}
                                placeholder="Search by name, email or phone"
                              />
                            </div>
                            <div>
                              {isLoadingLeads ? (
                                <div className="flex items-center text-sm text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading leads...
                                </div>
                              ) : filteredLeadOptions.length > 0 ? (
                                <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y">
                                  {filteredLeadOptions.map((lead, idx) => {
                                    const isSelected = editingQuote?.leadId === lead.id;
                                    return (
                                      <button
                                        key={lead.id}
                                        type="button"
                                        onClick={() => handleSelectLead(lead.id)}
                                        className={`w-full text-left px-4 py-3 transition-colors ${
                                          isSelected
                                            ? 'bg-blue-50 border-l-4 border-l-[#011E41]'
                                            : idx === 0 && leadSearchTerm
                                            ? 'bg-gray-50 hover:bg-blue-50'
                                            : 'hover:bg-blue-50'
                                        }`}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 truncate">
                                              {lead.name || 'Unnamed lead'}
                                            </div>
                                            {lead.email && (
                                              <div className="text-xs text-gray-500 truncate">
                                                {lead.email}
                                              </div>
                                            )}
                                            <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-2">
                                              {lead.phone && <span>{lead.phone}</span>}
                                              {lead.assignedToName && (
                                                <span>• Assigned to: {lead.assignedToName}</span>
                              )}
                            </div>
                                          </div>
                                          {isSelected && (
                                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500 border border-gray-200 rounded-lg p-3">
                                  {leadOptions.length === 0
                                    ? 'No leads available. Create or import a lead first.'
                                    : 'No leads match your search.'}
                                </div>
                              )}
                            </div>
                            {editingQuote?.leadId && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-700">
                                <div className="font-medium text-gray-900">
                                  {selectedLeadOption?.name || editingQuote.leadName || 'Lead'}
                                </div>
                                <div>{selectedLeadOption?.email || editingQuote.leadEmail || 'No email on file'}</div>
                                <div>{selectedLeadOption?.phone || editingQuote.leadPhone || 'No phone on file'}</div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-600">
                            <div>
                              <label className="text-xs uppercase tracking-wide block mb-1 text-gray-600">
                                Lead Name *
                              </label>
                              <input
                                className="input-field text-sm"
                                value={newLeadData.name}
                                onChange={(e) => handleNewLeadFieldChange('name', e.target.value)}
                                placeholder="Enter lead name"
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-wide block mb-1 text-gray-600">
                                Email *
                              </label>
                              <input
                                type="email"
                                className="input-field text-sm"
                                value={newLeadData.email}
                                onChange={(e) => handleNewLeadFieldChange('email', e.target.value)}
                                placeholder="name@example.com"
                              />
                            </div>
                            <div>
                              <label className="text-xs uppercase tracking-wide block mb-1 text-gray-600">
                                Phone
                              </label>
                              <input
                                className="input-field text-sm"
                                value={newLeadData.phone}
                                onChange={(e) => handleNewLeadFieldChange('phone', e.target.value)}
                                placeholder="Optional"
                              />
                            </div>
                            <div className="md:col-span-3 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-3">
                              A new lead will be created and linked to this quote when you save.
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-1 text-sm text-gray-600">
                        <div>Name: {selectedQuote.leadName || '—'}</div>
                        <div>Email: {selectedQuote.leadEmail || '—'}</div>
                        <div>Phone: {selectedQuote.leadPhone || '—'}</div>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <div className="font-medium text-gray-900 text-sm">Version & Status</div>
                    <div>Version: {selectedQuote.version}</div>
                    {selectedQuote.sentAt && <div>Sent: {formatDateTime(selectedQuote.sentAt)}</div>}
                    {selectedQuote.acceptedAt && <div>Accepted: {formatDateTime(selectedQuote.acceptedAt)}</div>}
                    {selectedQuote.rejectedAt && <div>Rejected: {formatDateTime(selectedQuote.rejectedAt)}</div>}
                  </div>
                </div>
              </div>
            </div>

            {/* Address & Property (Hoowla-style left column) */}
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Address & Property</h4>
              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Address</label>
                  <input
                    className="input-field text-sm"
                    value={editingQuote?.propertyAddress || ''}
                    onChange={(e) => handleUpdateQuoteField('propertyAddress', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Postcode</label>
                    <input
                      className="input-field text-sm"
                      value={editingQuote?.propertyPostcode || ''}
                      onChange={(e) => handleUpdateQuoteField('propertyPostcode', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">City</label>
                    <input
                      className="input-field text-sm"
                      value={editingQuote?.propertyCity || ''}
                      onChange={(e) => handleUpdateQuoteField('propertyCity', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Region</label>
                  <select
                    className="input-field text-sm w-full"
                    value={editingQuote?.propertyRegion || ''}
                    onChange={(e) => handleUpdateQuoteField('propertyRegion', e.target.value)}
                  >
                    <option value="">— Select —</option>
                    <option value="England">England</option>
                    <option value="Wales">Wales</option>
                    <option value="Scotland">Scotland</option>
                    <option value="Northern Ireland">Northern Ireland</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-2">Property Type</label>
                  <div className="flex flex-wrap gap-4">
                    {(['Freehold', 'Leasehold', 'Unknown'] as const).map((opt) => (
                      <label key={opt} className="inline-flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          name="propertyType"
                          className="form-radio text-[#011E41]"
                          checked={(editingQuote?.propertyType || editingQuote?.propertyTenure || '') === opt}
                          onChange={() => handleUpdateQuoteField('propertyType', opt)}
                        />
                        <span className="text-sm text-gray-700">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">
                    Number of People <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input-field text-sm w-24"
                    value={editingQuote?.peopleCount || 1}
                    onChange={(e) => handleUpdateQuoteField('peopleCount', parseInt(e.target.value) || 1)}
                    placeholder="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">£50 per person for ID/AML checks</p>
                </div>
              </div>
            </div>

            {/* Property attributes (Hoowla-style checkboxes – drive fee rules) */}
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Property / buyer characteristics</h4>
              <p className="text-xs text-gray-500 mb-3">Select conditions that apply; fees may be added or removed automatically from Settings rules.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  { key: 'isFirstTimeBuyer' as const, label: 'First Time Buyer' },
                  { key: 'isMortgaged' as const, label: 'Mortgaged' },
                  { key: 'isUnregistered' as const, label: 'Unregistered' },
                  { key: 'isSharedOwnership' as const, label: 'Shared Ownership' },
                  { key: 'isNewBuild' as const, label: 'New Build' },
                  { key: 'isHelpToBuyEquityLoan' as const, label: 'Help to Buy Equity Loan' },
                  { key: 'isBuyToLet' as const, label: 'Buy to Let or 2nd Home' },
                  { key: 'isHelpToBuyIsa' as const, label: 'Help-to-Buy ISA' },
                  { key: 'isRightToBuy' as const, label: 'Right to Buy' },
                  { key: 'isIslamicMortgage' as const, label: 'Islamic Mortgage' },
                  { key: 'isAuctionRepossession' as const, label: 'Auction/Repossession' },
                  { key: 'isGiftedDeposit' as const, label: 'Gifted Deposit' },
                  { key: 'isNonUkResident' as const, label: 'Non-UK Resident' },
                  { key: 'isClientCompany' as const, label: 'Client is Company' },
                  { key: 'isCompanyClaimingRelief' as const, label: 'Company is Claiming Relief' },
                ].map(({ key, label }) => (
                  <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="form-checkbox text-[#011E41] rounded"
                      checked={!!(editingQuote as any)?.[key]}
                      onChange={(e) => handleUpdateQuoteField(key, e.target.checked)}
                    />
                    <span className="text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Settings (Hoowla-style: update values here) */}
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </h4>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Referral Fee (£)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field text-sm w-full"
                    value={editingQuote?.referralFee ?? ''}
                    onChange={(e) =>
                      handleUpdateQuoteField('referralFee', e.target.value === '' ? undefined : parseFloat(e.target.value))
                    }
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">SDLT Version</label>
                  <select
                    className="input-field text-sm w-full"
                    value={editingQuote?.sdltVersion || ''}
                    onChange={(e) => handleUpdateQuoteField('sdltVersion', e.target.value || undefined)}
                  >
                    <option value="">— Select —</option>
                    <option value="Standard Rate Apr 2025 and after">Standard Rate Apr 2025 and after</option>
                    <option value="Standard Rate (prior to Apr 2025)">Standard Rate (prior to Apr 2025)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Land Registry Version</label>
                  <select
                    className="input-field text-sm w-full"
                    value={editingQuote?.landRegistryVersion || ''}
                    onChange={(e) => handleUpdateQuoteField('landRegistryVersion', e.target.value || undefined)}
                  >
                    <option value="">— Select —</option>
                    <option value="31st Jan 2022 and after">31st Jan 2022 and after</option>
                    <option value="Prior to 31st Jan 2022">Prior to 31st Jan 2022</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="electronicSubmission"
                    className="form-checkbox text-[#011E41] rounded"
                    checked={editingQuote?.electronicSubmission ?? false}
                    onChange={(e) => handleUpdateQuoteField('electronicSubmission', e.target.checked)}
                  />
                  <label htmlFor="electronicSubmission" className="ml-2 text-sm text-gray-700">
                    Submit to Land Registry electronically
                  </label>
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Quote Note</label>
                  <textarea
                    className="input-field text-sm w-full min-h-[80px]"
                    value={editingQuote?.notes || ''}
                    onChange={(e) => handleUpdateQuoteField('notes', e.target.value)}
                    placeholder="e.g. Source: Compare Conveyancing Prices"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Custom Message to Client</label>
                  <textarea
                    className="input-field text-sm w-full min-h-[80px]"
                    value={editingQuote?.terms || ''}
                    onChange={(e) => handleUpdateQuoteField('terms', e.target.value)}
                    placeholder="Optional message to include when sending quote"
                    rows={3}
                  />
                </div>
              </div>
            </div>
              </div>

              {/* Right column: Property value, Legal fees, Totals, Supplements, Disbursements */}
              <div className="space-y-6">
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Property Purchase / Sale</h4>
              <div>
                <label className="block text-gray-600 text-xs uppercase tracking-wide mb-1">Property Value (£)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  className="input-field text-sm w-full"
                  value={editingQuote?.propertyValue ?? ''}
                  onChange={(e) =>
                    handleUpdateQuoteField('propertyValue', e.target.value === '' ? undefined : Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Legal Fees</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-gray-600 text-xs uppercase tracking-wide block mb-1">Legal Fee (excl. VAT)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field text-sm text-right"
                    value={editingQuote?.legalFeeExVat ?? ''}
                    onChange={(e) =>
                      handleUpdateQuoteField(
                        'legalFeeExVat',
                        e.target.value === '' ? undefined : parseFloat(e.target.value)
                      )
                    }
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <span className="text-gray-600 text-xs uppercase tracking-wide block mb-1">Legal Fee (incl. VAT)</span>
                  <span className="text-sm font-semibold text-gray-900 text-right">
                    {formatCurrency(editingQuote?.legalFeeIncVat ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Totals</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">Net Amount (excl. VAT)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(editingQuote?.totalExVat ?? editingNetAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">Legal Fees (incl. VAT)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(editingQuote?.legalFeeIncVat ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">VAT (20%)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(editingQuote?.vatAmount ?? editingVatAmount ?? 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">Disbursements</span>
                  <span className="text-gray-900">{formatCurrency(sumMonetaryList(editingQuote?.disbursements))}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-xs uppercase tracking-wide">Supplements</span>
                  <span className="text-gray-900">{formatCurrency(sumMonetaryList(editingQuote?.supplements))}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
                  <span className="text-gray-900 text-xs uppercase tracking-wide font-semibold">Total (incl. VAT)</span>
                  <span className="text-lg font-bold text-[#011E41]">{formatCurrency(editingQuote?.totalIncVat ?? editingTotalAmount ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Supplements</h4>
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center space-x-1"
                    onClick={handleAddSupplement}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {editingSupplements.length === 0 && (
                    <div className="text-xs text-gray-500">No supplements added.</div>
                  )}
                  {editingSupplements.map((supplement, idx) => (
                    <div
                      key={`supplement-edit-${idx}`}
                      className="bg-blue-50 border border-blue-100 rounded p-3 space-y-2 text-xs text-gray-700"
                    >
                      <div className="flex items-center justify-between space-x-2">
                        <input
                          className="input-field text-xs flex-1"
                          placeholder="Supplement name"
                          value={supplement.name || ''}
                          onChange={(e) => handleUpdateSupplement(idx, 'name', e.target.value)}
                        />
                        <button
                          className="text-red-400 hover:text-red-600"
                          title="Remove supplement"
                          onClick={() => handleRemoveSupplement(idx)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-field text-xs text-right"
                        placeholder="Fee"
                        value={
                          typeof supplement.fee === 'number'
                            ? supplement.fee
                            : supplement.fee === null || supplement.fee === undefined
                            ? ''
                            : parseFloat(String(supplement.fee).replace(/[^0-9.-]/g, '')) || ''
                        }
                        onChange={(e) => handleUpdateSupplement(idx, 'fee', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-900">Disbursements</h4>
                  <button
                    type="button"
                    className="btn-secondary text-xs flex items-center space-x-1"
                    onClick={handleAddDisbursement}
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="space-y-2 max-h-56 overflow-y-auto">
                  {editingDisbursements.length === 0 && (
                    <div className="text-xs text-gray-500">No disbursements added.</div>
                  )}
                  {editingDisbursements.map((disbursement, idx) => (
                    <div
                      key={`disbursement-edit-${idx}`}
                      className="bg-green-50 border border-green-100 rounded p-3 space-y-2 text-xs text-gray-700"
                    >
                      <div className="flex items-center justify-between space-x-2">
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            className="input-field text-xs flex-1"
                            placeholder="Disbursement name"
                            value={disbursement.name || ''}
                            onChange={(e) => handleUpdateDisbursement(idx, 'name', e.target.value)}
                          />
                          {(disbursement.name === 'Stamp Duty (SDLT)' || disbursement.name === 'Land Registry Fees') && (
                            <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">Auto</span>
                          )}
                        </div>
                        <button
                          className="text-red-400 hover:text-red-600"
                          title="Remove disbursement"
                          onClick={() => handleRemoveDisbursement(idx)}
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="input-field text-xs text-right"
                        placeholder="Fee"
                        value={
                          typeof disbursement.fee === 'number'
                            ? disbursement.fee
                            : disbursement.fee === null || disbursement.fee === undefined
                            ? ''
                            : parseFloat(String(disbursement.fee).replace(/[^0-9.-]/g, '')) || ''
                        }
                        onChange={(e) => handleUpdateDisbursement(idx, 'fee', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
              <button className="btn-secondary" onClick={handleCloseEditor}>
                Close
              </button>
              {!isNewQuote && (
                <button
                  className="btn-secondary flex items-center space-x-2"
                  onClick={handleOpenHistory}
                >
                  <History className="h-4 w-4" />
                  <span>History</span>
                </button>
              )}
              <button 
                className="btn-primary flex items-center space-x-2"
                onClick={handleSaveQuote}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Quote</span>
                  </>
                )}
              </button>
              {!isNewQuote && (
                <button 
                  className="btn-primary flex items-center space-x-2"
                  onClick={() => handleSendQuote()}
                >
                  <Send className="h-4 w-4" />
                  <span>Send Quote</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View modal
  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            View Quote {selectedQuote.shortCode || selectedQuote.id} - Version {selectedQuote.version}
          </h3>
          <button className="text-gray-400 hover:text-gray-600" onClick={handleCloseEditor}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="card">
            <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Quote Information
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Quote ID:</span>
                <span className="font-medium text-gray-900 text-right break-all">
                  {selectedQuote.shortCode || selectedQuote.id}
                </span>
              </div>
              {selectedQuote.hoowlaQuoteId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Hoowla Quote ID:</span>
                  <span className="font-medium text-gray-900">{selectedQuote.hoowlaQuoteId}</span>
                </div>
              )}
              {selectedQuote.totalIncVat !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount (incl. VAT):</span>
                  <span className="text-sm font-semibold text-[#011E41]">{formatCurrency(selectedQuote.totalIncVat)}</span>
                </div>
              )}
              {selectedQuote.totalExVat !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Total (excl. VAT):</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedQuote.totalExVat)}</span>
                </div>
              )}
              {selectedQuote.vatAmount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">VAT:</span>
                  <span className="font-medium text-gray-900">{formatCurrency(selectedQuote.vatAmount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Status:</span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedQuote.status)}`}>
                  {selectedQuote.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Version:</span>
                <span className="font-medium text-gray-900">{selectedQuote.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="font-medium text-gray-900">{formatDateTime(selectedQuote.createdAt)}</span>
              </div>
              {selectedQuote.validUntil && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Valid Until:</span>
                  <span className="font-medium text-gray-900">{formatDateTime(selectedQuote.validUntil)}</span>
                </div>
              )}
              {selectedQuote.sentAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Sent:</span>
                  <span className="font-medium text-gray-900">{formatDateTime(selectedQuote.sentAt)}</span>
                </div>
              )}
              {selectedQuote.acceptedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Accepted:</span>
                  <span className="font-medium text-green-600">{formatDateTime(selectedQuote.acceptedAt)}</span>
                </div>
              )}
              {selectedQuote.rejectedAt && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Rejected:</span>
                  <span className="font-medium text-red-600">{formatDateTime(selectedQuote.rejectedAt)}</span>
                </div>
              )}
              {selectedQuote.notes && (
                <div className="border-t border-gray-200 pt-2">
                  <span className="text-gray-600 block mb-1">Notes:</span>
                  <p className="text-gray-900 whitespace-pre-line">{selectedQuote.notes}</p>
                </div>
              )}
            </div>
          </div>

          {(selectedQuote.legalFeeExVat !== undefined || selectedQuote.legalFeeIncVat !== undefined) && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Legal Fees</h4>
              <div className="space-y-2 text-sm">
                {selectedQuote.legalFeeExVat !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Legal Fee (excl. VAT):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(selectedQuote.legalFeeExVat)}</span>
                  </div>
                )}
                {selectedQuote.legalFeeIncVat !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Legal Fee (incl. VAT):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(selectedQuote.legalFeeIncVat)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(selectedQuote.totalExVat !== undefined || selectedQuote.totalIncVat !== undefined) && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Totals</h4>
              <div className="space-y-2 text-sm">
                {selectedQuote.totalExVat !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total (excl. VAT):</span>
                    <span className="font-medium text-gray-900">{formatCurrency(selectedQuote.totalExVat)}</span>
                  </div>
                )}
                {selectedQuote.totalIncVat !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-gray-900 font-semibold">Total (incl. VAT):</span>
                    <span className="text-[#011E41] font-semibold">{formatCurrency(selectedQuote.totalIncVat)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedSupplements.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Supplements ({selectedSupplements.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedSupplements.map((supplement: any, idx) => (
                  <div
                    key={`supplement-${idx}`}
                    className="flex items-center justify-between text-xs text-gray-700 bg-blue-50 p-2 rounded border border-blue-100"
                  >
                    <span className="font-medium">{supplement.name || `Supplement ${idx + 1}`}</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        typeof supplement.fee === 'string'
                          ? supplement.fee
                          : supplement.fee ?? supplement.amount
                      )}
                    </span>
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-1 italic">VAT at 20%: Auto</div>
              </div>
            </div>
          )}

          {selectedDisbursements.length > 0 && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Disbursements ({selectedDisbursements.length})
              </h4>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {selectedDisbursements.map((disbursement: any, idx) => (
                  <div
                    key={`disbursement-${idx}`}
                    className="flex items-center justify-between text-xs text-gray-700 bg-green-50 p-2 rounded border border-green-100"
                  >
                    <span className="font-medium">{disbursement.name || `Disbursement ${idx + 1}`}</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(
                        typeof disbursement.fee === 'string'
                          ? disbursement.fee
                          : disbursement.fee ?? disbursement.amount
                      )}
                    </span>
                  </div>
                ))}
                <div className="text-xs text-gray-500 mt-1 italic">Land Registry Fees: Auto</div>
              </div>
            </div>
          )}

          {shouldShowItemListFallback && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">
                Quote Items ({selectedItemsForView.length})
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {selectedItemsForView.map((item, idx) => (
                  <div key={`item-${idx}`} className="text-xs text-gray-700 bg-gray-50 p-2 rounded">
                    <div className="font-medium">{item.description || item.name || `Item ${idx + 1}`}</div>
                    {item.quantity && item.unitPrice && (
                      <div className="text-gray-500">
                        {item.quantity} × {formatCurrency(item.unitPrice)} = {formatCurrency(item.total)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {(selectedQuote.propertyAddress ||
            selectedQuote.propertyValue ||
            selectedQuote.propertyTenure ||
            selectedQuote.propertyRegion) && (
            <div className="card">
              <h4 className="text-sm font-semibold text-gray-900 mb-2">Property Information</h4>
              <div className="space-y-2 text-sm">
                {selectedQuote.propertyAddress && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Address:</span>
                    <span className="font-medium text-gray-900 text-right">{selectedQuote.propertyAddress}</span>
                  </div>
                )}
                {selectedQuote.propertyCity && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium text-gray-900">{selectedQuote.propertyCity}</span>
                  </div>
                )}
                {selectedQuote.propertyPostcode && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Postcode:</span>
                    <span className="font-medium text-gray-900">{selectedQuote.propertyPostcode}</span>
                  </div>
                )}
                {selectedQuote.propertyValue && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Property Value:</span>
                    <span className="font-medium text-gray-900">
                      £{selectedQuote.propertyValue.toLocaleString()}
                    </span>
                  </div>
                )}
                {selectedQuote.propertyTenure && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tenure:</span>
                    <span className="font-medium text-gray-900">{selectedQuote.propertyTenure}</span>
                  </div>
                )}
                {selectedQuote.propertyRegion && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Region:</span>
                    <span className="font-medium text-gray-900 capitalize">{selectedQuote.propertyRegion}</span>
                  </div>
                )}
                {selectedQuote.peopleCount && selectedQuote.peopleCount > 1 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">People in Quote:</span>
                    <span className="font-medium text-gray-900">{selectedQuote.peopleCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
            <button className="btn-secondary text-sm flex items-center space-x-1" onClick={handleCloseEditor}>
              <span>Close</span>
            </button>
            <button
              className="btn-secondary text-sm flex items-center space-x-1"
              onClick={() => handleEditQuote(selectedQuote)}
            >
              <Edit className="h-4 w-4" />
              <span>Edit Quote</span>
            </button>
            <button
              className="btn-secondary text-sm flex items-center space-x-1 disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => handleDownloadQuote(selectedQuote)}
              disabled={downloadingQuoteId === selectedQuote.id}
            >
              {downloadingQuoteId === selectedQuote.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating PDF...</span>
                </>
              ) : (
                <>
              <Download className="h-4 w-4" />
              <span>Download Quote</span>
                </>
              )}
            </button>
            {selectedQuote.status !== 'Sent' && selectedQuote.status !== 'Accepted' && (
              <button
                className="btn-primary text-sm flex items-center space-x-1"
                onClick={() => handleSendQuote()}
              >
                <Send className="h-4 w-4" />
                <span>Send Quote</span>
              </button>
            )}
            {selectedQuote.status === 'Sent' && (
              <button
                className="btn-secondary text-sm flex items-center space-x-1"
                onClick={() => handleSendQuote()}
              >
                <Send className="h-4 w-4" />
                <span>Resend Quote</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
  };

  // Pagination calculations
  const totalPages = Math.max(1, Math.ceil(totalQuotesCount / quotesPerPage));
  const startIndex = (currentPage - 1) * quotesPerPage;
  const endIndex = startIndex + quotesPerPage;
  const paginatedQuotes = quotes;
  
  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterTransactionType, filterRange]);
  
  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is less than max visible
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Near the beginning
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Near the end
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // In the middle
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="space-y-6">
      {showNotification && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div
            className={`w-full max-w-md rounded-xl shadow-2xl border ${
              notificationType === 'success'
                ? 'bg-white border-green-200'
                : 'bg-white border-red-200'
            }`}
          >
            <div className="flex items-start p-5">
              <div
                className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${
                  notificationType === 'success' ? 'bg-green-100' : 'bg-red-100'
                }`}
              >
                {notificationType === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
              <div className="ml-4 flex-1">
                <h3
                  className={`text-lg font-semibold ${
                    notificationType === 'success' ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {notificationType === 'success' ? 'Success' : 'Something went wrong'}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed ${
                    notificationType === 'success' ? 'text-gray-700' : 'text-red-700'
                  }`}
                >
                  {notificationMessage}
                </p>
              </div>
              <button
                className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowNotification(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conveyancing Quotes</h1>
          <p className="text-gray-600">Manage and track all your conveyancing quotes</p>
        </div>
        <button className="btn-primary flex items-center space-x-2" onClick={handleCreateQuoteClick}>
          <Plus className="h-5 w-5" />
          <span>Create Quote</span>
        </button>
      </div>

      {/* Pipeline totals (ALL quotes, pipeline-wide — distinct from the on-page strip below) */}
      <div className="card">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Pipeline totals</h2>
            <p className="mt-0.5 text-xs text-gray-500">Across all {pipelineTotals.total.toLocaleString()} quotes in the pipeline</p>
          </div>
          {isLoadingAllQuotes && (
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          )}
        </div>

        {pipelineTotals.total === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-400">
            {isLoadingAllQuotes ? 'Calculating pipeline totals…' : 'No quotes in the pipeline yet'}
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-xl font-bold text-gray-900">{formatCurrency(pipelineTotals.totalQuotedValue)}</div>
              <div className="mt-0.5 text-xs text-gray-600">Total quoted value</div>
            </div>
            <div className="rounded-lg bg-green-50 px-4 py-3">
              <div className="text-xl font-bold" style={{ color: '#16a34a' }}>{formatCurrency(pipelineTotals.acceptedValue)}</div>
              <div className="mt-0.5 text-xs text-gray-600">Accepted value</div>
            </div>
            <div className="rounded-lg bg-blue-50 px-4 py-3">
              <div className="text-xl font-bold" style={{ color: '#3b82f6' }}>{Math.round(pipelineTotals.acceptanceRate)}%</div>
              <div className="mt-0.5 text-xs text-gray-600">
                Acceptance rate
                <span className="block text-[11px] text-gray-400 tabular-nums">
                  {pipelineTotals.acceptedCount.toLocaleString()} of {pipelineTotals.decisionBase.toLocaleString()} sent + accepted
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-gray-50 px-4 py-3">
              <div className="text-xl font-bold text-gray-900">{formatCurrency(pipelineTotals.averageQuoteValue)}</div>
              <div className="mt-0.5 text-xs text-gray-600">Average quote value</div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
          <p className="text-gray-600">Loading quotes...</p>
        </div>
      )}

      {/* Search and Filters */}
      {!isLoading && (
        <>
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search quotes..."
                className="input-field pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <select
              className="input-field"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Rejected</option>
              <option value="Expired">Expired</option>
            </select>
            <select
              className="input-field"
              value={filterTransactionType}
              onChange={(e) => setFilterTransactionType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="Purchase">Purchase</option>
              <option value="Sale">Sale</option>
              <option value="Sale & Purchase">Sale & Purchase</option>
              <option value="Remortgage">Remortgage</option>
              <option value="Transfer of Equity">Transfer of Equity</option>
              <option value="Equity Release">Equity Release</option>
            </select>
            <select
              className="input-field"
              value={filterRange}
              onChange={(e) => setFilterRange(e.target.value as any)}
            >
              <option value="all">All Time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>
      </div>

      {/* Quote status funnel */}
      <div className="mb-6">
        <StackedDistributionBar
          title="Quote status"
          caption="Breakdown of loaded quotes by status"
          segments={[
            { label: 'Draft', count: quotes.filter((q) => q.status === 'Draft').length, color: '#94a3b8' },
            { label: 'Sent', count: quotes.filter((q) => q.status === 'Sent').length, color: '#3b82f6' },
            { label: 'Accepted', count: quotes.filter((q) => q.status === 'Accepted').length, color: '#16a34a' },
            { label: 'Rejected', count: quotes.filter((q) => q.status === 'Rejected').length, color: '#ef4444' },
            { label: 'Expired', count: quotes.filter((q) => q.status === 'Expired').length, color: '#f59e0b' },
          ]}
        />
      </div>

      {/* Quotes Table */}
      <div className="card p-0">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Quote ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider min-w-[180px]">Lead</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Updated</th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Version</th>
                <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-36 sticky right-0 bg-gray-50 z-10">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-500">
                    {quotesError || 'No quotes match the current filters.'}
                  </td>
                </tr>
              ) : paginatedQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-gray-50 group">
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-3.5 w-3.5 text-gray-400 mr-1.5 flex-shrink-0" />
                      <span
                        className="font-medium text-gray-900 text-xs truncate max-w-[80px]"
                        title={quote.shortCode || quote.id}
                      >
                        {quote.shortCode || (quote.id.length > 12 ? `${quote.id.substring(0, 12)}...` : quote.id)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 text-sm truncate" title={quote.leadName || ''}>
                        {quote.leadName || 'N/A'}
                      </div>
                      <div className="text-xs text-gray-500 truncate" title={quote.leadEmail || ''}>
                        {quote.leadEmail || ''}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900 text-sm">
                      £{quote.totalAmount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(quote.status)}`}>
                      {quote.status}
                    </span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(quote.updatedAt || quote.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500">
                    v{quote.version}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-right sticky right-0 bg-white z-10 group-hover:bg-gray-50">
                    <div className="flex justify-end space-x-1.5">
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1" 
                        title="View"
                        onClick={() => handleViewQuote(quote)}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1" 
                        title="Edit"
                        onClick={() => handleEditQuote(quote)}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {/* Split Quote button - only show for Sale & Purchase quotes */}
                      {(() => {
                        const transactionType = quote.transactionType || quote.quoteType || '';
                        const isSaleAndPurchase = transactionType === 'Sale & Purchase' || 
                                                  transactionType === 'Purchase and Sale' ||
                                                  (transactionType?.toLowerCase().includes('sale') && transactionType?.toLowerCase().includes('purchase'));
                        return isSaleAndPurchase ? (
                          <button 
                            className="text-gray-400 hover:text-blue-600 p-1" 
                            title="Split into Sale and Purchase quotes"
                            onClick={() => handleSplitQuote(quote)}
                          >
                            <Split className="h-4 w-4" />
                          </button>
                        ) : null;
                      })()}
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-60 disabled:cursor-not-allowed" 
                        title="Download"
                        onClick={() => handleDownloadQuote(quote)}
                        disabled={downloadingQuoteId === quote.id}
                      >
                        {downloadingQuoteId === quote.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#011E41]" />
                        ) : (
                        <Download className="h-4 w-4" />
                        )}
                      </button>
                      <button 
                        className="text-gray-400 hover:text-gray-600 p-1" 
                        title={quote.status === 'Sent' ? 'Resend Quote' : 'Send Quote'}
                        onClick={() => handleSendQuote(quote)}
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quote Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-900">{totalQuotesCount.toLocaleString()}</div>
          <div className="text-sm text-gray-600">Matching Quotes</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-green-600">
            £{quotes.filter(q => q.status === 'Accepted').reduce((sum, q) => sum + q.totalAmount, 0).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Accepted Value on Page</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-blue-600">
            {quotes.filter(q => q.status === 'Sent').length}
          </div>
          <div className="text-sm text-gray-600">Sent on Page</div>
        </div>
        <div className="card text-center">
          <div className="text-2xl font-bold text-gray-600">
            {quotes.length > 0 ? Math.round((quotes.filter(q => q.status === 'Accepted').length / quotes.length) * 100) : 0}%
          </div>
          <div className="text-sm text-gray-600">Page Acceptance Rate</div>
        </div>
      </div>

      {/* Pagination */}
      {totalQuotesCount > 0 && (
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
            <span className="font-medium">{Math.min(endIndex, totalQuotesCount)}</span> of{' '}
            <span className="font-medium">{totalQuotesCount}</span> results
        </div>
          <div className="flex items-center space-x-2">
              <button 
              className="btn-secondary text-sm flex items-center space-x-1"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
              </button>
            <div className="flex space-x-1">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="px-3 py-1 text-gray-500">
                    ...
                            </span>
                ) : (
                              <button 
                    key={page}
                    className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                      currentPage === page
                        ? 'bg-[#011E41] text-white font-medium'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    onClick={() => setCurrentPage(page as number)}
                  >
                    {page}
                              </button>
                )
                      ))}
                </div>
                <button 
              className="btn-secondary text-sm flex items-center space-x-1"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
                </button>
          </div>
        </div>
      )}
        </>
      )}

      {renderQuoteModal()}

      {/* Send Quote Modal */}
      {showSendModal && selectedQuote && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedQuote.status === 'Sent' ? 'Resend' : 'Send'} Quote to {selectedQuote.leadName}
            </h3>
              <button
                onClick={handleCloseSendModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input 
                  type="email" 
                  className="input-field"
                  value={sendEmailData.email}
                  onChange={(e) => setSendEmailData({ ...sendEmailData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject
                </label>
                <input 
                  type="text" 
                  className="input-field"
                  value={sendEmailData.subject}
                  onChange={(e) => setSendEmailData({ ...sendEmailData, subject: e.target.value })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Email Content
                  </label>
                  <span className="text-xs text-green-600 font-medium">
                    ✓ Professional Template
                  </span>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                  <p className="mb-2">
                    A professional, branded email template will be sent with:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>Millennium Legal branding</li>
                    <li>Complete quote breakdown</li>
                    <li>Accept Quote button</li>
                    <li>Why choose us section</li>
                    <li>Terms and conditions</li>
                  </ul>
                  {sendEmailData.message.includes('<html>') && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500 italic">
                        Custom HTML template is ready to send
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="flex-1">
                  {isGeneratingQuoteAttachment ? (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Generating quote PDF...</span>
                    </div>
                  ) : quoteAttachment ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2 text-sm text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span>Quote PDF will be attached</span>
                      </div>
                      <p className="text-xs text-gray-600">
                        {quoteAttachment.fileName}
                      </p>
                      <button
                        type="button"
                        className="btn-secondary text-xs flex items-center space-x-1 mt-1"
                        onClick={handleAttachQuote}
                        disabled={isGeneratingQuoteAttachment}
                      >
                        <X className="h-3 w-3" />
                        <span>Remove Attachment</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 mb-1">
                        Quote PDF not attached
                      </p>
                      <button
                        type="button"
                        className="btn-secondary text-sm flex items-center space-x-2"
                        onClick={handleAttachQuote}
                        disabled={isGeneratingQuoteAttachment}
                      >
                        {isGeneratingQuoteAttachment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <FileText className="h-4 w-4" />
                            <span>Attach Quote PDF</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button 
                className="btn-secondary"
                onClick={handleCloseSendModal}
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button 
                className="btn-primary flex items-center space-x-2"
                onClick={handleSendEmail}
                disabled={isSendingEmail || !sendEmailData.email}
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{selectedQuote.status === 'Sent' ? 'Resend Quote' : 'Send Quote'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && editingQuote && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/60 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quote History</h3>
                <p className="text-sm text-gray-500">
                  {editingQuote.shortCode || editingQuote.id} • {editingQuote.leadName || 'Unknown lead'}
                </p>
              </div>
              <button
                className="text-gray-400 hover:text-gray-600"
                onClick={handleHistoryClose}
                aria-label="Close history"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-4">
              {isLoadingHistory ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading quote history...
                </div>
              ) : historyRecords.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No previous versions were found for this quote yet. Versions will appear here once saved.
                </p>
              ) : (
                historyRecords.map((record) => {
                  const isCurrent = record.id === editingQuote.id;
                  return (
                    <div
                      key={record.id}
                      className={`border rounded-lg p-4 transition-colors ${
                        isCurrent ? 'border-[#401DBA]/60 bg-[#F6F5FF]' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-900">Version {record.version || 1}</span>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                record.status
                              )}`}
                            >
                              {record.status}
                            </span>
                            {isCurrent && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold text-[#401DBA] bg-[#401DBA]/10">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {record.createdAt === record.updatedAt || !record.updatedAt ? 'Created' : 'Updated'} {formatDateTime(record.updatedAt || record.createdAt)}
                          </div>
                          <div className="text-xs text-gray-600">
                            Total inc. VAT: {formatCurrency(record.totalIncVat ?? record.totalAmount)}
                          </div>
                          {record.quoteType && (
                            <div className="text-xs text-gray-500">
                              Type: {record.quoteType}
                            </div>
                          )}
                          {record.shortCode && record.shortCode !== editingQuote.shortCode && (
                            <div className="text-xs text-gray-500">
                              Quote ID: {record.shortCode}
                            </div>
                          )}
                        </div>

                        {!isCurrent && (
                          <div className="flex items-center gap-2">
                            <button
                              className="btn-secondary text-sm"
                              onClick={() => handleHistorySelect(record)}
                            >
                              Load this version
                            </button>
                          </div>
                        )}
                      </div>
                      {record.notes && (
                        <p className="text-xs text-gray-600 mt-3 border-t border-gray-100 pt-3">
                          {record.notes.length > 260 ? `${record.notes.slice(0, 260)}…` : record.notes}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
