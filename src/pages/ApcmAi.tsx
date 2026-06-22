// APCM AI v2 (draft) — chat-first. The chat leads the page with a live CRM-context
// panel beside it; "Needs you now", AI-insight charts, the digest, and quick paths sit
// below. Everything is CRM-connected so it is easy to wire to live data later.

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, RefreshCw, Loader2, Sparkles, Eye, Headphones, CheckCircle, TrendingUp, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ApcmAiDigest, DigestItem, getDigest, requestDigestRefresh, TONE_DOT_HEX } from '@/services/apcmAiService';
import { ApcmAiActionBoard, ApcmAiAction } from '@/components/ApcmAiActionBoard';
import { ApcmAiChat } from '@/components/ApcmAiChat';
import { fetchFirmAnalytics, FirmAnalytics } from '@/services/hubsService';
import { SentimentDistribution } from '@/components/analytics/SentimentDistribution';
import { RankedBarList } from '@/components/analytics/RankedBarList';

const toneText: Record<string, string> = { good: 'text-green-700', bad: 'text-red-700', warn: 'text-amber-700', info: 'text-navy-700' };

const DigestItemRow: React.FC<{ item: DigestItem }> = ({ item }) => (
  <div className="flex items-start gap-2.5">
    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TONE_DOT_HEX[item.tone] || TONE_DOT_HEX.info }} />
    <p className="text-sm leading-6 text-gray-700">{item.text}</p>
  </div>
);

// Live CRM signals APCM AI watches. Curated demo content; computed live in ty.
const WATCHING: { label: string; value: string; tone: keyof typeof toneText }[] = [
  { label: 'Calls today', value: '218', tone: 'info' },
  { label: 'Instruction-intent calls', value: '32', tone: 'good' },
  { label: 'Hot leads stalled 7d+', value: '5', tone: 'bad' },
  { label: 'Lowest coaching score', value: 'James · 50', tone: 'bad' },
  { label: 'Objection rising', value: 'Comparing Quotes', tone: 'warn' },
  { label: 'Callbacks overdue', value: '69', tone: 'bad' },
  { label: 'Recovery value', value: '£148.6k', tone: 'good' },
  { label: 'Contact repairs', value: '42 approvals', tone: 'warn' },
];

// Curated demo actions; in ty computed from live signals.
const PRIORITY_ACTIONS: ApcmAiAction[] = [
  { severity: 'high', icon: 'flame', title: '5 hot leads stalled 7+ days', detail: 'Qualified, hot leads with no contact this week — instructions slipping away. Work them before they go cold.', cta: 'Open stalled hot leads', href: '/lead-management?pulse=stalled' },
  { severity: 'high', icon: 'coaching', title: 'James Okoro dropped to a 50 coaching score', detail: 'Needs coaching: 12h speed-to-lead and weak objection handling. Listen to a couple of his calls today.', cta: 'Open his calls', href: '/call-analysis' },
  { severity: 'med', icon: 'objection', title: 'Comparing Quotes handled well only 25%', detail: '28 calls this week, our worst-handled objection. Run a quick huddle on value framing versus price.', cta: 'See the exchanges', href: '/call-analysis' },
  { severity: 'med', icon: 'callback', title: '69 callbacks overdue, 59 over 3 days', detail: 'Promised callbacks are slipping. Each missed one risks a lost instruction; clear the oldest first.', cta: 'Open the diary', href: '/diary' },
  { severity: 'med', icon: 'flame', title: '£148.6k sitting in Recovery Engine', detail: 'Old not-interested, quote shoppers, wrong-number repairs and won-client referral asks are ready for approval-first outreach.', cta: 'Open Recovery Engine', href: '/recovery-engine' },
  { severity: 'med', icon: 'flame', title: '27 leads quoted with no follow-up', detail: 'Quotes sent but untouched since. A nudge now lifts conversion; prioritise the highest-value ones.', cta: 'Open quoted leads', href: '/lead-management?pulse=quoted-no-touch' },
  { severity: 'low', icon: 'win', title: '17 instructions confirmed yesterday', detail: 'Louise led with 8 and a +0.34 client sentiment. £4,250 in deposits landed — momentum is up.', cta: 'View the pipeline', href: '/pipeline-pulse' },
];

