// APCM AI floating assistant — opens straight into a direct chat (v2). No digest-first
// landing: click the button, start asking. "Open full APCM AI" goes to the page.

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Brain, ChevronDown, Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { APCM_AI_ENABLED } from '@/lib/featureFlags';
import { ApcmAiChat } from '@/components/ApcmAiChat';

export function ApcmAiFloat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const isManagerView = user?.role === 'Manager' || user?.role === 'Admin';

  if (!APCM_AI_ENABLED || !isManagerView || isDismissed) return null;
  // The full page renders its own experience — no float on top of it.
  if (location.pathname === '/apcm-ai') return null;

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
                <p className="text-[11px] text-white/60">Ask anything · v2 draft</p>
              </div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1.5 text-white/70 hover:text-white" title="Minimise" aria-label="Minimise APCM AI">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Direct chat */}
          <div className="p-3">
            <ApcmAiChat variant="compact" onOpenFull={() => { setIsOpen(false); navigate('/apcm-ai'); }} />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end border-t border-gray-100 bg-gray-50 px-4 py-2">
            <button type="button" onClick={() => setIsDismissed(true)} className="text-xs text-gray-400 hover:text-gray-600">
              Hide for this session
            </button>
          </div>
        </div>
      )}

      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 rounded-full bg-navy-950 py-2 pl-2.5 pr-4 text-white shadow-xl transition hover:bg-navy-800"
          title="Ask APCM AI"
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
