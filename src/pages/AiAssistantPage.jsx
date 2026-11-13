import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bot, Play, Send, Settings2, Terminal } from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import { encodeBase64Utf8, nexusBridge } from '../bridge/nexusBridge';

const DESTRUCTIVE_PATTERNS = [
  /\brm\s+-[^\s]*r[^\s]*f\b/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\(\)\s*\{/,
  /\bchmod\s+-R\s+777\s+\/\b/,
  />\s*\/dev\/sd/i,
];

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:bash|sh|zsh|python|js|javascript)?\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(text)) !== null) {
    blocks.push(m[1].trim());
  }
  return blocks;
}

function isDestructive(cmd) {
  return DESTRUCTIVE_PATTERNS.some((re) => re.test(cmd));
}

export default function AiAssistantPage() {
  const navigate = useNavigate();
  const { theme, settings, aiApiKey, environments, defaultEnvId, createTerminalTab, sessions, activeSessionId } = useNexus();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'NEXUS AI Assistant ready. Configure Ollama (local), OpenAI, Gemini, or Anthropic in Settings. Commands are always previewed before execution and destructive operations are flagged.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  const sendPrompt = async (e) => {
    e?.preventDefault();
    if (!prompt.trim() || loading) return;
    const userMsg = { role: 'user', content: prompt.trim() };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setPrompt('');
    setLoading(true);

    const sysPrompt =
      'You are NEXUS Linux Workstation Assistant on Android ARM64 PRoot. Provide accurate Linux, Bash, Python, Node.js, Git, APT/APK/Pacman, and networking explanations. Put executable shell commands in ```bash fenced blocks. Never invent fake outputs.';

    try {
      let reply = '';
      if (settings.aiProvider === 'ollama') {
        const res = await fetch(settings.aiEndpoint || 'http://127.0.0.1:11434/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: settings.aiModel || 'qwen2.5-coder:7b',
            stream: false,
            messages: [{ role: 'system', content: sysPrompt }, ...nextHistory],
          }),
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        reply = data.message?.content || JSON.stringify(data);
      } else if (settings.aiProvider === 'gemini') {
        if (!aiApiKey) throw new Error('Set your Gemini API key in Settings -> AI Configuration.');
        const model = settings.aiModel || 'gemini-2.5-flash';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(aiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: sysPrompt }] },
              contents: nextHistory.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }],
              })),
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Gemini HTTP ${res.status}`);
        reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Empty response';
      } else {
        if (!aiApiKey) throw new Error('Set your provider API key in Settings -> AI Configuration.');
        const endpoint = settings.aiEndpoint || 'https://api.openai.com/v1/chat/completions';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiApiKey}`,
          },
          body: JSON.stringify({
            model: settings.aiModel || 'gpt-4o-mini',
            messages: [{ role: 'system', content: sysPrompt }, ...nextHistory],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || `Provider HTTP ${res.status}`);
        reply = data.choices?.[0]?.message?.content || 'Empty response';
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `[Provider Error] ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const executePreviewedCommand = async (cmd) => {
    if (isDestructive(cmd)) {
      if (!confirm(`WARNING: Potentially destructive command detected:\n\n${cmd}\n\nProceed?`)) {
        return;
      }
    }
    const alive = sessions.find((s) => s.sessionId === activeSessionId && s.alive);
    if (alive) {
      await nexusBridge.terminal.writeInput(alive.sessionId, encodeBase64Utf8(cmd + '\n'));
      navigate('/terminal');
    } else {
      const targetEnv = defaultEnvId || environments[0]?.envId || 'android-shell';
      await createTerminalTab({ envId: targetEnv, initialCommand: cmd });
      navigate('/terminal');
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Bot className="w-5 h-5" style={{ color: theme.ui.success }} />
            AI Linux Assistant
          </h1>
          <p className="text-xs opacity-70 font-mono">
            Provider: {settings.aiProvider} ({settings.aiModel})
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="px-3 py-1.5 rounded-xl text-xs border flex items-center gap-1.5 hover:bg-white/5"
          style={{ borderColor: theme.ui.border }}
        >
          <Settings2 className="w-3.5 h-3.5" /> Configure AI
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5">
        {[
          'Explain chmod 755 vs 644',
          'Write a bash script to check open ports',
          'Why did apt install fail with permission denied in PRoot?',
          'Generate a Python FastAPI starter command',
        ].map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setPrompt(q)}
            className="px-2.5 py-1 rounded-lg text-[11px] bg-white/5 hover:bg-white/10 border border-white/10"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Chat Transcript */}
      <div
        className="flex-1 min-h-64 overflow-y-auto rounded-2xl border p-4 space-y-3"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
      >
        {messages.map((msg, idx) => {
          const blocks = msg.role === 'assistant' ? extractCodeBlocks(msg.content) : [];
          return (
            <div
              key={idx}
              className={`p-3 rounded-xl text-xs whitespace-pre-wrap leading-relaxed ${
                msg.role === 'user' ? 'ml-8 border' : 'mr-4 bg-black/35 border border-white/10'
              }`}
              style={
                msg.role === 'user'
                  ? { backgroundColor: `${theme.ui.accent}18`, borderColor: `${theme.ui.accent}44` }
                  : {}
              }
            >
              <div className="font-mono text-[10px] opacity-60 mb-1 uppercase">
                {msg.role === 'user' ? 'You' : 'NEXUS AI'}
              </div>
              {msg.content}

              {blocks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {blocks.map((cmd, bIdx) => {
                    const dangerous = isDestructive(cmd);
                    return (
                      <div
                        key={bIdx}
                        className="p-2.5 rounded-xl border bg-black/60 flex items-center justify-between gap-2"
                        style={{ borderColor: dangerous ? theme.ui.error : theme.ui.border }}
                      >
                        <div className="min-w-0 font-mono text-[11px]">
                          {dangerous && (
                            <div className="flex items-center gap-1 text-[10px] font-bold mb-1" style={{ color: theme.ui.error }}>
                              <AlertTriangle className="w-3 h-3" /> DESTRUCTIVE COMMAND GUARD
                            </div>
                          )}
                          <div className="truncate">{cmd}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => executePreviewedCommand(cmd)}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-black flex items-center gap-1 shrink-0"
                          style={{ backgroundColor: dangerous ? theme.ui.error : theme.ui.success }}
                        >
                          <Play className="w-3 h-3 fill-current" /> Run
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {loading && <div className="text-xs font-mono opacity-65">Generating response...</div>}
      </div>

      <form onSubmit={sendPrompt} className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Linux, Bash, Python, Node.js, Git, or error debugging questions..."
          className="flex-1 p-3 rounded-xl border bg-black/40 text-xs outline-none"
          style={{ borderColor: theme.ui.border }}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-3 rounded-xl text-xs font-bold text-black flex items-center gap-1.5"
          style={{ backgroundColor: theme.ui.accent }}
        >
          <Send className="w-4 h-4" /> Send
        </button>
      </form>
    </div>
  );
}

