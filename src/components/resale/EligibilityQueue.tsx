import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { fetchResaleQueue, ResaleQueue } from "@/services/leadResaleService";

export const EligibilityQueue: React.FC = () => {
  const [data, setData] = useState<ResaleQueue | null>(null);
  const [bucket, setBucket] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    fetchResaleQueue().then((res) => {
      if (active) setData(res);
    });
    return () => {
      active = false;
    };
  }, []);

  const reasonLabel = (r: string): string => {
    switch (r) {
      case "out_of_area":
        return "Out of area";
      case "unconverted":
        return "Unconverted";
      case "wrong_type":
        return "Wrong type";
      case "declined":
        return "Declined quote";
      default:
        return r;
    }
  };

  const freshness = (hrs: number): { label: string; color: string } => {
    if (hrs < 24) return { label: "Fresh", color: "#16a34a" };
    if (hrs < 72) return { label: "Aging", color: "#f59e0b" };
    return { label: "Aged", color: "#ef4444" };
  };

  const money = (n: number): string => (n ? "£" + n.toLocaleString() : "—");

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-500">Loading queue...</p>
      </div>
    );
  }

  const statusOf = (l: { id: string; exclusivity: string }): string =>
    overrides[l.id] || l.exclusivity;

  const filtered = data.leads.filter(
    (l) => bucket === "all" || l.reason === bucket
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Sellable lead queue</h3>
      <p className="text-xs text-gray-500">
        Consented leads you can sell — filter, price, and offer to a buyer
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {data.buckets.map((b) => {
          const isActive = bucket === b.key;
          return (
            <button
              key={b.key}
              onClick={() => setBucket(b.key)}
              className={
                "rounded-full px-3 py-1 text-xs font-medium" +
                (isActive ? "" : " bg-gray-100 text-gray-600")
              }
              style={
                isActive
                  ? { backgroundColor: "#1e3a8a", color: "white" }
                  : undefined
              }
            >
              {b.label + " (" + b.count + ")"}
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-gray-400">
              <th className="text-left font-medium">Lead</th>
              <th className="text-left font-medium">Reason</th>
              <th className="text-left font-medium">Region</th>
              <th className="text-left font-medium">Matter</th>
              <th className="text-right font-medium">Value</th>
              <th className="text-left font-medium">Fresh</th>
              <th className="text-right font-medium">Quality</th>
              <th className="text-right font-medium">Price</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr className="border-t border-gray-100">
                <td colSpan={9} className="py-3 text-center text-xs text-gray-400">
                  No leads in this bucket
                </td>
              </tr>
            ) : (
              filtered.map((lead) => {
                const fresh = freshness(lead.freshnessHrs);
                return (
                  <React.Fragment key={lead.id}>
                    <tr className="border-t border-gray-100">
                      <td className="py-2">
                        <div className="font-medium text-gray-900">
                          {lead.ref}
                        </div>
                        <div className="text-xs text-gray-400">
                          {lead.initials}
                        </div>
                      </td>
                      <td>
                        <span className="inline-block rounded bg-gray-100 px-1.5 text-[11px] text-gray-600">
                          {reasonLabel(lead.reason)}
                        </span>
                      </td>
                      <td className="text-gray-700">{lead.region}</td>
                      <td className="text-gray-700">{lead.matter}</td>
                      <td className="text-right tabular-nums">
                        {money(lead.value)}
                      </td>
                      <td>
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: fresh.color }}
                          />
                          <span className="text-xs">{fresh.label}</span>
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{lead.quality}</td>
                      <td className="text-right">
                        {lead.consent ? (
                          money(lead.price)
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 text-[11px] text-gray-500">
                            <Lock className="h-3 w-3" />
                            no consent
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        {lead.consent ? (
                          <button
                            className="text-xs font-medium text-indigo-700"
                            onClick={() =>
                              setExpandedId(
                                expandedId === lead.id ? "" : lead.id
                              )
                            }
                          >
                            Sell
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>

                    {expandedId === lead.id && (
                      <tr className="border-t-0">
                        <td colSpan={9}>
                          <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                            <div className="text-xs font-medium text-gray-600">
                              Matched buyers
                            </div>
                            <div>
                              {lead.matchedBuyers.length ? (
                                lead.matchedBuyers.map((buyer) => (
                                  <span
                                    key={buyer}
                                    className="inline-block rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs mr-1"
                                  >
                                    {buyer}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-gray-400">
                                  No eligible buyers
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600">
                              {"Computed price: " +
                                money(lead.price) +
                                "  ·  status: " +
                                statusOf(lead)}
                            </div>
                            <div className="flex gap-2">
                              <button
                                disabled={lead.matchedBuyers.length === 0}
                                className="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
                                onClick={() =>
                                  setOverrides({
                                    ...overrides,
                                    [lead.id]: "offered",
                                  })
                                }
                              >
                                Offer to buyer
                              </button>
                              <button
                                className="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white"
                                onClick={() =>
                                  setOverrides({
                                    ...overrides,
                                    [lead.id]: "listed",
                                  })
                                }
                              >
                                List
                              </button>
                              <button
                                className="rounded border border-gray-300 px-2.5 py-1 text-xs hover:bg-white"
                                onClick={() =>
                                  setOverrides({
                                    ...overrides,
                                    [lead.id]: "withheld",
                                  })
                                }
                              >
                                Withhold
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
