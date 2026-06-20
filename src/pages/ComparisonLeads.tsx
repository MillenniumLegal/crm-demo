import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, Users, Building2, RefreshCw,
  ChevronDown, ChevronUp, Phone, Mail, Search, Calendar,
  Filter, Loader2, AlertCircle, Eye, X,
  FileText, CheckCircle, Trash2, Download,
  PhoneCall, ExternalLink, User, ArrowLeft, Home
} from 'lucide-react';
import jsPDF from 'jspdf';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ComparisonLead {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  transaction_type: string;
  property_value: number;
  property_type: string;
  property_region: string;
  property_postcode: string;
  property_address: string;
  is_mortgaged: boolean;
  is_first_time_buyer: boolean;
  is_new_build: boolean;
  is_leasehold: boolean;
  selected_firm_id: string | null;
  selected_firm_name: string | null;
  quote_breakdown: Record<string, unknown> | null;
  status: string;
  source: string;
  site_id?: string | null;
  referrer: string;
  utm_source: string;
  utm_medium?: string | null;
  utm_campaign: string;
  utm_term?: string | null;
  utm_content?: string | null;
  gad_source?: string | null;
  gad_campaignid?: string | null;
  gclid?: string | null;
  msclkid?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  landing_page?: string | null;
  attribution_captured_at?: string | null;
  raw_attribution_json?: Record<string, unknown> | null;
  created_at: string;
}

interface SiteCount {
  siteId: string;
  count: number;
}

interface FirmStats {
  firmId: string;
  firmName: string;
  totalLeads: number;
  todayLeads: number;
  pushedLeads: number;
  callbackLeads: number;
  newLeads: number;
  soldLeads: number;
  failedLeads: number;
  avgQuoteValue: number;
  totalRevenue: number;
  dailyBreakdown: Record<string, number>;
  appearances: number;
  siteBreakdown: SiteCount[];
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  quoted: { label: 'Quoted', bg: 'bg-gray-100', text: 'text-gray-700' },
  new: { label: 'New', bg: 'bg-blue-100', text: 'text-blue-800' },
  pushed: { label: 'Pushed', bg: 'bg-green-100', text: 'text-green-800' },
  sold: { label: 'Sold', bg: 'bg-purple-100', text: 'text-purple-800' },
  failed: { label: 'Failed', bg: 'bg-red-100', text: 'text-red-800' },
};

const TX_TYPE_CONFIG: Record<string, { bg: string; text: string }> = {
  'Purchase': { bg: 'bg-blue-50', text: 'text-blue-700' },
  'Sale': { bg: 'bg-green-50', text: 'text-green-700' },
  'Sale & Purchase': { bg: 'bg-purple-50', text: 'text-purple-700' },
  'Remortgage': { bg: 'bg-orange-50', text: 'text-orange-700' },
};

const SITE_LABELS: Record<string, string> = {
  cheapconveyancing: 'Cheap Conveyancing',
  themoveexchange: 'The Move Exchange',
  compareconveyancingprices: 'Compare Conveyancing Prices',
};

// ─── Component ──────────────────────────────────────────────────────────────

const fmtDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const toUtcIsoFromLocalDateStart = (dateYmd: string) => {
  const localStart = new Date(`${dateYmd}T00:00:00`);
  return localStart.toISOString();
};

const toUtcIsoFromNextLocalDateStart = (dateYmd: string) => {
  const localNextStart = new Date(`${dateYmd}T00:00:00`);
  localNextStart.setDate(localNextStart.getDate() + 1);
  return localNextStart.toISOString();
};

