import React, { useMemo, useState } from "react";
import { LocateFixed, MapPin, Search, Tags } from "lucide-react";
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
type Point = { lat: number; lng: number };

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

const CITY_COORDS: Record<string, Point> = {
  Belfast: { lat: 54.5973, lng: -5.9301 },
  Birmingham: { lat: 52.4862, lng: -1.8904 },
  Brighton: { lat: 50.8225, lng: -0.1372 },
  Bristol: { lat: 51.4545, lng: -2.5879 },
  Cambridge: { lat: 52.2053, lng: 0.1218 },
  Cardiff: { lat: 51.4816, lng: -3.1791 },
  Croydon: { lat: 51.3762, lng: -0.0982 },
  Edinburgh: { lat: 55.9533, lng: -3.1883 },
  Enfield: { lat: 51.6523, lng: -0.0807 },
  Exeter: { lat: 50.7184, lng: -3.5339 },
  Glasgow: { lat: 55.8642, lng: -4.2518 },
  Guildford: { lat: 51.2362, lng: -0.5704 },
  Leeds: { lat: 53.8008, lng: -1.5491 },
  Liverpool: { lat: 53.4084, lng: -2.9916 },
  London: { lat: 51.5072, lng: -0.1276 },
  Manchester: { lat: 53.4808, lng: -2.2426 },
  Newcastle: { lat: 54.9783, lng: -1.6178 },
  Nottingham: { lat: 52.9548, lng: -1.1581 },
  Sheffield: { lat: 53.3811, lng: -1.4701 },
  Swansea: { lat: 51.6214, lng: -3.9436 },
  Warrington: { lat: 53.3900, lng: -2.5970 },
};

const TILE_SIZE = 256;
const MAP_W = 760;
const MAP_H = 430;
const DEFAULT_CENTER: Point = { lat: 53.1, lng: -2.4 };

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

const hashOffset = (value: string, axis: "lat" | "lng") => {
  let hash = axis === "lat" ? 17 : 29;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) % 997;
  return ((hash % 41) - 20) / 1000;
};

const pointForRow = (row: LeadOriginLookup): Point => {
  const base = CITY_COORDS[row.city] ?? DEFAULT_CENTER;
  return {
    lat: base.lat + hashOffset(row.leadId, "lat"),
    lng: base.lng + hashOffset(row.leadId, "lng"),
  };
};

const lngToWorldX = (lng: number, zoom: number) => {
  const scale = TILE_SIZE * 2 ** zoom;
  return ((lng + 180) / 360) * scale;
};

const latToWorldY = (lat: number, zoom: number) => {
  const scale = TILE_SIZE * 2 ** zoom;
  const sin = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
};

const rowPoint = (row: LookupRow, center: Point, zoom: number) => {
  const rowPos = pointForRow(row);
  const centerX = lngToWorldX(center.lng, zoom);
  const centerY = latToWorldY(center.lat, zoom);
  return {
    x: lngToWorldX(rowPos.lng, zoom) - centerX + MAP_W / 2,
    y: latToWorldY(rowPos.lat, zoom) - centerY + MAP_H / 2,
  };
};

const regionCenter = (region: LeadOriginRegion): Point => {
  if (!region.sample.length) return DEFAULT_CENTER;
  const points = region.sample.map(pointForRow);
  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length,
  };
};

const aggregateRows = (
  rows: LookupRow[],
  range: string,
  field: "region" | "city" | "source" | "transaction",
) => {
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const key = field === "region" ? row.region.label : row[field];
    totals.set(key, (totals.get(key) ?? 0) + scaleRangeCount(1, range));
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
  return visible.concat([{ label: "Other", count: rest, color: "#94a3b8" }]);
};

