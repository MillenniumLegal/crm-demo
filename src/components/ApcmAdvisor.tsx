import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Send } from "lucide-react";

type PageEntry = {
  match: string;
  name: string;
  opener: string;
  prompts: string[];
};

const PAGE_MAP: PageEntry[] = [
  {
    match: "/finance",
    name: "Finance",
    opener:
      "You are £3.1k behind pace this month — but 5 accepted quotes worth £8.6k would clear it. Want me to list them?",
    prompts: ["Am I on track this month?", "What is at risk?", "Where can I recover cash?"],
  },
  {
    match: "/lead-analytics",
    name: "Lead Analytics",
    opener:
      "Local Firm Preference is your worst-handled objection (20% handled well). The miss is not countering with reviews + nationwide track record.",
    prompts: ["Which objection costs us most?", "Who handles objections best?", "Coach me on Timing Not Ready"],
  },
  {
    match: "/call-insights",
    name: "Call Insights",
    opener:
      "165 calls hit voicemail this period and Timing Not Ready converts at just 16% vs 60%. Two quick wins inside.",
    prompts: ["What is hurting conversion?", "Best handled topic?", "Summarise yesterday"],
  },
  {
    match: "/timing",
    name: "Best Time to Call",
    opener:
      "Leads answer most at 10am (84%) but you dial most at 2pm. Shifting early-day dials could lift connect rate ~14pp.",
    prompts: ["When should we call?", "Worst time to call?", "Best day to call?"],
  },
  {
    match: "/forecast",
    name: "Forecast",
    opener:
      "July is trending +12% on instructions (58, ±6) on the spring/summer uplift — pre-book capacity now.",
    prompts: ["What is next month looking like?", "Where is the risk?", "Instruction value forecast?"],
  },
  {
    match: "/revenue-boost",
    name: "Revenue Boost",
    opener:
      "£54.4k is recoverable right now — £18.4k of it is aged unpaid invoices. Want the chase list?",
    prompts: ["What can we recover today?", "What is at risk?", "Upsell ideas?"],
  },
  {
    match: "/recovery-engine",
    name: "Recovery Engine",
    opener:
      "£148.6k is sitting in old, lost, wrong-number and quote-to-instruction recovery queues. Start with quoted-no-touch before scaling AI drips.",
    prompts: ["Which cohort should we work first?", "Show risky outreach", "Who has capacity today?"],
  },
  {
    match: "/lifecycle-growth",
    name: "Pre-Instruction Growth",
    opener:
      "Pre-instruction growth now connects old leads, stalled quotes, contact repairs and dormant history before legal handoff.",
    prompts: ["Best growth bucket?", "Handoff risk?", "Who should own this?"],
  },
  {
    match: "/contact-intelligence",
    name: "Contact Intelligence",
    opener:
      "Contact Intelligence found phone/IP/email signals that can repair bad leads, but 11 repaired-phone cases still need human approval before dialling.",
    prompts: ["Which contacts are safe?", "Show phone risk", "Best repair rule?"],
  },
  {
    match: "/ai-outreach-command",
    name: "AI Outreach Command",
    opener:
      "AI Outreach has drafts ready, blocked and running. Approve the low-risk quote rescues first; keep contact repairs in review.",
    prompts: ["Approve what first?", "Show blocked drafts", "AI outreach ROI?"],
  },
  {
    match: "/dormant-lead-vault",
    name: "Dormant Lead Vault",
    opener:
      "The Dormant Vault is where old history becomes searchable money: sort by score, value, source, region and last signal before assigning tasks.",
    prompts: ["Best dormant leads?", "Highest value old rows?", "Which are risky?"],
  },
  {
    match: "/second-chance-revenue",
    name: "Second-Chance Instruction",
    opener:
      "Second-chance instruction value is forecastable now: base plan approvals show the safest recovery without pushing risky outreach too hard.",
    prompts: ["Show forecast", "Best ROI channel?", "Where is risk?"],
  },
  {
    match: "/matter-progression",
    name: "Legal Handoff",
    opener:
      "This is legal-team visibility after instruction handoff, useful for leadership comparison but not Connor's operating queue.",
    prompts: ["What changed after handoff?", "What is overdue?", "Fall-through trend?"],
  },
  {
    match: "/compliance",
    name: "Compliance",
    opener:
      "2 high-severity risk flags are open (PEP match, high-risk jurisdiction) and AML/SoF is only 71% clear.",
    prompts: ["What needs review?", "Where are matters stuck?", "KYC gaps?"],
  },
  {
    match: "/conversations",
    name: "Conversations",
    opener:
      "Avg first response is 6m (78% within SLA). 5 conversations are unassigned — want them routed?",
    prompts: ["Who is slowest to respond?", "Unassigned chats?", "Chat conversion?"],
  },
  {
    match: "/revenue",
    name: "Revenue",
    opener: "Here is where the money stands today.",
    prompts: ["What is at risk?", "Recovery ideas?"],
  },
  {
    match: "/dashboard",
    name: "Dashboard",
    opener:
      "Good morning. Today: 12 in the daily pipeline, 2 callbacks due, and 5 high-intent leads to chase first.",
    prompts: ["What should I do first?", "What changed since yesterday?", "Any risks today?"],
  },
  {
    match: "/daily-pipeline",
    name: "Daily Pipeline",
    opener:
      "Instructions are up vs yesterday and quote-acceptances are flowing. 2 overdue leads need a touch first.",
    prompts: ["What is overdue?", "What is trending up?", "Peak hours today?"],
  },
];