const sanitizeComparisonSearch = (value: string) =>
  value
    .replace(/[,%()']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const uniqueSearchValues = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean)));

const buildPhoneSearchTerms = (search: string) => {
  const digits = search.replace(/\D/g, '');
  if (digits.length < 4) return [];

  const variants = [digits];
  if (digits.startsWith('0') && digits.length > 6) variants.push(`44${digits.slice(1)}`);
  if (digits.startsWith('44') && digits.length > 6) variants.push(`0${digits.slice(2)}`);
  if (digits.length >= 7) variants.push(digits.slice(-7));
  return uniqueSearchValues(variants);
};

// Apply the status dropdown to a comparison_leads query. 'callback' / 'instruction'
// filter on the quote_breakdown JSON flags; other values filter the status column.
const applyComparisonStatusFilter = (q: any, statusFilter: string) => {
  if (statusFilter === 'callback') return q.eq('quote_breakdown->>callbackRequested', 'true');
  if (statusFilter === 'instruction') return q.eq('quote_breakdown->>instructionRequested', 'true');
  if (statusFilter !== 'all') return q.eq('status', statusFilter);
  return q;
};

const buildComparisonLeadSearchFilter = (value: string) => {
  const search = sanitizeComparisonSearch(value);
  if (!search) return '';

  const tokens = search.split(' ').filter(Boolean);
  const textTerms = uniqueSearchValues([search, search.toLowerCase(), search.replace(/\s+/g, '')]);
  const nameTerms = uniqueSearchValues([...textTerms, ...tokens]);

  const conditions = [
    ...nameTerms.flatMap(term => [
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
    ]),
    ...textTerms.flatMap(term => [
      `email.ilike.%${term}%`,
      `selected_firm_name.ilike.%${term}%`,
      `property_postcode.ilike.%${term}%`,
    ]),
    ...buildPhoneSearchTerms(search).map(term => `phone.ilike.%${term}%`),
  ];

  return uniqueSearchValues(conditions).join(',');
};

type RangePreset = 'today' | 'yesterday' | 'last7' | 'last30' | 'custom';

function computePresetRange(preset: Exclude<RangePreset, 'custom'>) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (preset === 'today') return { start: fmtDate(now), end: fmtDate(now) };
  if (preset === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { start: fmtDate(y), end: fmtDate(y) };
  }
  const end = new Date(now);
  const start = new Date(now);
  start.setDate(start.getDate() - (preset === 'last7' ? 6 : 29));
  return { start: fmtDate(start), end: fmtDate(end) };
}

export const ComparisonLeads: React.FC = () => {
  const { user } = useAuth();
  const canViewAttribution = user?.role === 'Admin' || user?.role === 'Manager';
  const LEADS_PER_PAGE = 24;
  const [leads, setLeads] = useState<ComparisonLead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [quotedCount, setQuotedCount] = useState(0);
  const [newCount, setNewCount] = useState(0);
  const [callbacksCount, setCallbacksCount] = useState(0);
  const [totalFilteredCount, setTotalFilteredCount] = useState(0);
  const [firmStats, setFirmStats] = useState<FirmStats[]>([]);
  const [activeFirmNamesById, setActiveFirmNamesById] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [rangePreset, setRangePreset] = useState<RangePreset>('last30');
  const [range, setRange] = useState(() => computePresetRange('last30'));
  const [selectedLead, setSelectedLead] = useState<ComparisonLead | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [deletingLead, setDeletingLead] = useState<string | null>(null);
  const [showFirmRankings, setShowFirmRankings] = useState(true);
  const [firmFilter, setFirmFilter] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [selectedFirmDetail, setSelectedFirmDetail] = useState<FirmStats | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [siteCountMap, setSiteCountMap] = useState<Record<string, number>>({});
  const [exportingLeads, setExportingLeads] = useState(false);
  const [showAttributionDetails, setShowAttributionDetails] = useState(false);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(v);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const getSiteLabel = (siteId?: string | null) => {
    if (!siteId) return 'Unknown Site';
    return SITE_LABELS[siteId] || siteId;
  };

  const hasTrackingValue = (value?: string | null): value is string =>
    typeof value === 'string' && value.trim().length > 0;

  const formatTrackingDateTime = (value?: string | null) => {
    if (!hasTrackingValue(value)) return 'Not captured';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderAttributionField = (label: string, value?: string | null, options: { long?: boolean; date?: boolean } = {}) => {
    const displayValue = options.date ? formatTrackingDateTime(value) : (hasTrackingValue(value) ? value.trim() : 'Not captured');
    return (
      <div className="flex items-start justify-between gap-3 py-2 border-b border-gray-100 last:border-b-0">
        <span className="text-sm text-gray-600 flex-shrink-0">{label}:</span>
        <span
          className={`text-sm font-medium ${hasTrackingValue(value) || options.date ? 'text-gray-900' : 'text-gray-400'} ${options.long ? 'break-all' : 'truncate'} max-w-[28rem] text-right`}
          title={displayValue}
        >
          {displayValue}
        </span>
      </div>
    );
  };

  const getAttributionCapturedCount = (lead: ComparisonLead) => {
    return [
      lead.utm_source,
      lead.utm_medium,
      lead.utm_campaign,
      lead.utm_term,
      lead.utm_content,
      lead.gad_source,
      lead.gad_campaignid,
      lead.gclid,
      lead.gbraid,
      lead.wbraid,
      lead.msclkid,
      lead.landing_page,
      lead.referrer,
      lead.attribution_captured_at,
    ].filter(hasTrackingValue).length;
  };

  const formatWhereThingsUpTo = (value: string): string => {
    const map: Record<string, string> = {
      sale_not_on_market:          "Haven't put house on market",
      sale_on_market_no_offer:     "On market, no offer yet",
      sale_offer_accepted:         "Offer accepted (sale)",
      purchase_not_searching:      "Not searching yet",
      purchase_searching:          "Looking for property",
      purchase_offer_accepted:     "Offer accepted (purchase)",
    };
    return map[value] || value;
  };

  const getAge = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const applyPreset = useCallback((preset: Exclude<RangePreset, 'custom'>) => {
    setRangePreset(preset);
    setRange(computePresetRange(preset));
  }, []);

  const handleCustomRange = useCallback((field: 'start' | 'end', value: string) => {
    setRangePreset('custom');
    setRange(prev => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    setShowAttributionDetails(false);
  }, [selectedLead?.id]);

  const KNOWN_SITES = ['cheapconveyancing', 'themoveexchange', 'compareconveyancingprices'];

  const PDF_COLORS = {
    navy: [1, 30, 65] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    lightGray: [248, 248, 249] as [number, number, number],
    darkText: [31, 41, 55] as [number, number, number],
    mediumGray: [107, 114, 128] as [number, number, number],
    border: [229, 231, 235] as [number, number, number],
  };

  const drawPdfTable = (
    doc: jsPDF,
    startY: number,
    headers: string[],
    rows: string[][],
    colWidths: number[],
    opts?: { fontSize?: number }
  ): number => {
    const fs = opts?.fontSize ?? 7;
    const rowH = 7;
    const headerH = 8;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const marginL = 14;
    let y = startY;

    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(marginL, y, pageW - 28, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fs);
    doc.setTextColor(...PDF_COLORS.white);
    let x = marginL + 2;
    headers.forEach((h, i) => {
      doc.text(h, x, y + 5.5);
      x += colWidths[i];
    });
    y += headerH;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fs);
    rows.forEach((row, rIdx) => {
      if (y + rowH > pageH - 15) {
        doc.addPage();
        y = 14;
      }
      if (rIdx % 2 === 0) {
        doc.setFillColor(...PDF_COLORS.lightGray);
        doc.rect(marginL, y, pageW - 28, rowH, 'F');
      }
      doc.setTextColor(...PDF_COLORS.darkText);
      x = marginL + 2;
      row.forEach((cell, i) => {
        const cellText = doc.splitTextToSize(cell, colWidths[i] - 3);
        doc.text(cellText[0] || '', x, y + 5);
        x += colWidths[i];
      });
      y += rowH;
    });
    return y;
  };

  const exportFirmSummary = () => {
    if (firmStats.length === 0) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    doc.setFillColor(...PDF_COLORS.navy);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...PDF_COLORS.white);
    doc.text('Comparison Leads — Firm Summary', 14, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`${range.start} to ${range.end}  |  Total leads: ${totalCount}`, 14, 20);

    const siteAbbrs = KNOWN_SITES.map(s => getSiteLabel(s));
    const headers = ['#', 'Firm', 'Total', ...siteAbbrs, 'Today', 'New', 'Callbacks', 'Appeared', 'Avg Quote', 'Revenue'];
    const colWidths = [8, 52, 14, 28, 28, 34, 14, 12, 18, 18, 22, 22];

    const rows = firmStats.map((fs, idx) => {
      const siteMap: Record<string, number> = {};
      (fs.siteBreakdown || []).forEach(sb => { siteMap[sb.siteId] = sb.count; });
      return [
        String(idx + 1),
        fs.firmName,
        String(fs.totalLeads),
        ...KNOWN_SITES.map(s => String(siteMap[s] || 0)),
        String(fs.todayLeads),
        String(fs.newLeads),
        String(fs.callbackLeads),
        String(fs.appearances),
        formatCurrency(fs.avgQuoteValue),
        formatCurrency(fs.totalRevenue),
      ];
    });

    let y = drawPdfTable(doc, 28, headers, rows, colWidths);

    y += 6;
    doc.setFontSize(7);
    doc.setTextColor(...PDF_COLORS.mediumGray);
    doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 14, y);

    doc.save(`firm-summary-${range.start}-to-${range.end}.pdf`);
  };

  const exportAllLeads = async () => {
    setExportingLeads(true);
    try {
      const startISO = `${range.start}T00:00:00.000Z`;
      const endDate = new Date(`${range.end}T12:00:00.000Z`);
      endDate.setUTCDate(endDate.getUTCDate() + 1);
      const endISO = endDate.toISOString();

      const allLeads: ComparisonLead[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        let q = supabase
          .from('comparison_leads')
          .select('*')
          .gte('created_at', startISO)
          .lt('created_at', endISO)
          .order('created_at', { ascending: false })
          .range(offset, offset + PAGE - 1);
        q = applyComparisonStatusFilter(q, statusFilter);
        if (siteFilter !== 'all') q = q.eq('site_id', siteFilter);
        if (firmFilter) q = q.eq('selected_firm_id', firmFilter);
        const { data, error } = await q;
        if (error) { console.error('Export fetch error:', error); break; }
        if (!data || data.length === 0) break;
        allLeads.push(...(data as ComparisonLead[]));
        if (data.length < PAGE) break;
        offset += PAGE;
        if (allLeads.length >= 10000) break;
      }

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      doc.setFillColor(...PDF_COLORS.navy);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(...PDF_COLORS.white);
      doc.text('Comparison Leads — All Leads Export', 14, 14);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${range.start} to ${range.end}  |  ${allLeads.length} leads`, 14, 20);

      const headers = ['Name', 'Phone', 'Type', 'Value', 'Firm', 'Site', 'Quote', 'Status', 'Date'];
      const colWidths = [38, 28, 24, 22, 42, 36, 22, 18, 22];

      const rows = allLeads.map(l => {
        const bd = l.quote_breakdown as any;
        return [
          `${l.first_name} ${l.last_name}`,
          l.phone || '',
          l.transaction_type || '',
          formatCurrency(l.property_value || 0),
          l.selected_firm_name || '—',
          getSiteLabel(l.site_id),
          bd?.totalIncVat ? formatCurrency(Number(bd.totalIncVat)) : '—',
          l.status || '',
          new Date(l.created_at).toLocaleDateString('en-GB'),
        ];
      });

      let y = drawPdfTable(doc, 28, headers, rows, colWidths);

      y += 6;
      doc.setFontSize(7);
      doc.setTextColor(...PDF_COLORS.mediumGray);
      doc.text(`Generated ${new Date().toLocaleString('en-GB')}`, 14, Math.min(y, doc.internal.pageSize.getHeight() - 10));

      doc.save(`comparison-leads-${range.start}-to-${range.end}.pdf`);
    } catch (err) {
      console.error('Error exporting leads:', err);
    } finally {
      setExportingLeads(false);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use strict local-day boundaries to avoid timezone bleed (e.g. "yesterday"
      // showing some of today's leads).
      const startISO = toUtcIsoFromLocalDateStart(range.start);
      const endISO = toUtcIsoFromNextLocalDateStart(range.end);

      // 1) Fetch firms for names and filter dropdown
      const firmsRes = await supabase
        .from('solicitor_firms')
        .select('id, name')
        .eq('is_active', true);
      if (firmsRes.error) throw firmsRes.error;
      const activeFirms = firmsRes.data || [];
      const activeFirmMap = Object.fromEntries(activeFirms.map((f) => [f.id, f.name || 'Unknown']));
      setActiveFirmNamesById(activeFirmMap);

      // 2) Get totals and firm stats from RPC (no row limit – server-side aggregation, same style as Lead Management)
      // The firm/stats RPC only understands the status column; callback/instruction
      // filters operate on quote_breakdown, so pass null there (cards show all).
      const statusArg = (statusFilter === 'all' || statusFilter === 'callback' || statusFilter === 'instruction') ? null : statusFilter;
      const siteArg = siteFilter === 'all' ? null : siteFilter;
      const firmArg = firmFilter || null;
      const { data: statsRows, error: statsErr } = await supabase
        .rpc('get_comparison_lead_stats', {
          p_start_iso: startISO,
          p_end_iso: endISO,
          p_status: statusArg,
          p_site_id: siteArg,
          p_firm_id: firmArg,
        });

      if (statsErr) {
        console.warn('get_comparison_lead_stats failed, using fallback counts:', statsErr);
      }

      const row = statsRows?.[0] as any;
      const total = row?.total_count ?? 0;
      const today = row?.today_count ?? 0;
      const quoted = row?.quoted_count ?? 0;
      const newC = row?.new_count ?? 0;
      const callbacks = row?.callbacks_count ?? 0;
      setTotalCount(Number(total));
      setTodayCount(Number(today));
      setQuotedCount(Number(quoted));
      setNewCount(Number(newC));
      setCallbacksCount(Number(callbacks));

      // Parse site counts from RPC (for dropdown totals).
      // IMPORTANT: keep these independent from the currently selected site filter
      // so the dropdown doesn't temporarily show all sites as (0) after chip changes.
      const rawSiteCounts = (row?.site_counts as any[]) ?? [];
      const rpcSiteMap: Record<string, number> = {};
      rawSiteCounts.forEach((sc: any) => { rpcSiteMap[sc.siteId || 'unknown'] = Number(sc.count ?? 0); });

      let siteCountSourceMap = rpcSiteMap;
      const shouldRefreshSiteCounts = statsErr || Object.keys(rpcSiteMap).length === 0 || siteFilter !== 'all';
      if (shouldRefreshSiteCounts) {
        let siteCountsQuery = supabase
          .from('comparison_leads')
          .select('site_id')
          .gte('created_at', startISO)
          .lt('created_at', endISO);

        siteCountsQuery = applyComparisonStatusFilter(siteCountsQuery, statusFilter);
        if (firmFilter) siteCountsQuery = siteCountsQuery.eq('selected_firm_id', firmFilter);

        const { data: siteRows, error: siteCountsErr } = await siteCountsQuery;
        if (siteCountsErr) {
          console.warn('Failed to refresh site dropdown counts:', siteCountsErr);
        } else {
          const rebuiltSiteMap: Record<string, number> = {};
          (siteRows || []).forEach((r: any) => {
            const key = (r?.site_id || 'unknown') as string;
            rebuiltSiteMap[key] = (rebuiltSiteMap[key] || 0) + 1;
          });
          siteCountSourceMap = rebuiltSiteMap;
        }
      }

      setSiteCountMap(siteCountSourceMap);

      const firmStatsRaw = (row?.firm_stats as any[]) ?? [];
      const stats: FirmStats[] = firmStatsRaw.map((f: any) => ({
        firmId: f.firmId,
        firmName: f.firmName ?? activeFirmMap[f.firmId] ?? 'Unknown',
        totalLeads: Number(f.totalLeads ?? 0),
        todayLeads: Number(f.todayLeads ?? 0),
        pushedLeads: 0,
        callbackLeads: Number(f.callbackLeads ?? 0),
        newLeads: Number(f.newLeads ?? 0),
        soldLeads: 0,
        failedLeads: 0,
        avgQuoteValue: f.totalLeads > 0 ? Number(f.totalRevenue ?? 0) / Number(f.totalLeads) : 0,
        totalRevenue: Number(f.totalRevenue ?? 0),
        dailyBreakdown: {},
        appearances: Number(f.appearances ?? 0),
        siteBreakdown: ((f.siteBreakdown || []) as any[]).map((sb: any) => ({
          siteId: sb.siteId || 'unknown',
          count: Number(sb.count ?? 0),
        })),
      }));
      setFirmStats(stats.sort((a, b) => b.totalLeads - a.totalLeads));

      // 3) Count-only query for list total (same pattern as Lead Management – avoids 1000 row limit)
      let countQuery = supabase
        .from('comparison_leads')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startISO)
        .lt('created_at', endISO);

      countQuery = applyComparisonStatusFilter(countQuery, statusFilter);
      if (siteFilter !== 'all') countQuery = countQuery.eq('site_id', siteFilter);
      if (firmFilter) countQuery = countQuery.eq('selected_firm_id', firmFilter);
      const comparisonSearchFilter = buildComparisonLeadSearchFilter(search);
      if (comparisonSearchFilter) {
        countQuery = countQuery.or(comparisonSearchFilter);
      }

      const { count: listTotal, error: countErr } = await countQuery;
      if (countErr) console.warn('Comparison leads count query failed:', countErr);
      const totalFiltered = Number(listTotal ?? 0);
      setTotalFilteredCount(totalFiltered);

      // 4) Fetch one page only with .range() (same as Lead Management)
      const pageOffset = (currentPage - 1) * LEADS_PER_PAGE;
      const validOffset = totalFiltered > 0 && pageOffset >= totalFiltered
        ? Math.max(0, Math.floor((totalFiltered - 1) / LEADS_PER_PAGE) * LEADS_PER_PAGE)
        : Math.max(0, pageOffset);
      const rangeEnd = totalFiltered > 0
        ? Math.min(validOffset + LEADS_PER_PAGE - 1, totalFiltered - 1)
        : validOffset + LEADS_PER_PAGE - 1;

      let listQuery = supabase
        .from('comparison_leads')
        .select('*')
        .gte('created_at', startISO)
        .lt('created_at', endISO)
        .order('created_at', { ascending: false })
        .range(validOffset, rangeEnd);

      listQuery = applyComparisonStatusFilter(listQuery, statusFilter);
      if (siteFilter !== 'all') listQuery = listQuery.eq('site_id', siteFilter);
      if (firmFilter) listQuery = listQuery.eq('selected_firm_id', firmFilter);
      if (comparisonSearchFilter) {
        listQuery = listQuery.or(comparisonSearchFilter);
      }

      const { data: pageData, error: pageErr } = await listQuery;

      if (pageErr) throw pageErr;
      setLeads((pageData as ComparisonLead[]) ?? []);
    } catch (err: any) {
      console.error('Error loading comparison leads:', err);
    } finally {
      setIsLoading(false);
    }
  }, [range.start, range.end, statusFilter, siteFilter, firmFilter, search, currentPage]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    setUpdatingStatus(leadId);
    try {
      const { error } = await supabase
        .from('comparison_leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId);
      if (error) throw error;
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, status: newStatus } : null);
      }
      await loadData();
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this lead? This cannot be undone.')) return;
    setDeletingLead(leadId);
    try {
      const { error } = await supabase
        .from('comparison_leads')
        .delete()
        .eq('id', leadId);
      if (error) throw error;
      if (selectedLead?.id === leadId) setSelectedLead(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete lead:', err);
    } finally {
      setDeletingLead(null);
    }
  };

  // Server-side pagination: leads = current page only, totalFilteredCount = total for filters
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / LEADS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStartIndex = (currentPageSafe - 1) * LEADS_PER_PAGE;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, firmFilter, siteFilter, range.start, range.end, rangePreset]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (firmFilter && !firmStats.some((f) => f.firmId === firmFilter)) {
      setFirmFilter(null);
    }
  }, [firmFilter, firmStats]);

  const availableSites = ['cheapconveyancing', 'themoveexchange', 'compareconveyancingprices', 'unknown'].sort(
    (a, b) => getSiteLabel(a).localeCompare(getSiteLabel(b))
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <span className="ml-3 text-gray-600">Loading comparison leads...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-600" />
            Comparison Engine Leads
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and manage leads from the comparison site
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={exportFirmSummary} disabled={firmStats.length === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Download firm summary PDF (for invoicing)">
            <Download className="w-4 h-4" /> Firm PDF
          </button>
          <button onClick={exportAllLeads} disabled={exportingLeads || totalFilteredCount === 0}
            className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-50"
            title="Download all filtered leads as PDF">
            {exportingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exportingLeads ? 'Exporting...' : 'Leads PDF'}
          </button>
          <button onClick={loadData}
            className="btn-secondary flex items-center gap-1.5 text-sm">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          onClick={() => { setStatusFilter('all'); applyPreset('last30'); }}>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
          </div>
        </div>
        <div className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          onClick={() => applyPreset('today')}>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-purple-500">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today</p>
              <p className="text-2xl font-bold text-gray-900">{todayCount}</p>
            </div>
          </div>
        </div>
        <div className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          onClick={() => setStatusFilter('quoted')}>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-gray-500">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Quoted</p>
              <p className="text-2xl font-bold text-gray-900">{quotedCount}</p>
            </div>
          </div>
        </div>
        <div className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]"
          onClick={() => setStatusFilter('new')}>
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-amber-500">
              <AlertCircle className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">New</p>
              <p className="text-2xl font-bold text-gray-900">{newCount}</p>
            </div>
          </div>
        </div>
        <div className="card cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02]">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-teal-500">
              <PhoneCall className="h-6 w-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Callbacks</p>
              <p className="text-2xl font-bold text-gray-900">{callbacksCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Firm Rankings (collapsible) */}
      {firmStats.length > 0 && (
        <div className="card">
          <button
            onClick={() => setShowFirmRankings(!showFirmRankings)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-purple-600" /> Firm Rankings (by lead volume)
            </h2>
            {showFirmRankings ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
          {showFirmRankings && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="py-2.5 px-3 text-left">#</th>
                    <th className="py-2.5 px-3 text-left">Firm</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                    {KNOWN_SITES.map(s => (
                      <th key={s} className="py-2.5 px-3 text-right whitespace-nowrap">{getSiteLabel(s).split(' ').map(w => w[0]).join('')}</th>
                    ))}
                    <th className="py-2.5 px-3 text-right">Today</th>
                    <th className="py-2.5 px-3 text-right">New</th>
                    <th className="py-2.5 px-3 text-right">Callbacks</th>
                    <th className="py-2.5 px-3 text-right">Appeared</th>
                    <th className="py-2.5 px-3 text-right">Avg Quote</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {firmStats.map((fs, idx) => {
                    const siteMap: Record<string, number> = {};
                    (fs.siteBreakdown || []).forEach(sb => { siteMap[sb.siteId] = sb.count; });
                    return (
                      <tr key={fs.firmId}
                        className="hover:bg-purple-50 transition-colors cursor-pointer"
                        onClick={() => setSelectedFirmDetail(fs)}>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-800' :
                            idx === 1 ? 'bg-gray-200 text-gray-700' :
                            idx === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-50 text-gray-500'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-gray-900">{fs.firmName}</td>
                        <td className="py-2.5 px-3 text-right font-semibold text-gray-900">{fs.totalLeads}</td>
                        {KNOWN_SITES.map(s => (
                          <td key={s} className="py-2.5 px-3 text-right text-gray-600">{siteMap[s] || 0}</td>
                        ))}
                        <td className="py-2.5 px-3 text-right text-gray-600">{fs.todayLeads}</td>
                        <td className="py-2.5 px-3 text-right text-blue-600 font-medium">{fs.newLeads}</td>
                        <td className="py-2.5 px-3 text-right text-gray-600">{fs.callbackLeads}</td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-medium">{fs.appearances}</td>
                        <td className="py-2.5 px-3 text-right text-gray-700">{formatCurrency(fs.avgQuoteValue)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-400">
                  {KNOWN_SITES.map(s => `${getSiteLabel(s).split(' ').map(w => w[0]).join('')} = ${getSiteLabel(s)}`).join(' · ')}
                </p>
                <p className="text-xs text-gray-400">Click a firm to see detailed breakdown</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active Firm Filter Badge */}
      {firmFilter && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
            <Building2 className="w-3.5 h-3.5" />
            Filtering: {firmStats.find(f => f.firmId === firmFilter)?.firmName || activeFirmNamesById[firmFilter] || 'Unknown'}
            <button onClick={() => setFirmFilter(null)} className="ml-1 hover:text-purple-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}
      {siteFilter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
            <ExternalLink className="w-3.5 h-3.5" />
            Site: {getSiteLabel(siteFilter)}
            <button onClick={() => setSiteFilter('all')} className="ml-1 hover:text-blue-950">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="card space-y-4">
        {/* Row 1: Search + Status + Site + Firm */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search name, email, phone, firm, postcode..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 text-sm" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-sm py-2 w-full sm:w-40">
            <option value="all">All Statuses</option>
            <option value="quoted">Quoted</option>
            <option value="new">New</option>
            <option value="pushed">Pushed</option>
            <option value="sold">Sold</option>
            <option value="failed">Failed</option>
            <option value="callback">Callback requested</option>
            <option value="instruction">Instruction requested</option>
          </select>
          <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}
            className="input text-sm py-2 w-full sm:w-52">
            <option value="all">All Sites</option>
            {availableSites.map((siteId) => (
              <option key={siteId} value={siteId}>
                {getSiteLabel(siteId)} ({siteCountMap[siteId] || 0})
              </option>
            ))}
          </select>
          {firmStats.length > 0 && (
            <select value={firmFilter || 'all'} onChange={(e) => setFirmFilter(e.target.value === 'all' ? null : e.target.value)}
              className="input text-sm py-2 w-full sm:w-48">
              <option value="all">All Firms</option>
              {firmStats.map(fs => (
                <option key={fs.firmId} value={fs.firmId}>{fs.firmName} ({fs.totalLeads})</option>
              ))}
            </select>
          )}
        </div>

        {/* Row 2: Date range presets + custom pickers */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
          <Calendar className="w-4 h-4 text-gray-400 hidden sm:block" />
          {(['today', 'yesterday', 'last7', 'last30'] as const).map(p => (
            <button key={p} onClick={() => applyPreset(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                rangePreset === p
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'border-gray-200 text-gray-600 hover:border-purple-300 hover:text-purple-700 bg-white'
              }`}>
              {p === 'today' ? 'Today' : p === 'yesterday' ? 'Yesterday' : p === 'last7' ? '7 Days' : '30 Days'}
            </button>
          ))}
          <span className="text-gray-300 hidden sm:block">|</span>
          <div className="flex items-center gap-1.5">
            <input type="date" value={range.start}
              onChange={(e) => handleCustomRange('start', e.target.value)}
              className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors ${
                rangePreset === 'custom' ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200'
              } focus:border-purple-400 focus:ring-1 focus:ring-purple-100 w-[125px]`} />
            <span className="text-xs text-gray-400">to</span>
            <input type="date" value={range.end}
              onChange={(e) => handleCustomRange('end', e.target.value)}
              className={`border rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors ${
                rangePreset === 'custom' ? 'border-purple-300 ring-1 ring-purple-100' : 'border-gray-200'
              } focus:border-purple-400 focus:ring-1 focus:ring-purple-100 w-[125px]`} />
          </div>
        </div>
      </div>

      {/* Lead Cards Grid */}
      {totalFilteredCount === 0 ? (
        <div className="card text-center py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-700">No comparison leads found</p>
          <p className="text-sm text-gray-500 mt-1">Leads will appear here once customers use the comparison engine.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            Showing <strong className="text-gray-900">{pageStartIndex + 1}</strong> to{' '}
            <strong className="text-gray-900">{Math.min(pageStartIndex + leads.length, totalFilteredCount)}</strong> of{' '}
            <strong className="text-gray-900">{totalFilteredCount}</strong> lead{totalFilteredCount !== 1 ? 's' : ''}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leads.map((lead) => {
              const breakdown = lead.quote_breakdown as any;
              const isCallback = breakdown?.callbackRequested === true;
              const isInstruction = breakdown?.instructionRequested === true;
              const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
              const txCfg = TX_TYPE_CONFIG[lead.transaction_type] || { bg: 'bg-gray-50', text: 'text-gray-700' };

              return (
                <div key={lead.id} className="card hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedLead(lead)}>
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">
                        {lead.first_name} {lead.last_name}
                      </h3>
                      <p className="text-sm text-gray-500 truncate" title={lead.email}>{lead.email}</p>
                      <p className="text-sm text-gray-500">{lead.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      {isCallback && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <PhoneCall className="w-3 h-3" /> Callback
                        </span>
                      )}
                      {isInstruction && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Instruct
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Transaction:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${txCfg.bg} ${txCfg.text}`}>
                        {lead.transaction_type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Property Value:</span>
                      <span className="text-sm font-medium text-gray-900">{formatCurrency(lead.property_value)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Selected Firm:</span>
                      <span className="text-sm font-medium text-gray-900 truncate ml-2 max-w-[180px]" title={lead.selected_firm_name || ''}>
                        {lead.selected_firm_name || <span className="text-gray-400">—</span>}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Site:</span>
                      <span className="text-sm font-medium text-gray-900">{getSiteLabel(lead.site_id)}</span>
                    </div>
                    {(lead as any).where_things_up_to && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Client Position:</span>
                        <span className="text-sm font-medium text-[#7958BC] text-right ml-2 max-w-[200px] leading-tight">
                          {(lead as any).where_things_up_to_sale
                            ? `Sale: ${formatWhereThingsUpTo((lead as any).where_things_up_to_sale)} / Purchase: ${formatWhereThingsUpTo((lead as any).where_things_up_to)}`
                            : formatWhereThingsUpTo((lead as any).where_things_up_to)}
                        </span>
                      </div>
                    )}
                    {breakdown?.totalIncVat && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Quote Total:</span>
                        <span className="text-sm font-bold text-[#011E41]">{formatCurrency(breakdown.totalIncVat)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Received:</span>
                      <span className="text-sm text-gray-500">
                        {formatDate(lead.created_at)} · <span className="text-gray-400">{getAge(lead.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <a href={`tel:${lead.phone}`}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={`Call ${lead.phone}`}>
                        <Phone className="w-4 h-4" />
                      </a>
                      <a href={`mailto:${lead.email}`}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title={`Email ${lead.email}`}>
                        <Mail className="w-4 h-4" />
                      </a>
                    </div>
                    <span className="flex items-center gap-1.5 text-sm text-purple-600 font-medium">
                      <Eye className="w-4 h-4" /> View
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="card">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  Page <strong className="text-gray-900">{currentPageSafe}</strong> of{' '}
                  <strong className="text-gray-900">{totalPages}</strong>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPageSafe === 1}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPageSafe <= 3) {
                      pageNum = i + 1;
                    } else if (currentPageSafe >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPageSafe - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-9 min-w-9 px-3 rounded-lg text-sm font-medium border transition-colors ${
                          currentPageSafe === pageNum
                            ? 'bg-[#011E41] text-white border-[#011E41]'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPageSafe === totalPages}
                    className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center pt-2">
            Showing {Math.min(pageStartIndex + leads.length, totalFilteredCount)} of {totalFilteredCount} filtered leads ({range.start} to {range.end})
          </p>
        </>
      )}

      {/* ─── Firm Detail Modal ──────────────────────────────────────────────── */}
      {selectedFirmDetail && (() => {
        const fs = selectedFirmDetail;
        const convRate = fs.totalLeads > 0 ? ((fs.soldLeads / fs.totalLeads) * 100).toFixed(1) : '0.0';
        const firmLeads = leads.filter(l => (l.selected_firm_id || 'unassigned') === fs.firmId);
        const sortedDays = Object.entries(fs.dailyBreakdown)
          .sort(([a], [b]) => b.localeCompare(a));
        const maxDayLeads = Math.max(...Object.values(fs.dailyBreakdown), 1);

        return (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedFirmDetail(null)}>
            <div className="bg-white rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center space-x-4">
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedFirmDetail(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-purple-600" /> {fs.firmName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Firm lead breakdown & reporting</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setFirmFilter(fs.firmId); setSelectedFirmDetail(null); }}
                    className="btn-secondary flex items-center gap-1.5 text-sm">
                    <Filter className="w-4 h-4" /> Filter Leads
                  </button>
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedFirmDetail(null)}>
                    <X className="h-6 w-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">

                {/* Firm Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[
                    { label: 'Total Leads', value: fs.totalLeads, color: 'text-gray-900' },
                    { label: 'Today', value: fs.todayLeads, color: 'text-purple-600' },
                    { label: 'Appeared In', value: fs.appearances, color: 'text-indigo-600' },
                    { label: 'New', value: fs.newLeads, color: 'text-blue-600' },
                    { label: 'Pushed', value: fs.pushedLeads, color: 'text-green-600' },
                    { label: 'Sold', value: fs.soldLeads, color: 'text-purple-600' },
                    { label: 'Failed', value: fs.failedLeads, color: 'text-red-600' },
                  ].map(stat => (
                    <div key={stat.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Avg Quote Value</p>
                    <p className="text-2xl font-bold text-[#011E41] mt-1">{formatCurrency(fs.avgQuoteValue)}</p>
                  </div>
                  <div className="card border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Conversion Rate</p>
                    <p className={`text-2xl font-bold mt-1 ${parseFloat(convRate) > 0 ? 'text-green-600' : 'text-gray-400'}`}>{convRate}%</p>
                    <p className="text-xs text-gray-400">{fs.soldLeads} sold of {fs.totalLeads} total</p>
                  </div>
                  <div className="card border border-gray-200">
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Callback Requests</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{fs.callbackLeads}</p>
                    <p className="text-xs text-gray-400">{fs.totalLeads > 0 ? ((fs.callbackLeads / fs.totalLeads) * 100).toFixed(1) : 0}% of leads</p>
                  </div>
                </div>

                {/* Leads by Site */}
                {fs.siteBreakdown && fs.siteBreakdown.length > 0 && (
                  <div className="card border border-gray-200">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <ExternalLink className="w-4 h-4 text-purple-600" /> Leads by Site
                    </h3>
                    <div className="space-y-2">
                      {fs.siteBreakdown
                        .sort((a, b) => b.count - a.count)
                        .map(sb => {
                          const barWidth = fs.totalLeads > 0 ? (sb.count / fs.totalLeads) * 100 : 0;
                          return (
                            <div key={sb.siteId} className="flex items-center gap-3">
                              <span className="text-sm font-medium w-48 flex-shrink-0 text-gray-700 truncate">{getSiteLabel(sb.siteId)}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                                <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${barWidth}%` }} />
                              </div>
                              <span className="text-sm font-bold w-10 text-right text-gray-700">{sb.count}</span>
                              <span className="text-xs text-gray-400 w-12 text-right">{barWidth.toFixed(0)}%</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                {/* Daily Breakdown */}
                <div className="card border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" /> Daily Lead Volume
                  </h3>
                  {sortedDays.length === 0 ? (
                    <p className="text-sm text-gray-400">No daily data available</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {sortedDays.map(([day, count]) => {
                        const barWidth = (count / maxDayLeads) * 100;
                        const isToday = day === new Date().toISOString().split('T')[0];
                        return (
                          <div key={day} className="flex items-center gap-3">
                            <span className={`text-xs font-mono w-24 flex-shrink-0 ${isToday ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                              {isToday ? 'Today' : new Date(day + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
                            </span>
                            <div className="flex-1 bg-gray-100 rounded-full h-5 relative overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${isToday ? 'bg-purple-500' : 'bg-blue-400'}`}
                                style={{ width: `${barWidth}%` }} />
                            </div>
                            <span className={`text-sm font-bold w-8 text-right ${isToday ? 'text-purple-700' : 'text-gray-700'}`}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Firm's Leads Table */}
                <div className="card border border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-purple-600" /> All Leads for {fs.firmName}
                    <span className="ml-auto text-xs text-gray-400 font-normal">{firmLeads.length} leads</span>
                  </h3>
                  {firmLeads.length === 0 ? (
                    <p className="text-sm text-gray-400">No leads yet</p>
                  ) : (
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wider sticky top-0 bg-white">
                            <th className="py-2 px-3 text-left">Name</th>
                            <th className="py-2 px-3 text-left">Contact</th>
                            <th className="py-2 px-3 text-left">Transaction</th>
                            <th className="py-2 px-3 text-right">Value</th>
                            <th className="py-2 px-3 text-right">Quote</th>
                            <th className="py-2 px-3 text-center">Status</th>
                            <th className="py-2 px-3 text-right">Date</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {firmLeads.map(lead => {
                            const bd = lead.quote_breakdown as any;
                            const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
                            return (
                              <tr key={lead.id} className="hover:bg-gray-50 cursor-pointer transition-colors"
                                onClick={() => { setSelectedFirmDetail(null); setSelectedLead(lead); }}>
                                <td className="py-2 px-3 font-medium text-gray-900">{lead.first_name} {lead.last_name}</td>
                                <td className="py-2 px-3">
                                  <div className="text-xs text-gray-600">{lead.phone}</div>
                                  <div className="text-xs text-gray-400 truncate max-w-[150px]">{lead.email}</div>
                                </td>
                                <td className="py-2 px-3 text-xs">{lead.transaction_type}</td>
                                <td className="py-2 px-3 text-right text-gray-900">{formatCurrency(lead.property_value)}</td>
                                <td className="py-2 px-3 text-right font-medium text-[#011E41]">{bd?.totalIncVat ? formatCurrency(bd.totalIncVat) : '—'}</td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                                </td>
                                <td className="py-2 px-3 text-right text-xs text-gray-500">{formatDate(lead.created_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ─── Lead Detail Modal ─────────────────────────────────────────────── */}
      {selectedLead && (() => {
        const lead = selectedLead;
        const breakdown = lead.quote_breakdown as any;
        const isCallback = breakdown?.callbackRequested === true;
        const isInstruction = breakdown?.instructionRequested === true;
        const statusCfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
        const txCfg = TX_TYPE_CONFIG[lead.transaction_type] || { bg: 'bg-gray-50', text: 'text-gray-700' };

        return (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedLead(null)}>
            <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}>

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
                <div className="flex items-center space-x-4">
                  <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedLead(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
                        {statusCfg.label}
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${txCfg.bg} ${txCfg.text}`}>
                        {lead.transaction_type}
                      </span>
                      {isCallback && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          <PhoneCall className="w-3 h-3" /> Callback Requested
                        </span>
                      )}
                      {isInstruction && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Instruction Requested
                        </span>
                      )}
                      {breakdown?.totalIncVat && (
                        <span className="text-sm font-bold text-[#011E41]">{formatCurrency(breakdown.totalIncVat)}</span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-gray-600" onClick={() => setSelectedLead(null)}>
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="p-6 space-y-6">

                {/* Client Details */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <User className="h-5 w-5 mr-2" /> Client Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Name:</span>
                      <span className="text-sm font-medium text-gray-900">{lead.first_name} {lead.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Phone:</span>
                      <a href={`tel:${lead.phone}`} className="text-sm font-medium text-blue-600 hover:text-blue-800">{lead.phone}</a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Email:</span>
                      <a href={`mailto:${lead.email}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 truncate ml-2 max-w-[220px]">{lead.email}</a>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Received:</span>
                      <span className="text-sm text-gray-900">{formatDate(lead.created_at)} at {formatTime(lead.created_at)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Source:</span>
                      <span className="text-sm text-gray-900">{lead.source || 'comparison-site'}</span>
                    </div>
                    {(lead as any).where_things_up_to && (
                      <div className="flex justify-between col-span-full">
                        <span className="text-sm text-gray-600">Client Position:</span>
                        <span className="text-sm font-medium text-[#7958BC] text-right ml-4 max-w-[260px] leading-snug">
                          {(lead as any).where_things_up_to_sale ? (
                            <>
                              <span className="block">Sale: {formatWhereThingsUpTo((lead as any).where_things_up_to_sale)}</span>
                              <span className="block">Purchase: {formatWhereThingsUpTo((lead as any).where_things_up_to)}</span>
                            </>
                          ) : formatWhereThingsUpTo((lead as any).where_things_up_to)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Age:</span>
                      <span className="text-sm font-medium text-gray-900">{getAge(lead.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Property Details */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Home className="h-5 w-5 mr-2" /> Property Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Transaction:</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${txCfg.bg} ${txCfg.text}`}>
                        {lead.transaction_type}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Property Value:</span>
                      <span className="text-sm font-bold text-gray-900">{formatCurrency(lead.property_value)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Property Type:</span>
                      <span className="text-sm text-gray-900">{lead.property_type || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Region:</span>
                      <span className="text-sm text-gray-900">{lead.property_region || 'N/A'}</span>
                    </div>
                    {lead.property_postcode && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Postcode:</span>
                        <span className="text-sm text-gray-900">{lead.property_postcode}</span>
                      </div>
                    )}
                    {lead.property_address && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Address:</span>
                        <span className="text-sm text-gray-900 text-right ml-2">{lead.property_address}</span>
                      </div>
                    )}
                  </div>
                  {/* Property flags */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {lead.is_mortgaged && <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">Mortgaged</span>}
                    {lead.is_first_time_buyer && <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">First Time Buyer</span>}
                    {lead.is_new_build && <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700">New Build</span>}
                    {lead.is_leasehold && <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">Leasehold</span>}
                  </div>
                </div>

                {/* Selected Firm & Quote */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <FileText className="h-5 w-5 mr-2" /> Selected Firm & Quote
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Selected Firm:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{lead.selected_firm_name || 'N/A'}</span>
                        {lead.selected_firm_id && (
                          <button
                            onClick={() => {
                              const fs = firmStats.find(f => f.firmId === lead.selected_firm_id);
                              if (fs) { setSelectedLead(null); setSelectedFirmDetail(fs); }
                            }}
                            className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> View Firm
                          </button>
                        )}
                      </div>
                    </div>

                    {breakdown && (
                      <div className="bg-gray-50 rounded-lg p-4 mt-3 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Legal Fee (ex VAT)</span>
                          <span className="font-medium">{formatCurrency(breakdown.legalFeeExVat || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Legal Fee (inc VAT)</span>
                          <span className="font-medium">{formatCurrency(breakdown.legalFeeIncVat || 0)}</span>
                        </div>

                        {breakdown.supplements?.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Supplements</p>
                            {breakdown.supplements.map((s: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-500">{s.name}</span>
                                <span className="font-medium">{formatCurrency(s.fee || 0)}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {breakdown.disbursements?.length > 0 && (
                          <>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider pt-2">Disbursements</p>
                            {breakdown.disbursements.map((d: any, i: number) => (
                              <div key={i} className="flex justify-between text-sm">
                                <span className="text-gray-500">{d.name}</span>
                                <span className="font-medium">{formatCurrency(d.fee || 0)}</span>
                              </div>
                            ))}
                          </>
                        )}

                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Land Registry Fee</span>
                          <span className="font-medium">{formatCurrency(breakdown.landRegistryFee || 0)}</span>
                        </div>

                        <div className="flex justify-between pt-3 border-t border-gray-200 text-base font-bold">
                          <span>Total (inc VAT)</span>
                          <span className="text-[#011E41]">{formatCurrency(breakdown.totalIncVat || 0)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Firms Displayed in Results */}
                {breakdown?.displayedFirms?.length > 0 && (
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <Building2 className="h-5 w-5 mr-2" /> Firms Displayed ({breakdown.displayedFirms.length})
                    </h3>
                    <p className="text-xs text-gray-400 mb-3">All firms shown to this lead in the comparison results</p>
                    <div className="space-y-2">
                      {breakdown.displayedFirms.map((df: any) => (
                        <div key={df.firmId} className={`flex items-center justify-between py-2 px-3 rounded-lg ${df.firmId === lead.selected_firm_id ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                              df.rank === 1 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-600'
                            }`}>{df.rank}</span>
                            <span className={`text-sm font-medium ${df.firmId === lead.selected_firm_id ? 'text-purple-800' : 'text-gray-900'}`}>
                              {df.firmName}
                            </span>
                            {df.firmId === lead.selected_firm_id && (
                              <span className="text-[10px] font-bold text-purple-600 uppercase">Selected</span>
                            )}
                          </div>
                          <span className="text-sm font-semibold text-gray-700">{formatCurrency(df.totalIncVat || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Management */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <CheckCircle className="h-5 w-5 mr-2" /> Lead Status
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => handleStatusChange(lead.id, key)}
                        disabled={lead.status === key || updatingStatus === lead.id}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                          lead.status === key
                            ? `${cfg.bg} ${cfg.text} border-current shadow-sm`
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'
                        } disabled:opacity-50`}
                      >
                        {updatingStatus === lead.id && lead.status !== key ? (
                          <Loader2 className="w-4 h-4 animate-spin inline mr-1" />
                        ) : null}
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Phone className="h-5 w-5 mr-2" /> Quick Actions
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <a href={`tel:${lead.phone}`}
                      className="btn-primary flex items-center gap-2 text-sm">
                      <Phone className="w-4 h-4" /> Call {lead.first_name}
                    </a>
                    <a href={`mailto:${lead.email}`}
                      className="btn-secondary flex items-center gap-2 text-sm">
                      <Mail className="w-4 h-4" /> Send Email
                    </a>
                    <button
                      onClick={() => handleDeleteLead(lead.id)}
                      disabled={deletingLead === lead.id}
                      className="ml-auto px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex items-center gap-2 disabled:opacity-50">
                      {deletingLead === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Delete Lead
                    </button>
                  </div>
                </div>

                {/* Tracking Info */}
                {canViewAttribution && (lead.referrer || lead.utm_source || lead.utm_campaign) && (
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <ExternalLink className="h-5 w-5 mr-2" /> Tracking
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      {lead.referrer && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Referrer:</span>
                          <span className="text-sm text-gray-900 truncate ml-2 max-w-[220px]">{lead.referrer}</span>
                        </div>
                      )}
                      {lead.utm_source && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">UTM Source:</span>
                          <span className="text-sm text-gray-900">{lead.utm_source}</span>
                        </div>
                      )}
                      {lead.utm_campaign && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">UTM Campaign:</span>
                          <span className="text-sm text-gray-900">{lead.utm_campaign}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Site:</span>
                        <span className="text-sm text-gray-900">{getSiteLabel(lead.site_id)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Attribution */}
                {canViewAttribution && (
                <div className="card">
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 text-left"
                    onClick={() => setShowAttributionDetails((prev) => !prev)}
                    aria-expanded={showAttributionDetails}
                  >
                    <div className="flex items-center min-w-0">
                      <ExternalLink className="h-5 w-5 mr-2 text-gray-700 flex-shrink-0" />
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900">Attribution</h3>
                        <p className="text-xs text-gray-500 truncate">
                          UTM Source: {lead.utm_source || 'Not captured'} · Campaign: {lead.utm_campaign || 'Not captured'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                        {getAttributionCapturedCount(lead)} captured
                      </span>
                      <ChevronDown className={`h-5 w-5 text-gray-500 transition-transform ${showAttributionDetails ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {showAttributionDetails && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8">
                        <div>
                          {renderAttributionField('UTM Source', lead.utm_source)}
                          {renderAttributionField('UTM Medium', lead.utm_medium)}
                          {renderAttributionField('UTM Campaign', lead.utm_campaign)}
                          {renderAttributionField('UTM Term / Keyword', lead.utm_term)}
                          {renderAttributionField('UTM Content', lead.utm_content)}
                          {renderAttributionField('Google Campaign ID', lead.gad_campaignid)}
                          {renderAttributionField('Google Ads Source', lead.gad_source)}
                        </div>
                        <div>
                          {renderAttributionField('GCLID', lead.gclid, { long: true })}
                          {renderAttributionField('GBRAID', lead.gbraid, { long: true })}
                          {renderAttributionField('WBRAID', lead.wbraid, { long: true })}
                          {renderAttributionField('MSCLKID', lead.msclkid, { long: true })}
                          {renderAttributionField('Landing Page', lead.landing_page, { long: true })}
                          {renderAttributionField('Referrer', lead.referrer, { long: true })}
                          {renderAttributionField('Attribution Captured At', lead.attribution_captured_at, { date: true })}
                          {renderAttributionField('Comparison Lead ID', lead.id, { long: true })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
