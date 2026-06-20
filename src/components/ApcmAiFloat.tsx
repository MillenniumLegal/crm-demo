// APCM AI floating assistant — sits above the Action Center task box and gives
// managers the digest headline plus quick paths into the full APCM AI page.
// v1 preview: read-only digest + quick questions; scheduled sends are
// interface-only.

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Brain, CalendarClock, ChevronDown, Loader2, Mail, Sparkles, TrendingUp } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { APCM_AI_ENABLED } from '@/lib/featureFlags';
import { ApcmAiDigest, getDigest } from '@/services/apcmAiService';

const toneDot: Record<string, string> = {
  good: 'bg-green-500',
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-navy-400',
};

const QUICK_QUESTIONS = [
  { id: 'digest', label: 'Daily digest' },
  { id: 'bestAgent', label: 'Best agent yesterday' },
  { id: 'droppage', label: 'Why are leads dropping?' },
];

export function ApcmAiFloat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [digest, setDigest] = useState<ApcmAiDigest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const isManagerView = user?.role === 'Manager' || user?.role === 'Admin';

  useEffect(() => {
    if (!isOpen || hasLoaded) return;
    let cancelled = false;
    setIsLoading(true);
    getDigest()
      .then((result) => {
        if (!cancelled) setDigest(result);
      })
      .catch((digestError) => console.error('APCM AI float digest error:', digestError))
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          setHasLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasLoaded]);

  if (!APCM_AI_ENABLED || !isManagerView || isDismissed) return null;
  // The full page renders its own experience — no float on top of it.
  if (location.pathname === '/apcm-ai') return null;

  const topItems = digest
    ? [...digest.sections.flatMap((section) => section.items), ...digest.advice].slice(0, 4)
    : [];

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-navy-950 to-navy-800 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15">
                <Brain className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold leading-4">APCM AI</p>
                <p className="text-[11px] text-white/60">Manager digest · v1 preview</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1.5 text-white/70 hover:text-white" title="Minimise">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Digest */}
          <div className="px-4 py-3">
            {isLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading your business...
              </div>
            ) : digest ? (
              <>
                <p className="text-sm font-semibold leading-5 text-gray-900">{digest.headline}</p>
                <div className="mt-2.5 space-y-2">
                  {topItems.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${toneDot[item.tone] || toneDot.info}`} />
                      <p className="text-xs leading-5 text-gray-600">{item.text}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-sm text-gray-500">No digest yet — data appears after the nightly import.</p>
            )}
          </div>

          {/* Quick questions */}
          <div className="border-t border-gray-100 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ask APCM AI</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    navigate(`/apcm-ai?ask=${question.id}`);
                  }}
                  className="rounded-full border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:border-navy-950 hover:text-navy-950"
                >
                  {question.label}
                </button>
              ))}
            </div>
          </div>

          {/* Scheduled sends preview */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <CalendarClock className="h-3.5 w-3.5" />
                Scheduled sends
              </p>
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Preview</span>
            </div>
            <div className="mt-2 space-y-2">
              {[
                { icon: Mail, label: 'Morning digest to managers · 07:30' },
                { icon: TrendingUp, label: 'Weekly agent scorecard · Mon 08:00' },
              ].map((schedule) => {
                const Icon = schedule.icon;
                return (
                  <div key={schedule.label} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      <Icon className="h-3.5 w-3.5 text-gray-400" />
                      {schedule.label}
                    </span>
                    <span className="relative h-4 w-8 shrink-0 rounded-full bg-gray-200" title="Coming in APCM AI v2">
                      <span className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow" />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5">
            <button
              type="button"
              onClick={() => setIsDismissed(true)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Hide for this session
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/apcm-ai');
              }}
              className="btn-primary !px-3 !py-1.5 text-xs"
            >
              Open APCM AI
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 rounded-full bg-navy-950 py-2 pl-2.5 pr-4 text-white shadow-xl transition hover:bg-navy-800"
          title="Open APCM AI"
        >
          <span className="relative inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15">
            <Brain className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-orange-400" />
          </span>
          <span className="text-sm font-semibold">APCM AI</span>
          <Sparkles className="h-3.5 w-3.5 text-orange-300 transition group-hover:rotate-12" />
        </button>
      )}

    </div>
  );
}
