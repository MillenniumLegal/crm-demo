// Dashboard card: APCM AI digest ticker (replaces Quick Actions for managers).
// Auto-scrolls through what happened, what needs action, and AI advice; pauses
// on hover; expands to the full APCM AI page.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Brain, Loader2, Maximize2, Sparkles } from 'lucide-react';
import { ApcmAiDigest, DigestItem, getDigest } from '@/services/apcmAiService';

const toneDot: Record<string, string> = {
  good: 'bg-green-500',
  bad: 'bg-red-500',
  warn: 'bg-amber-500',
  info: 'bg-navy-400',
};

const ROTATE_MS = 4000;

export function ApcmAiDigestCard() {
  const navigate = useNavigate();
  const [digest, setDigest] = useState<ApcmAiDigest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getDigest()
      .then((result) => {
        if (!cancelled) setDigest(result);
      })
      .catch((digestError) => console.error('APCM AI dashboard digest error:', digestError))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tickerItems = useMemo<Array<DigestItem & { section: string }>>(() => {
    if (!digest) return [];
    return [
      ...digest.sections.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title }))),
      ...digest.advice.map((item) => ({ ...item, section: 'APCM AI suggests' })),
    ];
  }, [digest]);

  useEffect(() => {
    if (isPaused || tickerItems.length <= 1) return;
    timerRef.current = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % tickerItems.length);
    }, ROTATE_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isPaused, tickerItems.length]);

  return (
    <div
      className="card flex h-fit flex-col"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-navy-950 text-white">
              <Brain className="h-4 w-4" />
            </span>
            APCM AI digest
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">v1</span>
          </h3>
          <p className="mt-1 text-sm text-gray-500">What's happening across your business right now.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/apcm-ai')}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-navy-950 hover:text-navy-950"
          title="Open the full APCM AI page"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Expand
        </button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[150px] items-center justify-center text-sm text-gray-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Reading your business...
        </div>
      ) : !digest || tickerItems.length === 0 ? (
        <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
          <Sparkles className="h-8 w-8 text-gray-200" />
          <p className="mt-2 text-sm text-gray-500">Digest appears after the nightly call import has run.</p>
        </div>
      ) : (
        <>
          <p className="text-sm font-semibold leading-5 text-gray-900">{digest.headline}</p>

          {/* Ticker */}
          <div className="relative mt-3 min-h-[84px] overflow-hidden rounded-lg bg-gray-50">
            {tickerItems.map((item, index) => (
              <div
                key={`${item.section}-${index}`}
                className={`absolute inset-0 flex flex-col justify-center px-4 py-3 transition-all duration-500 ${
                  index === activeIndex ? 'translate-y-0 opacity-100' : index < activeIndex ? '-translate-y-3 opacity-0' : 'translate-y-3 opacity-0'
                }`}
                aria-hidden={index !== activeIndex}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{item.section}</p>
                <div className="mt-1.5 flex items-start gap-2">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneDot[item.tone] || toneDot.info}`} />
                  <p className="text-sm leading-6 text-gray-700">{item.text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dots + CTA */}
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1">
              {tickerItems.slice(0, 8).map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-1.5 rounded-full transition-all ${index === activeIndex % 8 ? 'w-4 bg-navy-950' : 'w-1.5 bg-gray-300 hover:bg-gray-400'}`}
                  title={`Item ${index + 1}`}
                />
              ))}
              {tickerItems.length > 8 && <span className="ml-1 text-[10px] text-gray-400">+{tickerItems.length - 8}</span>}
            </div>
            <button
              type="button"
              onClick={() => navigate('/apcm-ai')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-navy-950 hover:underline"
            >
              Ask APCM AI
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
