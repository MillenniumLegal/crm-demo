// Reusable APCM AI chat. Powers both the page (variant="full") and the floating
// assistant (variant="compact"). Answers come from the CRM via answerTemplate (digest,
// agent breakdown, objections, instructions); free text keyword-matches to a template
// for now — the seam where live free-form Q&A wires in later.

import React, { useEffect, useRef, useState } from 'react';
import { Brain, Send, Loader2, ArrowRight } from 'lucide-react';
import { AI_TEMPLATES, answerTemplate, TemplateAnswer, DigestItem, TONE_DOT_HEX } from '@/services/apcmAiService';

interface ChatMessage {
  id: number;
  role: 'user' | 'ai';
  text?: string;
  answer?: TemplateAnswer;
  thinking?: boolean;
}

const FREE_TEXT_KEYWORDS: Record<string, string[]> = {
  digest: ['digest', 'summary', 'today', 'happening'],
  momentum: ['momentum', 'trend', 'trending', 'this month'],
  teamHealth: ['how is the team', 'team doing', 'how are we doing', 'team health'],
  mostImproved: ['most improved', 'improved most', 'who improved', 'improving'],
  needsCoaching: ['needs coaching', 'who needs coaching', 'coaching', 'who needs help'],
  bestAgent: ['best agent', 'top agent', 'who did well', 'best on calls'],
  agentIssues: ['agent issue', 'agent problem', 'struggl', 'underperform'],
  droppage: ['droppage', 'dropping', 'losing leads', 'lost leads', 'objection'],
  fakeLeads: ['fake', 'spam lead', 'duplicate lead'],
  instructions: ['instruction'],
  spam: ['email', 'spam'],
};

interface ApcmAiChatProps {
  variant?: 'full' | 'compact';
  initialAsk?: string;
  onOpenFull?: () => void;
}

export const ApcmAiChat: React.FC<ApcmAiChatProps> = ({ variant = 'full', initialAsk, onOpenFull }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [freeText, setFreeText] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const idRef = useRef(0);
  const endRef = useRef<HTMLDivElement | null>(null);
  const askedRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const askTemplate = async (templateId: string, question: string) => {
    if (isAnswering) return;
    const userId = ++idRef.current;
    const thinkingId = ++idRef.current;
    setMessages((c) => [...c, { id: userId, role: 'user', text: question }, { id: thinkingId, role: 'ai', thinking: true }]);
    setIsAnswering(true);
    try {
      const answer = await answerTemplate(templateId);
      setMessages((c) => c.map((m) => (m.id === thinkingId ? { id: thinkingId, role: 'ai', answer } : m)));
    } catch (err) {
      console.error('APCM AI chat error:', err);
      setMessages((c) => c.map((m) => (m.id === thinkingId ? { id: thinkingId, role: 'ai', answer: { paragraphs: ['Something went wrong reading the data — try again in a moment.'] } } : m)));
    } finally {
      setIsAnswering(false);
    }
  };

  const handleFreeText = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = freeText.trim();
    if (!text || isAnswering) return;
    setFreeText('');
    const lower = text.toLowerCase();
    const matched = AI_TEMPLATES.find((t) => (FREE_TEXT_KEYWORDS[t.id] || []).some((k) => lower.includes(k)));
    if (matched) {
      await askTemplate(matched.id, text);
      return;
    }
    const userId = ++idRef.current;
    const aiId = ++idRef.current;
    setMessages((c) => [
      ...c,
      { id: userId, role: 'user', text },
      { id: aiId, role: 'ai', answer: { paragraphs: ['I can answer the suggested questions for now — free-form questions over all your CRM data wire in as APCM AI goes live.'], footnote: 'draft' } },
    ]);
  };

  useEffect(() => {
    if (!initialAsk || askedRef.current) return;
    const t = AI_TEMPLATES.find((x) => x.id === initialAsk);
    if (t) {
      askedRef.current = true;
      askTemplate(t.id, t.question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAsk]);

  const suggestions = AI_TEMPLATES.filter((t) => !t.planned).slice(0, variant === 'compact' ? 4 : 7);
  const heightCls = variant === 'compact' ? 'h-60' : 'h-[26rem]';

  return (
    <div className="flex flex-col">
      <div className={`${heightCls} overflow-y-auto rounded-lg border border-gray-100 bg-gray-50/70 p-3`}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-4 text-center text-gray-400">
            <Brain className="h-7 w-7 text-navy-300" />
            <p className="mt-2 text-sm font-medium text-gray-500">Ask APCM AI about your business</p>
            <p className="mt-0.5 text-xs">Answers come straight from your CRM data.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-navy-600 px-3 py-2 text-sm text-white">{m.text}</div>
                </div>
              ) : (
                <div key={m.id} className="flex justify-start gap-2">
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-950 text-white">
                    <Brain className="h-3 w-3" />
                  </span>
                  <div className="max-w-[86%] rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-3 py-2 shadow-sm">
                    {m.thinking ? (
                      <span className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your CRM…
                      </span>
                    ) : (
                      <div className="space-y-2">
                        {m.answer?.paragraphs.map((p, i) => (
                          <p key={i} className="text-sm leading-6 text-gray-800">{p}</p>
                        ))}
                        {m.answer?.items && m.answer.items.length > 0 && (
                          <div className="space-y-1.5 pt-0.5">
                            {m.answer.items.map((it: DigestItem, i: number) => (
                              <div key={i} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: TONE_DOT_HEX[it.tone] || TONE_DOT_HEX.info }} />
                                <span className="text-xs leading-5 text-gray-600">{it.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {m.answer?.footnote && <p className="pt-0.5 text-[11px] text-gray-400">{m.answer.footnote}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => askTemplate(t.id, t.question)}
            disabled={isAnswering}
            title={t.source}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition hover:border-navy-300 hover:text-navy-700 disabled:opacity-50"
          >
            {t.question}
          </button>
        ))}
      </div>

      <form onSubmit={handleFreeText} className="mt-2 flex items-center gap-2">
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="Ask about your leads, calls, or pipeline…"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-navy-400 focus:outline-none focus:ring-1 focus:ring-navy-200"
        />
        <button
          type="submit"
          disabled={!freeText.trim() || isAnswering}
          title="Send"
          aria-label="Send message"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy-600 text-white transition hover:bg-navy-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      {variant === 'compact' && onOpenFull && (
        <button
          type="button"
          onClick={onOpenFull}
          className="group mt-2 inline-flex items-center gap-1 self-end text-xs font-medium text-navy-700 hover:text-navy-900"
        >
          Open full APCM AI <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
};
