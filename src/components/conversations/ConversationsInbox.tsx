import React, { useState } from "react";
import {
  MessageCircle,
  MessageSquare,
  Mail,
  Globe,
  Send,
  Plus,
} from "lucide-react";

type ChannelKind = "whatsapp" | "sms" | "email" | "web";

interface ConvThread {
  id: string;
  name: string;
  channel: ChannelKind;
  intent: string;
  last: string;
  at: string;
  unread: number;
  status: "open" | "closed";
  agent: string;
  responseMins: number;
  converted: boolean;
}

interface ConvMessage {
  from: "lead" | "agent";
  text: string;
  at: string;
}

interface Props {
  threads: ConvThread[];
  messages: Record<string, ConvMessage[]>;
  assignableAgents: string[];
}

function channelMeta(kind: ChannelKind): {
  label: string;
  color: string;
  Icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
} {
  switch (kind) {
    case "whatsapp":
      return { label: "WhatsApp", color: "#25D366", Icon: MessageCircle };
    case "sms":
      return { label: "SMS", color: "#0ea5e9", Icon: MessageSquare };
    case "email":
      return { label: "Email", color: "#6366f1", Icon: Mail };
    case "web":
    default:
      return { label: "Web", color: "#94a3b8", Icon: Globe };
  }
}

function firstName(s: string): string {
  return s.split(" ")[0];
}

export const ConversationsInbox: React.FC<Props> = ({
  threads,
  messages,
  assignableAgents,
}) => {
  const [localThreads, setLocalThreads] = useState<ConvThread[]>([]);
  const [activeId, setActiveId] = useState<string>(
    threads.length ? threads[0].id : ""
  );
  const [draft, setDraft] = useState<string>("");
  const [extra, setExtra] = useState<Record<string, ConvMessage[]>>({});
  const [showNew, setShowNew] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>("");
  const [newChannel, setNewChannel] = useState<ChannelKind>("whatsapp");
  const [newAgent, setNewAgent] = useState<string>(assignableAgents[0] || "");

  const allThreads = [...localThreads, ...threads];
  const activeThread =
    allThreads.find((t) => t.id === activeId) || allThreads[0];

  const startSession = () => {
    const nm = newName.trim();
    if (!nm) return;
    const t: ConvThread = {
      id: "local-" + (localThreads.length + 1),
      name: nm,
      channel: newChannel,
      intent: "New session",
      last: "",
      at: "now",
      unread: 0,
      status: "open",
      agent: newAgent,
      responseMins: 0,
      converted: false,
    };
    setLocalThreads([t, ...localThreads]);
    setActiveId(t.id);
    setNewName("");
    setShowNew(false);
  };

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    if (!activeThread) return;
    const id = activeThread.id;
    setExtra({
      ...extra,
      [id]: [...(extra[id] || []), { from: "agent", text, at: "now" }],
    });
    setDraft("");
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-0 shadow-sm overflow-hidden">
      <div className="flex h-[34rem]">
        {/* LEFT pane */}
        <div className="w-72 shrink-0 border-r border-gray-200 flex flex-col">
          <div className="p-3 border-b border-gray-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">
              Conversations
            </span>
            <button
              onClick={() => setShowNew((v) => !v)}
              className="text-xs font-medium text-indigo-700 inline-flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              New
            </button>
          </div>

          {showNew && (
            <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Lead name"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={newChannel}
                onChange={(e) => setNewChannel(e.target.value as ChannelKind)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="web">Web</option>
              </select>
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {assignableAgents.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              <button
                onClick={startSession}
                className="w-full rounded py-1.5 text-sm text-white"
                style={{ backgroundColor: "#1e3a8a" }}
              >
                Start
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {allThreads.map((t) => {
              const meta = channelMeta(t.channel);
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-gray-100 ${
                    t.id === activeId ? "bg-indigo-50" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {t.name}
                    </span>
                    <span className="ml-auto text-[11px] text-gray-400">
                      {t.at}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {t.last ? (
                      t.last
                    ) : (
                      <span className="text-gray-400">No messages</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-600">
                      @{firstName(t.agent)}
                    </span>
                    {t.converted && (
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "#16a34a" }}
                      >
                        won
                      </span>
                    )}
                    {t.unread > 0 && (
                      <span
                        className="ml-auto rounded-full text-white text-[10px] px-1.5 tabular-nums"
                        style={{ backgroundColor: "#4f46e5" }}
                      >
                        {t.unread}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT pane */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeThread ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
              Start a new conversation.
            </div>
          ) : (
            <>
              <div className="p-3 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {activeThread.name}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                    {channelMeta(activeThread.channel).label}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {activeThread.intent +
                    " · Handled by " +
                    activeThread.agent +
                    (activeThread.responseMins
                      ? " · responded in " + activeThread.responseMins + "m"
                      : "")}
                  {activeThread.converted && (
                    <span style={{ color: "#16a34a" }}> · instructed</span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {(() => {
                  const allMsgs = [
                    ...(messages[activeThread.id] || []),
                    ...(extra[activeThread.id] || []),
                  ];
                  if (allMsgs.length === 0) {
                    return (
                      <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No messages yet — say hello.
                      </div>
                    );
                  }
                  return allMsgs.map((m, i) => {
                    const isAgent = m.from === "agent";
                    return (
                      <div
                        key={i}
                        className={`flex ${
                          isAgent ? "justify-end" : "justify-start"
                        }`}
                      >
                        {isAgent ? (
                          <div
                            className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                            style={{
                              backgroundColor: "#1e3a8a",
                              color: "white",
                            }}
                          >
                            <div>{m.text}</div>
                            <div className="text-[10px] mt-0.5 opacity-70">
                              {m.at}
                            </div>
                          </div>
                        ) : (
                          <div className="max-w-[75%] rounded-2xl px-3 py-2 text-sm bg-white border border-gray-200 text-gray-800">
                            <div>{m.text}</div>
                            <div className="text-[10px] mt-0.5 opacity-70">
                              {m.at}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              <div className="p-3 border-t border-gray-200 flex items-center gap-2">
                <input
                  className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") send();
                  }}
                  placeholder="Type a message…"
                />
                <button
                  onClick={send}
                  className="rounded-full px-4 py-2 text-white"
                  style={{ backgroundColor: "#1e3a8a" }}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
