import React from "react";

interface EmailTemplateRow {
  name: string;
  sent: number;
  openRate: number;
  bounceRate: number;
  conversion: number;
}

interface Props {
  templates: EmailTemplateRow[];
}

export const TemplatePerformance: React.FC<Props> = ({ templates }) => {
  const bounceColor = (rate: number): string => {
    if (rate < 2) return "#16a34a";
    if (rate < 3) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Template performance</h3>
      <p className="text-xs text-gray-500">Open, bounce and conversion by email template</p>

      {templates.length === 0 ? (
        <p className="mt-4 text-xs text-gray-500">No templates yet</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 text-left font-medium">Template</th>
                <th className="py-2 text-right font-medium">Sent</th>
                <th className="py-2 text-right font-medium">Open rate</th>
                <th className="py-2 text-right font-medium">Bounce</th>
                <th className="py-2 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {templates.map((t, i) => {
                const openWidth = Math.max(0, Math.min(100, t.openRate));
                return (
                  <tr key={`${t.name}-${i}`}>
                    <td className="py-2 pr-3 font-medium text-gray-900">{t.name}</td>
                    <td className="py-2 pl-3 text-right tabular-nums text-gray-700">
                      {t.sent.toLocaleString()}
                    </td>
                    <td className="py-2 pl-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-gray-700">{t.openRate}%</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${openWidth}%`, backgroundColor: "#16a34a" }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums font-medium" style={{ color: bounceColor(t.bounceRate) }}>
                      {t.bounceRate}%
                    </td>
                    <td className="py-2 pl-3 text-right tabular-nums text-gray-700">
                      {t.conversion}%
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