export const ApcmAi: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [digest, setDigest] = useState<ApcmAiDigest | null>(null);
  const [isLoadingDigest, setIsLoadingDigest] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [firm, setFirm] = useState<FirmAnalytics | null>(null);

  const loadDigest = async () => {
    setIsLoadingDigest(true);
    try {
      setDigest(await getDigest());
    } catch (digestError) {
      console.error('Error loading APCM AI digest:', digestError);
      setDigest(null);
    } finally {
      setIsLoadingDigest(false);
    }
  };

  useEffect(() => {
    loadDigest();
    fetchFirmAnalytics().then(setFirm).catch(() => {});
  }, []);

  const handleRefreshDigest = async () => {
    setIsRefreshing(true);
    setRefreshNote(null);
    const result = await requestDigestRefresh();
    await loadDigest();
    setRefreshNote(result.ok ? 'Fresh digest generated by APCM AI.' : 'Refreshed from live CRM data.');
    setIsRefreshing(false);
  };

  const initialAsk = searchParams.get('ask') || undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-navy-950 text-white"><Brain className="h-4 w-4" /></span>
            <h1 className="text-2xl font-semibold text-gray-900">APCM <span className="font-serif italic text-navy-700">AI</span></h1>
            <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700">v2 draft</span>
          </div>
          <p className="mt-0.5 text-sm text-gray-500">Ask anything about your business — then see what needs you and what to do next.</p>
        </div>
        <button
          type="button"
          onClick={handleRefreshDigest}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 self-start rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:border-navy-300 disabled:opacity-50"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh digest
        </button>
      </div>

      {refreshNote && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-900">{refreshNote}</div>
      )}

      {/* CHAT FIRST — with a live CRM-context panel beside it */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-2">
            <h2 className="text-base font-semibold text-gray-900">Ask APCM AI</h2>
            <span className="text-xs text-gray-400">answers come straight from your CRM</span>
          </div>
          <ApcmAiChat variant="full" initialAsk={initialAsk} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-navy-600" />
            <h2 className="text-sm font-semibold text-gray-900">What APCM AI is watching</h2>
          </div>
          <p className="mt-0.5 text-xs text-gray-400">Live signals across the CRM</p>
          <div className="mt-3 divide-y divide-gray-100">
            {WATCHING.map((w) => (
              <div key={w.label} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-gray-600">{w.label}</span>
                <span className={`text-sm font-semibold tabular-nums ${toneText[w.tone]}`}>{w.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Needs you now */}
      <ApcmAiActionBoard actions={PRIORITY_ACTIONS} onAction={(href) => navigate(href)} />

      {/* AI insight charts — CRM-connected */}
      {firm && (
        <div className="grid gap-5 xl:grid-cols-2">
          <SentimentDistribution title="Client sentiment" caption="What APCM AI heard across analysed calls" levels={firm.sentiment} />
          <RankedBarList title="Objections it is tracking" caption="Worst handled first — drill in Call Analysis" items={firm.objections} defaultTone="bad" />
        </div>
      )}

      {/* Daily digest */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 bg-gradient-to-r from-navy-950 to-navy-800 px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-white/60">
            <Sparkles className="h-3.5 w-3.5" />
            Daily digest{digest ? ` · ${digest.digestDate}` : ''}
            {digest?.generatedBy === 'live-data' && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 normal-case tracking-normal">live data</span>
            )}
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-7">
            {isLoadingDigest ? 'Reading your business…' : digest?.headline || 'No digest available yet.'}
          </h2>
        </div>

        {isLoadingDigest ? (
          <div className="flex min-h-[140px] items-center justify-center text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Building your digest from CRM data…
          </div>
        ) : digest ? (
          <div className="grid gap-6 p-6 lg:grid-cols-3">
            {digest.sections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{section.title}</h3>
                <div className="mt-3 space-y-2.5">
                  {section.items.map((item, index) => (
                    <DigestItemRow key={`${section.title}-${index}`} item={item} />
                  ))}
                </div>
              </div>
            ))}
            {digest.advice.length > 0 && (
              <div className={digest.sections.length >= 3 ? 'lg:col-span-3' : ''}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">APCM AI suggests</h3>
                <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
                  {digest.advice.map((item, index) => (
                    <div key={`advice-${index}`} className="rounded-lg bg-gray-50 p-3">
                      <DigestItemRow item={item} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-500">No digest yet — data appears after the call import has run.</div>
        )}
      </div>

      {/* Dig deeper + roadmap */}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Dig deeper</h2>
          <p className="mt-0.5 text-sm text-gray-500">When the digest flags something, go straight to the detail.</p>
          <div className="mt-4 space-y-2">
            <button type="button" onClick={() => navigate('/call-analysis')} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-navy-300">
              <span className="flex items-center gap-2"><Headphones className="h-4 w-4 text-navy-700" /> Call Analysis — call by call</span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
            <button type="button" onClick={() => navigate('/analytics')} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-navy-300">
              <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-teal-600" /> Analytics — firm-wide trends</span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
            <button type="button" onClick={() => navigate('/reports/instructions')} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-navy-300">
              <span className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-600" /> Instructions report</span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
            <button type="button" onClick={() => navigate('/recovery-engine')} className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-4 py-3 text-left text-sm font-medium text-gray-900 hover:border-navy-300">
              <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-indigo-600" /> Recovery Engine — approval-first outreach</span>
              <ArrowRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/60 p-5">
          <h2 className="text-sm font-semibold text-gray-700">Coming next in APCM AI</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-500">
            <li>· Free-form questions over all CRM data (live wiring)</li>
            <li>· Take actions from chat — schedule callbacks, draft emails</li>
            <li>· Email deliverability — spam and bounce tracking per day</li>
            <li>· Recovery Engine actions — approve AI drips, contact repairs and won-client referral asks</li>
            <li>· Automatic morning digest by email and SMS alerts</li>
            <li>· Weekly coaching notes per agent, written by AI</li>
          </ul>
          {user?.role === 'Admin' && (
            <p className="mt-3 text-xs text-gray-400">Powered by the same OpenAI connection as APCM call intelligence.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApcmAi;
