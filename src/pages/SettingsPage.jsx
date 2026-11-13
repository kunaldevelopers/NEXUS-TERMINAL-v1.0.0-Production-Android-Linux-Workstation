import React, { useEffect, useState } from 'react';
import {
  BatteryCharging,
  Bot,
  HardDrive,
  Keyboard,
  Palette,
  Settings,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { NEXUS_THEMES, TERMINAL_FONTS } from '../constants/themes';
import { ALL_CUSTOMIZABLE_KEYS } from '../constants/shortcuts';
import { useNexus } from '../state/NexusContext';
import { nexusBridge } from '../bridge/nexusBridge';
import { ConfirmModal } from '../components/common/MetricGauge';

export default function SettingsPage() {
  const {
    theme,
    settings,
    updateSettings,
    environments,
    defaultEnvId,
    refreshEnvironments,
    aiApiKey,
    saveAiApiKey,
  } = useNexus();

  const [permStatus, setPermStatus] = useState({ granted: false });
  const [batteryIgnored, setBatteryIgnored] = useState(false);
  const [keyDraft, setKeyDraft] = useState(aiApiKey || '');
  const [wipeConfirm, setWipeConfirm] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setKeyDraft(aiApiKey || '');
  }, [aiApiKey]);

  useEffect(() => {
    nexusBridge.system.getStoragePermissionStatus().then(setPermStatus).catch(() => {});
    nexusBridge.system.checkBatteryOptimization().then((r) => setBatteryIgnored(Boolean(r?.ignoring))).catch(() => {});
  }, []);

  const toggleToolbarKey = (id) => {
    const curr = settings.toolbarKeyIds || [];
    const next = curr.includes(id) ? curr.filter((k) => k !== id) : [...curr, id];
    updateSettings({ toolbarKeyIds: next });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Settings className="w-5 h-5" style={{ color: theme.ui.accent }} />
          Workstation Settings & Customization
        </h1>
        <p className="text-xs opacity-70">
          Customize terminal appearance, shortcuts, shells, AI providers, Android permissions, and storage.
        </p>
      </div>

      {notice && (
        <div className="p-3 rounded-xl border text-xs font-mono" style={{ borderColor: theme.ui.success, color: theme.ui.success }}>
          {notice}
        </div>
      )}

      {/* 1. Themes */}
      <section className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Palette className="w-4 h-4" style={{ color: theme.ui.accent }} />
          Terminal & UI Theme
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {Object.values(NEXUS_THEMES).map((t) => {
            const active = t.id === settings.themeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => updateSettings({ themeId: t.id })}
                className="p-3 rounded-xl border text-left transition space-y-1.5"
                style={{
                  backgroundColor: t.ui.bgPrimary,
                  borderColor: active ? t.ui.accent : 'rgba(255,255,255,0.12)',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: t.ui.text }}>{t.name}</span>
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.ui.accent }} />
                </div>
                <div className="flex gap-1">
                  {[t.ui.accent, t.ui.secondary, t.ui.success, t.ui.warning, t.ui.error].map((c, i) => (
                    <span key={i} className="w-3 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Typography, Cursor & Prompt */}
      <section className="rounded-2xl border p-4 space-y-4 text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h2 className="text-sm font-bold">Typography, Cursor & Prompt</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block opacity-70 mb-1">Terminal Font</label>
            <select
              value={settings.fontId}
              onChange={(e) => updateSettings({ fontId: e.target.value })}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            >
              {TERMINAL_FONTS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block opacity-70 mb-1">Font Size: {settings.fontSize}px</label>
            <input
              type="range"
              min="9"
              max="24"
              value={settings.fontSize}
              onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div>
            <label className="block opacity-70 mb-1">Opacity: {settings.terminalOpacity}%</label>
            <input
              type="range"
              min="65"
              max="100"
              value={settings.terminalOpacity}
              onChange={(e) => updateSettings({ terminalOpacity: Number(e.target.value) })}
              className="w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block opacity-70 mb-1">Cursor Style</label>
            <select
              value={settings.cursorStyle}
              onChange={(e) => updateSettings({ cursorStyle: e.target.value })}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            >
              <option value="block">Block</option>
              <option value="underline">Underline</option>
              <option value="bar">Vertical Bar</option>
            </select>
          </div>
          <label className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={settings.cursorBlink}
              onChange={(e) => updateSettings({ cursorBlink: e.target.checked })}
            />
            Blinking Cursor
          </label>
          <label className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              checked={settings.customPromptEnabled}
              onChange={(e) => updateSettings({ customPromptEnabled: e.target.checked })}
            />
            Git Branch & Exit Code Prompt
          </label>
        </div>
      </section>

      {/* 3. Mobile Toolbar Keys */}
      <section className="rounded-2xl border p-4 space-y-3 text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Keyboard className="w-4 h-4" style={{ color: theme.ui.secondary }} />
          Shortcut Toolbar Keys
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CUSTOMIZABLE_KEYS.map((k) => {
            const enabled = (settings.toolbarKeyIds || []).includes(k.id);
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => toggleToolbarKey(k.id)}
                className="px-2.5 py-1 rounded-lg font-mono text-[11px] border"
                style={{
                  backgroundColor: enabled ? `${theme.ui.accent}24` : 'transparent',
                  borderColor: enabled ? theme.ui.accent : 'rgba(255,255,255,0.12)',
                  color: enabled ? theme.ui.accent : '#9CA3AF',
                }}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 4. Default Environment, Shell & Android Integration */}
      <section className="rounded-2xl border p-4 space-y-4 text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <HardDrive className="w-4 h-4" style={{ color: theme.ui.success }} />
          Default Linux Environment & Android Integration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block opacity-70 mb-1">Default Linux Distribution</label>
            <select
              value={defaultEnvId || ''}
              onChange={(e) => nexusBridge.distro.setDefaultEnvironment(e.target.value).then(refreshEnvironments)}
              className="w-full p-2.5 rounded-xl border bg-black/40 outline-none"
              style={{ borderColor: theme.ui.border }}
            >
              <option value="">None / Ask</option>
              {environments.map((e) => (
                <option key={e.envId} value={e.envId}>{e.name} ({e.distroId})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block opacity-70 mb-1">Default Shell</label>
            <select
              value={settings.defaultShell}
              onChange={(e) => updateSettings({ defaultShell: e.target.value })}
              className="w-full p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
              style={{ borderColor: theme.ui.border }}
            >
              <option value="/bin/bash">/bin/bash</option>
              <option value="/bin/zsh">/bin/zsh</option>
              <option value="/usr/bin/fish">/usr/bin/fish</option>
              <option value="/bin/sh">/bin/sh</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.foregroundServiceEnabled}
              onChange={(e) => updateSettings({ foregroundServiceEnabled: e.target.checked })}
            />
            Persistent Foreground Session Notification
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={settings.wakelockEnabled}
              onChange={(e) => updateSettings({ wakelockEnabled: e.target.checked })}
            />
            Acquire CPU WakeLock during Active Sessions
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="button"
            onClick={() => nexusBridge.system.requestStoragePermission().catch((e) => setNotice(e.message))}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15"
          >
            Storage Access: {permStatus.granted ? 'Granted' : 'Request All Files / Storage'}
          </button>
          <button
            type="button"
            onClick={() => nexusBridge.system.requestIgnoreBatteryOptimization().catch((e) => setNotice(e.message))}
            className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 flex items-center gap-1.5"
          >
            <BatteryCharging className="w-3.5 h-3.5" />
            Battery Optimization: {batteryIgnored ? 'Unrestricted' : 'Request Unrestricted'}
          </button>
        </div>
      </section>

      {/* 5. AI Configuration */}
      <section className="rounded-2xl border p-4 space-y-3 text-xs" style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}>
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Bot className="w-4 h-4" style={{ color: theme.ui.info }} />
          AI Assistant Provider Configuration (No Hardcoded Keys)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <select
            value={settings.aiProvider}
            onChange={(e) => updateSettings({ aiProvider: e.target.value })}
            className="p-2.5 rounded-xl border bg-black/40 outline-none"
            style={{ borderColor: theme.ui.border }}
          >
            <option value="ollama">Local Ollama</option>
            <option value="openai">OpenAI / Compatible</option>
            <option value="gemini">Google Gemini API</option>
          </select>
          <input
            type="text"
            value={settings.aiModel}
            onChange={(e) => updateSettings({ aiModel: e.target.value })}
            placeholder="Model name"
            className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
            style={{ borderColor: theme.ui.border }}
          />
          <input
            type="text"
            value={settings.aiEndpoint}
            onChange={(e) => updateSettings({ aiEndpoint: e.target.value })}
            placeholder="Endpoint URL"
            className="p-2.5 rounded-xl border bg-black/40 font-mono outline-none"
            style={{ borderColor: theme.ui.border }}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="API Key (stored encrypted on Android Keystore)"
            className="flex-1 p-2.5 rounded-xl border bg-black/40 outline-none"
            style={{ borderColor: theme.ui.border }}
          />
          <button
            type="button"
            onClick={async () => {
              await saveAiApiKey(keyDraft);
              setNotice('API key saved encrypted.');
            }}
            className="px-4 py-2 rounded-xl font-bold text-black"
            style={{ backgroundColor: theme.ui.accent }}
          >
            Save Key
          </button>
        </div>
      </section>

      {/* 6. Danger Zone */}
      <section className="rounded-2xl border p-4 flex items-center justify-between gap-4 text-xs" style={{ backgroundColor: `${theme.ui.error}10`, borderColor: `${theme.ui.error}44` }}>
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.ui.error }} />
          <div>
            <div className="font-bold" style={{ color: theme.ui.error }}>Complete Application Data Wipe</div>
            <div className="opacity-75">Terminates all PTY sessions and erases all installed Linux root filesystems, SSH encrypted vault, and settings.</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWipeConfirm(true)}
          className="px-3.5 py-2 rounded-xl font-bold text-black shrink-0 flex items-center gap-1"
          style={{ backgroundColor: theme.ui.error }}
        >
          <Trash2 className="w-3.5 h-3.5" /> Wipe Data
        </button>
      </section>

      <ConfirmModal
        open={wipeConfirm}
        danger
        title="Wipe All NEXUS Data?"
        message="This will delete every installed Linux distribution, project file inside rootfs, SSH credential vault, and local settings."
        confirmLabel="Erase Everything"
        onCancel={() => setWipeConfirm(false)}
        onConfirm={async () => {
          setWipeConfirm(false);
          localStorage.clear();
          await nexusBridge.system.wipeAllAppData().catch(() => {});
          window.location.reload();
        }}
      />
    </div>
  );
}

