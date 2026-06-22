import React from "react";
import { MailOpen } from "lucide-react";

interface OpenConversion {
  openers: { count: number; instructed: number; rate: number };
  nonOpeners: { count: number; instructed: number; rate: number };
  note: string;
}

interface Props {
  data: OpenConversion;
}

export const OpenConversionCompare: React.FC<Props> = ({ data }) => {
  const { openers, nonOpeners, note } = data;
  const maxRate = Math.max(openers.rate, nonOpeners.rate) || 1;
  const multiple = (openers.rate / (nonOpeners.rate || 1)).toFixed(1);

  const rows = [
    { label: "Opened email", ...openers, color: "#16a34a" },
    { label: "Did not open", ...nonOpeners, color: "#94a3b8" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Do openers convert?</h3>
          <p className="text-xs text-gray-500">Instruction rate — opened our email vs not</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-green-700 tabular-nums">{multiple}×</div>
          <div className="text-xs text-gray-500">higher</div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3">
            <span className="w-28 text-sm text-gray-700">{row.label}</span>
            <div className="h-3 flex-1 rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full"
                style={{
                  width: Math.round((row.rate / maxRate) * 100) + "%",
                  backgroundColor: row.color,
                }}
              />
            </div>
            <span className="w-28 text-right text-xs tabular-nums text-gray-600">
              {row.rate}% ({row.instructed}/{row.count})
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50/50 p-3 text-sm text-gray-700">
        <MailOpen className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
        <span>{note}</span>
      </div>
    </div>
  );
};
