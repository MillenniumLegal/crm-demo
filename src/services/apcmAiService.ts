// APCM AI v1 — manager visibility digest + click-template answers.
//
// The digest prefers the server-generated row in apcm_ai_digests (written by the
// apcm-ai-digest edge function on a daily cron). When that table does not exist
// yet, or has no row for the period, everything falls back to a client-side
// digest computed from the live reporting RPCs — so the preview works before any
// SQL has been run.

import { supabase } from '@/lib/supabase';
import {
  CallAgentDailyBreakdown,
  fetchCallAgentDailyBreakdown,
  fetchCallAnalysisSummary,
  fetchCallDailyOverview,
  fetchCallSignalBreakdowns,
} from '@/services/threecxService';
import { fetchFirmTrends } from '@/services/hubsService';
import { fetchTeamPerformance } from '@/services/teamService';

export type DigestTone = 'good' | 'bad' | 'warn' | 'info';

// Solid hexes for data dots — applied via inline style so the theme switcher (which mutes
// bg-navy-400 to near-white) cannot wash out the `info` tone. Soft chips keep their classes.
export const TONE_DOT_HEX: Record<DigestTone, string> = {
  good: '#16A34A',
  bad: '#EF4444',
  warn: '#F59E0B',
  info: '#475569',
};

export interface DigestItem {
  text: string;
  tone: DigestTone;
}

export interface DigestSection {
  title: string;
  items: DigestItem[];
}

export interface ApcmAiDigest {
  digestDate: string;
  headline: string;
  sections: DigestSection[];
  advice: DigestItem[];
  generatedBy: 'apcm-ai' | 'live-data';
  createdAt?: string;
}

const MISSING_TABLE_CODES = new Set(['42P01', 'PGRST205']);

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dayRange = (daysAgo: number) => {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - daysAgo);
  const end = new Date(day);
  end.setDate(end.getDate() + 1);
  return {
    label: formatDateInput(day),
    startIso: day.toISOString(),
    endIso: end.toISOString(),
  };
};

const baseFilters = (startIso: string, endIso: string) => ({
  startDate: startIso,
  endDate: endIso,
  agentUserId: null,
  direction: null,
  callStatus: null,
  transcriptStatus: null,
  aiStatus: null,
  matchStatus: null,
  callType: null,
  followUpNeeded: null,
  reviewStatus: null,
});

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export async function fetchLatestDigest(): Promise<ApcmAiDigest | null> {
  const { data, error } = await supabase
    .from('apcm_ai_digests')
    .select('digest_date, headline, sections, advice, created_at')
    .order('digest_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!MISSING_TABLE_CODES.has(error.code)) {
      console.warn('APCM AI digest lookup failed:', error);
    }
    return null;
  }
  if (!data) return null;

  return {
    digestDate: data.digest_date,
    headline: data.headline || 'Your APCM AI digest',
    sections: Array.isArray(data.sections) ? data.sections : [],
    advice: Array.isArray(data.advice) ? data.advice : [],
    generatedBy: 'apcm-ai',
    createdAt: data.created_at || undefined,
  };
}

export async function requestDigestRefresh(): Promise<{ ok: boolean; message: string }> {
  const { data, error } = await supabase.functions.invoke('apcm-ai-digest', { body: { refresh: true } });
  if (error) return { ok: false, message: error.message || 'Digest service is not deployed yet.' };
  if (!data?.success) return { ok: false, message: data?.error || 'Digest service is not deployed yet.' };
  return { ok: true, message: 'Fresh digest generated.' };
}

