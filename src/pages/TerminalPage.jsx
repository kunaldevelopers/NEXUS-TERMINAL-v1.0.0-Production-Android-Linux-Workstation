import React, { useEffect, useRef, useState } from 'react';
import {
  ClipboardCopy,
  ClipboardPaste,
  Minus,
  Plus,
  Search,
  Skull,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from 'lucide-react';
import { useNexus } from '../state/NexusContext';
import XtermViewport from '../components/Terminal/XtermViewport';
import ShortcutToolbar from '../components/Terminal/ShortcutToolbar';
import { encodeBase64Utf8, nexusBridge } from '../bridge/nexusBridge';

export default function TerminalPage() {
  const {
    theme,
    settings,
    updateSettings,
    environments,
    defaultEnvId,
    sessions,
    activeSessionId,
    setActiveSessionId,
    createTerminalTab,
    closeTerminalTab,
  } = useNexus();

  const xtermRef = useRef(null);
  const [ctrlActive, setCtrlActive] = useState(false);
  const [altActive, setAltActive] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTabModal, setNewTabModal] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState('');
  const [selectedShell, setSelectedShell] = useState(settings.defaultShell || '/bin/bash');
  const [dimensions, setDimensions] = useState({ cols: 80, rows: 24 });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!selectedEnv && (defaultEnvId || environments[0])) {
      setSelectedEnv(defaultEnvId || environments[0]?.envId || 'android-shell');
    }
  }, [defaultEnvId, environments, selectedEnv]);

  const activeSession = sessions.find((s) => s.sessionId === activeSessionId) || sessions[0];

  const handleCreateTab = async (envIdOverride, shellOverride) => {
    setErrorMsg('');
    try {
      await createTerminalTab({
        envId: envIdOverride || selectedEnv || defaultEnvId || 'android-shell',
        shell: shellOverride || selectedShell,
      });
      setNewTabModal(false);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to start terminal session');
    }
  };

  const handleSendSeq = (seq) => {
    if (!activeSession) return;
    let finalSeq = seq;
    if (ctrlActive && seq.length === 1) {
      const code = seq.toUpperCase().charCodeAt(0);
      if (code >= 64 && code <= 95) finalSeq = String.fromCharCode(code - 64);
    }
    if (altActive) finalSeq = '\x1b' + finalSeq;
    setCtrlActive(false);
    setAltActive(false);
    nexusBridge.terminal.writeInput(activeSession.sessionId, encodeBase64Utf8(finalSeq)).catch(() => {});
    xtermRef.current?.focus();
  };

  const handleCopy = async () => {
    const sel = xtermRef.current?.getSelection();
    if (sel) {
      await navigator.clipboard.writeText(sel).catch(() => {});
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) xtermRef.current?.pasteText(text);
    } catch {
      // Clipboard API permission fallback
    }
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Tab Strip & Action Bar */}
      <div
        className="shrink-0 border-b px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
      >
        {sessions.map((sess) => {
          const isActive = sess.sessionId === activeSession?.sessionId;
          return (
            <div
              key={sess.sessionId}
              className="shrink-0 flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg text-xs border cursor-pointer transition"
              style={{
                backgroundColor: isActive ? `${theme.ui.accent}20` : theme.ui.bgElevated,
                borderColor: isActive ? theme.ui.accent : 'rgba(255,255,255,0.08)',
                color: isActive ? theme.ui.accent : theme.ui.text,
              }}
              onClick={() => setActiveSessionId(sess.sessionId)}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: sess.alive ? theme.ui.success : theme.ui.error }}
              />
              <span className="font-mono max-w-28 truncate">{sess.title || sess.envId}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTerminalTab(sess.sessionId);
                }}
                className="p-0.5 rounded hover:bg-white/15 opacity-70 hover:opacity-100"
                title="Close Tab"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setNewTabModal(true)}
          className="shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border hover:bg-white/10"
          style={{ borderColor: theme.ui.border, color: theme.ui.accent }}
        >
          <Plus className="w-3.5 h-3.5" /> New
        </button>

        <div className="ml-auto flex items-center gap-1 shrink-0 pl-2">
          <span className="hidden sm:inline text-[10px] font-mono opacity-55 mr-1">
            {dimensions.cols}x{dimensions.rows}
          </span>
          <button
            type="button"
            onClick={() => updateSettings({ fontSize: Math.max(9, settings.fontSize - 1) })}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Decrease Font"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => updateSettings({ fontSize: Math.min(24, settings.fontSize + 1) })}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Increase Font"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Copy Selection"
          >
            <ClipboardCopy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handlePaste}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Paste"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Search Terminal Output"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => xtermRef.current?.clear()}
            className="p-1.5 rounded-lg hover:bg-white/10"
            title="Clear Screen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {activeSession && (
            <button
              type="button"
              onClick={() => nexusBridge.terminal.sendSignal(activeSession.sessionId, 9).catch(() => {})}
              className="p-1.5 rounded-lg hover:bg-white/10"
              style={{ color: theme.ui.error }}
              title="Send SIGKILL"
            >
              <Skull className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Optional Search Bar */}
      {searchOpen && (
        <div
          className="shrink-0 px-3 py-1.5 border-b flex items-center gap-2"
          style={{ backgroundColor: theme.ui.bgElevated, borderColor: theme.ui.border }}
        >
          <Search className="w-3.5 h-3.5 opacity-60" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') xtermRef.current?.findNext(searchQuery);
            }}
            placeholder="Search scrollback output..."
            className="flex-1 bg-transparent text-xs outline-none font-mono"
          />
          <button
            type="button"
            onClick={() => xtermRef.current?.findPrevious(searchQuery)}
            className="px-2 py-0.5 rounded bg-white/10 text-[11px]"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => xtermRef.current?.findNext(searchQuery)}
            className="px-2 py-0.5 rounded bg-white/10 text-[11px]"
          >
            Next
          </button>
          <button type="button" onClick={() => setSearchOpen(false)} className="p-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          className="shrink-0 px-3 py-2 text-xs font-mono border-b"
          style={{
            backgroundColor: `${theme.ui.error}18`,
            borderColor: `${theme.ui.error}44`,
            color: theme.ui.error,
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Main Terminal Viewport */}
      <div className="flex-1 min-h-0 p-1.5 relative">
        {activeSession ? (
          <XtermViewport
            ref={xtermRef}
            key={activeSession.sessionId}
            sessionId={activeSession.sessionId}
            ctrlActive={ctrlActive}
            altActive={altActive}
            onConsumeModifiers={() => {
              setCtrlActive(false);
              setAltActive(false);
            }}
            onResizeNotice={(cols, rows) => setDimensions({ cols, rows })}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center border"
              style={{
                backgroundColor: `${theme.ui.accent}15`,
                borderColor: `${theme.ui.accent}44`,
                color: theme.ui.accent,
              }}
            >
              <TerminalIcon className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-base font-bold">No Active Terminal Session</h2>
              <p className="text-xs opacity-70">
                {nexusBridge.isNative()
                  ? 'Launch an interactive PTY session inside an installed Linux distribution or Android native shell.'
                  : 'Running in browser preview. Build and install the Android APK to launch real PRoot + PTY shells.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {environments.map((env) => (
                <button
                  key={env.envId}
                  type="button"
                  onClick={() => handleCreateTab(env.envId, env.defaultShell || settings.defaultShell)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-black"
                  style={{ backgroundColor: theme.ui.accent }}
                >
                  Launch {env.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleCreateTab('android-shell', '/system/bin/sh')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border hover:bg-white/5"
                style={{ borderColor: theme.ui.border }}
              >
                Android Native Shell (/system/bin/sh)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Terminal Shortcut Toolbar */}
      <ShortcutToolbar
        ctrlActive={ctrlActive}
        altActive={altActive}
        onToggleCtrl={() => setCtrlActive((v) => !v)}
        onToggleAlt={() => setAltActive((v) => !v)}
        onSendSequence={handleSendSeq}
      />

      {/* New Session Modal */}
      {newTabModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div
            className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
            style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">New Terminal Session</h3>
              <button type="button" onClick={() => setNewTabModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block opacity-70 mb-1">Target Environment</label>
                <select
                  value={selectedEnv}
                  onChange={(e) => setSelectedEnv(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
                  style={{ borderColor: theme.ui.border }}
                >
                  {environments.map((env) => (
                    <option key={env.envId} value={env.envId}>
                      {env.name} ({env.distroId} • {env.version})
                    </option>
                  ))}
                  <option value="android-shell">Android Native Shell (/system/bin/sh)</option>
                </select>
              </div>

              <div>
                <label className="block opacity-70 mb-1">Shell Binary</label>
                <select
                  value={selectedShell}
                  onChange={(e) => setSelectedShell(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-black/40 outline-none font-mono"
                  style={{ borderColor: theme.ui.border }}
                >
                  <option value="/bin/bash">/bin/bash (Bash)</option>
                  <option value="/bin/zsh">/bin/zsh (Zsh — if installed)</option>
                  <option value="/usr/bin/fish">/usr/bin/fish (Fish — if installed)</option>
                  <option value="/bin/sh">/bin/sh (POSIX / BusyBox sh)</option>
                  <option value="/system/bin/sh">/system/bin/sh (Android Shell)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewTabModal(false)}
                className="px-4 py-2 rounded-xl text-xs bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleCreateTab()}
                className="px-4 py-2 rounded-xl text-xs font-bold text-black"
                style={{ backgroundColor: theme.ui.accent }}
              >
                Start PTY Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

