// Shared formatting helpers for the Call Analysis 2.0 components.

export const formatNumber = (value: number) => value.toLocaleString('en-GB');

export const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '0s';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes === 0) return `${remainder}s`;
  if (remainder === 0) return `${minutes}m`;
  return `${minutes}m ${remainder}s`;
};

export const formatDelay = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '0m';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  return `${minutes}m`;
};

export const formatDateTime = (dateString?: string) => {
  if (!dateString) return 'No time recorded';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No time recorded';

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// "Today 14:32" / "Yesterday 09:05" / "04 Jun 11:20" (year only when outside the current year)
export const formatRelativeDayTime = (dateString?: string) => {
  if (!dateString) return 'No time recorded';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'No time recorded';

  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - day.getTime()) / 86400000);

  if (diffDays === 0) return `Today ${time}`;
  if (diffDays === 1) return `Yesterday ${time}`;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  const dayLabel = date.toLocaleDateString('en-GB', sameYear ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' });
  return `${dayLabel} ${time}`;
};

export const sentenceCase = (value?: string) => {
  if (!value) return 'Not recorded';
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
};

export type ChipTone = 'green' | 'blue' | 'amber' | 'red' | 'gray' | 'purple' | 'emerald' | 'navy';

export const statusChipClass = (tone: ChipTone) => {
  const classes: Record<ChipTone, string> = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
    purple: 'bg-purple-100 text-purple-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    navy: 'bg-navy-100 text-navy-950',
  };
  return `inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[tone]}`;
};

export const getRate = (part: number, total: number) => {
  if (!total) return 0;
  return Math.round((part / total) * 100);
};

// Delta colouring is by MEANING, never by sign: voicemail going up is bad,
// speed-to-lead going down is good, workload metrics are neutral.
export type DeltaMeaning = 'good-up' | 'bad-up' | 'neutral';

export const deltaTone = (meaning: DeltaMeaning, delta: number) => {
  if (delta === 0 || meaning === 'neutral') return 'text-gray-500';
  const improving = meaning === 'good-up' ? delta > 0 : delta < 0;
  return improving ? 'text-green-700' : 'text-red-700';
};

export const confidencePercent = (value?: number) => {
  if (value == null) return null;
  return Math.round(value > 1 ? value : value * 100);
};

export const confidenceLabel = (value?: number) => {
  const percent = confidencePercent(value);
  if (percent == null) return 'Not scored';
  if (percent >= 75) return `High confidence (${percent}%)`;
  if (percent >= 50) return `Medium confidence (${percent}%)`;
  return `Low confidence (${percent}%)`;
};

export const confidenceTone = (value?: number): ChipTone => {
  const percent = confidencePercent(value);
  if (percent == null) return 'gray';
  if (percent >= 75) return 'green';
  if (percent >= 50) return 'amber';
  return 'red';
};

export const isLowConfidence = (value?: number) => {
  const percent = confidencePercent(value);
  return percent != null && percent < 50;
};
