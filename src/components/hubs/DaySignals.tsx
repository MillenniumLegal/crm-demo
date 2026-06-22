import React from "react";
import {
  Clock,
  AlertCircle,
  PhoneCall,
  UserCheck,
  FileText,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

interface DaySignal {
  key: string;
  label: string;
  count: number;
  tone: "good" | "warn" | "bad" | "info";
  icon: "clock" | "alert" | "phone" | "userCheck" | "fileText" | "checkCircle";
  href: string;
}

interface Props {
  signals: DaySignal[];
  onSelect: (href: string) => void;
}

const iconMap: Record<DaySignal["icon"], LucideIcon> = {
  clock: Clock,
  alert: AlertCircle,
  phone: PhoneCall,
  userCheck: UserCheck,
  fileText: FileText,
  checkCircle: CheckCircle,
};

const toneHex: Record<DaySignal["tone"], string> = {
  good: "#16a34a",
  warn: "#f59e0b",
  bad: "#ef4444",
  info: "#1e3a8a",
};

const toneChip: Record<DaySignal["tone"], string> = {
  good: "bg-green-50 text-green-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
  info: "bg-blue-50 text-blue-700",
};

export const DaySignals: React.FC<Props> = ({ signals, onSelect }) => {
  if (signals.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {signals.map((s) => {
        const Icon = iconMap[s.icon] ?? AlertCircle;
        const hex = toneHex[s.tone] ?? toneHex.info;
        const chip = toneChip[s.tone] ?? toneChip.info;
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSelect(s.href)}
            className="rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm transition hover:shadow"
          >
            <div className="flex items-center justify-between">
              <Icon className="h-4 w-4" style={{ color: hex }} />
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${chip}`}
              >
                {s.count}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium leading-tight text-gray-700 line-clamp-2">
              {s.label}
            </p>
          </button>
        );
      })}
    </div>
  );
};