const recommendationFor = (
  selectedRow: LookupRow | null,
  selectedRegion: LeadOriginRegion | null,
  selectedCityRows: LookupRow[],
) => {
  if (selectedRow) {
    const status = selectedRow.status.toLowerCase();
    if (status.includes("instruction") || status.includes("accepted")) {
      return `Prioritise ${selectedRow.lead}: ${selectedRow.city} is showing instruction intent. Keep the next contact inside the ${selectedRow.region.bestWindow} window and route this through the fastest fee-earner.`;
    }
    if (status.includes("callback")) {
      return `Connor should protect the callback for ${selectedRow.lead}. ${selectedRow.city} leads in this set are best reached around ${selectedRow.region.bestWindow}.`;
    }
    return `Use ${selectedRow.city} as the local proof point: mention remote conveyancing confidence, speed, and recent ${selectedRow.transaction.toLowerCase()} wins from the same area.`;
  }

  if (!selectedRegion) {
    return "Select a pin or region to get a location-specific next move.";
  }

  const hotShare = Math.round((selectedRegion.hot / Math.max(selectedRegion.leads, 1)) * 100);
  const cityNames = Array.from(new Set(selectedCityRows.map((row) => row.city))).slice(0, 3).join(", ");
  if (hotShare >= 28) {
    return `${selectedRegion.label} is hot-heavy (${hotShare}% hot). Ring this patch before broad queue work; start with ${cityNames || selectedRegion.area}.`;
  }
  if (selectedRegion.source === "Bing") {
    return `${selectedRegion.label} is Bing-led. Keep the ad copy practical and price-clear, then compare call pickup against Peak Hours before scaling spend.`;
  }
  return `${selectedRegion.label} is a steady source. Use the ${selectedRegion.bestWindow} window and watch quote-to-instruction movement before increasing paid traffic.`;
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

const TileMap: React.FC<{
  rows: LookupRow[];
  selectedRow: LookupRow | null;
  center: Point;
  zoom: number;
  onZoom: (zoom: number) => void;
  onCenter: (point: Point) => void;
  onSelectRow: (row: LookupRow) => void;
}> = ({ rows, selectedRow, center, zoom, onZoom, onCenter, onSelectRow }) => {
  const centerX = lngToWorldX(center.lng, zoom);
  const centerY = latToWorldY(center.lat, zoom);
  const left = centerX - MAP_W / 2;
  const top = centerY - MAP_H / 2;
  const tileStartX = Math.floor(left / TILE_SIZE);
  const tileEndX = Math.floor((left + MAP_W) / TILE_SIZE);
  const tileStartY = Math.floor(top / TILE_SIZE);
  const tileEndY = Math.floor((top + MAP_H) / TILE_SIZE);
  const tiles: Array<{ key: string; x: number; y: number; tileX: number; tileY: number }> = [];
  const maxTile = 2 ** zoom;

  for (let tileX = tileStartX; tileX <= tileEndX; tileX++) {
    for (let tileY = tileStartY; tileY <= tileEndY; tileY++) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
      tiles.push({
        key: `${zoom}-${tileX}-${tileY}`,
        x: tileX * TILE_SIZE - left,
        y: tileY * TILE_SIZE - top,
        tileX: wrappedX,
        tileY,
      });
    }
  }

  return (
    <div className="relative mt-4 h-[430px] overflow-hidden rounded-lg border border-gray-200 bg-slate-100">
      {tiles.map((tile) => (
        <img
          key={tile.key}
          src={`https://tile.openstreetmap.org/${zoom}/${tile.tileX}/${tile.tileY}.png`}
          alt=""
          draggable={false}
          className="absolute select-none"
          style={{ left: tile.x, top: tile.y, width: TILE_SIZE, height: TILE_SIZE }}
        />
      ))}

      <div className="absolute left-3 top-3 z-10 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <button type="button" onClick={() => onZoom(Math.min(11, zoom + 1))} className="block h-8 w-8 text-lg font-semibold text-gray-800 hover:bg-gray-50">+</button>
        <button type="button" onClick={() => onZoom(Math.max(5, zoom - 1))} className="block h-8 w-8 border-t border-gray-200 text-lg font-semibold text-gray-800 hover:bg-gray-50">-</button>
      </div>
      <button
        type="button"
        onClick={() => onCenter(DEFAULT_CENTER)}
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <LocateFixed className="h-3.5 w-3.5" />
        Fit UK
      </button>

      {rows.map((row) => {
        const point = rowPoint(row, center, zoom);
        const active = selectedRow?.leadId === row.leadId;
        const visible = point.x > -24 && point.x < MAP_W + 24 && point.y > -24 && point.y < MAP_H + 24;
        if (!visible) return null;
        return (
          <button
            key={row.leadId}
            type="button"
            onClick={() => onSelectRow(row)}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: point.x,
              top: point.y,
              width: active ? 20 : 15,
              height: active ? 20 : 15,
              backgroundColor: active ? "#4338ca" : row.status.toLowerCase().includes("hot") ? "#ef4444" : "#f97316",
              boxShadow: active ? "0 0 0 8px rgba(67,56,202,0.18)" : "0 1px 4px rgba(15,23,42,0.25)",
            }}
            title={`${row.lead} - ${row.city}`}
            aria-label={`${row.lead} in ${row.city}`}
          />
        );
      })}

      <div className="absolute bottom-2 right-2 z-10 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-gray-600">
        © OpenStreetMap
      </div>
    </div>
  );
};

