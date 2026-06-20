import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Download,
  AlertCircle,
  BarChart3,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Target,
  X,
} from 'lucide-react';
import {
  fetchInstructionReportExportRows,
  fetchInstructionReportBreakdowns,
  fetchInstructionReportLeads,
  fetchInstructionReportSummary,
  InstructionReportBreakdown,
  InstructionReportDateBasis,
  InstructionReportLead,
  InstructionReportSummary,
} from '@/services/reportsService';
import { fetchUsers, User } from '@/services/usersService';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 50;
const UNTRACKED_LABEL = 'Untracked / legacy';
const UNTRACKED_HELPER = 'Older leads or manually created leads may not have campaign attribution.';

const SOURCE_OPTIONS = [
  'Comparison - The Move Exchange',
  'Comparison - Cheap Conveyancing',
  'Comparison - Compare Conveyancing Prices',
  'Comparison Site',
  'Hoowla',
  'Direct',
  'Referral',
];

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toStartIso = (date: string) => new Date(`${date || todayString()}T00:00:00`).toISOString();

const toEndExclusiveIso = (date: string) => {
  const value = new Date(`${date || todayString()}T00:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString();
};

const todayString = () => formatDate(new Date());

const formatDateTime = (dateString?: string) => {
  if (!dateString) return 'No date recorded';
  return new Date(dateString).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatReportDate = (dateString: string) => {
  if (!dateString) return 'selected date';
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatReportDateRange = (startDate: string, endDate: string) => {
  if (startDate && endDate && startDate === endDate) {
    return formatReportDate(startDate);
  }

  return `${formatReportDate(startDate)} to ${formatReportDate(endDate)}`;
};

const getPresetRange = (preset: string | null) => {
  const today = new Date();
  const end = new Date(today);
  const start = new Date(today);

  if (preset === 'last7') {
    start.setDate(today.getDate() - 6);
  } else if (preset === 'last30') {
    start.setDate(today.getDate() - 29);
  }

  return {
    startDate: formatDate(start),
    endDate: formatDate(end),
  };
};

const dimensionLabels: Record<string, string> = {
  credited_user: 'Credited Agent',
  source: 'CRM Source',
  utm_source: 'UTM Source',
  utm_campaign: 'Campaign',
  gad_campaignid: 'Campaign ID',
  utm_term: 'Keyword / Term',
};

const emptySummary: InstructionReportSummary = {
  totalLeads: 0,
  instructedLeads: 0,
  conversionRate: 0,
  instructionsInRange: 0,
  missingAttributionCount: 0,
  uniqueCreditedUsers: 0,
};

const displayTrackedValue = (value?: string | null) => {
  if (!value || value === 'Not captured') return UNTRACKED_LABEL;
  return value;
};

const getTrackedValueTitle = (value?: string | null) => {
  const displayValue = displayTrackedValue(value);
  return displayValue === UNTRACKED_LABEL ? UNTRACKED_HELPER : displayValue;
};

const compactAttribution = (lead: InstructionReportLead) => {
  const values = [
    lead.utmSource,
    lead.gadCampaignId && `ID ${lead.gadCampaignId}`,
    lead.utmTerm,
  ].filter(Boolean);

  return values.length > 0 ? values.join(' · ') : UNTRACKED_LABEL;
};

const compactAttributionTitle = (lead: InstructionReportLead) => {
  const value = compactAttribution(lead);
  return value === UNTRACKED_LABEL ? UNTRACKED_HELPER : value;
};

const CLOSED_CURRENT_STATUS_TERMS = [
  'cancelled',
  'closed',
  'lost',
  'gone elsewhere',
  'dead',
  'not proceeding',
  'completed',
  'archived',
];

const getClosedCurrentStatusLabel = (lead: InstructionReportLead) => {
  const stage = (lead.stage || '').trim();
  const status = (lead.status || '').trim();
  const combined = `${stage} ${status}`.toLowerCase();

  const matchedTerm = CLOSED_CURRENT_STATUS_TERMS.find((term) => combined.includes(term));
  if (!matchedTerm) return null;

  const stageMatches = stage && CLOSED_CURRENT_STATUS_TERMS.some((term) => stage.toLowerCase().includes(term));
  const statusMatches = status && CLOSED_CURRENT_STATUS_TERMS.some((term) => status.toLowerCase().includes(term));

  return stageMatches ? stage : statusMatches ? status : matchedTerm;
};

const csvEscape = (value?: string | number | null) => {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const formatCsvDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

const downloadCsv = (filename: string, csv: string) => {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const useDebouncedValue = <T,>(value: T, delayMs = 500) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
};

export const InstructionsAttributionReport: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const drilldownRef = useRef<HTMLDivElement | null>(null);
  const initialRange = getPresetRange(searchParams.get('preset'));
  const initialDrilldownDimension = searchParams.get('drilldownDimension');
  const initialDrilldownValue = searchParams.get('drilldownValue');

  const [startDate, setStartDate] = useState(searchParams.get('startDate') || initialRange.startDate);
  const [endDate, setEndDate] = useState(searchParams.get('endDate') || initialRange.endDate);
  const [dateBasis, setDateBasis] = useState<InstructionReportDateBasis>(
    (searchParams.get('dateBasis') as InstructionReportDateBasis) || 'instruction_marked'
  );
  const [creditedUserId, setCreditedUserId] = useState(searchParams.get('creditedUserId') || 'all');
  const [source, setSource] = useState(searchParams.get('source') || 'all');
  const [utmSource, setUtmSource] = useState(searchParams.get('utmSource') || '');
  const [utmCampaign, setUtmCampaign] = useState(searchParams.get('utmCampaign') || '');
  const [gadCampaignId, setGadCampaignId] = useState(searchParams.get('gadCampaignId') || '');
  const [utmTerm, setUtmTerm] = useState(searchParams.get('utmTerm') || '');
  const [page, setPage] = useState(Number(searchParams.get('page') || 1));
  const [drilldown, setDrilldown] = useState<{ dimension: string; value: string } | null>(
    initialDrilldownDimension && initialDrilldownValue
      ? { dimension: initialDrilldownDimension, value: initialDrilldownValue }
      : null
  );

  const [users, setUsers] = useState<User[]>([]);
  const [summary, setSummary] = useState<InstructionReportSummary>(emptySummary);
  const [todaySummary, setTodaySummary] = useState<InstructionReportSummary>(emptySummary);
  const [breakdowns, setBreakdowns] = useState<InstructionReportBreakdown[]>([]);
  const [leads, setLeads] = useState<InstructionReportLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const activeUsers = useMemo(
    () => users.filter((user) => user.status !== 'Inactive'),
    [users]
  );

  const debouncedUtmSource = useDebouncedValue(utmSource);
  const debouncedUtmCampaign = useDebouncedValue(utmCampaign);
  const debouncedGadCampaignId = useDebouncedValue(gadCampaignId);
  const debouncedUtmTerm = useDebouncedValue(utmTerm);

  const isDateRangeInvalid = useMemo(() => {
    if (!startDate || !endDate) return true;
    return new Date(`${startDate}T00:00:00`) > new Date(`${endDate}T00:00:00`);
  }, [endDate, startDate]);

  const rpcFilters = useMemo(() => ({
    startDate: toStartIso(startDate),
    endDate: toEndExclusiveIso(endDate),
    dateBasis,
    source,
    utmSource: debouncedUtmSource,
    utmCampaign: debouncedUtmCampaign,
    gadCampaignId: debouncedGadCampaignId,
    utmTerm: debouncedUtmTerm,
    instructionCreditUserId: creditedUserId,
  }), [
    creditedUserId,
    dateBasis,
    debouncedGadCampaignId,
    debouncedUtmCampaign,
    debouncedUtmSource,
    debouncedUtmTerm,
    endDate,
    source,
    startDate,
  ]);

  const groupedBreakdowns = useMemo(() => {
    return breakdowns.reduce<Record<string, InstructionReportBreakdown[]>>((acc, row) => {
      acc[row.dimension] = acc[row.dimension] || [];
      acc[row.dimension].push(row);
      return acc;
    }, {});
  }, [breakdowns]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isLeadCreatedView = dateBasis === 'lead_created';
  const selectedDateRangeLabel = useMemo(
    () => formatReportDateRange(startDate, endDate),
    [endDate, startDate]
  );
  const userFilterLabel = isLeadCreatedView ? 'Agent / Assigned User' : 'Credited User';
  const allUserFilterLabel = isLeadCreatedView ? 'All agents / assigned users' : 'All credited users';
  const dateBasisSummary = isLeadCreatedView
    ? 'Lead Conversion: leads created in the selected date range, with later instructions counted for conversion.'
    : 'Operational View: instructions marked in the selected date range, grouped by attribution.';
  const instructionUnitHelper = 'Sale + Purchase instructions count as 2 reporting units. Lead lists still show each lead once.';
  const firstBreakdownCountLabel = isLeadCreatedView ? 'Leads' : 'Instructions';
  const sourceBreakdownTitle = isLeadCreatedView ? 'CRM Source Conversion' : 'Instructions by CRM Source';
  const attributionBreakdownTitle = isLeadCreatedView ? 'Attribution Conversion' : 'Instructions by Attribution';
  const summaryCards = isLeadCreatedView
    ? [
        {
          label: 'Leads Created',
          value: summary.totalLeads,
          helper: 'Lead volume in the selected date range',
        },
        {
          label: 'Instructions from These Leads',
          value: summary.instructedLeads,
          helper: 'Instruction units credited from those leads',
        },
        {
          label: 'Lead-to-Instruction Conversion',
          value: `${summary.conversionRate.toFixed(1)}%`,
          helper: 'Conversion for leads created in range',
        },
        {
          label: "Today's Instructions",
          value: todaySummary.instructionsInRange,
          helper: 'Instructions marked today',
        },
        {
          label: 'Missing Attribution',
          value: summary.missingAttributionCount,
          helper: 'Untracked or legacy leads',
        },
      ]
    : [
        {
          label: 'Total Instructions',
          value: summary.instructionsInRange,
          helper: 'Instruction units in range',
        },
        {
          label: 'Agents Credited',
          value: summary.uniqueCreditedUsers,
          helper: 'Credited users in this view',
        },
        {
          label: "Today's Instructions",
          value: todaySummary.instructionsInRange,
          helper: 'Instructions marked today',
        },
        {
          label: 'Missing Attribution',
          value: summary.missingAttributionCount,
          helper: 'Untracked or legacy leads',
        },
      ];
  const sourceOptions = useMemo(() => {
    const dynamicSources = (groupedBreakdowns.source || [])
      .map((row) => row.dimensionValue)
      .filter((value) => value && value !== 'Not captured' && value !== UNTRACKED_LABEL);

    const selectedSource = source && source !== 'all' ? [source] : [];
    return Array.from(new Set([...selectedSource, ...dynamicSources, ...SOURCE_OPTIONS])).sort((a, b) => a.localeCompare(b));
  }, [groupedBreakdowns.source, source]);

  useEffect(() => {
    fetchUsers().then(setUsers).catch((err) => {
      console.error('Error loading users for instruction report:', err);
    });
  }, []);

  const loadData = useCallback(async () => {
    if (isDateRangeInvalid) {
      setIsLoading(false);
      setError('Start date must be on or before end date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const today = todayString();
      const todayFilters = {
        ...rpcFilters,
        startDate: toStartIso(today),
        endDate: toEndExclusiveIso(today),
        dateBasis: 'instruction_marked' as InstructionReportDateBasis,
      };

      const [summaryResult, todayResult, breakdownResults, leadResults] = await Promise.all([
        fetchInstructionReportSummary(rpcFilters),
        fetchInstructionReportSummary(todayFilters),
        fetchInstructionReportBreakdowns(rpcFilters),
        fetchInstructionReportLeads({
          ...rpcFilters,
          dimension: drilldown?.dimension || null,
          dimensionValue: drilldown?.value || null,
          page,
          pageSize: PAGE_SIZE,
        }),
      ]);

      setSummary(summaryResult);
      setTodaySummary(todayResult);
      setBreakdowns(breakdownResults);
      setLeads(leadResults.leads);
      setTotalCount(leadResults.totalCount);
    } catch (err) {
      console.error('Error loading instruction report:', err);
      setError('Unable to load instruction report. Confirm the Step 7A reporting RPC migration has been applied.');
      setSummary(emptySummary);
      setTodaySummary(emptySummary);
      setBreakdowns([]);
      setLeads([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [drilldown?.dimension, drilldown?.value, isDateRangeInvalid, page, rpcFilters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const current = {
      startDate: searchParams.get('startDate') || '',
      endDate: searchParams.get('endDate') || '',
      dateBasis: searchParams.get('dateBasis') || '',
      creditedUserId: searchParams.get('creditedUserId') || 'all',
      source: searchParams.get('source') || 'all',
      utmSource: searchParams.get('utmSource') || '',
      utmCampaign: searchParams.get('utmCampaign') || '',
      gadCampaignId: searchParams.get('gadCampaignId') || '',
      utmTerm: searchParams.get('utmTerm') || '',
      page: searchParams.get('page') || '1',
      drilldownDimension: searchParams.get('drilldownDimension') || '',
      drilldownValue: searchParams.get('drilldownValue') || '',
    };

    if (
      current.startDate === startDate &&
      current.endDate === endDate &&
      current.dateBasis === dateBasis &&
      current.creditedUserId === creditedUserId &&
      current.source === source &&
      current.utmSource === utmSource &&
      current.utmCampaign === utmCampaign &&
      current.gadCampaignId === gadCampaignId &&
      current.utmTerm === utmTerm &&
      current.page === String(page) &&
      current.drilldownDimension === (drilldown?.dimension || '') &&
      current.drilldownValue === (drilldown?.value || '')
    ) {
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('startDate', startDate);
    next.set('endDate', endDate);
    next.set('dateBasis', dateBasis);
    next.set('page', String(page));

    const optionalParams = {
      creditedUserId,
      source,
      utmSource,
      utmCampaign,
      gadCampaignId,
      utmTerm,
      drilldownDimension: drilldown?.dimension || '',
      drilldownValue: drilldown?.value || '',
    };

    Object.entries(optionalParams).forEach(([key, value]) => {
      if (!value || value === 'all') {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    });

    setSearchParams(next, { replace: true });
  }, [
    creditedUserId,
    dateBasis,
    drilldown?.dimension,
    drilldown?.value,
    endDate,
    gadCampaignId,
    page,
    searchParams,
    setSearchParams,
    source,
    startDate,
    utmCampaign,
    utmSource,
    utmTerm,
  ]);

  const resetPageAndDrilldown = () => {
    setPage(1);
    setDrilldown(null);
  };

  const openLead = (leadId: string) => {
    navigate(`/lead-management?leadId=${leadId}`);
  };

  const selectBreakdown = (row: InstructionReportBreakdown) => {
    setDrilldown({ dimension: row.dimension, value: row.dimensionValue });
    setPage(1);
    window.setTimeout(() => {
      drilldownRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const clearDrilldown = () => {
    setDrilldown(null);
    setPage(1);
  };

  const handleExportCsv = async () => {
    if (isDateRangeInvalid) {
      setExportMessage({ type: 'error', text: 'Choose a valid date range before exporting.' });
      return;
    }

    if (user?.role !== 'Admin' && user?.role !== 'Manager') {
      setExportMessage({ type: 'error', text: 'Only Admin and Manager users can export this report.' });
      return;
    }

    setIsExporting(true);
    setExportMessage(null);

    try {
      const { rows, totalCount, exportLimit, isCapped } = await fetchInstructionReportExportRows({
        ...rpcFilters,
        dimension: drilldown?.dimension || null,
        dimensionValue: drilldown?.value || null,
        limit: 10000,
      });

      if (rows.length === 0) {
        setExportMessage({ type: 'error', text: 'No matching rows found for this export.' });
        return;
      }

      const headers = [
        'Lead name',
        'Email',
        'Phone',
        'Created date',
        'Instruction date',
        'Credited user',
        'Marked by',
        'Instruction units',
        'CRM source',
        'UTM source',
        'Campaign',
        'Campaign ID',
        'Keyword/search term',
        'CLICKID',
        'Click ID Type',
        'MSCLKID',
        'GCLID',
        'GBRAID',
        'WBRAID',
        'Stage',
        'Status',
        'Current status note',
        'Comparison lead ID',
        'Lead ID',
      ];

      const lines = rows.map((row) => [
        row.leadName,
        row.email,
        row.phone,
        formatCsvDate(row.createdAt),
        formatCsvDate(row.manualInstructedAt),
        row.instructionCreditUserName,
        row.manualInstructedByName,
        row.instructionWeight,
        row.source,
        row.utmSource,
        row.utmCampaign,
        row.gadCampaignId,
        row.utmTerm,
        row.clickId,
        row.clickIdType,
        row.msclkid,
        row.gclid,
        row.gbraid,
        row.wbraid,
        row.stage,
        row.status,
        row.currentStatusNote,
        row.comparisonLeadId,
        row.leadId,
      ].map(csvEscape).join(','));

      const csv = [headers.map(csvEscape).join(','), ...lines].join('\r\n');
      downloadCsv(`instructions-attribution-${startDate}-to-${endDate}.csv`, csv);
      setExportMessage({
        type: isCapped ? 'error' : 'success',
        text: isCapped
          ? `Export downloaded, capped at ${exportLimit.toLocaleString()} of ${totalCount.toLocaleString()} matching rows.`
          : `Export downloaded with ${rows.length.toLocaleString()} matching rows.`,
      });
    } catch (err) {
      console.error('Error exporting instruction report:', err);
      setExportMessage({ type: 'error', text: 'Unable to export CSV. Confirm the Step 7B export RPC migration has been applied.' });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDateBasisChange = (nextDateBasis: InstructionReportDateBasis) => {
    setDateBasis(nextDateBasis);
    resetPageAndDrilldown();
  };

  const renderBreakdownTable = (title: string, dimension: string, options?: { attribution?: boolean }) => {
    const rows = groupedBreakdowns[dimension] || [];
    return (
      <div className="card min-w-0 overflow-hidden">
        <div className="border-b border-gray-200 pb-3">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        </div>
        {rows.length === 0 ? (
          <p className="py-6 text-sm text-gray-500">No data for this breakdown.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
            <table className="min-w-[26rem] w-full table-fixed divide-y divide-gray-200 text-sm">
              <colgroup>
                <col className={isLeadCreatedView ? 'w-[46%]' : 'w-[64%]'} />
                <col className={isLeadCreatedView ? 'w-[15%]' : 'w-[20%]'} />
                {isLeadCreatedView && <col className="w-[18%]" />}
                {isLeadCreatedView && <col className="w-[21%]" />}
                {options?.attribution && <col className="hidden w-[16%] 2xl:table-column" />}
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600 sm:px-3">Value</th>
                  <th className="px-2 py-2 text-right font-medium text-gray-600 sm:px-3" title={firstBreakdownCountLabel}>{firstBreakdownCountLabel}</th>
                  {isLeadCreatedView && (
                    <th className="px-2 py-2 text-right font-medium text-gray-600 sm:px-3" title="Instructions">Instr.</th>
                  )}
                  {isLeadCreatedView && (
                    <th className="px-2 py-2 text-right font-medium text-gray-600 sm:px-3" title="Conversion">Conv.</th>
                  )}
                  {options?.attribution && (
                    <th className="hidden px-2 py-2 text-right font-medium text-gray-600 sm:px-3 2xl:table-cell">Untracked</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {rows.slice(0, 10).map((row) => (
                  <tr
                    key={`${row.dimension}-${row.dimensionValue}`}
                    className={`cursor-pointer transition-colors ${
                      drilldown?.dimension === row.dimension && drilldown.value === row.dimensionValue
                        ? 'bg-emerald-50 ring-1 ring-inset ring-emerald-200'
                        : 'hover:bg-emerald-50/60'
                    }`}
                    onClick={() => selectBreakdown(row)}
                  >
                    <td className="px-2 py-2 sm:px-3">
                      <div className="break-words font-medium leading-snug text-gray-900" title={getTrackedValueTitle(row.dimensionValue)}>
                        {displayTrackedValue(row.dimensionValue)}
                      </div>
                      <div className="mt-0.5 text-xs font-medium text-emerald-700">View leads</div>
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900 sm:px-3">
                      {isLeadCreatedView ? row.totalLeads : row.instructedLeads}
                    </td>
                    {isLeadCreatedView && (
                      <td className="px-2 py-2 text-right text-gray-900 sm:px-3">{row.instructedLeads}</td>
                    )}
                    {isLeadCreatedView && (
                      <td className="px-2 py-2 text-right text-gray-700 sm:px-3">{row.conversionRate.toFixed(1)}%</td>
                    )}
                    {options?.attribution && (
                      <td className="hidden px-2 py-2 text-right text-gray-700 sm:px-3 2xl:table-cell">{row.missingAttributionCount}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Instructions & Attribution</h1>
          <p className="text-gray-600">
            Track instruction dates, credited agents, sources, campaigns, and keywords.
          </p>
        </div>
        <button
          type="button"
          disabled={isExporting || isDateRangeInvalid || (user?.role !== 'Admin' && user?.role !== 'Manager')}
          title={user?.role !== 'Admin' && user?.role !== 'Manager' ? 'Only Admin and Manager users can export' : 'Export CSV'}
          className="btn-secondary flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          onClick={handleExportCsv}
        >
          {isExporting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
          <span>{isExporting ? 'Preparing export...' : 'Export CSV'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => handleDateBasisChange('instruction_marked')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            !isLeadCreatedView
              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 ring-1 ring-emerald-200'
              : 'border-gray-200 bg-white text-gray-700 hover:border-emerald-200 hover:bg-emerald-50/50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Operational View</span>
            {!isLeadCreatedView && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">Active</span>}
          </div>
          <p className="mt-1 text-sm">Instructions marked</p>
          <p className="mt-1 text-xs opacity-80">Shows what was instructed during the selected date range.</p>
        </button>
        <button
          type="button"
          onClick={() => handleDateBasisChange('lead_created')}
          className={`rounded-lg border px-4 py-3 text-left transition-colors ${
            isLeadCreatedView
              ? 'border-blue-300 bg-blue-50 text-blue-950 ring-1 ring-blue-200'
              : 'border-gray-200 bg-white text-gray-700 hover:border-blue-200 hover:bg-blue-50/50'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold">Conversion View</span>
            {isLeadCreatedView && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">Active</span>}
          </div>
          <p className="mt-1 text-sm">Leads created</p>
          <p className="mt-1 text-xs opacity-80">Use this for keyword, campaign, and source conversion rates.</p>
        </button>
      </div>

      <div className="card">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              className="input-field"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                resetPageAndDrilldown();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              className="input-field"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                resetPageAndDrilldown();
              }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Date Basis</label>
            <select
              className="input-field"
              value={dateBasis}
              onChange={(event) => handleDateBasisChange(event.target.value as InstructionReportDateBasis)}
            >
              <option value="instruction_marked">Instructions Marked</option>
              <option value="lead_created">Lead Conversion</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Instructions Marked = what was instructed during the date range. Lead Conversion = leads created in the range and which converted.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">{userFilterLabel}</label>
            <select
              className="input-field"
              value={creditedUserId}
              onChange={(event) => {
                setCreditedUserId(event.target.value);
                resetPageAndDrilldown();
              }}
            >
              <option value="all">{allUserFilterLabel}</option>
              {activeUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {isLeadCreatedView
                ? 'Uses current assigned user for the lead denominator v1; instructed counts are credited-user based.'
                : 'Filters instructions by the user credited at instruction time.'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">CRM Source</label>
            <select
              className="input-field"
              value={source}
              onChange={(event) => {
                setSource(event.target.value);
                resetPageAndDrilldown();
              }}
            >
              <option value="all">All sources</option>
              {sourceOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">UTM Source</label>
            <input
              className="input-field"
              value={utmSource}
              onChange={(event) => {
                setUtmSource(event.target.value);
                resetPageAndDrilldown();
              }}
              placeholder="google, bing..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Campaign</label>
            <input
              className="input-field"
              value={utmCampaign}
              onChange={(event) => {
                setUtmCampaign(event.target.value);
                resetPageAndDrilldown();
              }}
              placeholder="Campaign name/id"
            />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Campaign ID</label>
            <input
              className="input-field"
              value={gadCampaignId}
              onChange={(event) => {
                setGadCampaignId(event.target.value);
                resetPageAndDrilldown();
              }}
              placeholder="gad_campaignid"
            />
          </div>
          <div className="md:col-span-2 xl:col-span-4">
            <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 mb-1">Keyword / Search Term</label>
            <input
              className="input-field"
              value={utmTerm}
              onChange={(event) => {
                setUtmTerm(event.target.value);
                resetPageAndDrilldown();
              }}
              placeholder="house sale solicitor..."
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="card bg-red-50 border border-red-200">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {exportMessage && (
        <div className={`card border ${
          exportMessage.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-center gap-2">
            {exportMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span>{exportMessage.text}</span>
          </div>
        </div>
      )}

      <div className={`rounded-lg border px-4 py-3 text-sm ${
        isLeadCreatedView
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-emerald-200 bg-emerald-50 text-emerald-900'
        }`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="font-medium">{dateBasisSummary}</p>
            <p className="mt-1">
              {isLeadCreatedView
                ? `Use this to compare keyword, campaign, and source conversion rates for leads created on ${selectedDateRangeLabel}.`
                : `This shows only instructions marked on ${selectedDateRangeLabel}. For leads, instructions, and conversion rate by source or keyword, use Lead Conversion.`}
            </p>
            <p className="mt-1 text-xs font-medium opacity-80">{instructionUnitHelper}</p>
          </div>
          {!isLeadCreatedView && (
            <button
              type="button"
              className="self-start rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 lg:self-center"
              onClick={() => handleDateBasisChange('lead_created')}
            >
              Switch to Lead Conversion
            </button>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${isLeadCreatedView ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {summaryCards.map((card) => (
          <div className="card" key={card.label}>
            <p className="text-sm font-medium text-gray-600">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.helper}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {renderBreakdownTable('Instructions by Credited Agent', 'credited_user')}
        {renderBreakdownTable(sourceBreakdownTitle, 'source')}
      </div>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{attributionBreakdownTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {isLeadCreatedView
              ? `These tables show total leads, instructions, and conversion rate for each source, campaign, campaign ID, and keyword. Older leads or manually created leads may show as ${UNTRACKED_LABEL}.`
              : `These tables show where the instructions marked in the selected range came from. They do not show total lead volume or conversion rate in this mode.`}
          </p>
          {!isLeadCreatedView && (
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-blue-700 hover:text-blue-900"
              onClick={() => handleDateBasisChange('lead_created')}
            >
              Need leads + instructions + conversion rate? Switch to Lead Conversion.
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {renderBreakdownTable('UTM Source', 'utm_source', { attribution: true })}
          {renderBreakdownTable('Campaign', 'utm_campaign', { attribution: true })}
          {renderBreakdownTable('Campaign ID', 'gad_campaignid', { attribution: true })}
          {renderBreakdownTable('Keyword', 'utm_term', { attribution: true })}
        </div>
      </div>

      <div ref={drilldownRef} className="card scroll-mt-6 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
              Drill-down Leads
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {drilldown
                ? `Showing leads for ${dimensionLabels[drilldown.dimension] || drilldown.dimension}: ${displayTrackedValue(drilldown.value)}.`
                : dateBasis === 'instruction_marked'
                ? 'Operational View: filtering by instructions marked in the date range. Click a breakdown row above to focus this list.'
                : 'Conversion View: filtering by leads created in the date range and counting later manual instructions. Click a breakdown row above to focus this list.'}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              This report shows leads marked instructed during the selected date range. Current Status shows where the lead is now.
              If an instruction should no longer count, use Reverse Instruction rather than changing the lead status only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {drilldown && (
              <button
                type="button"
                className="btn-secondary flex items-center gap-2 text-sm"
                onClick={clearDrilldown}
              >
                <Target className="h-4 w-4" />
                <span className="max-w-[18rem] truncate">
                  Clear drill-down
                </span>
                <X className="h-4 w-4" />
              </button>
            )}
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading...</span>
              </div>
            )}
          </div>
        </div>

        {leads.length === 0 && !isLoading ? (
          <div className="py-10 text-center">
            <CheckCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No leads found for this report view.</p>
          </div>
        ) : (
          <div className="-mx-3 overflow-x-auto sm:mx-0">
            <table className="min-w-[52rem] w-full table-fixed divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="w-[27%] px-3 py-2 text-left font-medium text-gray-600">Lead</th>
                  <th className="w-[18%] px-3 py-2 text-left font-medium text-gray-600">Instruction</th>
                  <th className="w-[18%] px-3 py-2 text-left font-medium text-gray-600">Credit</th>
                  <th className="w-[23%] px-3 py-2 text-left font-medium text-gray-600">Source / Campaign</th>
                  <th className="w-[14%] px-3 py-2 text-left font-medium text-gray-600">Current Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {leads.map((lead) => {
                  const closedCurrentStatusLabel = getClosedCurrentStatusLabel(lead);

                  return (
                    <tr
                      key={lead.id}
                      className="cursor-pointer hover:bg-emerald-50/60"
                      onClick={() => openLead(lead.id)}
                    >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        className="block max-w-full truncate text-left font-semibold text-navy-700 hover:text-navy-900 hover:underline"
                        title="Open lead"
                        onClick={(event) => {
                          event.stopPropagation();
                          openLead(lead.id);
                        }}
                      >
                        {lead.name}
                      </button>
                      <div className="mt-1 truncate text-xs text-gray-600" title={lead.email}>
                        {lead.email || 'No email'}
                      </div>
                      <div className="truncate text-xs text-gray-500" title={lead.phone}>
                        {lead.phone || 'No phone'}
                      </div>
                      {lead.instructionWeight > 1 && (
                        <div className="mt-2 inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-800 ring-1 ring-inset ring-purple-200">
                          Counts as {lead.instructionWeight}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="whitespace-nowrap text-gray-900">{formatDateTime(lead.manualInstructedAt)}</div>
                      <div className="mt-1 text-xs text-gray-500">Created {formatDateTime(lead.createdAt)}</div>
                      <div className="mt-1 text-xs font-medium text-gray-700">
                        {lead.instructionWeight} instruction unit{lead.instructionWeight === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="truncate text-gray-900" title={lead.instructionCreditUserName || 'Uncredited'}>
                        {lead.instructionCreditUserName || 'Uncredited'}
                      </div>
                      <div className="mt-1 truncate text-xs text-gray-500" title={lead.manualInstructedByName || 'Unknown'}>
                        Marked by {lead.manualInstructedByName || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="truncate text-gray-900" title={getTrackedValueTitle(lead.source)}>
                        {displayTrackedValue(lead.source)}
                      </div>
                      <div
                        className="mt-1 truncate text-xs text-gray-500"
                        title={compactAttributionTitle(lead)}
                      >
                        {compactAttribution(lead)}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="truncate text-gray-900" title={lead.stage || 'Unknown'}>{lead.stage || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{lead.status || 'Unknown'}</div>
                      {closedCurrentStatusLabel && (
                        <div
                          className="mt-2 inline-flex max-w-full items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-200"
                          title={`Current status: ${closedCurrentStatusLabel}`}
                        >
                          <span className="truncate">Current: {closedCurrentStatusLabel}</span>
                        </div>
                      )}
                      <button
                        type="button"
                        className="mt-2 block text-xs font-medium text-navy-700 hover:text-navy-900 hover:underline"
                        onClick={(event) => {
                          event.stopPropagation();
                          openLead(lead.id);
                        }}
                      >
                        Open Lead
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-1 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-600">
            Showing {totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-50"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn-secondary flex items-center gap-1 text-sm disabled:opacity-50"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
