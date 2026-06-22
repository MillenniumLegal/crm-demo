import React from "react";

interface SlaBreach {
  matter: string;
  stage: string;
  overdueDays: number;
  owner: string;
}

interface KeyDate {
  matter: string;
  event: string;
  when: string;
  rag: "good" | "amber" | "bad";
}

interface Props {
  slaBreaches: SlaBreach[];
  keyDates: KeyDate[];
}

const RAG_HEX: Record<KeyDate["rag"], string> = {
  good: "#16a34a",
  amber: "#f59e0b",
  bad: "#ef4444",
};

export const MatterWatchBoard: React.FC<Props> = ({ slaBreaches, keyDates }) => {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Milestone SLA breaches</h3>
        <p className="text-xs text-gray-500">Overdue against stage benchmark</p>
        <div className="mt-3">
          {slaBreaches.length === 0 ? (
            <p className="py-2 text-xs text-gray-500">No breaches — every milestone on time.</p>
          ) : (
            slaBreaches.map((b, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 border-b border-gray-100 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{b.matter}</div>
                  <div className="text-xs text-gray-500">
                    {b.stage} · {b.owner}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                    b.overdueDays >= 5
                      ? "bg-red-50 text-red-700"
                      : "bg-amber-50 text-amber-700"
                  }`}
                >
                  {b.overdueDays}d over
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-900">Key dates</h3>
        <p className="text-xs text-gray-500">Exchange and completion countdown</p>
        <div className="mt-3">
          {keyDates.length === 0 ? (
            <p className="py-2 text-xs text-gray-500">No key dates scheduled.</p>
          ) : (
            keyDates.map((d, i) => (
              <div
                key={i}
                className="flex items-center gap-3 border-b border-gray-100 py-2 last:border-0"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: RAG_HEX[d.rag] }}
                />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-gray-800">{d.matter}</div>
                  <div className="text-xs text-gray-500">{d.event}</div>
                </div>
                <span
                  className="ml-auto text-xs font-medium tabular-nums"
                  style={{ color: RAG_HEX[d.rag] }}
                >
                  {d.when}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