export const LeadOriginMap: React.FC<Props> = ({ data, onOpenRegion }) => {
  const [range, setRange] = useState("30d");
  const [source, setSource] = useState("All");
  const [transaction, setTransaction] = useState("All");
  const [selectedKey, setSelectedKey] = useState(data.regions[0]?.key ?? "");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(6);
  const [center, setCenter] = useState<Point>(DEFAULT_CENTER);

  const sourceOptions = useMemo(() => makeOptions(data.regions, "source"), [data.regions]);
  const transactionOptions = useMemo(() => makeOptions(data.regions, "transaction"), [data.regions]);

  const filteredRegions = useMemo(() => {
    return data.regions.filter((region) => {
      const sourceMatch = source === "All" || region.source === source;
      const transactionMatch = transaction === "All" || region.transaction === transaction;
      return sourceMatch && transactionMatch;
    });
  }, [data.regions, source, transaction]);

  const mapRows = useMemo(() => {
    const baseRows = filteredRegions.flatMap((region) => region.sample.map((sample) => ({ ...sample, region })));
    const needle = query.trim().toLowerCase();
    if (!needle) return baseRows;
    return data.regions
      .flatMap((region) => region.sample.map((sample) => ({ ...sample, region })))
      .filter((row) =>
        [
          row.lead,
          row.ip,
          row.city,
          row.source,
          row.transaction,
          row.status,
          row.region.label,
        ].some((value) => value.toLowerCase().includes(needle)),
      );
  }, [data.regions, filteredRegions, query]);

  const selectedRegion =
    filteredRegions.find((region) => region.key === selectedKey) ??
    mapRows.find((row) => row.leadId === selectedLeadId)?.region ??
    filteredRegions[0] ??
    null;

  const selectedRow = mapRows.find((row) => row.leadId === selectedLeadId) ?? null;
  const selectedStats = selectedRegion ? scaleRegion(selectedRegion, range) : null;
  const lookupRows: LookupRow[] = query.trim()
    ? mapRows
    : selectedRegion
    ? selectedRegion.sample.map((sample) => ({ ...sample, region: selectedRegion }))
    : [];
  const selectedCityRows = selectedRow
    ? mapRows.filter((row) => row.city === selectedRow.city)
    : selectedRegion
    ? mapRows.filter((row) => row.region.key === selectedRegion.key)
    : [];

  const totalLeads = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.leads, range), 0);
  const totalInstructions = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.instructions, range), 0);
  const totalHot = filteredRegions.reduce((sum, region) => sum + scaleRangeCount(region.hot, range), 0);
  const conversion = Math.round((totalInstructions / Math.max(totalLeads, 1)) * 100);

  const regionRows = aggregateRows(mapRows, range, "region");
  const cityRows = aggregateRows(selectedCityRows.length ? selectedCityRows : mapRows, range, "city");
  const sourceRows = aggregateRows(mapRows, range, "source");
  const transactionRows = aggregateRows(mapRows, range, "transaction");
  const recommendation = recommendationFor(selectedRow, selectedRegion, selectedCityRows);

  const changeFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setSelectedKey("");
    setSelectedLeadId("");
  };

  const selectRegion = (region: LeadOriginRegion) => {
    setSelectedKey(region.key);
    setSelectedLeadId("");
    setCenter(regionCenter(region));
    setZoom(8);
  };

  const selectRow = (row: LookupRow) => {
    setSelectedLeadId(row.leadId);
    setSelectedKey(row.region.key);
    setCenter(pointForRow(row));
    setZoom((z) => Math.max(z, 9));
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
            GeoIP reverse lookup plotted as individual UK pins, with source quality and local-area movement.
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

          <TileMap
            rows={mapRows}
            selectedRow={selectedRow}
            center={center}
            zoom={zoom}
            onZoom={setZoom}
            onCenter={setCenter}
            onSelectRow={selectRow}
          />
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
              <div className="text-[11px] font-semibold uppercase text-indigo-700">Pins shown</div>
              <div className="text-2xl font-bold tabular-nums text-gray-900">{fmt(mapRows.length)}</div>
              <div className="text-xs text-gray-500">reverse lookups</div>
            </div>
          </div>

          {selectedRow && (
            <div className="rounded-lg bg-orange-50 p-3">
              <div className="text-[11px] font-semibold uppercase text-orange-700">Selected lookup</div>
              <div className="mt-1 text-sm font-semibold text-gray-900">{selectedRow.lead}</div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-700">
                <div><span className="text-gray-500">IP</span><br /><span className="font-mono">{selectedRow.ip}</span></div>
                <div><span className="text-gray-500">City</span><br />{selectedRow.city}</div>
                <div><span className="text-gray-500">Source</span><br />{selectedRow.source}</div>
                <div><span className="text-gray-500">Status</span><br />{selectedRow.status}</div>
              </div>
            </div>
          )}

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
            <div className="text-[11px] font-semibold uppercase text-indigo-500">Suggested next move</div>
            <div className="mt-1">{recommendation}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <PieBreakdown title="Regional share" caption="Mapped lead volume" rows={regionRows} />
        <PieBreakdown title="Local area share" caption="Selected patch / visible pins" rows={cityRows} />
        <PieBreakdown title="Source mix" caption="Where located leads entered" rows={sourceRows} />
        <PieBreakdown title="Matter type mix" caption="By location signal" rows={transactionRows} />
      </div>

      <div className="mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">IP lookup ledger</div>
            <div className="text-xs text-gray-500">Selected region by default; search checks every UK lookup and recentres pins.</div>
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
                      <button type="button" onClick={() => selectRow(row)} className="text-left font-semibold text-gray-900 hover:text-navy-700">
                        {row.lead}
                      </button>
                      <div className="text-xs text-gray-400">{row.createdAt}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-mono text-xs text-gray-700">{row.ip}</div>
                      <div className="text-xs text-gray-500">{row.city}</div>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => selectRegion(row.region)} className="text-left text-gray-700 hover:text-navy-700">
                        {row.region.label}
                      </button>
                    </td>
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
