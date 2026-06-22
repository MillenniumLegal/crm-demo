import React, { useMemo, useState } from "react";
import { MapPin, Search, Tags } from "lucide-react";
import type {
  LeadOriginAnalytics,
  LeadOriginLookup,
  LeadOriginRegion,
} from "@/services/hubsService";
import {
  RangeFilter,
  rangeLabel,
  scaleRangeCount,
} from "@/components/analytics/RangeFilter";

interface Props {
  data: LeadOriginAnalytics;
  onOpenRegion?: (region: LeadOriginRegion) => void;
}

type LookupRow = LeadOriginLookup & { region: LeadOriginRegion };

const PALETTE = [
  "#1e3a8a",
  "#16a34a",
  "#f59e0b",
  "#ef4444",
  "#4338ca",
  "#0ea5e9",
  "#0f766e",
  "#be123c",
  "#7c3aed",
  "#64748b",
];

const MAP_W = 360;
const MAP_H = 430;

const fmt = (n: number) => n.toLocaleString();
const fmtMoney = (n: number) => `£${fmt(Math.round(n))}`;

const chipClass = (active: boolean) =>
  `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    active ? "" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
  }`;

const makeOptions = (regions: LeadOriginRegion[], field: "source" | "transaction") => [
  "All",
  ...Array.from(new Set(regions.map((r) => r[field]))).sort(),
];

const scaleRegion = (region: LeadOriginRegion, range: string) => ({
  leads: scaleRangeCount(region.leads, range),
  quotes: scaleRangeCount(region.quotes, range),
  instructions: scaleRangeCount(region.instructions, range),
  hot: scaleRangeCount(region.hot, range),
});

const aggregateRows = (
  regions: LeadOriginRegion[],
  range: string,
  field: "label" | "source" | "transaction",
) => {
  const totals = new Map<string, number>();
  regions.forEach((region) => {
    const key = region[field];
    totals.set(key, (totals.get(key) ?? 0) + scaleRangeCount(region.leads, range));
  });
  return Array.from(totals.entries())
    .map(([label, count], index) => ({
      label,
      count,
      color: PALETTE[index % PALETTE.length],
    }))
    .sort((a, b) => b.count - a.count);
};

const topRows = (rows: Array<{ label: string; count: number; color: string }>) => {
  if (rows.length <= 6) return rows;
  const visible = rows.slice(0, 5);
  const rest = rows.slice(5).reduce((sum, row) => sum + row.count, 0);
  return visible.concat([{ label: "Other UK", count: rest, color: "#94a3b8" }]);
};

