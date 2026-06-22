import React from "react";
import { Sparkline } from "@/components/trends/Sparkline";

interface MktCampaign {
  name: string;
  source: string;
  spend: number;
  clicks: number;
  leads: number;
  instructions: number;
  cpl: number;
  cpi: number;
  conversion: number;
  recommend: "scale" | "hold" | "cut";
  spark: number[];
}

interface Props {
  campaigns: MktCampaign[];
}

const fmtSpendK = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    return "£" + (Number.isInteger(k) ? k.toString() : k.toFixed(1)) + "k";
  }
  return "£" + Math.round(n).toString();
};

const cpiColor = (cpi: number): string => {
  if (cpi < 150) return "#16a34a";
  if (cpi < 300) return "#f59e0b";
  return "#ef4444";
};

const actionMeta: Record<
  MktCampaign["recommend"],
  { label: string; cls: string }
> = {
  scale: { label: "Scale", cls: "bg-green-50 text-green-700" },
  hold: { label: "Hold", cls: "bg-blue-50 text-blue-700" },
  cut: { label: "Cut", cls: "bg-red-50 text-red-700" },
};

export const CampaignPerformance: React.FC<Props> = ({ campaigns }) => {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-900">
          Campaign performance
        </h3>
        <p className="text-xs text-gray-500">
          Cost per instruction and what to do
        </p>
      </div>

      {!campaigns || campaigns.length === 0 ? (
        <p className="text-xs text-gray-500">No campaigns yet</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase text-gray-400">
                <th className="py-2 pr-3 text-left font-medium">Campaign</th>
                <th className="py-2 px-3 text-right font-medium">Spend</th>
                <th className="py-2 px-3 text-right font-medium">Leads</th>
                <th className="py-2 px-3 text-right font-medium">
                  Instructions
                </th>
                <th className="py-2 px-3 text-right font-medium">Cost/instr</th>
                <th className="py-2 px-3 text-right font-medium">Conversion</th>
                <th className="py-2 px-3 text-left font-medium">Trend</th>
                <th className="py-2 pl-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => {
                const action = actionMeta[c.recommend];
                return (
                  <tr
                    key={c.name + i}
                    className="border-t border-gray-200 align-middle"
                  >
                    <td className="py-2 pr-3 text-left">
                      <div className="font-semibold text-gray-900">
                        {c.name}
                      </div>
                      <div className="text-xs text-gray-500">{c.source}</div>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {fmtSpendK(c.spend)}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {c.leads}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {c.instructions}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      <span
                        className="font-semibold"
                        style={{ color: cpiColor(c.cpi) }}
                      >
                        £{c.cpi}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-700">
                      {c.conversion}%
                    </td>
                    <td className="py-2 px-3 text-left">
                      <Sparkline
                        points={c.spark}
                        width={70}
                        height={22}
                        color="#1e3a8a"
                      />
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium " +
                          action.cls
                        }
                      >
                        {action.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
