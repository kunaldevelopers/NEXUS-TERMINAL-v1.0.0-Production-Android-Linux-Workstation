import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NEXUS_THEMES, TERMINAL_FONTS } from '../constants/themes';
import { DEFAULT_TOOLBAR_KEYS } from '../constants/shortcuts';
import { nexusBridge } from '../bridge/nexusBridge';

const STORAGE_KEY = 'nexus_terminal_settings_v1';

const DEFAULT_SETTINGS = {
  themeId: 'cyberpunk-neon',
  fontId: 'jetbrains',
  fontSize: 13,
  terminalOpacity: 100,
  cursorStyle: 'block',
  cursorBlink: true,
  customPromptEnabled: true,
  promptShowGit: true,
  promptShowExitCode: true,
  defaultShell: '/bin/bash',
  foregroundServiceEnabled: true,
  wakelockEnabled: false,
  toolbarKeyIds: DEFAULT_TOOLBAR_KEYS.map((k) => k.id),
  aiProvider: 'ollama',
  aiEndpoint: 'http://127.0.0.1:11434/api/chat',
  aiModel: 'qwen2.5-coder:7b',
};

function loadInitialSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const NexusContext = createContext(null);

export function NexusProvider({ children }) {
  const [settings, setSettings] = useState(loadInitialSettings);
  const [environments, setEnvironments] = useState([]);
  const [defaultEnvId, setDefaultEnvId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [systemMetrics, setSystemMetrics] = useState(null);
  const [distroProgress, setDistroProgress] = useState({});
  const [aiApiKey, setAiApiKey] = useState('');

  const outputSubscribersRef = useRef(new Map());

  const theme = useMemo(
    () => NEXUS_THEMES[settings.themeId] || NEXUS_THEMES['cyberpunk-neon'],
    [settings.themeId]
  );

  const font = useMemo(
    () => TERMINAL_FONTS.find((f) => f.id === settings.fontId) || TERMINAL_FONTS[0],
    [settings.fontId]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota errors
    }
    const root = document.documentElement;
    root.style.setProperty('--bg-primary', theme.ui.bgPrimary);
    root.style.setProperty('--bg-secondary', theme.ui.bgSecondary);
    root.style.setProperty('--bg-elevated', theme.ui.bgElevated);
    root.style.setProperty('--border-subtle', theme.ui.border);
    root.style.setProperty('--accent-cyan', theme.ui.accent);
    root.style.setProperty('--accent-purple', theme.ui.secondary);
    root.style.setProperty('--accent-green', theme.ui.success);
    root.style.setProperty('--accent-blue', theme.ui.info);
    root.style.setProperty('--accent-warn', theme.ui.warning);
    root.style.setProperty('--accent-error', theme.ui.error);
    root.style.setProperty('--text-primary', theme.ui.text);
  }, [settings, theme]);

  const updateSettings = useCallback((patch) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const refreshEnvironments = useCallback(async () => {
    try {
      const res = await nexusBridge.distro.listEnvironments();
      setEnvironments(res.environments || []);
      setDefaultEnvId(res.defaultEnvId || null);
      return res;
    } catch {
      return { environments: [], defaultEnvId: null };
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const res = await nexusBridge.terminal.listSessions();
      const list = res.sessions || [];
      setSessions(list);
      setActiveSessionId((curr) => {
        if (curr && list.some((s) => s.sessionId === curr)) return curr;
        return list.length > 0 ? list[0].sessionId : null;
      });
      return list;
    } catch {
      return [];
    }
  }, []);

  const refreshMetrics = useCallback(async () => {
    try {
      const metrics = await nexusBridge.system.getMetrics();
      setSystemMetrics(metrics);
      return metrics;
    } catch {
      return null;
    }
  }, []);

  const subscribeTerminalOutput = useCallback((sessionId, callback) => {
    const map = outputSubscribersRef.current;
    if (!map.has(sessionId)) {
      map.set(sessionId, new Set());
    }
    map.get(sessionId).add(callback);
    return () => {
      const set = map.get(sessionId);
      if (set) {
        set.delete(callback);
        if (set.size === 0) map.delete(sessionId);
      }
    };
  }, []);

  const createTerminalTab = useCallback(
    async ({ envId, shell, cwd, initialCommand, title } = {}) => {
      const targetEnvId = envId || defaultEnvId || (environments[0]?.envId ?? 'android-shell');
      const res = await nexusBridge.terminal.createSession({
        envId: targetEnvId,
        shell: shell || settings.defaultShell,
        cwd: cwd || '/root',
        cols: 80,
        rows: 24,
        customPrompt: settings.customPromptEnabled,
        promptShowGit: settings.promptShowGit,
        promptShowExitCode: settings.promptShowExitCode,
        initialCommand: initialCommand || '',
        title: title || '',
      });
      await refreshSessions();
      setActiveSessionId(res.sessionId);
      if (settings.foregroundServiceEnabled) {
        nexusBridge.terminal
          .setForegroundService(true, settings.wakelockEnabled)
          .catch(() => {});
      }
      return res;
    },
    [defaultEnvId, environments, refreshSessions, settings]
  );

  const closeTerminalTab = useCallback(
    async (sessionId) => {
      await nexusBridge.terminal.killSession(sessionId);
      const list = await refreshSessions();
      if (list.length === 0) {
        nexusBridge.terminal.setForegroundService(false, false).catch(() => {});
      }
    },
    [refreshSessions]
  );

  useEffect(() => {
    refreshEnvironments();
    refreshSessions();
    refreshMetrics();

    if (nexusBridge.isNative()) {
      nexusBridge.system
        .getSecureSecret('ai_api_key')
        .then((res) => {
          if (res?.value) setAiApiKey(res.value);
        })
        .catch(() => {});
    }

    let outHandle = null;
    let exitHandle = null;
    let distroHandle = null;

    nexusBridge.terminal
      .addOutputListener((event) => {
        const subs = outputSubscribersRef.current.get(event.sessionId);
        if (subs) {
          subs.forEach((cb) => cb(event));
        }
      })
      .then((h) => {
        outHandle = h;
      });

    nexusBridge.terminal
      .addExitListener((event) => {
        setSessions((prev) =>
          prev.map((s) =>
            s.sessionId === event.sessionId
              ? { ...s, alive: false, exitCode: event.exitCode }
              : s
          )
        );
        const subs = outputSubscribersRef.current.get(event.sessionId);
        if (subs) {
          subs.forEach((cb) => cb({ ...event, exited: true }));
        }
      })
      .then((h) => {
        exitHandle = h;
      });

    nexusBridge.distro
      .addProgressListener((event) => {
        setDistroProgress((prev) => ({
          ...prev,
          [event.envId]: event,
        }));
        if (event.phase === 'completed' || event.phase === 'error' || event.phase === 'cancelled') {
          refreshEnvironments();
        }
      })
      .then((h) => {
        distroHandle = h;
      });

    return () => {
      outHandle?.remove?.();
      exitHandle?.remove?.();
      distroHandle?.remove?.();
    };
  }, [refreshEnvironments, refreshMetrics, refreshSessions]);

  const saveAiApiKey = useCallback(async (val) => {
    setAiApiKey(val);
    if (nexusBridge.isNative()) {
      await nexusBridge.system.saveSecureSecret('ai_api_key', val);
    }
  }, []);

  const value = {
    settings,
    updateSettings,
    theme,
    font,
    environments,
    defaultEnvId,
    refreshEnvironments,
    sessions,
    activeSessionId,
    setActiveSessionId,
    refreshSessions,
    createTerminalTab,
    closeTerminalTab,
    subscribeTerminalOutput,
    systemMetrics,
    refreshMetrics,
    distroProgress,
    aiApiKey,
    saveAiApiKey,
  };

  return <NexusContext.Provider value={value}>{children}</NexusContext.Provider>;
}

export function useNexus() {
  const ctx = useContext(NexusContext);
  if (!ctx) throw new Error('useNexus must be used within NexusProvider');
  return ctx;
}