const PieBreakdown: React.FC<{
  title: string;
  caption: string;
  rows: Array<{ label: string; count: number; color: string }>;
}> = ({ title, caption, rows }) => {
  const visibleRows = topRows(rows);
  const total = visibleRows.reduce((sum, row) => sum + row.count, 0);
  let cursor = 0;
  const gradient = total > 0
    ? visibleRows
        .map((row) => {
          const start = cursor;
          const end = cursor + (row.count / Math.max(total, 1)) * 360;
          cursor = end;
          return `${row.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
        })
        .join(", ")
    : "#e5e7eb 0deg 360deg";

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500">{caption}</div>
        </div>
        <div
          className="relative h-20 w-20 shrink-0 rounded-full"
          style={{ background: `conic-gradient(${gradient})` }}
          aria-label={`${title} pie chart`}
        >
          <div className="absolute inset-4 rounded-full bg-white" />
          <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums text-gray-800">
            {fmt(total)}
          </div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {visibleRows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <div key={row.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                <span className="truncate text-gray-700">{row.label}</span>
              </span>
              <span className="shrink-0 tabular-nums text-gray-500">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const LeadOriginMap: React.FC<Props> = ({ data, onOpenRegion }) => {
  const [range, setRange] = useState("30d");
  const [source, setSource] = useState("All");
  const [transaction, setTransaction] = useState("All");
  const [selectedKey, setSelectedKey] = useState(data.regions[0]?.key ?? "");
  const [query, setQuery] = useState("");

  const sourceOptions = useMemo(() => makeOptions(data.regions, "source"), [data.regions]);
  const transactionOptions = useMemo(() => makeOptions(data.regions, "transaction"), [data.regions]);

  const filteredRegions = useMemo(() => {
    return data.regions.filter((region) => {
      const sourceMatch = source === "All" || region.source === source;
      const transactionMatch = transaction === "All" || region.transaction === transaction;
      return sourceMatch && transactionMatch;
    });
  }, [data.regions, source, transaction]);

  const selectedRegion =
    filteredRegions.find((region) => region.key === selectedKey) ?? filteredRegions[0] ?? null;

  const selectedStats = selectedRegion ? scaleRegion(selectedRegion, range) : null;
  const lookupRegions = query.trim() ? data.regions : filteredRegions;
  const allLookups = lookupRegions.flatMap((region) =>
    region.sample.map((sample) => ({ ...sample, region })),
  );
  const lookupRows: LookupRow[] = (query.trim() ? allLookups : selectedRegion ? selectedRegion.sample.map((sample) => ({ ...sample, region: selectedRegion })) : [])
    .filter((row) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return true;
      return [
        row.lead,
        row.ip,
        row.city,
        row.source,
        row.transaction,
        row.status,
        row.region.label,
      ].some((value) => value.toLowerCase().includes(needle));
    });

  const totalLeads = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.leads, range), 0);
  const totalInstructions = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.instructions, range), 0);
  const totalHot = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.hot, range), 0);
  const conversion = Math.round((totalInstructions / Math.max(totalLeads, 1)) * 100);
  const maxLeads = Math.max(1, ...filteredRegions.map((region) => scaleRangeCount(region.leads, range)));

  const regionRows = aggregateRows(filteredRegions, range, "label");
  const sourceRows = aggregateRows(filteredRegions, range, "source");
  const transactionRows = aggregateRows(filteredRegions, range, "transaction");

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setSelectedKey("");
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-navy-700" />
            <h3 className="text-sm font-semibold text-gray-900">UK lead origin map</h3>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            GeoIP reverse lookup, source quality and instruction movement by UK region.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
          <RangeFilter value={range} onChange={setRange} />
          <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
            {data.mappedPct}% mapped
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Tags className="h-3.5 w-3.5 text-gray-400" />
            {sourceOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeFilter(setSource, option)}
                className={chipClass(source === option)}
                style={source === option ? { backgroundColor: "#1e3a8a", color: "#ffffff" } : undefined}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {transactionOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => changeFilter(setTransaction, option)}
                className={chipClass(transaction === option)}
                style={transaction === option ? { backgroundColor: "#4338ca", color: "#ffffff" } : undefined}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-hidden rounded-lg bg-slate-50 p-3">
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="h-[430px] w-full" role="img" aria-label="UK lead origin map">
              <rect width={MAP_W} height={MAP_H} rx={10} fill="#f8fafc" />
              <path
                d="M167 18 C141 33 128 56 136 84 C118 91 113 110 126 128 C108 144 112 171 134 181 C127 209 137 229 160 235 C148 259 158 285 184 292 C174 315 185 335 209 339 C199 358 207 382 235 395 C263 409 294 395 292 369 C291 344 268 331 250 318 C263 302 259 281 240 270 C252 251 244 230 220 224 C230 199 219 178 194 174 C207 151 201 132 179 126 C194 105 191 82 170 73 C189 54 188 31 167 18 Z"
                fill="#e2e8f0"
                stroke="#cbd5e1"
                strokeWidth={2}
              />
              <path
                d="M100 159 C78 171 66 195 76 216 C88 239 122 235 132 213 C141 193 127 167 100 159 Z"
                fill="#e2e8f0"
                stroke="#cbd5e1"
                strokeWidth={2}
              />
              <path
                d="M118 287 C92 302 82 335 97 360 C112 385 150 379 162 351 C173 326 151 292 118 287 Z"
                fill="#e2e8f0"
                stroke="#cbd5e1"
                strokeWidth={2}
              />
              <path
                d="M251 334 C273 345 285 362 281 381 C273 411 232 416 210 394 C230 382 241 361 251 334 Z"
                fill="#e2e8f0"
                stroke="#cbd5e1"
                strokeWidth={2}
              />
              {filteredRegions.map((region) => {
                const stats = scaleRegion(region, range);
                const x = (region.x / 100) * MAP_W;
                const y = (region.y / 100) * MAP_H;
                const radius = 7 + (stats.leads / maxLeads) * 14;
                const active = selectedRegion?.key === region.key;
                return (
                  <g
                    key={region.key}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedKey(region.key)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") setSelectedKey(region.key);
                    }}
                    className="cursor-pointer"
                  >
                    <line x1={x} y1={y + radius} x2={x} y2={y + radius + 12} stroke="#94a3b8" strokeWidth={1} />
                    <circle
                      cx={x}
                      cy={y}
                      r={radius + (active ? 5 : 0)}
                      fill={active ? "#4338ca" : "#1e3a8a"}
                      fillOpacity={active ? 0.18 : 0.12}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={radius}
                      fill={active ? "#4338ca" : "#1e3a8a"}
                      fillOpacity={0.92}
                      stroke="#ffffff"
                      strokeWidth={2}
                    />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#ffffff">
                      {stats.leads}
                    </text>
                    <text x={x + radius + 6} y={y + 4} fontSize={10} fontWeight={600} fill="#334155">
                      {region.label}
                    </text>
                    <title>{`${region.label}: ${stats.leads} leads, ${stats.instructions} instructions`}</title>
                  </g>
                );
              })}
              {filteredRegions.length === 0 && (
                <text x={MAP_W / 2} y={MAP_H / 2} textAnchor="middle" fontSize={13} fill="#94a3b8">
                  No matching UK lead origins
                </text>
              )}
            </svg>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-navy-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-navy-700">Mapped leads</div>
              <div className="text-2xl font-bold tabular-nums text-gray-900">{fmt(totalLeads)}</div>
              <div className="text-xs text-gray-500">{rangeLabel(range)}</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-green-700">Instructions</div>
              <div className="text-2xl font-bold tabular-nums text-gray-900">{fmt(totalInstructions)}</div>
              <div className="text-xs text-gray-500">{conversion}% conversion</div>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-amber-700">Hot signals</div>
              <div className="text-2xl font-bold tabular-nums text-gray-900">{fmt(totalHot)}</div>
              <div className="text-xs text-gray-500">location-backed</div>
            </div>
            <div className="rounded-lg bg-indigo-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-indigo-700">Updated</div>
              <div className="text-lg font-bold text-gray-900">{data.updatedAt}</div>
              <div className="text-xs text-gray-500">GeoIP cache</div>
            </div>
          </div>

          {selectedRegion && selectedStats ? (
            <div className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selectedRegion.label}</div>
                  <div className="text-xs text-gray-500">{selectedRegion.area}</div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenRegion && onOpenRegion(selectedRegion)}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-navy-700 hover:bg-navy-50"
                >
                  Open leads
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-gray-500">Leads / quotes</div>
                  <div className="font-semibold tabular-nums text-gray-900">{fmt(selectedStats.leads)} / {fmt(selectedStats.quotes)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Instructions</div>
                  <div className="font-semibold tabular-nums text-gray-900">{fmt(selectedStats.instructions)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Best window</div>
                  <div className="font-semibold text-gray-900">{selectedRegion.bestWindow}</div>
                </div>
                <div>
                  <div className="text-gray-500">Avg fee</div>
                  <div className="font-semibold tabular-nums text-gray-900">{fmtMoney(selectedRegion.avgFee)}</div>
                </div>
                <div>
                  <div className="text-gray-500">Top source</div>
                  <div className="font-semibold text-gray-900">{selectedRegion.source}</div>
                </div>
                <div>
                  <div className="text-gray-500">Lookup confidence</div>
                  <div className="font-semibold tabular-nums text-gray-900">{selectedRegion.confidence}%</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-6 text-center text-sm text-gray-400">
              No region matches the selected filters.
            </div>
          )}

          <div className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-950">
            {data.note}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <PieBreakdown title="Regional share" caption="Mapped lead volume" rows={regionRows} />
        <PieBreakdown title="Source mix" caption="Where located leads entered" rows={sourceRows} />
        <PieBreakdown title="Matter type mix" caption="By location signal" rows={transactionRows} />
      </div>

      <div className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">IP lookup ledger</div>
            <div className="text-xs text-gray-500">Selected region by default; search checks every UK lookup.</div>
          </div>
          <label className="relative block w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search lead, IP, city..."
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-navy-300 focus:ring-2 focus:ring-navy-100"
            />
          </label>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase text-gray-400">
                <th className="py-2 pr-3 text-left font-medium">Lead</th>
                <th className="px-3 py-2 text-left font-medium">IP / city</th>
                <th className="px-3 py-2 text-left font-medium">Region</th>
                <th className="px-3 py-2 text-left font-medium">Source</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="py-2 pl-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {lookupRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-gray-400">
                    No matching lookup rows.
                  </td>
                </tr>
              ) : (
                lookupRows.map((row) => (
                  <tr key={`${row.region.key}-${row.leadId}`} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-semibold text-gray-900">{row.lead}</div>
                      <div className="text-xs text-gray-400">{row.createdAt}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-gray-700">{row.ip}</div>
                      <div className="text-xs text-gray-500">{row.city}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{row.region.label}</td>
                    <td className="px-3 py-2 text-gray-700">{row.source}</td>
                    <td className="px-3 py-2 text-gray-700">{row.transaction}</td>
                    <td className="py-2 pl-3 text-right">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