export async function computeLiveDigest(): Promise<ApcmAiDigest> {
  const yesterday = dayRange(1);
  const dayBefore = dayRange(2);

  const [overview, previousOverview, summary, agents, signals, tasksDueToday] = await Promise.all([
    fetchCallDailyOverview(baseFilters(yesterday.startIso, yesterday.endIso)).catch(() => null),
    fetchCallDailyOverview(baseFilters(dayBefore.startIso, dayBefore.endIso)).catch(() => null),
    fetchCallAnalysisSummary(baseFilters(yesterday.startIso, yesterday.endIso)).catch(() => null),
    fetchCallAgentDailyBreakdown(baseFilters(yesterday.startIso, yesterday.endIso)).catch(() => [] as CallAgentDailyBreakdown[]),
    fetchCallSignalBreakdowns(baseFilters(yesterday.startIso, yesterday.endIso)).catch(() => []),
    countTasksDueToday().catch(() => null),
  ]);

  const sections: DigestSection[] = [];
  const advice: DigestItem[] = [];

  if (overview) {
    const yesterdayItems: DigestItem[] = [
      {
        text: `${overview.outboundCalls.toLocaleString('en-GB')} calls made, ${overview.outboundAnsweredCalls.toLocaleString('en-GB')} conversations (${Math.round(overview.outboundAnswerRate || 0)}% answer rate).`,
        tone: 'info',
      },
      {
        text: `${overview.uniqueLeadsContacted.toLocaleString('en-GB')} leads reached out of ${overview.uniqueLeadsAttempted.toLocaleString('en-GB')} called.`,
        tone: 'info',
      },
      {
        text: overview.officialInstructions > 0
          ? `${overview.officialInstructions.toLocaleString('en-GB')} new instructions confirmed in the CRM.`
          : 'No new instructions confirmed yesterday.',
        tone: overview.officialInstructions > 0 ? 'good' : 'warn',
      },
    ];

    if (previousOverview && previousOverview.outboundCalls > 0) {
      const delta = Math.round(((overview.outboundCalls - previousOverview.outboundCalls) / previousOverview.outboundCalls) * 100);
      if (Math.abs(delta) >= 10) {
        yesterdayItems.push({
          text: `Dialling effort ${delta > 0 ? 'up' : 'down'} ${Math.abs(delta)}% vs the day before.`,
          tone: delta > 0 ? 'good' : 'bad',
        });
      }
    }
    if (overview.instructionIntent > 0) {
      yesterdayItems.push({
        text: `APCM AI heard instruction intent on ${overview.instructionIntent.toLocaleString('en-GB')} calls — chase these first.`,
        tone: 'good',
      });
    }
    sections.push({ title: 'Yesterday', items: yesterdayItems });
  }

  const todayItems: DigestItem[] = [];
  if (tasksDueToday != null) {
    todayItems.push({
      text: tasksDueToday > 0
        ? `${tasksDueToday.toLocaleString('en-GB')} diary tasks are due today.`
        : 'No diary tasks due today.',
      tone: tasksDueToday > 0 ? 'info' : 'good',
    });
  }
  if (summary) {
    if (summary.followUpNeeded > 0) {
      todayItems.push({
        text: `${summary.followUpNeeded.toLocaleString('en-GB')} calls from yesterday carry a promised call-back.`,
        tone: 'warn',
      });
    }
    if (summary.needsReview > 0) {
      todayItems.push({
        text: `${summary.needsReview.toLocaleString('en-GB')} calls are waiting in the review queue.`,
        tone: 'warn',
      });
    }
    if (summary.failedAi > 0) {
      todayItems.push({ text: `${summary.failedAi.toLocaleString('en-GB')} AI analyses failed and need a retry.`, tone: 'bad' });
    }
    if (summary.pendingAi > 0) {
      todayItems.push({ text: `${summary.pendingAi.toLocaleString('en-GB')} calls are still being analysed in the background.`, tone: 'info' });
    }
  }
  if (todayItems.length > 0) sections.push({ title: 'Today', items: todayItems });

  const topAgent = [...agents]
    .filter((agent) => agent.outboundCalls >= 5)
    .sort((a, b) => b.outboundAnsweredCalls - a.outboundAnsweredCalls)[0];
  if (topAgent) {
    advice.push({
      text: `${topAgent.agentName} led yesterday with ${topAgent.outboundAnsweredCalls} conversations (${Math.round(topAgent.outboundAnswerRate)}% answer rate).`,
      tone: 'good',
    });
  }

  const objections = signals
    .filter((signal) => signal.signalType.toLowerCase().includes('objection'))
    .sort((a, b) => b.callsCount - a.callsCount);
  if (objections[0]) {
    advice.push({
      text: `Top objection yesterday: "${objections[0].signalValue}" (${objections[0].callsCount} calls). Worth a team huddle.`,
      tone: 'warn',
    });
  }
  if (overview && overview.outboundAttemptsPerLead > 0 && overview.outboundAttemptsPerLead < 1.5) {
    advice.push({
      text: `Average ${overview.outboundAttemptsPerLead.toFixed(2)} calls per lead — most leads get one attempt. Second and third calls win instructions.`,
      tone: 'warn',
    });
  }
  if (overview && overview.averageFirstOutboundDelaySeconds > 3600) {
    advice.push({
      text: 'Speed to lead is over an hour on average — new leads cool quickly; aim for under 30 minutes.',
      tone: 'bad',
    });
  }

  const headline = overview
    ? `${overview.outboundCalls.toLocaleString('en-GB')} calls, ${overview.uniqueLeadsContacted.toLocaleString('en-GB')} leads reached, ${overview.officialInstructions.toLocaleString('en-GB')} instruction${overview.officialInstructions === 1 ? '' : 's'} yesterday`
    : 'APCM AI digest';

  return {
    digestDate: yesterday.label,
    headline,
    sections,
    advice: advice.slice(0, 4),
    generatedBy: 'live-data',
  };
}