const DEFAULT_INFO = {
  name: "this page",
  opener: "How can I help on this page?",
  prompts: ["Summarise this page", "What needs my attention?", "What should I do next?"],
};

function pageInfo(path: string) {
  const found = PAGE_MAP.find((p) => path.startsWith(p.match));
  return found || DEFAULT_INFO;
}

type ChatMessage = { from: "ai" | "me"; text: string };

export const ApcmAdvisor: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [cost, setCost] = useState(0);
  const [tokens, setTokens] = useState(0);

  const info = pageInfo(location.pathname);

  useEffect(() => {
    if (open) {
      setMessages([{ from: "ai", text: info.opener }]);
    }
    // Seeds the page-specific opener each time the panel opens (or the page
    // changes while open). Depends only on open + pathname, so it cannot loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  const send = (text: string) => {
    const t = (text || "").trim();
    if (!t) return;
    const reply = "On " + info.name + ": " + info.opener;
    setMessages((m) => [...m, { from: "me", text: t }, { from: "ai", text: reply }]);
    setCost((c) => Math.round((c + 0.01) * 100) / 100);
    setTokens((n) => n + Math.max(20, Math.round(t.length * 4)));
    setDraft("");
  };

  return (
    <>
      {!open && (
        <button
          className="fixed bottom-24 right-4 z-50 h-12 w-12 rounded-full shadow-lg flex items-center justify-center"
          style={{ backgroundColor: "#4338ca" }}
          onClick={() => setOpen(true)}
          title="Ask APCM AI"
        >
          <Sparkles className="h-5 w-5 text-white" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-24 right-4 z-[60] w-96 max-w-[92vw] h-[32rem] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          <div
            className="flex items-center justify-between gap-2 p-3 text-white"
            style={{ backgroundColor: "#4338ca" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              <div>
                <div className="text-sm font-semibold leading-none">APCM AI</div>
                <div className="text-[11px] opacity-80">{"Advising on " + info.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="rounded-full px-2 py-0.5 text-[11px]"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                {"£" + cost.toFixed(2) + " · " + tokens + " tok"}
              </div>
              <button onClick={() => setOpen(false)} title="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={"flex " + (msg.from === "me" ? "justify-end" : "justify-start")}
              >
                {msg.from === "me" ? (
                  <div
                    className="max-w-[82%] rounded-2xl px-3 py-2 text-sm"
                    style={{ backgroundColor: "#4338ca", color: "white" }}
                  >
                    {msg.text}
                  </div>
                ) : (
                  <div className="max-w-[82%] rounded-2xl px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800">
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="px-3 pb-1 flex flex-wrap gap-1.5">
            {info.prompts.map((p, i) => (
              <button
                key={i}
                className="rounded-full border border-gray-200 px-2.5 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                onClick={() => send(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 p-3 border-t border-gray-200">
            <input
              className="flex-1 rounded-full border border-gray-300 px-3 py-2 text-sm"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") send(draft);
              }}
              placeholder="Ask about this page…"
            />
            <button
              className="rounded-full px-3 py-2 text-white"
              style={{ backgroundColor: "#4338ca" }}
              onClick={() => send(draft)}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
