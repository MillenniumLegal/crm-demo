// Forecast — connects lead volume, source quality, region, matter mix, capacity,
// instructions, handoff pressure and instruction value so Connor can plan pre-instruction ops.

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CheckCircle,
  Loader2,
  MapPin,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  fetchForecast,
  Forecast as FC,
  ForecastCapacity,
  ForecastRegion,
  ForecastSeries,
  ForecastSource,
} from '@/services/forecastService';
import { MarketingKpiStrip } from '@/components/marketing/MarketingKpiStrip';
import { ForecastChart } from '@/components/trends/ForecastChart';
import { RangeFilter, rangeLabel, scaleRangeCount, scaleRangeMoney } from '@/components/analytics/RangeFilter';
import { RankedBarList } from '@/components/analytics/RankedBarList';
import { SignalDrawer } from '@/components/callinsights/SignalDrawer';

const fmt = (n: number) => n.toLocaleString('en-GB');
const money = (n: number) => `£${fmt(Math.round(n))}`;
const pct = (n: number) => `${Number.isFinite(n) ? n.toFixed(n % 1 === 0 ? 0 : 1) : '0'}%`;

const RISK_HEX = {
  low: '#16a34a',
  medium: '#f59e0b',
  high: '#ef4444',
};

const TONE_HEX = {
  good: '#16a34a',
  warn: '#f59e0b',
  bad: '#ef4444',
  info: '#1e3a8a',
};

const MAP_W = 680;
const MAP_H = 430;

const scaleSeries = (series: ForecastSeries, range: string): ForecastSeries => ({
  ...series,
  actual: series.actual.map((value) => value == null ? null : scaleRangeCount(value, range)),
  forecast: series.forecast.map((value) => value == null ? null : scaleRangeCount(value, range)),
  lower: series.lower.map((value) => value == null ? null : scaleRangeCount(value, range)),
  upper: series.upper.map((value) => value == null ? null : scaleRangeCount(value, range)),
});

const signalFromRegion = (region: ForecastRegion, range: string) => ({
  key: `forecast-region-${region.key}`,
  label: `${region.label} · forecast demand`,
  count: scaleRangeCount(region.forecastLeads, range),
  calls: scaleRangeCount(region.forecastInstructions, range),
  sentiment: region.forecastInstructions > region.capacity ? -0.18 : 0.42,
  conversion: { withPct: region.conversion, otherPct: 23 },
  trend: [
    Math.max(1, Math.round(region.leads * 0.72)),
    Math.max(1, Math.round(region.leads * 0.82)),
    region.leads,
    Math.round(region.forecastLeads * 0.92),
    region.forecastLeads,
    Math.round(region.forecastLeads * 1.05),
  ],
  sample: [
    {
      agent: 'APCM Forecast',
      lead: region.label,
      date: rangeLabel(range),
      clientSaid: `${region.marketSignal}. Top source: ${region.topSource}.`,
      repReplied: `${scaleRangeCount(region.forecastLeads, range)} leads should create ${scaleRangeCount(region.forecastInstructions, range)} instructions.`,
      clientReaction: `${region.capacity} capacity · ${Math.max(0, region.forecastInstructions - region.capacity)} gap`,
      note: `${region.action} Confidence ${region.confidence}%. Average fee ${money(region.avgFee)}.`,
    },
  ],
});

const signalFromSource = (source: ForecastSource, range: string) => ({
  key: `forecast-source-${source.source}`,
  label: `${source.source} · lead forecast`,
  count: scaleRangeCount(source.forecastLeads, range),
  calls: scaleRangeCount(source.expectedInstructions, range),
  sentiment: source.conversion >= 27 ? 0.5 : source.conversion >= 23 ? 0.18 : -0.08,
  conversion: { withPct: source.conversion, otherPct: 22 },
  trend: [
    Math.max(1, Math.round(source.currentLeads * 0.75)),
    Math.max(1, Math.round(source.currentLeads * 0.85)),
    source.currentLeads,
    Math.round(source.forecastLeads * 0.95),
    source.forecastLeads,
    Math.round(source.forecastLeads * 1.04),
  ],
  sample: [
    {
      agent: 'APCM Forecast',
      lead: source.source,
      date: rangeLabel(range),
      clientSaid: `${source.currentLeads} current leads; ${source.forecastLeads} forecast.`,
      repReplied: source.action,
      clientReaction: `${source.expectedInstructions} expected instructions · ${pct(source.conversion)} conversion`,
      note: `Cost per instruction ${money(source.costPerInstruction)}. Confidence ${source.confidence}%.`,
    },
  ],
});