export async function getDigest(): Promise<ApcmAiDigest> {
  const stored = await fetchLatestDigest();
  if (stored && stored.sections.length > 0) return stored;
  return computeLiveDigest();
}

async function countTasksDueToday(): Promise<number> {
  const today = formatDateInput(new Date());
  const { count, error } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('due_date', today)
    .neq('status', 'Completed')
    .neq('status', 'Cancelled');
  if (error) throw error;
  return count || 0;
}

// ---------------------------------------------------------------------------
// Click-template questions ("Ask APCM AI")
// ---------------------------------------------------------------------------

export interface TemplateAnswer {
  paragraphs: string[];
  items?: DigestItem[];
  footnote?: string;
}

export interface AiTemplate {
  id: string;
  question: string;
  /** Where the answer comes from, shown as a small caption. */
  source: string;
  /** Templates that are interface-only for now. */
  planned?: boolean;
}

export const AI_TEMPLATES: AiTemplate[] = [
  { id: 'digest', question: 'Give me the daily digest', source: 'Calls, leads, instructions and diary' },
  { id: 'teamHealth', question: 'How is the team doing?', source: 'Team performance roll-up' },
  { id: 'momentum', question: 'How is our momentum this month?', source: 'Firm trends — daily history' },
  { id: 'mostImproved', question: 'Which agent improved most?', source: 'Team performance roll-up' },
  { id: 'needsCoaching', question: 'Who needs coaching?', source: 'Team performance + coaching scores' },
  { id: 'bestAgent', question: 'Which agent did best on calls yesterday?', source: 'Call Analysis agent breakdown' },
  { id: 'agentIssues', question: 'Any agent issues I should look at?', source: 'Call Analysis agent breakdown' },
  { id: 'droppage', question: "What's causing lead droppage?", source: 'AI objections and knock-back themes' },
  { id: 'fakeLeads', question: 'Any possible fake leads today?', source: 'Lead checks (restricted preview)' },
  { id: 'instructions', question: 'What happened with instructions yesterday?', source: 'CRM instruction records' },
  { id: 'spam', question: 'How many emails went to spam yesterday?', source: 'Email deliverability (planned)', planned: true },
];

