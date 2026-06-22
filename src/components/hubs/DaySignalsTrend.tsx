import React from "react";
import {
  Clock,
  AlertCircle,
  PhoneCall,
  UserCheck,
  FileText,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";

interface DaySignal {
  key: string;
  label: string;
  count: number;
  prev: number;
  delta: number;
  direction: "up" | "down" | "flat";
  good: boolean;
  spark: number[];
  tone: "good" | "warn" | "bad" | "info";
  icon: "clock" | "alert" | "phone" | "userCheck" | "fileText" | "checkCircle";
  href: string;
}

interface Props {
  signals: DaySignal[];
  onSelect: (href: string) => void;
}

const iconMap = {
  clock: Clock,
  alert: AlertCircle,
  phone: PhoneCall,
  userCheck: UserCheck,
  fileText: FileText,
  checkCircle: CheckCircle,
} as const;

const toneHex: Record<DaySignal["tone"], string> = {
  good: "#16a34a",
  warn: "#f59e0b",
  bad: "#ef4444",
  info: "#1e3a8a",
};

function buildSparkPath(spark: number[]): { line: string; area: string } | null {
  const n = spark.length;
  if (n === 0) return null;
  const max = Math.max(...spark);
  const min = Math.min(...spark);
  const range = max - min;
  const stepX = n > 1 ? 100 / (n - 1) : 0;
  const points = spark.map((v, i) => {
    const x = n > 1 ? i * stepX : 50;
    // y inverted: high values near top (small y). Pad vertically within 0..22.
    const t = range === 0 ? 0.5 : (v - min) / range;
    const y = 20 - t * 18 + 1; // maps to ~[3,21], leaving headroom
    return { x, y };
  });
  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${last.x.toFixed(2)},22 L${first.x.toFixed(2)},22 Z`;
  return { line, area };
}

export const DaySignalsTrend: React.FC<Props> = ({ signals, onSelect }) => {
  if (signals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {signals.map((s) => {
        const Icon = iconMap[s.icon];
        const sparkColor = s.good ? "#16a34a" : "#1e3a8a";
        const paths = buildSparkPath(s.spark);
        const DeltaIcon =
          s.direction === "up"
            ? ArrowUpRight
            : s.direction === "down"
            ? ArrowDownRight
            : Minus;
        const deltaColor =
          s.direction === "flat"
            ? "text-gray-400"
            : s.good
            ? "text-green-600"
            : "text-red-600";

        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.href)}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:shadow"
          >
            <div className="flex items-center justify-between">
              <Icon
                className="h-4 w-4"
                style={{ color: toneHex[s.tone] }}
              />
              <span className="text-2xl font-bold tabular-nums text-gray-900">
                {s.count}
              </span>
            </div>

            <div className={`mt-1 flex items-center gap-0.5 ${deltaColor}`}>
              <DeltaIcon className="h-3 w-3" />
              <span className="text-[11px] font-medium tabular-nums">
                {s.delta > 0 ? "+" : ""}
                {s.delta} vs yest
              </span>
            </div>

            <div className="mt-1 text-xs leading-tight text-gray-600">
              {s.label}
            </div>

            {paths && (
              <svg
                viewBox="0 0 100 22"
                className="mt-1 h-5 w-full"
                preserveAspectRatio="none"
              >
                <path d={paths.area} fill={sparkColor} fillOpacity={0.12} />
                <path
                  d={paths.line}
                  fill="none"
                  stroke={sparkColor}
                  strokeWidth={1.5}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
};