const signalFromCapacity = (team: ForecastCapacity, range: string) => ({
  key: `forecast-capacity-${team.team}`,
  label: `${team.team} · capacity forecast`,
  count: scaleRangeCount(team.forecastCases, range),
  calls: scaleRangeCount(team.capacity, range),
  sentiment: team.risk === 'high' ? -0.52 : team.risk === 'medium' ? -0.16 : 0.38,
  conversion: { withPct: Math.round((team.capacity / Math.max(team.forecastCases, 1)) * 100), otherPct: 85 },
  trend: [
    Math.max(1, Math.round(team.currentCases * 0.8)),
    Math.max(1, Math.round(team.currentCases * 0.9)),
    team.currentCases,
    Math.round(team.forecastCases * 0.94),
    team.forecastCases,
    Math.round(team.forecastCases * 1.05),
  ],
  sample: [
    {
      agent: team.owner,
      lead: team.team,
      date: rangeLabel(range),
      clientSaid: `${team.forecastCases} forecast cases against ${team.capacity} capacity.`,
      repReplied: team.action,
      clientReaction: `${team.risk} risk`,
      note: `Current cases ${team.currentCases}. Gap ${team.forecastCases - team.capacity}.`,
    },
  ],
});

const ForecastBridge: React.FC<{ data: FC; range: string }> = ({ data, range }) => {
  const first = Math.max(data.bridge[0]?.forecast ?? 1, 1);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-navy-700" />
        <h2 className="text-sm font-semibold text-gray-900">Lead-to-instruction forecast bridge</h2>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Connects expected leads to quotes, instruction handoffs and forecast instruction value.</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-5">
        {data.bridge.map((stage, index) => {
          const isMoney = stage.label.includes('Revenue');
          const current = isMoney ? money(scaleRangeMoney(stage.current, range)) : fmt(scaleRangeCount(stage.current, range));
          const forecast = isMoney ? money(scaleRangeMoney(stage.forecast, range)) : fmt(scaleRangeCount(stage.forecast, range));
          const width = stage.label.includes('Revenue') ? 100 : Math.max(8, (stage.forecast / first) * 100);
          return (
            <div key={stage.label} className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{stage.label}</div>
                  <div className="text-xs text-gray-500">{current} now</div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: RISK_HEX[stage.risk] }} />
              </div>
              <div className="mt-2 text-xl font-bold tabular-nums" style={{ color: index < 2 ? '#1e3a8a' : index < 4 ? '#4338ca' : '#16a34a' }}>{forecast}</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
                <div className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: RISK_HEX[stage.risk] }} />
              </div>
              <p className="mt-2 text-xs leading-5 text-gray-500">{stage.note}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const RegionalForecastMap: React.FC<{
  regions: ForecastRegion[];
  range: string;
  onOpen: (region: ForecastRegion) => void;
  onLeads: (region: ForecastRegion) => void;
}> = ({ regions, range, onOpen, onLeads }) => {
  const [selectedKey, setSelectedKey] = useState(regions[0]?.key ?? '');
  const selected = regions.find((region) => region.key === selectedKey) ?? regions[0];
  const maxLeads = Math.max(1, ...regions.map((region) => scaleRangeCount(region.forecastLeads, range)));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-navy-700" />
            <h2 className="text-sm font-semibold text-gray-900">UK forecast pressure map</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">Forecasted lead demand, expected instructions and capacity gaps by UK region.</p>
        </div>
        <button
          type="button"
          onClick={() => selected && onLeads(selected)}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300"
        >
          Open regional leads <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="overflow-hidden rounded-lg bg-sky-50 p-3">
          <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-[430px] w-full" role="img" aria-label="UK forecast pressure map">
            <defs>
              <linearGradient id="forecast-water" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#e0f2fe" />
              </linearGradient>
              <filter id="forecast-shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f172a" floodOpacity="0.12" />
              </filter>
            </defs>
            <rect width={MAP_W} height={MAP_H} rx={12} fill="url(#forecast-water)" />
            <path d="M0 330 C120 300 215 322 330 292 C445 263 550 280 680 248 L680 430 L0 430 Z" fill="#bae6fd" opacity={0.45} />
            <g transform="translate(174 5) scale(1.08 0.98)" filter="url(#forecast-shadow)">
              <path d="M167 18 C141 33 128 56 136 84 C118 91 113 110 126 128 C108 144 112 171 134 181 C127 209 137 229 160 235 C148 259 158 285 184 292 C174 315 185 335 209 339 C199 358 207 382 235 395 C263 409 294 395 292 369 C291 344 268 331 250 318 C263 302 259 281 240 270 C252 251 244 230 220 224 C230 199 219 178 194 174 C207 151 201 132 179 126 C194 105 191 82 170 73 C189 54 188 31 167 18 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.8} />
              <path d="M100 159 C78 171 66 195 76 216 C88 239 122 235 132 213 C141 193 127 167 100 159 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.8} />
              <path d="M118 287 C92 302 82 335 97 360 C112 385 150 379 162 351 C173 326 151 292 118 287 Z" fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.8} />
            </g>
            <text x={420} y={246} fontSize={24} fontWeight={700} fill="#94a3b8" opacity={0.25}>ENGLAND</text>
            <text x={282} y={286} fontSize={15} fontWeight={700} fill="#94a3b8" opacity={0.35}>WALES</text>
            <text x={335} y={86} fontSize={15} fontWeight={700} fill="#94a3b8" opacity={0.35}>SCOTLAND</text>

            {regions.map((region) => {
              const x = (region.x / 100) * MAP_W;
              const y = (region.y / 100) * MAP_H;
              const demand = scaleRangeCount(region.forecastLeads, range);
              const instructions = scaleRangeCount(region.forecastInstructions, range);
              const gap = region.forecastInstructions - region.capacity;
              const active = selected?.key === region.key;
              const radius = 7 + (demand / maxLeads) * 14;
              const color = gap > 1 ? '#ef4444' : gap === 1 ? '#f59e0b' : '#16a34a';
              return (
                <g
                  key={region.key}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedKey(region.key);
                    onOpen(region);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedKey(region.key);
                      onOpen(region);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <circle cx={x} cy={y} r={radius + (active ? 5 : 0)} fill={color} fillOpacity={active ? 0.2 : 0.11} />
                  <circle cx={x} cy={y} r={radius} fill={color} fillOpacity={0.95} stroke="#ffffff" strokeWidth={2} />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">{demand}</text>
                  <text x={x + 12} y={y - radius - 8} fontSize={10.5} fontWeight={700} fill="#334155">{region.label}</text>
                  <text x={x + 12} y={y - radius + 4} fontSize={9.5} fill="#64748b">{instructions} instr. · gap {Math.max(0, gap)}</text>
                </g>
              );
            })}
          </svg>
        </div>

        {selected && (
          <div className="space-y-3">
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selected.label}</div>
                  <div className="text-xs text-gray-500">{selected.area}</div>
                </div>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600">{selected.confidence}% conf.</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div><span className="text-gray-500">Forecast leads</span><div className="font-semibold tabular-nums text-gray-900">{fmt(scaleRangeCount(selected.forecastLeads, range))}</div></div>
                <div><span className="text-gray-500">Instructions</span><div className="font-semibold tabular-nums text-gray-900">{fmt(scaleRangeCount(selected.forecastInstructions, range))}</div></div>
                <div><span className="text-gray-500">Capacity</span><div className="font-semibold tabular-nums text-gray-900">{fmt(scaleRangeCount(selected.capacity, range))}</div></div>
                <div><span className="text-gray-500">Avg fee</span><div className="font-semibold tabular-nums text-gray-900">{money(selected.avgFee)}</div></div>
                <div><span className="text-gray-500">Top source</span><div className="font-semibold text-gray-900">{selected.topSource}</div></div>
                <div><span className="text-gray-500">Conversion</span><div className="font-semibold tabular-nums text-gray-900">{pct(selected.conversion)}</div></div>
              </div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3 text-sm leading-6 text-indigo-950">
              {selected.marketSignal}. {selected.action}
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500">
              Map colors: green has spare capacity, amber is tight, red means forecast instructions exceed capacity.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const SourceForecast: React.FC<{
  sources: ForecastSource[];
  range: string;
  onOpen: (source: ForecastSource) => void;
}> = ({ sources, range, onOpen }) => {
  const maxLeads = Math.max(1, ...sources.map((source) => source.forecastLeads));
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-navy-700" />
        <h2 className="text-sm font-semibold text-gray-900">Lead source forecast</h2>
      </div>
      <p className="mt-0.5 text-xs text-gray-500">Volume is not enough; Connor can see which lead sources become instructions.</p>
      <div className="mt-3 space-y-3">
        {sources.map((source) => (
          <button key={source.source} type="button" onClick={() => onOpen(source)} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-gray-900">{source.source}</div>
                <div className="text-xs text-gray-500">{source.action}</div>
              </div>
              <span className="text-sm font-semibold tabular-nums text-gray-900">{fmt(scaleRangeCount(source.expectedInstructions, range))} instr.</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(6, (source.forecastLeads / maxLeads) * 100)}%`, backgroundColor: source.conversion >= 27 ? '#16a34a' : source.conversion >= 24 ? '#f59e0b' : '#1e3a8a' }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
              <span>{fmt(scaleRangeCount(source.forecastLeads, range))} leads</span>
              <span>{pct(source.conversion)} convert</span>
              <span>{money(source.costPerInstruction)} CPI</span>
              <span>{source.confidence}% confidence</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const CapacityPlanner: React.FC<{
  teams: ForecastCapacity[];
  range: string;
  onOpen: (team: ForecastCapacity) => void;
}> = ({ teams, range, onOpen }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <Users className="h-4 w-4 text-navy-700" />
      <h2 className="text-sm font-semibold text-gray-900">Capacity planner</h2>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">Forecast demand against teams before bottlenecks become missed calls or slow files.</p>
    <div className="mt-3 space-y-3">
      {teams.map((team) => {
        const forecast = scaleRangeCount(team.forecastCases, range);
        const capacity = scaleRangeCount(team.capacity, range);
        const load = Math.min(130, (forecast / Math.max(capacity, 1)) * 100);
        return (
          <button key={team.team} type="button" onClick={() => onOpen(team)} className="w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div>
                <div className="font-semibold text-gray-900">{team.team}</div>
                <div className="text-xs text-gray-500">{team.owner} · {team.action}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold tabular-nums text-gray-900">{forecast}/{capacity}</div>
                <div className="text-xs" style={{ color: RISK_HEX[team.risk] }}>{team.risk} risk</div>
              </div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full" style={{ width: `${Math.max(4, load)}%`, backgroundColor: RISK_HEX[team.risk] }} />
            </div>
          </button>
        );
      })}
    </div>
  </div>
);

const ExternalSignals: React.FC<{ data: FC }> = ({ data }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2">
      <Brain className="h-4 w-4 text-navy-700" />
      <h2 className="text-sm font-semibold text-gray-900">Market signals feeding the forecast</h2>
    </div>
    <p className="mt-0.5 text-xs text-gray-500">Where live wiring should connect official property movement to APCM lead and instruction-handoff forecasts.</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {data.externalSignals.map((signal) => (
        <div key={signal.label} className="rounded-lg bg-gray-50 p-3">
          <div className="flex items-start gap-2">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_HEX[signal.tone] }} />
            <div>
              <div className="text-sm font-semibold text-gray-900">{signal.label}</div>
              <div className="text-xs text-gray-500">{signal.source} · {signal.value}</div>
              <p className="mt-1 text-xs leading-5 text-gray-600">{signal.impact} {signal.action}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Forecast: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<FC | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');
  const [drawerItem, setDrawerItem] = useState<any | null>(null);

  useEffect(() => {
    let active = true;
    fetchForecast()
      .then((d) => { if (active) setData(d); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rangeData = useMemo<FC | null>(() => {
    if (!data) return null;
    return {
      ...data,
      kpis: data.kpis.map((kpi) => {
        if (kpi.label.startsWith('Instructions')) {
          return { ...kpi, value: scaleRangeCount(58, range).toLocaleString(), sub: `±${scaleRangeCount(6, range)} · ${scaleRangeCount(52, range)} actual Jun` };
        }
        if (kpi.label.startsWith('Revenue')) {
          return { ...kpi, value: `£${scaleRangeCount(74, range)}k`, sub: `±£${scaleRangeCount(8, range)}k forecast` };
        }
        if (kpi.label.startsWith('Completions')) return { ...kpi, value: scaleRangeCount(16, range).toLocaleString() };
        if (kpi.label.startsWith('Lead volume')) return { ...kpi, value: scaleRangeCount(240, range).toLocaleString() };
        return kpi;
      }),
      instructions: scaleSeries(data.instructions, range),
      revenue: scaleSeries(data.revenue, range),
      leadVolume: scaleSeries(data.leadVolume, range),
    };
  }, [data, range]);

  if (loading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const activeData = rangeData ?? data;
  const sourceBars = data.sources.map((source) => ({
    label: source.source,
    count: scaleRangeCount(source.expectedInstructions, range),
    tone: source.conversion >= 27 ? 'good' as const : source.conversion >= 24 ? 'warn' as const : 'info' as const,
  }));
  const matterBars = data.matterMix.map((matter) => ({
    label: matter.type,
    count: scaleRangeCount(matter.expectedInstructions, range),
    tone: matter.capacityRisk === 'high' ? 'bad' as const : matter.capacityRisk === 'medium' ? 'warn' as const : 'good' as const,
  }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950 text-white">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h1 className="text-2xl font-semibold text-gray-900">
              Forecast<span className="font-serif italic text-navy-700">.</span>
            </h1>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Leads, sources, regions, instructions, handoff pressure, instruction value and capacity in one planning view.
          </p>
        </div>
        <RangeFilter value={range} onChange={setRange} />
      </div>

      <MarketingKpiStrip kpis={activeData.kpis} />

      <ForecastBridge data={data} range={range} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-navy-700" />
                <h2 className="text-sm font-semibold text-gray-900">Connor's forecast actions</h2>
              </div>
              <p className="mt-0.5 text-xs text-gray-500">What the forecast changes operationally this week.</p>
            </div>
            <button type="button" onClick={() => navigate('/apcm-ai?ask=Summarise the forecast risks for Connor')} className="inline-flex items-center gap-1.5 self-start rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-navy-700 hover:border-navy-300">
              Ask APCM AI <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {data.actions.map((action) => (
              <button key={action.title} type="button" onClick={() => navigate(action.href)} className="rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: action.priority === 'high' ? '#ef4444' : action.priority === 'medium' ? '#f59e0b' : '#16a34a' }} />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{action.title}</div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{action.detail}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-navy-700" />
            <h2 className="text-sm font-semibold text-gray-900">Scenario planner</h2>
          </div>
          <div className="mt-3 space-y-3">
            {data.scenarios.map((scenario) => (
              <div key={scenario.label} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{scenario.label}</div>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{scenario.note}</p>
                  </div>
                  <span className="text-lg font-bold tabular-nums text-green-700">{money(scaleRangeMoney(scenario.revenue, range))}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-gray-500">
                  <span>{scenario.leadDelta > 0 ? '+' : ''}{scenario.leadDelta}% leads</span>
                  <span>{fmt(scaleRangeCount(scenario.instructions, range))} instr.</span>
                  <span>{scenario.capacityGap > 0 ? `${scenario.capacityGap} gap` : 'covered'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <RegionalForecastMap
        regions={data.regions}
        range={range}
        onOpen={(region) => setDrawerItem(signalFromRegion(region, range))}
        onLeads={(region) => navigate(`/lead-management?forecastRegion=${encodeURIComponent(region.key)}`)}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
        <SourceForecast sources={data.sources} range={range} onOpen={(source) => setDrawerItem(signalFromSource(source, range))} />
        <div className="space-y-5">
          <RankedBarList title="Expected instructions by source" caption={rangeLabel(range)} items={sourceBars} defaultTone="good" />
          <RankedBarList title="Matter mix pressure" caption="Instruction forecast by transaction type" items={matterBars} defaultTone="warn" />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <CapacityPlanner teams={data.capacity} range={range} onOpen={(team) => setDrawerItem(signalFromCapacity(team, range))} />
        <ExternalSignals data={data} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <ForecastChart title="Instructions forecast" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={activeData.instructions.labels} actual={activeData.instructions.actual} forecast={activeData.instructions.forecast} lower={activeData.instructions.lower} upper={activeData.instructions.upper} />
        <ForecastChart title="Instruction value forecast (£k)" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={activeData.revenue.labels} actual={activeData.revenue.actual} forecast={activeData.revenue.forecast} lower={activeData.revenue.lower} upper={activeData.revenue.upper} />
      </div>

      <ForecastChart title="Lead volume forecast" caption={`Actual + projection (± range) · ${rangeLabel(range)}`} labels={activeData.leadVolume.labels} actual={activeData.leadVolume.actual} forecast={activeData.leadVolume.forecast} lower={activeData.leadVolume.lower} upper={activeData.leadVolume.upper} />

      <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
        <span>{data.note}</span>
      </div>

      <SignalDrawer item={drawerItem} onClose={() => setDrawerItem(null)} />
    </div>
  );
};

export default Forecast;