export async function answerTemplate(templateId: string): Promise<TemplateAnswer> {
  switch (templateId) {
    case 'digest': {
      const digest = await getDigest();
      return {
        paragraphs: [digest.headline + '.'],
        items: [...digest.sections.flatMap((section) => section.items), ...digest.advice].slice(0, 8),
        footnote: digest.generatedBy === 'apcm-ai' ? 'Generated by APCM AI overnight.' : 'Computed live from CRM data.',
      };
    }

    case 'bestAgent': {
      const yesterday = dayRange(1);
      const agents = await fetchCallAgentDailyBreakdown(baseFilters(yesterday.startIso, yesterday.endIso));
      const ranked = agents
        .filter((agent) => agent.outboundCalls >= 5)
        .sort((a, b) => b.outboundAnsweredCalls - a.outboundAnsweredCalls || b.outboundAnswerRate - a.outboundAnswerRate);

      if (ranked.length === 0) {
        return { paragraphs: ['No agent made 5 or more outbound calls yesterday, so there is no fair comparison to make.'] };
      }

      const [top, second] = ranked;
      const paragraphs = [
        `${top.agentName} did best yesterday: ${top.outboundAnsweredCalls} conversations from ${top.outboundCalls} calls (${Math.round(top.outboundAnswerRate)}% answer rate)` +
        (top.officialInstructions > 0 ? `, and ${top.officialInstructions} instruction${top.officialInstructions === 1 ? '' : 's'} credited.` : '.'),
      ];
      if (second) {
        paragraphs.push(`${second.agentName} was close behind with ${second.outboundAnsweredCalls} conversations (${Math.round(second.outboundAnswerRate)}% answer rate).`);
      }
      return { paragraphs, footnote: 'Agents with fewer than 5 calls are excluded for fairness.' };
    }

    case 'agentIssues': {
      const yesterday = dayRange(1);
      const agents = await fetchCallAgentDailyBreakdown(baseFilters(yesterday.startIso, yesterday.endIso));
      const items: DigestItem[] = [];

      agents.forEach((agent) => {
        if (agent.outboundCalls >= 10 && agent.outboundAnswerRate < 20) {
          items.push({ text: `${agent.agentName}: only ${Math.round(agent.outboundAnswerRate)}% of ${agent.outboundCalls} calls answered — check dialling times and numbers.`, tone: 'bad' });
        }
        if (agent.outboundCalls >= 10 && agent.outboundVoicemailCalls / Math.max(agent.outboundCalls, 1) > 0.5) {
          items.push({ text: `${agent.agentName}: over half of calls hit voicemail — worth varying call times.`, tone: 'warn' });
        }
        if (agent.outboundCalls > 0 && agent.outboundAttemptsPerLead < 1.2 && agent.uniqueLeadsAttempted >= 5) {
          items.push({ text: `${agent.agentName}: barely retries leads (${agent.outboundAttemptsPerLead.toFixed(2)} calls per lead).`, tone: 'warn' });
        }
      });

      if (items.length === 0) {
        return { paragraphs: ['Nothing alarming in yesterday’s agent numbers. Answer rates and retry discipline look within normal range.'] };
      }
      return { paragraphs: ['A few things worth a look from yesterday:'], items: items.slice(0, 6) };
    }

    case 'droppage': {
      const last7Start = dayRange(7);
      const yesterday = dayRange(1);
      const signals = await fetchCallSignalBreakdowns(baseFilters(last7Start.startIso, yesterday.endIso));
      const objectionTypes = ['objection category', 'rejection reason', 'knock back'];
      const grouped = signals
        .filter((signal) => objectionTypes.some((type) => signal.signalType.toLowerCase().includes(type)))
        .sort((a, b) => b.callsCount - a.callsCount)
        .slice(0, 6);

      if (grouped.length === 0) {
        return { paragraphs: ['APCM AI has not recorded enough objection data in the last 7 days to explain droppage yet. Once more calls are analysed, this answer gets sharper.'] };
      }

      return {
        paragraphs: ['Based on the last 7 days of analysed calls, leads are dropping for these reasons:'],
        items: grouped.map((signal) => ({
          text: `${signal.signalValue} — ${signal.callsCount} call${signal.callsCount === 1 ? '' : 's'}`,
          tone: 'warn' as DigestTone,
        })),
        footnote: 'From APCM AI objection, rejection, and knock-back classification.',
      };
    }

    case 'fakeLeads': {
      const today = dayRange(0);
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, phone, email, source, created_at')
        .gte('created_at', today.startIso)
        .lt('created_at', today.endIso)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        return { paragraphs: ['I could not read today’s leads just now — try again in a moment.'] };
      }

      const leads = data || [];
      if (leads.length === 0) {
        return { paragraphs: ['No leads have come in yet today, so nothing to screen.'] };
      }

      const items: DigestItem[] = [];
      const phoneCounts = new Map<string, number>();
      const emailCounts = new Map<string, number>();
      leads.forEach((lead: any) => {
        const digits = String(lead.phone || '').replace(/\D/g, '');
        if (digits) phoneCounts.set(digits, (phoneCounts.get(digits) || 0) + 1);
        const email = String(lead.email || '').toLowerCase().trim();
        if (email) emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
      });

      leads.forEach((lead: any) => {
        const digits = String(lead.phone || '').replace(/\D/g, '');
        const email = String(lead.email || '').toLowerCase().trim();
        const reasons: string[] = [];
        if (digits && (phoneCounts.get(digits) || 0) > 1) reasons.push('duplicate phone number today');
        if (email && (emailCounts.get(email) || 0) > 1) reasons.push('duplicate email today');
        if (digits && (digits.length < 10 || /^(\d)\1{6,}$/.test(digits))) reasons.push('phone number looks invalid');
        if (email && /@(test|example|mailinator|fake)\./.test(email)) reasons.push('throwaway email domain');
        if (reasons.length > 0 && items.length < 5) {
          items.push({ text: `${lead.name || 'Unnamed lead'} (${lead.source || 'unknown source'}) — ${reasons.join(', ')}.`, tone: 'warn' });
        }
      });

      if (items.length === 0) {
        return {
          paragraphs: [`Screened ${leads.length} lead${leads.length === 1 ? '' : 's'} from today — no obvious fakes (duplicates, invalid numbers, throwaway emails).`],
          footnote: 'Restricted preview — deeper checks (IP, behaviour, paid-click patterns) are planned.',
        };
      }
      return {
        paragraphs: [`Screened ${leads.length} lead${leads.length === 1 ? '' : 's'} from today. These look worth a second glance:`],
        items,
        footnote: 'Restricted preview — deeper checks (IP, behaviour, paid-click patterns) are planned.',
      };
    }

    case 'instructions': {
      const yesterday = dayRange(1);
      const { data, error } = await supabase
        .from('leads')
        .select('id, name, assigned_to, manual_instructed_at')
        .gte('manual_instructed_at', yesterday.startIso)
        .lt('manual_instructed_at', yesterday.endIso)
        .order('manual_instructed_at', { ascending: false })
        .limit(25);

      if (error) {
        return { paragraphs: ['I could not read yesterday’s instruction records just now — try again in a moment.'] };
      }

      const instructed = data || [];
      if (instructed.length === 0) {
        return { paragraphs: ['No instructions were confirmed in the CRM yesterday.'] };
      }
      return {
        paragraphs: [`${instructed.length} instruction${instructed.length === 1 ? '' : 's'} confirmed yesterday:`],
        items: instructed.map((lead: any) => ({ text: lead.name || 'Unnamed lead', tone: 'good' as DigestTone })),
      };
    }

    case 'spam':
      return {
        paragraphs: [
          'Email deliverability is not wired up yet — the CRM does not currently receive spam or bounce reports from the email provider.',
          'This is on the APCM AI roadmap: once provider webhooks are connected, this question will answer with real numbers per day, per template, and per agent.',
        ],
        footnote: 'Interface preview — coming in APCM AI v2.',
      };

    case 'momentum': {
      const tr = await fetchFirmTrends();
      const up = tr.momentum.filter((m) => m.good).length;
      const mood = up >= tr.momentum.length - 1 ? 'strong' : up >= tr.momentum.length / 2 ? 'positive' : 'mixed';
      return {
        paragraphs: [
          `Momentum is ${mood} over the ${tr.range.toLowerCase()} — ${up} of ${tr.momentum.length} headline metrics are moving the right way.`,
        ],
        items: tr.momentum.map((m) => ({
          text: `${m.label}: ${m.value} (${m.deltaPct > 0 ? '+' : ''}${m.deltaPct}%)`,
          tone: (m.good ? 'good' : 'warn') as DigestTone,
        })),
        footnote: 'Computed from daily CRM history.',
      };
    }

    case 'teamHealth': {
      const tp = await fetchTeamPerformance();
      const top = tp.agents[0];
      const bottom = tp.agents[tp.agents.length - 1];
      const watch = tp.agents.filter((a) => a.status === 'watch');
      const teamScore = tp.teamMomentum.find((m) => m.key === 'score');
      const paragraphs = [
        `Team is ${teamScore ? `at ${teamScore.value} and ${teamScore.deltaPct >= 0 ? 'trending up' : 'slipping'}` : 'tracking steadily'}. ${top.name} leads on ${top.score}, ${bottom.name} is lowest on ${bottom.score}.`,
        watch.length > 0
          ? `${watch.length} agent${watch.length === 1 ? '' : 's'} need${watch.length === 1 ? 's' : ''} attention: ${watch.map((a) => a.name).join(', ')}.`
          : 'No one is in the watch zone right now.',
      ];
      return {
        paragraphs,
        items: tp.teamMomentum.slice(0, 4).map((m) => ({
          text: `${m.label}: ${m.value} (${m.deltaPct > 0 ? '+' : ''}${m.deltaPct}%)`,
          tone: (m.good ? 'good' : 'warn') as DigestTone,
        })),
        footnote: 'From the team performance roll-up.',
      };
    }

    case 'mostImproved': {
      const tp = await fetchTeamPerformance();
      const ranked = [...tp.agents].sort((a, b) => b.scoreDelta - a.scoreDelta);
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];
      const paragraphs = [
        `${best.name} improved most — ${best.scoreDelta > 0 ? '+' : ''}${best.scoreDelta} on their performance score, now ${best.score}.${best.highlight ? ' ' + best.highlight + '.' : ''}`,
      ];
      if (worst.scoreDelta < 0) {
        paragraphs.push(`At the other end, ${worst.name} slipped ${worst.scoreDelta} to ${worst.score} — worth a check-in.`);
      }
      return { paragraphs, footnote: 'Change vs the prior period, from the team roll-up.' };
    }

    case 'needsCoaching': {
      const tp = await fetchTeamPerformance();
      const focus = tp.agents.filter((a) => a.status === 'watch' || a.score < 55).sort((a, b) => a.score - b.score);
      if (focus.length === 0) {
        return { paragraphs: ['Everyone is at or above the coaching floor right now — no one is in the watch zone.'], footnote: 'From coaching scores in the team roll-up.' };
      }
      return {
        paragraphs: [`${focus.length} agent${focus.length === 1 ? '' : 's'} could use coaching attention this week:`],
        items: focus.map((a) => ({ text: `${a.name} (${a.score}) — ${a.coachingNote}`, tone: 'warn' as DigestTone })),
        footnote: 'Coaching scores blend connect, convert and quality.',
      };
    }

    default:
      return { paragraphs: ['I do not know that one yet — pick one of the suggested questions for now.'] };
  }
}
